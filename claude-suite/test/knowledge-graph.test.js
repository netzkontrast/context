'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

const { KnowledgeGraph, VALID_TYPES, VALID_RELATIONSHIPS } = require('../lib/knowledge-graph');

// ── Helpers ───────────────────────────────────────────────────────────────────

function tempGraph() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kg-test-'));
  return new KnowledgeGraph({ dbPath: path.join(dir, 'graph.db') });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('KnowledgeGraph — schema constants', () => {
  test('exports VALID_TYPES', () => {
    for (const t of ['File', 'Function', 'Class', 'Requirement', 'Decision']) {
      assert.ok(VALID_TYPES.has(t), `${t} should be a valid type`);
    }
  });

  test('exports VALID_RELATIONSHIPS', () => {
    for (const r of ['IMPLEMENTS', 'DEPENDS_ON', 'MODIFIES', 'OBSOLETES', 'TESTS']) {
      assert.ok(VALID_RELATIONSHIPS.has(r), `${r} should be a valid relationship`);
    }
  });
});

describe('KnowledgeGraph — node management', () => {
  let kg;
  afterEach(() => kg.close());

  beforeEach(() => { kg = tempGraph(); });

  test('upserts and retrieves a node', () => {
    kg.upsertNode({ node_id: 'lib/ldar.js', type: 'File', content_hash: 'abc123' });
    const node = kg.getNode('lib/ldar.js');
    assert.equal(node.node_id, 'lib/ldar.js');
    assert.equal(node.type, 'File');
    assert.equal(node.content_hash, 'abc123');
  });

  test('upsert updates existing node', () => {
    kg.upsertNode({ node_id: 'lib/ldar.js', type: 'File', content_hash: 'v1' });
    kg.upsertNode({ node_id: 'lib/ldar.js', type: 'File', content_hash: 'v2' });
    const node = kg.getNode('lib/ldar.js');
    assert.equal(node.content_hash, 'v2');
  });

  test('stores metadata as object', () => {
    kg.upsertNode({ node_id: 'REQ-1', type: 'Requirement', metadata: { priority: 'high' } });
    const node = kg.getNode('REQ-1');
    assert.deepEqual(node.metadata, { priority: 'high' });
  });

  test('returns null for unknown node', () => {
    assert.equal(kg.getNode('nonexistent'), null);
  });

  test('throws on invalid type', () => {
    assert.throws(
      () => kg.upsertNode({ node_id: 'x', type: 'Widget' }),
      /Invalid type/
    );
  });

  test('throws when node_id is missing', () => {
    assert.throws(
      () => kg.upsertNode({ type: 'File' }),
      /node_id/
    );
  });

  test('deletes a node and its edges', () => {
    kg.upsertNode({ node_id: 'a', type: 'File' });
    kg.upsertNode({ node_id: 'b', type: 'File' });
    kg.addEdge({ source_id: 'a', target_id: 'b', relationship: 'DEPENDS_ON' });
    kg.deleteNode('a');
    assert.equal(kg.getNode('a'), null);
    assert.equal(kg.getOutEdges('a').length, 0);
  });

  test('listNodes returns all nodes', () => {
    kg.upsertNode({ node_id: 'f1', type: 'Function' });
    kg.upsertNode({ node_id: 'f2', type: 'Function' });
    kg.upsertNode({ node_id: 'c1', type: 'Class' });
    const all = kg.listNodes();
    assert.equal(all.length, 3);
  });

  test('listNodes filtered by type', () => {
    kg.upsertNode({ node_id: 'f1', type: 'Function' });
    kg.upsertNode({ node_id: 'c1', type: 'Class' });
    const fns = kg.listNodes('Function');
    assert.equal(fns.length, 1);
    assert.equal(fns[0].node_id, 'f1');
  });
});

