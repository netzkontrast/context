'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('child_process');
const path = require('path');

const RUNNER_PATH = path.join(__dirname, '..', 'lib', 'agent-runner.js');

// Helper: run agent-runner with custom env vars
function runAgent(envOverrides = {}) {
  return new Promise((resolve) => {
    const env = {
      ...process.env,
      SUITE_TASK_ID: undefined,
      SUITE_TASK_DESCRIPTION: undefined,
      SUITE_CONTEXT: undefined,
      SUITE_SKIP_PERMISSIONS: undefined,
      SUITE_BASE_PATH: undefined,
      ...envOverrides,
    };
    // Remove undefined keys so they don't get passed as the string "undefined"
    for (const key of Object.keys(env)) {
      if (env[key] === undefined) delete env[key];
    }
    execFile(process.execPath, [RUNNER_PATH], { env, timeout: 10000 }, (err, stdout, stderr) => {
      resolve({
        exitCode: err ? err.code : 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
}

// ── Environment variable validation ──────────────────────────────────────────

test('agent-runner: exits with code 1 when SUITE_TASK_ID is missing', async () => {
  const result = await runAgent({
    SUITE_TASK_DESCRIPTION: 'Test task',
    SUITE_CONTEXT: '{}',
  });
  assert.equal(result.exitCode, 1);
  assert.ok(result.stderr.includes('SUITE_TASK_ID'));
});

test('agent-runner: exits with code 1 when SUITE_TASK_DESCRIPTION is missing', async () => {
  const result = await runAgent({
    SUITE_TASK_ID: 'task-1',
    SUITE_CONTEXT: '{}',
  });
  assert.equal(result.exitCode, 1);
  assert.ok(result.stderr.includes('SUITE_TASK_DESCRIPTION'));
});

test('agent-runner: exits with code 1 when SUITE_CONTEXT is invalid JSON', async () => {
  const result = await runAgent({
    SUITE_TASK_ID: 'task-1',
    SUITE_TASK_DESCRIPTION: 'Test task',
    SUITE_CONTEXT: 'not valid json{{{',
  });
  assert.equal(result.exitCode, 1);
  assert.ok(result.stderr.includes('SUITE_CONTEXT'));
});

test('agent-runner: exits with code 0 and outputs JSON when all env vars set', async () => {
  const result = await runAgent({
    SUITE_TASK_ID: 'task-1',
    SUITE_TASK_DESCRIPTION: 'Build feature',
    SUITE_CONTEXT: JSON.stringify({ constraints: null, requirements: null }),
    SUITE_BASE_PATH: __dirname,
  });
  assert.equal(result.exitCode, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(typeof output, 'object');
});

// ── Output validation ────────────────────────────────────────────────────────

test('agent-runner: output contains agentId matching SUITE_TASK_ID', async () => {
  const result = await runAgent({
    SUITE_TASK_ID: 'my-task-42',
    SUITE_TASK_DESCRIPTION: 'Do stuff',
    SUITE_CONTEXT: '{}',
    SUITE_BASE_PATH: __dirname,
  });
  const output = JSON.parse(result.stdout);
  assert.equal(output.agentId, 'my-task-42');
});

test('agent-runner: output contains task matching SUITE_TASK_DESCRIPTION', async () => {
  const result = await runAgent({
    SUITE_TASK_ID: 'task-1',
    SUITE_TASK_DESCRIPTION: 'Build the parser',
    SUITE_CONTEXT: '{}',
    SUITE_BASE_PATH: __dirname,
  });
  const output = JSON.parse(result.stdout);
  assert.equal(output.task, 'Build the parser');
});

test('agent-runner: hasConstraints reflects context.constraints', async () => {
  const withConstraints = await runAgent({
    SUITE_TASK_ID: 'task-1',
    SUITE_TASK_DESCRIPTION: 'Test',
    SUITE_CONTEXT: JSON.stringify({ constraints: '# Rules', requirements: null }),
    SUITE_BASE_PATH: __dirname,
  });
  const withOutput = JSON.parse(withConstraints.stdout);
  assert.equal(withOutput.hasConstraints, true);

  const withoutConstraints = await runAgent({
    SUITE_TASK_ID: 'task-1',
    SUITE_TASK_DESCRIPTION: 'Test',
    SUITE_CONTEXT: JSON.stringify({ constraints: null, requirements: null }),
    SUITE_BASE_PATH: __dirname,
  });
  const withoutOutput = JSON.parse(withoutConstraints.stdout);
  assert.equal(withoutOutput.hasConstraints, false);
});

test('agent-runner: mcpTools is an array of strings', async () => {
  const result = await runAgent({
    SUITE_TASK_ID: 'task-1',
    SUITE_TASK_DESCRIPTION: 'Test',
    SUITE_CONTEXT: '{}',
    SUITE_BASE_PATH: __dirname,
  });
  const output = JSON.parse(result.stdout);
  assert.ok(Array.isArray(output.mcpTools));
  assert.ok(output.mcpTools.length > 0, 'Expected at least one MCP tool');
  assert.ok(output.mcpTools.every(t => typeof t === 'string'));
});

test('agent-runner: status is ready and nyquistEnabled is true', async () => {
  const result = await runAgent({
    SUITE_TASK_ID: 'task-1',
    SUITE_TASK_DESCRIPTION: 'Test',
    SUITE_CONTEXT: '{}',
    SUITE_BASE_PATH: __dirname,
  });
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, 'ready');
  assert.equal(output.nyquistEnabled, true);
});

test('agent-runner: skipPermissions reflects SUITE_SKIP_PERMISSIONS env', async () => {
  const withSkip = await runAgent({
    SUITE_TASK_ID: 'task-1',
    SUITE_TASK_DESCRIPTION: 'Test',
    SUITE_CONTEXT: '{}',
    SUITE_BASE_PATH: __dirname,
    SUITE_SKIP_PERMISSIONS: '1',
  });
  assert.equal(JSON.parse(withSkip.stdout).skipPermissions, true);

  const withoutSkip = await runAgent({
    SUITE_TASK_ID: 'task-1',
    SUITE_TASK_DESCRIPTION: 'Test',
    SUITE_CONTEXT: '{}',
    SUITE_BASE_PATH: __dirname,
    SUITE_SKIP_PERMISSIONS: '0',
  });
  assert.equal(JSON.parse(withoutSkip.stdout).skipPermissions, false);
});
