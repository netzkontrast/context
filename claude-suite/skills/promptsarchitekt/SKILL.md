---
name: promptsarchitekt
description: >
  Self-improving prompt architect and meta-cognitive optimizer. Use when the user says
  "promptsarchitekt", "optimize prompt", "improve prompt", "prompt engineering",
  "distill context", or wants to generate, refine, and persist high-quality prompt
  patterns through evolutionary multi-agent evaluation. Spawns 4 parallel subagents
  (2 Explorers, 1 Critic, 1 Judge) in a serial distillation loop that produces
  increasingly effective prompts. Persists successful patterns as "prompt genomes"
  via triple-write (ContextStore + KnowledgeGraph + MemoryEngine) for cross-session
  retrieval and compounding knowledge. The prompt IS the memory.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Agent
  - TodoWrite
  - WebSearch
metadata:
  version: "1.0.0"
  author: "claude-suite"
  category: "meta-cognition"
---

# Promptsarchitekt — Self-Improving Prompt Architect

A meta-cognitive skill that treats prompts as evolvable artifacts. Through parallel exploration, adversarial critique, and Opus-level arbitration, it distills raw context into minimal, high-impact prompts that compound knowledge across sessions. Each invocation builds on prior "prompt genomes," creating irreversible memory — knowledge that persists even when individual storage layers are cleared.

**Core insight:** The prompt IS the memory. Optimizing prompts = optimizing how we remember.

### Inspirations & Lineage

