#!/bin/bash
set -euo pipefail

# parse-telemetry.sh — Parse and summarize telemetry JSONL logs
# Used by the /diagnose skill for quick event analysis

TELEMETRY_DIR="${1:-.suite/telemetry}"

if [ ! -d "$TELEMETRY_DIR" ]; then
  echo "No telemetry directory found at: $TELEMETRY_DIR"
  exit 1
fi

echo "=== TELEMETRY SUMMARY ==="
echo "Directory: $(realpath "$TELEMETRY_DIR")"
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# Count log files
log_count=$(find "$TELEMETRY_DIR" -name "*.jsonl" | wc -l)
echo "Log files: $log_count"
echo ""

# Process each log file
find "$TELEMETRY_DIR" -name "*.jsonl" -type f | sort | while read -r file; do
  echo "--- $(basename "$file") ---"
  total_events=$(wc -l < "$file")
  echo "  Total events: $total_events"

  if command -v node &>/dev/null; then
    # Use node for JSON parsing if available
    node -e "
      const fs = require('fs');
      const lines = fs.readFileSync('$file', 'utf8').trim().split('\n');
      const events = lines.map(l => { try { return JSON.parse(l); } catch(e) { return null; } }).filter(Boolean);
      const types = {};
      events.forEach(e => { types[e.type || e.event || 'unknown'] = (types[e.type || e.event || 'unknown'] || 0) + 1; });
      console.log('  Event types:');
      Object.entries(types).sort((a,b) => b[1]-a[1]).forEach(([t,c]) => console.log('    ' + t + ': ' + c));
      if (events.length > 0) {
        const first = events[0].timestamp || events[0].ts || '';
        const last = events[events.length-1].timestamp || events[events.length-1].ts || '';
        if (first && last) {
          console.log('  Time range: ' + first + ' to ' + last);
        }
      }
    " 2>/dev/null || echo "  (Could not parse JSON)"
  else
    echo "  (node not available for detailed parsing)"
  fi
  echo ""
done

echo "=== END ==="
