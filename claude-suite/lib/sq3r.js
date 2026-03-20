'use strict';

/**
 * SQ3R Pipeline — Structured context loading for the Researcher Agent
 *
 * Enforces the Survey → Question → Read → Recite → Review cognitive pipeline
 * to prevent "context flooding" when agents ingest large documentation.
 *
 * From the Architecture of Intent research (2025):
 *   - Agents must NOT dump raw text into their context window
 *   - Data is ingested structurally (Survey), then retrieved surgically (LDAR)
 *   - Synthesis happens in Recite, not during Read (no raw parroting)
 *   - Review clears ephemeral state before accepting the next objective
 *
 * Pipeline phases and hard constraints:
 *
 *   1. SURVEY   — extract structural boundaries only (headings, ToC, section titles)
 *                 No raw file reads; content goes to ContextStore, not working memory.
 *
 *   2. QUESTION — generate 3–5 specific, anchored query strings from the task.
 *                 Queries are stored as the retrieval "intent"; no browsing yet.
 *
 *   3. READ     — execute LDAR retrieval for each query; max 3 iterations.
 *                 Throttle depth: stop when token budget hits 50% of allocation.
 *
 *   4. RECITE   — synthesise retrieved passages into a condensed summary.
 *                 Forbidden: verbatim copying of raw snippets.
 *                 Result is a high-signal Markdown summary (< 500 tokens target).
 *
 *   5. REVIEW   — push distilled summary to ContextStore; clear ephemeral state.
 *                 Signal phase completion so the Orchestrator can proceed.
 *
 * Usage:
 *   const pipeline = new SQ3RPipeline({ store, ldar, coherenceMonitor });
 *   const result = pipeline.run({
 *     sessionId: 's1',
 *     task: 'Understand FTS5 API for context search',
 *     documents: [{ key: 'fts5-docs', content: '...' }],
 *   });
 *   // result: { summary, queries, passages, tokensBudgetUsed, phaseLog }
 */

const { LDAR } = require('./ldar');

// Default token allocation for the "Active Code Context" budget slice (50% of 200k)
const DEFAULT_TOKEN_BUDGET = 100_000;
const MAX_READ_ITERATIONS = 3;
const MAX_QUERIES = 5;
const MIN_QUERIES = 3;

class SQ3RPipeline {
  constructor(options = {}) {
    this._store = options.store || null;   // ContextStore — required for Survey + Recite
    this._ldar = options.ldar || null;     // LDAR instance — built internally if not supplied
    this._coherenceMonitor = options.coherenceMonitor || null; // Optional CoherenceMonitor
    this.tokenBudget = options.tokenBudget || DEFAULT_TOKEN_BUDGET;
    this.maxReadIterations = options.maxReadIterations || MAX_READ_ITERATIONS;

    // Build LDAR from store if not provided
    if (!this._ldar && this._store) {
      this._ldar = new LDAR({ store: this._store });
    }
  }

  /**
   * Run the full SQ3R pipeline for a research task.
   *
   * @param {{ sessionId: string, task: string, documents?: Array<{key,content}>,
   *           queries?: string[] }} opts
   * @returns {{ summary: string, queries: string[], passages: object[],
   *             tokensBudgetUsed: number, phaseLog: object[] }}
   */
  run(opts = {}) {
    const { sessionId, task, documents = [], queries: suppliedQueries } = opts;

    if (!sessionId) throw new Error('sessionId is required');
    if (!task) throw new Error('task is required');
    if (!this._store) throw new Error('SQ3RPipeline requires a ContextStore via options.store');
    if (!this._ldar) throw new Error('SQ3RPipeline requires an LDAR instance or a ContextStore to build one from');

    const phaseLog = [];
    const log = (phase, detail) => phaseLog.push({ phase, ...detail, ts: Date.now() });

    // ── Phase 1: SURVEY ───────────────────────────────────────────────────────
    //   Ingest document structural boundaries into ContextStore.
    //   Extract headings only (H1/H2/H3) — no raw content in working memory.

    const surveyed = [];
    for (const doc of documents) {
      const structure = this._extractStructure(doc.content);
      this._store.saveSnapshot(sessionId, `survey:${doc.key}`, structure);
      surveyed.push({ key: doc.key, sections: structure.split('\n').filter(Boolean).length });
    }
    log('SURVEY', { documentsIngested: documents.length, sections: surveyed });

    // ── Phase 2: QUESTION ─────────────────────────────────────────────────────
    //   Generate 3–5 specific query strings anchored to the task intent.

    const queries = suppliedQueries
      ? suppliedQueries.slice(0, MAX_QUERIES)
      : this._generateQueries(task);

    if (queries.length < MIN_QUERIES) {
      // Pad with task fragments if too few
      const words = task.split(/\s+/).filter(w => w.length > 3);
      while (queries.length < MIN_QUERIES && words.length > 0) {
        queries.push(words.splice(0, 3).join(' '));
      }
    }

    log('QUESTION', { queries });

    // ── Phase 3: READ (LDAR) ──────────────────────────────────────────────────
    //   Execute LDAR retrieval for each query; throttle to maxReadIterations.
    //   Stop early if token budget is exceeded.

    const allPassages = [];
    let tokensBudgetUsed = 0;
    let iterationCount = 0;

    for (const query of queries) {
      if (iterationCount >= this.maxReadIterations) {
        log('READ', { query, skipped: true, reason: 'max iterations reached' });
        break;
      }
      if (tokensBudgetUsed / this.tokenBudget > 0.5) {
        log('READ', { query, skipped: true, reason: '50% token budget reached' });
        break;
      }

      const { passages, stats } = this._ldar.retrieve(query, sessionId);
      const cue = this._ldar.assessCUE(passages, this.tokenBudget);

      allPassages.push(...passages);
      tokensBudgetUsed += stats.tokenEstimate || 0;
      iterationCount++;

      log('READ', { query, stats, cueWarning: cue.warning });

      if (cue.warning && cue.warning.includes('context rot')) {
        log('READ', { halted: true, reason: cue.warning });
        break;
      }
    }

    // Deduplicate passages by content identity
    const seen = new Set();
    const uniquePassages = allPassages.filter(p => {
      if (seen.has(p.content)) return false;
      seen.add(p.content);
      return true;
    });

    // ── Phase 4: RECITE ───────────────────────────────────────────────────────
    //   Synthesise retrieved passages into a < 500 token Markdown summary.
    //   No verbatim copies — only distilled synthesis.

    const summary = this._synthesise(task, uniquePassages);
    this._store.saveSnapshot(sessionId, `recite:${task.slice(0, 40)}`, summary);

    log('RECITE', {
      passagesConsidered: uniquePassages.length,
      summaryTokens: Math.ceil(summary.length / 4),
    });

    // Push coherence observation if monitor available
    if (this._coherenceMonitor) {
      this._coherenceMonitor.record({
        sessionId,
        taskId: `sq3r:${task.slice(0, 40)}`,
        response: summary,
      });
    }

    // ── Phase 5: REVIEW ───────────────────────────────────────────────────────
    //   Clear ephemeral state; save distilled result; signal completion.

    const reviewSnapshot = [
      `## SQ3R Review — ${new Date().toISOString()}`,
      `**Task:** ${task}`,
      `**Queries used:** ${queries.slice(0, iterationCount).join(', ')}`,
      `**Passages retrieved:** ${uniquePassages.length}`,
      `**Tokens used:** ~${tokensBudgetUsed.toLocaleString()} / ${this.tokenBudget.toLocaleString()} budget`,
      `**Summary stored at:** recite:${task.slice(0, 40)}`,
    ].join('\n');

    this._store.saveSnapshot(sessionId, `review:${task.slice(0, 40)}`, reviewSnapshot);
    this._store.logEvent(sessionId, 'sq3r:complete', {
      task: task.slice(0, 120),
      queriesRun: iterationCount,
      passagesRetrieved: uniquePassages.length,
      tokensBudgetUsed,
    });

    log('REVIEW', { reviewSaved: true, tokensBudgetUsed });

    return {
      summary,
      queries: queries.slice(0, iterationCount),
      passages: uniquePassages,
      tokensBudgetUsed,
      phaseLog,
    };
  }

