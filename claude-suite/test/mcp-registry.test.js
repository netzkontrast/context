'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { MCPRegistry, createFileSystemRegistry } = require('../lib/mcp-registry');

// ── MCPRegistry core ──────────────────────────────────────────────────────────

test('MCPRegistry: register and list tools', () => {
  const registry = new MCPRegistry();
  registry.register({
    name: 'test_tool',
    description: 'A test tool',
    handler: () => 'ok',
  });

  const tools = registry.list();
  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, 'test_tool');
  assert.equal(tools[0].description, 'A test tool');
});

test('MCPRegistry: register throws without name', () => {
  const registry = new MCPRegistry();
  assert.throws(() => registry.register({ handler: () => {} }), /name/);
});

test('MCPRegistry: register throws without handler', () => {
  const registry = new MCPRegistry();
  assert.throws(() => registry.register({ name: 'no_handler' }), /handler/);
});

test('MCPRegistry: get returns null for unknown tool', () => {
  const registry = new MCPRegistry();
  assert.equal(registry.get('nope'), null);
});

test('MCPRegistry: invoke calls handler with params', async () => {
  const registry = new MCPRegistry();
  registry.register({
    name: 'add',
    handler: ({ a, b }) => a + b,
  });

  const result = await registry.invoke('add', { a: 2, b: 3 });
  assert.equal(result, 5);
});

test('MCPRegistry: invoke throws for unknown tool', async () => {
  const registry = new MCPRegistry();
  await assert.rejects(() => registry.invoke('unknown'), /not found/);
});

test('MCPRegistry: readOnly defaults to false', () => {
  const registry = new MCPRegistry();
  registry.register({ name: 'x', handler: () => {} });
  assert.equal(registry.get('x').readOnly, false);
});

// ── createFileSystemRegistry ──────────────────────────────────────────────────

test('createFileSystemRegistry: lists 6 tools', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-test-'));
  const registry = createFileSystemRegistry(dir);
  assert.equal(registry.list().length, 6);
  fs.rmSync(dir, { recursive: true });
});

test('createFileSystemRegistry: read_file returns content', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-test-'));
  const filePath = path.join(dir, 'hello.txt');
  fs.writeFileSync(filePath, 'hello world');

  const registry = createFileSystemRegistry(dir);
  const content = await registry.invoke('read_file', { path: 'hello.txt' });
  assert.equal(content, 'hello world');
  fs.rmSync(dir, { recursive: true });
});

test('createFileSystemRegistry: read_file throws for missing file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-test-'));
  const registry = createFileSystemRegistry(dir);
  await assert.rejects(() => registry.invoke('read_file', { path: 'nope.txt' }), /not found/);
  fs.rmSync(dir, { recursive: true });
});

test('createFileSystemRegistry: write_file then read_file round-trips', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-test-'));
  const registry = createFileSystemRegistry(dir);

  await registry.invoke('write_file', { path: 'out.txt', content: 'data' });
  const content = await registry.invoke('read_file', { path: 'out.txt' });
  assert.equal(content, 'data');
  fs.rmSync(dir, { recursive: true });
});

test('createFileSystemRegistry: file_exists returns true/false', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-test-'));
  const registry = createFileSystemRegistry(dir);

  let r = await registry.invoke('file_exists', { path: 'absent.txt' });
  assert.equal(r.exists, false);

  fs.writeFileSync(path.join(dir, 'present.txt'), '');
  r = await registry.invoke('file_exists', { path: 'present.txt' });
  assert.equal(r.exists, true);
  fs.rmSync(dir, { recursive: true });
});

test('createFileSystemRegistry: list_directory returns entries', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-test-'));
  fs.writeFileSync(path.join(dir, 'a.txt'), '');
  fs.mkdirSync(path.join(dir, 'subdir'));

  const registry = createFileSystemRegistry(dir);
  const entries = await registry.invoke('list_directory', { path: '.' });
  const names = entries.map(e => e.name);
  assert.ok(names.includes('a.txt'));
  assert.ok(names.includes('subdir'));
  fs.rmSync(dir, { recursive: true });
});

test('createFileSystemRegistry: append_file appends content', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-test-'));
  const registry = createFileSystemRegistry(dir);

  await registry.invoke('write_file', { path: 'log.txt', content: 'line1\n' });
  await registry.invoke('append_file', { path: 'log.txt', content: 'line2\n' });
  const content = fs.readFileSync(path.join(dir, 'log.txt'), 'utf-8');
  assert.equal(content, 'line1\nline2\n');
  fs.rmSync(dir, { recursive: true });
});

test('createFileSystemRegistry: delete_file removes the file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-test-'));
  const target = path.join(dir, 'del.txt');
  fs.writeFileSync(target, 'bye');

  const registry = createFileSystemRegistry(dir);
  await registry.invoke('delete_file', { path: 'del.txt' });
  assert.equal(fs.existsSync(target), false);
  fs.rmSync(dir, { recursive: true });
});

test('createFileSystemRegistry: path escape is blocked', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-test-'));
  const registry = createFileSystemRegistry(dir);
  await assert.rejects(
    () => registry.invoke('read_file', { path: '../../etc/passwd' }),
    /escapes sandbox/,
  );
  fs.rmSync(dir, { recursive: true });
});
