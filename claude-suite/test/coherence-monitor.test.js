'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { CoherenceMonitor, FAILURE_SIGNALS } = require('../lib/coherence-monitor');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CoherenceMonitor — constructor', () => {
  test('creates with defaults', () => {
    const m = new CoherenceMonitor();
    assert.equal(m.refusalThreshold, 0.3);
    assert.equal(m.verbosityThreshold, 2.5);
    assert.equal(m.maxHistory, 200);
  });

  test('accepts custom options', () => {
    const m = new CoherenceMonitor({ refusalThreshold: 0.5, maxHistory: 50 });
    assert.equal(m.refusalThreshold, 0.5);
    assert.equal(m.maxHistory, 50);
  });
});

describe('CoherenceMonitor — assess on empty session', () => {
  test('returns phi=1.0 and no failure mode for unknown session', () => {
    const m = new CoherenceMonitor();
    const report = m.assess('s-empty');
    assert.equal(report.phi, 1.0);
    assert.equal(report.failureMode, null);
    assert.equal(report.rotRisk, 'none');
    assert.equal(report.warning, null);
  });
});

describe('CoherenceMonitor — record and assess', () => {
  test('throws when sessionId is missing', () => {
    const m = new CoherenceMonitor();
    assert.throws(() => m.record({ response: 'hello' }), /sessionId/);
  });

  test('healthy responses produce high phi', () => {
    const m = new CoherenceMonitor();
    const responses = [
      'Here is the implementation of the context budget calculator.',
      'The FTS5 query returns ranked results ordered by BM25 relevance.',
      'Wave execution spawns agents in parallel based on the DAG.',
      'Telemetry events are written to rotating JSONL files.',
    ];
    responses.forEach((response, i) =>
      m.record({ sessionId: 's1', taskId: `t${i}`, response })
    );
    const { phi, failureMode, rotRisk } = m.assess('s1');
    assert.ok(phi > 0.5, `phi should be high for healthy session, got ${phi}`);
    assert.equal(failureMode, null);
    assert.ok(['low', 'medium'].includes(rotRisk));
  });

  test('refusal responses trigger CONSERVATIVE_COLLAPSE', () => {
    const m = new CoherenceMonitor({ refusalThreshold: 0.1 });
    const refusals = [
      'I cannot provide that information.',
      'I am not able to assist with this task.',
      'As an AI, I am unable to generate that content.',
      'I\'m sorry, but that is outside my scope.',
    ];
    refusals.forEach((response, i) =>
      m.record({ sessionId: 's2', taskId: `t${i}`, response })
    );
    const { failureMode, phi } = m.assess('s2');
    assert.equal(failureMode, 'CONSERVATIVE_COLLAPSE');
    assert.ok(phi < 0.8, `phi should be reduced by refusals, got ${phi}`);
  });

  test('verbose inflation is detected', () => {
    const m = new CoherenceMonitor({ verbosityThreshold: 1.5 });
    const baseline = 'Short answer.';
    m.record({ sessionId: 's3', taskId: 't0', response: baseline });
    // Subsequent responses are 3x longer
    const verbose = 'x'.repeat(baseline.length * 4);
    for (let i = 1; i <= 4; i++) {
      m.record({ sessionId: 's3', taskId: `t${i}`, response: verbose });
    }
    const { failureMode } = m.assess('s3');
    assert.equal(failureMode, 'VERBOSITY_INFLATION');
  });

  test('premature commitment is detected', () => {
    const m = new CoherenceMonitor({ refusalThreshold: 0.99 });
    const responses = [
      "Let me assume the API endpoint is /api/v1/execute.",
      "I'll assume the database is PostgreSQL.",
      "Assuming that the user has admin privileges.",
    ];
    responses.forEach((r, i) => m.record({ sessionId: 's4', taskId: `t${i}`, response: r }));
    const { failureMode } = m.assess('s4');
    assert.equal(failureMode, 'PREMATURE_COMMITMENT');
  });

  test('phi is in [0, 1]', () => {
    const m = new CoherenceMonitor();
    for (let i = 0; i < 10; i++) {
      m.record({ sessionId: 'sx', taskId: `t${i}`, response: i % 2 === 0 ? 'I cannot.' : 'Here is the result.' });
    }
    const { phi } = m.assess('sx');
    assert.ok(phi >= 0 && phi <= 1, `phi should be in [0,1], got ${phi}`);
  });
});

describe('CoherenceMonitor — distill', () => {
  test('produces markdown summary', () => {
    const m = new CoherenceMonitor();
    m.record({ sessionId: 's5', taskId: 't1', response: 'Implementation complete.' });
    const summary = m.distill('s5');
    assert.ok(summary.includes('s5'), 'summary should contain session ID');
    assert.ok(summary.includes('Φ'), 'summary should contain phi');
    assert.ok(summary.includes('Rot risk'), 'summary should contain rot risk');
  });

  test('distill on empty session returns valid markdown', () => {
    const m = new CoherenceMonitor();
    const summary = m.distill('empty');
    assert.ok(typeof summary === 'string');
    assert.ok(summary.length > 0);
  });
});

describe('CoherenceMonitor — clearSession', () => {
  test('clears session history', () => {
    const m = new CoherenceMonitor();
    m.record({ sessionId: 's6', taskId: 't1', response: 'hello' });
    m.clearSession('s6');
    const { phi } = m.assess('s6');
    assert.equal(phi, 1.0); // empty session
  });
});

describe('CoherenceMonitor — maxHistory eviction', () => {
  test('does not exceed maxHistory records', () => {
    const m = new CoherenceMonitor({ maxHistory: 5 });
    for (let i = 0; i < 10; i++) {
      m.record({ sessionId: 'se', taskId: `t${i}`, response: `response ${i}` });
    }
    const history = m._sessions.get('se');
    assert.equal(history.length, 5);
  });
});

describe('FAILURE_SIGNALS — patterns', () => {
  test('CONSERVATIVE_COLLAPSE patterns match refusals', () => {
    const patterns = FAILURE_SIGNALS.CONSERVATIVE_COLLAPSE;
    const refusals = [
      'I cannot provide that.',
      'I am not able to help.',
      "I'm sorry, but that is not something I can do.",
      'As an AI, I must decline.',
      "I don't have access to that data.",
    ];
    for (const r of refusals) {
      const matched = patterns.some(p => p.test(r));
      assert.ok(matched, `"${r}" should match CONSERVATIVE_COLLAPSE`);
    }
  });

  test('PREMATURE_COMMITMENT patterns match assumptions', () => {
    const patterns = FAILURE_SIGNALS.PREMATURE_COMMITMENT;
    const commitments = [
      "Let me assume the user is authenticated.",
      "I'll assume PostgreSQL is the database.",
      "Assuming that the file exists...",
    ];
    for (const c of commitments) {
      const matched = patterns.some(p => p.test(c));
      assert.ok(matched, `"${c}" should match PREMATURE_COMMITMENT`);
    }
  });
});
