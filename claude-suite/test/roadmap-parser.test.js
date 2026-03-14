'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseRoadmap, buildDAG, formatPhasePlan, resolveRoadmapPath } = require('../lib/roadmap-parser');

// Helper: write a tmp ROADMAP.md and return its path
function writeTempRoadmap(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-test-'));
  const filePath = path.join(dir, 'ROADMAP.md');
  fs.writeFileSync(filePath, content, 'utf-8');
  return { dir, filePath };
}

const SAMPLE_ROADMAP = `
# My Project

## 0. Foundation
* [x] Set up repository
* [ ] Write README

## 1. Core Logic
* [ ] Implement parser
* [x] Write initial tests
* **Requirements Mapped**: [REQ-01, REQ-02]

## 2. Deployment
* [ ] Configure CI/CD
`;

// ── parseRoadmap ──────────────────────────────────────────────────────────────

test('parseRoadmap: throws for missing file', () => {
  assert.throws(() => parseRoadmap('/nonexistent/ROADMAP.md'), /not found/);
});

test('parseRoadmap: parses correct number of phases', () => {
  const { filePath, dir } = writeTempRoadmap(SAMPLE_ROADMAP);
  const phases = parseRoadmap(filePath);
  assert.equal(phases.length, 3);
  fs.rmSync(dir, { recursive: true });
});

test('parseRoadmap: phase indexes are correct', () => {
  const { filePath, dir } = writeTempRoadmap(SAMPLE_ROADMAP);
  const phases = parseRoadmap(filePath);
  assert.deepEqual(phases.map(p => p.index), [0, 1, 2]);
  fs.rmSync(dir, { recursive: true });
});

test('parseRoadmap: phase names are correct', () => {
  const { filePath, dir } = writeTempRoadmap(SAMPLE_ROADMAP);
  const phases = parseRoadmap(filePath);
  assert.equal(phases[0].name, 'Foundation');
  assert.equal(phases[1].name, 'Core Logic');
  assert.equal(phases[2].name, 'Deployment');
  fs.rmSync(dir, { recursive: true });
});

test('parseRoadmap: tasks parsed with done flag', () => {
  const { filePath, dir } = writeTempRoadmap(SAMPLE_ROADMAP);
  const phases = parseRoadmap(filePath);
  assert.equal(phases[0].tasks.length, 2);
  assert.equal(phases[0].tasks[0].done, true);
  assert.equal(phases[0].tasks[1].done, false);
  fs.rmSync(dir, { recursive: true });
});

test('parseRoadmap: requirements mapped correctly', () => {
  const { filePath, dir } = writeTempRoadmap(SAMPLE_ROADMAP);
  const phases = parseRoadmap(filePath);
  assert.deepEqual(phases[1].requirements, ['REQ-01', 'REQ-02']);
  fs.rmSync(dir, { recursive: true });
});

test('parseRoadmap: phase with no requirements has empty array', () => {
  const { filePath, dir } = writeTempRoadmap(SAMPLE_ROADMAP);
  const phases = parseRoadmap(filePath);
  assert.deepEqual(phases[0].requirements, []);
  fs.rmSync(dir, { recursive: true });
});

// ── buildDAG ──────────────────────────────────────────────────────────────────

test('buildDAG: creates phase and task nodes', () => {
  const { filePath, dir } = writeTempRoadmap(SAMPLE_ROADMAP);
  const phases = parseRoadmap(filePath);
  const dag = buildDAG(phases);

  const phaseNodes = dag.nodes.filter(n => n.type === 'phase');
  const taskNodes = dag.nodes.filter(n => n.type === 'task');

  assert.equal(phaseNodes.length, 3);
  assert.equal(taskNodes.length, 5); // 2 + 3 + 1
  fs.rmSync(dir, { recursive: true });
});

test('buildDAG: sequential edges between phases', () => {
  const { filePath, dir } = writeTempRoadmap(SAMPLE_ROADMAP);
  const phases = parseRoadmap(filePath);
  const dag = buildDAG(phases);

  const phaseEdge = dag.edges.find(e => e.from === 'phase-0' && e.to === 'phase-1');
  assert.ok(phaseEdge, 'Edge from phase-0 to phase-1 should exist');
  fs.rmSync(dir, { recursive: true });
});

test('buildDAG: task nodes carry done flag', () => {
  const { filePath, dir } = writeTempRoadmap(SAMPLE_ROADMAP);
  const phases = parseRoadmap(filePath);
  const dag = buildDAG(phases);

  const doneTask = dag.nodes.find(n => n.type === 'task' && n.label === 'Set up repository');
  assert.ok(doneTask);
  assert.equal(doneTask.done, true);
  fs.rmSync(dir, { recursive: true });
});

// ── formatPhasePlan ───────────────────────────────────────────────────────────

test('formatPhasePlan: returns null for unknown phase', () => {
  const { filePath, dir } = writeTempRoadmap(SAMPLE_ROADMAP);
  const phases = parseRoadmap(filePath);
  assert.equal(formatPhasePlan(phases, 99), null);
  fs.rmSync(dir, { recursive: true });
});

test('formatPhasePlan: contains phase name', () => {
  const { filePath, dir } = writeTempRoadmap(SAMPLE_ROADMAP);
  const phases = parseRoadmap(filePath);
  const plan = formatPhasePlan(phases, 1);
  assert.ok(plan.includes('Core Logic'));
  fs.rmSync(dir, { recursive: true });
});

test('formatPhasePlan: lists pending tasks', () => {
  const { filePath, dir } = writeTempRoadmap(SAMPLE_ROADMAP);
  const phases = parseRoadmap(filePath);
  const plan = formatPhasePlan(phases, 1);
  assert.ok(plan.includes('Implement parser'));
  fs.rmSync(dir, { recursive: true });
});

test('formatPhasePlan: marks complete when all tasks done', () => {
  const allDone = `## 3. Complete\n* [x] Task A\n* [x] Task B\n`;
  const { filePath, dir } = writeTempRoadmap(allDone);
  const phases = parseRoadmap(filePath);
  const plan = formatPhasePlan(phases, 3);
  assert.ok(plan.includes('complete'));
  fs.rmSync(dir, { recursive: true });
});

// ── resolveRoadmapPath ────────────────────────────────────────────────────────

test('resolveRoadmapPath: returns null when no roadmap found', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-test-'));
  assert.equal(resolveRoadmapPath(dir), null);
  fs.rmSync(dir, { recursive: true });
});

test('resolveRoadmapPath: finds ROADMAP.md in cwd', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-test-'));
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), '');
  assert.equal(resolveRoadmapPath(dir), path.join(dir, 'ROADMAP.md'));
  fs.rmSync(dir, { recursive: true });
});

test('resolveRoadmapPath: prefers .suite/ROADMAP.md over root', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-test-'));
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), '');
  const suiteDir = path.join(dir, '.suite');
  fs.mkdirSync(suiteDir);
  fs.writeFileSync(path.join(suiteDir, 'ROADMAP.md'), '');
  assert.equal(resolveRoadmapPath(dir), path.join(suiteDir, 'ROADMAP.md'));
  fs.rmSync(dir, { recursive: true });
});
