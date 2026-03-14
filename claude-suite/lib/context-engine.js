'use strict';

/**
 * Context Engine — SQLite FTS5-backed knowledge store
 *
 * Provides the persistent memory layer for the Claude Suite. Agents can store
 * and retrieve context fragments (notes, decisions, code snippets, research)
 * using full-text search powered by SQLite's FTS5 extension.
 *
 * Design principles:
 *   - Zero external dependencies (uses Node 22+ built-in node:sqlite)
 *   - Each project gets its own `.suite/context.db` database
 *   - SQ3R-inspired: Survey → Question → Read → Recite → Review
 *   - Fragments are tagged with source, type, and phase for scoped retrieval
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const FRAGMENT_TYPES = ['note', 'decision', 'snippet', 'research', 'error', 'plan'];

class ContextEngine {
  /**
   * @param {string} dbPath - Path to the SQLite database file, or ':memory:' for in-memory
   */
  constructor(dbPath) {
    this._dbPath = dbPath;

    // Ensure parent directory exists for file-based databases
    if (dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }

    this._db = new DatabaseSync(dbPath);
    this._initialize();
  }

  /**
   * Create tables and FTS5 virtual table if they don't exist.
   */
  _initialize() {
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS fragments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'note',
        phase TEXT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // FTS5 virtual table for full-text search over title + content
    this._db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS fragments_fts USING fts5(
        title,
        content,
        content=fragments,
        content_rowid=id
      )
    `);

    // Triggers to keep FTS index in sync with the fragments table
    this._db.exec(`
      CREATE TRIGGER IF NOT EXISTS fragments_ai AFTER INSERT ON fragments BEGIN
        INSERT INTO fragments_fts(rowid, title, content)
        VALUES (new.id, new.title, new.content);
      END
    `);

    this._db.exec(`
      CREATE TRIGGER IF NOT EXISTS fragments_ad AFTER DELETE ON fragments BEGIN
        INSERT INTO fragments_fts(fragments_fts, rowid, title, content)
        VALUES ('delete', old.id, old.title, old.content);
      END
    `);

    this._db.exec(`
      CREATE TRIGGER IF NOT EXISTS fragments_au AFTER UPDATE ON fragments BEGIN
        INSERT INTO fragments_fts(fragments_fts, rowid, title, content)
        VALUES ('delete', old.id, old.title, old.content);
        INSERT INTO fragments_fts(rowid, title, content)
        VALUES (new.id, new.title, new.content);
      END
    `);
  }

  /**
   * Store a context fragment.
   *
   * @param {Object} fragment
   * @param {string} fragment.source - Origin of the fragment (agent id, file path, user)
   * @param {string} fragment.type - One of FRAGMENT_TYPES
   * @param {string} [fragment.phase] - Associated execution phase
   * @param {string} fragment.title - Short title / summary
   * @param {string} fragment.content - Full content body
   * @returns {{ id: number }} The inserted fragment's ID
   */
  store(fragment) {
    const { source, type = 'note', phase = null, title, content } = fragment;

    if (!source || !title || !content) {
      throw new Error('Fragment requires source, title, and content');
    }
    if (!FRAGMENT_TYPES.includes(type)) {
      throw new Error(`Invalid fragment type: ${type}. Must be one of: ${FRAGMENT_TYPES.join(', ')}`);
    }

    const stmt = this._db.prepare(
      'INSERT INTO fragments (source, type, phase, title, content) VALUES (?, ?, ?, ?, ?)'
    );
    const result = stmt.run(source, type, phase, title, content);
    return { id: Number(result.lastInsertRowid) };
  }

  /**
   * Full-text search across fragments.
   *
   * @param {string} query - FTS5 search query (supports AND, OR, NOT, prefix*)
   * @param {Object} [options]
   * @param {string} [options.type] - Filter by fragment type
   * @param {string} [options.phase] - Filter by phase
   * @param {number} [options.limit=10] - Max results
   * @returns {Array<Object>} Matching fragments sorted by relevance
   */
  search(query, options = {}) {
    const { type, phase, limit = 10 } = options;

    let sql = `
      SELECT f.id, f.source, f.type, f.phase, f.title, f.content,
             f.created_at, f.updated_at
      FROM fragments f
      INNER JOIN fragments_fts fts ON f.id = fts.rowid
      WHERE fragments_fts MATCH ?
    `;
    const params = [query];

    if (type) {
      sql += ' AND f.type = ?';
      params.push(type);
    }
    if (phase) {
      sql += ' AND f.phase = ?';
      params.push(phase);
    }

    sql += ' ORDER BY rank LIMIT ?';
    params.push(limit);

    const stmt = this._db.prepare(sql);
    return stmt.all(...params);
  }

  /**
   * Retrieve a fragment by ID.
   *
   * @param {number} id
   * @returns {Object|undefined}
   */
  get(id) {
    const stmt = this._db.prepare('SELECT * FROM fragments WHERE id = ?');
    return stmt.get(id);
  }

  /**
   * List fragments with optional filters.
   *
   * @param {Object} [options]
   * @param {string} [options.type] - Filter by type
   * @param {string} [options.phase] - Filter by phase
   * @param {string} [options.source] - Filter by source
   * @param {number} [options.limit=20] - Max results
   * @returns {Array<Object>}
   */
  list(options = {}) {
    const { type, phase, source, limit = 20 } = options;

    let sql = 'SELECT * FROM fragments WHERE 1=1';
    const params = [];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (phase) {
      sql += ' AND phase = ?';
      params.push(phase);
    }
    if (source) {
      sql += ' AND source = ?';
      params.push(source);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const stmt = this._db.prepare(sql);
    return stmt.all(...params);
  }

  /**
   * Update a fragment's content.
   *
   * @param {number} id
   * @param {Object} updates - Fields to update (title, content, type, phase)
   * @returns {{ changes: number }}
   */
  update(id, updates) {
    const allowed = ['title', 'content', 'type', 'phase'];
    const fields = [];
    const params = [];

    for (const key of allowed) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(updates[key]);
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    fields.push("updated_at = datetime('now')");
    params.push(id);

    const sql = `UPDATE fragments SET ${fields.join(', ')} WHERE id = ?`;
    const stmt = this._db.prepare(sql);
    const result = stmt.run(...params);
    return { changes: result.changes };
  }

  /**
   * Delete a fragment by ID.
   *
   * @param {number} id
   * @returns {{ changes: number }}
   */
  delete(id) {
    const stmt = this._db.prepare('DELETE FROM fragments WHERE id = ?');
    const result = stmt.run(id);
    return { changes: result.changes };
  }

  /**
   * Get total fragment count, optionally filtered by type.
   *
   * @param {string} [type]
   * @returns {number}
   */
  count(type) {
    let sql = 'SELECT COUNT(*) as count FROM fragments';
    const params = [];
    if (type) {
      sql += ' WHERE type = ?';
      params.push(type);
    }
    const stmt = this._db.prepare(sql);
    return stmt.get(...params).count;
  }

  /**
   * Close the database connection.
   */
  close() {
    this._db.close();
  }
}

module.exports = { ContextEngine, FRAGMENT_TYPES };
