# Claude Suite Planning

## Mission
Develop a minimal, yet highly interconnected "Claude Suite" inspired by `gsd`. The suite prioritizes a deterministic context engineering approach, separating the LLM reasoning loop from tool execution and state management via an `npx` installable command line interface.

## Current Focus (Phase 6 Complete — All Phases Done)
- Phases 1–6 are complete.
- Phase 5 (Skill Expansion) delivered:
  - Six new skills: `/audit`, `/research`, `/diagnose`, `/init`, `/verify`, `/retro`.
  - Each skill has SKILL.md (YAML frontmatter + phased workflow), workflow diagram, and helper scripts.
- Phase 6 (Test Coverage Hardening) delivered:
  - Comprehensive tests for `AgentOrchestrator` (41 tests covering constructor, planWaves, execute, wave execution, state writing, verification, abort).
  - Comprehensive tests for `agent-runner.js` (10 tests covering env validation, output structure, MCP tools, permissions).
  - Total test count: 163 passing (up from 112).

## Principles
1. Hexagonal architecture for API independence.
2. Wave Execution via Directed Acyclic Graphs (DAG) mapping.
3. Strict Model Context Protocol (MCP) integrations.
