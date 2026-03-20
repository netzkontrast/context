---
name: retro
description: >
  Execution retrospective and learning extractor. Use when the user says "retro",
  "retrospective", "what did we learn", "summarize progress", "show me trends",
  or wants to analyze patterns across multiple execution sessions. Aggregates
  telemetry data, correlates with roadmap progress, identifies systemic issues,
  and produces actionable recommendations for improving future execution runs.
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
  category: "analysis"
---

# Retro — Execution Retrospective & Learning Extractor

A cross-session analysis skill that identifies patterns in agent behavior, tracks progress against the roadmap, and extracts systemic insights for optimization. While `/diagnose` debugs a single session, `/retro` looks across all sessions to find trends and recommend improvements.

## Activation

Trigger on: `/retro`, `/retro --phase <n>`, `/retro --all`, "retrospective", "what did we learn", "summarize progress", "show me trends".

- Bare `/retro`: analyze sessions from the current phase
- `--phase <n>`: analyze sessions for a specific phase
- `--all`: analyze all sessions across the entire project history

---

## Phase 0: Data Gathering (GATHER)

Collect all available historical data.

### 0.1 — Session Inventory

```
Glob: **/.suite/telemetry/*.jsonl
Glob: **/.suite/context-store/**
```

From the Context Store:
- List all sessions via `listSessions()`
- For each session: ID, date, phase, status, agent count
- Filter by scope (`--phase` or `--all`)

### 0.2 — Telemetry Events

Read all telemetry log files within scope:
- Parse JSONL events
- Build a unified timeline across sessions
- Extract event types: spawn, complete, fail, phase transitions, command classifications

### 0.3 — Roadmap State

Read the current roadmap:
- Total tasks, completed tasks, remaining tasks
- Phase-by-phase completion percentages
- Build the dependency DAG for bottleneck analysis

### 0.4 — Token Data

For each session in scope:
- Retrieve token budget via `getSessionTokenBudget()`
- Compute per-session token consumption
- Track budget utilization rates

---

## Phase 1: Aggregation (AGGREGATE)

Compute cross-session metrics.

### 1.1 — Execution Metrics

| Metric | Computation |
|--------|-------------|
| **Average session duration** | Mean wall-clock time across sessions |
| **Average agents per session** | Mean agent count |
| **Success rate** | Successful sessions / total sessions |
| **Average agent duration** | Mean time per agent across all sessions |
| **Failure rate by phase** | Failed sessions / sessions per phase |

### 1.2 — Common Failure Patterns

Categorize all failures across sessions:
- **Nyquist blocks**: commands stopped by security layer
- **Truth verification failures**: outputs that failed validation
- **Timeouts**: agents that exceeded time limits
- **Dependency failures**: agents that failed because a dependency failed
- **Token exhaustion**: agents that ran out of budget

Rank by frequency to identify the most common failure modes.

### 1.3 — Concurrency Utilization

For each wave across all sessions:
- Configured concurrency (max parallel agents)
- Actual concurrency (agents that ran simultaneously)
- Utilization rate = actual / configured

---

## Phase 2: Correlation (CORRELATE)

Map metrics to roadmap progress.

### 2.1 — Velocity

- **Tasks per session**: completed roadmap items per execution session
- **Tasks per day**: if timestamps span multiple days
- **Velocity trend**: is task completion accelerating or decelerating?

### 2.2 — Effort Distribution

| Phase | Sessions | Total Agent-Time | Total Tokens | Tasks Completed |
|-------|----------|------------------|--------------|-----------------|
| 1     | N        | Xm               | N            | M               |
| 2     | N        | Xm               | N            | M               |

Identify which phases consumed disproportionate effort relative to task count.

### 2.3 — Bottleneck Identification

Using the roadmap DAG:
- Which tasks were on the critical path?
- Which tasks blocked the most downstream work when they failed?
- Which phases had the most retry attempts?

---

## Phase 3: Synthesis (SYNTHESIZE)

Produce a retrospective document.

### 3.1 — Retrospective Report

```markdown
# Retrospective: <scope>
**Date:** <timestamp>
**Sessions analyzed:** <count>
**Time period:** <first session date> to <last session date>

## Progress Summary
- Phases completed: N/M
- Tasks completed: N/M (X%)
- Total sessions: N
- Total agent-time: Xh Ym
- Total tokens consumed: N

## Velocity
- Average tasks per session: N
- Trend: accelerating | stable | decelerating
<sparkline or trend indicator>

## Performance Trends
| Metric | First Half | Second Half | Trend |
|--------|-----------|-------------|-------|
| Avg session duration | Xm | Ym | ↑/↓/→ |
| Success rate | X% | Y% | ↑/↓/→ |
| Token efficiency | X tok/task | Y tok/task | ↑/↓/→ |

## Cost Analysis
- Total tokens: N
- Tokens per completed task: N
- Most expensive phase: Phase X (N tokens)
- Trend: costs increasing | stable | decreasing

## Top 3 Systemic Issues
1. **<Issue>**: <description, frequency, impact>
   - Recommended mitigation: <specific action>
2. **<Issue>**: <description, frequency, impact>
   - Recommended mitigation: <specific action>
3. **<Issue>**: <description, frequency, impact>
   - Recommended mitigation: <specific action>

## Suggested Roadmap Adjustments
- <specific recommendations based on data>

## What Went Well
- <positive patterns worth preserving>
```

---

## Phase 4: Persistence (PERSIST)

Save and distribute findings.

### 4.1 — Save to Context Store

Save the retrospective document:
- Key: `retro:<scope>:<timestamp>`
- Include raw metrics for future retrospectives to compare against

### 4.2 — Update Backlog (Optional)

If systemic issues suggest new work items:
- Propose additions to `backlog.md`
- Only write with user confirmation
- Format: `- **<title>**: <description> (identified by /retro on <date>)`

### 4.3 — Final Summary

```
Retrospective complete
  Sessions analyzed: N
  Period: <date range>
  Velocity: X tasks/session (trend: <direction>)
  Top issue: <#1 systemic issue>
  Recommendation: <most impactful suggested action>
```

---

## Decision Framework

When facing analysis choices:

1. **Statistical significance** — don't draw conclusions from fewer than 3 data points
2. **Actionability** — every finding should have a recommended action
3. **Specificity** — "Phase 3 tasks take 2x longer than Phase 2" over "some things are slow"
4. **Honesty** — if data is insufficient, say so rather than speculate

## Anti-Patterns (Do NOT)

- Don't analyze sessions that are still in progress
- Don't recommend vague improvements like "be more careful" — be specific
- Don't compare phases with vastly different task complexity without noting the difference
- Don't produce retrospectives with only negative findings — include what went well
- Don't modify telemetry or execution records — this is a read-only analysis skill (except backlog)