- **[MIF (Memory Interchange Format)](https://github.com/netzkontrast/MIF):** Three-tier memory ontology (semantic/episodic/procedural), 9 core relationship types (`Supersedes`, `ConflictsWith`, `Implements`), bi-temporal model, exponential decay (`strength = e^(-t/halfLife)`), conformance levels for progressive complexity, dual-format persistence (Markdown + JSON-LD).
- **[soul.md](https://github.com/netzkontrast/soul.md):** Identity-as-language-pattern, "specific enough to be wrong" principle, embracing contradictions as authenticity markers, layered architecture (SOUL/STYLE/SKILL/MEMORY), source priority hierarchy (explicit > data > extrapolation > reasoning), anti-assistant design (no hedging, no both-sides-ism).
- **[Claude Suite context skills](../README.md):** SQ3R deep-reading, LDAR retrieval, IIT Phi coherence monitoring, Blackboard Architecture, Context Rot mitigation, token budget optimization.

### Design Principles (from MIF + soul.md)

1. **Specific enough to be wrong** — Every genome must make falsifiable claims about what works. Vague prompts = generic output.
2. **Embrace contradictions** — If two effective patterns conflict, capture both with a `ConflictsWith` relationship. Real effectiveness has tensions.
3. **Three-tier memory** — Genomes are `semantic` (facts about what works), evolution logs are `episodic` (what happened), distillation rules are `procedural` (how to do it).
4. **Exponential decay with reinforcement** — `strength = e^(-t/halfLife)`. Default halfLife: P30D. Access resets the clock.
5. **Conformance levels** — Level 1: basic genome (text + scores). Level 2: + relationships + lineage. Level 3: + decay model + dual-format + citations.

## Activation

Trigger on: `/promptsarchitekt`, `/promptsarchitekt init`, `/promptsarchitekt <target>`, "optimize prompt", "improve prompt", "distill context", "prompt engineering".

- `/promptsarchitekt init` — Run Phase 0 only (bootstrap, detect project, generate seed genome)
- `/promptsarchitekt` — Run full loop (Phase 0 if first run, then Phases 1-6)
- `/promptsarchitekt <target>` — Optimize prompts for a specific skill, file, or context area

---

## Linked Skills & Infrastructure

This skill builds on and cross-references the entire claude-suite ecosystem:

| Skill | Relationship | Integration Point |
|-------|-------------|-------------------|
| [`/init`](../init/SKILL.md) | Phase 0 reuses detection patterns | Project shape discovery, stack detection |
| [`/research`](../research/SKILL.md) | Phase 1 uses SQ3R methodology | Structured deep-reading of context material |
| [`/audit`](../audit/SKILL.md) | Phase 1 uses anti-pattern scanning | Failure mode detection via Nyquist patterns |
| [`/dev`](../dev/SKILL.md) | Phase 2 follows task decomposition | Atomic candidate generation pattern |
| [`/verify`](../verify/SKILL.md) | Phase 3 uses quality gate model | 5-dimension scoring rubric |
| [`/diagnose`](../diagnose/SKILL.md) | Phase 4 uses root cause analysis | Understanding why candidates fail |
| [`/retro`](../retro/SKILL.md) | Phase 5 uses cross-session trends | Genome lineage tracking, velocity metrics |

**Core Libraries:**
- [`lib/context-store.js`](../../lib/context-store.js) — SQLite FTS5 persistence, BM25 search
- [`lib/knowledge-graph.js`](../../lib/knowledge-graph.js) — Entity-edge relationships, OBSOLETES/IMPLEMENTS edges
- [`lib/coherence-monitor.js`](../../lib/coherence-monitor.js) — IIT Phi-inspired failure detection (CONSERVATIVE_COLLAPSE, VERBOSITY_INFLATION, etc.)
- [`lib/ldar.js`](../../lib/ldar.js) — Learning Distraction-Aware Retrieval for context loading
- [`lib/sq3r.js`](../../lib/sq3r.js) — Survey-Question-Read-Recite-Review deep-reading pipeline
- [`lib/orchestrator.js`](../../lib/orchestrator.js) — Wave-based parallel agent execution
- [`lib/personas.js`](../../lib/personas.js) — Planner/Executor/Verifier/Researcher persona routing

**Context Memory Plan** (branch: `claude/context-memory-hooks-plan-VLUD3`):
- MemoryEngine with capture/retrieve/decay, BM25 search, confidence decay model
- Hook system: SessionStart, PreToolUse, PostToolUse, Stop
- Graceful degradation: if `lib/memory.js` is not yet available, falls back to ContextStore-only persistence

---

## Phase 0: Initialization (INIT)

Bootstrap the skill's understanding of the project. Runs once on first invocation or explicitly via `/promptsarchitekt init`. Idempotent — re-running refreshes the registry without losing existing genomes.

### 0.1 — Detect Project Shape

Execute all discovery reads in parallel:

```
Glob: **/skills/*/SKILL.md
Glob: **/CLAUDE.md, **/AGENTS.md
Glob: **/planning.md, **/roadmap.md, **/backlog.md
Glob: **/package.json, **/Cargo.toml, **/pyproject.toml
Glob: **/lib/*.js
```

### 0.2 — Build Skill Registry Map

Read each discovered SKILL.md. Extract into a registry:

| Field | Source | Purpose |
|-------|--------|---------|
| `name` | YAML frontmatter | Skill identifier |
| `category` | YAML metadata | Grouping for cross-linking |
| `allowed-tools` | YAML frontmatter | Tool overlap matrix |
| `phase_count` | Markdown headings | Complexity signal |
| `anti_patterns` | "Anti-Patterns" section | Negative examples catalog |
| `activation_triggers` | "Activation" section | Keyword universe |

### 0.3 — Scan Infrastructure

Inventory available core libraries:
- Check which `lib/*.js` modules exist and are importable
- Determine if MemoryEngine (`lib/memory.js`) is available (warm path) or absent (cold path)
- Read `CLAUDE.md` for token budget rules, context distillation algorithms, quality checklists

### 0.4 — Check for Existing Genomes

Search context-store:
- Key pattern: `promptsarchitekt:genome:*`
- If genomes exist → **warm start** (retrieve lineage, skip seed generation)
- If no genomes → **cold start** (generate seed genome in 0.5)

### 0.5 — Generate Seed Genome (Cold Start Only)

If no prior genomes exist, synthesize a generation-0 genome from the collected context:
1. Extract the 5 most common structural patterns across all SKILL.md files
2. Extract the top anti-patterns from coherence-monitor FAILURE_SIGNALS
3. Distill into a baseline prompt template (target: <300 tokens)
4. Write as `promptsarchitekt:genome:seed` to context-store

### 0.6 — Output Readiness Report

```
Promptsarchitekt initialized
  Skills detected: <N> (<list>)
  Infrastructure: ContextStore ✓ | KnowledgeGraph ✓ | MemoryEngine ✓/✗
  Existing genomes: <N> (generation <max>)
  Mode: cold-start | warm-start
  Ready for: /promptsarchitekt
```

---

## Phase 1: Harvest (HARVEST)

Gather raw context material through two parallel Explorer agents. This is a single wave with concurrency 2.

### 1.1 — Spawn Explorer-A (Sonnet, Researcher Persona)

**Task:** Scan for positive patterns — the raw material for prompt construction.

```
Agent: subagent_type=Explore, model=sonnet
```

Explorer-A executes:
1. Read all `skills/*/SKILL.md` files — extract phase structures, tool usage, activation keywords
2. Read `CLAUDE.md` — extract token budget rules, context distillation algorithm, quality checklist
3. Read `AGENTS.md` — extract operating directives, security posture, memory rules
4. Search context-store for `promptsarchitekt:genome:*` — retrieve prior successful genomes
5. Run `scripts/distill-context.sh <project-dir>` — extract structural signals
6. If `<target>` was specified, focus on files related to that target

**Output to blackboard:** Raw pattern catalog with source attribution.

### 1.2 — Spawn Explorer-B (Sonnet, Verifier Persona)

**Task:** Scan for anti-patterns — what to avoid in prompt construction.

```
Agent: subagent_type=Explore, model=sonnet
```

Explorer-B executes:
1. Grep all SKILL.md files for `# Anti-Patterns` sections — catalog negative examples
2. Search context-store for `promptsarchitekt:failed:*` — retrieve prior rejected genomes
3. Read `lib/coherence-monitor.js` FAILURE_SIGNALS — extract regex patterns for:
   - CONSERVATIVE_COLLAPSE (refusals, hedging, copyright evasion)
   - VERBOSITY_INFLATION (answer bloat, >300% single-turn length)
   - PREMATURE_COMMITMENT (assumption locking)
   - CONFIDENT_CONFUSION (confident but wrong)
4. Scan existing prompts for these failure signals
5. Catalog prompt constructions that demonstrably degrade agent performance

**Output to blackboard:** Anti-pattern catalog with failure mode classification.

### 1.3 — Merge Explorer Outputs

Wait for both Explorers to complete. Merge their blackboard entries into a unified context document:
- Positive patterns (from Explorer-A)
- Anti-patterns (from Explorer-B)
- Prior genome lineage (if warm start)
- Target-specific signals (if target specified)

---

## Phase 2: Distillation (DISTILL)

Compress harvested material into candidate prompt genomes using SQ3R methodology.

### 2.1 — Retrieve Prior Art

If warm start:
- Query context-store via BM25 for top-K genomes relevant to the target context
- Apply LDAR algorithm (max 8 chunks) to prevent context flooding
- Extract: what worked (high scores), what failed (low scores), evolution trajectory

### 2.2 — Apply SQ3R

Following the [`/research`](../research/SKILL.md) methodology:

1. **Survey:** Scan the merged Explorer output — identify structural boundaries, key themes
2. **Question:** Formulate 3-5 specific questions:
   - What is the minimal instruction set that produces correct behavior?
   - Which constraints prevent the most common failure modes?
   - What structural patterns compress the most knowledge per token?
   - How can this prompt chain with other skills?
   - What makes this prompt resistant to context rot?
3. **Read:** Deep-read the relevant passages from Explorer output, guided by questions
4. **Recite:** Synthesize findings into candidate prompt structures
5. **Review:** Cross-check against anti-pattern catalog — reject candidates that trigger failure signals

### 2.3 — Generate Candidate Genomes

Produce 3-5 candidate prompt variants. Each candidate is a prompt genome:

```json
{
  "genome_id": "pg-<ulid>",
  "generation": "<N+1>",
  "parent_id": "<parent genome or null for cold-start>",
  "prompt_text": "<the actual prompt, target <500 tokens>",
  "target_context": "<skill | workflow | agent-directive | general>",
  "hypothesis": "<why this variant should outperform alternatives>",
  "structural_notes": "<which SQ3R phase it optimizes, which failure mode it mitigates>"
}
```

**Constraint:** Each candidate MUST be under 500 tokens. Memory density over verbosity.

---

## Phase 3: Challenge (CHALLENGE)

Adversarial evaluation of candidates by the Critic agent.

### 3.1 — Spawn Critic (Sonnet, Verifier Persona)

```
Agent: model=sonnet
```

The Critic receives:
- All candidate genomes from Phase 2
- Anti-pattern catalog from Explorer-B
- Scoring rubric (5 dimensions)

### 3.2 — Score Each Candidate

Evaluate on 5 dimensions (0-10 each, total 0-50):

| Dimension | What It Measures | Anti-Pattern It Guards Against |
|-----------|-----------------|-------------------------------|
| **Specificity** | Named entities, concrete instructions vs vague generalities | VERBOSITY_INFLATION |
| **Constraint Clarity** | Explicit boundaries (MUST/NEVER/ALWAYS), unambiguous scope | PREMATURE_COMMITMENT |
| **Failure Resistance** | Alignment with coherence-monitor signals, defensive phrasing | CONSERVATIVE_COLLAPSE |
| **Memory Density** | Knowledge-per-token ratio, no filler, no redundancy | Context Rot (token waste) |
| **Composability** | Can chain with other skills, references are valid, modular | Isolation / dead-end prompts |

### 3.3 — Adversarial Testing

For each candidate, the Critic attempts to "break" it:
- Construct edge-case inputs where the prompt produces degenerate output
- Test with missing context (what if context-store is empty?)
- Test with contradictory context (what if Explorer outputs conflict?)
- Flag vulnerabilities in the challenge report

### 3.4 — Output Challenge Report

For each candidate:
```
Candidate: <genome_id>
  Scores: S:<N> CC:<N> FR:<N> MD:<N> CO:<N> = <total>/50
  Vulnerabilities: <list or "none found">
  Recommendation: advance | reject | merge-with:<other-id>
```

---

## Phase 4: Arbitration (ARBITRATE)

Final selection by the Judge — the only Opus-tier agent.

### 4.1 — Spawn Judge (Opus, Planner Persona)

```
Agent: model=opus
```

The Judge receives:
- All candidates with Critic scores and challenge reports
- Historical genome performance data (if warm start)
- The evolution trajectory (lineage of prior winners)

### 4.2 — Rank and Select

1. Compute weighted rank: Critic total (70%) + historical reinforcement bonus (30%)
   - Historical bonus: +5 points if candidate aligns with patterns from top-3 prior genomes
   - Penalty: -3 points for each unmitigated vulnerability flagged by Critic
2. Select top candidate as **winner**
3. Optionally merge elements from runner-up candidates (**gene recombination**):
   - If runner-up scores higher on a specific dimension, graft that section into the winner
   - Document what was merged and why

### 4.3 — Write Rationale

The Judge produces a written rationale for the selection. This rationale is itself a learning artifact:
- Why this candidate won
- What trade-offs were accepted
- What the next generation should improve

### 4.4 — Assign Confidence

- New genome (cold start): confidence = 0.70
- Evolved genome (warm start, improves on parent): confidence = parent.confidence + 0.05 (capped at 1.0)
- Regression (warm start, scores lower than parent): confidence = 0.60

---

## Phase 5: Reinforcement (REINFORCE)

Persist the winning genome through triple-write for irreversible memory.

### 5.1 — Write to Context Store

```
Key: promptsarchitekt:genome:<timestamp>    → winning genome JSON
Key: promptsarchitekt:score:<timestamp>     → Judge scores + rationale
Key: promptsarchitekt:failed:<timestamp>    → rejected candidates (for Explorer-B next run)
```

### 5.2 — Write to Knowledge Graph

```
Upsert Decision node: prompt:genome:<genome_id>
  → IMPLEMENTS edges to all 7 skill Requirement nodes
  → OBSOLETES edge to prior winning genome (if warm start)
  → DEPENDS_ON edges to: context-store, knowledge-graph, coherence-monitor
```

### 5.3 — Write to Memory Engine (if available)

If `lib/memory.js` is available:
```
capture({
  type: 'pattern',
  scope: 'global',
  content: <winning genome prompt_text>,
  source: 'promptsarchitekt:phase5',
  tags: ['prompt-genome', 'generation-<N>', <target_context>],
  confidence: <Judge-assigned confidence>
})

capture({
  type: 'decision',
  scope: 'global',
  content: <Judge rationale>,
  source: 'promptsarchitekt:judge',
  tags: ['arbitration', 'generation-<N>']
})
```

If `lib/memory.js` is NOT available: log a note and rely on ContextStore + KnowledgeGraph persistence only. The skill degrades gracefully — two of three persistence layers still operate.

### 5.4 — The Irreversibility Guarantee

The triple-write creates redundant, cross-referenced knowledge:
- **ContextStore:** FTS5-searchable, retrievable via BM25
- **KnowledgeGraph:** Structurally linked via IMPLEMENTS/OBSOLETES edges
- **MemoryEngine:** Decay-aware, reinforced on access

No single deletion erases the knowledge. Even if one store is cleared, the other two preserve the genome and its relationships. The OBSOLETES edges create an immutable lineage — you can always trace back to generation 0.

---

## Phase 6: Evolution (EVOLVE)

Close the self-improving loop. This phase prepares the ground for the NEXT invocation.

### 6.1 — Compute Evolution Delta

Compare the winning genome's total score against the historical average:
```
delta = (current_score - historical_avg) / historical_avg * 100
```

### 6.2 — Classify Result

| Delta | Classification | Action |
|-------|---------------|--------|
| > +5% | **Breakthrough** | Boost confidence +0.1, reduce decay rate to 0.05, flag for reinforcement |
| -5% to +5% | **Stable** | Standard confidence, standard decay rate 0.1 |
| < -5% | **Regression** | Reduce confidence to 0.60, increase Explorer-B weight next run, flag for review |

### 6.3 — Update Lineage

Increment the generation counter. Write a session summary:
```
capture({
  type: 'context',
  scope: 'session',
  content: 'Generation <N>: <classification>. Delta: <X>%. Winner: <genome_id>. Key improvement: <from rationale>.',
  source: 'promptsarchitekt:evolve'
})
```

### 6.4 — Output to User

```
Promptsarchitekt complete
  Generation: <N> (<classification>)
  Winning genome: <genome_id> (score: <total>/50, confidence: <X>)
  Delta vs prior: <+/-X%>
  Key insight: <Judge's top rationale point>
  Prompt text: <the winning prompt, displayed for review>

  Lineage: gen0 → gen1 → ... → genN
  Persistence: ContextStore ✓ | KnowledgeGraph ✓ | MemoryEngine ✓/✗

  Next run will build on this genome.
```

---

## The Self-Improving Loop

The skill gets better at creating prompts over time through four mechanisms:

1. **Evolutionary Selection Pressure:** Each generation's winner becomes the parent of the next. Genomes that score well propagate; those that don't are written to `failed:*` keys and used as negative examples.

2. **BM25 Retrieval of Prior Art:** Phase 2 uses LDAR to surface only the most relevant prior genomes. The FTS5 index ensures that as the corpus grows, retrieval remains focused (not flooded).

3. **Confidence Decay:** Genomes that aren't reinforced (retrieved and used) gradually lose influence. The logarithmic decay (`confidence × (1 - 0.1 × ln(1 + days))`) means a genome drops below the 0.2 pruning threshold after ~60 days without access. Active genomes stay strong.

4. **Adversarial Pressure:** Explorer-B and the Critic create constant selection pressure against failure modes. Each generation must survive adversarial testing that incorporates all previously discovered anti-patterns.

The result: a ratchet mechanism. Knowledge compounds. Failures are remembered. The prompt genome evolves.

---

## Decision Framework

When facing choices during prompt optimization:

1. **Density over verbosity** — fewer tokens with more impact always wins
2. **Failure resistance over elegance** — a robust prompt beats a beautiful one
3. **Composability over specificity** — prompts that chain with other skills are more valuable
4. **Evidence over intuition** — scores and historical data override aesthetic preferences
5. **Irreversibility over convenience** — always triple-write, even if one store seems sufficient

## Anti-Patterns (Do NOT)

- Don't generate prompts longer than 500 tokens — density is the goal
- Don't skip Phase 0 INIT on first run — cold-start without a seed genome produces poor candidates
- Don't let the Judge override the Critic's vulnerability findings without documenting why
- Don't store genomes without lineage links — the evolution chain must be traceable
- Don't assume warm start — always check for existing genomes before retrieving
- Don't run Phase 1-6 without checking INIT status — the skill registry must exist
- Don't write to only one persistence layer — triple-write is the irreversibility guarantee
- Don't generate candidates that trigger coherence-monitor FAILURE_SIGNALS — the Critic must catch these
