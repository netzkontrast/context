'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

const { SQ3RPipeline } = require('../lib/sq3r');
const { ContextStore } = require('../lib/context-store');
const { LDAR } = require('../lib/ldar');

// ── Helpers ───────────────────────────────────────────────────────────────────

function tempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sq3r-test-'));
  return new ContextStore({ dbPath: path.join(dir, 'ctx.db') });
}

const SAMPLE_DOC = `
# FTS5 Documentation

## Overview
FTS5 is a full-text search extension for SQLite.

## Installation
FTS5 requires better-sqlite3 with native compilation.

## Usage
Create a virtual table using: CREATE VIRTUAL TABLE t USING fts5(col).

### BM25 Ranking
FTS5 uses BM25 for relevance ranking. The rank column contains negative scores.

## Limitations
Large tables may experience performance degradation.
`;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SQ3RPipeline — constructor', () => {
  test('requires store', () => {
    const pipeline = new SQ3RPipeline();
    const store = tempStore();
    store.createSession('s-err', 0);
    assert.throws(
      () => pipeline.run({ sessionId: 's-err', task: 'test task' }),
      /ContextStore/
    );
    store.close();
  });

  test('accepts custom tokenBudget', () => {
    const pipeline = new SQ3RPipeline({ tokenBudget: 50000 });
    assert.equal(pipeline.tokenBudget, 50000);
  });

  test('auto-builds LDAR from store', () => {
    const store = tempStore();
    const pipeline = new SQ3RPipeline({ store });
    assert.ok(pipeline._ldar instanceof LDAR);
    store.close();
  });
});

describe('SQ3RPipeline — validation', () => {
  let store;
  afterEach(() => store.close());
  beforeEach(() => { store = tempStore(); });

  test('throws when sessionId missing', () => {
    const pipeline = new SQ3RPipeline({ store });
    assert.throws(() => pipeline.run({ task: 'test' }), /sessionId/);
  });

  test('throws when task missing', () => {
    const pipeline = new SQ3RPipeline({ store });
    assert.throws(() => pipeline.run({ sessionId: 's1' }), /task/);
  });
});

describe('SQ3RPipeline — run with documents', () => {
  let store;
  afterEach(() => store.close());
  beforeEach(() => {
    store = tempStore();
    store.createSession('s1', 1);
  });

  test('runs all 5 phases and returns result object', () => {
    const pipeline = new SQ3RPipeline({ store });
    const result = pipeline.run({
      sessionId: 's1',
      task: 'Understand FTS5 full text search ranking algorithm',
      documents: [{ key: 'fts5-docs', content: SAMPLE_DOC }],
    });

    assert.ok(typeof result.summary === 'string', 'should have summary');
    assert.ok(Array.isArray(result.queries), 'should have queries array');
    assert.ok(Array.isArray(result.passages), 'should have passages array');
    assert.ok(typeof result.tokensBudgetUsed === 'number', 'should track token budget');
    assert.ok(Array.isArray(result.phaseLog), 'should have phase log');
  });

  test('phase log contains all 5 SQ3R phases', () => {
    const pipeline = new SQ3RPipeline({ store });
    const result = pipeline.run({
      sessionId: 's1',
      task: 'FTS5 BM25 search ranking',
      documents: [{ key: 'fts5', content: SAMPLE_DOC }],
    });

    const phases = result.phaseLog.map(p => p.phase);
    assert.ok(phases.includes('SURVEY'), 'should have SURVEY phase');
    assert.ok(phases.includes('QUESTION'), 'should have QUESTION phase');
    assert.ok(phases.includes('READ'), 'should have READ phase');
    assert.ok(phases.includes('RECITE'), 'should have RECITE phase');
    assert.ok(phases.includes('REVIEW'), 'should have REVIEW phase');
  });

  test('SURVEY saves structural snapshot to store', () => {
    const pipeline = new SQ3RPipeline({ store });
    pipeline.run({
      sessionId: 's1',
      task: 'FTS5 search',
      documents: [{ key: 'fts5', content: SAMPLE_DOC }],
    });
    const snap = store.getSnapshot('s1', 'survey:fts5');
    assert.ok(snap, 'survey snapshot should be saved');
    // Structure should contain headings, not full raw content
    assert.ok(snap.content.includes('FTS5'), 'structure should contain headings');
  });

  test('RECITE saves synthesis snapshot to store', () => {
    const pipeline = new SQ3RPipeline({ store });
    pipeline.run({
      sessionId: 's1',
      task: 'FTS5 search ranking',
      documents: [{ key: 'fts5', content: SAMPLE_DOC }],
    });
    // Find any recite snapshot
    const results = store.search('Research Summary', 10);
    assert.ok(results.length > 0, 'recite snapshot should be findable via FTS5');
  });

  test('REVIEW logs sq3r:complete event', () => {
    const pipeline = new SQ3RPipeline({ store });
    pipeline.run({
      sessionId: 's1',
      task: 'FTS5 search',
      documents: [{ key: 'fts5', content: SAMPLE_DOC }],
    });
    const auditLog = store.getAuditLog('s1');
    const sq3rEvent = auditLog.find(e => e.event_type === 'sq3r:complete');
    assert.ok(sq3rEvent, 'sq3r:complete event should be logged');
    assert.ok(sq3rEvent.payload.task, 'event should contain task');
  });

  test('summary is a non-empty string', () => {
    const pipeline = new SQ3RPipeline({ store });
    const { summary } = pipeline.run({
      sessionId: 's1',
      task: 'FTS5 search',
      documents: [{ key: 'fts5', content: SAMPLE_DOC }],
    });
    assert.ok(summary.length > 0);
    assert.ok(summary.includes('Research Summary'));
  });

  test('generates at least 3 queries', () => {
    const pipeline = new SQ3RPipeline({ store });
    const { queries, phaseLog } = pipeline.run({
      sessionId: 's1',
      task: 'Understand FTS5 full text search ranking with BM25 scoring',
      documents: [],
    });
    const questionPhase = phaseLog.find(p => p.phase === 'QUESTION');
    assert.ok(questionPhase.queries.length >= 3, 'should generate at least 3 queries');
  });

  test('accepts externally supplied queries', () => {
    const pipeline = new SQ3RPipeline({ store });
    const customQueries = ['fts5 ranking', 'BM25 score', 'virtual table'];
    const result = pipeline.run({
      sessionId: 's1',
      task: 'FTS5 search',
      documents: [],
      queries: customQueries,
    });
    const questionPhase = result.phaseLog.find(p => p.phase === 'QUESTION');
    assert.deepEqual(questionPhase.queries, customQueries);
  });

  test('respects maxReadIterations', () => {
    const pipeline = new SQ3RPipeline({ store, maxReadIterations: 1 });
    const result = pipeline.run({
      sessionId: 's1',
      task: 'FTS5 BM25 ranking algorithm performance',
      documents: [{ key: 'fts5', content: SAMPLE_DOC }],
    });
    const readPhases = result.phaseLog.filter(p => p.phase === 'READ' && !p.skipped);
    assert.ok(readPhases.length <= 1, 'should not exceed maxReadIterations');
  });

  test('tokensBudgetUsed is non-negative', () => {
    const pipeline = new SQ3RPipeline({ store });
    const { tokensBudgetUsed } = pipeline.run({
      sessionId: 's1',
      task: 'FTS5 search',
      documents: [{ key: 'fts5', content: SAMPLE_DOC }],
    });
    assert.ok(tokensBudgetUsed >= 0);
  });
});

