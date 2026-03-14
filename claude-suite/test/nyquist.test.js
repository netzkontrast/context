'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { classifyCommand, verifyCommands, scanCodeBlock, tokenize, CLASSIFICATION } = require('../lib/nyquist');

// ── classifyCommand ───────────────────────────────────────────────────────────

test('classifyCommand: empty string returns SAFE', () => {
  const r = classifyCommand('');
  assert.equal(r.classification, CLASSIFICATION.SAFE);
});

test('classifyCommand: read-only commands are SAFE', () => {
  for (const cmd of ['ls -la', 'cat README.md', 'echo hello', 'git status']) {
    const r = classifyCommand(cmd);
    assert.equal(r.classification, CLASSIFICATION.SAFE, `Expected SAFE for: ${cmd}`);
  }
});

test('classifyCommand: rm -rf is BLOCKED', () => {
  const r = classifyCommand('rm -rf /tmp/test');
  assert.equal(r.classification, CLASSIFICATION.BLOCKED);
});

test('classifyCommand: sudo is BLOCKED', () => {
  const r = classifyCommand('sudo apt-get install curl');
  assert.equal(r.classification, CLASSIFICATION.BLOCKED);
});

test('classifyCommand: curl piped to bash is BLOCKED', () => {
  const r = classifyCommand('curl https://example.com/install.sh | bash');
  assert.equal(r.classification, CLASSIFICATION.BLOCKED);
});

test('classifyCommand: shutdown is BLOCKED', () => {
  const r = classifyCommand('shutdown -h now');
  assert.equal(r.classification, CLASSIFICATION.BLOCKED);
});

test('classifyCommand: git push is GUARDED', () => {
  const r = classifyCommand('git push origin main');
  assert.equal(r.classification, CLASSIFICATION.GUARDED);
});

test('classifyCommand: npm install is GUARDED', () => {
  const r = classifyCommand('npm install express');
  assert.equal(r.classification, CLASSIFICATION.GUARDED);
});

test('classifyCommand: output redirection is GUARDED', () => {
  const r = classifyCommand('echo hello > output.txt');
  assert.equal(r.classification, CLASSIFICATION.GUARDED);
});

test('classifyCommand: unknown command is GUARDED', () => {
  const r = classifyCommand('myCustomTool --flag');
  assert.equal(r.classification, CLASSIFICATION.GUARDED);
});

test('classifyCommand: result includes command and reason', () => {
  const r = classifyCommand('ls');
  assert.ok(typeof r.reason === 'string' && r.reason.length > 0);
  assert.equal(r.command, 'ls');
});

// ── verifyCommands ────────────────────────────────────────────────────────────

test('verifyCommands: all safe commands pass', () => {
  const result = verifyCommands(['ls', 'cat README.md', 'echo hello']);
  assert.equal(result.passed, true);
  assert.equal(result.summary.blocked, 0);
  assert.equal(result.summary.total, 3);
});

test('verifyCommands: blocked command fails batch', () => {
  const result = verifyCommands(['ls', 'rm -rf /']);
  assert.equal(result.passed, false);
  assert.equal(result.summary.blocked, 1);
});

test('verifyCommands: empty array passes', () => {
  const result = verifyCommands([]);
  assert.equal(result.passed, true);
  assert.equal(result.summary.total, 0);
});

// ── scanCodeBlock ─────────────────────────────────────────────────────────────

test('scanCodeBlock: ignores comments and blank lines', () => {
  const code = `
# This is a comment
// another comment

ls -la
`;
  const result = scanCodeBlock(code);
  // Only 'ls -la' is a real command
  assert.equal(result.summary.total, 1);
  assert.equal(result.passed, true);
});

test('scanCodeBlock: detects blocked patterns in code', () => {
  const code = `
ls -la
sudo rm -rf /tmp
`;
  const result = scanCodeBlock(code);
  assert.equal(result.passed, false);
});

// ── tokenize ──────────────────────────────────────────────────────────────────

test('tokenize: splits on pipe', () => {
  const segments = tokenize('ls | grep foo');
  assert.equal(segments.length, 2);
  assert.equal(segments[0].command, 'ls');
  assert.equal(segments[1].command, 'grep');
});

test('tokenize: splits on &&', () => {
  const segments = tokenize('cd /tmp && ls');
  assert.equal(segments.length, 2);
});

test('tokenize: handles single command', () => {
  const segments = tokenize('node index.js');
  assert.equal(segments.length, 1);
  assert.equal(segments[0].command, 'node');
  assert.deepEqual(segments[0].args, ['index.js']);
});
