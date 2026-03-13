---
name: context
description: >
  Context engineering optimizer. Use when the user says "optimize context",
  "trim context", "what context does this need", "context engineer", or wants
  to analyze, compress, or assemble the ideal context window for a task.
  Implements the Write/Select/Compress/Isolate framework for managing what
  information reaches the LLM.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Agent
  - TodoWrite
metadata:
  version: "1.0.0"
  author: "claude-suite"
  category: "context-engineering"
---

# Context — Context Engineering Optimizer

Manages the information pipeline feeding LLMs using four strategies:
**Write** (persist to scratchpad), **Select** (retrieve relevant context),
**Compress** (reduce without losing signal), **Isolate** (separate concerns across agents).

## Activation

Trigger on: `/context`, `/context <task-description>`, "optimize context",
"what context does this need", "context engineer this", or any request about
context window management.

The optional `<task-description>` specifies what the context is being assembled for.

---

## Phase 1: Audit Current Context

Assess what context is currently available and what the task needs.

### 1.1 — Identify the Target Task

If a task description is provided, use it. Otherwise, read the current
`planning.md` and `STATE.md` to infer the active task.

### 1.2 — Inventory Available Context Sources

Run these searches in parallel:

```
Glob: **/CLAUDE.md, **/AGENTS.md, **/PROJECT.md
Glob: **/REQUIREMENTS.md, **/STATE.md, **/planning.md
Glob: **/roadmap.md, **/backlog.md
Glob: **/.context/**
```

### 1.3 — Measure Context Budget

Estimate the token cost of each source file. Report:
- Total available context sources
- Approximate token count per source
- Remaining budget (assume 200k window, 50% reserved for task output)

---

## Phase 2: Select — Pull Relevant Context

### 2.1 — Task-Relevance Scoring

For each context source, score relevance to the target task:
- **Direct**: File is explicitly referenced or required by the task
- **Adjacent**: File provides supporting context (architecture, constraints)
- **Ambient**: File provides background (roadmap, project history)
- **Noise**: File is irrelevant to this specific task

### 2.2 — Dependency Tracing

Starting from the task description:
1. Identify which source files will be read or modified
2. Trace import/require chains 1-2 levels deep
3. Find test files that cover the affected code
4. Locate relevant documentation

### 2.3 — Build Selection Manifest

Output a manifest listing selected files, their relevance tier, and
estimated token cost. The manifest should fit within the context budget.

---

## Phase 3: Compress — Reduce Without Losing Signal

### 3.1 — Apply Compression Strategies

For each selected file, apply the appropriate strategy:

| File Type | Strategy |
|-----------|----------|
| Source code (< 200 lines) | Include verbatim |
| Source code (> 200 lines) | Include function signatures + key implementations |
| Documentation | Include section headers + relevant paragraphs |
| State files | Include current state section only |
| Test files | Include test names + failing test details |
| Config files | Include only relevant sections |

### 3.2 — Extract Key Facts

From compressed sources, extract a "key facts" block:
- Architectural constraints that affect the task
- API contracts the task must honor
- Known failure modes or edge cases
- Related recent changes

---

## Phase 4: Write — Persist Context Artifacts

### 4.1 — Generate Context Package

Write a `.context/<task-name>.md` file containing:

```markdown
# Context Package: <task-name>
Generated: <timestamp>

## Task
<task description>

## Key Facts
<extracted constraints and facts>

## Selected Sources
<file manifest with relevance tiers>

## Compressed Context
<compressed file contents, ordered by relevance>
```

### 4.2 — Generate Sterile Agent Context

If the task will be executed by agents (via orchestrator), generate
per-agent context slices in `.context/agents/`:
- Each agent gets ONLY the files relevant to its subtask
- Shared constraints are included in every slice
- This implements the **Isolate** strategy

---

## Phase 5: Report

Output a summary:
- Number of context sources audited
- Sources selected vs. excluded (with reasons)
- Compression ratio achieved
- Context package location
- Estimated token budget usage
