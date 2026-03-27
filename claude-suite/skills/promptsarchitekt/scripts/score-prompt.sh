#!/usr/bin/env bash
# score-prompt.sh — Evaluate prompt quality through measurable heuristics
# Used by the Critic in Phase 3 (CHALLENGE) to score candidate prompt genomes.
#
# Usage: bash score-prompt.sh <prompt-file>
#   or:  echo "prompt text" | bash score-prompt.sh /dev/stdin
#
# Output: Structured score breakdown per dimension, overall quality score 0-100

set -euo pipefail

PROMPT_FILE="${1:--}"

if [ "$PROMPT_FILE" = "-" ]; then
  PROMPT_TEXT=$(cat)
else
  PROMPT_TEXT=$(cat "$PROMPT_FILE")
fi

if [ -z "$PROMPT_TEXT" ]; then
  echo "Error: Empty prompt" >&2
  exit 1
fi

# --- Metrics ---

char_count=${#PROMPT_TEXT}
token_count_approx=$(( char_count / 4 ))
word_count=$(echo "$PROMPT_TEXT" | wc -w)
sentence_count=$(echo "$PROMPT_TEXT" | grep -oE '[.!?]+' | wc -l)
[ "$sentence_count" -eq 0 ] && sentence_count=1
line_count=$(echo "$PROMPT_TEXT" | wc -l)

# Constraint keywords (MUST, NEVER, ALWAYS, SHALL, DO NOT)
constraint_count=$(echo "$PROMPT_TEXT" | grep -oiE '\b(MUST|NEVER|ALWAYS|SHALL NOT|DO NOT|REQUIRED|FORBIDDEN|PROHIBITED)\b' | wc -l)

# Imperative verbs (common instruction starters)
imperative_count=$(echo "$PROMPT_TEXT" | grep -oiE '\b(Use|Read|Write|Run|Check|Verify|Scan|Search|Extract|Generate|Create|Build|Test|Validate|Compute|Output|Return|Execute|Apply|Implement|Detect|Identify|Analyze|Compare|Select|Rank|Persist|Store|Retrieve)\b' | wc -l)

# Specificity markers (concrete references vs vague terms)
specific_count=$(echo "$PROMPT_TEXT" | grep -oE '\b[A-Z][a-z]+[A-Z][a-zA-Z]*\b|`[^`]+`|\blib/[^ ]+|\bskills/[^ ]+|\.js\b|\.md\b|\.json\b' | wc -l)
vague_count=$(echo "$PROMPT_TEXT" | grep -oiE '\b(something|somehow|maybe|perhaps|probably|generally|usually|etc|various|appropriate|suitable|reasonable)\b' | wc -l)

# Failure signal detection (coherence-monitor patterns)
failure_signals=0
echo "$PROMPT_TEXT" | grep -qiE '\bcannot\b.*\bprovide\b' && failure_signals=$((failure_signals + 1))
echo "$PROMPT_TEXT" | grep -qiE '\bas an ai\b' && failure_signals=$((failure_signals + 1))
echo "$PROMPT_TEXT" | grep -qiE "\bi('m| am) (not able|unable) to\b" && failure_signals=$((failure_signals + 1))
echo "$PROMPT_TEXT" | grep -qiE '\blet me assume\b' && failure_signals=$((failure_signals + 1))
echo "$PROMPT_TEXT" | grep -qiE '\bfor the purposes of this\b' && failure_signals=$((failure_signals + 1))

# --- Scoring (each dimension 0-20, total 0-100) ---

# 1. SPECIFICITY (0-20): concrete references vs vague terms
if [ "$word_count" -gt 0 ]; then
  specificity_ratio=$(( (specific_count * 100) / word_count ))
else
  specificity_ratio=0
fi
if [ "$specificity_ratio" -ge 10 ]; then
  specificity_score=20
elif [ "$specificity_ratio" -ge 5 ]; then
  specificity_score=15
elif [ "$specificity_ratio" -ge 2 ]; then
  specificity_score=10
elif [ "$specificity_ratio" -ge 1 ]; then
  specificity_score=5
else
  specificity_score=0
fi
# Penalize vague terms
specificity_score=$(( specificity_score - vague_count * 2 ))
[ "$specificity_score" -lt 0 ] && specificity_score=0

# 2. CONSTRAINT CLARITY (0-20): explicit boundaries
if [ "$sentence_count" -gt 0 ]; then
  constraint_density=$(( (constraint_count * 100) / sentence_count ))
else
  constraint_density=0
fi
if [ "$constraint_density" -ge 30 ]; then
  constraint_score=20
elif [ "$constraint_density" -ge 20 ]; then
  constraint_score=15
elif [ "$constraint_density" -ge 10 ]; then
  constraint_score=10
elif [ "$constraint_density" -ge 5 ]; then
  constraint_score=5
else
  constraint_score=2
fi

# 3. FAILURE RESISTANCE (0-20): absence of failure signals
failure_score=$(( 20 - failure_signals * 5 ))
[ "$failure_score" -lt 0 ] && failure_score=0

# 4. MEMORY DENSITY (0-20): knowledge per token
if [ "$token_count_approx" -gt 0 ]; then
  density_ratio=$(( (imperative_count + constraint_count + specific_count) * 100 / token_count_approx ))
else
  density_ratio=0
fi
if [ "$density_ratio" -ge 20 ]; then
  density_score=20
elif [ "$density_ratio" -ge 15 ]; then
  density_score=15
elif [ "$density_ratio" -ge 10 ]; then
  density_score=10
elif [ "$density_ratio" -ge 5 ]; then
  density_score=5
else
  density_score=2
fi
# Bonus for being under 500 tokens
if [ "$token_count_approx" -le 500 ]; then
  density_score=$(( density_score + 3 ))
  [ "$density_score" -gt 20 ] && density_score=20
fi
# Penalty for being over 1000 tokens
if [ "$token_count_approx" -gt 1000 ]; then
  density_score=$(( density_score - 5 ))
  [ "$density_score" -lt 0 ] && density_score=0
fi

# 5. COMPOSABILITY (0-20): cross-references, modularity
link_count=$(echo "$PROMPT_TEXT" | grep -oE '/[a-z]+|skills/[a-z]+|lib/[a-z-]+' | wc -l)
section_count=$(echo "$PROMPT_TEXT" | grep -cE '^#{1,3} ' || true)
if [ "$link_count" -ge 5 ] && [ "$section_count" -ge 3 ]; then
  composability_score=20
elif [ "$link_count" -ge 3 ] || [ "$section_count" -ge 3 ]; then
  composability_score=15
elif [ "$link_count" -ge 1 ] || [ "$section_count" -ge 1 ]; then
  composability_score=10
else
  composability_score=5
fi

# --- Total ---
total_score=$(( specificity_score + constraint_score + failure_score + density_score + composability_score ))

# --- Output ---
echo "=== PROMPT QUALITY SCORE ==="
echo ""
echo "  Metrics:"
echo "    Characters: $char_count"
echo "    Tokens (approx): $token_count_approx"
echo "    Words: $word_count"
echo "    Sentences: $sentence_count"
echo "    Lines: $line_count"
echo ""
echo "  Counts:"
echo "    Constraint keywords: $constraint_count"
echo "    Imperative verbs: $imperative_count"
echo "    Specific references: $specific_count"
echo "    Vague terms: $vague_count"
echo "    Failure signals: $failure_signals"
echo ""
echo "  Scores (0-20 each):"
echo "    Specificity:        $specificity_score / 20"
echo "    Constraint Clarity: $constraint_score / 20"
echo "    Failure Resistance: $failure_score / 20"
echo "    Memory Density:     $density_score / 20"
echo "    Composability:      $composability_score / 20"
echo ""
echo "  TOTAL: $total_score / 100"
echo ""

if [ "$total_score" -ge 80 ]; then
  echo "  Grade: EXCELLENT — production-ready genome"
elif [ "$total_score" -ge 60 ]; then
  echo "  Grade: GOOD — viable candidate, minor improvements possible"
elif [ "$total_score" -ge 40 ]; then
  echo "  Grade: FAIR — needs refinement before persistence"
else
  echo "  Grade: POOR — likely triggers failure modes, rework needed"
fi
