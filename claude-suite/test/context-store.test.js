'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ContextStore } = require('../lib/context-store');

// Helper: create a store backed by a temp directory, return store + cleanup fn
function tmpStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-test-'));
  const dbPath = path.join(dir, 'context.db');
  const store = new ContextStore({ dbPath });
  const cleanup = () => {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  };
  return { store, cleanup, dir, dbPath };
}

// ── Database initialisation ─────────────────────────────────────────────────

test('constructor: creates database directory if it does not exist', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-test-'));
  const nested = path.join(dir, 'deep', 'nested');
  const dbPath = path.join(nested, 'context.db');
  const store = new ContextStore({ dbPath });
  assert.ok(fs.existsSync(nested));
  store.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('constructor: database file is created on disk', () => {
  const { store, cleanup, dbPath } = tmpStore();
  assert.ok(fs.existsSync(dbPath));
  cleanup();
});

test('constructor: WAL journal mode is enabled', () => {
  const { store, cleanup } = tmpStore();
  const row = store.db.pragma('journal_mode');
  assert.equal(row[0].journal_mode, 'wal');
  cleanup();
});

test('constructor: all four tables exist', () => {
  const { store, cleanup } = tmpStore();
  const tables = store.db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'context_fts%' ORDER BY name"
  ).all().map(r => r.name);
  assert.deepEqual(tables, ['audit_log', 'context_snapshots', 'executions', 'sessions']);
  cleanup();
});

test('constructor: FTS5 virtual table exists', () => {
  const { store, cleanup } = tmpStore();
  const fts = store.db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name = 'context_fts'"
  ).get();
  assert.ok(fts);
  cleanup();
});

// ── Session CRUD ────────────────────────────────────────────────────────────

test('createSession: returns the session id', () => {
  const { store, cleanup } = tmpStore();
  const id = store.createSession('s1', 0);
  assert.equal(id, 's1');
  cleanup();
});

test('getSession: retrieves a created session', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('s1', 2, { foo: 'bar' });
  const s = store.getSession('s1');
  assert.equal(s.id, 's1');
  assert.equal(s.phase, 2);
  assert.equal(s.status, 'active');
  assert.deepEqual(s.metadata, { foo: 'bar' });
  assert.ok(s.created_at);
  cleanup();
});

test('getSession: returns null for missing session', () => {
  const { store, cleanup } = tmpStore();
  assert.equal(store.getSession('nope'), null);
  cleanup();
});

test('updateSessionStatus: changes status', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('s1', 0);
  store.updateSessionStatus('s1', 'completed');
  const s = store.getSession('s1');
  assert.equal(s.status, 'completed');
  cleanup();
});

test('listSessions: returns all sessions ordered by created_at DESC', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('a', 0);
  store.createSession('b', 1);
  store.createSession('c', 2);
  const all = store.listSessions();
  assert.equal(all.length, 3);
  // All metadata fields should be parsed objects
  assert.deepEqual(all[0].metadata, {});
  cleanup();
});

test('listSessions: filters by status', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('a', 0);
  store.createSession('b', 0);
  store.updateSessionStatus('b', 'completed');
  const active = store.listSessions('active');
  assert.equal(active.length, 1);
  assert.equal(active[0].id, 'a');
  const completed = store.listSessions('completed');
  assert.equal(completed.length, 1);
  assert.equal(completed[0].id, 'b');
  cleanup();
});

test('createSession: default metadata is empty object', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('s1', 0);
  const s = store.getSession('s1');
  assert.deepEqual(s.metadata, {});
  cleanup();
});

// ── Execution tracking ──────────────────────────────────────────────────────

test('recordExecution: creates an execution with running status', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('s1', 0);
  store.recordExecution({ id: 'e1', sessionId: 's1', taskId: 't1', waveIndex: 0, agentId: 'agent-0' });
  const e = store.getExecution('e1');
  assert.equal(e.id, 'e1');
  assert.equal(e.session_id, 's1');
  assert.equal(e.task_id, 't1');
  assert.equal(e.wave_index, 0);
  assert.equal(e.agent_id, 'agent-0');
  assert.equal(e.status, 'running');
  assert.ok(e.started_at);
  cleanup();
});

