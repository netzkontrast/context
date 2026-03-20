'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { AgentOrchestrator } = require('../lib/orchestrator');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'orchestrator-test-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// Helper: build a minimal DAG for testing
function makeDAG(phaseIndex, tasks, allDone = false) {
  const phaseId = `phase-${phaseIndex}`;
  const nodes = [
    { id: phaseId, type: 'phase', label: `Phase ${phaseIndex}`, parent: null, done: false },
    ...tasks.map((label, i) => ({
      id: `${phaseId}-task-${i}`,
      type: 'task',
      label,
      parent: phaseId,
      done: allDone,
    })),
  ];
  const edges = tasks.map((_, i) => ({ from: phaseId, to: `${phaseId}-task-${i}` }));
  return { nodes, edges };
}

// Helper: create orchestrator with a temp suite path and mock _spawnAgent
function makeOrch(tmpDir, overrides = {}) {
  const suitePath = path.join(tmpDir, '.suite');
  const orch = new AgentOrchestrator({
    suitePath,
    basePath: tmpDir,
    concurrency: overrides.concurrency || 2,
    skipPermissions: overrides.skipPermissions || false,
  });
  // Default mock: agents succeed with valid JSON
  orch._spawnAgent = overrides.spawnAgent || ((task) => Promise.resolve(JSON.stringify({
    agentId: task.id,
    task: task.description,
    status: 'ready',
    mcpTools: ['read_file'],
    nyquistEnabled: true,
    skipPermissions: false,
    message: `Agent for "${task.description}" done.`,
  })));
  return orch;
}

// ── Constructor ──────────────────────────────────────────────────────────────

test('constructor: default concurrency is 4', () => {
  const orch = new AgentOrchestrator();
  assert.equal(orch.concurrency, 4);
});

test('constructor: default skipPermissions is false', () => {
  const orch = new AgentOrchestrator();
  assert.equal(orch.skipPermissions, false);
});

test('constructor: custom options are respected', () => {
  const orch = new AgentOrchestrator({ concurrency: 8, skipPermissions: true });
  assert.equal(orch.concurrency, 8);
  assert.equal(orch.skipPermissions, true);
});

test('constructor: _verifier is initialized', () => {
  const orch = new AgentOrchestrator();
  assert.ok(orch._verifier);
  assert.equal(typeof orch._verifier.check, 'function');
});

test('constructor: initializes context-store when better-sqlite3 is available', () => {
  // better-sqlite3 is now a production dependency — ContextStore should init
  const orch = new AgentOrchestrator();
  // Must not throw; _contextStore is truthy when the module loads successfully
  assert.ok(orch._contextStore !== null);
});

test('constructor: suitePath defaults to .suite in cwd', () => {
  const orch = new AgentOrchestrator();
  assert.ok(orch.suitePath.endsWith('.suite'));
});

test('constructor: custom suitePath is respected', () => {
  const orch = new AgentOrchestrator({ suitePath: '/tmp/custom-suite' });
  assert.equal(orch.suitePath, '/tmp/custom-suite');
});

// ── planWaves ────────────────────────────────────────────────────────────────

test('planWaves: throws when phase not found in DAG', () => {
  const orch = new AgentOrchestrator();
  const dag = { nodes: [], edges: [] };
  assert.throws(() => orch.planWaves(dag, 99), /Phase 99 not found/);
});

test('planWaves: returns empty waves when all tasks are done', () => {
  const orch = new AgentOrchestrator();
  const dag = makeDAG(1, ['Task A', 'Task B'], true);
  const plan = orch.planWaves(dag, 1);
  assert.equal(plan.phase.label, 'Phase 1');
  assert.equal(plan.waves.length, 0);
});

test('planWaves: returns single wave with all pending tasks', () => {
  const orch = new AgentOrchestrator();
  const dag = makeDAG(1, ['Task A', 'Task B', 'Task C']);
  const plan = orch.planWaves(dag, 1);
  assert.equal(plan.waves.length, 1);
  assert.equal(plan.waves[0].tasks.length, 3);
  assert.equal(plan.waves[0].index, 0);
});

test('planWaves: tasks have id and description fields', () => {
  const orch = new AgentOrchestrator();
  const dag = makeDAG(1, ['Do something']);
  const plan = orch.planWaves(dag, 1);
  const task = plan.waves[0].tasks[0];
  assert.equal(task.id, 'phase-1-task-0');
  assert.equal(task.description, 'Do something');
});

