# Dev Skill — Workflow Reference

## Execution Flow

```
  User: "/dev" or "next"
         │
         ▼
  ┌─────────────┐
  │  0. SENSE   │  Read roadmap.md, planning.md, STATE.md, backlog.md
  │  (Orient)   │  Identify current phase + next unchecked task
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  1. PLAN    │  Explore codebase → Draft todo list → Safety pre-check
  │  (Design)   │  Nyquist: verify no BLOCKED commands in plan
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  2. EXECUTE │  Work through todos: read → edit → mark complete
  │  (Build)    │  One task in_progress at a time, minimal diffs
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  3. VERIFY  │  Run tests → Run linters → Smoke test
  │  (Check)    │  Fix any failures before proceeding
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  4. UPDATE  │  roadmap.md: [ ] → [x]
  │  (Record)   │  planning.md: update focus section
  └──────┬──────┘  STATE.md: update if exists
         │
         ▼
  ┌─────────────┐
  │  5. SHIP    │  git commit → git push → summary report
  │  (Deliver)  │  "Phase N complete. Next: <upcoming work>"
  └─────────────┘
```

## Decision Priority

```
  User directive  >  CLAUDE.md constraints  >  Existing patterns  >  Minimal change  >  Roadmap order
```

## State File Locations

```
  project/
  ├── roadmap.md          # Phase/task tracking ([ ] / [x])
  ├── planning.md         # Current focus, principles
  ├── backlog.md          # Deferred work
  ├── AGENTS.md           # Architectural constraints
  ├── CLAUDE.md           # Project-level rules
  └── .suite/
      └── STATE.md        # Ephemeral execution state
```

## Command Classification (Nyquist Layer)

```
  SAFE     → auto-approved read-only (ls, cat, grep, git status)
  GUARDED  → needs awareness (rm, mv, git push, curl)
  BLOCKED  → never allowed (rm -rf, sudo, eval, pipe-to-shell)
```
