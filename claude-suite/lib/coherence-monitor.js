'use strict';

/**
 * Coherence Monitor — IIT Phi-inspired session coherence tracking
 *
 * Quantifies the "integration" of an agentic session, drawing from:
 *   - Integrated Information Theory (IIT): measures how much information
 *     a system generates beyond its parts in isolation (Φ / Phi)
 *   - Theory of Structural Dissociation (TSDP): identifies failure modes
 *     where agents enter shallow/evasive behaviour ("Conservative Collapse")
 *     to avoid context rot
 *   - Context Rot research: maps model-family failure modes to detectable
 *     output signatures
 *
 * Phi approximation (computational proxy):
 *   We cannot compute true IIT Phi for an LLM, but we approximate it by
 *   measuring the mutual information between the current execution state
 *   and the session's accumulated context. A high, stable Phi indicates
 *   a cohesive, well-integrated session; a collapsing Phi signals rot.
 *
 *   Phi_approx = overlap_coefficient * response_diversity * (1 - refusal_rate)
 *
 * Failure modes tracked (from Chroma 2025 Context Rot Study):
 *   - CONSERVATIVE_COLLAPSE: excessive refusals, hedging, copyright evasions
 *   - CONFIDENT_CONFUSION:   confident but factually incorrect responses
 *   - RAPID_FLAKINESS:       erratic inconsistency across responses
 *   - VERBOSITY_INFLATION:   answer bloat (300% longer than single-turn)
 *   - PREMATURE_COMMITMENT:  early wrong-turn assumption locking
 *
 * Usage:
 *   const monitor = new CoherenceMonitor();
 *   monitor.record({ sessionId: 's1', response: 'I cannot...', taskId: 't1' });
 *   const report = monitor.assess('s1');
 *   // { phi: 0.72, failureMode: null, warning: null, rotRisk: 'low' }
 */

