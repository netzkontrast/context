# Agentic Operations Directive: Claude Suite

> **Meta-Directive:** You are the operating system for a high-performance AI developer's working memory. Every wasted token is a lost reasoning opportunity. Every piece of missing context guarantees hallucination. Every stale piece of context guarantees regression. Execute these instructions with absolute determinism.

---

## 1. System Architecture and Core Paradigms

**Topology:** Modular monolith with hexagonal (ports & adapters) architecture. The core reasoning domain is strictly isolated from external integrations via the Model Context Protocol (MCP) bus. Agents run as subprocess isolates with no shared memory.

**State Management:** File-based deterministic memory. Conversational history is NEVER a source of truth. The following Markdown contracts are authoritative:
- `planning.md` — Ephemeral execution state, DAG task nodes, current wave
- `roadmap.md` — Immutable vision, phase definitions, completion tracking
- `backlog.md` — Deferred requirements, excluded features, future sprints
- `sources.md` — External tool/ecosystem registry

**Design Patterns:**
- Event-Driven Architecture (EDA) via Node.js EventEmitter for inter-agent communication
- Directed Acyclic Graph (DAG) execution: independent tasks run in parallel waves, dependent tasks queue sequentially
- Strangler Fig pattern: isolate features into singular workflows, never mega-prompts
- Zero-Trust Security Posture: all commands classified by the Nyquist Layer before execution

**Immutable Constraints:**
- NEVER execute destructive shell commands (`rm -rf`, `DROP TABLE`, remote POST) without explicit human confirmation
- NEVER hardcode curl or REST API endpoints in prompts — use MCP tool discovery
- NEVER attempt multi-file refactors or disparate tasks within a single continuous session
- NEVER carry conversational baggage from previous tasks — each task starts in a sterile context
- NEVER modify files outside the project boundary without explicit authorization

---

## 2. Technical Stack and Conventions

**Runtime:** Node.js 16+ (CI matrix: 18, 20, 22)
**Dependencies:** `commander@^11.0.0` (CLI), `better-sqlite3@^12.8.0` (persistence + FTS5)
**Testing:** Node.js built-in `node:test` and `node:assert/strict` — zero external test dependencies
**Package Manager:** npm (strictly enforced to prevent lockfile conflicts)

**Naming Conventions:**
- `camelCase` for JavaScript variables and functions
- `PascalCase` for class names
- `kebab-case` for file names
- `UPPER_SNAKE_CASE` for constants and environment variables

**Module Resolution:** Relative imports within `claude-suite/lib/`. No alias configuration.

**Formatting Directive:** Code formatting is governed by deterministic linters and CI pipelines. Do NOT expend LLM compute on indentation, spacing, or bracket placement analysis. These are Tier 4 rules — offloaded to tooling.

---

## 3. High-Order Workflow (HOP) and Execution Limits

When executing engineering tasks, you MUST adhere strictly to the following recursive sequence. This prevents behavioral collapse, runaway recursion, and context rot.

### 3.1 The Mandatory Explore-Plan-Code Sequence

```
[1] EXPLORE  →  Semantic search, grep, file reads to map all dependencies
                 before writing a single line of code.

[2] PLAN     →  Formulate step-by-step implementation blueprint.
                 Output the plan. Await human validation for structural changes.

[3] IMPLEMENT →  Generate code incrementally, one domain/file at a time.
                 Every successful atomic completion = isolated git commit.

[4] VERIFY   →  Run test suite: `cd claude-suite && node --test`
                 Validate outputs against expected behavior.

[5] CORRECT  →  If tests fail, analyze root cause. Fix and re-verify.
                 HARD LIMIT: 2 consecutive failures on the same issue.
                 On 3rd failure → HALT. State the failure clearly.
                 Prompt user for /clear or checkpoint rewind.
```

### 3.2 Self-Correction Boundaries

- **Retry Budget:** Maximum 2 self-correction attempts per failing test or compilation error
- **Escalation Protocol:** On budget exhaustion, post a structured failure report:
  ```
  BLOCKED: [task_id]
  Root Cause: [analysis]
  Attempts: [list of corrections tried]
  Recommended Action: [user intervention needed]
  ```
- **NEVER** enter infinite retry loops — this is the primary vector for context rot and compute waste
- **NEVER** suppress or ignore test failures to proceed

