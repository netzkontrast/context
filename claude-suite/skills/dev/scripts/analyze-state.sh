#!/bin/bash
set -euo pipefail

# analyze-state.sh — Quick project state analyzer
# Outputs a structured summary of the current development state
# Used by the /dev skill for rapid orientation

PROJECT_DIR="${1:-.}"

echo "=== PROJECT STATE ANALYSIS ==="
echo "Directory: $(realpath "$PROJECT_DIR")"
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# Detect roadmap phase
if [ -f "$PROJECT_DIR/roadmap.md" ]; then
  echo "--- ROADMAP ---"
  # Find current phase (first phase with unchecked items)
  current_phase=""
  while IFS= read -r line; do
    if [[ "$line" =~ ^##\s+Phase ]]; then
      current_phase="$line"
    fi
    if [[ "$line" =~ ^-\ \[\ \] && -n "$current_phase" ]]; then
      echo "Current: $current_phase"
      echo "Next task: $line"
      break
    fi
  done < "$PROJECT_DIR/roadmap.md"

  # Count progress
  total=$(grep -c '^\- \[' "$PROJECT_DIR/roadmap.md" 2>/dev/null || echo 0)
  done=$(grep -c '^\- \[x\]' "$PROJECT_DIR/roadmap.md" 2>/dev/null || echo 0)
  echo "Progress: $done/$total tasks complete"
  echo ""
fi

# Detect blockers
if [ -f "$PROJECT_DIR/.suite/STATE.md" ]; then
  echo "--- STATE ---"
  status=$(grep -oP 'Status\*\*:\s*\K\w+' "$PROJECT_DIR/.suite/STATE.md" 2>/dev/null || echo "unknown")
  echo "Execution status: $status"
  blocker_count=$(grep -c '^\-.*BLOCKED\|^\-.*failed\|^\-.*error' "$PROJECT_DIR/.suite/STATE.md" 2>/dev/null || echo 0)
  echo "Blockers: $blocker_count"
  echo ""
fi

# Detect backlog
if [ -f "$PROJECT_DIR/backlog.md" ]; then
  echo "--- BACKLOG ---"
  backlog_count=$(grep -c '^\- \[' "$PROJECT_DIR/backlog.md" 2>/dev/null || echo 0)
  echo "Backlog items: $backlog_count"
  echo ""
fi

# Detect tech stack
echo "--- TECH STACK ---"
[ -f "$PROJECT_DIR/package.json" ] && echo "Node.js (package.json found)"
[ -f "$PROJECT_DIR/Cargo.toml" ] && echo "Rust (Cargo.toml found)"
[ -f "$PROJECT_DIR/pyproject.toml" ] && echo "Python (pyproject.toml found)"
[ -f "$PROJECT_DIR/go.mod" ] && echo "Go (go.mod found)"
[ -f "$PROJECT_DIR/Gemfile" ] && echo "Ruby (Gemfile found)"

# Detect test/lint infrastructure
echo ""
echo "--- INFRASTRUCTURE ---"
[ -f "$PROJECT_DIR/package.json" ] && grep -q '"test"' "$PROJECT_DIR/package.json" 2>/dev/null && echo "Tests: npm test"
[ -f "$PROJECT_DIR/.eslintrc.js" ] || [ -f "$PROJECT_DIR/.eslintrc.json" ] || [ -f "$PROJECT_DIR/eslint.config.js" ] && echo "Linter: eslint"
[ -f "$PROJECT_DIR/.prettierrc" ] || [ -f "$PROJECT_DIR/.prettierrc.json" ] && echo "Formatter: prettier"

echo ""
echo "=== END ==="
