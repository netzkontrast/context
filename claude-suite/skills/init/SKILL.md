---
name: init
description: >
  Intelligent project scaffolder. Use when the user says "init", "initialize",
  "scaffold", "set up a new project", "onboard this repo", or wants to transform
  an existing repository into a claude-suite-managed project. Goes beyond template
  copying by analyzing existing code, detecting tech stack, generating a tailored
  roadmap, and configuring the .suite directory with project-specific settings.
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
  category: "project-setup"
---

# Init — Intelligent Project Scaffolder

An intelligent project onboarding skill that analyzes existing codebases and generates tailored claude-suite project files. Unlike the `new-project` CLI command which copies bare templates, `/init` detects the tech stack, reads existing documentation, and produces a roadmap that reflects the project's actual state and goals.

## Activation

Trigger on: `/init`, `/init <project-name>`, "scaffold a project", "set up a new project", "initialize project", "onboard this repo".

The optional `<project-name>` sets the project name. If omitted, derive from the directory name or package manifest.

---

## Phase 0: Detection (DETECT)

Survey the current directory to understand what already exists.

### 0.1 — Check for Existing Suite

```
Glob: .suite/**, roadmap.md, planning.md, PROJECT.md
```

If `.suite/` or `roadmap.md` already exists:
- Warn the user: "This project already has suite files. Use `/dev` to continue development."
- Offer to re-initialize only missing files (non-destructive merge)
- Abort if user declines

### 0.2 — Detect Tech Stack

Scan for manifest files:

| Manifest | Stack | Package Manager |
|----------|-------|-----------------|
| `package.json` | Node.js | npm / yarn / pnpm |
| `Cargo.toml` | Rust | cargo |
| `pyproject.toml` | Python | pip / poetry / uv |
| `go.mod` | Go | go modules |
| `Gemfile` | Ruby | bundler |
| `pom.xml` | Java | maven |
| `build.gradle` | Java/Kotlin | gradle |

### 0.3 — Read Existing Documentation

```
Glob: README*, CONTRIBUTING*, docs/**/*.md, ARCHITECTURE*
```

For each found document, extract:
- Project description and purpose
- Architecture overview
- Contributing guidelines and conventions
- Existing development workflow

### 0.4 — Detect Infrastructure

```
Glob: .github/workflows/*.yml, .gitlab-ci.yml, Jenkinsfile
Glob: Dockerfile, docker-compose*.yml
Glob: .eslintrc*, eslint.config*, .prettierrc*, tsconfig.json
Glob: jest.config*, vitest.config*, pytest.ini, .mocharc*
```

Record what CI, testing, linting, and containerization exists.

---

## Phase 1: Interview (INTERVIEW)

Present findings and gather user input.

### 1.1 — Present Detection Summary

```
Detected project: <name>
Tech stack: <language + framework>
Test infrastructure: <runner>
CI/CD: <platform>
Existing docs: <list>
```

### 1.2 — Ask Targeted Questions

Only ask what wasn't detectable:

1. **Project description** — if README lacks a clear summary
2. **Development goals** — "What are the main things you want to build? List 3-5 goals."
3. **Phase structure** — "How would you like to organize the work? (e.g., foundation → features → polish)"
4. **Constraints** — "Any architectural rules or forbidden patterns?"

Do NOT ask about things that can be auto-detected (tech stack, test runner, etc).

---

## Phase 2: Generation (GENERATE)

Create tailored project files.

### 2.1 — PROJECT.md

Generate from detected stack and user description:
```markdown
# <Project Name>

<description from README or user input>

## Tech Stack
- Language: <detected>
- Framework: <detected>
- Test Runner: <detected>
- CI/CD: <detected>

## Conventions
<extracted from CONTRIBUTING or detected from config files>
```

### 2.2 — ROADMAP.md

Generate from user's development goals:
- Create phases with `## Phase N: <name>` headings
- Each phase gets 3-7 `- [ ]` task items
- Tasks should be specific and atomic
- Order phases by dependency (foundations first)

**Validation**: Run the generated roadmap through the Roadmap Parser's `parseRoadmap()` and `buildDAG()` to ensure it is correctly formatted and parseable. Fix any issues before writing.

### 2.3 — REQUIREMENTS.md

Seed from existing documentation:
- Extract requirements from README feature descriptions
- Extract from existing issue trackers if accessible
- Format as structured requirement items with IDs

### 2.4 — STATE.md

Initialize to clean state:
```markdown
# Project State

**Status**: initialized
**Current Phase**: 1
**Last Updated**: <timestamp>

## Blockers
None

## Notes
Project initialized by /init skill.
```

### 2.5 — planning.md

Create initial planning document:
```markdown
# Planning

## Current Focus
Phase 1: <first phase name from roadmap>

## Principles
<from user constraints or detected conventions>
```

---

## Phase 3: Baseline (BASELINE)

Establish the project's security baseline.

### 3.1 — Security Scan

Run a lightweight security check on existing scripts:
- Scan shell scripts, CI configs, and package.json scripts
- Use Nyquist classification logic
- Record findings but do NOT block initialization

### 3.2 — Create Context Store Session

Initialize the first Context Store session:
- Save a project snapshot with the detected state
- Record the initialization event

---

## Phase 4: Report (REPORT)

Summarize what was created.

### 4.1 — Output Summary

```
Project initialized: <name>
  Stack: <language + framework>
  Roadmap: <N phases, M total tasks>
  Files created: PROJECT.md, roadmap.md, REQUIREMENTS.md, STATE.md, planning.md
  Security baseline: <N findings>

  Next step: Run /dev to begin Phase 1
```

---

## Anti-Patterns (Do NOT)

- Don't overwrite existing files without explicit user consent
- Don't generate vague roadmap items like "Implement features" — be specific
- Don't ask the user questions that can be auto-detected
- Don't create a .suite directory if it already exists (offer merge instead)
- Don't generate more than 7 phases in a roadmap — keep it focused
- Don't add dependencies or install packages — only create markdown files
