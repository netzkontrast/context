# Roadmap

*Immutable vision statement. High-level phases and architectural boundaries.*

## Core Vision
Construct an autonomous Claude Suite developer toolkit using deterministic context engineering, Event-Driven Architecture, and the Model Context Protocol (MCP). Transform LLMs from conversational assistants into parallel execution swarms with verifiable outputs.

## Architectural Boundaries
- **Stack:** Node.js 16+, Commander.js (CLI), SQLite (Context Engine persistence)
- **Paradigm:** Hexagonal Architecture (Ports and Adapters)
- **Execution:** Wave Execution via Directed Acyclic Graphs (DAGs)
- **Security:** Zero-Trust AST Sandboxing (Nyquist Layer)
- **Modularity:** Progressive Disclosure — agents and tools loaded on demand, not upfront

## Completed Phases

- [x] **Phase 0:** Research & Blueprint Consolidation
  - Architectural blueprints, concept docs, reference analysis
- [x] **Phase 1:** Core CLI & Initial Structure
  - Commander.js routing, `bin/install.js`, project templates, `new-project` command
- [x] **Phase 2:** Orchestration Layer
  - AgentOrchestrator class, Wave Execution, sterile context spawning, DAG planning
- [x] **Phase 3:** MCP Integrations & Nyquist Layer
  - MCP filesystem tools (read/write/list/delete/append/exists), sandbox isolation, command classification
- [x] **Phase 4:** Truth Verification & Testing
  - TruthVerifier with confidence scoring, 77 end-to-end tests, `agent-report` and `wave-result` schemas
- [x] **Phase 5 (partial):** Persistence & Context Intelligence — Core
  - SQLite-backed ContextStore with FTS5 full-text search and audit log
  - JSONL Telemetry with 10MB rotation and 5-file retention
  - Context token budget estimator (`estimateTokens`, `getSessionTokenBudget`)
  - AgentOrchestrator integrated with ContextStore and Telemetry

## Upcoming Phases

### Phase 5: Persistence & Context Intelligence — Remaining (Weeks 1-2)
- [ ] Session replay CLI command: `claude-suite replay <session-id>`
- [ ] `search` CLI command: full-text search across all project memory
- [ ] 30+ additional tests for context-store, telemetry, and replay

### Phase 6: Agent Ecosystem & Skills (Weeks 3-4)
- [x] Planner Agent — generates validated execution plans from requirements
- [x] Executor Agent — implements single tasks within sterile context windows
- [x] Verifier Agent — runs test suites and produces actionable fix plans
- [x] Researcher Agent — SQ3R Deep-Reading methodology for large documentation
- [x] Skill manifest format (YAML/Markdown) with progressive disclosure loading
- [x] Agent persona registry with capability declarations

### Phase 7: Security Hardening & Hooks (Weeks 5-6)
- [ ] OS-level deterministic hooks: PreToolUse, PostToolUse, End-of-turn
- [ ] Integration with `parry` prompt injection scanner on all agent inputs
- [ ] Integration with `Dippy` AST code scanner on all agent outputs
- [ ] Nyquist Layer v2: configurable rulesets per project (allow/deny lists)
- [ ] Audit trail — immutable log of every command classified and every tool invoked
- [ ] Rate limiting and circuit breakers for runaway agent loops

### Phase 8: External Integrations (Weeks 7-8)
- [ ] Slack approval flows for guarded operations
- [ ] Jira ticket sync from REQUIREMENTS.md (REQ-IDs map to Jira issues)
- [ ] GitHub Actions CI/CD pipeline with automated test gates
- [ ] `npx claude-suite` global distribution via npm registry
- [ ] Webhook notifications for phase completion events

### Phase 9: Advanced Orchestration (Weeks 9-10)
- [ ] Byzantine Fault Tolerance — quorum voting for high-stakes code changes
- [ ] Q-Learning agent routing — classify queries and assign to optimal agent persona
- [ ] Code Digital Twins — shadow execution environment for pre-validation
- [ ] Multi-project orchestration — single suite managing multiple repositories
- [ ] Agent performance benchmarking and adaptive concurrency tuning

### Phase 10: Agentic System Architecture — LDAR, Knowledge Graph & Coherence (Weeks 11-12)
*Grounded in the Strategic Research Roadmap: Engineering the Architecture of Intent (2025).*
- [x] `lib/ldar.js` — Learning Distraction-Aware Retrieval: adaptive band selection over FTS5, distractor penalty, CUE assessment
- [x] `lib/knowledge-graph.js` — Entity-Edge Knowledge Graph: File/Function/Class/Requirement/Decision nodes; IMPLEMENTS/DEPENDS_ON/MODIFIES/OBSOLETES/TESTS edges; centrality scoring; ContextRelevanceScore; multi-hop BFS traversal
- [x] `lib/coherence-monitor.js` — IIT Phi-inspired coherence tracking: CONSERVATIVE_COLLAPSE, VERBOSE_INFLATION, PREMATURE_COMMITMENT detection; distillation snapshots; rot-risk classification
- [x] `lib/sq3r.js` — SQ3R pipeline: Survey (structure extraction) → Question (3–5 anchored queries) → Read (LDAR, max 3 iterations) → Recite (distilled Markdown summary) → Review (ContextStore + audit event + clear)
- [x] Wire KnowledgeGraph into AgentOrchestrator: session as Decision node; tasks as Requirement nodes; DEPENDS_ON + IMPLEMENTS edges tracked
- [x] Wire CoherenceMonitor into session lifecycle: Phi check post-wave; critical rot halts execution; distillation snapshot persisted; `coherence:phi` telemetry events emitted
- [x] `claude-suite graph` CLI command: `list [--type]`, `show <node-id>`, `traverse <node-id> [--rel] [--depth]`, `stats`
- [x] Paraconsistent conflict detection: `ContextStore.detectContradiction(sessionId, key, threshold)` — trigram dissimilarity; returns conflict pairs with scores; no silent synthesis
- [ ] Context Distillation pipeline: auto-compress session memory at 80% token budget (hook into `_buildSterileContext`)

### Phase 11: MCP Gateway & Code Mode Orchestration (Weeks 13-14)
*Implements Bifrost Gateway pattern from the Architecture of Intent research.*
- [ ] MCP Gateway adapter: centralized control plane exposing `listToolFiles`, `readToolFile`, `executeToolCode` meta-tools
- [ ] Schema-on-demand: hide raw tool schemas from agent context; disclose only on explicit `readToolFile` call
- [ ] TypeScript workflow executor: agents generate single executable workflow instead of multi-turn ping-pong
- [ ] Gateway audit log: per-consumer tool filtering, cost tracking, and deterministic sandbox execution
- [ ] Token overhead comparison benchmark: prompt-based vs Code Mode orchestration (~50% reduction target)
