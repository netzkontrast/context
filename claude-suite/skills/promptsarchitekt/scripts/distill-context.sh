#!/usr/bin/env bash
# distill-context.sh — Extract key structural patterns from project files
# Used by Explorer-A in Phase 1 (HARVEST) to gather raw material for prompt distillation.
#
# Usage: bash distill-context.sh <PROJECT_DIR>
#
# Output: Structured summary with === SECTION === delimiters

set -euo pipefail

PROJECT_DIR="${1:-.}"

echo "=== SKILL REGISTRY ==="
# Find all SKILL.md files and extract frontmatter
find "$PROJECT_DIR" -name "SKILL.md" -type f 2>/dev/null | while read -r skill_file; do
  skill_dir="$(basename "$(dirname "$skill_file")")"
  echo "--- $skill_dir ---"
  # Extract YAML frontmatter (between --- markers)
  sed -n '/^---$/,/^---$/p' "$skill_file" | grep -E '^(name|description|category):' || true
  # Count phases
  phase_count=$(grep -cE '^## Phase [0-9]+' "$skill_file" 2>/dev/null || echo "0")
  echo "  phases: $phase_count"
  # Extract anti-patterns section existence
  if grep -q '## Anti-Patterns' "$skill_file" 2>/dev/null; then
    echo "  has_anti_patterns: true"
  fi
  echo ""
done

echo "=== TOOL FREQUENCY ==="
# Count tool references across all SKILL.md files
for tool in Read Write Edit Glob Grep Bash Agent TodoWrite WebSearch WebFetch; do
  count=$(grep -rl "- $tool" "$PROJECT_DIR" --include="SKILL.md" 2>/dev/null | wc -l)
  if [ "$count" -gt 0 ]; then
    echo "  $tool: $count skills"
  fi
done

echo ""
echo "=== INFRASTRUCTURE ==="
# Check which lib modules exist
if [ -d "$PROJECT_DIR/lib" ]; then
  for module in "$PROJECT_DIR"/lib/*.js; do
    [ -f "$module" ] || continue
    mod_name="$(basename "$module" .js)"
    line_count=$(wc -l < "$module")
    echo "  $mod_name: ${line_count} lines"
  done
elif [ -d "$PROJECT_DIR/claude-suite/lib" ]; then
  for module in "$PROJECT_DIR"/claude-suite/lib/*.js; do
    [ -f "$module" ] || continue
    mod_name="$(basename "$module" .js)"
    line_count=$(wc -l < "$module")
    echo "  $mod_name: ${line_count} lines"
  done
fi

echo ""
echo "=== CONTEXT FILES ==="
# Check for key context files
for ctx_file in CLAUDE.md AGENTS.md planning.md roadmap.md backlog.md Concept.md; do
  found=$(find "$PROJECT_DIR" -name "$ctx_file" -type f 2>/dev/null | head -1)
  if [ -n "$found" ]; then
    tokens_approx=$(( $(wc -c < "$found") / 4 ))
    echo "  $ctx_file: ~${tokens_approx} tokens"
  fi
done

echo ""
echo "=== ANTI-PATTERN CATALOG ==="
# Extract anti-pattern items from all SKILL.md files
find "$PROJECT_DIR" -name "SKILL.md" -type f 2>/dev/null | while read -r skill_file; do
  skill_dir="$(basename "$(dirname "$skill_file")")"
  # Extract lines between "Anti-Patterns" heading and next heading or EOF
  in_section=false
  while IFS= read -r line; do
    if echo "$line" | grep -q '## Anti-Patterns'; then
      in_section=true
      echo "--- $skill_dir ---"
      continue
    fi
    if $in_section; then
      if echo "$line" | grep -qE '^## '; then
        in_section=false
        continue
      fi
      if echo "$line" | grep -qE '^- '; then
        echo "  $line"
      fi
    fi
  done < "$skill_file"
done

echo ""
echo "=== FAILURE SIGNALS ==="
# Check for coherence-monitor failure patterns
cm_file=$(find "$PROJECT_DIR" -name "coherence-monitor.js" -type f 2>/dev/null | head -1)
if [ -n "$cm_file" ]; then
  grep -E 'CONSERVATIVE_COLLAPSE|CONFIDENT_CONFUSION|VERBOSITY_INFLATION|PREMATURE_COMMITMENT|RAPID_FLAKINESS' "$cm_file" | head -10
fi

echo ""
echo "=== SUMMARY ==="
skill_count=$(find "$PROJECT_DIR" -name "SKILL.md" -type f 2>/dev/null | wc -l)
echo "  Total skills: $skill_count"
echo "  Distillation complete."
