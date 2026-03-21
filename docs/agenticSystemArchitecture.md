# Agentic System Architecture: Engineering the Architecture of Intent

> **Scope**: Implementation-level module specifications for `claude-suite/lib/`. This is the most code-adjacent architecture doc. For theoretical foundations, see [strategicResearchRoadmap.md](./strategicResearchRoadmap.md). For the high-level system design, see [comprehensiveArchitectureBlueprint.md](./comprehensiveArchitectureBlueprint.md).
>
> **Implementation Status**: All modules described below have been implemented and tested. See `claude-suite/roadmap.md` (Phases 1–7 complete).

*Reference synthesis from the Strategic Research Roadmap. Distilled to implementation-relevant primitives for the Claude Suite.*

---

## 1. Core Problem: Context Rot

**Context Rot** is the systematic, measurable degradation of model accuracy as input context length increases — even when the underlying task is trivially simple. Empirically confirmed across all 18 frontier models tested (Chroma 2025):

- Execution quality peaks at **~4 context chunks** (~94% accuracy)
- Beyond **12 chunks**, quality drops below zero-retrieval baselines (–20%)
- Logically coherent documents trigger **more** distraction than randomly shuffled text
- Multi-turn agentic workflows: **39% performance drop** vs single-turn (Microsoft/Salesforce 2025)

### Model-Family Failure Modes

| Model Family | Failure Mode | Mechanism |
|---|---|---|
| Claude (Opus/Sonnet) | Conservative Collapse | Refuses trivial tasks, cites hallucinated copyright concerns |
| GPT (4.1) | Confident Confusion | Confident, incorrect responses; duplicate hallucinations |
| Gemini (2.5 Pro) | Rapid Flakiness | Fastest attention dilution onset; erratic across windows |

These map to the **Theory of Structural Dissociation of Personality (TSDP)**:
- Conservative Collapse = dissociative "protective suppression" (System 2 toggled off)
- Confident Confusion = first-order PTSD (overcorrected weight cascade)
- Rapid Flakiness = chronic adversarial training pattern lock-in

---

## 2. Learning Distraction-Aware Retrieval (LDAR)

**Module:** `lib/ldar.js`

Replaces naive top-k FTS5 retrieval with adaptive band selection:

```
retrieve(query, sessionId?) → { passages[], stats }
```

**Algorithm:**
1. Retrieve up to `maxCandidates` (default 50) via FTS5 BM25
2. Normalise BM25 ranks to similarity ∈ [0,1]
3. Compute distribution statistics (mean, stddev, gap analysis)
4. If clear high-similarity cluster (gap > 1.5σ) → **narrow band** (take cluster)
5. Else → **wide band** with distractor penalty applied
6. Hard-cap at `maxChunks` (default 8, well below 12-chunk rot threshold)

**CUE Assessment:**
```
assessCUE(passages, totalBudgetTokens) → { cue, usedTokens, warning }
```
- Warns when `passages.length > 12` (rot threshold)
- Warns when token usage > 50% of active code budget

**Distractor patterns:** narrative connectives (`furthermore`, `as mentioned`), TODO markers, lone bullet points.

---

## 3. Knowledge Graph

**Module:** `lib/knowledge-graph.js`

SQLite-backed entity-edge graph for codebase relationship mapping.

### Entity Schema
```json
{
  "node_id": "lib/ldar.js",
  "type": "File | Function | Class | Requirement | Decision",
  "content_hash": "sha256...",
  "metadata": {}
}
```

### Edge Schema
```json
{
  "source_id": "lib/ldar.js",
  "target_id": "REQ-5",
  "relationship": "IMPLEMENTS | DEPENDS_ON | MODIFIES | OBSOLETES | TESTS",
  "weight": 1.0
}
```

### ContextRelevanceScore (0.0–1.0)
Used to decide whether to load a file into working memory:

| Factor | Weight |
|---|---|
| Semantic Overlap (caller-supplied) | 40% |
| Temporal Proximity (recently modified) | 30% |
| Dependency Centrality (in+out degree) | 20% |
| Failure History (associated test failures) | 10% |

**Eviction rule:** Files scoring below 0.4 must be removed from context window.