describe('KnowledgeGraph — edge management', () => {
  let kg;
  afterEach(() => kg.close());

  beforeEach(() => {
    kg = tempGraph();
    kg.upsertNode({ node_id: 'src', type: 'File' });
    kg.upsertNode({ node_id: 'dst', type: 'File' });
    kg.upsertNode({ node_id: 'req', type: 'Requirement' });
  });

  test('adds and retrieves an edge', () => {
    kg.addEdge({ source_id: 'src', target_id: 'dst', relationship: 'DEPENDS_ON' });
    const edges = kg.getOutEdges('src');
    assert.equal(edges.length, 1);
    assert.equal(edges[0].target_id, 'dst');
    assert.equal(edges[0].relationship, 'DEPENDS_ON');
  });

  test('addEdge is idempotent', () => {
    kg.addEdge({ source_id: 'src', target_id: 'dst', relationship: 'DEPENDS_ON' });
    kg.addEdge({ source_id: 'src', target_id: 'dst', relationship: 'DEPENDS_ON' });
    assert.equal(kg.getOutEdges('src').length, 1);
  });

  test('throws on invalid relationship', () => {
    assert.throws(
      () => kg.addEdge({ source_id: 'src', target_id: 'dst', relationship: 'BREAKS' }),
      /Invalid relationship/
    );
  });

  test('getOutEdges filtered by relationship', () => {
    kg.addEdge({ source_id: 'src', target_id: 'dst', relationship: 'DEPENDS_ON' });
    kg.addEdge({ source_id: 'src', target_id: 'req', relationship: 'IMPLEMENTS' });
    const deps = kg.getOutEdges('src', 'DEPENDS_ON');
    assert.equal(deps.length, 1);
    assert.equal(deps[0].target_id, 'dst');
  });

  test('getInEdges returns incoming edges', () => {
    kg.addEdge({ source_id: 'src', target_id: 'dst', relationship: 'MODIFIES' });
    const incoming = kg.getInEdges('dst');
    assert.equal(incoming.length, 1);
    assert.equal(incoming[0].source_id, 'src');
  });

  test('getNeighbours returns target node IDs', () => {
    kg.addEdge({ source_id: 'src', target_id: 'dst', relationship: 'DEPENDS_ON' });
    kg.addEdge({ source_id: 'src', target_id: 'req', relationship: 'IMPLEMENTS' });
    const neighbours = kg.getNeighbours('src');
    assert.ok(neighbours.includes('dst'));
    assert.ok(neighbours.includes('req'));
  });

  test('removeEdge works', () => {
    kg.addEdge({ source_id: 'src', target_id: 'dst', relationship: 'DEPENDS_ON' });
    kg.removeEdge('src', 'dst', 'DEPENDS_ON');
    assert.equal(kg.getOutEdges('src').length, 0);
  });

  test('throws when source_id missing', () => {
    assert.throws(
      () => kg.addEdge({ target_id: 'dst', relationship: 'DEPENDS_ON' }),
      /source_id/
    );
  });
});

describe('KnowledgeGraph — centrality and relevance', () => {
  let kg;
  afterEach(() => kg.close());

  beforeEach(() => {
    kg = tempGraph();
    ['a', 'b', 'c', 'd'].forEach(id => kg.upsertNode({ node_id: id, type: 'File' }));
    kg.addEdge({ source_id: 'a', target_id: 'b', relationship: 'DEPENDS_ON' });
    kg.addEdge({ source_id: 'a', target_id: 'c', relationship: 'DEPENDS_ON' });
    kg.addEdge({ source_id: 'b', target_id: 'c', relationship: 'IMPLEMENTS' });
    // 'c' has 2 in-edges → higher centrality than 'd'
  });

  test('centralityScore returns 0 for isolated node', () => {
    assert.equal(kg.centralityScore('d'), 0);
  });

  test('centralityScore is higher for well-connected node', () => {
    const scoreC = kg.centralityScore('c');
    const scoreD = kg.centralityScore('d');
    assert.ok(scoreC > scoreD, `c (${scoreC}) should be more central than d (${scoreD})`);
  });

  test('contextRelevanceScore is in [0, 1]', () => {
    const score = kg.contextRelevanceScore('a', { semanticOverlap: 0.8, recentlyModified: true, hasFailure: false });
    assert.ok(score >= 0 && score <= 1, `score should be in [0,1], got ${score}`);
  });

  test('contextRelevanceScore with failure flag is higher', () => {
    const base = kg.contextRelevanceScore('a', { semanticOverlap: 0.5 });
    const withFailure = kg.contextRelevanceScore('a', { semanticOverlap: 0.5, hasFailure: true });
    assert.ok(withFailure > base);
  });
});

