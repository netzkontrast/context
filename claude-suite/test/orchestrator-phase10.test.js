'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

const { AgentOrchestrator } = require('../lib/orchestrator');

// ── Helpers ───────────────────────────────────────────────────────────────────

function tempSuite() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'orch-p10-'));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AgentOrchestrator — Phase 10 integrations (constructor)', () => {
  test('initialises _knowledgeGraph', () => {
    const suitePath = tempSuite();
    const orch = new AgentOrchestrator({ suitePath });
    assert.ok(orch._knowledgeGraph !== null, '_knowledgeGraph should be initialised');
  });

  test('initialises _coherenceMonitor', () => {
    const suitePath = tempSuite();
    const orch = new AgentOrchestrator({ suitePath });
    assert.ok(orch._coherenceMonitor !== null, '_coherenceMonitor should be initialised');
  });

  test('both Phase 10 integrations are distinct instances', () => {
    const suitePath = tempSuite();
    const o1 = new AgentOrchestrator({ suitePath: `${suitePath}-a` });
    const o2 = new AgentOrchestrator({ suitePath: `${suitePath}-b` });
    assert.ok(o1._knowledgeGraph !== o2._knowledgeGraph);
    assert.ok(o1._coherenceMonitor !== o2._coherenceMonitor);
  });
});

describe('AgentOrchestrator — Phase 10 KG integration during execute', () => {
  let suitePath;
  let orch;

  beforeEach(() => {
    suitePath = tempSuite();
    orch = new AgentOrchestrator({ suitePath });
  });

  test('execute registers session Decision node in KG', async () => {
    const dag = {
      nodes: [
        { id: 'phase-0', type: 'phase', label: 'Test Phase' },
        { id: 'phase-0-task-0', type: 'task', label: 'Test task alpha', parent: 'phase-0', done: false },
      ],
      edges: [],
    };

    const wavePlan = orch.planWaves(dag, 0);
    await orch.execute(wavePlan);

    // Session node should exist in the knowledge graph
    const nodes = orch._knowledgeGraph.listNodes('Decision');
    assert.ok(nodes.length > 0, 'at least one Decision node should be registered');
    // The session node should have a 'session:' prefix
    const sessionNode = nodes.find(n => n.node_id.startsWith('session:'));
    assert.ok(sessionNode, 'session Decision node should exist');
  });

  test('execute registers task Requirement nodes in KG', async () => {
    const dag = {
      nodes: [
        { id: 'phase-0', type: 'phase', label: 'Test Phase' },
        { id: 'phase-0-task-0', type: 'task', label: 'Test task beta', parent: 'phase-0', done: false },
      ],
      edges: [],
    };

    const wavePlan = orch.planWaves(dag, 0);
    await orch.execute(wavePlan);

    const taskNodes = orch._knowledgeGraph.listNodes('Requirement');
    assert.ok(taskNodes.length > 0, 'task Requirement node should be registered');
  });

  test('execute adds DEPENDS_ON edge from session to task', async () => {
    const dag = {
      nodes: [
        { id: 'phase-0', type: 'phase', label: 'Test Phase' },
        { id: 'phase-0-task-0', type: 'task', label: 'Test task gamma', parent: 'phase-0', done: false },
      ],
      edges: [],
    };

    const wavePlan = orch.planWaves(dag, 0);
    const result = await orch.execute(wavePlan);

    // Find the session node
    const sessionNodes = orch._knowledgeGraph.listNodes('Decision');
    const sessionNode = sessionNodes.find(n => n.node_id.startsWith('session:'));
    assert.ok(sessionNode, 'session node should exist');

    // Should have DEPENDS_ON edge to the task
    const outEdges = orch._knowledgeGraph.getOutEdges(sessionNode.node_id, 'DEPENDS_ON');
    assert.ok(outEdges.length > 0, 'session should have DEPENDS_ON edge to task');
  });
});

describe('AgentOrchestrator — Phase 10 CoherenceMonitor integration', () => {
  test('coherence-halt event emitted when rotRisk is critical', (t, done) => {
    const suitePath = tempSuite();
    const orch = new AgentOrchestrator({ suitePath });

    // Force the coherence monitor to report critical rot by replacing assess()
    orch._coherenceMonitor.assess = () => ({
      phi: 0.1,
      rotRisk: 'critical',
      failureMode: 'CONSERVATIVE_COLLAPSE',
      warning: 'Critical collapse test',
      metrics: {},
    });
    orch._coherenceMonitor.distill = () => '## Test distillation snapshot';
    orch._coherenceMonitor.clearSession = () => {};

    const dag = {
      nodes: [
        { id: 'phase-0', type: 'phase', label: 'Test Phase' },
        { id: 'phase-0-task-0', type: 'task', label: 'Test task halt', parent: 'phase-0', done: false },
      ],
      edges: [],
    };

    let haltEmitted = false;
    orch.on('wave:coherence-halt', ({ phi }) => {
      haltEmitted = true;
      assert.equal(phi, 0.1);
    });

    const wavePlan = orch.planWaves(dag, 0);
    orch.execute(wavePlan).then(() => {
      assert.ok(haltEmitted, 'wave:coherence-halt should be emitted on critical rot');
      done();
    }).catch(done);
  });

  test('coherence distillation snapshot saved to context store on halt', async () => {
    const suitePath = tempSuite();
    const orch = new AgentOrchestrator({ suitePath });

    orch._coherenceMonitor.assess = () => ({
      phi: 0.05,
      rotRisk: 'critical',
      failureMode: 'VERBOSITY_INFLATION',
      warning: 'Critical verbosity collapse',
      metrics: {},
    });
    orch._coherenceMonitor.distill = () => '## Distilled coherence snapshot for test';
    orch._coherenceMonitor.clearSession = () => {};

    const dag = {
      nodes: [
        { id: 'phase-0', type: 'phase', label: 'Phase' },
        { id: 'phase-0-task-0', type: 'task', label: 'Task', parent: 'phase-0', done: false },
      ],
      edges: [],
    };

    const wavePlan = orch.planWaves(dag, 0);
    const result = await orch.execute(wavePlan);

    // Look for coherence distillation snapshot in context store
    const dbPath = path.join(suitePath, 'context.db');
    assert.ok(fs.existsSync(dbPath), 'context.db should exist');

    const { ContextStore } = require('../lib/context-store');
    const store = new ContextStore({ dbPath });
    const sessions = store.listSessions();
    assert.ok(sessions.length > 0);

    const sessionId = sessions[0].id;
    const coherenceSnap = store.getSnapshot(sessionId, 'coherence:distill');
    assert.ok(coherenceSnap, 'coherence distillation snapshot should be saved');
    assert.ok(coherenceSnap.content.includes('Distilled'));
    store.close();
  });
});