### Refactor Tracking
```js
kg.registerRefactor('fn_old', 'fn_new', 'REQ-5');
// Adds: fn_new → OBSOLETES → fn_old
//        fn_new → IMPLEMENTS → REQ-5
```

### Multi-hop Traversal
```js
kg.traverse('lib/orchestrator.js', 2, 'DEPENDS_ON')
// Returns: { nodes: [...], edges: [...] }
```

---

## 4. Coherence Monitor (IIT Phi-Proxy)

**Module:** `lib/coherence-monitor.js`

Approximates Integrated Information Theory Phi (Φ) as a session coherence score.

### Phi Formula (computational proxy)
```
Φ_approx = overlap_coefficient × diversity_factor × (1 - refusal_rate) × verbosity_penalty
```

- **High, stable Φ** (> 0.75): cohesive session, low rot risk
- **Collapsing Φ** (< 0.25): critical degradation — trigger distillation and context reset

### Rot Risk Levels
| Φ Range | Risk Level | Recommended Action |
|---|---|---|
| > 0.75 | low | Continue normally |
| 0.50–0.75 | medium | Monitor; consider pruning |
| 0.25–0.50 | high | Distill context, evict resolved nodes |
| < 0.25 | critical | Halt wave; `/clear`; push episodic snapshot |

### Usage
```js
const monitor = new CoherenceMonitor();
monitor.record({ sessionId: 's1', taskId: 't1', response: '...' });
const { phi, failureMode, rotRisk, warning } = monitor.assess('s1');
const snapshot = monitor.distill('s1'); // < 500 token Markdown summary
monitor.clearSession('s1');             // evict after pushing snapshot
```

---

## 5. Token Budget Allocation

**From CLAUDE.md (enforced proportions for 200k token window):**

| Budget Category | Allocation |
|---|---|
| System Directives & Schema | 10% (20k tokens) |
| Task Definition & Requirements | 15% (30k tokens) |
| Active Code Context | **50% (100k tokens)** ← LDAR governs this |
| Execution History & Distilled Memory | 10% (20k tokens) |
| Generation Buffer | 15% (30k tokens) |

The `ContextStore.getSessionTokenBudget(sessionId)` method returns current token usage by key; LDAR's `assessCUE()` signals when the active code allocation is breached.

---

## 6. SQ3R Execution Pipeline (for Researcher Agent)

Enforced methodology for large document ingestion (Phase 6 Wave 3):

| Phase | Constraint |
|---|---|
| Survey | Extract ToC/directory tree into SQLite only — no raw `cat` |
| Question | Generate 3–5 specific query strings (Porter stemming) |
| Read | Execute LDAR retrieval; max 3 iterations; throttle depth |
| Recite | Synthesise findings into compressed summary; no raw parroting |
| Review | `/clear` to purge ephemeral search history before next objective |

---

## 7. MCP Gateway — Code Mode (Phase 11)

**Resolves:** N×M tool schema injection (150+ tool definitions per request = 600+ tokens/turn overhead)

**Solution:** Expose only 3 meta-tools:
1. `listToolFiles` — discover available tool schemas
2. `readToolFile` — load specific schema on demand
3. `executeToolCode` — run generated TypeScript workflow in sandbox

**Benefits vs prompt-based orchestration:**
- ~50% token reduction
- 30–40% latency reduction
- Single-turn workflow generation instead of multi-turn ping-pong
- Deterministic sandbox execution with full audit trail

---

## 8. Paraconsistent Logic (Planned — Phase 10 Wave 2)

When two context entries contradict each other, classical logic triggers explosion (any conclusion can be derived). LDAR's distractor filtering partially mitigates this, but explicit contradiction detection is needed:

```
store.detectContradiction(sessionId, key)
// Returns: { hasContradiction: bool, conflicting: [snapshot_a, snapshot_b] }
```

On contradiction:
1. Isolate the paradox (do not synthesise silently)
2. Post `Blocked` event to Blackboard with conflicting snapshots
3. Spawn parallel branches or escalate to human arbitration

---

*This document is a living reference. Update when Phase 10 Wave 2 integration is complete.*