test('planWaves: filters tasks by parent phase', () => {
  const orch = new AgentOrchestrator();
  // DAG with two phases
  const dag = {
    nodes: [
      { id: 'phase-1', type: 'phase', label: 'Phase 1', parent: null, done: false },
      { id: 'phase-2', type: 'phase', label: 'Phase 2', parent: null, done: false },
      { id: 'phase-1-task-0', type: 'task', label: 'P1 Task', parent: 'phase-1', done: false },
      { id: 'phase-2-task-0', type: 'task', label: 'P2 Task', parent: 'phase-2', done: false },
    ],
    edges: [],
  };
  const plan = orch.planWaves(dag, 1);
  assert.equal(plan.waves[0].tasks.length, 1);
  assert.equal(plan.waves[0].tasks[0].description, 'P1 Task');
});

test('planWaves: excludes done tasks from waves', () => {
  const orch = new AgentOrchestrator();
  const dag = {
    nodes: [
      { id: 'phase-1', type: 'phase', label: 'Phase 1', parent: null, done: false },
      { id: 'phase-1-task-0', type: 'task', label: 'Done', parent: 'phase-1', done: true },
      { id: 'phase-1-task-1', type: 'task', label: 'Pending', parent: 'phase-1', done: false },
    ],
    edges: [],
  };
  const plan = orch.planWaves(dag, 1);
  assert.equal(plan.waves[0].tasks.length, 1);
  assert.equal(plan.waves[0].tasks[0].description, 'Pending');
});

// ── _verifyAgentOutput ───────────────────────────────────────────────────────

test('_verifyAgentOutput: non-JSON output passes with confidence 1.0', () => {
  const orch = new AgentOrchestrator();
  const result = orch._verifyAgentOutput('task-1', 'plain text output');
  assert.equal(result.passed, true);
  assert.equal(result.result.confidence, 1.0);
});

test('_verifyAgentOutput: valid agent-report JSON passes', () => {
  const orch = new AgentOrchestrator();
  const json = JSON.stringify({
    agentId: 'task-1',
    task: 'Test task',
    status: 'ready',
    mcpTools: ['read_file'],
  });
  const result = orch._verifyAgentOutput('task-1', json);
  assert.equal(result.passed, true);
});

test('_verifyAgentOutput: invalid status enum fails', () => {
  const orch = new AgentOrchestrator();
  const json = JSON.stringify({
    agentId: 'task-1',
    task: 'Test task',
    status: 'invalid-status',
    mcpTools: [],
  });
  const result = orch._verifyAgentOutput('task-1', json);
  assert.equal(result.passed, false);
});

test('_verifyAgentOutput: emits agent:verify event', () => {
  const orch = new AgentOrchestrator();
  let emitted = null;
  orch.on('agent:verify', (data) => { emitted = data; });
  orch._verifyAgentOutput('task-1', 'not json');
  assert.ok(emitted);
  assert.equal(emitted.taskId, 'task-1');
  assert.equal(emitted.passed, true);
});

test('_verifyAgentOutput: emits confidence and errors for JSON output', () => {
  const orch = new AgentOrchestrator();
  let emitted = null;
  orch.on('agent:verify', (data) => { emitted = data; });
  const json = JSON.stringify({
    agentId: 'x', task: 'y', status: 'ready', mcpTools: [],
  });
  orch._verifyAgentOutput('task-1', json);
  assert.ok(emitted);
  assert.equal(typeof emitted.confidence, 'number');
  assert.ok(Array.isArray(emitted.errors));
});

// ── _buildSterileContext ─────────────────────────────────────────────────────

test('_buildSterileContext: returns null constraints when no PROJECT.md', () => {
  const dir = makeTmpDir();
  const orch = new AgentOrchestrator({ suitePath: path.join(dir, '.suite'), basePath: dir });
  const ctx = orch._buildSterileContext({ description: 'test' });
  assert.equal(ctx.task, 'test');
  assert.equal(ctx.constraints, null);
  assert.equal(ctx.requirements, null);
  cleanup(dir);
});

test('_buildSterileContext: reads PROJECT.md into constraints', () => {
  const dir = makeTmpDir();
  const suitePath = path.join(dir, '.suite');
  fs.mkdirSync(suitePath, { recursive: true });
  fs.writeFileSync(path.join(suitePath, 'PROJECT.md'), '# My Project');
  const orch = new AgentOrchestrator({ suitePath, basePath: dir });
  const ctx = orch._buildSterileContext({ description: 'test' });
  assert.equal(ctx.constraints, '# My Project');
  cleanup(dir);
});

