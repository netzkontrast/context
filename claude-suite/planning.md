# Claude Suite Planning

## Mission
Develop a minimal, yet highly interconnected "Claude Suite" inspired by `gsd`. The suite prioritizes a deterministic context engineering approach, separating the LLM reasoning loop from tool execution and state management via an `npx` installable command line interface.

## Current Focus (Phase 3 → Phase 4 transition)
- Phases 1–3 are complete.
- Phase 3 (MCP Integrations) delivered:
  - `MCPRegistry` with 6 sandboxed file system tools (read, write, list, exists, delete, append).
  - Path-escape prevention — all tools scoped to project root.
  - Nyquist Layer: AST-like shell command classifier (SAFE / GUARDED / BLOCKED).
  - CLI commands: `mcp-tools` (list capabilities), `verify` (check commands).
  - Agent-runner now initializes MCP tools and Nyquist on spawn.
- Next: Phase 4 (Refinement) — Truth Verification thresholds and end-to-end test validation.

## Principles
1. Hexagonal architecture for API independence.
2. Wave Execution via Directed Acyclic Graphs (DAG) mapping.
3. Strict Model Context Protocol (MCP) integrations.
