# Claude Suite Planning

## Mission
Develop a minimal, yet highly interconnected "Claude Suite" inspired by `gsd`. The suite prioritizes a deterministic context engineering approach, separating the LLM reasoning loop from tool execution and state management via an `npx` installable command line interface.

## Current Focus (Phase 2 → Phase 3 transition)
- Phase 1 (Core CLI & Initial Structure) is complete.
- Phase 2 (Orchestration Layer) is complete:
  - `AgentOrchestrator` class consumes DAGs and manages wave-based execution.
  - `execute-phase` spawns parallel agents with sterile context (PROJECT.md + REQUIREMENTS.md only).
  - STATE.md is written/updated automatically during execution.
- Next: Implement MCP integrations (Phase 3) — file system capabilities and the Nyquist Layer for AST verification.

## Principles
1. Hexagonal architecture for API independence.
2. Wave Execution via Directed Acyclic Graphs (DAG) mapping.
3. Strict Model Context Protocol (MCP) integrations.