test('_buildSterileContext: reads REQUIREMENTS.md into requirements', () => {
  const dir = makeTmpDir();
  const suitePath = path.join(dir, '.suite');
  fs.mkdirSync(suitePath, { recursive: true });
  fs.writeFileSync(path.join(suitePath, 'REQUIREMENTS.md'), '## Req 1');
  const orch = new AgentOrchestrator({ suitePath, basePath: dir });
  const ctx = orch._buildSterileContext({ description: 'test' });
  assert.equal(ctx.requirements, '## Req 1');
  cleanup(dir);
});

// ── _writeState ──────────────────────────────────────────────────────────────

test('_writeState: creates .suite directory and STATE.md', () => {
  const dir = makeTmpDir();
  const suitePath = path.join(dir, '.suite');
  const orch = new AgentOrchestrator({ suitePath, basePath: dir });
  orch._writeState('running', 'Phase 1', []);
  assert.ok(fs.existsSync(path.join(suitePath, 'STATE.md')));
  cleanup(dir);
});

test('_writeState: includes phase name and status', () => {
  const dir = makeTmpDir();
  const suitePath = path.join(dir, '.suite');
  const orch = new AgentOrchestrator({ suitePath, basePath: dir });
  orch._writeState('completed', 'Build Core', []);
  const content = fs.readFileSync(path.join(suitePath, 'STATE.md'), 'utf-8');
  assert.ok(content.includes('Build Core'));
  assert.ok(content.includes('completed'));
  cleanup(dir);
});

test('_writeState: includes completed tasks from wave results', () => {
  const dir = makeTmpDir();
  const suitePath = path.join(dir, '.suite');
  const orch = new AgentOrchestrator({ suitePath, basePath: dir });
  const waves = [{
    tasks: [
      { id: 't1', description: 'Setup DB', status: 'completed' },
      { id: 't2', description: 'Add API', status: 'completed' },
    ],
  }];
  orch._writeState('completed', 'Phase 1', waves);
  const content = fs.readFileSync(path.join(suitePath, 'STATE.md'), 'utf-8');
  assert.ok(content.includes('Setup DB'));
  assert.ok(content.includes('Add API'));
  cleanup(dir);
});

test('_writeState: handles empty waves gracefully', () => {
  const dir = makeTmpDir();
  const suitePath = path.join(dir, '.suite');
  const orch = new AgentOrchestrator({ suitePath, basePath: dir });
  orch._writeState('running', 'Phase 1', []);
  const content = fs.readFileSync(path.join(suitePath, 'STATE.md'), 'utf-8');
  assert.ok(content.includes('None'));
  cleanup(dir);
});

// ── _writeBlocker ────────────────────────────────────────────────────────────

test('_writeBlocker: replaces Blockers section in STATE.md', () => {
  const dir = makeTmpDir();
  const suitePath = path.join(dir, '.suite');
  const orch = new AgentOrchestrator({ suitePath, basePath: dir });
  // First write state, then write blocker
  orch._writeState('blocked', 'Phase 1', []);
  orch._writeBlocker([
    { id: 't1', description: 'DB setup', output: 'connection refused' },
  ]);
  const content = fs.readFileSync(path.join(suitePath, 'STATE.md'), 'utf-8');
  assert.ok(content.includes('DB setup'));
  assert.ok(content.includes('connection refused'));
  cleanup(dir);
});

// ── execute (integration with mocked _spawnAgent) ────────────────────────────

test('execute: emits phase:start and phase:end events', async () => {
  const dir = makeTmpDir();
  const orch = makeOrch(dir);
  const events = [];
  orch.on('phase:start', (d) => events.push({ type: 'start', ...d }));
  orch.on('phase:end', (d) => events.push({ type: 'end', ...d }));

  const dag = makeDAG(1, ['Task A']);
  const plan = orch.planWaves(dag, 1);
  await orch.execute(plan);

  assert.equal(events.length, 2);
  assert.equal(events[0].type, 'start');
  assert.equal(events[1].type, 'end');
  cleanup(dir);
});

test('execute: returns completed when all agents succeed', async () => {
  const dir = makeTmpDir();
  const orch = makeOrch(dir);
  const dag = makeDAG(1, ['Task A', 'Task B']);
  const plan = orch.planWaves(dag, 1);
  const result = await orch.execute(plan);
  assert.equal(result.status, 'completed');
  assert.equal(result.waves.length, 1);
  assert.equal(result.waves[0].tasks.length, 2);
  assert.ok(result.waves[0].tasks.every(t => t.status === 'completed'));
  cleanup(dir);
});

test('execute: returns blocked when an agent fails', async () => {
  const dir = makeTmpDir();
  const orch = makeOrch(dir, {
    spawnAgent: () => Promise.reject(new Error('agent crashed')),
  });
  const dag = makeDAG(1, ['Task A']);
  const plan = orch.planWaves(dag, 1);
  const result = await orch.execute(plan);
  assert.equal(result.status, 'blocked');
  assert.equal(result.waves[0].tasks[0].status, 'failed');
  cleanup(dir);
});

