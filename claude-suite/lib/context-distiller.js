'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Context Distiller Agent
 *
 * Compresses verbose context (conversation logs, large files, state dumps)
 * into dense, high-signal summaries. Implements the "Compress" strategy
 * from context engineering.
 *
 * Three compression modes:
 *   1. Structural — Keep signatures, strip implementations
 *   2. Semantic   — Extract key facts and decisions
 *   3. Diff-aware — Keep only what changed since last snapshot
 *
 * Usage:
 *   const distiller = new ContextDistiller({ basePath: '/project' });
 *   const compressed = distiller.distillFile('src/large-module.js');
 *   const summary = distiller.distillDirectory('src/lib/', { mode: 'structural' });
 */

class ContextDistiller {
  constructor(options = {}) {
    this.basePath = options.basePath || process.cwd();
    this.maxOutputTokens = options.maxOutputTokens || 2000;
  }

  /**
   * Distill a single file into a compressed representation.
   * Preserves the file's "API surface" while removing implementation details.
   */
  distillFile(filePath, options = {}) {
    const mode = options.mode || 'structural';
    const absolutePath = path.resolve(this.basePath, filePath);

    let content;
    try {
      content = fs.readFileSync(absolutePath, 'utf-8');
    } catch (err) {
      if (err.code === 'ENOENT') return { path: filePath, error: 'not found' };
      throw err;
    }

    const lines = content.split('\n');
    const ext = path.extname(filePath);

    switch (mode) {
      case 'structural':
        return { path: filePath, distilled: this._structuralCompress(lines, ext) };
      case 'semantic':
        return { path: filePath, distilled: this._semanticCompress(lines, ext) };
      case 'diff':
        return { path: filePath, distilled: this._diffCompress(absolutePath, lines) };
      default:
        return { path: filePath, distilled: this._structuralCompress(lines, ext) };
    }
  }

  /**
   * Distill an entire directory into a compressed context package.
   */
  distillDirectory(dirPath, options = {}) {
    const absolutePath = path.resolve(this.basePath, dirPath);
    const results = [];

    let entries;
    try {
      entries = fs.readdirSync(absolutePath, { withFileTypes: true });
    } catch {
      return { path: dirPath, error: 'directory not found', files: [] };
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) continue; // shallow by default

      const filePath = path.join(dirPath, entry.name);
      results.push(this.distillFile(filePath, options));
    }

    return { path: dirPath, files: results };
  }

  /**
   * Structural compression: keep exports, function signatures, class
   * definitions, type annotations. Strip function bodies.
   */
  _structuralCompress(lines, ext) {
    const isJS = ['.js', '.ts', '.jsx', '.tsx', '.mjs'].includes(ext);
    const isPython = ['.py'].includes(ext);
    const isMarkdown = ['.md'].includes(ext);

    if (isMarkdown) {
      return this._compressMarkdown(lines);
    }

    const output = [];
    let braceDepth = 0;
    let inBody = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Always keep: imports, exports, class declarations, comments at top level
      if (braceDepth <= 1) {
        if (isJS && /^(import |export |const |let |var |class |function |async function |module\.exports|require\()/.test(trimmed)) {
          output.push(line);
          inBody = false;
        } else if (isPython && /^(import |from |class |def |async def |@)/.test(trimmed)) {
          output.push(line);
          inBody = false;
        } else if (/^(\/\*\*|\/\/|#\s)/.test(trimmed) && braceDepth === 0) {
          output.push(line);
        } else if (trimmed === '' && !inBody) {
          output.push('');
        } else {
          inBody = true;
        }
      }

      // Track brace depth for JS/TS
      if (isJS) {
        for (const ch of line) {
          if (ch === '{') braceDepth++;
          if (ch === '}') {
            braceDepth--;
            if (braceDepth <= 0) {
              braceDepth = 0;
              inBody = false;
              output.push(line);
            }
          }
        }
      }
    }

    const compressed = output.join('\n').replace(/\n{3,}/g, '\n\n');
    return `[Structural distillation: ${lines.length} → ${output.length} lines]\n${compressed}`;
  }

  /**
   * Semantic compression: extract key facts, decisions, and constraints.
   * Best for documentation and conversation logs.
   */
  _semanticCompress(lines, ext) {
    const keyPatterns = [
      /\b(must|shall|required|constraint|important|note|warning|todo|fixme|hack|bug)\b/i,
      /\b(api|endpoint|route|schema|interface|contract|protocol)\b/i,
      /\b(error|exception|fail|crash|timeout|retry)\b/i,
      /\b(config|setting|option|parameter|flag|env)\b/i,
      /\b(version|deprecat|breaking|migration|upgrade)\b/i,
    ];

    const important = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Headers are always important
      if (/^#{1,4}\s/.test(trimmed)) {
        important.push(line);
        continue;
      }

      // Check for semantic importance
      for (const pattern of keyPatterns) {
        if (pattern.test(trimmed)) {
          important.push(line);
          break;
        }
      }
    }

    return `[Semantic distillation: ${lines.length} → ${important.length} key lines]\n${important.join('\n')}`;
  }

  /**
   * Diff-aware compression: show only what changed from the last git commit.
   */
  _diffCompress(absolutePath, lines) {
    // Fall back to structural if git is unavailable
    try {
      const { execSync } = require('child_process');
      const diff = execSync(`git diff HEAD -- "${absolutePath}"`, {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();

      if (!diff) {
        return `[No changes since last commit — ${lines.length} lines unchanged]`;
      }

      return `[Diff distillation: showing changes only]\n${diff}`;
    } catch {
      return this._structuralCompress(lines, path.extname(absolutePath));
    }
  }

  /**
   * Compress markdown by keeping headers and first paragraph of each section.
   */
  _compressMarkdown(lines) {
    const output = [];
    let inFirstParagraph = false;
    let paragraphLines = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      if (/^#{1,4}\s/.test(trimmed)) {
        output.push(line);
        inFirstParagraph = true;
        paragraphLines = 0;
        continue;
      }

      if (inFirstParagraph) {
        if (trimmed === '') {
          inFirstParagraph = false;
          output.push('');
        } else if (paragraphLines < 3) {
          output.push(line);
          paragraphLines++;
        }
      }
    }

    return `[Markdown distillation: ${lines.length} → ${output.length} lines]\n${output.join('\n')}`;
  }
}

module.exports = { ContextDistiller };
