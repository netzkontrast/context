'use strict';

/**
 * Agent Persona Registry
 *
 * Defines four built-in agent personas aligned with the Planner/Executor/Verifier/Researcher
 * multi-agent architecture described in the project's theoretical foundation.
 *
 * Each persona declares:
 *   id           — unique identifier (used as SUITE_PERSONA env var value)
 *   role         — short role label
 *   description  — what this persona does
 *   contextBudget — fraction of token budget allocated to code context (0.0–1.0)
 *   defaultTools  — MCP tools pre-loaded for this persona
 *   keywords      — trigger words for automatic selection
 */

const PERSONAS = [
  {
    id: 'planner',
    role: 'Planner',
    description: 'Generates validated execution plans from REQUIREMENTS.md. Decomposes complex goals into atomic DAG tasks, identifies dependencies, and produces implementation_plan.md artifacts.',
    contextBudget: 0.30,
    defaultTools: ['read_file', 'list_directory', 'file_exists'],
    keywords: ['plan', 'generate', 'design', 'architect', 'decompose', 'spec', 'blueprint'],
  },
  {
    id: 'executor',
    role: 'Executor',
    description: 'Implements single atomic tasks within a sterile context window. Applies minimal diffs, follows existing code patterns, and commits reversible changes.',
    contextBudget: 0.50,
    defaultTools: ['read_file', 'write_file', 'edit_file', 'list_directory', 'file_exists'],
    keywords: ['implement', 'fix', 'write', 'build', 'create', 'add', 'update', 'refactor', 'code'],
  },
  {
    id: 'verifier',
    role: 'Verifier',
    description: 'Runs test suites and produces actionable fix plans. Validates agent outputs against schemas, identifies regressions, and posts Blocked events when failures cannot be auto-resolved.',
    contextBudget: 0.25,
    defaultTools: ['read_file', 'list_directory', 'file_exists'],
    keywords: ['test', 'verify', 'check', 'validate', 'assert', 'audit', 'lint', 'inspect'],
  },
  {
    id: 'researcher',
    role: 'Researcher',
    description: 'Applies the SQ3R Deep-Reading methodology (Survey, Question, Read, Recite, Review) to large documentation and codebases. Produces distilled summaries for archival memory.',
    contextBudget: 0.20,
    defaultTools: ['read_file', 'list_directory', 'file_exists', 'append_file'],
    keywords: ['research', 'read', 'analyze', 'document', 'summarize', 'explore', 'survey', 'understand'],
  },
];

/**
 * PersonaRegistry — provides access to built-in agent personas and task routing.
 */
class PersonaRegistry {
  constructor() {
    this._personas = new Map(PERSONAS.map(p => [p.id, p]));
  }

  /**
   * Return all registered personas.
   * @returns {object[]}
   */
  list() {
    return Array.from(this._personas.values());
  }

  /**
   * Get a persona by id. Returns undefined if not found.
   * @param {string} id
   * @returns {object | undefined}
   */
  get(id) {
    return this._personas.get(id);
  }

  /**
   * Select the most appropriate persona for a given task description.
   * Uses keyword matching; defaults to 'executor' if no keywords match.
   *
   * @param {string} taskDescription
   * @returns {object}  The matched persona
   */
  selectForTask(taskDescription) {
    if (!taskDescription || typeof taskDescription !== 'string') {
      return this._personas.get('executor');
    }

    const lower = taskDescription.toLowerCase();

    for (const persona of PERSONAS) {
      for (const keyword of persona.keywords) {
        // Use word boundary matching to avoid substring false positives
        // e.g., "code" should not match "codebase", "architect" should not match "architecture"
        const re = new RegExp(`\\b${keyword}\\b`, 'i');
        if (re.test(lower)) {
          return persona;
        }
      }
    }

    return this._personas.get('executor');
  }
}

// Singleton instance for use across the suite
const registry = new PersonaRegistry();

module.exports = { PersonaRegistry, registry, PERSONAS };
