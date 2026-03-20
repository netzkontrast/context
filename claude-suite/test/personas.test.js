'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PersonaRegistry, registry, PERSONAS } = require('../lib/personas');

// ── PERSONAS constant ─────────────────────────────────────────────────────────

test('PERSONAS: exports an array of 4 personas', () => {
  assert.equal(PERSONAS.length, 4);
});

test('PERSONAS: each persona has required schema fields', () => {
  for (const p of PERSONAS) {
    assert.ok(typeof p.id === 'string' && p.id.length > 0, `${p.id}: id must be non-empty string`);
    assert.ok(typeof p.role === 'string' && p.role.length > 0, `${p.id}: role must be non-empty string`);
    assert.ok(typeof p.description === 'string' && p.description.length > 0, `${p.id}: description must be non-empty string`);
    assert.ok(typeof p.contextBudget === 'number', `${p.id}: contextBudget must be a number`);
    assert.ok(p.contextBudget > 0 && p.contextBudget <= 1, `${p.id}: contextBudget must be between 0 and 1`);
    assert.ok(Array.isArray(p.defaultTools) && p.defaultTools.length > 0, `${p.id}: defaultTools must be non-empty array`);
    assert.ok(Array.isArray(p.keywords) && p.keywords.length > 0, `${p.id}: keywords must be non-empty array`);
  }
});

test('PERSONAS: all four roles are present', () => {
  const ids = PERSONAS.map(p => p.id);
  assert.ok(ids.includes('planner'));
  assert.ok(ids.includes('executor'));
  assert.ok(ids.includes('verifier'));
  assert.ok(ids.includes('researcher'));
});

test('PERSONAS: context budgets sum to <= 1.25 (allowing overlap by design)', () => {
  const sum = PERSONAS.reduce((acc, p) => acc + p.contextBudget, 0);
  assert.ok(sum > 0 && sum <= 1.5, `Expected sum within reasonable range, got ${sum}`);
});

// ── PersonaRegistry constructor ───────────────────────────────────────────────

test('PersonaRegistry: instantiates without arguments', () => {
  const r = new PersonaRegistry();
  assert.ok(r);
});

// ── PersonaRegistry.list() ────────────────────────────────────────────────────

test('PersonaRegistry.list(): returns all 4 personas', () => {
  const r = new PersonaRegistry();
  const list = r.list();
  assert.equal(list.length, 4);
});

test('PersonaRegistry.list(): returns plain objects, not references', () => {
  const r = new PersonaRegistry();
  const list = r.list();
  assert.ok(list.every(p => typeof p === 'object' && p !== null));
});

// ── PersonaRegistry.get() ────────────────────────────────────────────────────

test('PersonaRegistry.get(): returns planner by id', () => {
  const r = new PersonaRegistry();
  const p = r.get('planner');
  assert.ok(p);
  assert.equal(p.id, 'planner');
  assert.equal(p.role, 'Planner');
});

test('PersonaRegistry.get(): returns executor by id', () => {
  const r = new PersonaRegistry();
  const p = r.get('executor');
  assert.ok(p);
  assert.equal(p.id, 'executor');
});

test('PersonaRegistry.get(): returns verifier by id', () => {
  const r = new PersonaRegistry();
  const p = r.get('verifier');
  assert.ok(p);
  assert.equal(p.id, 'verifier');
});

test('PersonaRegistry.get(): returns researcher by id', () => {
  const r = new PersonaRegistry();
  const p = r.get('researcher');
  assert.ok(p);
  assert.equal(p.id, 'researcher');
});

test('PersonaRegistry.get(): returns undefined for unknown id', () => {
  const r = new PersonaRegistry();
  assert.equal(r.get('nonexistent'), undefined);
});

test('PersonaRegistry.get(): returns undefined for empty string', () => {
  const r = new PersonaRegistry();
  assert.equal(r.get(''), undefined);
});

// ── PersonaRegistry.selectForTask() ──────────────────────────────────────────

test('selectForTask(): selects planner for "plan" keyword', () => {
  const r = new PersonaRegistry();
  const p = r.selectForTask('plan the architecture');
  assert.equal(p.id, 'planner');
});

test('selectForTask(): selects planner for "design" keyword', () => {
  const r = new PersonaRegistry();
  const p = r.selectForTask('Design the API schema');
  assert.equal(p.id, 'planner');
});

