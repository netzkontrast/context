# Claude Suite Planning

## Mission
Develop a minimal, yet highly interconnected "Claude Suite" inspired by `gsd`. The suite prioritizes a deterministic context engineering approach, separating the LLM reasoning loop from tool execution and state management via an `npx` installable command line interface.

## Current Focus (Phase 1 → Phase 2 transition)
- Phase 1 (Core CLI & Initial Structure) is complete.
- `plan-phase` now parses ROADMAP.md and generates a DAG with wave execution assignments.
- Next: Implement the Agent Orchestrator class (Phase 2) to consume the DAG and spawn parallel agents.
- Next: Wire `execute-phase` to the orchestrator for real task execution.

## Principles
1. Hexagonal architecture for API independence.
2. Wave Execution via Directed Acyclic Graphs (DAG) mapping.
3. Strict Model Context Protocol (MCP) integrations.
