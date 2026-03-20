# Retro Skill — Workflow Reference

## Execution Flow

```
  User: "/retro" or "retrospective"
         │
         ▼
  ┌──────────────┐
  │  0. GATHER   │  All sessions, telemetry events, roadmap state,
  │  (Collect)   │  token budgets. Filter by --phase or --all
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  1. AGGREGATE│  Cross-session metrics: duration, success rate,
  │  (Compute)   │  failure patterns, concurrency utilization
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  2. CORRELATE│  Map metrics to roadmap: velocity, effort
  │  (Connect)   │  distribution, bottleneck identification via DAG
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  3. SYNTHESIZE│ Retrospective document: progress, trends,
  │  (Analyze)    │ costs, top 3 issues, recommendations
  └──────┬────────┘
         │
         ▼
  ┌──────────────┐
  │  4. PERSIST  │  Save to Context Store. Optionally update
  │  (Store)     │  backlog.md with improvement items
  └──────────────┘
```

## Scope Options

```
  /retro              → Current phase sessions only
  /retro --phase 3    → Sessions for Phase 3 only
  /retro --all        → All sessions across project history
```

## Key Metrics

```
  Velocity:       tasks completed per session (trend over time)
  Effort:         agent-time and tokens per phase
  Efficiency:     tokens per completed task (lower = better)
  Reliability:    session success rate (higher = better)
  Utilization:    actual concurrent agents / configured max
```

## Failure Categories

```
  Nyquist blocks       → Security layer stopped a command
  Truth failures       → Output validation failed
  Timeouts             → Agent exceeded time limit
  Dependency failures  → Upstream agent failed
  Token exhaustion     → Budget depleted
```
