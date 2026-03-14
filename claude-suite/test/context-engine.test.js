'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { ContextEngine, FRAGMENT_TYPES } = require('../lib/context-engine');

describe('ContextEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new ContextEngine(':memory:');
  });

  afterEach(() => {
    engine.close();
  });

  describe('store()', () => {
    it('stores a fragment and returns an id', () => {
      const result = engine.store({
        source: 'agent-1',
        type: 'note',
        title: 'Test Fragment',
        content: 'This is a test fragment for the context engine.',
      });
      assert.equal(typeof result.id, 'number');
      assert.ok(result.id > 0);
    });

    it('stores fragments with all valid types', () => {
      for (const type of FRAGMENT_TYPES) {
        const result = engine.store({
          source: 'test',
          type,
          title: `${type} fragment`,
          content: `Content for ${type}`,
        });
        assert.ok(result.id > 0);
      }
    });

    it('rejects fragments with invalid type', () => {
      assert.throws(() => {
        engine.store({
          source: 'test',
          type: 'invalid',
          title: 'Bad',
          content: 'Bad',
        });
      }, /Invalid fragment type/);
    });

    it('rejects fragments missing required fields', () => {
      assert.throws(() => {
        engine.store({ source: 'test', title: 'No content' });
      }, /requires source, title, and content/);

      assert.throws(() => {
        engine.store({ content: 'No source or title' });
      }, /requires source, title, and content/);
    });

    it('stores fragments with optional phase', () => {
      const result = engine.store({
        source: 'agent-1',
        type: 'decision',
        phase: 'Phase 1',
        title: 'Use SQLite',
        content: 'Decided to use built-in node:sqlite for zero dependencies.',
      });
      const fragment = engine.get(result.id);
      assert.equal(fragment.phase, 'Phase 1');
    });
  });

  describe('get()', () => {
    it('retrieves a stored fragment by id', () => {
      const { id } = engine.store({
        source: 'agent-1',
        type: 'snippet',
        title: 'Hello World',
        content: 'console.log("hello");',
      });
      const fragment = engine.get(id);
      assert.equal(fragment.title, 'Hello World');
      assert.equal(fragment.content, 'console.log("hello");');
      assert.equal(fragment.source, 'agent-1');
      assert.equal(fragment.type, 'snippet');
    });

    it('returns undefined for non-existent id', () => {
      const fragment = engine.get(9999);
      assert.equal(fragment, undefined);
    });
  });

  describe('search()', () => {
    beforeEach(() => {
      engine.store({ source: 'a1', type: 'note', title: 'SQLite FTS5', content: 'Full-text search using FTS5 virtual tables.' });
      engine.store({ source: 'a2', type: 'decision', title: 'Node.js Choice', content: 'Using Node.js built-in sqlite module.' });
      engine.store({ source: 'a3', type: 'research', phase: 'Phase 1', title: 'Commander CLI', content: 'Commander.js provides robust CLI argument parsing.' });
      engine.store({ source: 'a1', type: 'note', title: 'Architecture', content: 'Hexagonal architecture with ports and adapters.' });
    });

    it('finds fragments by content keyword', () => {
      const results = engine.search('sqlite');
      assert.ok(results.length >= 1);
      assert.ok(results.some(r => r.title === 'SQLite FTS5'));
    });

    it('finds fragments by title keyword', () => {
      const results = engine.search('Architecture');
      assert.ok(results.length >= 1);
      assert.ok(results.some(r => r.title === 'Architecture'));
    });

    it('filters by type', () => {
      const results = engine.search('sqlite', { type: 'decision' });
      assert.ok(results.length >= 1);
      assert.ok(results.every(r => r.type === 'decision'));
    });

    it('filters by phase', () => {
      const results = engine.search('CLI OR Commander', { phase: 'Phase 1' });
      assert.ok(results.length >= 1);
      assert.ok(results.every(r => r.phase === 'Phase 1'));
    });

    it('respects limit', () => {
      const results = engine.search('architecture OR sqlite OR Commander', { limit: 2 });
      assert.ok(results.length <= 2);
    });

    it('returns empty array for no matches', () => {
      const results = engine.search('xyznonexistent');
      assert.equal(results.length, 0);
    });
  });

  describe('list()', () => {
    beforeEach(() => {
      engine.store({ source: 'a1', type: 'note', phase: 'Phase 1', title: 'Note 1', content: 'Content 1' });
      engine.store({ source: 'a2', type: 'error', phase: 'Phase 1', title: 'Error 1', content: 'Content 2' });
      engine.store({ source: 'a1', type: 'note', phase: 'Phase 2', title: 'Note 2', content: 'Content 3' });
    });

    it('lists all fragments', () => {
      const results = engine.list();
      assert.equal(results.length, 3);
    });

    it('filters by type', () => {
      const results = engine.list({ type: 'error' });
      assert.equal(results.length, 1);
      assert.equal(results[0].title, 'Error 1');
    });

    it('filters by phase', () => {
      const results = engine.list({ phase: 'Phase 1' });
      assert.equal(results.length, 2);
    });

    it('filters by source', () => {
      const results = engine.list({ source: 'a1' });
      assert.equal(results.length, 2);
    });

    it('respects limit', () => {
      const results = engine.list({ limit: 1 });
      assert.equal(results.length, 1);
    });
  });

  describe('update()', () => {
    it('updates fragment fields', () => {
      const { id } = engine.store({ source: 'a1', type: 'note', title: 'Original', content: 'Original content' });
      engine.update(id, { title: 'Updated', content: 'Updated content' });
      const fragment = engine.get(id);
      assert.equal(fragment.title, 'Updated');
      assert.equal(fragment.content, 'Updated content');
    });

    it('updated fragments are searchable with new content', () => {
      const { id } = engine.store({ source: 'a1', type: 'note', title: 'Original', content: 'Original content' });
      engine.update(id, { content: 'Completely new text about hexagonal architecture' });
      const results = engine.search('hexagonal');
      assert.ok(results.length >= 1);
    });

    it('throws on empty update', () => {
      const { id } = engine.store({ source: 'a1', type: 'note', title: 'X', content: 'Y' });
      assert.throws(() => engine.update(id, {}), /No valid fields/);
    });
  });

  describe('delete()', () => {
    it('deletes a fragment', () => {
      const { id } = engine.store({ source: 'a1', type: 'note', title: 'Delete me', content: 'Gone' });
      const result = engine.delete(id);
      assert.equal(result.changes, 1);
      assert.equal(engine.get(id), undefined);
    });

    it('returns 0 changes for non-existent id', () => {
      const result = engine.delete(9999);
      assert.equal(result.changes, 0);
    });
  });

  describe('count()', () => {
    it('counts all fragments', () => {
      engine.store({ source: 'a1', type: 'note', title: 'A', content: 'A' });
      engine.store({ source: 'a1', type: 'error', title: 'B', content: 'B' });
      assert.equal(engine.count(), 2);
    });

    it('counts by type', () => {
      engine.store({ source: 'a1', type: 'note', title: 'A', content: 'A' });
      engine.store({ source: 'a1', type: 'error', title: 'B', content: 'B' });
      engine.store({ source: 'a1', type: 'note', title: 'C', content: 'C' });
      assert.equal(engine.count('note'), 2);
      assert.equal(engine.count('error'), 1);
    });
  });
});
