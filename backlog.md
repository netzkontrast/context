# Backlog / REQUIREMENTS.md

*This file maps scoped feature definitions and test coverage mandates specifically to the build phases.*

## Unscheduled Requirements
- Research and finalize optimal schema validation libraries (e.g., Zod for TypeScript).
- Establish comprehensive property-based testing for all Zod output schemas.

## Completed (Phase 1)
- ~~Architect the SQLite-backed FTS5 database to support the Deep-Reading Agent Skill (SQ3R).~~ → `lib/context-engine.js`
- ~~Design the OS-level deterministic hooks (PreToolUse, PostToolUse, End-of-turn) for the Nyquist Validation Layer.~~ → `lib/hooks.js`
- ~~Establish the central CLI routing layer capable of handling `--auto` and `--dangerously-skip-permissions` modifier flags.~~ → `bin/install.js` (done in Phase 0)
- ~~Develop the core Model Context Protocol (MCP) universal integration bus for the orchestrator.~~ → `lib/mcp-registry.js` (done in Phase 0)

## Backlogged Tasks
*Tasks will be moved from here to the DAG in `planning.md` when execution waves commence.*
