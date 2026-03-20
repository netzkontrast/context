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
const { registry: personaRegistry } = require('./personas');
const { SkillLoader } = require('./skill-loader');

const taskId = process.env.SUITE_TASK_ID;
const taskDescription = process.env.SUITE_TASK_DESCRIPTION;
const rawContext = process.env.SUITE_CONTEXT;
const skipPermissions = process.env.SUITE_SKIP_PERMISSIONS === '1';
const basePath = process.env.SUITE_BASE_PATH || process.cwd();
const personaId = process.env.SUITE_PERSONA || 'executor';

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

// Resolve persona
const persona = personaRegistry.get(personaId) || personaRegistry.get('executor');

// Discover matching skill (best-effort)
let loadedSkill = null;
try {
  const loader = new SkillLoader(basePath);
  loader.discover();
  loadedSkill = loader.get(persona.id) || null;
} catch { /* skill discovery is optional */ }

// Report what this agent received and its capabilities
const report = {
  agentId: taskId,
  task: taskDescription,
  hasConstraints: context.constraints !== null,
  hasRequirements: context.requirements !== null,
  mcpTools: mcpTools.list().map(t => t.name),
  nyquistEnabled: true,
  skipPermissions,
  persona: { id: persona.id, role: persona.role, contextBudget: persona.contextBudget },
  skill: loadedSkill ? loadedSkill.manifest.name : null,
  status: 'ready',
  message: `Agent for "${taskDescription}" spawned with sterile context, ${mcpTools.list().length} MCP tools, Nyquist verification, and persona: ${persona.role}.`,
};

console.log(JSON.stringify(report));
process.exit(0);