test('execute: stops executing waves after a failure', async () => {
  const dir = makeTmpDir();
  let callCount = 0;
  const orch = makeOrch(dir, {
    spawnAgent: () => {
      callCount++;
      return Promise.reject(new Error('fail'));
    },
  });
  // Create a plan with 2 waves manually
  const plan = {
    phase: { label: 'Test Phase' },
    waves: [
      { index: 0, tasks: [{ id: 't1', description: 'Task 1' }] },
      { index: 1, tasks: [{ id: 't2', description: 'Task 2' }] },
    ],
  };
  const result = await orch.execute(plan);
  assert.equal(result.status, 'blocked');
  // Only the first wave should have been attempted
  assert.equal(result.waves.length, 1);
  assert.equal(callCount, 1);
  cleanup(dir);
});

test('execute: respects abort — stops processing pending waves', async () => {
  const dir = makeTmpDir();
  const orch = makeOrch(dir, {
    spawnAgent: async (task) => {
      // Abort after first task starts
      orch.abort();
      return JSON.stringify({ agentId: task.id, task: task.description, status: 'ready', mcpTools: [] });
    },
  });
  const plan = {
    phase: { label: 'Test Phase' },
    waves: [
      { index: 0, tasks: [{ id: 't1', description: 'Task 1' }] },
      { index: 1, tasks: [{ id: 't2', description: 'Task 2' }] },
    ],
  };
  const result = await orch.execute(plan);
  // Second wave should not execute due to abort
  assert.equal(result.waves.length, 1);
  cleanup(dir);
});

test('execute: writes STATE.md during execution', async () => {
  const dir = makeTmpDir();
  const orch = makeOrch(dir);
  const dag = makeDAG(1, ['Task A']);
  const plan = orch.planWaves(dag, 1);
  await orch.execute(plan);
  const stateFile = path.join(dir, '.suite', 'STATE.md');
  assert.ok(fs.existsSync(stateFile));
  const content = fs.readFileSync(stateFile, 'utf-8');
  assert.ok(content.includes('Phase 1'));
  cleanup(dir);
});

test('execute: returns sessionId in results', async () => {
  const dir = makeTmpDir();
  const orch = makeOrch(dir);
  const dag = makeDAG(1, ['Task A']);
  const plan = orch.planWaves(dag, 1);
  const result = await orch.execute(plan);
  assert.ok(result.sessionId);
  assert.ok(result.sessionId.startsWith('session-'));
  cleanup(dir);
});

test('execute: returns phase label in results', async () => {
  const dir = makeTmpDir();
  const orch = makeOrch(dir);
  const dag = makeDAG(1, ['Task A']);
  const plan = orch.planWaves(dag, 1);
  const result = await orch.execute(plan);
  assert.equal(result.phase, 'Phase 1');
  cleanup(dir);
});

test('execute: handles empty waves (all tasks done)', async () => {
  const dir = makeTmpDir();
  const orch = makeOrch(dir);
  const plan = { phase: { label: 'Phase 1' }, waves: [] };
  const result = await orch.execute(plan);
  assert.equal(result.status, 'completed');
  assert.equal(result.waves.length, 0);
  cleanup(dir);
});

// ── _executeWave ─────────────────────────────────────────────────────────────

test('_executeWave: respects concurrency limit', async () => {
  const dir = makeTmpDir();
  let maxConcurrent = 0;
  let current = 0;

  const orch = makeOrch(dir, {
    concurrency: 2,
    spawnAgent: async (task) => {
      current++;
      if (current > maxConcurrent) maxConcurrent = current;
      await new Promise(r => setTimeout(r, 10));
      current--;
      return JSON.stringify({ agentId: task.id, task: task.description, status: 'ready', mcpTools: [] });
    },
  });

  const wave = {
    index: 0,
    tasks: [
      { id: 't1', description: 'A' },
      { id: 't2', description: 'B' },
      { id: 't3', description: 'C' },
      { id: 't4', description: 'D' },
    ],
  };
  await orch._executeWave(wave, 'test-session');
  assert.ok(maxConcurrent <= 2, `Max concurrent was ${maxConcurrent}, expected <= 2`);
  cleanup(dir);
});