test('completeExecution: sets status to completed on exit code 0', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('s1', 0);
  store.recordExecution({ id: 'e1', sessionId: 's1', taskId: 't1' });
  store.completeExecution('e1', { result: 'ok' }, 0);
  const e = store.getExecution('e1');
  assert.equal(e.status, 'completed');
  assert.deepEqual(e.output, { result: 'ok' });
  assert.equal(e.exit_code, 0);
  assert.ok(e.completed_at);
  cleanup();
});

test('completeExecution: sets status to failed on non-zero exit code', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('s1', 0);
  store.recordExecution({ id: 'e1', sessionId: 's1', taskId: 't1' });
  store.completeExecution('e1', { error: 'boom' }, 1);
  const e = store.getExecution('e1');
  assert.equal(e.status, 'failed');
  assert.equal(e.exit_code, 1);
  cleanup();
});

test('getExecution: returns null for missing execution', () => {
  const { store, cleanup } = tmpStore();
  assert.equal(store.getExecution('nope'), null);
  cleanup();
});

test('getSessionExecutions: returns executions for a session', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('s1', 0);
  store.recordExecution({ id: 'e1', sessionId: 's1', taskId: 't1', waveIndex: 0 });
  store.recordExecution({ id: 'e2', sessionId: 's1', taskId: 't2', waveIndex: 1 });
  const execs = store.getSessionExecutions('s1');
  assert.equal(execs.length, 2);
  assert.equal(execs[0].id, 'e1');
  assert.equal(execs[1].id, 'e2');
  cleanup();
});

test('getSessionExecutions: returns empty array when no executions', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('s1', 0);
  const execs = store.getSessionExecutions('s1');
  assert.deepEqual(execs, []);
  cleanup();
});

test('recordExecution: waveIndex and agentId default to null', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('s1', 0);
  store.recordExecution({ id: 'e1', sessionId: 's1', taskId: 't1' });
  const e = store.getExecution('e1');
  assert.equal(e.wave_index, null);
  assert.equal(e.agent_id, null);
  cleanup();
});

// ── Context snapshots ───────────────────────────────────────────────────────

test('saveSnapshot + getSnapshot: stores and retrieves text content', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('s1', 0);
  store.saveSnapshot('s1', 'plan', 'Build the thing');
  const snap = store.getSnapshot('s1', 'plan');
  assert.equal(snap.key, 'plan');
  assert.equal(snap.content, 'Build the thing');
  assert.equal(snap.session_id, 's1');
  cleanup();
});

test('saveSnapshot: serialises object content to JSON', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('s1', 0);
  store.saveSnapshot('s1', 'config', { a: 1 });
  const snap = store.getSnapshot('s1', 'config');
  assert.equal(snap.content, '{"a":1}');
  cleanup();
});

test('getSnapshot: returns latest snapshot when multiple exist', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('s1', 0);
  store.saveSnapshot('s1', 'plan', 'v1');
  store.saveSnapshot('s1', 'plan', 'v2');
  const snap = store.getSnapshot('s1', 'plan');
  assert.equal(snap.content, 'v2');
  cleanup();
});

test('getSnapshot: returns null when no snapshot exists', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('s1', 0);
  assert.equal(store.getSnapshot('s1', 'nope'), null);
  cleanup();
});

// ── FTS5 full-text search ───────────────────────────────────────────────────

test('search: finds snapshots by content keyword', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('s1', 0);
  store.saveSnapshot('s1', 'readme', 'The quick brown fox jumps over the lazy dog');
  store.saveSnapshot('s1', 'notes', 'Nothing relevant here about cats');
  const results = store.search('fox');
  assert.equal(results.length, 1);
  assert.equal(results[0].key, 'readme');
  cleanup();
});

test('search: finds snapshots by key', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('s1', 0);
  store.saveSnapshot('s1', 'deployment-guide', 'Step 1: provision servers');
  const results = store.search('deployment');
  assert.equal(results.length, 1);
  cleanup();
});

test('search: respects limit parameter', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('s1', 0);
  for (let i = 0; i < 10; i++) {
    store.saveSnapshot('s1', `note-${i}`, `Important information about widgets item ${i}`);
  }
  const results = store.search('widgets', 3);
  assert.equal(results.length, 3);
  cleanup();
});

