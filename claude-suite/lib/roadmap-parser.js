'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Parses a ROADMAP.md file into a structured array of phases.
 *
 * Expected format:
 *   ## 0. Phase Name
 *   * [ ] Task description
 *   * [x] Completed task
 *   * **Requirements Mapped**: [REQ-01, REQ-02]
 */
function parseRoadmap(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Roadmap not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const phases = [];
  let currentPhase = null;

  for (const line of lines) {
    // Match phase headers: ## 0. Phase Name  or  ## Phase 1: Name
    const phaseMatch = line.match(/^##\s+(\d+)\.\s+(.+)/);
    if (phaseMatch) {
      currentPhase = {
        index: parseInt(phaseMatch[1], 10),
        name: phaseMatch[2].trim(),
        tasks: [],
        requirements: [],
      };
      phases.push(currentPhase);
      continue;
    }

    if (!currentPhase) continue;

    // Match tasks: * [ ] description  or  - [ ] description
    const taskMatch = line.match(/^[\s]*[*\-]\s+\[([ xX])\]\s+(.+)/);
    if (taskMatch) {
      currentPhase.tasks.push({
        description: taskMatch[2].trim(),
        done: taskMatch[1].toLowerCase() === 'x',
      });
      continue;
    }

    // Match requirements mapping: **Requirements Mapped**: [REQ-01, REQ-02]
    const reqMatch = line.match(/Requirements Mapped.*?:\s*\[(.+?)\]/);
    if (reqMatch) {
      currentPhase.requirements = reqMatch[1]
        .split(',')
        .map(r => r.trim());
    }
  }

  return phases;
}

/**
 * Builds a DAG representation from parsed phases.
 * Phases are sequential (each depends on the previous).
 * Tasks within a phase are parallel (no inter-task dependencies).
 */
function buildDAG(phases) {
  const nodes = [];
  const edges = [];

  for (const phase of phases) {
    const phaseNodeId = `phase-${phase.index}`;

    // Phase node
    nodes.push({
      id: phaseNodeId,
      type: 'phase',
      label: `Phase ${phase.index}: ${phase.name}`,
      requirements: phase.requirements,
    });

    // Sequential dependency between phases
    if (phase.index > 0) {
      const prevPhaseId = `phase-${phase.index - 1}`;
      const prevExists = phases.some(p => p.index === phase.index - 1);
      if (prevExists) {
        edges.push({ from: prevPhaseId, to: phaseNodeId });
      }
    }

    // Task nodes (parallel within the phase)
    phase.tasks.forEach((task, i) => {
      const taskNodeId = `${phaseNodeId}-task-${i}`;
      nodes.push({
        id: taskNodeId,
        type: 'task',
        label: task.description,
        done: task.done,
        parent: phaseNodeId,
      });
      edges.push({ from: phaseNodeId, to: taskNodeId });
    });
  }

  return { nodes, edges };
}

/**
 * Returns a printable summary of a single phase's execution plan.
 */
function formatPhasePlan(phases, phaseIndex) {
  const phase = phases.find(p => p.index === phaseIndex);
  if (!phase) {
    return null;
  }

  const pending = phase.tasks.filter(t => !t.done);
  const completed = phase.tasks.filter(t => t.done);

  const lines = [];
  lines.push(`Phase ${phase.index}: ${phase.name}`);
  lines.push('─'.repeat(50));

  if (phase.requirements.length > 0) {
    lines.push(`Requirements: ${phase.requirements.join(', ')}`);
  }

  lines.push(`Total tasks: ${phase.tasks.length} (${completed.length} done, ${pending.length} pending)`);
  lines.push('');

  if (pending.length > 0) {
    lines.push('Wave Execution Plan (parallel):');
    pending.forEach((task, i) => {
      lines.push(`  [Agent-${i + 1}] ${task.description}`);
    });
  } else {
    lines.push('All tasks in this phase are complete.');
  }

  return lines.join('\n');
}

/**
 * Resolves the path to the project's ROADMAP.md.
 * Checks .suite/ first, then cwd.
 */
function resolveRoadmapPath(cwd) {
  const suiteRoadmap = path.join(cwd || process.cwd(), '.suite', 'ROADMAP.md');
  if (fs.existsSync(suiteRoadmap)) return suiteRoadmap;

  const rootRoadmap = path.join(cwd || process.cwd(), 'ROADMAP.md');
  if (fs.existsSync(rootRoadmap)) return rootRoadmap;

  return null;
}

module.exports = {
  parseRoadmap,
  buildDAG,
  formatPhasePlan,
  resolveRoadmapPath,
};
