#!/usr/bin/env bash
# Estimate token count for files by word count (rough: 1 token ~ 0.75 words)
# Usage: estimate-tokens.sh <file1> [file2] ...
# Output: JSON array of {path, words, estimated_tokens, bytes}

set -euo pipefail

echo "["
first=true
for file in "$@"; do
  if [ ! -f "$file" ]; then
    continue
  fi
  words=$(wc -w < "$file" 2>/dev/null || echo 0)
  bytes=$(wc -c < "$file" 2>/dev/null || echo 0)
  tokens=$(( (words * 4) / 3 ))  # rough estimate: ~1.33 tokens per word

  if [ "$first" = true ]; then
    first=false
  else
    echo ","
  fi
  printf '  {"path": "%s", "words": %d, "estimated_tokens": %d, "bytes": %d}' \
    "$file" "$words" "$tokens" "$bytes"
done
echo ""
echo "]"
