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
 *
 * This is the execution boundary where an LLM agent (or script) would
 * perform the actual work. Currently implements a structured stub that
 * validates its inputs and reports readiness.
 */

const taskId = process.env.SUITE_TASK_ID;
const taskDescription = process.env.SUITE_TASK_DESCRIPTION;
const rawContext = process.env.SUITE_CONTEXT;

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

// Report what this agent received (structured output)
const report = {
  agentId: taskId,
  task: taskDescription,
  hasConstraints: context.constraints !== null,
  hasRequirements: context.requirements !== null,
  status: 'ready',
  message: `Agent for "${taskDescription}" spawned with sterile context. Awaiting LLM integration.`,
};

console.log(JSON.stringify(report));
process.exit(0);