### 3.3 Recursive Task Decomposition

For complex tasks (Profile B/C), decompose into a DAG before execution:
1. Identify all atomic sub-tasks
2. Map dependency edges between them
3. Execute independent tasks in parallel waves
4. Hold dependent tasks in sequential queues
5. Commit after each successful wave

---

## 4. Deterministic Commands and Tooling

To aggressively conserve context window tokens, utilize CLI commands over persistent MCP servers wherever possible. CLI commands carry zero persistent schema overhead.

| Operation | Command | Notes |
|-----------|---------|-------|
| **Install** | `cd claude-suite && npm install` | Run once per session |
| **Test Suite** | `cd claude-suite && node --test` | 77 tests, 8 suites — run after every significant change |
| **Single Test** | `cd claude-suite && node --test test/<file>.test.js` | For targeted verification |
| **Syntax Check** | `node -c claude-suite/lib/<file>.js` | Quick parse validation |
| **Git Commit** | `git add <specific-files> && git commit -m "<message>"` | Atomic commits only — never `git add .` |
| **MCP Tools** | Via `mcp-registry.js` | 6 sandboxed filesystem tools (read/write/list/delete/append/exists) |

**Tool Loading Protocol:** Load only the specific tool metadata required for the immediate task. Do NOT load UI rendering tools for database tasks. Do NOT load all MCP schemas upfront — use progressive disclosure via skill manifests.

---

## 5. Context Window Management and Token Discipline

### 5.1 Token Budget Allocation (200k window)

| Segment | Budget | Contents |
|---------|--------|----------|
| System Directives | 10% | This file, tool schemas, persona constraints |
| Task Definition | 15% | Current DAG node, requirements, blackboard events |
| Active Code Context | 50% | File contents, AST fragments, repo maps |
| Execution History | 10% | Distilled summaries of past actions |
| Generation Buffer | 15% | Reserved for output reasoning and tool-use |

### 5.2 Context Saturation Protocol

- **Monitor continuously.** When switching to unrelated tasks, execute `/clear` to purge stale memory
- **Evict aggressively.** Once a tool output has been analyzed, replace raw logs with distilled summaries
- **Never read entire large files.** Extract only the relevant function/class using targeted line ranges
- **Measure CUE (Context Utilization Efficiency).** If you load 10,000 tokens but reference only 50 lines, your CUE is critically low — use targeted reads next time

### 5.3 Context Distillation

When approaching 80% token capacity or completing a sub-task:
1. Extract all decisions made, API signatures discovered, bugs identified
2. Compress into a dense bulleted summary (target: < 500 tokens)
3. Evict raw file contents of completed work
4. Retain only the distilled snapshot for the next DAG node

---

## 6. Task Classification and Context Loading

Before loading context, classify the task to determine your loading strategy:

| Profile | Description | Loading Strategy |
|---------|-------------|-----------------|
| **A: Localized Fix** | Single-file or single-function change | Load exact file + immediate imports only |
| **B: Feature Implementation** | Multi-file structural change | Load interfaces, data models, specs. Load implementations on-demand |
| **C: System Refactor** | Cross-cutting concerns | Generate AST-aware repo map. Do NOT load raw implementations unless modifying them |

**Relevance Scoring (for Profile B/C):**
- Semantic overlap with task description (40%)
- Recently modified files — last 5 commits (30%)
- Dependency centrality in the module graph (20%)
- Association with recent test failures (10%)
- **Eviction threshold:** Drop files below 0.4 relevance score immediately

---

## 7. Multi-Agent Coordination

### 7.1 Agent Personas

This project utilizes 7 specialized skill personas. Invoke them via `/skills` — their full content loads on-demand, not at session start:

| Skill | Purpose | Invoke When |
|-------|---------|-------------|
| `dev` | Core development workflows | Implementing features |
| `audit` | Code quality and security review | Pre-commit validation |
| `research` | External ecosystem analysis | Evaluating new dependencies |
| `diagnose` | Failure root-cause analysis | Test failures, runtime errors |
| `init` | Project scaffolding | New project setup |
| `verify` | Comprehensive test validation | Pre-merge verification |
| `retro` | Sprint retrospective analysis | Phase completion review |

### 7.2 Blackboard Architecture

