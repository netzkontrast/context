'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SkillLoader, discoverSkills, parseSkillManifest, loadSkill } = require('../lib/skill-loader');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'skill-loader-test-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function makeSkillDir(baseDir, name, content) {
  const skillDir = path.join(baseDir, `.claude-skills-${name}`);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf-8');
  return skillDir;
}

const SAMPLE_SKILL_MD = `---
name: dev
description: >
  Full-lifecycle development orchestrator.
allowed-tools:
  - Read
  - Write
  - Edit
metadata:
  version: "1.0.0"
  author: "claude-suite"
---

# Dev Skill Body

Some body content here.
`;

const MINIMAL_SKILL_MD = `---
name: minimal
description: A minimal skill.
allowed-tools:
  - Read
---

Body text.
`;

// ── parseSkillManifest ────────────────────────────────────────────────────────

test('parseSkillManifest: parses name correctly', () => {
  const result = parseSkillManifest(SAMPLE_SKILL_MD);
  assert.equal(result.name, 'dev');
});

test('parseSkillManifest: parses description block scalar', () => {
  const result = parseSkillManifest(SAMPLE_SKILL_MD);
  assert.ok(result.description.includes('Full-lifecycle'));
});

test('parseSkillManifest: parses allowed-tools list', () => {
  const result = parseSkillManifest(SAMPLE_SKILL_MD);
  assert.deepEqual(result.allowedTools, ['Read', 'Write', 'Edit']);
});

test('parseSkillManifest: parses metadata sub-keys', () => {
  const result = parseSkillManifest(SAMPLE_SKILL_MD);
  assert.equal(result.metadata.version, '1.0.0');
  assert.equal(result.metadata.author, 'claude-suite');
});

test('parseSkillManifest: extracts body after closing ---', () => {
  const result = parseSkillManifest(SAMPLE_SKILL_MD);
  assert.ok(result.body.includes('Dev Skill Body'));
});

test('parseSkillManifest: handles minimal skill without metadata', () => {
  const result = parseSkillManifest(MINIMAL_SKILL_MD);
  assert.equal(result.name, 'minimal');
  assert.deepEqual(result.allowedTools, ['Read']);
  assert.deepEqual(result.metadata, {});
});

test('parseSkillManifest: returns defaults for empty string', () => {
  const result = parseSkillManifest('');
  assert.equal(result.name, '');
  assert.deepEqual(result.allowedTools, []);
  assert.equal(result.body, '');
});

test('parseSkillManifest: returns defaults for non-string input', () => {
  const result = parseSkillManifest(null);
  assert.equal(result.name, '');
  assert.deepEqual(result.allowedTools, []);
});

test('parseSkillManifest: handles content without front-matter', () => {
  const result = parseSkillManifest('Just some markdown without front matter.');
  assert.equal(result.name, '');
  assert.ok(result.body.includes('Just some markdown'));
});

// ── discoverSkills ────────────────────────────────────────────────────────────

test('discoverSkills: returns empty array for empty directory', () => {
  const tmp = makeTmpDir();
  try {
    const found = discoverSkills(tmp);
    assert.deepEqual(found, []);
  } finally {
    cleanup(tmp);
  }
});

test('discoverSkills: finds a single skill directory', () => {
  const tmp = makeTmpDir();
  try {
    makeSkillDir(tmp, 'dev', SAMPLE_SKILL_MD);
    const found = discoverSkills(tmp);
    assert.equal(found.length, 1);
    assert.ok(found[0].endsWith('SKILL.md'));
  } finally {
    cleanup(tmp);
  }
});

test('discoverSkills: finds multiple skill directories', () => {
  const tmp = makeTmpDir();
  try {
    makeSkillDir(tmp, 'dev', SAMPLE_SKILL_MD);
    makeSkillDir(tmp, 'audit', MINIMAL_SKILL_MD);
    const found = discoverSkills(tmp);
    assert.equal(found.length, 2);
  } finally {
    cleanup(tmp);
  }
});

test('discoverSkills: ignores non-.claude-skills- directories', () => {
  const tmp = makeTmpDir();
  try {
    fs.mkdirSync(path.join(tmp, 'some-other-dir'));
    fs.writeFileSync(path.join(tmp, 'some-other-dir', 'SKILL.md'), SAMPLE_SKILL_MD);
    const found = discoverSkills(tmp);
    assert.equal(found.length, 0);
  } finally {
    cleanup(tmp);
  }
});

test('discoverSkills: ignores .claude-skills- dirs without SKILL.md', () => {
  const tmp = makeTmpDir();
  try {
    fs.mkdirSync(path.join(tmp, '.claude-skills-empty'));
    const found = discoverSkills(tmp);
    assert.equal(found.length, 0);
  } finally {
    cleanup(tmp);
  }
});

test('discoverSkills: returns empty array for non-existent directory', () => {
  const found = discoverSkills('/nonexistent/path/that/does/not/exist');
  assert.deepEqual(found, []);
});

test('discoverSkills: returns empty array for non-string input', () => {
  const found = discoverSkills(null);
  assert.deepEqual(found, []);
});

