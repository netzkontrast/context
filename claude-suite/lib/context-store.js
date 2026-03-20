'use strict';

/**
 * Context Store — SQLite-backed persistent context with FTS5 full-text search
 *
 * Stores session state, execution records, context snapshots, and audit logs
 * in a local SQLite database with WAL mode for concurrent reads. Context
 * snapshots are automatically indexed into an FTS5 virtual table so callers
 * can full-text search across all stored context.
 *
 * Usage:
 *   const store = new ContextStore({ dbPath: '/tmp/ctx.db' });
 *   store.createSession('s1', 0);
 *   store.saveSnapshot('s1', 'plan', 'Implement feature X …');
 *   store.search('feature');
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class ContextStore {
  constructor(options = {}) {
    const dbPath = options.dbPath || path.join(process.cwd(), '.suite', 'context.db');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this._initSchema();
  }

  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        created_at TEXT DEFAULT (datetime('now')),
        phase INTEGER,
        status TEXT DEFAULT 'active',
        metadata TEXT DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS executions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        wave_index INTEGER,
        agent_id TEXT,
        status TEXT DEFAULT 'pending',
        started_at TEXT,
        completed_at TEXT,
        output TEXT,
        exit_code INTEGER,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS context_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        key TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        event_type TEXT NOT NULL,
        payload TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS context_fts USING fts5(
        key, content, session_id UNINDEXED,
        content='context_snapshots',
        content_rowid='id'
      );

      CREATE TRIGGER IF NOT EXISTS context_fts_insert AFTER INSERT ON context_snapshots BEGIN
        INSERT INTO context_fts(rowid, key, content, session_id)
        VALUES (new.id, new.key, new.content, new.session_id);
      END;

      CREATE TRIGGER IF NOT EXISTS context_fts_delete AFTER DELETE ON context_snapshots BEGIN
        INSERT INTO context_fts(context_fts, rowid, key, content, session_id)
        VALUES ('delete', old.id, old.key, old.content, old.session_id);
      END;
    `);
  }

  // ── Session management ────────────────────────────────────────────────────────

  createSession(id, phase, metadata = {}) {
    this.db.prepare(
      'INSERT INTO sessions (id, phase, metadata) VALUES (?, ?, ?)'
    ).run(id, phase, JSON.stringify(metadata));
    return id;
  }

  getSession(id) {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    if (row && row.metadata) row.metadata = JSON.parse(row.metadata);
    return row || null;
  }

  updateSessionStatus(id, status) {
    this.db.prepare('UPDATE sessions SET status = ? WHERE id = ?').run(status, id);
  }

  listSessions(status = null) {
    if (status) {
      return this.db.prepare('SELECT * FROM sessions WHERE status = ? ORDER BY created_at DESC').all(status)
        .map(r => ({ ...r, metadata: JSON.parse(r.metadata || '{}') }));
    }
    return this.db.prepare('SELECT * FROM sessions ORDER BY created_at DESC').all()
      .map(r => ({ ...r, metadata: JSON.parse(r.metadata || '{}') }));
  }

  // ── Execution tracking ────────────────────────────────────────────────────────

  recordExecution(execution) {
    const { id, sessionId, taskId, waveIndex, agentId } = execution;
    this.db.prepare(
      'INSERT INTO executions (id, session_id, task_id, wave_index, agent_id, status, started_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))'
    ).run(id, sessionId, taskId, waveIndex != null ? waveIndex : null, agentId || null, 'running');
  }

  completeExecution(id, output, exitCode) {
    this.db.prepare(
      'UPDATE executions SET status = ?, output = ?, exit_code = ?, completed_at = datetime(\'now\') WHERE id = ?'
    ).run(exitCode === 0 ? 'completed' : 'failed', JSON.stringify(output), exitCode, id);
  }

  getExecution(id) {
    const row = this.db.prepare('SELECT * FROM executions WHERE id = ?').get(id);
    if (row && row.output) row.output = JSON.parse(row.output);
    return row || null;
  }

  getSessionExecutions(sessionId) {
    return this.db.prepare('SELECT * FROM executions WHERE session_id = ? ORDER BY wave_index, started_at').all(sessionId)
      .map(r => ({ ...r, output: r.output ? JSON.parse(r.output) : null }));
  }

  // ── Context snapshots ─────────────────────────────────────────────────────────

  saveSnapshot(sessionId, key, content) {
    this.db.prepare(
      'INSERT INTO context_snapshots (session_id, key, content) VALUES (?, ?, ?)'
    ).run(sessionId, key, typeof content === 'string' ? content : JSON.stringify(content));
  }

  getSnapshot(sessionId, key) {
    return this.db.prepare(
      'SELECT * FROM context_snapshots WHERE session_id = ? AND key = ? ORDER BY id DESC LIMIT 1'
    ).get(sessionId, key) || null;
  }

  // ── FTS5 full-text search ─────────────────────────────────────────────────────

  search(query, limit = 20) {
    return this.db.prepare(
      'SELECT key, content, session_id, rank FROM context_fts WHERE context_fts MATCH ? ORDER BY rank LIMIT ?'
    ).all(query, limit);
  }

  searchInSession(sessionId, query, limit = 20) {
    return this.db.prepare(
      'SELECT key, content, session_id, rank FROM context_fts WHERE context_fts MATCH ? AND session_id = ? ORDER BY rank LIMIT ?'
    ).all(query, sessionId, limit);
  }

  // ── Audit log ─────────────────────────────────────────────────────────────────

  logEvent(sessionId, eventType, payload = {}) {
    this.db.prepare(
      'INSERT INTO audit_log (session_id, event_type, payload) VALUES (?, ?, ?)'
    ).run(sessionId, eventType, JSON.stringify(payload));
  }

  getAuditLog(sessionId, limit = 100) {
    return this.db.prepare(
      'SELECT * FROM audit_log WHERE session_id = ? ORDER BY id DESC LIMIT ?'
    ).all(sessionId, limit)
      .map(r => ({ ...r, payload: JSON.parse(r.payload || '{}') }));
  }

  // ── Context budget estimation ─────────────────────────────────────────────────

  estimateTokens(text) {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil((typeof text === 'string' ? text : JSON.stringify(text)).length / 4);
  }

  getSessionTokenBudget(sessionId) {
    const snapshots = this.db.prepare(
      'SELECT key, content FROM context_snapshots WHERE session_id = ?'
    ).all(sessionId);

    let totalTokens = 0;
    const breakdown = {};
    for (const snap of snapshots) {
      const tokens = this.estimateTokens(snap.content);
      breakdown[snap.key] = tokens;
      totalTokens += tokens;
    }
    return { totalTokens, breakdown };
  }

  // ── Paraconsistent conflict detection ────────────────────────────────────────

  /**
   * Detect potentially contradictory snapshots within a session for a given key.
   *
   * Rather than silently synthesising conflicting context (which triggers
   * hallucination via classical-logic explosion), this method flags conflicts
   * so agents can isolate paradoxes and escalate rather than guess.
   *
   * Algorithm:
   *   1. Retrieve all snapshots for (sessionId, key) ordered by insertion time
   *   2. For each adjacent pair, compute a simple lexical dissimilarity score
   *      (1 - Jaccard similarity of trigram sets)
   *   3. If dissimilarity exceeds threshold, the pair is a contradiction candidate
   *   4. Return all candidate pairs with their dissimilarity score
   *
   * @param {string} sessionId
   * @param {string} key
   * @param {number} [threshold=0.7] - Dissimilarity threshold (0–1); higher = stricter
   * @returns {{ hasContradiction: boolean, conflicts: Array<{a, b, dissimilarity}> }}
   */
  detectContradiction(sessionId, key, threshold = 0.7) {
    const snapshots = this.db.prepare(
      'SELECT id, key, content, created_at FROM context_snapshots WHERE session_id = ? AND key = ? ORDER BY id ASC'
    ).all(sessionId, key);

    if (snapshots.length < 2) {
      return { hasContradiction: false, conflicts: [] };
    }

    const conflicts = [];

    for (let i = 0; i < snapshots.length - 1; i++) {
      const a = snapshots[i];
      const b = snapshots[i + 1];
      const dissimilarity = this._trigramDissimilarity(a.content, b.content);
      if (dissimilarity >= threshold) {
        conflicts.push({ a, b, dissimilarity: +dissimilarity.toFixed(4) });
      }
    }

    return { hasContradiction: conflicts.length > 0, conflicts };
  }

  /**
   * Compute trigram-based dissimilarity between two strings.
   * Returns 0.0 (identical) to 1.0 (completely different).
   * @param {string} a
   * @param {string} b
   * @returns {number}
   */
  _trigramDissimilarity(a, b) {
    const trigrams = (str) => {
      const s = str.toLowerCase().replace(/\s+/g, ' ').trim();
      const set = new Set();
      for (let i = 0; i < s.length - 2; i++) {
        set.add(s.slice(i, i + 3));
      }
      return set;
    };

    const ta = trigrams(a || '');
    const tb = trigrams(b || '');

    if (ta.size === 0 && tb.size === 0) return 0;
    if (ta.size === 0 || tb.size === 0) return 1;

    let intersection = 0;
    for (const t of ta) {
      if (tb.has(t)) intersection++;
    }

    const union = ta.size + tb.size - intersection;
    const jaccard = intersection / union;
    return 1 - jaccard;
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────────

  close() {
    this.db.close();
  }
}

module.exports = { ContextStore };
