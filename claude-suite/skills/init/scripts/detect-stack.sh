#!/bin/bash
set -euo pipefail

# detect-stack.sh — Detect project tech stack and infrastructure
# Used by the /init skill for project analysis during onboarding

PROJECT_DIR="${1:-.}"

echo "=== STACK DETECTION ==="
echo "Directory: $(realpath "$PROJECT_DIR")"
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# Detect language/framework
echo "--- LANGUAGE & FRAMEWORK ---"
[ -f "$PROJECT_DIR/package.json" ] && echo "Node.js (package.json)"
[ -f "$PROJECT_DIR/Cargo.toml" ] && echo "Rust (Cargo.toml)"
[ -f "$PROJECT_DIR/pyproject.toml" ] && echo "Python (pyproject.toml)"
[ -f "$PROJECT_DIR/go.mod" ] && echo "Go (go.mod)"
[ -f "$PROJECT_DIR/Gemfile" ] && echo "Ruby (Gemfile)"
[ -f "$PROJECT_DIR/pom.xml" ] && echo "Java/Maven (pom.xml)"
[ -f "$PROJECT_DIR/build.gradle" ] && echo "Java/Kotlin/Gradle (build.gradle)"
echo ""

# Detect package manager
echo "--- PACKAGE MANAGER ---"
[ -f "$PROJECT_DIR/package-lock.json" ] && echo "npm"
[ -f "$PROJECT_DIR/yarn.lock" ] && echo "yarn"
[ -f "$PROJECT_DIR/pnpm-lock.yaml" ] && echo "pnpm"
[ -f "$PROJECT_DIR/Cargo.lock" ] && echo "cargo"
[ -f "$PROJECT_DIR/poetry.lock" ] && echo "poetry"
[ -f "$PROJECT_DIR/uv.lock" ] && echo "uv"
[ -f "$PROJECT_DIR/Gemfile.lock" ] && echo "bundler"
echo ""

# Detect test infrastructure
echo "--- TEST INFRASTRUCTURE ---"
[ -f "$PROJECT_DIR/jest.config.js" ] || [ -f "$PROJECT_DIR/jest.config.ts" ] && echo "Jest"
[ -f "$PROJECT_DIR/vitest.config.js" ] || [ -f "$PROJECT_DIR/vitest.config.ts" ] && echo "Vitest"
[ -f "$PROJECT_DIR/pytest.ini" ] && echo "Pytest"
[ -f "$PROJECT_DIR/.mocharc.yml" ] || [ -f "$PROJECT_DIR/.mocharc.json" ] && echo "Mocha"
if [ -f "$PROJECT_DIR/package.json" ]; then
  grep -q '"test"' "$PROJECT_DIR/package.json" 2>/dev/null && echo "npm test script defined"
fi
echo ""

# Detect linters
echo "--- LINTERS ---"
[ -f "$PROJECT_DIR/.eslintrc.js" ] || [ -f "$PROJECT_DIR/.eslintrc.json" ] || [ -f "$PROJECT_DIR/eslint.config.js" ] && echo "ESLint"
[ -f "$PROJECT_DIR/.golangci.yml" ] && echo "golangci-lint"
if [ -f "$PROJECT_DIR/pyproject.toml" ]; then
  grep -q '\[tool.ruff\]' "$PROJECT_DIR/pyproject.toml" 2>/dev/null && echo "Ruff"
fi
echo ""

# Detect formatters
echo "--- FORMATTERS ---"
[ -f "$PROJECT_DIR/.prettierrc" ] || [ -f "$PROJECT_DIR/.prettierrc.json" ] && echo "Prettier"
if [ -f "$PROJECT_DIR/pyproject.toml" ]; then
  grep -q '\[tool.black\]' "$PROJECT_DIR/pyproject.toml" 2>/dev/null && echo "Black"
fi
echo ""

# Detect type checkers
echo "--- TYPE CHECKERS ---"
[ -f "$PROJECT_DIR/tsconfig.json" ] && echo "TypeScript"
if [ -f "$PROJECT_DIR/pyproject.toml" ]; then
  grep -q '\[tool.mypy\]' "$PROJECT_DIR/pyproject.toml" 2>/dev/null && echo "mypy"
fi
[ -f "$PROJECT_DIR/pyrightconfig.json" ] && echo "pyright"
echo ""

# Detect CI/CD
echo "--- CI/CD ---"
[ -d "$PROJECT_DIR/.github/workflows" ] && echo "GitHub Actions ($(ls "$PROJECT_DIR/.github/workflows/"*.yml 2>/dev/null | wc -l) workflows)"
[ -f "$PROJECT_DIR/.gitlab-ci.yml" ] && echo "GitLab CI"
[ -f "$PROJECT_DIR/Jenkinsfile" ] && echo "Jenkins"
[ -f "$PROJECT_DIR/.circleci/config.yml" ] && echo "CircleCI"
echo ""

# Detect containers
echo "--- CONTAINERS ---"
[ -f "$PROJECT_DIR/Dockerfile" ] && echo "Dockerfile"
[ -f "$PROJECT_DIR/docker-compose.yml" ] || [ -f "$PROJECT_DIR/docker-compose.yaml" ] && echo "Docker Compose"
echo ""

# Check for existing suite files
echo "--- SUITE STATUS ---"
[ -d "$PROJECT_DIR/.suite" ] && echo "WARNING: .suite/ already exists" || echo "No .suite/ directory (ready for init)"
[ -f "$PROJECT_DIR/roadmap.md" ] && echo "WARNING: roadmap.md already exists" || echo "No roadmap.md"
[ -f "$PROJECT_DIR/planning.md" ] && echo "WARNING: planning.md already exists" || echo "No planning.md"
echo ""

echo "=== END ==="