describe('KnowledgeGraph — registerRefactor', () => {
  let kg;
  afterEach(() => kg.close());

  beforeEach(() => { kg = tempGraph(); });

  test('adds OBSOLETES and IMPLEMENTS edges', () => {
    kg.upsertNode({ node_id: 'fn_old', type: 'Function' });
    kg.upsertNode({ node_id: 'fn_new', type: 'Function' });
    kg.upsertNode({ node_id: 'REQ-5', type: 'Requirement' });

    kg.registerRefactor('fn_old', 'fn_new', 'REQ-5');

    const obsoletes = kg.getOutEdges('fn_new', 'OBSOLETES');
    assert.equal(obsoletes.length, 1);
    assert.equal(obsoletes[0].target_id, 'fn_old');

    const implements_ = kg.getOutEdges('fn_new', 'IMPLEMENTS');
    assert.equal(implements_.length, 1);
    assert.equal(implements_[0].target_id, 'REQ-5');
  });
});

describe('KnowledgeGraph — traverse', () => {
  let kg;
  afterEach(() => kg.close());

  beforeEach(() => {
    kg = tempGraph();
    ['a', 'b', 'c', 'd'].forEach(id => kg.upsertNode({ node_id: id, type: 'File' }));
    kg.addEdge({ source_id: 'a', target_id: 'b', relationship: 'DEPENDS_ON' });
    kg.addEdge({ source_id: 'b', target_id: 'c', relationship: 'DEPENDS_ON' });
    kg.addEdge({ source_id: 'c', target_id: 'd', relationship: 'DEPENDS_ON' });
  });

  test('traverse depth 1 returns direct neighbours', () => {
    const { nodes } = kg.traverse('a', 1);
    assert.ok(nodes.includes('a'));
    assert.ok(nodes.includes('b'));
    assert.ok(!nodes.includes('c'), 'depth 1 should not reach c');
  });

  test('traverse depth 2 reaches two hops', () => {
    const { nodes } = kg.traverse('a', 2);
    assert.ok(nodes.includes('c'));
    assert.ok(!nodes.includes('d'));
  });

  test('traverse returns edges traversed', () => {
    const { edges } = kg.traverse('a', 2);
    assert.equal(edges.length, 2); // a→b, b→c
  });

  test('traverse on isolated node returns only start', () => {
    kg.upsertNode({ node_id: 'isolated', type: 'File' });
    const { nodes, edges } = kg.traverse('isolated', 3);
    assert.deepEqual(nodes, ['isolated']);
    assert.equal(edges.length, 0);
  });
});

describe('KnowledgeGraph — stats', () => {
  let kg;
  afterEach(() => kg.close());

  beforeEach(() => { kg = tempGraph(); });

  test('stats returns correct counts', () => {
    kg.upsertNode({ node_id: 'f1', type: 'File' });
    kg.upsertNode({ node_id: 'fn1', type: 'Function' });
    kg.addEdge({ source_id: 'f1', target_id: 'fn1', relationship: 'DEPENDS_ON' });

    const s = kg.stats();
    assert.equal(s.nodeCount, 2);
    assert.equal(s.edgeCount, 1);
    assert.ok(Array.isArray(s.byType));
    assert.ok(Array.isArray(s.byRelationship));
  });

  test('stats on empty graph', () => {
    const s = kg.stats();
    assert.equal(s.nodeCount, 0);
    assert.equal(s.edgeCount, 0);
  });
});
