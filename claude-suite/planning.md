# Claude Suite Planning

## Mission
Develop a minimal, yet highly interconnected "Claude Suite" inspired by `gsd`. The suite prioritizes a deterministic context engineering approach, separating the LLM reasoning loop from tool execution and state management via an `npx` installable command line interface.

## Current Focus (Phase 5 — Infrastructure Expansion)
- Phases 1–4 are complete (core MVP).
- Phase 5 delivers:
  - `ContextEngine` class (`lib/context-engine.js`) — SQLite FTS5-backed persistent knowledge store for agents.
  - `HookRegistry` class (`lib/hooks.js`) — Deterministic lifecycle hooks (PreToolUse, PostToolUse, EndOfTurn) with priority ordering.
  - Built-in `nyquist-safety` hook blocks dangerous shell commands before MCP tool execution.
  - Orchestrator integrates EndOfTurn hooks on every agent completion/failure cycle.
  - CLI gains `context` (search/store/list fragments) and `hooks` (inspect registry) commands.
  - 128 tests across 6 modules via `npm test` — zero external dependencies.

## Principles
1. Hexagonal architecture for API independence.
2. Wave Execution via Directed Acyclic Graphs (DAG) mapping.
3. Strict Model Context Protocol (MCP) integrations.
