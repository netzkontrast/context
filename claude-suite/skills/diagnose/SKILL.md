---
name: diagnose
description: >
  Telemetry and execution diagnostician. Use when the user says "diagnose",
  "what went wrong", "why did it fail", "debug the last run", or wants to
  investigate execution failures, performance bottlenecks, or agent behavioral
  patterns. Analyzes telemetry logs, context store records, and STATE.md to
  produce actionable root cause analysis.
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
  category: "observability"
---

# Diagnose — Telemetry & Execution Diagnostician

Turns raw telemetry JSONL logs and Context Store records into actionable diagnostic insights. While the `replay` CLI command shows raw events, `/diagnose` interprets them — computing root causes, performance breakdowns, and recommended fixes.

## Activation

Trigger on: `/diagnose`, `/diagnose <session-id>`, `/diagnose --last`, "what went wrong", "why did it fail", "debug the last run", "show me execution stats".

- No argument or `--last`: analyze the most recent session
- `<session-id>`: analyze a specific session
- Bare `/diagnose`: show overview of all sessions with status indicators

---

## Phase 0: Identification (IDENTIFY)

Determine which session to diagnose.

### 0.1 — Locate Session Data

```
Glob: **/.suite/STATE.md
Glob: **/.suite/telemetry/*.jsonl
Glob: **/.suite/context-store/**
```

### 0.2 — Select Target Session

If `--last` or no argument:
- List all sessions from Context Store via `listSessions()`
- Select the most recent one by timestamp

If `<session-id>` provided:
- Load that session directly
- Error gracefully if not found

If bare `/diagnose` with no argument and no `--last`:
- Show a summary table of all sessions:

```
| Session | Date | Phase | Status | Duration | Agents |
|---------|------|-------|--------|----------|--------|
| abc123  | ...  | 3     | failed | 4m 12s   | 5      |
| def456  | ...  | 4     | done   | 2m 03s   | 3      |
```

- Ask the user which session to investigate

---

## Phase 1: Evidence Collection (COLLECT)

Gather all data for the target session.

### 1.1 — Telemetry Events

Read session telemetry logs (JSONL format):
- Parse each line as JSON
- Extract event types: `agent:spawn`, `agent:complete`, `agent:fail`, `phase:start`, `phase:end`, `command:classified`
- Build a timeline of events ordered by timestamp

### 1.2 — Execution Records

From the Context Store, retrieve:
- Session execution list via `getSessionExecutions()`
- Per-agent input, output, and status
- Audit log entries via `getAuditLog()`

### 1.3 — Token Budget

Retrieve token consumption data:
- `getSessionTokenBudget()` for the session's budget and actual usage
- Per-agent token breakdown if available

### 1.4 — State Data

Read STATE.md for:
- Current status and phase
- Blocker entries
- Error messages

---

## Phase 2: Analysis (ANALYZE)

Compute derived metrics from collected evidence.

### 2.1 — Timing Analysis

- **Total wall-clock time**: first event timestamp to last event timestamp
- **Per-agent duration**: spawn-to-complete/fail time for each agent
- **Phase duration**: time spent in each phase
- **Idle time**: gaps between agent completions and next spawns

### 2.2 — Failure Analysis

- **Failed agents**: which agents failed and their error messages
- **Failure rate**: failed / total agents per wave
- **Retry patterns**: did any task get retried? How many times?
- **Cascade failures**: did one agent's failure cause downstream failures?

### 2.3 — Pattern Detection

Look for systemic issues:
- **Repeated failures**: same task failing across multiple attempts
- **Timeout patterns**: agents consistently hitting time limits
- **Nyquist blocks**: commands being classified as BLOCKED during execution
- **Token exhaustion**: agents running out of token budget
- **Concurrency bottlenecks**: waves running with fewer agents than configured

---

## Phase 3: Correlation (CORRELATE)

Map findings back to project structure.

### 3.1 — Roadmap Mapping

Using the Roadmap Parser:
- Identify which roadmap phase and task the failed agent was working on
- Show the task's position in the dependency DAG
- Identify downstream tasks that are now blocked

### 3.2 — Historical Comparison

If previous diagnostic sessions exist:
- Compare failure rates across sessions
- Identify recurring issues
- Note improvements or regressions

---

## Phase 4: Prescription (PRESCRIBE)

Produce actionable recommendations.

### 4.1 — Diagnostic Report

```markdown
# Diagnostic Report: Session <id>
**Date:** <timestamp>
**Phase:** <N>
**Duration:** <wall-clock time>
**Status:** <completed | failed | partial>

## Root Cause Analysis
<What failed and why, in 2-3 sentences>

## Timeline
<Chronological sequence of key events>

## Performance Breakdown
| Metric | Value |
|--------|-------|
| Total agents spawned | N |
| Successful | N |
| Failed | N |
| Total tokens consumed | N |
| Wall-clock time | Xm Ys |

## Agent Details
| Agent | Task | Duration | Status | Tokens |
|-------|------|----------|--------|--------|
| ...   | ...  | ...      | ...    | ...    |

## Recommended Actions
1. <specific, actionable recommendation>
2. <specific, actionable recommendation>

## Roadmap Impact
- Blocked tasks: <list of downstream tasks affected>
- Suggested roadmap adjustments: <if any>
```

---

## Anti-Patterns (Do NOT)

- Don't read telemetry files line by line in the output — summarize them
- Don't guess at root causes without evidence from the logs
- Don't recommend "try again" as the sole action — identify what to change
- Don't modify any telemetry or state files — this is a read-only analysis skill
- Don't load all telemetry files at once for large projects — scope to the target session