test('search: returns empty array when nothing matches', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('s1', 0);
  store.saveSnapshot('s1', 'k', 'hello world');
  const results = store.search('xyznonexistent');
  assert.equal(results.length, 0);
  cleanup();
});

test('searchInSession: scopes results to a specific session', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('s1', 0);
  store.createSession('s2', 0);
  store.saveSnapshot('s1', 'a', 'alpha bravo charlie');
  store.saveSnapshot('s2', 'b', 'alpha delta echo');
  const results = store.searchInSession('s1', 'alpha');
  assert.equal(results.length, 1);
  assert.equal(results[0].session_id, 's1');
  cleanup();
});

test('searchInSession: returns empty when session has no matches', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('s1', 0);
  store.createSession('s2', 0);
  store.saveSnapshot('s1', 'a', 'unique keyword xylophone');
  const results = store.searchInSession('s2', 'xylophone');
  assert.equal(results.length, 0);
  cleanup();
});

// ── Audit log ───────────────────────────────────────────────────────────────

test('logEvent + getAuditLog: stores and retrieves events', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('s1', 0);
  store.logEvent('s1', 'task_started', { taskId: 't1' });
  const log = store.getAuditLog('s1');
  assert.equal(log.length, 1);
  assert.equal(log[0].event_type, 'task_started');
  assert.deepEqual(log[0].payload, { taskId: 't1' });
  assert.ok(log[0].created_at);
  cleanup();
});

test('getAuditLog: returns events in reverse chronological order', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('s1', 0);
  store.logEvent('s1', 'first', {});
  store.logEvent('s1', 'second', {});
  store.logEvent('s1', 'third', {});
  const log = store.getAuditLog('s1');
  assert.equal(log.length, 3);
  // Most recent first (by id since created_at may be same second)
  assert.equal(log[0].event_type, 'third');
  assert.equal(log[2].event_type, 'first');
  cleanup();
});

test('getAuditLog: respects limit parameter', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('s1', 0);
  for (let i = 0; i < 10; i++) {
    store.logEvent('s1', `event-${i}`, {});
  }
  const log = store.getAuditLog('s1', 5);
  assert.equal(log.length, 5);
  cleanup();
});

test('logEvent: default payload is empty object', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('s1', 0);
  store.logEvent('s1', 'ping');
  const log = store.getAuditLog('s1');
  assert.deepEqual(log[0].payload, {});
  cleanup();
});

// ── Token budget estimation ─────────────────────────────────────────────────

test('estimateTokens: estimates ~4 chars per token for a string', () => {
  const { store, cleanup } = tmpStore();
  // 20 chars → 5 tokens
  assert.equal(store.estimateTokens('12345678901234567890'), 5);
  cleanup();
});

test('estimateTokens: rounds up partial tokens', () => {
  const { store, cleanup } = tmpStore();
  // 5 chars → ceil(5/4) = 2
  assert.equal(store.estimateTokens('hello'), 2);
  cleanup();
});

test('estimateTokens: handles object input by stringifying', () => {
  const { store, cleanup } = tmpStore();
  const obj = { a: 1 };
  const expected = Math.ceil(JSON.stringify(obj).length / 4);
  assert.equal(store.estimateTokens(obj), expected);
  cleanup();
});

test('getSessionTokenBudget: computes total tokens and breakdown', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('s1', 0);
  store.saveSnapshot('s1', 'plan', 'abcd'); // 4 chars → 1 token
  store.saveSnapshot('s1', 'code', '12345678'); // 8 chars → 2 tokens
  const budget = store.getSessionTokenBudget('s1');
  assert.equal(budget.totalTokens, 3);
  assert.equal(budget.breakdown.plan, 1);
  assert.equal(budget.breakdown.code, 2);
  cleanup();
});

test('getSessionTokenBudget: returns zero for empty session', () => {
  const { store, cleanup } = tmpStore();
  store.createSession('s1', 0);
  const budget = store.getSessionTokenBudget('s1');
  assert.equal(budget.totalTokens, 0);
  assert.deepEqual(budget.breakdown, {});
  cleanup();
});

// ── close ───────────────────────────────────────────────────────────────────

test('close: database is no longer usable after close', () => {
  const { store, dir } = tmpStore();
  store.close();
  assert.throws(() => store.db.prepare('SELECT 1'), /database/i);
  fs.rmSync(dir, { recursive: true, force: true });
});
