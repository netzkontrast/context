'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TruthVerifier, createAgentVerifier } = require('../lib/truth-verifier');

// ── TruthVerifier — schema registration ──────────────────────────────────────

test('TruthVerifier: throws for unregistered schema', () => {
  const v = new TruthVerifier();
  assert.throws(() => v.verify({}, 'unknown'), /No schema registered/);
});

test('TruthVerifier: defaultThreshold is 0.8', () => {
  const v = new TruthVerifier();
  v.register('t', { type: 'object' });
  assert.equal(v.getThreshold('t'), 0.8);
});

test('TruthVerifier: custom defaultThreshold is respected', () => {
  const v = new TruthVerifier({ defaultThreshold: 0.5 });
  v.register('t', { type: 'object' });
  assert.equal(v.getThreshold('t'), 0.5);
});

test('TruthVerifier: per-schema threshold overrides default', () => {
  const v = new TruthVerifier();
  v.register('t', { type: 'object' }, 0.9);
  assert.equal(v.getThreshold('t'), 0.9);
});

test('TruthVerifier: setThreshold updates threshold', () => {
  const v = new TruthVerifier();
  v.register('t', { type: 'object' });
  v.setThreshold('t', 0.6);
  assert.equal(v.getThreshold('t'), 0.6);
});

// ── verify — type checks ──────────────────────────────────────────────────────

test('verify: correct root type passes', () => {
  const v = new TruthVerifier();
  v.register('t', { type: 'object' });
  const r = v.verify({}, 't');
  assert.equal(r.valid, true);
  assert.equal(r.confidence, 1.0);
});

test('verify: wrong root type fails', () => {
  const v = new TruthVerifier();
  v.register('t', { type: 'object' });
  const r = v.verify('a string', 't');
  assert.equal(r.valid, false);
  assert.ok(r.errors[0].includes('Expected root type'));
});

test('verify: array type is detected correctly', () => {
  const v = new TruthVerifier();
  v.register('t', { type: 'array' });
  const r = v.verify([1, 2], 't');
  assert.equal(r.valid, true);
});

// ── verify — required fields ──────────────────────────────────────────────────

test('verify: all required fields present → valid', () => {
  const v = new TruthVerifier();
  v.register('t', {
    type: 'object',
    required: ['a', 'b'],
    properties: { a: { type: 'string' }, b: { type: 'number' } },
  });
  const r = v.verify({ a: 'hello', b: 42 }, 't');
  assert.equal(r.valid, true);
});

test('verify: missing required field → invalid', () => {
  const v = new TruthVerifier();
  v.register('t', { type: 'object', required: ['name'] });
  const r = v.verify({}, 't');
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.includes("'name'")));
});

// ── verify — property constraints ─────────────────────────────────────────────

test('verify: enum constraint passes on valid value', () => {
  const v = new TruthVerifier();
  v.register('t', {
    type: 'object',
    properties: { status: { type: 'string', enum: ['a', 'b', 'c'] } },
  });
  const r = v.verify({ status: 'b' }, 't');
  assert.equal(r.valid, true);
});

test('verify: enum constraint fails on invalid value', () => {
  const v = new TruthVerifier();
  v.register('t', {
    type: 'object',
    properties: { status: { type: 'string', enum: ['a', 'b'] } },
  });
  const r = v.verify({ status: 'z' }, 't');
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.includes('not in enum')));
});

test('verify: minimum constraint fails below floor', () => {
  const v = new TruthVerifier();
  v.register('t', {
    type: 'object',
    properties: { score: { type: 'number', minimum: 0 } },
  });
  const r = v.verify({ score: -1 }, 't');
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.includes('minimum')));
});

test('verify: maximum constraint fails above ceiling', () => {
  const v = new TruthVerifier();
  v.register('t', {
    type: 'object',
    properties: { pct: { type: 'number', maximum: 1 } },
  });
  const r = v.verify({ pct: 1.5 }, 't');
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.includes('maximum')));
});

test('verify: minLength constraint on string', () => {
  const v = new TruthVerifier();
  v.register('t', {
    type: 'object',
    properties: { name: { type: 'string', minLength: 3 } },
  });
  const r = v.verify({ name: 'ab' }, 't');
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.includes('minLength')));
});

test('verify: maxLength constraint on string', () => {
  const v = new TruthVerifier();
  v.register('t', {
    type: 'object',
    properties: { code: { type: 'string', maxLength: 5 } },
  });
  const r = v.verify({ code: 'toolong' }, 't');
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.includes('maxLength')));
});

// ── verify — confidence score ─────────────────────────────────────────────────

test('verify: confidence is 1.0 for fully valid object', () => {
  const v = new TruthVerifier();
  v.register('t', {
    type: 'object',
    required: ['x'],
    properties: { x: { type: 'string' } },
  });
  const r = v.verify({ x: 'hi' }, 't');
  assert.equal(r.confidence, 1.0);
});

test('verify: confidence is < 1.0 when some checks fail', () => {
  const v = new TruthVerifier();
  v.register('t', {
    type: 'object',
    required: ['a', 'b', 'c'],
  });
  // Only 'a' is present → 1 passed out of 4 checks (1 type + 3 required)
  const r = v.verify({ a: 1 }, 't');
  assert.ok(r.confidence < 1.0);
  assert.ok(r.confidence > 0.0);
});

test('verify: confidence is 1.0 for schema with no checks', () => {
  const v = new TruthVerifier();
  v.register('t', {});
  const r = v.verify('anything', 't');
  assert.equal(r.confidence, 1.0);
});

// ── check — threshold comparison ──────────────────────────────────────────────

test('check: passes when confidence meets threshold', () => {
  const v = new TruthVerifier();
  v.register('t', { type: 'object' }, 0.5);
  const { passed } = v.check({}, 't');
  assert.equal(passed, true);
});

test('check: fails when confidence below threshold', () => {
  const v = new TruthVerifier();
  v.register('t', {
    type: 'object',
    required: ['a', 'b', 'c', 'd'],
  }, 0.99);
  // Only 1 of 5 checks pass (type) — confidence 0.2
  const { passed } = v.check({}, 't');
  assert.equal(passed, false);
});

// ── createAgentVerifier ───────────────────────────────────────────────────────

test('createAgentVerifier: valid agent-report passes', () => {
  const v = createAgentVerifier();
  const report = {
    agentId: 'phase-0-task-0',
    task: 'Set up repository',
    status: 'ready',
    mcpTools: ['read_file', 'write_file'],
    nyquistEnabled: true,
    skipPermissions: false,
    message: 'Agent spawned.',
  };
  const { passed } = v.check(report, 'agent-report');
  assert.equal(passed, true);
});

test('createAgentVerifier: agent-report with invalid status fails', () => {
  const v = createAgentVerifier();
  const report = {
    agentId: 'phase-0-task-0',
    task: 'Set up repository',
    status: 'unknown-status',  // invalid enum value
    mcpTools: [],
  };
  const { passed } = v.check(report, 'agent-report');
  assert.equal(passed, false);
});

test('createAgentVerifier: wave-result threshold is 1.0', () => {
  const v = createAgentVerifier();
  assert.equal(v.getThreshold('wave-result'), 1.0);
});

test('createAgentVerifier: valid wave-result passes', () => {
  const v = createAgentVerifier();
  const wave = { waveIndex: 0, tasks: [] };
  const { passed } = v.check(wave, 'wave-result');
  assert.equal(passed, true);
});
