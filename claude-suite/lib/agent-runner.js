#!/usr/bin/env node
'use strict';

/**
 * Agent Runner — executed as a child process by the Orchestrator.
 *
 * Receives sterile context via environment variables:
 *   SUITE_TASK_ID          — Unique task identifier
 *   SUITE_TASK_DESCRIPTION — Human-readable task description
 *   SUITE_CONTEXT          — JSON payload with constraints and requirements
 *   SUITE_SKIP_PERMISSIONS — '1' to bypass confirmation prompts
 *   SUITE_BASE_PATH        — Project root for MCP tool sandboxing
 *
 * The agent has access to:
 *   - MCP file system tools (sandboxed to project root)
 *   - Nyquist Layer verification for any shell commands
 */

const { createFileSystemRegistry } = require('./mcp-registry');
const { classifyCommand, CLASSIFICATION } = require('./nyquist');

const taskId = process.env.SUITE_TASK_ID;
const taskDescription = process.env.SUITE_TASK_DESCRIPTION;
const rawContext = process.env.SUITE_CONTEXT;
const skipPermissions = process.env.SUITE_SKIP_PERMISSIONS === '1';
const basePath = process.env.SUITE_BASE_PATH || process.cwd();

if (!taskId || !taskDescription) {
  console.error('Missing required environment: SUITE_TASK_ID, SUITE_TASK_DESCRIPTION');
  process.exit(1);
}

let context;
try {
  context = JSON.parse(rawContext || '{}');
} catch {
  console.error('Invalid SUITE_CONTEXT JSON');
  process.exit(1);
}

// Initialize MCP tools scoped to the project sandbox
const mcpTools = createFileSystemRegistry(basePath);

// Report what this agent received and its capabilities
const report = {
  agentId: taskId,
  task: taskDescription,
  hasConstraints: context.constraints !== null,
  hasRequirements: context.requirements !== null,
  mcpTools: mcpTools.list().map(t => t.name),
  nyquistEnabled: true,
  skipPermissions,
  status: 'ready',
  message: `Agent for "${taskDescription}" spawned with sterile context, ${mcpTools.list().length} MCP tools, and Nyquist verification.`,
};

console.log(JSON.stringify(report));
process.exit(0);
