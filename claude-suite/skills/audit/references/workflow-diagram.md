# Audit Skill — Workflow Reference

## Execution Flow

```
  User: "/audit" or "security check"
         │
         ▼
  ┌──────────────┐
  │  0. DISCOVER │  Glob for shell scripts, CI configs, Dockerfiles,
  │  (Find)      │  Makefiles, package.json, JS exec/spawn calls
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  1. EXTRACT  │  Pull command strings from each file type
  │  (Parse)     │  Record: file, line, raw command, context
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  2. CLASSIFY │  Run each command through Nyquist classification
  │  (Analyze)   │  Tiers: BLOCKED → GUARDED → SAFE
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  3. REPORT   │  Structured markdown report with remediations
  │  (Output)    │  Compare with previous audit if snapshot exists
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  4. PERSIST  │  Save audit snapshot to Context Store
  │  (Store)     │  Enable trend tracking across runs
  └──────────────┘
```

## Nyquist Classification Tiers

```
  BLOCKED  → Never allowed (rm -rf /, sudo, eval, curl|sh)
             Action: Remediation required

  GUARDED  → Needs review (rm, mv, git push, curl, wget)
             Action: Review recommended

  SAFE     → Auto-approved (ls, cat, grep, echo, git status)
             Action: None needed
```

## Excluded Paths

```
  node_modules/    vendor/    dist/    build/
  .git/            __pycache__/    .tox/    .venv/
```