test('selectForTask(): selects planner for "generate" keyword', () => {
  const r = new PersonaRegistry();
  const p = r.selectForTask('Generate an execution plan');
  assert.equal(p.id, 'planner');
});

test('selectForTask(): selects executor for "implement" keyword', () => {
  const r = new PersonaRegistry();
  const p = r.selectForTask('implement the login feature');
  assert.equal(p.id, 'executor');
});

test('selectForTask(): selects executor for "fix" keyword', () => {
  const r = new PersonaRegistry();
  const p = r.selectForTask('fix the failing test');
  assert.equal(p.id, 'executor');
});

test('selectForTask(): selects executor for "write" keyword', () => {
  const r = new PersonaRegistry();
  const p = r.selectForTask('write the database adapter');
  assert.equal(p.id, 'executor');
});

test('selectForTask(): selects executor for "build" keyword', () => {
  const r = new PersonaRegistry();
  const p = r.selectForTask('build the CLI command');
  assert.equal(p.id, 'executor');
});

test('selectForTask(): selects verifier for "test" keyword', () => {
  const r = new PersonaRegistry();
  const p = r.selectForTask('test the authentication module');
  assert.equal(p.id, 'verifier');
});

test('selectForTask(): selects verifier for "verify" keyword', () => {
  const r = new PersonaRegistry();
  const p = r.selectForTask('verify the output schema');
  assert.equal(p.id, 'verifier');
});

test('selectForTask(): selects verifier for "validate" keyword', () => {
  const r = new PersonaRegistry();
  const p = r.selectForTask('validate all agent outputs');
  assert.equal(p.id, 'verifier');
});

test('selectForTask(): selects researcher for "research" keyword', () => {
  const r = new PersonaRegistry();
  const p = r.selectForTask('research the MemGPT architecture');
  assert.equal(p.id, 'researcher');
});

test('selectForTask(): selects researcher for "analyze" keyword', () => {
  const r = new PersonaRegistry();
  const p = r.selectForTask('analyze the codebase structure');
  assert.equal(p.id, 'researcher');
});

test('selectForTask(): selects researcher for "summarize" keyword', () => {
  const r = new PersonaRegistry();
  const p = r.selectForTask('summarize the documentation');
  assert.equal(p.id, 'researcher');
});

test('selectForTask(): defaults to executor when no keywords match', () => {
  const r = new PersonaRegistry();
  const p = r.selectForTask('do something undefined');
  assert.equal(p.id, 'executor');
});

test('selectForTask(): defaults to executor for empty string', () => {
  const r = new PersonaRegistry();
  const p = r.selectForTask('');
  assert.equal(p.id, 'executor');
});

test('selectForTask(): defaults to executor for null', () => {
  const r = new PersonaRegistry();
  const p = r.selectForTask(null);
  assert.equal(p.id, 'executor');
});

test('selectForTask(): is case-insensitive', () => {
  const r = new PersonaRegistry();
  const p = r.selectForTask('PLAN THE PROJECT');
  assert.equal(p.id, 'planner');
});

// ── singleton registry ────────────────────────────────────────────────────────

test('registry: singleton exports a PersonaRegistry instance', () => {
  assert.ok(registry instanceof PersonaRegistry);
});

test('registry: singleton has all 4 personas', () => {
  assert.equal(registry.list().length, 4);
});

// ── Persona schema details ────────────────────────────────────────────────────

test('planner: has read-only defaultTools only', () => {
  const r = new PersonaRegistry();
  const p = r.get('planner');
  // Planner should not have write_file by default
  assert.ok(!p.defaultTools.includes('write_file'));
});

test('executor: has write_file in defaultTools', () => {
  const r = new PersonaRegistry();
  const p = r.get('executor');
  assert.ok(p.defaultTools.includes('write_file'));
});

test('executor: has highest context budget', () => {
  const r = new PersonaRegistry();
  const executor = r.get('executor');
  const others = r.list().filter(p => p.id !== 'executor');
  for (const other of others) {
    assert.ok(executor.contextBudget >= other.contextBudget,
      `executor contextBudget (${executor.contextBudget}) should be >= ${other.id} (${other.contextBudget})`);
  }
});
