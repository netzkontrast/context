'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Telemetry } = require('../lib/telemetry');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'telemetry-test-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// Helper: read all entries from the current log file
function readCurrent(telemetry) {
  return telemetry.readLog(telemetry.currentFile);
}

// ── Basic event emission ─────────────────────────────────────────────────────

test('emit writes a JSONL line to the log file', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  t.emit({ type: 'test:event', value: 42 });
  const entries = readCurrent(t);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].type, 'test:event');
  assert.equal(entries[0].value, 42);
  t.close();
  cleanup(dir);
});

test('emit injects a timestamp on every event', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  t.emit({ type: 'ts:check' });
  const entries = readCurrent(t);
  assert.ok(entries[0].timestamp);
  // ISO 8601 format check
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(entries[0].timestamp));
  t.close();
  cleanup(dir);
});

test('emit writes multiple events as separate lines', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  t.emit({ type: 'a' });
  t.emit({ type: 'b' });
  t.emit({ type: 'c' });
  const entries = readCurrent(t);
  assert.equal(entries.length, 3);
  assert.equal(entries[0].type, 'a');
  assert.equal(entries[1].type, 'b');
  assert.equal(entries[2].type, 'c');
  t.close();
  cleanup(dir);
});

test('emit does nothing after close', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  t.emit({ type: 'before' });
  t.close();
  t.emit({ type: 'after' });
  const entries = t.readLog(t.currentFile);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].type, 'before');
  cleanup(dir);
});

// ── Directory creation ───────────────────────────────────────────────────────

test('constructor auto-creates logDir if it does not exist', () => {
  const base = makeTmpDir();
  const nested = path.join(base, 'deep', 'nested', 'telemetry');
  const t = new Telemetry({ logDir: nested });
  assert.ok(fs.existsSync(nested));
  t.close();
  cleanup(base);
});

test('constructor works when logDir already exists', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  t.emit({ type: 'ok' });
  const entries = readCurrent(t);
  assert.equal(entries.length, 1);
  t.close();
  cleanup(dir);
});

// ── Convenience methods ──────────────────────────────────────────────────────

test('agentSpawn emits agent:spawn event with correct fields', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  t.agentSpawn('sess-1', 'task-1', 'agent-1', { tokens: 500, tools: ['read', 'write'] });
  const entries = readCurrent(t);
  assert.equal(entries[0].type, 'agent:spawn');
  assert.equal(entries[0].sessionId, 'sess-1');
  assert.equal(entries[0].taskId, 'task-1');
  assert.equal(entries[0].agentId, 'agent-1');
  assert.equal(entries[0].contextTokens, 500);
  assert.deepEqual(entries[0].tools, ['read', 'write']);
  t.close();
  cleanup(dir);
});

test('agentSpawn uses defaults for missing context', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  t.agentSpawn('s', 't', 'a');
  const entries = readCurrent(t);
  assert.equal(entries[0].contextTokens, 0);
  assert.deepEqual(entries[0].tools, []);
  t.close();
  cleanup(dir);
});

test('agentComplete emits agent:complete event with correct fields', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  t.agentComplete('sess-1', 'task-1', 'agent-1', { exitCode: 0, durationMs: 1234, outputTokens: 800 });
  const entries = readCurrent(t);
  assert.equal(entries[0].type, 'agent:complete');
  assert.equal(entries[0].exitCode, 0);
  assert.equal(entries[0].durationMs, 1234);
  assert.equal(entries[0].outputTokens, 800);
  t.close();
  cleanup(dir);
});

test('agentComplete uses defaults for missing result', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  t.agentComplete('s', 't', 'a');
  const entries = readCurrent(t);
  assert.equal(entries[0].exitCode, 0);
  assert.equal(entries[0].durationMs, 0);
  assert.equal(entries[0].outputTokens, 0);
  t.close();
  cleanup(dir);
});

test('agentFail emits agent:fail event with correct fields', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  t.agentFail('sess-1', 'task-1', 'agent-1', { message: 'timeout', exitCode: 137 });
  const entries = readCurrent(t);
  assert.equal(entries[0].type, 'agent:fail');
  assert.equal(entries[0].error, 'timeout');
  assert.equal(entries[0].exitCode, 137);
  t.close();
  cleanup(dir);
});

test('agentFail uses defaults for missing error', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  t.agentFail('s', 't', 'a');
  const entries = readCurrent(t);
  assert.equal(entries[0].error, 'unknown');
  assert.equal(entries[0].exitCode, 1);
  t.close();
  cleanup(dir);
});

test('waveStart emits wave:start event', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  t.waveStart('sess-1', 0, 3);
  const entries = readCurrent(t);
  assert.equal(entries[0].type, 'wave:start');
  assert.equal(entries[0].sessionId, 'sess-1');
  assert.equal(entries[0].waveIndex, 0);
  assert.equal(entries[0].taskCount, 3);
  t.close();
  cleanup(dir);
});

