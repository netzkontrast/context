# Init Skill — Workflow Reference

## Execution Flow

```
  User: "/init" or "set up project"
         │
         ▼
  ┌──────────────┐
  │  0. DETECT   │  Survey directory: manifests, README, CI configs,
  │  (Scan)      │  test infrastructure. Check if .suite/ exists
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  1. INTERVIEW│  Present findings, ask about goals/phases/constraints
  │  (Ask)       │  Only ask what wasn't auto-detectable
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  2. GENERATE │  Create: PROJECT.md, roadmap.md, REQUIREMENTS.md,
  │  (Create)    │  STATE.md, planning.md. Validate roadmap via parser
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  3. BASELINE │  Lightweight Nyquist scan on existing scripts
  │  (Secure)    │  Create initial Context Store session
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  4. REPORT   │  Summary: stack, phases, files created
  │  (Summarize) │  Suggest: "Run /dev to begin Phase 1"
  └──────────────┘
```

## Tech Stack Detection

```
  package.json     → Node.js (npm/yarn/pnpm)
  Cargo.toml       → Rust (cargo)
  pyproject.toml   → Python (pip/poetry/uv)
  go.mod           → Go (modules)
  Gemfile          → Ruby (bundler)
  pom.xml          → Java (maven)
  build.gradle     → Java/Kotlin (gradle)
```

## Generated Files

```
  project/
  ├── PROJECT.md        # Stack info, description, conventions
  ├── roadmap.md        # Phased task list (validated by parser)
  ├── REQUIREMENTS.md   # Seeded from existing docs
  ├── planning.md       # Current focus, principles
  └── STATE.md          # Initialized to clean state
```