// ── loadSkill ─────────────────────────────────────────────────────────────────

test('loadSkill: returns manifest and dir from a SKILL.md path', () => {
  const tmp = makeTmpDir();
  try {
    const skillDir = makeSkillDir(tmp, 'dev', SAMPLE_SKILL_MD);
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    const skill = loadSkill(skillMdPath);
    assert.equal(skill.manifest.name, 'dev');
    assert.equal(skill.dir, skillDir);
    assert.ok(Array.isArray(skill.scripts));
  } finally {
    cleanup(tmp);
  }
});

test('loadSkill: scripts is empty when no scripts/ dir', () => {
  const tmp = makeTmpDir();
  try {
    const skillDir = makeSkillDir(tmp, 'dev', SAMPLE_SKILL_MD);
    const skill = loadSkill(path.join(skillDir, 'SKILL.md'));
    assert.deepEqual(skill.scripts, []);
  } finally {
    cleanup(tmp);
  }
});

test('loadSkill: lists scripts when scripts/ dir exists', () => {
  const tmp = makeTmpDir();
  try {
    const skillDir = makeSkillDir(tmp, 'dev', SAMPLE_SKILL_MD);
    const scriptsDir = path.join(skillDir, 'scripts');
    fs.mkdirSync(scriptsDir);
    fs.writeFileSync(path.join(scriptsDir, 'build.sh'), '#!/bin/sh\necho ok');
    const skill = loadSkill(path.join(skillDir, 'SKILL.md'));
    assert.ok(skill.scripts.includes('build.sh'));
  } finally {
    cleanup(tmp);
  }
});

// ── SkillLoader class ─────────────────────────────────────────────────────────

test('SkillLoader: list() returns empty array before discover()', () => {
  const tmp = makeTmpDir();
  try {
    const loader = new SkillLoader(tmp);
    assert.deepEqual(loader.list(), []);
  } finally {
    cleanup(tmp);
  }
});

test('SkillLoader: discover() returns count of found skills', () => {
  const tmp = makeTmpDir();
  try {
    makeSkillDir(tmp, 'dev', SAMPLE_SKILL_MD);
    makeSkillDir(tmp, 'audit', MINIMAL_SKILL_MD);
    const loader = new SkillLoader(tmp);
    const count = loader.discover();
    assert.equal(count, 2);
  } finally {
    cleanup(tmp);
  }
});

test('SkillLoader: list() returns loaded skills after discover()', () => {
  const tmp = makeTmpDir();
  try {
    makeSkillDir(tmp, 'dev', SAMPLE_SKILL_MD);
    const loader = new SkillLoader(tmp);
    loader.discover();
    const skills = loader.list();
    assert.equal(skills.length, 1);
    assert.equal(skills[0].name, 'dev');
    assert.ok(skills[0].manifest);
    assert.ok(Array.isArray(skills[0].scripts));
  } finally {
    cleanup(tmp);
  }
});

test('SkillLoader: get() returns skill by name', () => {
  const tmp = makeTmpDir();
  try {
    makeSkillDir(tmp, 'dev', SAMPLE_SKILL_MD);
    const loader = new SkillLoader(tmp);
    loader.discover();
    const skill = loader.get('dev');
    assert.ok(skill);
    assert.equal(skill.manifest.name, 'dev');
  } finally {
    cleanup(tmp);
  }
});

test('SkillLoader: get() returns undefined for unknown skill', () => {
  const tmp = makeTmpDir();
  try {
    const loader = new SkillLoader(tmp);
    loader.discover();
    assert.equal(loader.get('nonexistent'), undefined);
  } finally {
    cleanup(tmp);
  }
});

test('SkillLoader: discover() clears previous results on re-run', () => {
  const tmp = makeTmpDir();
  try {
    makeSkillDir(tmp, 'dev', SAMPLE_SKILL_MD);
    const loader = new SkillLoader(tmp);
    loader.discover();
    assert.equal(loader.list().length, 1);

    // Remove the skill dir and re-discover
    fs.rmSync(path.join(tmp, '.claude-skills-dev'), { recursive: true });
    loader.discover();
    assert.equal(loader.list().length, 0);
  } finally {
    cleanup(tmp);
  }
});

test('SkillLoader: uses process.cwd() as default baseDir', () => {
  const loader = new SkillLoader();
  assert.equal(loader.baseDir, process.cwd());
});

test('SkillLoader: falls back to dirname when SKILL.md name is empty', () => {
  const tmp = makeTmpDir();
  try {
    // Write a SKILL.md with no name field
    const skillDir = path.join(tmp, '.claude-skills-myplugin');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `---\ndescription: No name field.\n---\nBody.\n`);
    const loader = new SkillLoader(tmp);
    loader.discover();
    const skills = loader.list();
    assert.equal(skills.length, 1);
    // Falls back to dirname extraction: 'myplugin'
    assert.equal(skills[0].name, 'myplugin');
  } finally {
    cleanup(tmp);
  }
});
