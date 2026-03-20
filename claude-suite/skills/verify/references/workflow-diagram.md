# Verify Skill — Workflow Reference

## Execution Flow

```
  User: "/verify" or "run tests"
         │
         ▼
  ┌──────────────┐
  │  0. DETECT   │  Discover: test runners, linters, formatters,
  │  (Discover)  │  type checkers. Nyquist-check all commands
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  1. EXECUTE  │  Run in order: type check → lint → format → test
  │  (Run)       │  Capture stdout, stderr, exit code, duration
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  2. ANALYZE  │  Parse results: pass/fail counts, error categories
  │  (Quantify)  │  Compute confidence score (100% minus deductions)
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  3. COMPARE  │  Load previous verification snapshot from Context Store
  │  (Trend)     │  Compute deltas: new failures, resolved issues, trend
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  4. REPORT   │  PASS/FAIL with confidence %, per-tool breakdown,
  │  (Output)    │  trend comparison, save snapshot for next time
  └──────────────┘
```

## Tool Execution Order

```
  1. Type Checkers  (tsc, mypy, pyright)     ← fastest feedback
  2. Linters        (eslint, ruff, clippy)    ← code quality
  3. Formatters     (prettier, black, gofmt)  ← style compliance
  4. Test Suites    (jest, pytest, cargo test) ← slowest, most valuable
```

## Confidence Score Formula

```
  Start: 100%
  - 10% per failed test
  -  5% per lint error
  -  3% per type error
  -  1% per format issue
  Floor: 0%
```

## Strict Mode (--strict)

```
  Normal:  warnings are reported but don't affect PASS/FAIL
  Strict:  warnings count as errors in confidence calculation
```