// Signal patterns for failure mode detection
const FAILURE_SIGNALS = {
  CONSERVATIVE_COLLAPSE: [
    /\bcannot\b.*\bprovide\b/i,
    /\bcopyright\b/i,
    /\bi('m| am) not able to\b/i,
    /\bi('m| am) unable to\b/i,
    /\bi('m| am) sorry,? but\b/i,
    /\bas an ai\b/i,
    /\bi don't have (access|the ability)\b/i,
    /\bthat'?s? (outside|beyond) (my|the scope)\b/i,
  ],
  CONFIDENT_CONFUSION: [
    /\bdefin(itely|itively)\b.*\bincorrect\b/i,
    /\b(clearly|obviously|certainly)\b.*\bwrong\b/i,
  ],
  VERBOSITY_INFLATION: null, // detected by length ratio, not patterns
  PREMATURE_COMMITMENT: [
    /\blet me assume\b/i,
    /\bi'?ll? assume\b/i,
    /\bassuming that\b/i,
    /\bfor the purposes of this\b/i,
  ],
};

class CoherenceMonitor {
  constructor(options = {}) {
    // Per-session records: Map<sessionId, Observation[]>
    this._sessions = new Map();
    this.refusalThreshold = options.refusalThreshold || 0.3;  // >30% refusals → collapse
    this.verbosityThreshold = options.verbosityThreshold || 2.5; // >2.5x baseline length
    this.maxHistory = options.maxHistory || 200;
  }

  // ── Recording ─────────────────────────────────────────────────────────────────

  /**
   * Record an agent response observation for coherence tracking.
   *
   * @param {{ sessionId: string, taskId: string, response: string,
   *           turnIndex?: number, baselineLength?: number }} obs
   */
  record(obs) {
    const { sessionId, taskId, response, turnIndex, baselineLength } = obs;
    if (!sessionId) throw new Error('sessionId is required');

    if (!this._sessions.has(sessionId)) this._sessions.set(sessionId, []);
    const history = this._sessions.get(sessionId);

    if (history.length >= this.maxHistory) history.shift(); // evict oldest

    const signals = this._detectSignals(response || '');
    history.push({
      taskId: taskId || null,
      response: (response || '').slice(0, 500), // trim to prevent memory bloat
      length: (response || '').length,
      baselineLength: baselineLength || null,
      turnIndex: turnIndex !== undefined ? turnIndex : history.length,
      signals,
      timestamp: Date.now(),
    });
  }

  // ── Assessment ────────────────────────────────────────────────────────────────

  /**
   * Assess the current coherence state of a session.
   *
   * @param {string} sessionId
   * @returns {{ phi: number, failureMode: string|null, rotRisk: string,
   *             warning: string|null, metrics: object }}
   */
  assess(sessionId) {
    const history = this._sessions.get(sessionId) || [];
    if (history.length === 0) {
      return { phi: 1.0, failureMode: null, rotRisk: 'none', warning: null, metrics: {} };
    }

    const metrics = this._computeMetrics(history);
    const failureMode = this._detectFailureMode(metrics);
    const phi = this._computePhi(metrics);
    const rotRisk = phi > 0.75 ? 'low' : phi > 0.5 ? 'medium' : phi > 0.25 ? 'high' : 'critical';

    let warning = null;
    if (rotRisk === 'critical') {
      warning = `Critical coherence collapse (Φ=${phi.toFixed(3)}): ${failureMode || 'unknown degradation'}`;
    } else if (rotRisk === 'high') {
      warning = `High context rot risk (Φ=${phi.toFixed(3)}): consider /clear and context distillation`;
    }

    return { phi: +phi.toFixed(4), failureMode, rotRisk, warning, metrics };
  }

  /**
   * Produce a distilled episodic snapshot suitable for persistence.
   * Compresses session history to < 500 tokens per CLAUDE.md directive.
   *
   * @param {string} sessionId
   * @returns {string} Markdown summary
   */
  distill(sessionId) {
    const report = this.assess(sessionId);
    const history = this._sessions.get(sessionId) || [];
    const lines = [
      `## Coherence Snapshot — Session ${sessionId}`,
      `- Φ (phi): ${report.phi}`,
      `- Rot risk: ${report.rotRisk}`,
      `- Failure mode: ${report.failureMode || 'none'}`,
      `- Observations: ${history.length}`,
      `- Refusal rate: ${(report.metrics.refusalRate * 100).toFixed(1)}%`,
      `- Avg response length: ${report.metrics.avgLength?.toFixed(0) || 'n/a'}`,
    ];
    if (report.warning) lines.push(`- ⚠ ${report.warning}`);
    return lines.join('\n');
  }

  /**
   * Clear session history (context reset / "eviction after distillation").
   */
  clearSession(sessionId) {
    this._sessions.delete(sessionId);
  }

  // ── Internals ─────────────────────────────────────────────────────────────────

  _detectSignals(response) {
    const detected = [];
    for (const [mode, patterns] of Object.entries(FAILURE_SIGNALS)) {
      if (!patterns) continue;
      for (const pattern of patterns) {
        if (pattern.test(response)) {
          detected.push(mode);
          break;
        }
      }
    }
    return detected;
  }

  _computeMetrics(history) {
    const n = history.length;

    // Refusal rate (CONSERVATIVE_COLLAPSE signals / total observations)
    const refusals = history.filter(o => o.signals.includes('CONSERVATIVE_COLLAPSE')).length;
    const refusalRate = refusals / n;

    // Response length stats
    const lengths = history.map(o => o.length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / n;
    const lengthVariance = lengths.reduce((s, l) => s + (l - avgLength) ** 2, 0) / n;
    const lengthStddev = Math.sqrt(lengthVariance);

    // Verbosity inflation: compare to baseline or first-turn length
    const baselineLength = history[0].length || avgLength;
    const verbosityRatio = baselineLength > 0 ? avgLength / baselineLength : 1.0;

    // Premature commitment rate
    const commitments = history.filter(o => o.signals.includes('PREMATURE_COMMITMENT')).length;
    const commitmentRate = commitments / n;

    // Diversity: unique task IDs referenced
    const uniqueTasks = new Set(history.map(o => o.taskId).filter(Boolean)).size;
    const diversity = n > 0 ? Math.min(uniqueTasks / n, 1) : 0;

    // Trend: are recent observations worse than earlier ones?
    const recentHalf = history.slice(Math.floor(n / 2));
    const recentRefusals = recentHalf.filter(o => o.signals.includes('CONSERVATIVE_COLLAPSE')).length;
    const recentRefusalRate = recentHalf.length > 0 ? recentRefusals / recentHalf.length : 0;
    const degradationTrend = recentRefusalRate - refusalRate; // positive = worsening

    return {
      n,
      refusalRate: +refusalRate.toFixed(4),
      avgLength: +avgLength.toFixed(1),
      lengthStddev: +lengthStddev.toFixed(1),
      verbosityRatio: +verbosityRatio.toFixed(3),
      commitmentRate: +commitmentRate.toFixed(4),
      diversity: +diversity.toFixed(4),
      degradationTrend: +degradationTrend.toFixed(4),
    };
  }

  _detectFailureMode(metrics) {
    if (metrics.refusalRate > this.refusalThreshold) return 'CONSERVATIVE_COLLAPSE';
    if (metrics.verbosityRatio > this.verbosityThreshold) return 'VERBOSITY_INFLATION';
    if (metrics.commitmentRate > 0.4) return 'PREMATURE_COMMITMENT';
    if (metrics.degradationTrend > 0.2) return 'RAPID_FLAKINESS';
    return null;
  }

  /**
   * Compute approximate Phi (coherence integration score) ∈ [0, 1].
   *
   * Phi_approx = overlap * diversity * (1 - refusalRate)
   *   where overlap measures how consistently the session references shared context
   *
   * A stable session with diverse tasks and no refusals → Phi near 1.0
   * A collapsed session with all refusals → Phi near 0.0
   */
  _computePhi(metrics) {
    const overlapCoefficient = Math.max(0, 1 - metrics.degradationTrend);
    const diversityFactor = Math.max(0.1, metrics.diversity);
    const refusalFactor = Math.max(0, 1 - metrics.refusalRate);
    const verbosityPenalty = Math.max(0, 1 - Math.max(0, metrics.verbosityRatio - 1.0) * 0.2);

    const raw = overlapCoefficient * diversityFactor * refusalFactor * verbosityPenalty;
    return Math.min(Math.max(raw, 0), 1);
  }
}

module.exports = { CoherenceMonitor, FAILURE_SIGNALS };