test('waveComplete emits wave:complete event', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  t.waveComplete('sess-1', 0, { completed: 2, failed: 1, durationMs: 5000 });
  const entries = readCurrent(t);
  assert.equal(entries[0].type, 'wave:complete');
  assert.equal(entries[0].completed, 2);
  assert.equal(entries[0].failed, 1);
  assert.equal(entries[0].durationMs, 5000);
  t.close();
  cleanup(dir);
});

test('waveComplete uses defaults for missing results', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  t.waveComplete('s', 0);
  const entries = readCurrent(t);
  assert.equal(entries[0].completed, 0);
  assert.equal(entries[0].failed, 0);
  assert.equal(entries[0].durationMs, 0);
  t.close();
  cleanup(dir);
});

test('phaseStart emits phase:start event', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  t.phaseStart('sess-1', 2);
  const entries = readCurrent(t);
  assert.equal(entries[0].type, 'phase:start');
  assert.equal(entries[0].sessionId, 'sess-1');
  assert.equal(entries[0].phaseIndex, 2);
  t.close();
  cleanup(dir);
});

test('phaseEnd emits phase:end event', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  t.phaseEnd('sess-1', 2, 'completed');
  const entries = readCurrent(t);
  assert.equal(entries[0].type, 'phase:end');
  assert.equal(entries[0].phaseIndex, 2);
  assert.equal(entries[0].status, 'completed');
  t.close();
  cleanup(dir);
});

test('commandClassified emits nyquist:classify event', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  t.commandClassified('rm -rf /', 'blocked', 'matches destructive pattern');
  const entries = readCurrent(t);
  assert.equal(entries[0].type, 'nyquist:classify');
  assert.equal(entries[0].command, 'rm -rf /');
  assert.equal(entries[0].classification, 'blocked');
  assert.equal(entries[0].reason, 'matches destructive pattern');
  t.close();
  cleanup(dir);
});

// ── Log rotation ─────────────────────────────────────────────────────────────

test('rotation creates a new file when current exceeds maxFileSize', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir, maxFileSize: 100 }); // tiny limit
  const firstFile = t.currentFile;
  // Write enough to exceed 100 bytes
  t.emit({ type: 'big', data: 'x'.repeat(200) });
  // Next emit should trigger rotation since file > 100 bytes
  t.emit({ type: 'after-rotation' });
  const secondFile = t.currentFile;
  assert.notEqual(firstFile, secondFile);
  t.close();
  cleanup(dir);
});

test('rotation preserves old log files', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir, maxFileSize: 50, maxFiles: 5 });
  // Write enough data to trigger rotation multiple times
  for (let i = 0; i < 5; i++) {
    t.emit({ type: 'fill', i, data: 'x'.repeat(100) });
  }
  t.close();
  const files = t._getLogFiles();
  assert.ok(files.length > 1, `Expected more than 1 log file, got ${files.length}`);
  cleanup(dir);
});

test('max files cleanup deletes oldest when limit reached', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir, maxFileSize: 50, maxFiles: 2 });
  // Create several log files by writing large events that trigger rotation
  for (let i = 0; i < 6; i++) {
    t.emit({ type: 'fill', i, data: 'x'.repeat(100) });
  }
  t.close();
  const remaining = t._getLogFiles();
  assert.ok(remaining.length <= 2, `Expected at most 2 files, got ${remaining.length}`);
  cleanup(dir);
});

// ── Log reading ──────────────────────────────────────────────────────────────

test('readLog parses a JSONL file into array of objects', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  t.emit({ type: 'one' });
  t.emit({ type: 'two' });
  const entries = t.readLog(t.currentFile);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].type, 'one');
  assert.equal(entries[1].type, 'two');
  t.close();
  cleanup(dir);
});

test('readLog returns empty array for non-existent file', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  const entries = t.readLog(path.join(dir, 'does-not-exist.jsonl'));
  assert.deepEqual(entries, []);
  t.close();
  cleanup(dir);
});

test('readAllLogs returns entries from all log files in chronological order', () => {
  const dir = makeTmpDir();
  // Manually create two log files to simulate rotation
  const file1 = path.join(dir, 'telemetry-2025-01-01T00-00-00-000Z.jsonl');
  const file2 = path.join(dir, 'telemetry-2025-01-02T00-00-00-000Z.jsonl');
  fs.writeFileSync(file1, JSON.stringify({ timestamp: '2025-01-01', type: 'first' }) + '\n');
  fs.writeFileSync(file2, JSON.stringify({ timestamp: '2025-01-02', type: 'second' }) + '\n');
  const t = new Telemetry({ logDir: dir });
  const entries = t.readAllLogs();
  assert.ok(entries.length >= 2);
  // Oldest should come first
  const firstIdx = entries.findIndex(e => e.type === 'first');
  const secondIdx = entries.findIndex(e => e.type === 'second');
  assert.ok(firstIdx < secondIdx, 'Entries should be in chronological order');
  t.close();
  cleanup(dir);
});

