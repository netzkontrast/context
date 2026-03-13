'use strict';

const fs = require('fs');
const path = require('path');
const { ContextDistiller } = require('./context-distiller');
const { findRelevantFiles, extractKeywords } = require('./context-gate');

/**
 * Context Assembler Agent
 *
 * Builds optimal context packages for specific tasks by combining:
 *   1. Task-relevant source files (via context-gate keyword search)
 *   2. Compressed representations (via context-distiller)
 *   3. Project constraints and requirements
 *   4. Recent git history for changed areas
 *
 * The output is a self-contained context package that can be injected
 * into an agent's prompt or saved as a `.context/` artifact.
 *
 * Usage:
 *   const assembler = new ContextAssembler({ basePath: '/project' });
 *   const pkg = assembler.assemble('Implement user authentication');
 *   assembler.save(pkg, '.context/auth-task.md');
 */

class ContextAssembler {
  constructor(options = {}) {
    this.basePath = options.basePath || process.cwd();
    this.suitePath = options.suitePath || path.join(this.basePath, '.suite');
    this.maxTokenBudget = options.maxTokenBudget || 100000;
    this.distiller = new ContextDistiller({ basePath: this.basePath });
  }

  /**
   * Assemble a complete context package for a task.
   */
  assemble(taskDescription, options = {}) {
    const compressionMode = options.mode || 'structural';
    const keywords = extractKeywords(taskDescription);

    const pkg = {
      task: taskDescription,
      keywords,
      timestamp: new Date().toISOString(),
      sections: {},
      stats: { filesScanned: 0, filesIncluded: 0, estimatedTokens: 0 },
    };

    // 1. Project constraints (always included)
    pkg.sections.constraints = this._loadConstraints();

    // 2. Requirements (always included if available)
    pkg.sections.requirements = this._loadRequirements();

    // 3. Find and compress relevant source files
    const relevantFiles = findRelevantFiles(this.basePath, keywords, 20);
    pkg.stats.filesScanned = relevantFiles.length;

    const distilled = [];
    let tokenEstimate = this._estimateTokens(
      JSON.stringify(pkg.sections.constraints) +
      JSON.stringify(pkg.sections.requirements)
    );

    for (const file of relevantFiles) {
      const result = this.distiller.distillFile(file.path, { mode: compressionMode });
      if (result.error) continue;

      const fileTokens = this._estimateTokens(result.distilled);
      if (tokenEstimate + fileTokens > this.maxTokenBudget) break;

      tokenEstimate += fileTokens;
      distilled.push({
        path: file.path,
        relevanceScore: file.score,
        distilled: result.distilled,
      });
    }

    pkg.sections.sourceFiles = distilled;
    pkg.stats.filesIncluded = distilled.length;

    // 4. Recent git changes in relevant areas
    pkg.sections.recentChanges = this._getRecentChanges(keywords);

    pkg.stats.estimatedTokens = tokenEstimate;

    return pkg;
  }

  /**
   * Save a context package to disk as a markdown file.
   */
  save(pkg, outputPath) {
    const absolutePath = path.resolve(this.basePath, outputPath);
    const dir = path.dirname(absolutePath);

    fs.mkdirSync(dir, { recursive: true });

    const md = this._formatAsMarkdown(pkg);
    fs.writeFileSync(absolutePath, md, 'utf-8');

    return absolutePath;
  }

  /**
   * Load project constraints from PROJECT.md.
   */
  _loadConstraints() {
    const projectPath = path.join(this.suitePath, 'PROJECT.md');
    try {
      return fs.readFileSync(projectPath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Load requirements from REQUIREMENTS.md.
   */
  _loadRequirements() {
    const reqPath = path.join(this.suitePath, 'REQUIREMENTS.md');
    try {
      return fs.readFileSync(reqPath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Get recent git changes related to keywords.
   */
  _getRecentChanges(keywords) {
    try {
      const { execSync } = require('child_process');
      const log = execSync('git log --oneline -10', {
        cwd: this.basePath,
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();

      if (!log) return null;

      // Filter commits that mention relevant keywords
      const relevant = log.split('\n').filter(line => {
        const lower = line.toLowerCase();
        return keywords.some(kw => lower.includes(kw));
      });

      return relevant.length > 0 ? relevant.join('\n') : log;
    } catch {
      return null;
    }
  }

  /**
   * Rough token estimate (1 token ~ 4 characters).
   */
  _estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  /**
   * Format a context package as a readable markdown document.
   */
  _formatAsMarkdown(pkg) {
    const lines = [];

    lines.push(`# Context Package: ${pkg.task}`);
    lines.push(`Generated: ${pkg.timestamp}`);
    lines.push(`Keywords: ${pkg.keywords.join(', ')}`);
    lines.push('');

    lines.push('## Stats');
    lines.push(`- Files scanned: ${pkg.stats.filesScanned}`);
    lines.push(`- Files included: ${pkg.stats.filesIncluded}`);
    lines.push(`- Estimated tokens: ~${pkg.stats.estimatedTokens}`);
    lines.push('');

    if (pkg.sections.constraints) {
      lines.push('## Project Constraints');
      lines.push(pkg.sections.constraints);
      lines.push('');
    }

    if (pkg.sections.requirements) {
      lines.push('## Requirements');
      lines.push(pkg.sections.requirements);
      lines.push('');
    }

    if (pkg.sections.sourceFiles && pkg.sections.sourceFiles.length > 0) {
      lines.push('## Relevant Source Files');
      lines.push('');
      for (const file of pkg.sections.sourceFiles) {
        lines.push(`### ${file.path} (relevance: ${file.relevanceScore})`);
        lines.push('```');
        lines.push(file.distilled);
        lines.push('```');
        lines.push('');
      }
    }

    if (pkg.sections.recentChanges) {
      lines.push('## Recent Related Changes');
      lines.push('```');
      lines.push(pkg.sections.recentChanges);
      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  }
}

module.exports = { ContextAssembler };
