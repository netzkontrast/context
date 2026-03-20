'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

const { LDAR } = require('../lib/ldar');
const { ContextStore } = require('../lib/context-store');

// ── Helpers ───────────────────────────────────────────────────────────────────

function tempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ldar-test-'));
  return path.join(dir, 'ctx.db');
}

function makeStore(dbPath) {
  return new ContextStore({ dbPath });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LDAR — constructor', () => {
  test('creates with defaults', () => {
    const ldar = new LDAR();
    assert.equal(ldar.maxCandidates, 50);
    assert.equal(ldar.minChunks, 2);
    assert.equal(ldar.maxChunks, 8);
    assert.equal(ldar.distractorPenalty, 0.3);
  });

  test('accepts custom options', () => {
    const ldar = new LDAR({ maxChunks: 4, minChunks: 1, maxCandidates: 20 });
    assert.equal(ldar.maxChunks, 4);
    assert.equal(ldar.minChunks, 1);
    assert.equal(ldar.maxCandidates, 20);
  });
});

describe('LDAR — retrieve without store', () => {
  test('throws when store is not provided', () => {
    const ldar = new LDAR();
    assert.throws(() => ldar.retrieve('query'), /ContextStore/);
  });
});

describe('LDAR — retrieve with empty store', () => {
  let store;
  let dbPath;

  beforeEach(() => {
    dbPath = tempDb();
    store = makeStore(dbPath);
  });

  afterEach(() => {
    store.close();
  });

  test('returns empty result for no matches', () => {
    const ldar = new LDAR({ store });
    const { passages, stats } = ldar.retrieve('nonexistent query xyz');
    assert.equal(passages.length, 0);
    assert.equal(stats.candidates, 0);
    assert.equal(stats.method, 'empty');
  });
});

describe('LDAR — retrieve with populated store', () => {
  let store;
  let dbPath;

  beforeEach(() => {
    dbPath = tempDb();
    store = makeStore(dbPath);
    store.createSession('s1', 1);
    // Seed relevant passages
    store.saveSnapshot('s1', 'plan', 'Implement context budget calculator for token estimation');
    store.saveSnapshot('s1', 'arch', 'Token budget allocation: 50% active code context, 15% generation buffer');
    store.saveSnapshot('s1', 'reqs', 'Requirements: FTS5 search, JSONL telemetry, context store persistence');
    store.saveSnapshot('s1', 'decisions', 'Decision: use better-sqlite3 for synchronous API and zero-config');
    store.saveSnapshot('s1', 'notes', 'Furthermore, as noted above, this was previously stated in the requirements');
    // Low-relevance noise
    store.saveSnapshot('s1', 'noise1', 'Random unrelated content about cooking recipes and food preparation');
    store.saveSnapshot('s1', 'noise2', 'Weather forecast data for tomorrow morning sunshine expected');
  });

  afterEach(() => {
    store.close();
  });

  test('returns passages for a matching query', () => {
    const ldar = new LDAR({ store });
    const { passages, stats } = ldar.retrieve('context budget token');
    assert.ok(passages.length > 0, 'should return at least one passage');
    assert.ok(passages.length <= ldar.maxChunks, `should not exceed maxChunks (${ldar.maxChunks})`);
    assert.ok(stats.candidates > 0);
    assert.ok(['narrow-cluster', 'wide-penalised', 'floor-applied'].includes(stats.method));
  });

  test('respects maxChunks hard cap', () => {
    const ldar = new LDAR({ store, maxChunks: 2 });
    const { passages } = ldar.retrieve('context');
    assert.ok(passages.length <= 2);
  });

  test('passages have similarity scores', () => {
    const ldar = new LDAR({ store });
    const { passages } = ldar.retrieve('token budget');
    for (const p of passages) {
      assert.ok(typeof p.similarity === 'number', 'passage should have similarity');
      assert.ok(p.similarity >= 0 && p.similarity <= 1, 'similarity should be in [0,1]');
    }
  });

  test('stats include token estimate', () => {
    const ldar = new LDAR({ store });
    const { stats } = ldar.retrieve('token');
    assert.ok(typeof stats.tokenEstimate === 'number');
    assert.ok(stats.tokenEstimate >= 0);
  });

  test('session-scoped retrieve only returns session results', () => {
    store.createSession('s2', 2);
    store.saveSnapshot('s2', 'plan', 'Completely different session about database migrations');
    const ldar = new LDAR({ store });
    const { passages } = ldar.retrieve('context budget', 's1');
    for (const p of passages) {
      assert.equal(p.session_id, 's1', 'should only return s1 passages');
    }
  });

  test('distractor patterns reduce score for noisy passages', () => {
    const ldar = new LDAR({ store });
    // The 'notes' snapshot contains distractor phrases
    const distractorScore = ldar._distractorScore('furthermore, as mentioned above, previously stated');
    assert.ok(distractorScore > 0, 'distractor content should have positive score');
  });
});

describe('LDAR — assessCUE', () => {
  test('returns cue and no warning for small context', () => {
    const ldar = new LDAR();
    const passages = [{ content: 'short text' }, { content: 'another short passage' }];
    const { cue, warning } = ldar.assessCUE(passages, 200000);
    assert.ok(cue >= 0 && cue <= 1);
    assert.equal(warning, null);
  });

  test('warns when chunk count exceeds 12', () => {
    const ldar = new LDAR();
    const passages = Array.from({ length: 13 }, (_, i) => ({ content: `passage ${i}` }));
    const { warning } = ldar.assessCUE(passages, 200000);
    assert.ok(warning !== null, 'should warn about context rot risk');
    assert.ok(warning.includes('12'), 'warning should reference 12-chunk threshold');
  });

  test('warns when token budget exceeds 50%', () => {
    const ldar = new LDAR();
    const bigContent = 'x'.repeat(100000);
    const passages = [{ content: bigContent }];
    const { warning } = ldar.assessCUE(passages, 10000); // big content, small budget
    assert.ok(warning !== null);
  });

  test('reports zero budget with empty passages', () => {
    const ldar = new LDAR();
    const { cue, usedTokens } = ldar.assessCUE([], 200000);
    assert.equal(usedTokens, 0);
    assert.equal(cue, 0);
  });
});

describe('LDAR — _distractorScore', () => {
  test('returns 0 for clean content', () => {
    const ldar = new LDAR();
    assert.equal(ldar._distractorScore('Implement FTS5 context store'), 0);
  });

  test('returns positive score for distractor content', () => {
    const ldar = new LDAR();
    const score = ldar._distractorScore('furthermore in addition as mentioned');
    assert.ok(score > 0);
  });

  test('handles empty string', () => {
    const ldar = new LDAR();
    assert.equal(ldar._distractorScore(''), 0);
  });

  test('handles null/undefined gracefully', () => {
    const ldar = new LDAR();
    assert.equal(ldar._distractorScore(null), 0);
    assert.equal(ldar._distractorScore(undefined), 0);
  });
});
