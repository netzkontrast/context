'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Context Gate — Pre-execution context enrichment hook.
 *
 * Before an agent executes a task, this hook:
 *   1. Extracts keywords from the task description
 *   2. Searches for relevant source files using keyword matching
 *   3. Reads and compresses relevant files into a context summary
 *   4. Injects the summary into the agent's sterile context
 *
 * This implements the "Select" strategy from context engineering:
 * pull only relevant context into the window instead of everything.
 */

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  '__pycache__', '.next', '.cache', 'vendor',
]);

const CODE_EXTENSIONS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs',
  '.java', '.rb', '.sh', '.css', '.html', '.json', '.yaml', '.yml',
  '.md', '.toml',
]);

/**
 * Extract meaningful keywords from a task description.
 * Strips common words and returns unique terms.
 */
function extractKeywords(description) {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
    'it', 'its', 'not', 'no', 'all', 'each', 'every', 'any', 'some',
    'implement', 'create', 'add', 'update', 'fix', 'modify', 'change',
    'make', 'use', 'using', 'new', 'into', 'when', 'then', 'also',
  ]);

  return description
    .toLowerCase()
    .replace(/[^a-z0-9_\-./]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i);
}

/**
 * Recursively find files matching keywords in a directory.
 * Returns files sorted by relevance (number of keyword matches).
 */
function findRelevantFiles(basePath, keywords, maxResults = 15) {
  const results = [];

  function walk(dir, depth) {
    if (depth > 5) return;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.suite') continue;
      if (IGNORE_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (CODE_EXTENSIONS.has(path.extname(entry.name))) {
        const relativePath = path.relative(basePath, fullPath);
        const nameLower = entry.name.toLowerCase();
        const pathLower = relativePath.toLowerCase();

        // Score by keyword presence in filename/path
        let score = 0;
        for (const kw of keywords) {
          if (nameLower.includes(kw)) score += 3;
          else if (pathLower.includes(kw)) score += 2;
        }

        if (score > 0) {
          results.push({ path: relativePath, fullPath, score });
        }
      }
    }
  }

  walk(basePath, 0);

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

/**
 * Compress a source file for context injection.
 * For short files, include verbatim. For long files, extract key sections.
 */
function compressFile(filePath, maxLines = 80) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  const lines = content.split('\n');

  if (lines.length <= maxLines) {
    return content;
  }

  // For long files: extract exports, function signatures, class definitions
  const important = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (
      /^(export|module\.exports|function |class |const \w+ = |def |async function |pub fn |func )/.test(trimmed) ||
      /^(import |require\(|from |use )/.test(trimmed) ||
      /^(describe|it|test)\(/.test(trimmed) ||
      /^##?\s/.test(trimmed)  // Markdown headers
    ) {
      important.push(`${i + 1}: ${line}`);
    }
  }

  return `[${lines.length} lines total, showing ${important.length} key declarations]\n${important.join('\n')}`;
}

/**
 * Enrich a task context with relevant file contents.
 * This is the main entry point for the context gate hook.
 *
 * @param {string} taskDescription - The task to find context for
 * @param {string} basePath - Project root to search within
 * @param {object} existingContext - Existing sterile context to augment
 * @returns {object} Enriched context with relevantFiles field
 */
function enrichContext(taskDescription, basePath, existingContext = {}) {
  const keywords = extractKeywords(taskDescription);

  if (keywords.length === 0) {
    return { ...existingContext, relevantFiles: [] };
  }

  const relevantFiles = findRelevantFiles(basePath, keywords);

  const fileContexts = relevantFiles.map(file => {
    const compressed = compressFile(file.fullPath);
    return {
      path: file.path,
      score: file.score,
      content: compressed,
    };
  }).filter(f => f.content !== null);

  return {
    ...existingContext,
    relevantFiles: fileContexts,
    contextGate: {
      keywords,
      filesScanned: relevantFiles.length,
      filesIncluded: fileContexts.length,
    },
  };
}

module.exports = {
  extractKeywords,
  findRelevantFiles,
  compressFile,
  enrichContext,
};
