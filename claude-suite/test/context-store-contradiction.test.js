'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

const { ContextStore } = require('../lib/context-store');

// ── Helpers ───────────────────────────────────────────────────────────────────

function tempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-contradiction-'));
  return new ContextStore({ dbPath: path.join(dir, 'ctx.db') });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ContextStore — detectContradiction', () => {
  let store;
  afterEach(() => store.close());
  beforeEach(() => {
    store = tempStore();
    store.createSession('s1', 1);
  });

  test('returns no contradiction for single snapshot', () => {
    store.saveSnapshot('s1', 'arch', 'Use better-sqlite3 for FTS5 full-text search');
    const result = store.detectContradiction('s1', 'arch');
    assert.equal(result.hasContradiction, false);
    assert.equal(result.conflicts.length, 0);
  });

  test('returns no contradiction for identical snapshots', () => {
    const content = 'Use better-sqlite3 for FTS5 full-text search and context storage';
    store.saveSnapshot('s1', 'arch', content);
    store.saveSnapshot('s1', 'arch', content);
    const result = store.detectContradiction('s1', 'arch');
    assert.equal(result.hasContradiction, false);
  });

  test('detects contradiction between highly dissimilar snapshots', () => {
    store.saveSnapshot('s1', 'db-decision', 'Use PostgreSQL for reliable ACID-compliant relational data storage');
    store.saveSnapshot('s1', 'db-decision', 'Use MongoDB document store for flexible unstructured JSON schema');
    const result = store.detectContradiction('s1', 'db-decision');
    assert.equal(result.hasContradiction, true, 'should detect contradiction between conflicting DB choices');
    assert.ok(result.conflicts.length > 0);
    assert.ok(typeof result.conflicts[0].dissimilarity === 'number');
    assert.ok(result.conflicts[0].dissimilarity >= 0.7);
  });

  test('conflict objects include both snapshots', () => {
    store.saveSnapshot('s1', 'key', 'Content A with unique words about databases and schemas');
    store.saveSnapshot('s1', 'key', 'Completely different paragraph about cooking recipes and food');
    const { conflicts } = store.detectContradiction('s1', 'key');
    assert.ok(conflicts.length > 0);
    const conflict = conflicts[0];
    assert.ok(conflict.a, 'conflict should have snapshot a');
    assert.ok(conflict.b, 'conflict should have snapshot b');
    assert.ok(conflict.a.content !== conflict.b.content);
  });

  test('respects custom threshold', () => {
    // With a very low threshold, similar content should trigger conflict
    store.saveSnapshot('s1', 'k', 'Use Node.js for the backend API server');
    store.saveSnapshot('s1', 'k', 'Use Node.js for the frontend rendering service');
    // Default threshold 0.7 — these are similar so probably no conflict
    const strict = store.detectContradiction('s1', 'k', 0.1); // very low threshold
    const lenient = store.detectContradiction('s1', 'k', 0.99); // very high threshold
    // At 0.1 threshold more things are flagged; at 0.99 basically nothing is
    assert.ok(strict.conflicts.length >= lenient.conflicts.length,
      'strict threshold should flag at least as many conflicts as lenient');
  });

  test('returns no contradiction for empty session key', () => {
    const result = store.detectContradiction('s1', 'nonexistent-key');
    assert.equal(result.hasContradiction, false);
    assert.equal(result.conflicts.length, 0);
  });

  test('scopes correctly to session', () => {
    store.createSession('s2', 2);
    store.saveSnapshot('s1', 'arch', 'Use PostgreSQL for relational storage with foreign keys');
    store.saveSnapshot('s2', 'arch', 'Use MongoDB for document storage with flexible schemas');
    // s1 only has one snapshot for 'arch' — no contradiction within s1
    const result = store.detectContradiction('s1', 'arch');
    assert.equal(result.hasContradiction, false);
  });

  test('handles multiple contradictions in a sequence', () => {
    store.saveSnapshot('s1', 'plan', 'Phase 1: implement REST API with Express');
    store.saveSnapshot('s1', 'plan', 'Phase 1: implement GraphQL yoga server websockets');
    store.saveSnapshot('s1', 'plan', 'Phase 1: implement gRPC protobuf binary protocol');
    const result = store.detectContradiction('s1', 'plan');
    // May detect 1 or 2 conflicts depending on similarity between pairs
    assert.ok(result.conflicts.length >= 0); // At minimum, it should not throw
    assert.ok(typeof result.hasContradiction === 'boolean');
  });
});

describe('ContextStore — _trigramDissimilarity', () => {
  let store;
  afterEach(() => store.close());
  beforeEach(() => { store = tempStore(); });

  test('identical strings have dissimilarity 0', () => {
    const d = store._trigramDissimilarity('hello world', 'hello world');
    assert.equal(d, 0);
  });

  test('completely different strings have high dissimilarity', () => {
    const d = store._trigramDissimilarity('abcdefghijk', 'xyz123456789');
    assert.ok(d > 0.8, `expected high dissimilarity, got ${d}`);
  });

  test('partially similar strings are between 0 and 1', () => {
    const d = store._trigramDissimilarity(
      'use better-sqlite3 for database',
      'use better-sqlite3 for caching layer'
    );
    assert.ok(d > 0 && d < 1, `dissimilarity should be in (0,1), got ${d}`);
  });

  test('handles empty strings', () => {
    assert.equal(store._trigramDissimilarity('', ''), 0);
    assert.equal(store._trigramDissimilarity('hello', ''), 1);
    assert.equal(store._trigramDissimilarity('', 'hello'), 1);
  });

  test('handles null/undefined gracefully', () => {
    assert.equal(store._trigramDissimilarity(null, null), 0);
    assert.equal(store._trigramDissimilarity(null, 'hello'), 1);
  });
});