test('readSessionLogs filters entries by sessionId', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  t.waveStart('sess-A', 0, 1);
  t.waveStart('sess-B', 0, 2);
  t.waveStart('sess-A', 1, 3);
  const sessA = t.readSessionLogs('sess-A');
  assert.equal(sessA.length, 2);
  assert.ok(sessA.every(e => e.sessionId === 'sess-A'));
  t.close();
  cleanup(dir);
});

test('readSessionLogs returns empty array when no matching session', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  t.waveStart('sess-A', 0, 1);
  const result = t.readSessionLogs('nonexistent');
  assert.deepEqual(result, []);
  t.close();
  cleanup(dir);
});

// ── Close / cleanup ──────────────────────────────────────────────────────────

test('close marks instance as closed', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  assert.equal(t._closed, false);
  t.close();
  assert.equal(t._closed, true);
  cleanup(dir);
});

test('close is idempotent (calling twice does not throw)', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  t.close();
  t.close(); // should not throw
  assert.equal(t._closed, true);
  cleanup(dir);
});

// ── _getLogFiles ─────────────────────────────────────────────────────────────

test('_getLogFiles returns only telemetry JSONL files', () => {
  const dir = makeTmpDir();
  fs.writeFileSync(path.join(dir, 'telemetry-2025-01-01T00-00-00-000Z.jsonl'), '');
  fs.writeFileSync(path.join(dir, 'other.txt'), '');
  fs.writeFileSync(path.join(dir, 'telemetry-bad.json'), '');
  const t = new Telemetry({ logDir: dir });
  const files = t._getLogFiles();
  const nonTelemetry = files.filter(f => !f.startsWith('telemetry-') || !f.endsWith('.jsonl'));
  assert.equal(nonTelemetry.length, 0);
  t.close();
  cleanup(dir);
});

test('_getLogFiles returns newest first', () => {
  const dir = makeTmpDir();
  fs.writeFileSync(path.join(dir, 'telemetry-2025-01-01T00-00-00-000Z.jsonl'), '');
  fs.writeFileSync(path.join(dir, 'telemetry-2025-06-15T12-00-00-000Z.jsonl'), '');
  fs.writeFileSync(path.join(dir, 'telemetry-2025-03-10T06-30-00-000Z.jsonl'), '');
  const t = new Telemetry({ logDir: dir });
  const files = t._getLogFiles();
  // Filter to only the manually created ones (exclude the one constructor creates)
  const manual = files.filter(f => f.includes('2025-01') || f.includes('2025-06') || f.includes('2025-03'));
  assert.ok(manual[0].includes('2025-06'));
  assert.ok(manual[manual.length - 1].includes('2025-01'));
  t.close();
  cleanup(dir);
});

// ── Default options ──────────────────────────────────────────────────────────

test('default maxFileSize is 10MB', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  assert.equal(t.maxFileSize, 10 * 1024 * 1024);
  t.close();
  cleanup(dir);
});

test('default maxFiles is 5', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  assert.equal(t.maxFiles, 5);
  t.close();
  cleanup(dir);
});

// ── _checkRotation edge case ─────────────────────────────────────────────────

test('_checkRotation creates new file if currentFile was deleted externally', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  const originalFile = t.currentFile;
  // Simulate external deletion
  fs.unlinkSync(originalFile);
  t.emit({ type: 'after-delete' });
  assert.ok(t.currentFile !== null);
  assert.ok(fs.existsSync(t.currentFile));
  t.close();
  cleanup(dir);
});

// ── Log file naming ──────────────────────────────────────────────────────────

test('log files are named with telemetry- prefix and .jsonl extension', () => {
  const dir = makeTmpDir();
  const t = new Telemetry({ logDir: dir });
  const basename = path.basename(t.currentFile);
  assert.ok(basename.startsWith('telemetry-'));
  assert.ok(basename.endsWith('.jsonl'));
  t.close();
  cleanup(dir);
});

// ── Append mode ──────────────────────────────────────────────────────────────

test('opening existing log appends rather than overwrites', () => {
  const dir = makeTmpDir();
  // First instance writes an event
  const t1 = new Telemetry({ logDir: dir });
  t1.emit({ type: 'first' });
  const file = t1.currentFile;
  t1.close();
  // Second instance should re-open the same file
  const t2 = new Telemetry({ logDir: dir });
  assert.equal(t2.currentFile, file);
  t2.emit({ type: 'second' });
  const entries = t2.readLog(file);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].type, 'first');
  assert.equal(entries[1].type, 'second');
  t2.close();
  cleanup(dir);
});
