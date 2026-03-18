# Diagnose Skill — Workflow Reference

## Execution Flow

```
  User: "/diagnose" or "what went wrong"
         │
         ▼
  ┌──────────────┐
  │  0. IDENTIFY │  Find target session (most recent, by ID, or list all)
  │  (Select)    │  Load session metadata from Context Store
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  1. COLLECT  │  Telemetry JSONL events, execution records,
  │  (Gather)    │  audit log, STATE.md, token budget data
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  2. ANALYZE  │  Timing breakdown, failure analysis,
  │  (Compute)   │  pattern detection (retries, timeouts, blocks)
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  3. CORRELATE│  Map failures → roadmap tasks via DAG
  │  (Connect)   │  Compare with historical diagnostic sessions
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  4. PRESCRIBE│  Root cause analysis, performance summary,
  │  (Recommend) │  specific action items, roadmap impact
  └──────────────┘
```

## Data Sources

```
  .suite/telemetry/*.jsonl   → Chronological event stream
  Context Store sessions     → Execution records, audit log
  STATE.md                   → Current status, blockers
  roadmap.md                 → Task dependencies (via DAG)
```

## Event Types (Telemetry)

```
  agent:spawn     → Agent started with task description
  agent:complete  → Agent finished successfully
  agent:fail      → Agent failed with error
  phase:start     → Phase transition began
  phase:end       → Phase transition completed
  command:classified → Nyquist classification event
```
