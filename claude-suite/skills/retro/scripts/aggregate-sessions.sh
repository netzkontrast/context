#!/bin/bash
set -euo pipefail

# aggregate-sessions.sh — Aggregate session data for retrospective analysis
# Used by the /retro skill for cross-session metrics

SUITE_DIR="${1:-.suite}"

if [ ! -d "$SUITE_DIR" ]; then
  echo "No .suite directory found at: $SUITE_DIR"
  exit 1
fi

echo "=== SESSION AGGREGATION ==="
echo "Directory: $(realpath "$SUITE_DIR")"
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# Count sessions
if [ -d "$SUITE_DIR/context-store" ]; then
  session_count=$(find "$SUITE_DIR/context-store" -maxdepth 1 -type d | wc -l)
  session_count=$((session_count - 1))  # subtract the directory itself
  echo "Total sessions: $session_count"
else
  echo "No context-store directory found"
  session_count=0
fi

# Count telemetry files
if [ -d "$SUITE_DIR/telemetry" ]; then
  log_count=$(find "$SUITE_DIR/telemetry" -name "*.jsonl" | wc -l)
  echo "Telemetry log files: $log_count"

  # Total events across all logs
  total_events=0
  while read -r file; do
    count=$(wc -l < "$file")
    total_events=$((total_events + count))
  done < <(find "$SUITE_DIR/telemetry" -name "*.jsonl" -type f)
  echo "Total telemetry events: $total_events"
else
  echo "No telemetry directory found"
fi
echo ""

# Roadmap progress
if [ -f "roadmap.md" ]; then
  echo "--- ROADMAP PROGRESS ---"
  total_tasks=$(grep -c '^\- \[' roadmap.md 2>/dev/null || echo 0)
  done_tasks=$(grep -c '^\- \[x\]' roadmap.md 2>/dev/null || echo 0)
  remaining=$((total_tasks - done_tasks))
  if [ "$total_tasks" -gt 0 ]; then
    pct=$((done_tasks * 100 / total_tasks))
  else
    pct=0
  fi
  echo "Tasks: $done_tasks/$total_tasks complete ($pct%)"
  echo "Remaining: $remaining"

  # Count phases
  phase_count=$(grep -c '^## Phase' roadmap.md 2>/dev/null || echo 0)
  echo "Phases: $phase_count"
  echo ""
fi

echo "=== END ==="
