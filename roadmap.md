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

## Upcoming Phases

### Phase 5: Persistence & Context Intelligence (Weeks 1-2)
- [ ] SQLite-backed context store replacing pure Markdown state management
- [ ] FTS5 full-text search across project memory (PROJECT, ROADMAP, REQUIREMENTS, STATE)
- [ ] JSONL telemetry logging for token consumption and agent execution traces
- [ ] Session replay — reconstruct any past execution from telemetry logs
- [ ] Context budget calculator — estimate token cost before spawning agents

### Phase 6: Agent Ecosystem & Skills (Weeks 3-4)
- [ ] Planner Agent — generates validated execution plans from requirements
- [ ] Executor Agent — implements single tasks within sterile context windows
- [ ] Verifier Agent — runs test suites and produces actionable fix plans
- [ ] Researcher Agent — SQ3R Deep-Reading methodology for large documentation
- [ ] Skill manifest format (YAML/Markdown) with progressive disclosure loading
- [ ] Agent persona registry with capability declarations

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

### Phase 10: Software 3.0 Integration & LDAR Framework (Weeks 11-12)
- [ ] Implement Learning Distraction-Aware Retrieval (LDAR) for noise-filtered context retrieval.
- [ ] Enforce deterministic SQ3R cognitive pipelines for deep-reading large documentations without context rot.
- [ ] Establish "Architecture of Intent" utilizing schema-guided dialogues and progressive disclosure to preserve context window capacity.

### Phase 11: Enterprise Gateway & Advanced Memory Topologies (Weeks 13-14)
- [ ] Integrate Bifrost MCP Gateway for Code Mode orchestration, drastically reducing token consumption and exposing meta-tools (`listToolFiles`, `readToolFile`, `executeToolCode`).
- [ ] Implement the Four-Tier Memory Model (Core, Episodic, Semantic, Procedural) to manage state efficiently.
- [ ] Integrate Dolt and Beads distributed graph issue tracking for Git-backed agentic state persistence and parallel branch execution.

### Phase 12: Cognitive Coherence & System Resilience (Weeks 15-16)
- [ ] Implement Paraconsistent Logic interpreters to manage inherently contradictory documentation and API specifications without catastrophic reasoning failure.
- [ ] Adopt Integrated Information Theory (IIT) to quantify $\Phi$ (phi) cognitive coherence metrics and detect context rot early.
- [ ] Utilize the Theory of Structural Dissociation of the Personality (TSDP) to diagnose training data problems (First-Order vs. Second-Order learning).
- [ ] Integrate the Narrative Context Protocol (NCP) to maintain teleological trajectories in multi-agent workflows.
