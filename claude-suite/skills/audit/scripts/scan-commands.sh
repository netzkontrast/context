#!/bin/bash
set -euo pipefail

# scan-commands.sh — Extract executable commands from project files
# Used by the /audit skill for command discovery and extraction

PROJECT_DIR="${1:-.}"

echo "=== COMMAND SCAN ==="
echo "Directory: $(realpath "$PROJECT_DIR")"
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# Excluded directories
EXCLUDE_DIRS="node_modules|vendor|dist|build|\.git|__pycache__|\.tox|\.venv|\.next|coverage"

# Scan shell scripts
echo "--- SHELL SCRIPTS ---"
find "$PROJECT_DIR" -type f \( -name "*.sh" -o -name "*.bash" \) \
  | grep -vE "$EXCLUDE_DIRS" \
  | while read -r file; do
    line_count=$(wc -l < "$file")
    echo "  $file ($line_count lines)"
  done
echo ""

# Scan Dockerfiles
echo "--- DOCKERFILES ---"
find "$PROJECT_DIR" -type f -name "Dockerfile*" \
  | grep -vE "$EXCLUDE_DIRS" \
  | while read -r file; do
    run_count=$(grep -c '^\s*RUN\|^\s*CMD\|^\s*ENTRYPOINT' "$file" 2>/dev/null || echo 0)
    echo "  $file ($run_count command directives)"
  done
echo ""

# Scan CI configs
echo "--- CI CONFIGS ---"
find "$PROJECT_DIR" -type f \( -path "*/.github/workflows/*.yml" -o -name ".gitlab-ci.yml" -o -name "Jenkinsfile" \) \
  | grep -vE "$EXCLUDE_DIRS" \
  | while read -r file; do
    run_count=$(grep -c '^\s*run:' "$file" 2>/dev/null || echo 0)
    echo "  $file ($run_count run steps)"
  done
echo ""

# Scan Makefiles
echo "--- MAKEFILES ---"
find "$PROJECT_DIR" -type f -name "Makefile" \
  | grep -vE "$EXCLUDE_DIRS" \
  | while read -r file; do
    target_count=$(grep -c '^[a-zA-Z_-]*:' "$file" 2>/dev/null || echo 0)
    echo "  $file ($target_count targets)"
  done
echo ""

# Scan package.json scripts
echo "--- PACKAGE.JSON SCRIPTS ---"
find "$PROJECT_DIR" -type f -name "package.json" \
  | grep -vE "$EXCLUDE_DIRS" \
  | while read -r file; do
    if command -v node &>/dev/null; then
      script_count=$(node -e "try{const p=require('$file');console.log(Object.keys(p.scripts||{}).length)}catch(e){console.log(0)}" 2>/dev/null || echo 0)
      echo "  $file ($script_count scripts)"
    else
      echo "  $file (node not available for parsing)"
    fi
  done
echo ""

# Scan JS/TS for exec/spawn calls
echo "--- JS/TS EXEC/SPAWN ---"
find "$PROJECT_DIR" -type f \( -name "*.js" -o -name "*.ts" \) \
  | grep -vE "$EXCLUDE_DIRS" \
  | while read -r file; do
    exec_count=$(grep -cE 'exec\(|execSync\(|spawn\(|spawnSync\(' "$file" 2>/dev/null || echo 0)
    if [ "$exec_count" -gt 0 ]; then
      echo "  $file ($exec_count exec/spawn calls)"
    fi
  done
echo ""

echo "=== END ==="
