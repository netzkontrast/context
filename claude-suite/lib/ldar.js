'use strict';

/**
 * Learning Distraction-Aware Retrieval (LDAR)
 *
 * Resolves the Context Quality Paradox: naive top-k retrieval injects
 * distracting passages that degrade LLM performance by 20%+ beyond ~12 chunks.
 * LDAR dynamically selects a "band" of passages based on similarity-score
 * distributions, actively filtering noise before it reaches the reasoning engine.
 *
 * Key principles (from empirical research):
 *   - Execution quality peaks at ~4 discrete context chunks (~94% accuracy)
 *   - Beyond 12 chunks, quality drops below zero-retrieval baselines
 *   - Coherent/narrative docs trigger MORE distraction than shuffled text
 *   - Logically organised distractors are harder to filter than random noise
 *
 * Algorithm:
 *   1. Retrieve up to maxCandidates via FTS5 BM25 ranking from ContextStore
 *   2. Normalise rank scores to a [0,1] similarity distribution
 *   3. Compute distribution statistics (mean, stddev, gap analysis)
 *   4. Select a continuous "band" of high-signal passages:
 *        - If distribution has a clear high-similarity cluster → narrow band
 *        - If distribution is diffuse → widen band, penalise known distractor patterns
 *   5. Hard-cap result count between minChunks and maxChunks
 *   6. Emit a RetrievalEvent to the telemetry stream for audit
 *
 * Usage:
 *   const ldar = new LDAR({ store, telemetry });
 *   const { passages, stats } = ldar.retrieve('context budget calculator', sessionId);
 */

class LDAR {
  constructor(options = {}) {
    this._store = options.store || null;       // ContextStore instance
    this._telemetry = options.telemetry || null; // Telemetry instance

    // Tuning parameters backed by empirical findings
    this.maxCandidates = options.maxCandidates || 50;
    this.minChunks = options.minChunks || 2;
    this.maxChunks = options.maxChunks || 8;   // above 12 triggers context rot
    this.distractorPenalty = options.distractorPenalty || 0.3;

    // Known distractor signal patterns (narrative connectives, generic filler)
    this._distractorPatterns = options.distractorPatterns || [
      /\b(furthermore|moreover|in addition|as mentioned|as noted above|previously stated)\b/i,
      /\b(todo|fixme|hack|xxx)\b/i,
      /^\s*[-*]\s*$/m,                         // lone bullet points
    ];
  }

  /**
   * Retrieve distraction-filtered passages for a query.
   *
   * @param {string} query      - Natural-language or keyword query
   * @param {string} [sessionId] - Scope search to a specific session
   * @returns {{ passages: object[], stats: object }}
   */
  retrieve(query, sessionId = null) {
    if (!this._store) {
      throw new Error('LDAR requires a ContextStore instance via options.store');
    }

    // Phase 1: Candidate retrieval via FTS5 BM25
    const raw = sessionId
      ? this._store.searchInSession(sessionId, query, this.maxCandidates)
      : this._store.search(query, this.maxCandidates);

    if (raw.length === 0) {
      return { passages: [], stats: { candidates: 0, selected: 0, method: 'empty' } };
    }

    // Phase 2: Normalise BM25 rank scores to similarity ∈ [0,1]
    // FTS5 rank is negative (more negative = better match), normalise to [0,1]
    const scores = raw.map(r => r.rank || 0);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const range = maxScore - minScore || 1;

    const candidates = raw.map((r, i) => ({
      ...r,
      similarity: 1 - (scores[i] - minScore) / range,
    }));

    // Phase 3: Distribution statistics
    const sims = candidates.map(c => c.similarity);
    const mean = sims.reduce((a, b) => a + b, 0) / sims.length;
    const variance = sims.reduce((s, v) => s + (v - mean) ** 2, 0) / sims.length;
    const stddev = Math.sqrt(variance);

    // Phase 4: Adaptive band selection
    // Gap analysis: find the largest score gap to detect cluster boundaries
    const sorted = [...candidates].sort((a, b) => b.similarity - a.similarity);
    const gaps = sorted.slice(0, -1).map((c, i) => ({
      index: i,
      gap: c.similarity - sorted[i + 1].similarity,
    }));
    const maxGap = gaps.reduce((best, g) => (g.gap > best.gap ? g : best), { gap: -1, index: sorted.length - 1 });

    let method;
    let selected;

    const clusterClear = maxGap.gap > stddev * 1.5;

    if (clusterClear) {
      // Clear high-similarity cluster detected → narrow band (take top cluster)
      selected = sorted.slice(0, maxGap.index + 1);
      method = 'narrow-cluster';
    } else {
      // Diffuse distribution → widen band but apply distractor penalty
      selected = sorted.map(c => ({
        ...c,
        similarity: c.similarity - this._distractorScore(c.content) * this.distractorPenalty,
      })).filter(c => c.similarity > 0.1);
      method = 'wide-penalised';
    }

    // Phase 5: Hard-cap between minChunks and maxChunks
    selected = selected
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, this.maxChunks);

    if (selected.length < this.minChunks && sorted.length >= this.minChunks) {
      selected = sorted.slice(0, this.minChunks);
      method = 'floor-applied';
    }

    const stats = {
      candidates: raw.length,
      selected: selected.length,
      method,
      mean: +mean.toFixed(4),
      stddev: +stddev.toFixed(4),
      clusterGap: +maxGap.gap.toFixed(4),
      tokenEstimate: selected.reduce(
        (sum, p) => sum + Math.ceil((p.content || '').length / 4),
        0
      ),
    };

    // Phase 6: Telemetry
    if (this._telemetry) {
      try {
        this._telemetry.emit('ldar:retrieve', {
          query: query.slice(0, 120),
          sessionId,
          stats,
        });
      } catch { /* telemetry is non-critical */ }
    }

    return { passages: selected, stats };
  }

  /**
   * Score a passage for distractor signals (0 = clean, 1 = heavy distractor).
   * @param {string} content
   * @returns {number}
   */
  _distractorScore(content) {
    if (!content) return 0;
    let hits = 0;
    for (const pattern of this._distractorPatterns) {
      if (pattern.test(content)) hits++;
    }
    return Math.min(hits / this._distractorPatterns.length, 1);
  }

  /**
   * Estimate whether a query-passage set is at risk of context rot.
   * Returns a CUE (Context Utilisation Efficiency) signal.
   *
   * @param {object[]} passages
   * @param {number}   totalBudgetTokens
   * @returns {{ cue: number, warning: string|null }}
   */
  assessCUE(passages, totalBudgetTokens = 50000) {
    const usedTokens = passages.reduce(
      (sum, p) => sum + Math.ceil((p.content || '').length / 4),
      0
    );
    const cue = totalBudgetTokens > 0 ? usedTokens / totalBudgetTokens : 0;

    let warning = null;
    if (passages.length > 12) {
      warning = `Context rot risk: ${passages.length} chunks exceeds 12-chunk degradation threshold`;
    } else if (cue > 0.5) {
      warning = `Active code context at ${(cue * 100).toFixed(1)}% of budget (limit 50%)`;
    }
    return { cue: +cue.toFixed(4), usedTokens, warning };
  }
}

module.exports = { LDAR };
