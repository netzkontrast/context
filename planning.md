# Planning

*Comprehensive execution plan and current state tracking.*

## Status: Phase 10 — Agentic System Architecture

### What's Done (Phases 0-5 partial)
All foundational infrastructure is complete:
- CLI framework with 6 commands (Commander.js)
- Agent Orchestrator with Wave Execution and DAG planning
- MCP Registry with 6 sandboxed filesystem tools
- Nyquist Layer with 33 safe commands, 15 blocked patterns
- TruthVerifier with confidence scoring (0.8 default threshold)
- SQLite ContextStore with FTS5, WAL mode, audit log, token budget estimator
- JSONL Telemetry with 10MB rotation and 5-file retention
- AgentOrchestrator integrated with ContextStore and Telemetry (graceful degradation)
- 265 passing tests across 11 suites
- `better-sqlite3` promoted to production dependency

### Phase 10 Execution Plan

**Goal:** Implement agentic system architecture primitives from the *Strategic Research Roadmap: Engineering the Architecture of Intent* (2025): LDAR, Knowledge Graph, and Coherence Monitor.

#### Wave 1 — Core Primitives (COMPLETE)
- [x] `lib/ldar.js` — Learning Distraction-Aware Retrieval
  - Adaptive band selection over FTS5 BM25 results (narrow-cluster / wide-penalised / floor-applied)
  - Distractor pattern penalty for narrative connectives and filler content
  - `assessCUE()` — Context Utilisation Efficiency with 12-chunk rot threshold
  - 20 tests covering all retrieval modes, session scoping, and edge cases
- [x] `lib/knowledge-graph.js` — Entity-Edge Knowledge Graph (SQLite-backed)
  - EntityNode schema: `node_id`, `type` (File/Function/Class/Requirement/Decision), `content_hash`, `metadata`
  - EntityEdge schema: `source_id`, `target_id`, `relationship` (IMPLEMENTS/DEPENDS_ON/MODIFIES/OBSOLETES/TESTS)
  - Dependency centrality scoring, ContextRelevanceScore (40/30/20/10 weight split)
  - `registerRefactor()` — OBSOLETES + IMPLEMENTS edges on function refactor
  - Multi-hop BFS traversal, stats, full CRUD
  - 26 tests across 7 suites
- [x] `lib/coherence-monitor.js` — IIT Phi-inspired coherence tracking
  - Detects CONSERVATIVE_COLLAPSE, VERBOSITY_INFLATION, PREMATURE_COMMITMENT, RAPID_FLAKINESS
  - `assess()` → `{ phi, failureMode, rotRisk, warning, metrics }`
  - `distill()` → compressed Markdown episodic snapshot (< 500 tokens)
  - `clearSession()` — context eviction after distillation
  - 17 tests including pattern matching and boundary conditions

#### Wave 2 — Integration (Next)
- [ ] Wire LDAR into Researcher Agent (Phase 6 Wave 3): replace raw FTS5 calls with `ldar.retrieve()`
- [ ] Wire KnowledgeGraph into AgentOrchestrator: register task DAG nodes as entities; add IMPLEMENTS edges on completion
- [ ] Wire CoherenceMonitor into session lifecycle: Phi snapshots pushed to Telemetry; wave halted on `rotRisk === 'critical'`
- [ ] `claude-suite graph` CLI command: `list`, `show <node-id>`, `traverse <node-id>`, `stats`
- [ ] Paraconsistent conflict flagging in ContextStore: `detectContradiction(sessionId, key)` using FTS5 co-occurrence

#### Wave 3 — Context Distillation Pipeline (After Wave 2)
- [ ] Auto-compress at 80% token budget: invoke `ldar.retrieve()` → `coherenceMonitor.distill()` → `store.saveSnapshot()`
- [ ] SQ3R pipeline runner: Survey → Question → Read (LDAR) → Recite (distill) → Review (clear) for Researcher Agent
- [ ] Session replay CLI: `claude-suite replay <session-id>` reconstructs execution from ContextStore

### Phase 5 Remaining Execution Plan

**Goal:** Complete Phase 5 stragglers before Phase 6 agent persona work.

#### Wave 3 (Depends on Wave 1-2, already complete)
- [x] Integrate context store into AgentOrchestrator (write execution results to SQLite)
- [ ] Implement session replay CLI command: `claude-suite replay <session-id>`

#### Wave 4
- [x] Context budget calculator: `estimateTokens` and `getSessionTokenBudget` in ContextStore
- [ ] Add `search` CLI command: full-text search across all project memory
- [ ] Write tests for context-store, telemetry, and replay (target: 30+ new tests)

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
- [ ] Implement Researcher Agent — SQ3R Deep-Reading for large docs (use `ldar.retrieve()` from Phase 10)
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
