# Claude Suite Planning

## Mission
Develop a minimal, yet highly interconnected "Claude Suite" inspired by `gsd`. The suite prioritizes a deterministic context engineering approach, separating the LLM reasoning loop from tool execution and state management via an `npx` installable command line interface.

## Current Focus (Phase 1)
- Build the core routing and installer skeleton in Node.js, modeled on `get-shit-done` repository.
- Support `npx` global and local install capabilities.
- Define the foundational templates for state management (`PROJECT.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `STATE.md`).

## Principles
1. Hexagonal architecture for API independence.
2. Wave Execution via Directed Acyclic Graphs (DAG) mapping.
3. Strict Model Context Protocol (MCP) integrations.
