# Claude Suite Planning

## Mission
Develop a minimal, yet highly interconnected "Claude Suite" inspired by `gsd`. The suite prioritizes a deterministic context engineering approach, separating the LLM reasoning loop from tool execution and state management via an `npx` installable command line interface.

## Current Focus (Phase 7 Complete — All Phases Done)
- Phases 1–7 are complete. 163 tests passing.
- Phase 5 (Skill Expansion) delivered:
  - Six skills: `/audit`, `/research`, `/diagnose`, `/init`, `/verify`, `/retro`.
  - Each skill has SKILL.md (YAML frontmatter + phased workflow), workflow diagram, and helper scripts.
- Phase 6 (Test Coverage Hardening) delivered:
  - Comprehensive tests for `AgentOrchestrator` (41 tests) and `agent-runner.js` (10 tests).
  - Total test count: 163 passing (up from 112).
- Phase 7 (Agent Persona Ecosystem & Skills) delivered:
  - `lib/personas.js` — PersonaRegistry with 4 built-in personas (Planner, Executor, Verifier, Researcher).
  - `lib/skill-loader.js` — SkillLoader with YAML front-matter parser and progressive disclosure.
  - Extended `AgentOrchestrator` with persona routing and `SUITE_PERSONA` env injection.
  - Extended `agent-runner.js` with persona resolution and skill discovery.
  - Added `personas` and `skills` CLI commands.
  - 63 new tests across `personas.test.js` (35) and `skill-loader.test.js` (28).

## Principles
1. Hexagonal architecture for API independence.
2. Wave Execution via Directed Acyclic Graphs (DAG) mapping.
3. Strict Model Context Protocol (MCP) integrations.
