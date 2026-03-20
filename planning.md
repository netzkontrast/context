# Planning

*Comprehensive execution plan and current state tracking.*

## Status: Phase 7 — Security Hardening & Hooks (next)

### What's Done (Phases 0-6)
All foundational infrastructure is complete:
- CLI framework with 8 commands (Commander.js): install, new-project, plan-phase, execute-phase, mcp-tools, verify, search, replay, sessions, budget, personas, skills
- Agent Orchestrator with Wave Execution and DAG planning
- MCP Registry with 6 sandboxed filesystem tools
- Nyquist Layer with 33 safe commands, 15 blocked patterns
- TruthVerifier with confidence scoring (0.8 default threshold)
- SQLite context store (FTS5) and JSONL telemetry
- PersonaRegistry with 4 built-in personas (Planner, Executor, Verifier, Researcher)
- SkillLoader with YAML front-matter parser and progressive disclosure
- Persona routing wired into AgentOrchestrator and agent-runner subprocess
- 231 passing tests across 8 suites (context-store pre-existing failure: needs better-sqlite3)
- ~1,800 lines of source code, 2 production dependencies

### Phase 5 Execution Plan

**Goal:** Replace pure Markdown state management with SQLite persistence while keeping Markdown as the human-readable interface.

#### Wave 1 (Parallel — no dependencies)
- [ ] Design SQLite schema: `sessions`, `executions`, `telemetry`, `context_snapshots` tables
- [ ] Design JSONL telemetry format: agent spawns, token counts, durations, exit codes
- [ ] Research SQLite FTS5 API for Node.js (better-sqlite3 vs sql.js — decision: **better-sqlite3** for performance, synchronous API, zero-config)

#### Wave 2 (Depends on Wave 1)
- [ ] Implement `lib/context-store.js` — SQLite adapter with FTS5 virtual table
- [ ] Implement `lib/telemetry.js` — JSONL writer with rotation and structured events
- [ ] Add `context-store` and `telemetry` as MCP tools in the registry

#### Wave 3 (Depends on Wave 2)
- [ ] Integrate context store into AgentOrchestrator (write execution results to SQLite)
- [ ] Integrate telemetry into agent-runner (emit spawn/complete/fail events)
- [ ] Implement session replay CLI command: `claude-suite replay <session-id>`

#### Wave 4 (Depends on Wave 3)
- [ ] Implement context budget calculator: estimate tokens before agent spawn
- [ ] Add `search` CLI command: full-text search across all project memory
- [ ] Write tests for context-store, telemetry, and replay (target: 30+ new tests)

### Phase 6 Execution Plan

**Goal:** Build the agent persona ecosystem with skill-based progressive disclosure.

#### Wave 1 (Parallel)
- [ ] Define skill manifest format (YAML): name, description, triggers, context requirements, tools needed
- [ ] Design agent persona schema: id, role, capabilities, default tools, context budget
- [ ] Implement `lib/skill-loader.js` — progressive disclosure skill injector

#### Wave 2 (Depends on Wave 1)
- [ ] Implement Planner Agent persona — generates execution plans from REQUIREMENTS.md
- [ ] Implement Executor Agent persona — sterile single-task implementation
- [ ] Implement Verifier Agent persona — test runner + fix plan generator

#### Wave 3 (Depends on Wave 2)
- [ ] Implement Researcher Agent — SQ3R Deep-Reading for large docs
- [ ] Add `personas` CLI command to list/inspect agent personas
- [ ] Wire persona selection into AgentOrchestrator task dispatch

#### Wave 4 (Depends on Wave 3)
- [ ] Property-based testing for all agent output schemas
- [ ] Integration tests: full pipeline from ROADMAP parse to agent execution to state update
- [ ] Performance benchmarks: measure agent spawn overhead, wave throughput

### Phase 7 Execution Plan

**Goal:** Harden security with OS-level hooks and external scanner integration.

#### Wave 1 (Parallel)
- [ ] Design hook system: PreToolUse, PostToolUse, End-of-turn event contracts
- [ ] Research `parry` prompt injection API — integration approach
- [ ] Research `Dippy` AST scanner API — integration approach

#### Wave 2 (Depends on Wave 1)
- [ ] Implement `lib/hooks.js` — deterministic hook executor with timeout and error handling
- [ ] Implement `lib/prompt-guard.js` — parry integration wrapper
- [ ] Implement `lib/code-scanner.js` — Dippy integration wrapper

#### Wave 3 (Depends on Wave 2)
- [ ] Wire hooks into Orchestrator lifecycle events
- [ ] Nyquist v2: per-project allow/deny list configuration (`.suite/nyquist.json`)
- [ ] Implement immutable audit trail (append-only SQLite table)

#### Wave 4 (Depends on Wave 3)
- [ ] Rate limiter for agent spawns (configurable max agents/minute)
- [ ] Circuit breaker: halt execution after N consecutive failures
- [ ] Security test suite: injection attempts, path traversal, privilege escalation

### Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database | better-sqlite3 | Synchronous API, zero-config, single-file, FTS5 support |
| Telemetry format | JSONL | Append-only, line-oriented, easy to parse and rotate |
| Skill manifest | YAML | Human-readable, widely supported, good for declarative schemas |
| Agent output validation | JSON Schema subset (custom) | Already implemented in TruthVerifier, no need for Zod/Ajv overhead |
| Test framework | Node.js built-in `node:test` | Zero dependencies, TAP output, sufficient for current needs |
| Hook model | Synchronous, blocking | Hooks must complete before tool/agent proceeds — security requirement |
| Prompt injection scanner | parry | Purpose-built for LLM input sanitization |
| AST code scanner | Dippy | Validation and execution sandbox with AST parsing |
| Package distribution | npx via npm registry | Standard Node.js distribution, zero install friction |
| Agent subprocess model | child_process.spawn | OS-level isolation, no shared memory, 5-minute timeout |

### Blockers
*None currently.*

### Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| better-sqlite3 native compilation fails on some platforms | Medium | High | Fallback to sql.js (WASM-based, no native deps) |
| Agent subprocess timeout (5 min) too short for complex tasks | Low | Medium | Make timeout configurable per task in ROADMAP.md |
| Telemetry JSONL files grow unbounded | Medium | Low | Implement log rotation (max 10MB per file, 5 files) |
| parry/Dippy APIs change or become unavailable | Low | Medium | Abstract behind adapter interfaces (Hexagonal Architecture) |
| Wave Execution deadlock on circular dependencies | Very Low | High | DAG construction already prevents cycles by design |
