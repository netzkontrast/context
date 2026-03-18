---
name: verify
description: >
  Standalone verification and quality gate. Use when the user says "verify",
  "run tests", "check quality", "verify the build", or wants to run the
  project's full quality pipeline independently of the /dev lifecycle.
  Detects available test runners, linters, formatters, and type checkers,
  runs them all, and produces a structured pass/fail report with trend
  comparison against previous verification runs.
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
  category: "verification"
---

# Verify — Standalone Verification & Quality Gate

A purpose-built verification skill that runs the project's full quality gate pipeline independently of the `/dev` lifecycle. While `/dev` includes verification as one phase in a larger workflow, `/verify` is designed for on-demand quality checks, CI integration, and pre-merge validation. Produces structured pass/fail reports with trend tracking.

## Activation

Trigger on: `/verify`, `/verify --strict`, `/verify <path>`, "run tests", "check quality", "verify the build", "run all checks".

- Bare `/verify`: run all detected quality tools
- `--strict`: treat warnings as failures
- `<path>`: restrict scope to files in that path

---

## Phase 0: Detection (DETECT)

Discover what verification tooling is available.

### 0.1 — Detect Test Runners

| Indicator | Tool | Command |
|-----------|------|---------|
| `package.json` with `"test"` script | npm test | `npm test` |
| `jest.config.*` | Jest | `npx jest` |
| `vitest.config.*` | Vitest | `npx vitest run` |
| `Cargo.toml` | cargo test | `cargo test` |
| `pytest.ini` or `pyproject.toml [tool.pytest]` | pytest | `python -m pytest` |
| `go.mod` | go test | `go test ./...` |

### 0.2 — Detect Linters

| Indicator | Tool | Command |
|-----------|------|---------|
| `.eslintrc*` or `eslint.config.*` | ESLint | `npx eslint .` |
| `pyproject.toml [tool.ruff]` | Ruff | `ruff check .` |
| `.golangci.yml` | golangci-lint | `golangci-lint run` |
| `Cargo.toml` | Clippy | `cargo clippy` |

### 0.3 — Detect Formatters

| Indicator | Tool | Command |
|-----------|------|---------|
| `.prettierrc*` | Prettier | `npx prettier --check .` |
| `pyproject.toml [tool.black]` | Black | `black --check .` |
| `go.mod` | gofmt | `gofmt -l .` |
| `rustfmt.toml` | rustfmt | `cargo fmt --check` |

### 0.4 — Detect Type Checkers

| Indicator | Tool | Command |
|-----------|------|---------|
| `tsconfig.json` | TypeScript | `npx tsc --noEmit` |
| `pyproject.toml [tool.mypy]` | mypy | `mypy .` |
| `pyrightconfig.json` | pyright | `pyright` |

### 0.5 — Safety Check

Before executing any detected command:
- Classify it through Nyquist logic
- All standard test/lint/format commands should be SAFE
- If any command is GUARDED, warn the user before running
- Never execute BLOCKED commands

---

## Phase 1: Execution (EXECUTE)

Run each detected tool in a specific order for maximum value.

### 1.1 — Execution Order

1. **Type checkers** — catch type errors first (fastest feedback)
2. **Linters** — catch code quality issues
3. **Formatters** — check formatting compliance
4. **Test suite** — run full tests (slowest, most valuable)

### 1.2 — Per-Tool Execution

For each tool:
1. Log the start event (tool name, timestamp)
2. Execute the command
3. Capture stdout, stderr, and exit code
4. Log the completion event (tool name, duration, exit code)
5. Record the results

### 1.3 — Failure Handling

If a tool fails (non-zero exit):
- Record the failure but continue to the next tool
- Do NOT attempt to fix anything — just report
- Exception: if `--strict` is set, format warnings also count as failures

---

## Phase 2: Analysis (ANALYZE)

Parse and quantify results from each tool.

### 2.1 — Test Results

- Total tests: passed / failed / skipped
- Failed test names and error summaries
- Test coverage percentage (if reported)

### 2.2 — Lint Results

- Errors by rule/category
- Warnings by rule/category
- Files with most issues

### 2.3 — Type Check Results

- Type errors with file and line
- Error categories (missing types, incompatible types, etc.)

### 2.4 — Format Check Results

- Files with formatting issues
- Total files checked vs files needing changes

### 2.5 — Confidence Score

Compute an overall quality confidence:
- Start at 100%
- Subtract 10% per failed test
- Subtract 5% per lint error
- Subtract 3% per type error
- Subtract 1% per format issue
- Floor at 0%

---

## Phase 3: Comparison (COMPARE)

Compare against previous verification runs.

### 3.1 — Load Previous Results

Check Context Store for the most recent verification snapshot:
- Key pattern: `verify:<project>:*`
- If found, load the previous results

### 3.2 — Compute Deltas

| Metric | Previous | Current | Delta |
|--------|----------|---------|-------|
| Test pass rate | X% | Y% | +/-Z% |
| Lint errors | N | M | +/-K |
| Type errors | N | M | +/-K |
| Confidence | X% | Y% | +/-Z% |

Also identify:
- **New failures**: tests/checks that passed before but fail now
- **Resolved issues**: failures that are now fixed
- **Trend**: improving / degrading / stable

---

## Phase 4: Report (REPORT)

Produce the final verification report.

### 4.1 — Report Structure

```markdown
# Verification Report
**Project:** <name>
**Date:** <timestamp>
**Overall:** PASS ✓ | FAIL ✗
**Confidence:** N%

## Results Summary
| Tool | Status | Details | Duration |
|------|--------|---------|----------|
| TypeScript | ✓ pass | 0 errors | 1.2s |
| ESLint | ✗ fail | 3 errors, 5 warnings | 2.1s |
| Prettier | ✓ pass | all formatted | 0.8s |
| npm test | ✓ pass | 42/42 passing | 4.5s |

## Failures
<detailed list of each failure with file, line, and message>

## Trend (vs previous run)
<delta table from Phase 3>

## New Issues Since Last Run
<list of regressions>

## Resolved Since Last Run
<list of fixes>
```

### 4.2 — Save Snapshot

Save results to Context Store:
- Key: `verify:<project>:<timestamp>`
- Value: structured results for future comparison

---

## Anti-Patterns (Do NOT)

- Don't fix code — only report issues (that's `/dev`'s job)
- Don't run tools that aren't detected in the project
- Don't install missing tools — report them as unavailable
- Don't skip the comparison phase even if no previous snapshot exists (just note "first run")
- Don't run tests in watch mode — use single-run execution only
- Don't suppress tool output — capture everything for the report
