'use strict';

// Telemetry — JSONL event writer with rotation
const fs = require('fs');
const path = require('path');

class Telemetry {
  constructor(options = {}) {
    this.logDir = options.logDir || path.join(process.cwd(), '.suite', 'telemetry');
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 5;
    this.currentFile = null;
    this._closed = false;
    this._ensureDir();
    this._openCurrentLog();
  }

  _ensureDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  _getLogFiles() {
    if (!fs.existsSync(this.logDir)) return [];
    return fs.readdirSync(this.logDir)
      .filter(f => f.startsWith('telemetry-') && f.endsWith('.jsonl'))
      .sort()
      .reverse(); // newest first
  }

  _openCurrentLog() {
    const files = this._getLogFiles();
    if (files.length > 0) {
      const latest = path.join(this.logDir, files[0]);
      const stat = fs.statSync(latest);
      if (stat.size < this.maxFileSize) {
        this.currentFile = latest;
        return;
      }
    }
    this._rotateAndCreate();
  }

  _rotateAndCreate() {
    // Remove oldest files if at limit
    const files = this._getLogFiles();
    while (files.length >= this.maxFiles) {
      const oldest = files.pop();
      fs.unlinkSync(path.join(this.logDir, oldest));
    }
    // Create new log file with unique name (counter avoids collisions within same ms)
    let filename;
    let counter = 0;
    do {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const suffix = counter > 0 ? `-${counter}` : '';
      filename = `telemetry-${timestamp}${suffix}.jsonl`;
      counter++;
    } while (fs.existsSync(path.join(this.logDir, filename)));
    this.currentFile = path.join(this.logDir, filename);
    // Touch the file so it exists
    fs.writeFileSync(this.currentFile, '');
  }

  _checkRotation() {
    if (!this.currentFile || !fs.existsSync(this.currentFile)) {
      this._rotateAndCreate();
      return;
    }
    const stat = fs.statSync(this.currentFile);
    if (stat.size >= this.maxFileSize) {
      this._rotateAndCreate();
    }
  }

  emit(event) {
    if (this._closed) return;
    this._checkRotation();
    const entry = {
      timestamp: new Date().toISOString(),
      ...event
    };
    fs.appendFileSync(this.currentFile, JSON.stringify(entry) + '\n');
  }

  // Convenience methods for common events
  agentSpawn(sessionId, taskId, agentId, context = {}) {
    this.emit({
      type: 'agent:spawn',
      sessionId,
      taskId,
      agentId,
      contextTokens: context.tokens || 0,
      tools: context.tools || []
    });
  }

  agentComplete(sessionId, taskId, agentId, result = {}) {
    this.emit({
      type: 'agent:complete',
      sessionId,
      taskId,
      agentId,
      exitCode: result.exitCode || 0,
      durationMs: result.durationMs || 0,
      outputTokens: result.outputTokens || 0
    });
  }

  agentFail(sessionId, taskId, agentId, error = {}) {
    this.emit({
      type: 'agent:fail',
      sessionId,
      taskId,
      agentId,
      error: error.message || 'unknown',
      exitCode: error.exitCode || 1
    });
  }

  waveStart(sessionId, waveIndex, taskCount) {
    this.emit({
      type: 'wave:start',
      sessionId,
      waveIndex,
      taskCount
    });
  }

  waveComplete(sessionId, waveIndex, results = {}) {
    this.emit({
      type: 'wave:complete',
      sessionId,
      waveIndex,
      completed: results.completed || 0,
      failed: results.failed || 0,
      durationMs: results.durationMs || 0
    });
  }

  phaseStart(sessionId, phaseIndex) {
    this.emit({
      type: 'phase:start',
      sessionId,
      phaseIndex
    });
  }

  phaseEnd(sessionId, phaseIndex, status) {
    this.emit({
      type: 'phase:end',
      sessionId,
      phaseIndex,
      status
    });
  }

  commandClassified(command, classification, reason) {
    this.emit({
      type: 'nyquist:classify',
      command,
      classification,
      reason
    });
  }

  // Read logs for replay
  readLog(filePath) {
    if (!fs.existsSync(filePath)) return [];
    return fs.readFileSync(filePath, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  }

  readAllLogs() {
    const files = this._getLogFiles();
    const entries = [];
    for (const file of files.reverse()) { // oldest first for chronological order
      entries.push(...this.readLog(path.join(this.logDir, file)));
    }
    return entries;
  }

  readSessionLogs(sessionId) {
    return this.readAllLogs().filter(e => e.sessionId === sessionId);
  }

  // Cleanup
  close() {
    this._closed = true;
  }
}

module.exports = { Telemetry };
