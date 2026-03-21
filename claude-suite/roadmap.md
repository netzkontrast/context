# Claude Suite Development Roadmap

## Phase 1: Core CLI & Initial Structure
- [x] Initial Repository Setup (`AGENTS.md`, `planning.md`, `roadmap.md`, `backlog.md`).
- [x] Initialize `package.json` with Node.js execution mapping.
- [x] Create `bin/install.js` modeled after `gsd`.
- [x] Implement command stubs (`new-project`, `plan-phase`, `execute-phase`).
- [x] Create foundation templates (`PROJECT.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `STATE.md`).

## Phase 2: Orchestration Layer
- [x] Develop the Agent Orchestrator class.
- [x] Implement Wave Execution logic (parallel vs dependent tasks).
- [x] Implement sterile context spawning mechanisms.

## Phase 3: MCP Integrations
- [x] Implement standard file system operations as MCP capabilities.
- [x] Implement local script/AST verification tools (the Nyquist Layer).

## Phase 4: Refinement
- [x] Finalize the Truth Verification statistical thresholds.
- [x] Validate automated end-to-end tests against project creation flows.

## Phase 5: Skill Expansion
- [x] Create `/audit` skill — proactive security scanning using Nyquist classification.
- [x] Create `/research` skill — SQ3R deep-reading researcher for knowledge acquisition.
- [x] Create `/diagnose` skill — telemetry and execution failure diagnostician.
- [x] Create `/init` skill — intelligent project scaffolder with stack detection.
- [x] Create `/verify` skill — standalone verification and quality gate with trend tracking.
- [x] Create `/retro` skill — cross-session retrospective and learning extractor.

## Phase 6: Test Coverage Hardening
- [x] Add comprehensive tests for `AgentOrchestrator` (constructor, planWaves, execute, wave execution, state writing, verification).
- [x] Add comprehensive tests for `agent-runner.js` (env validation, output structure, MCP tools, Nyquist, permissions).

## Phase 7: Agent Persona Ecosystem & Skills (Complete)
- [x] Implement `lib/personas.js` — PersonaRegistry with 4 built-in personas (Planner, Executor, Verifier, Researcher).
- [x] Implement `lib/skill-loader.js` — SkillLoader with YAML front-matter parser and progressive disclosure.
- [x] Extend `AgentOrchestrator` — persona routing in `_buildSterileContext` and `SUITE_PERSONA` env injection.
- [x] Extend `agent-runner.js` — persona resolution and skill discovery in subprocess.
- [x] Add `personas` CLI command — list all registered personas with context budgets and tools.
- [x] Add `skills` CLI command — discover `skills/` directory and display skill metadata.
- [x] Write `test/skill-loader.test.js` — 28 tests covering parsing, discovery, loading, SkillLoader class.
- [x] Write `test/personas.test.js` — 35 tests covering registry, keyword routing, schema validation.
- [x] Extend `test/orchestrator.test.js` — persona integration tests for `_buildSterileContext`.
