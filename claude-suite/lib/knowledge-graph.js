'use strict';

/**
 * Knowledge Graph — Entity-Edge codebase relationship store
 *
 * Maps complex codebases as a knowledge graph, treating entities (Files,
 * Functions, Classes, Requirements, Decisions) and their relationships
 * (IMPLEMENTS, DEPENDS_ON, MODIFIES, OBSOLETES, TESTS) as first-class objects.
 *
 * This enables:
 *   - Dependency centrality scoring for context relevance (20% weight in CRS)
 *   - OBSOLETES tracking when functions are refactored
 *   - Multi-hop relational retrieval (e.g. "find tests for this class")
 *   - Blackboard-style agent coordination via shared graph state
 *
 * Schema (from CLAUDE.md):
 *   EntityNode  { node_id, type, content_hash, metadata }
 *   EntityEdge  { source_id, target_id, relationship, weight, created_at }
 *
 * Entity types:  File | Function | Class | Requirement | Decision
 * Relationships: IMPLEMENTS | DEPENDS_ON | MODIFIES | OBSOLETES | TESTS
 *
 * Usage:
 *   const kg = new KnowledgeGraph({ dbPath: '.suite/graph.db' });
 *   kg.upsertNode({ node_id: 'lib/ldar.js', type: 'File', content_hash: 'abc' });
 *   kg.addEdge({ source_id: 'lib/ldar.js', target_id: 'REQ-5', relationship: 'IMPLEMENTS' });
 *   kg.getNeighbours('lib/ldar.js', 'DEPENDS_ON');
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const VALID_TYPES = new Set(['File', 'Function', 'Class', 'Requirement', 'Decision']);
const VALID_RELATIONSHIPS = new Set(['IMPLEMENTS', 'DEPENDS_ON', 'MODIFIES', 'OBSOLETES', 'TESTS']);

class KnowledgeGraph {
  constructor(options = {}) {
    const dbPath = options.dbPath || path.join(process.cwd(), '.suite', 'graph.db');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this._initSchema();
  }

  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        node_id      TEXT PRIMARY KEY,
        type         TEXT NOT NULL CHECK(type IN ('File','Function','Class','Requirement','Decision')),
        content_hash TEXT,
        metadata     TEXT DEFAULT '{}',
        created_at   TEXT DEFAULT (datetime('now')),
        updated_at   TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS edges (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id    TEXT NOT NULL,
        target_id    TEXT NOT NULL,
        relationship TEXT NOT NULL CHECK(relationship IN ('IMPLEMENTS','DEPENDS_ON','MODIFIES','OBSOLETES','TESTS')),
        weight       REAL DEFAULT 1.0,
        created_at   TEXT DEFAULT (datetime('now')),
        UNIQUE(source_id, target_id, relationship)
      );

      CREATE INDEX IF NOT EXISTS idx_edges_source   ON edges(source_id);
      CREATE INDEX IF NOT EXISTS idx_edges_target   ON edges(target_id);
      CREATE INDEX IF NOT EXISTS idx_edges_relation ON edges(relationship);
      CREATE INDEX IF NOT EXISTS idx_entities_type  ON entities(type);
    `);
  }

  // ── Entity management ─────────────────────────────────────────────────────────

  /**
   * Insert or update an entity node.
   * @param {{ node_id: string, type: string, content_hash?: string, metadata?: object }} node
   */
  upsertNode(node) {
    const { node_id, type, content_hash = null, metadata = {} } = node;
    if (!node_id) throw new Error('node_id is required');
    if (!VALID_TYPES.has(type)) throw new Error(`Invalid type: ${type}. Must be one of ${[...VALID_TYPES].join(', ')}`);

    this.db.prepare(`
      INSERT INTO entities (node_id, type, content_hash, metadata, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(node_id) DO UPDATE SET
        type         = excluded.type,
        content_hash = excluded.content_hash,
        metadata     = excluded.metadata,
        updated_at   = excluded.updated_at
    `).run(node_id, type, content_hash, JSON.stringify(metadata));
  }

  getNode(nodeId) {
    const row = this.db.prepare('SELECT * FROM entities WHERE node_id = ?').get(nodeId);
    if (!row) return null;
    return { ...row, metadata: JSON.parse(row.metadata || '{}') };
  }

  deleteNode(nodeId) {
    this.db.prepare('DELETE FROM edges WHERE source_id = ? OR target_id = ?').run(nodeId, nodeId);
    this.db.prepare('DELETE FROM entities WHERE node_id = ?').run(nodeId);
  }

  listNodes(type = null) {
    const rows = type
      ? this.db.prepare('SELECT * FROM entities WHERE type = ? ORDER BY node_id').all(type)
      : this.db.prepare('SELECT * FROM entities ORDER BY type, node_id').all();
    return rows.map(r => ({ ...r, metadata: JSON.parse(r.metadata || '{}') }));
  }

  // ── Edge management ───────────────────────────────────────────────────────────

  /**
   * Add a directed relationship edge between two entities.
   * Silently no-ops if the edge already exists (idempotent).
   * @param {{ source_id: string, target_id: string, relationship: string, weight?: number }} edge
   */
  addEdge(edge) {
    const { source_id, target_id, relationship, weight = 1.0 } = edge;
    if (!source_id || !target_id) throw new Error('source_id and target_id are required');
    if (!VALID_RELATIONSHIPS.has(relationship)) {
      throw new Error(`Invalid relationship: ${relationship}. Must be one of ${[...VALID_RELATIONSHIPS].join(', ')}`);
    }

    this.db.prepare(`
      INSERT OR IGNORE INTO edges (source_id, target_id, relationship, weight)
      VALUES (?, ?, ?, ?)
    `).run(source_id, target_id, relationship, weight);
  }

  removeEdge(sourceId, targetId, relationship) {
    this.db.prepare(
      'DELETE FROM edges WHERE source_id = ? AND target_id = ? AND relationship = ?'
    ).run(sourceId, targetId, relationship);
  }

  /**
   * Get all edges from a source node, optionally filtered by relationship type.
   * @param {string} nodeId
   * @param {string} [relationship]
   * @returns {object[]}
   */
  getOutEdges(nodeId, relationship = null) {
    return relationship
      ? this.db.prepare('SELECT * FROM edges WHERE source_id = ? AND relationship = ?').all(nodeId, relationship)
      : this.db.prepare('SELECT * FROM edges WHERE source_id = ?').all(nodeId);
  }

  /**
   * Get all edges into a target node, optionally filtered by relationship type.
   */
  getInEdges(nodeId, relationship = null) {
    return relationship
      ? this.db.prepare('SELECT * FROM edges WHERE target_id = ? AND relationship = ?').all(nodeId, relationship)
      : this.db.prepare('SELECT * FROM edges WHERE target_id = ?').all(nodeId);
  }

  /**
   * Get all neighbour node IDs reachable from nodeId via outbound edges.
   */
  getNeighbours(nodeId, relationship = null) {
    const edges = this.getOutEdges(nodeId, relationship);
    return edges.map(e => e.target_id);
  }

  // ── Centrality & relevance ────────────────────────────────────────────────────

  /**
   * Compute Dependency Centrality score for a node (used in ContextRelevanceScore).
   * Formula: (in_degree + out_degree) / max_degree, normalised to [0, 1].
   *
   * @param {string} nodeId
   * @returns {number} 0.0–1.0
   */
  centralityScore(nodeId) {
    const inDeg = this.db.prepare('SELECT COUNT(*) as c FROM edges WHERE target_id = ?').get(nodeId).c;
    const outDeg = this.db.prepare('SELECT COUNT(*) as c FROM edges WHERE source_id = ?').get(nodeId).c;
    const totalEdges = this.db.prepare('SELECT COUNT(*) as c FROM edges').get().c;
    if (totalEdges === 0) return 0;
    const maxPossible = Math.max(totalEdges, 1);
    return Math.min((inDeg + outDeg) / maxPossible, 1);
  }

  /**
   * Compute ContextRelevanceScore for a node (0.0–1.0).
   * Weights:
   *   - Dependency Centrality (20%)
   *   - Recency — nodes updated in last N commits (30%) — approximated by updated_at
   *   - Semantic overlap with query (40%) — caller supplies; default 0.5 if unknown
   *   - Failure history (10%) — caller supplies failure flag
   *
   * @param {string} nodeId
   * @param {{ semanticOverlap?: number, recentlyModified?: boolean, hasFailure?: boolean }} hints
   * @returns {number}
   */
  contextRelevanceScore(nodeId, hints = {}) {
    const centrality = this.centralityScore(nodeId);
    const semantic = hints.semanticOverlap !== undefined ? hints.semanticOverlap : 0.5;
    const temporal = hints.recentlyModified ? 1.0 : 0.3;
    const failure = hints.hasFailure ? 1.0 : 0.0;

    return (
      semantic * 0.40 +
      temporal * 0.30 +
      centrality * 0.20 +
      failure * 0.10
    );
  }

  // ── Refactor helpers ──────────────────────────────────────────────────────────

  /**
   * Register a function refactor:
   *   - Marks old node as OBSOLETES → new node
   *   - Links new node → requirement via IMPLEMENTS
   *
   * @param {string} oldNodeId
   * @param {string} newNodeId
   * @param {string} requirementId
   */
  registerRefactor(oldNodeId, newNodeId, requirementId) {
    this.addEdge({ source_id: newNodeId, target_id: oldNodeId, relationship: 'OBSOLETES' });
    this.addEdge({ source_id: newNodeId, target_id: requirementId, relationship: 'IMPLEMENTS' });
  }

  // ── Multi-hop traversal ───────────────────────────────────────────────────────

  /**
   * BFS traversal up to `depth` hops from a starting node.
   * Returns all reachable node IDs and the edges traversed.
   *
   * @param {string} startId
   * @param {number} [depth=2]
   * @param {string} [relationship] - Optional filter
   * @returns {{ nodes: string[], edges: object[] }}
   */
  traverse(startId, depth = 2, relationship = null) {
    const visited = new Set([startId]);
    const collectedEdges = [];
    let frontier = [startId];

    for (let d = 0; d < depth; d++) {
      const nextFrontier = [];
      for (const nodeId of frontier) {
        const edges = this.getOutEdges(nodeId, relationship);
        for (const edge of edges) {
          collectedEdges.push(edge);
          if (!visited.has(edge.target_id)) {
            visited.add(edge.target_id);
            nextFrontier.push(edge.target_id);
          }
        }
      }
      frontier = nextFrontier;
      if (frontier.length === 0) break;
    }

    return { nodes: [...visited], edges: collectedEdges };
  }

  // ── Statistics ────────────────────────────────────────────────────────────────

  stats() {
    const nodeCount = this.db.prepare('SELECT COUNT(*) as c FROM entities').get().c;
    const edgeCount = this.db.prepare('SELECT COUNT(*) as c FROM edges').get().c;
    const byType = this.db.prepare(
      'SELECT type, COUNT(*) as count FROM entities GROUP BY type'
    ).all();
    const byRelationship = this.db.prepare(
      'SELECT relationship, COUNT(*) as count FROM edges GROUP BY relationship'
    ).all();
    return { nodeCount, edgeCount, byType, byRelationship };
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────────

  close() {
    this.db.close();
  }
}

module.exports = { KnowledgeGraph, VALID_TYPES, VALID_RELATIONSHIPS };
