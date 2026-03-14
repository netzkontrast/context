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

## Phase 5: Infrastructure Expansion
- [x] Implement SQLite FTS5 Context Engine for persistent agent knowledge store.
- [x] Implement deterministic lifecycle hooks (PreToolUse, PostToolUse, EndOfTurn).
- [x] Integrate Nyquist safety hook into PreToolUse pipeline.
- [x] Wire EndOfTurn hooks into orchestrator agent lifecycle.
- [x] Add CLI commands: `context` (store/search/list) and `hooks` (inspect registry).
- [x] Comprehensive tests for both modules (49 new test assertions).
