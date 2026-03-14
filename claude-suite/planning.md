# Claude Suite Planning

## Mission
Develop a minimal, yet highly interconnected "Claude Suite" inspired by `gsd`. The suite prioritizes a deterministic context engineering approach, separating the LLM reasoning loop from tool execution and state management via an `npx` installable command line interface.

## Current Focus (Phase 4 Complete — All Phases Done)
- Phases 1–4 are complete.
- Phase 4 (Refinement) delivered:
  - `TruthVerifier` class (`lib/truth-verifier.js`) with JSON-schema-like validation and statistical confidence scoring.
  - Pre-configured `createAgentVerifier()` factory with `agent-report` (85% threshold) and `wave-result` (100% threshold) schemas.
  - `AgentOrchestrator` now runs TruthVerifier on every agent JSON output; non-conforming outputs are rejected before updating state.
  - 77 end-to-end tests across all core modules (`nyquist`, `mcp-registry`, `roadmap-parser`, `truth-verifier`) via `npm test`.
  - `package.json` test script wired to Node's built-in `node:test` runner — zero additional dependencies.

## Principles
1. Hexagonal architecture for API independence.
2. Wave Execution via Directed Acyclic Graphs (DAG) mapping.
3. Strict Model Context Protocol (MCP) integrations.
