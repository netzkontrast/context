#!/bin/bash
set -euo pipefail

# detect-tools.sh — Detect available verification tools in a project
# Used by the /verify skill for tool discovery

PROJECT_DIR="${1:-.}"

echo "=== VERIFICATION TOOL DETECTION ==="
echo "Directory: $(realpath "$PROJECT_DIR")"
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# Track what was found
found_any=false

# Test runners
echo "--- TEST RUNNERS ---"
if [ -f "$PROJECT_DIR/package.json" ] && grep -q '"test"' "$PROJECT_DIR/package.json" 2>/dev/null; then
  echo "FOUND: npm test"
  found_any=true
fi
if [ -f "$PROJECT_DIR/jest.config.js" ] || [ -f "$PROJECT_DIR/jest.config.ts" ] || [ -f "$PROJECT_DIR/jest.config.mjs" ]; then
  echo "FOUND: jest"
  found_any=true
fi
if [ -f "$PROJECT_DIR/vitest.config.js" ] || [ -f "$PROJECT_DIR/vitest.config.ts" ]; then
  echo "FOUND: vitest"
  found_any=true
fi
[ -f "$PROJECT_DIR/Cargo.toml" ] && echo "FOUND: cargo test" && found_any=true
[ -f "$PROJECT_DIR/pytest.ini" ] && echo "FOUND: pytest" && found_any=true
if [ -f "$PROJECT_DIR/pyproject.toml" ] && grep -q '\[tool.pytest\]' "$PROJECT_DIR/pyproject.toml" 2>/dev/null; then
  echo "FOUND: pytest (via pyproject.toml)"
  found_any=true
fi
[ -f "$PROJECT_DIR/go.mod" ] && echo "FOUND: go test" && found_any=true
echo ""

# Linters
echo "--- LINTERS ---"
if [ -f "$PROJECT_DIR/.eslintrc.js" ] || [ -f "$PROJECT_DIR/.eslintrc.json" ] || [ -f "$PROJECT_DIR/.eslintrc.yml" ] || [ -f "$PROJECT_DIR/eslint.config.js" ] || [ -f "$PROJECT_DIR/eslint.config.mjs" ]; then
  echo "FOUND: eslint"
  found_any=true
fi
if [ -f "$PROJECT_DIR/pyproject.toml" ] && grep -q '\[tool.ruff\]' "$PROJECT_DIR/pyproject.toml" 2>/dev/null; then
  echo "FOUND: ruff"
  found_any=true
fi
[ -f "$PROJECT_DIR/.golangci.yml" ] && echo "FOUND: golangci-lint" && found_any=true
[ -f "$PROJECT_DIR/Cargo.toml" ] && echo "FOUND: clippy (cargo clippy)" && found_any=true
echo ""

# Formatters
echo "--- FORMATTERS ---"
if [ -f "$PROJECT_DIR/.prettierrc" ] || [ -f "$PROJECT_DIR/.prettierrc.json" ] || [ -f "$PROJECT_DIR/.prettierrc.js" ]; then
  echo "FOUND: prettier"
  found_any=true
fi
if [ -f "$PROJECT_DIR/pyproject.toml" ] && grep -q '\[tool.black\]' "$PROJECT_DIR/pyproject.toml" 2>/dev/null; then
  echo "FOUND: black"
  found_any=true
fi
[ -f "$PROJECT_DIR/go.mod" ] && echo "FOUND: gofmt" && found_any=true
[ -f "$PROJECT_DIR/rustfmt.toml" ] && echo "FOUND: rustfmt" && found_any=true
echo ""

# Type checkers
echo "--- TYPE CHECKERS ---"
[ -f "$PROJECT_DIR/tsconfig.json" ] && echo "FOUND: tsc (TypeScript)" && found_any=true
if [ -f "$PROJECT_DIR/pyproject.toml" ] && grep -q '\[tool.mypy\]' "$PROJECT_DIR/pyproject.toml" 2>/dev/null; then
  echo "FOUND: mypy"
  found_any=true
fi
[ -f "$PROJECT_DIR/pyrightconfig.json" ] && echo "FOUND: pyright" && found_any=true
echo ""

if [ "$found_any" = false ]; then
  echo "WARNING: No verification tools detected in this project."
fi

echo "=== END ==="
