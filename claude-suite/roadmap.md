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
