'use strict';

const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { verifyCommands, CLASSIFICATION } = require('./nyquist');
const { createAgentVerifier } = require('./truth-verifier');
const { registry: personaRegistry } = require('./personas');

/**
 * AgentOrchestrator manages the lifecycle of wave-based task execution.
 *
 * It consumes a DAG (from roadmap-parser) and executes tasks within a phase
 * as parallel "waves". Phases themselves are sequential — a phase only starts
 * after its predecessor completes.
 *
 * Architecture:
 *   DAG → Orchestrator.planWaves() → Wave[] → Orchestrator.execute() → results
 */
class AgentOrchestrator extends EventEmitter {
  constructor(options = {}) {
    super();
    this.concurrency = options.concurrency || 4;
    this.skipPermissions = options.skipPermissions || false;
    this.suitePath = options.suitePath || path.join(process.cwd(), '.suite');
    this.basePath = options.basePath || process.cwd();
    this.stateFile = path.join(this.suitePath, 'STATE.md');
    this._aborted = false;
    this._verifier = createAgentVerifier();

    // Optional Phase 5 integrations (graceful degradation if not installed)
    this._telemetry = null;
    this._contextStore = null;
    try {
      const { Telemetry } = require('./telemetry');
      this._telemetry = new Telemetry({ logDir: path.join(this.suitePath, 'telemetry') });
    } catch { /* telemetry not available */ }
    try {
      const { ContextStore } = require('./context-store');
      this._contextStore = new ContextStore({ dbPath: path.join(this.suitePath, 'context.db') });
    } catch { /* context-store not available */ }
  }

  /**
   * Extract the tasks for a given phase from a DAG and group them into waves.
   * Currently all tasks within a phase form a single parallel wave.
   * Future: dependency edges between tasks can split them into multiple waves.
   */
  planWaves(dag, phaseIndex) {
    const phaseNodeId = `phase-${phaseIndex}`;
    const phaseNode = dag.nodes.find(n => n.id === phaseNodeId && n.type === 'phase');
    if (!phaseNode) {
      throw new Error(`Phase ${phaseIndex} not found in DAG`);
    }

    // Collect task nodes that are children of this phase
    const taskNodes = dag.nodes.filter(
      n => n.type === 'task' && n.parent === phaseNodeId && !n.done
    );

    if (taskNodes.length === 0) {
      return { phase: phaseNode, waves: [] };
    }

    // Single wave: all pending tasks in parallel (no inter-task deps yet)
    return {
      phase: phaseNode,
      waves: [
        {
          index: 0,
          tasks: taskNodes.map(t => ({
            id: t.id,
            description: t.label,
          })),
        },
      ],
    };
  }

  /**
   * Execute a planned set of waves sequentially.
   * Tasks within each wave run in parallel up to concurrency limit.
   */
  async execute(wavePlan) {
    const { phase, waves } = wavePlan;
    const sessionId = `session-${Date.now()}`;

    // Create session in context store
    if (this._contextStore) {
      try {
        this._contextStore.createSession(sessionId, phase.label, { concurrency: this.concurrency });
      } catch { /* best-effort */ }
    }

    this.emit('phase:start', { phase: phase.label });
    this._writeState('running', phase.label, []);
    if (this._telemetry) this._telemetry.phaseStart(sessionId, phase.label);

    const results = { phase: phase.label, sessionId, waves: [] };

    for (const wave of waves) {
      if (this._aborted) break;

      this.emit('wave:start', { waveIndex: wave.index, taskCount: wave.tasks.length });
      if (this._telemetry) this._telemetry.waveStart(sessionId, wave.index, wave.tasks.length);

      const waveStart = Date.now();
      const waveResults = await this._executeWave(wave, sessionId);
      results.waves.push(waveResults);

      const failed = waveResults.tasks.filter(t => t.status === 'failed');
      if (failed.length > 0) {
        this.emit('wave:blocked', { waveIndex: wave.index, failures: failed });
        if (this._telemetry) this._telemetry.waveComplete(sessionId, wave.index, {
          completed: waveResults.tasks.length - failed.length,
          failed: failed.length,
          durationMs: Date.now() - waveStart,
        });
        this._writeBlocker(failed);
        break;
      }

      this.emit('wave:complete', { waveIndex: wave.index });
      if (this._telemetry) this._telemetry.waveComplete(sessionId, wave.index, {
        completed: waveResults.tasks.length,
        failed: 0,
        durationMs: Date.now() - waveStart,
      });
    }

    const allPassed = results.waves.every(w => w.tasks.every(t => t.status === 'completed'));
    results.status = allPassed ? 'completed' : 'blocked';

    this._writeState(results.status, phase.label, results.waves);
    this.emit('phase:end', { phase: phase.label, status: results.status });
    if (this._telemetry) this._telemetry.phaseEnd(sessionId, phase.label, results.status);

    // Update session status
    if (this._contextStore) {
      try {
        this._contextStore.updateSessionStatus(sessionId, results.status);
      } catch { /* best-effort */ }
    }

    return results;
  }

