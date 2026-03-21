# Claude Suite Architectural Documentation

> Last updated: 2026-03-21

This directory contains the foundational research, blueprints, and implementation strategies for the Claude Suite. It is structured to support the SQ3R (Survey, Question, Read, Recite, Review) deep-reading methodology for AI agent ingestion.

## Reading Order

Start with the Strategic Research Roadmap for theory, then move to implementation-level docs. The Comprehensive and Advanced blueprints overlap significantly — read whichever matches your focus (system internals vs. ecosystem analysis). The Agentic doc is the most implementation-specific.

| # | Document | Scope | Audience |
|---|----------|-------|----------|
| 1 | [Strategic Research Roadmap](./strategicResearchRoadmap.md) | **Theory & Philosophy** — Software 3.0 epistemology, Architecture of Intent, Hexagonal decoupling, IIT, TSDP, paraconsistent logic | Architects, researchers seeking foundational rationale |
| 2 | [Comprehensive Architecture Blueprint](./comprehensiveArchitectureBlueprint.md) | **System Design** — Five-Layer architecture, Context Engine, Orchestrator, MCP Registry, Nyquist Validation, LDAR, SQ3R, deep-reading pipelines | Engineers building or extending the suite internals |
| 3 | [Advanced Architectural Blueprint](./advancedArchitecturalBlueprint.md) | **Ecosystem Analysis** — Critical review of open-source repos (`awesome-claude-code`, `get-shit-done`), Wave Execution DAGs, Strangler Fig refactoring, skill modularity patterns | Engineers evaluating integration patterns and external tools |
| 4 | [Agentic System Architecture](./agenticSystemArchitecture.md) | **Implementation Primitives** — Context Rot metrics, LDAR algorithm, Knowledge Graph schema, Coherence Monitor, Token Budget, SQ3R pipeline, module-level specifications | Engineers implementing or debugging `lib/` modules |

## Implementation Status

All modules referenced in the architecture documents have been implemented and tested:

- `lib/ldar.js` — Learning Distraction-Aware Retrieval
- `lib/knowledge-graph.js` — Semantic relationship mapping
- `lib/coherence-monitor.js` — Context coherence tracking
- `lib/orchestrator.js` — Wave execution engine
- `lib/context-store.js` — Persistent memory (SQLite)
- `lib/sq3r.js` — SQ3R deep-reading pipeline
- `lib/nyquist.js` — Command classification
- `lib/truth-verifier.js` — Schema validation
- `lib/personas.js` — Agent persona registry
- `lib/skill-loader.js` — Progressive skill disclosure
- `lib/telemetry.js` — Token & execution tracking
- `lib/agent-runner.js` — Subprocess execution
- `lib/roadmap-parser.js` — DAG construction
- `lib/mcp-registry.js` — MCP tool bus

See `claude-suite/roadmap.md` for full phase completion status (Phases 1–7 complete, 163+ tests passing).

## Project Planning & Restructuring (Historical)

These documents record the analysis and execution of the repository restructuring from its initial monolithic state to the current modular, domain-driven structure. **All actions described have been completed.**

- **[Gedanken (Refactoring Thoughts)](./gedanken.md):** Analysis and reasoning for directory restructuring — de-obfuscation of agent skills, consolidation of state files, domain-driven script placement.
- **[Execution Plan](./plan.md):** Step-by-step phases that were executed to reorganize the repository. All 5 phases are complete.

## Key Terminology

| Term | Definition |
|------|-----------|
| Context Rot | Measurable degradation of model accuracy as input context grows |
| Wave Execution | Parallel task deployment via DAG-resolved dependency waves |
| LDAR | Learning Distraction-Aware Retrieval — filters hard-negative context chunks |
| SQ3R | Survey, Question, Read, Recite, Review — structured deep-reading methodology |
| Nyquist Layer | Zero-trust command classification (safe / guarded / blocked) |
| TSDP | Theory of Structural Dissociation — AI failure mode taxonomy |
| MCP | Model Context Protocol — standardized tool communication |