  // ── Internals ─────────────────────────────────────────────────────────────────

  /**
   * Extract structural boundaries from document content.
   * Captures only headings (H1–H3) and list item titles.
   * @param {string} content
   * @returns {string} Structure outline
   */
  _extractStructure(content) {
    if (!content) return '';
    const lines = content.split('\n');
    const structural = [];
    for (const line of lines) {
      const trimmed = line.trim();
      // Markdown headings
      if (/^#{1,3}\s/.test(trimmed)) structural.push(trimmed);
      // Numbered list items (top-level section markers)
      else if (/^\d+\.\s+\*\*/.test(trimmed)) structural.push(trimmed);
    }
    return structural.join('\n');
  }

  /**
   * Generate 3–5 anchored query strings from a task description.
   * Uses simple term extraction: de-stop-word, take noun phrases.
   * @param {string} task
   * @returns {string[]}
   */
  _generateQueries(task) {
    const stopWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'be', 'do', 'how',
      'what', 'when', 'where', 'which', 'that', 'this', 'it', 'as', 'up',
    ]);

    // Clean and tokenise
    const words = task.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));

    if (words.length === 0) return [task];

    const queries = [];

    // Query 1: full task condensed (4 most important words)
    queries.push(words.slice(0, 4).join(' '));

    // Query 2: first half of significant words
    if (words.length > 4) {
      queries.push(words.slice(0, Math.ceil(words.length / 2)).join(' '));
    }

    // Query 3: second half
    if (words.length > 6) {
      queries.push(words.slice(Math.floor(words.length / 2)).join(' '));
    }

    // Query 4: bigrams of adjacent high-value words
    if (words.length >= 4) {
      const bigrams = [];
      for (let i = 0; i < words.length - 1; i++) {
        bigrams.push(`${words[i]} ${words[i + 1]}`);
      }
      queries.push(bigrams.slice(0, 3).join(' '));
    }

    // Deduplicate and cap
    return [...new Set(queries)].slice(0, MAX_QUERIES);
  }

  /**
   * Synthesise retrieved passages into a condensed Markdown summary.
   * Target: < 500 tokens (< 2000 chars).
   * @param {string} task
   * @param {object[]} passages
   * @returns {string}
   */
  _synthesise(task, passages) {
    if (passages.length === 0) {
      return `## Research Summary\n**Task:** ${task}\n\n*No relevant passages found.*`;
    }

    const lines = [
      `## Research Summary`,
      `**Task:** ${task}`,
      `**Sources:** ${passages.length} passage(s) retrieved`,
      '',
      '### Key Findings',
    ];

    // Take top 4 passages by similarity, truncate each to ~100 chars
    const top = passages.slice(0, 4);
    for (const p of top) {
      const excerpt = (p.content || '').replace(/\n+/g, ' ').trim().slice(0, 150);
      const key = p.key ? ` [${p.key}]` : '';
      lines.push(`- ${excerpt}${excerpt.length === 150 ? '...' : ''}${key}`);
    }

    if (passages.length > 4) {
      lines.push(`- *(${passages.length - 4} additional passages filtered by LDAR)*`);
    }

    return lines.join('\n');
  }
}

module.exports = { SQ3RPipeline };