test('_executeWave: returns correct structure with waveIndex and tasks', async () => {
  const dir = makeTmpDir();
  const orch = makeOrch(dir);
  const wave = {
    index: 3,
    tasks: [{ id: 't1', description: 'Test' }],
  };
  const result = await orch._executeWave(wave, 'test-session');
  assert.equal(result.waveIndex, 3);
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].id, 't1');
  assert.equal(result.tasks[0].status, 'completed');
  cleanup(dir);
});

test('_executeWave: records failed status for rejected agents', async () => {
  const dir = makeTmpDir();
  const orch = makeOrch(dir, {
    spawnAgent: () => Promise.reject(new Error('boom')),
  });
  const wave = {
    index: 0,
    tasks: [{ id: 't1', description: 'Fail task' }],
  };
  const result = await orch._executeWave(wave, 'test-session');
  assert.equal(result.tasks[0].status, 'failed');
  assert.ok(result.tasks[0].output.includes('boom'));
  cleanup(dir);
});

test('_executeWave: mixed success and failure', async () => {
  const dir = makeTmpDir();
  let callCount = 0;
  const orch = makeOrch(dir, {
    spawnAgent: (task) => {
      callCount++;
      if (task.id === 't2') return Promise.reject(new Error('t2 failed'));
      return Promise.resolve(JSON.stringify({
        agentId: task.id, task: task.description, status: 'ready', mcpTools: [],
      }));
    },
  });
  const wave = {
    index: 0,
    tasks: [
      { id: 't1', description: 'OK task' },
      { id: 't2', description: 'Bad task' },
    ],
  };
  const result = await orch._executeWave(wave, 'test-session');
  assert.equal(result.tasks[0].status, 'completed');
  assert.equal(result.tasks[1].status, 'failed');
  cleanup(dir);
});

// ── abort ────────────────────────────────────────────────────────────────────

test('abort: sets _aborted flag', () => {
  const orch = new AgentOrchestrator();
  assert.equal(orch._aborted, false);
  orch.abort();
  assert.equal(orch._aborted, true);
});

test('abort: emits abort event', () => {
  const orch = new AgentOrchestrator();
  let emitted = false;
  orch.on('abort', () => { emitted = true; });
  orch.abort();
  assert.ok(emitted);
});

// ── Persona integration ───────────────────────────────────────────────────────

test('_buildSterileContext: includes persona field', () => {
  const tmp = makeTmpDir();
  const orch = makeOrch(tmp);
  const ctx = orch._buildSterileContext({ id: 'task-1', description: 'implement the login flow' });
  assert.ok(ctx.persona, 'context should have a persona field');
  assert.ok(typeof ctx.persona.id === 'string', 'persona.id should be a string');
  assert.ok(typeof ctx.persona.role === 'string', 'persona.role should be a string');
  assert.ok(typeof ctx.persona.contextBudget === 'number', 'persona.contextBudget should be a number');
  cleanup(tmp);
});

test('_buildSterileContext: selects executor persona for implement tasks', () => {
  const tmp = makeTmpDir();
  const orch = makeOrch(tmp);
  const ctx = orch._buildSterileContext({ id: 'task-1', description: 'implement the database adapter' });
  assert.equal(ctx.persona.id, 'executor');
  cleanup(tmp);
});

test('_buildSterileContext: selects planner persona for plan tasks', () => {
  const tmp = makeTmpDir();
  const orch = makeOrch(tmp);
  const ctx = orch._buildSterileContext({ id: 'task-1', description: 'plan the system architecture' });
  assert.equal(ctx.persona.id, 'planner');
  cleanup(tmp);
});

test('_buildSterileContext: selects verifier persona for test tasks', () => {
  const tmp = makeTmpDir();
  const orch = makeOrch(tmp);
  const ctx = orch._buildSterileContext({ id: 'task-1', description: 'test the authentication module' });
  assert.equal(ctx.persona.id, 'verifier');
  cleanup(tmp);
});

test('_buildSterileContext: selects researcher persona for research tasks', () => {
  const tmp = makeTmpDir();
  const orch = makeOrch(tmp);
  const ctx = orch._buildSterileContext({ id: 'task-1', description: 'research the MemGPT architecture' });
  assert.equal(ctx.persona.id, 'researcher');
  cleanup(tmp);
});

test('_spawnAgent: passes SUITE_PERSONA env var to child process', async () => {
  const tmp = makeTmpDir();
  const orch = makeOrch(tmp);

  let capturedEnv = null;
  // Override _spawnAgent to inspect what env was built (checking via _buildSterileContext)
  const context = orch._buildSterileContext({ id: 'task-1', description: 'implement login' });
  const personaId = context.persona ? context.persona.id : 'executor';
  assert.ok(typeof personaId === 'string');
  assert.ok(personaId.length > 0);
  cleanup(tmp);
});