Agents communicate via shared state files, NOT direct conversational dialogue:
- Write discoveries to `planning.md` as structured task nodes
- Post blockers with explicit `BLOCKED:` prefix and root cause
- Never duplicate work — check state files before starting

### 7.3 Conflict Resolution

1. If a verification step rejects code: post `BLOCKED` event with failure AST
2. Spawn targeted debugger analysis (max 2 iterations)
3. If unresolved after 2 iterations: halt and request human arbitration
4. NEVER engage in infinite correction loops between agent personas

---

## 8. Security and Validation

### 8.1 Nyquist Layer Classification

All shell commands are classified before execution:
- **Safe (33 patterns):** Read-only operations, standard build/test commands
- **Guarded:** Commands requiring sandbox isolation or parameter validation
- **Blocked (15 patterns):** Destructive operations requiring human-in-the-loop confirmation

### 8.2 TruthVerifier Thresholds

- Agent reports: confidence threshold ≥ 0.85
- Wave execution results: confidence threshold = 1.0 (deterministic)
- Schema validation via JSON Schema before any structured output

### 8.3 Subprocess Isolation

- All agent execution occurs in `child_process.spawn` with 5-minute timeout
- STDOUT only — no shared memory, no environment leakage
- Failed subprocesses do NOT cascade — parent orchestrator handles gracefully

---

## 9. Git Protocol and Documentation Maintenance

### 9.1 Atomic Commits

- Every successful DAG node completion = one isolated git commit
- Commit messages describe the specific logic added, not generic summaries
- Stage specific files only — never `git add -A` or `git add .`
- This provides a high-fidelity "undo button" via standard `git revert`

### 9.2 Mandatory Documentation Updates

When modifying this repository, keep these files strictly synchronized:
- `planning.md` — Update current execution state and wave progress
- `roadmap.md` — Update phase completion status
- `backlog.md` — Add deferred features or alternative approaches
- `sources.md` — Add any new external tools, repos, or scanning utilities consulted

### 9.3 Branch Protocol

- Develop on assigned feature branches (pattern: `claude/<descriptor>-<id>`)
- Push with `-u origin <branch-name>` to set upstream tracking
- Never force-push or amend published commits without explicit authorization

---

## 10. Context Quality Checklist

Before writing ANY code, systematically verify:

- [ ] **Task Isolation:** Context is limited to current DAG node. Irrelevant history purged.
- [ ] **Dependency Resolution:** All import targets and external method signatures loaded.
- [ ] **Budget Compliance:** Active code context below 50% allocation limit.
- [ ] **State Freshness:** Files match latest Git HEAD. No stale reads from parallel waves.
- [ ] **Progressive Disclosure:** Only task-relevant tool schemas loaded. No universal toolset.
- [ ] **Security Classification:** All pending commands classified by Nyquist Layer.
- [ ] **Exit Condition:** A testable, deterministic criterion exists to prove task completion (e.g., `node --test` passes).

If ANY check fails: do NOT proceed. Repair context first, then re-evaluate.

---

## 11. Anti-Patterns — Explicit Prohibitions

These behaviors are strictly forbidden. They represent the primary vectors for context rot, behavioral collapse, and compute waste:

1. **Kitchen Sink Sessions:** Loading unrelated files, tools, or context "just in case"
2. **Conversational Memory Trust:** Using chat history as source of truth instead of state files
3. **Runaway Recursion:** Retrying the same failed approach more than twice
4. **Mega-Refactors:** Attempting system-wide changes in a single continuous session
5. **Tool Schema Bloat:** Loading all MCP tool definitions at session start
6. **Redundant Instructions:** Adding rules the model already follows natively (e.g., "write clean code")
7. **LLM-Driven Formatting:** Using inference compute for indentation/spacing decisions
8. **Assumption-Based Implementation:** Writing code without first reading the target files
9. **Silent Failure Suppression:** Ignoring test failures or error outputs to maintain progress
10. **Unbounded Agent Spawning:** Creating sub-agents without clear termination criteria

---

*This directive file is optimized for minimal token expenditure and maximum instruction adherence. Rules excluded from this file (Tier 2-4) are delegated to dynamic skills, scoped rules, or CI pipelines. Global context must remain under 500 lines to preserve the instruction-following dimension.*
