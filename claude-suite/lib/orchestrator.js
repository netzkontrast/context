'use strict';

const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { verifyCommands, CLASSIFICATION } = require('./nyquist');
const { enrichContext } = require('./context-gate');

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
    this.useContextGate = options.contextGate !== false; // enabled by default
    this.stateFile = path.join(this.suitePath, 'STATE.md');
    this._aborted = false;
    this._stateDirCreated = false;

    // Pre-load shared context files once instead of per-agent
    this._constraints = null;
    this._requirements = null;
    const projectPath = path.join(this.suitePath, 'PROJECT.md');
    const reqPath = path.join(this.suitePath, 'REQUIREMENTS.md');
    try { this._constraints = fs.readFileSync(projectPath, 'utf-8'); } catch {}
    try { this._requirements = fs.readFileSync(reqPath, 'utf-8'); } catch {}
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

    this.emit('phase:start', { phase: phase.label });
    this._writeState('running', phase.label, []);

    const results = { phase: phase.label, waves: [] };

    for (const wave of waves) {
      if (this._aborted) break;

      this.emit('wave:start', { waveIndex: wave.index, taskCount: wave.tasks.length });

      const waveResults = await this._executeWave(wave);
      results.waves.push(waveResults);

      const failed = waveResults.tasks.filter(t => t.status === 'failed');
      if (failed.length > 0) {
        this.emit('wave:blocked', { waveIndex: wave.index, failures: failed });
        this._writeBlocker(failed);
        break;
      }

      this.emit('wave:complete', { waveIndex: wave.index });
    }

    const allPassed = results.waves.every(w => w.tasks.every(t => t.status === 'completed'));
    results.status = allPassed ? 'completed' : 'blocked';

    this._writeState(results.status, phase.label, results.waves);
    this.emit('phase:end', { phase: phase.label, status: results.status });

    return results;
  }

  /**
   * Run all tasks in a wave concurrently, respecting concurrency limit.
   */
  async _executeWave(wave) {
    const taskResults = [];
    const pending = [...wave.tasks];

    while (pending.length > 0) {
      const batch = pending.splice(0, this.concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(task => this._spawnAgent(task))
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
          resolve(stdout.trim());
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
   * Build the minimal context payload for an agent.
   * Only includes what the agent needs for its specific task.
   */
  _buildSterileContext(task) {
    const base = {
      task: task.description,
      constraints: this._constraints,
      requirements: this._requirements,
    };

    // Context Gate: enrich with relevant files from the codebase
    if (this.useContextGate) {
      return enrichContext(task.description, this.basePath, base);
    }

    return base;
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
      if (!this._stateDirCreated) {
        fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
        this._stateDirCreated = true;
      }
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