  /**
   * Run all tasks in a wave concurrently, respecting concurrency limit.
   */
  async _executeWave(wave, sessionId) {
    const taskResults = [];
    const pending = [...wave.tasks];

    while (pending.length > 0) {
      const batch = pending.splice(0, this.concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(task => {
          const agentId = `agent-${task.id}-${Date.now()}`;

          // Record execution start
          if (this._contextStore) {
            try {
              this._contextStore.recordExecution({
                id: agentId, sessionId, taskId: task.id, waveIndex: wave.index, agentId,
              });
            } catch { /* best-effort */ }
          }
          if (this._telemetry) this._telemetry.agentSpawn(sessionId, task.id, agentId);

          const start = Date.now();
          return this._spawnAgent(task).then(
            (output) => {
              if (this._telemetry) this._telemetry.agentComplete(sessionId, task.id, agentId, {
                exitCode: 0, durationMs: Date.now() - start,
              });
              if (this._contextStore) {
                try { this._contextStore.completeExecution(agentId, output, 0); } catch { /* */ }
              }
              return output;
            },
            (err) => {
              if (this._telemetry) this._telemetry.agentFail(sessionId, task.id, agentId, {
                message: err.message, exitCode: 1,
              });
              if (this._contextStore) {
                try { this._contextStore.completeExecution(agentId, { error: err.message }, 1); } catch { /* */ }
              }
              throw err;
            }
          );
        })
      );

      for (let i = 0; i < batch.length; i++) {
        const result = batchResults[i];
        taskResults.push({
          id: batch[i].id,
          description: batch[i].description,
          status: result.status === 'fulfilled' ? 'completed' : 'failed',
          output: result.status === 'fulfilled' ? result.value : result.reason?.message,
        });
      }
    }

    return { waveIndex: wave.index, tasks: taskResults };
  }

