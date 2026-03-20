---
name: audit
description: >
  Proactive security auditor. Use when the user says "audit", "security check",
  "safety scan", "check for dangerous commands", or wants to scan the codebase
  for risky shell commands and unsafe patterns. Scans shell scripts, CI configs,
  Dockerfiles, Makefiles, and code files for commands that would be classified
  as GUARDED or BLOCKED by the Nyquist Layer. Produces a structured security
  report with risk ratings and remediation suggestions.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Agent
  - TodoWrite
metadata:
  version: "1.0.0"
  author: "claude-suite"
  category: "security"
---

# Audit — Security & Safety Auditor

Proactive security analysis skill that scans a project's codebase for commands classified as GUARDED or BLOCKED by the Nyquist Layer. Unlike `/dev` which only checks commands in its own execution plan, `/audit` scans the entire existing codebase retrospectively.

## Activation

Trigger on: `/audit`, `/audit <path>`, `/audit --full`, "security check", "safety scan", "check for dangerous commands".

The optional `<path>` narrows scope to a specific file or directory. `--full` forces a complete scan even if a recent audit snapshot exists.

---

## Phase 0: Discovery (DISCOVER)

Locate all files that may contain shell commands or executable code.

### 0.1 — Glob for Targets

```
Glob: **/*.sh, **/*.bash
Glob: **/Makefile, **/Dockerfile, **/docker-compose*.yml
Glob: **/.github/workflows/*.yml, **/.gitlab-ci.yml
Glob: **/package.json
Glob: **/*.js, **/*.ts (filter for exec/spawn/child_process usage)
```

### 0.2 — Filter Scope

If the user provided a `<path>`:
- Restrict all globbing to that subtree
- Report the narrowed scope to the user

If `--full` was not specified and a recent audit snapshot exists in the Context Store:
- Note the previous scan timestamp
- Still proceed (but will compare results later in Phase 4)

---

## Phase 1: Extraction (EXTRACT)

For each discovered file, extract command strings by file type:

| File Type | Extraction Method |
|-----------|------------------|
| `.sh`, `.bash` | Full file content — every line is a potential command |
| `Makefile` | Recipe lines (lines after target declarations, starting with tab) |
| `Dockerfile` | `RUN`, `CMD`, `ENTRYPOINT` directive arguments |
| `.yml` CI configs | `run:` field values, `script:` field values |
| `package.json` | Values from the `"scripts"` object |
| `.js`, `.ts` | String arguments to `exec()`, `execSync()`, `spawn()`, `spawnSync()` calls |

### 1.1 — Build Command Inventory

For each extracted command, record:
- **Source file** and line number
- **Raw command string**
- **Context** (e.g., CI job name, Makefile target, npm script name)

---

## Phase 2: Classification (CLASSIFY)

Run each extracted command through Nyquist classification logic.

### 2.1 — Classify Individual Commands

For each command in the inventory:
- Apply the Nyquist BLOCKED patterns: `rm -rf /`, `sudo`, `eval`, `curl | sh`, `:(){ :|:& };:`
- Apply the Nyquist GUARDED patterns: `rm`, `mv`, `git push`, `curl`, `wget`, network operations
- Everything else is SAFE

### 2.2 — Scan Code Blocks

For shell scripts and CI configs, also use block-level scanning:
- Detect piped-to-shell patterns (`curl ... | bash`, `wget ... | sh`)
- Detect environment variable injection in commands
- Detect use of `--force` or `--no-verify` flags
- Detect privilege escalation (`sudo`, `su`, `chmod 777`)

### 2.3 — Accumulate Results

Group findings by classification tier:
- **BLOCKED**: Commands that should never execute
- **GUARDED**: Commands that need awareness and approval
- **SAFE**: Commands with no security concerns

---

## Phase 3: Reporting (REPORT)

Generate a structured markdown security report.

### 3.1 — Report Structure

```markdown
# Security Audit Report
**Project:** <project name>
**Scan date:** <timestamp>
**Scope:** <full | path>
**Files scanned:** <count>
**Commands analyzed:** <count>

## Summary
| Classification | Count |
|---------------|-------|
| BLOCKED       | N     |
| GUARDED       | N     |
| SAFE          | N     |

## BLOCKED — Immediate Attention Required
| # | File | Line | Command | Pattern | Remediation |
|---|------|------|---------|---------|-------------|
| 1 | ...  | ...  | ...     | ...     | ...         |

## GUARDED — Review Recommended
| # | File | Line | Command | Reason |
|---|------|------|---------|--------|
| 1 | ...  | ...  | ...     | ...    |

## Comparison with Previous Audit
<delta if prior snapshot exists>
```

### 3.2 — Remediation Guidance

For each BLOCKED item, provide a specific remediation:
- `rm -rf` → use targeted `rm` with specific paths
- `curl | sh` → download first, inspect, then execute
- `eval` → use structured alternatives
- `sudo` → document why root access is needed, use rootless alternatives

---

## Phase 4: Persistence (PERSIST)

### 4.1 — Save Snapshot

Save the audit results to the Context Store for historical comparison:
- Key: `audit:<project>:<timestamp>`
- Value: structured JSON with all findings

### 4.2 — Compare with History

If a previous audit snapshot exists:
- Compute delta: new issues, resolved issues, unchanged issues
- Report trend direction: improving / degrading / stable

---

## Anti-Patterns (Do NOT)

- Don't scan node_modules, vendor, dist, or build output directories
- Don't classify comments or documentation as executable commands
- Don't flag standard safe operations (ls, cat, echo, git status) as concerns
- Don't produce false positives for properly scoped rm commands (e.g., `rm -f ./tmp/*.log`)
- Don't modify any files — this is a read-only analysis skill
