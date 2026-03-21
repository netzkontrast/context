---
name: dev
description: >
  Full-lifecycle development orchestrator. Use when the user says "next", "continue",
  "dev", "develop", "build next phase", "what's next", or wants to advance project work.
  Analyzes project state (roadmap, planning, backlog), identifies the current phase,
  plans implementation, executes with safety verification, and updates all tracking
  artifacts. Works with any project that has a roadmap.md or planning.md.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Agent
  - TodoWrite
  - WebSearch
metadata:
  version: "1.0.0"
  author: "claude-suite"
  category: "development-orchestration"
---

# Dev — Development Lifecycle Orchestrator

A sophisticated skill that manages the full development cycle: **Sense → Plan → Execute → Verify → Update**.

## Activation

Trigger on: `/dev`, `/dev <directive>`, "next", "continue", "build next phase", "what's next", or any request to advance project development.

The optional `<directive>` narrows scope (e.g., `/dev fix the parser` or `/dev phase 4`).

---

## Phase 0: Orientation (SENSE)

Before doing anything, build a mental model of the project. Execute all of these reads in parallel:

### 0.1 — Discover Project Shape

```
Glob: **/roadmap.md, **/planning.md, **/backlog.md, **/STATE.md
Glob: **/CLAUDE.md, **/AGENTS.md
Glob: **/package.json, **/Cargo.toml, **/pyproject.toml, **/go.mod
Glob: **/.suite/STATE.md
```

### 0.2 — Read Core Artifacts

Read all discovered files from 0.1. Extract:

| Signal | Source | What to Extract |
|--------|--------|----------------|
| **Current phase** | `planning.md` | The "Current Focus" section — what phase are we in? |
| **Phase tasks** | `roadmap.md` | All `- [ ]` items under the current phase heading |
| **Blockers** | `STATE.md` or `.suite/STATE.md` | Any blocker entries |
| **Backlog items** | `backlog.md` | Deferred or deprioritized work |
| **Constraints** | `AGENTS.md`, `CLAUDE.md` | Architectural rules, forbidden patterns |
| **Tech stack** | `package.json` / manifests | Language, framework, dependencies |

### 0.3 — Derive Intent

If the user provided a `<directive>`:
- Match it against pending roadmap items or backlog entries
- Scope work to that specific item

If no directive (bare `/dev` or "next"):
- Identify the **first unchecked `- [ ]` item** in the current roadmap phase
- If all items in the current phase are checked, advance to the next phase
- If all phases are complete, check backlog.md for remaining work

Output a brief status line:
```
Phase N: <phase name> — Task: <specific task description>
```

---

## Phase 1: Planning (PLAN)

### 1.1 — Explore the Codebase

Before planning implementation, understand what exists:
- Use the Agent tool (with a research-oriented prompt) to map relevant source files
- Read existing implementations that the task will touch or extend
- Identify interfaces, patterns, and conventions already in use

### 1.2 — Draft Implementation Plan

Create a TodoWrite list with specific, actionable items. Each item should be:
- **Atomic**: One clear deliverable
- **Ordered**: Dependencies respected
- **Testable**: You know when it's done

Guidelines:
- Prefer editing existing files over creating new ones
- Follow conventions already established in the codebase
- Keep solutions minimal — don't over-engineer
- If the task requires new files, plan their location based on existing structure

### 1.3 — Safety Pre-check

If the plan involves shell commands or scripts:
- Consider what the Nyquist Layer would classify each command as
- SAFE commands: proceed without hesitation
- GUARDED commands: note them, will need user awareness
- BLOCKED commands: redesign the approach to avoid them

---

## Phase 2: Execution (EXECUTE)

### 2.1 — Implement Changes

Work through the todo list sequentially:
1. Mark the current task as `in_progress` before starting
2. Read any files you need to modify BEFORE editing them
3. Make the change
4. Mark the task as `completed` immediately after
5. Move to the next task

### 2.2 — Execution Rules

- **One task in_progress at a time** — never batch
- **Read before edit** — always understand context first
- **Minimal diff** — change only what's needed
- **No speculative features** — implement exactly what the roadmap says
- **Follow existing patterns** — match code style, naming, structure
- **Parallelize independent work** — use Agent tool for truly independent subtasks

### 2.3 — Handle Blockers

If you hit a blocker:
1. Do NOT brute-force or retry the same approach
2. Analyze the root cause
3. If it's a missing dependency or unclear requirement, ask the user
4. If it's a design issue, propose alternatives
5. Document the blocker in the todo list

---

## Phase 3: Verification (VERIFY)

### 3.1 — Run Project Tests

Detect and run the project's test suite:
```
package.json → npm test
Cargo.toml → cargo test
pyproject.toml → pytest or python -m pytest
go.mod → go test ./...
```

If tests exist, run them. If they fail, fix the issues before proceeding.

### 3.2 — Run Linting

Detect and run linters:
```
.eslintrc* / eslint.config* → npx eslint
pyproject.toml [tool.ruff] → ruff check
.golangci.yml → golangci-lint run
```

Fix any lint errors introduced by your changes.

### 3.3 — Smoke Test

If the project has a CLI or can be executed, run a quick smoke test:
- For CLI tools: run `--help` or a basic command
- For libraries: verify imports work
- Example (claude-suite): `node bin/install.js --help`

---

## Phase 4: State Update (UPDATE)

### 4.1 — Update Roadmap

In `roadmap.md`, change completed items from `- [ ]` to `- [x]`:
```markdown
- [x] The task that was just completed.
```

### 4.2 — Update Planning

In `planning.md`, update the "Current Focus" section:
- Reflect what was accomplished
- Update the phase transition indicator if all phase tasks are done
- Set the "Next" pointer to the upcoming work

### 4.3 — Update State (if .suite exists)

If `.suite/STATE.md` exists, update it with execution results.

### 4.4 — Update Backlog (if applicable)

If work was pulled from `backlog.md`, mark it as done or remove it.
If new work was discovered during implementation, add it to `backlog.md`.

---

## Phase 5: Commit & Report (SHIP)

### 5.1 — Commit

Stage and commit all changes with a descriptive message:
- Use conventional commit format: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`
- Message should explain the **why**, not just the **what**
- Include the session URL

### 5.2 — Push

Push to the current working branch.

### 5.3 — Summary

Provide a concise completion report:

```
✓ Phase N: <phase name>
  Completed: <what was done>
  Files changed: <count>
  Tests: ✓ passing | ⚠ N/A

  Next up: <what comes next from the roadmap>
```

---

## Decision Framework

When you face a choice during development, use this priority order:

1. **User directive** — explicit instructions override everything
2. **CLAUDE.md / AGENTS.md** — project-level constraints
3. **Existing patterns** — follow what the codebase already does
4. **Minimal change** — the smallest correct solution wins
5. **Roadmap order** — follow the planned sequence

## Anti-Patterns (Do NOT)

- Don't read the roadmap and then ask "what should I do?" — determine it yourself
- Don't add features not in the roadmap or directive
- Don't refactor surrounding code while implementing a feature
- Don't add comments, docstrings, or type annotations to unchanged code
- Don't create wrapper functions for one-time operations
- Don't add error handling for impossible scenarios
- Don't output lengthy explanations — be brief, ship code
