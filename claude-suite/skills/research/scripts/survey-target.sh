#!/bin/bash
set -euo pipefail

# survey-target.sh — Quick structural survey of a research target
# Used by the /research skill for the initial Survey phase

TARGET="${1:-.}"

echo "=== RESEARCH SURVEY ==="
echo "Target: $(realpath "$TARGET")"
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

if [ -f "$TARGET" ]; then
  # Single file analysis
  echo "Type: Single File"
  echo "Size: $(wc -l < "$TARGET") lines"
  echo "Extension: ${TARGET##*.}"
  echo ""

  echo "--- STRUCTURE ---"
  # Extract headings (markdown)
  if [[ "$TARGET" == *.md ]]; then
    grep '^#' "$TARGET" 2>/dev/null | head -20
  fi

  # Extract function/class definitions (JS/TS)
  if [[ "$TARGET" == *.js || "$TARGET" == *.ts ]]; then
    grep -nE '^\s*(export\s+)?(async\s+)?function\s+|^\s*(export\s+)?class\s+|^\s*module\.exports' "$TARGET" 2>/dev/null | head -20
  fi

  # Extract function/class definitions (Python)
  if [[ "$TARGET" == *.py ]]; then
    grep -nE '^\s*(def|class|async def)\s+' "$TARGET" 2>/dev/null | head -20
  fi

elif [ -d "$TARGET" ]; then
  # Directory analysis
  echo "Type: Directory"

  # Count files by extension
  echo ""
  echo "--- FILE DISTRIBUTION ---"
  find "$TARGET" -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/vendor/*' \
    | sed 's/.*\.//' | sort | uniq -c | sort -rn | head -15

  echo ""
  echo "--- KEY FILES ---"
  # Look for entry points and important files
  for name in index.js index.ts main.js main.ts app.js app.ts lib.rs main.rs main.py app.py main.go README.md package.json Cargo.toml pyproject.toml go.mod; do
    found=$(find "$TARGET" -name "$name" -not -path '*/node_modules/*' 2>/dev/null | head -3)
    if [ -n "$found" ]; then
      echo "  $found"
    fi
  done

  echo ""
  echo "--- DIRECTORY STRUCTURE (depth 2) ---"
  find "$TARGET" -maxdepth 2 -type d -not -path '*/node_modules/*' -not -path '*/.git/*' | sort | head -30

else
  echo "Target not found: $TARGET"
  exit 1
fi

echo ""
echo "=== END ==="