describe('SQ3RPipeline — run without documents', () => {
  let store;
  afterEach(() => store.close());
  beforeEach(() => {
    store = tempStore();
    store.createSession('s2', 1);
  });

  test('completes without documents', () => {
    const pipeline = new SQ3RPipeline({ store });
    const result = pipeline.run({ sessionId: 's2', task: 'Research context budget' });
    assert.ok(typeof result.summary === 'string');
    assert.equal(result.passages.length, 0);
  });

  test('summary says no passages found when store is empty', () => {
    const pipeline = new SQ3RPipeline({ store });
    const { summary } = pipeline.run({ sessionId: 's2', task: 'Lookup nonexistent content' });
    assert.ok(summary.includes('No relevant passages'));
  });
});

describe('SQ3RPipeline — _extractStructure', () => {
  test('extracts headings from markdown', () => {
    const pipeline = new SQ3RPipeline();
    const structure = pipeline._extractStructure(SAMPLE_DOC);
    assert.ok(structure.includes('# FTS5 Documentation'));
    assert.ok(structure.includes('## Overview'));
    assert.ok(structure.includes('### BM25 Ranking'));
    // Should NOT include body text
    assert.ok(!structure.includes('full-text search extension'));
  });

  test('returns empty string for empty content', () => {
    const pipeline = new SQ3RPipeline();
    assert.equal(pipeline._extractStructure(''), '');
    assert.equal(pipeline._extractStructure(null), '');
  });
});

describe('SQ3RPipeline — _generateQueries', () => {
  test('generates queries from task', () => {
    const pipeline = new SQ3RPipeline();
    const queries = pipeline._generateQueries('Implement FTS5 context search ranking algorithm');
    assert.ok(queries.length >= 3, `expected >= 3 queries, got ${queries.length}`);
    assert.ok(queries.length <= 5);
  });

  test('deduplicates queries', () => {
    const pipeline = new SQ3RPipeline();
    const queries = pipeline._generateQueries('search search search');
    const unique = new Set(queries);
    assert.equal(unique.size, queries.length, 'queries should be unique');
  });

  test('handles short task', () => {
    const pipeline = new SQ3RPipeline();
    const queries = pipeline._generateQueries('FTS5');
    assert.ok(Array.isArray(queries));
    assert.ok(queries.length >= 1);
  });
});