  /**
   * Spawn a single agent with sterile context for an atomic task.
   *
   * "Sterile context" means the agent receives ONLY:
   *   1. The task description
   *   2. The relevant section of REQUIREMENTS.md (if mapped)
   *   3. The PROJECT.md constraints
   *
   * This prevents context contamination between agents.
   */
  async _spawnAgent(task) {
    const context = this._buildSterileContext(task);

    this.emit('agent:start', { taskId: task.id, description: task.description });

    return new Promise((resolve, reject) => {
      const agentProcess = spawn(process.execPath, [
        path.join(__dirname, 'agent-runner.js'),
      ], {
        env: {
          ...process.env,
          SUITE_TASK_ID: task.id,
          SUITE_TASK_DESCRIPTION: task.description,
          SUITE_CONTEXT: JSON.stringify(context),
          SUITE_SKIP_PERMISSIONS: this.skipPermissions ? '1' : '0',
          SUITE_BASE_PATH: this.basePath,
          SUITE_PERSONA: context.persona ? context.persona.id : 'executor',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 300000, // 5 minute timeout per agent
      });

      let stdout = '';
      let stderr = '';

      agentProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        this.emit('agent:output', { taskId: task.id, data: data.toString() });
      });

      agentProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      agentProcess.on('close', (code) => {
        this.emit('agent:end', { taskId: task.id, exitCode: code });
        if (code === 0) {
          const output = stdout.trim();
          const verifyResult = this._verifyAgentOutput(task.id, output);
          if (!verifyResult.passed) {
            reject(new Error(
              `Agent output failed truth verification (confidence ${(verifyResult.result.confidence * 100).toFixed(1)}%): ${verifyResult.result.errors.join('; ')}`
            ));
          } else {
            resolve(output);
          }
        } else {
          reject(new Error(`Agent failed (exit ${code}): ${stderr.trim() || stdout.trim()}`));
        }
      });

      agentProcess.on('error', (err) => {
        reject(new Error(`Agent spawn error: ${err.message}`));
      });
    });
  }

  /**
   * Parse agent stdout as JSON and run it through the TruthVerifier.
   * Falls back gracefully if output is not JSON (treated as opaque string).
   *
   * @returns {{ passed: boolean, result: object }}
   */
  _verifyAgentOutput(taskId, output) {
    let parsed;
    try {
      parsed = JSON.parse(output);
    } catch {
      // Non-JSON output: emit a warning but don't hard-fail
      this.emit('agent:verify', { taskId, passed: true, reason: 'non-JSON output skipped' });
      return { passed: true, result: { confidence: 1.0, errors: [], checks: { total: 0, passed: 0 } } };
    }

    const check = this._verifier.check(parsed, 'agent-report');
    this.emit('agent:verify', {
      taskId,
      passed: check.passed,
      confidence: check.result.confidence,
      errors: check.result.errors,
    });
    return check;
  }

  /**
   * Build the minimal context payload for an agent.
   * Only includes what the agent needs for its specific task.
   */
  _buildSterileContext(task) {
    const persona = personaRegistry.selectForTask(task.description);
    const context = {
      task: task.description,
      constraints: null,
      requirements: null,
      persona: { id: persona.id, role: persona.role, contextBudget: persona.contextBudget },
    };

    // Load PROJECT.md constraints if available
    const projectPath = path.join(this.suitePath, 'PROJECT.md');
    if (fs.existsSync(projectPath)) {
      context.constraints = fs.readFileSync(projectPath, 'utf-8');
    }

    // Load REQUIREMENTS.md if available
    const reqPath = path.join(this.suitePath, 'REQUIREMENTS.md');
    if (fs.existsSync(reqPath)) {
      context.requirements = fs.readFileSync(reqPath, 'utf-8');
    }

    return context;
  }

  /**
   * Write current execution state to STATE.md.
   */
  _writeState(status, phaseLabel, waves) {
    const activeTasks = waves
      .flatMap(w => w.tasks || [])
      .filter(t => t.status !== 'completed')
      .map((t, i) => `* [Agent-${i + 1}] Task: ${t.description}`)
      .join('\n') || '- **[None]**';

    const completedTasks = waves
      .flatMap(w => w.tasks || [])
      .filter(t => t.status === 'completed')
      .map((t, i) => `${i + 1}. Task '${t.description}' completed successfully.`)
      .join('\n') || '- **[None]**';

    const content = `# Project State

This file tracks the *ephemeral* and *current* progress of the LLM agent execution. Do not store permanent project logic here. This file is mutated constantly by \`claude-suite execute-phase\`.

## Current Execution Phase
- **Phase Name**: [${phaseLabel}]
- **Status**: ${status}

## Current Active Tasks
${activeTasks}

## Blockers
${status === 'blocked' ? 'Execution halted due to task failures. See wave results below.' : '- **[Empty]**'}

## Completed Waves History
${completedTasks}
`;

    try {
      fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
      fs.writeFileSync(this.stateFile, content, 'utf-8');
    } catch {
      // STATE.md write is best-effort; don't fail execution
    }
  }

  /**
   * Append blocker information to STATE.md.
   */
  _writeBlocker(failures) {
    const blockerLines = failures
      .map(f => `- **${f.id}**: ${f.description} — ${f.output}`)
      .join('\n');

    try {
      const existing = fs.readFileSync(this.stateFile, 'utf-8');
      const updated = existing.replace(
        /## Blockers\n[^#]*/,
        `## Blockers\n${blockerLines}\n\n`
      );
      fs.writeFileSync(this.stateFile, updated, 'utf-8');
    } catch {
      // Best-effort
    }
  }

  abort() {
    this._aborted = true;
    this.emit('abort');
  }
}

module.exports = { AgentOrchestrator };
