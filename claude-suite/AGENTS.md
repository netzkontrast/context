# Claude Suite Autonomous Agent Directives

## Core Directives
1. **Never Stray from Architecture:** The architecture is a modular, event-driven orchestration system built primarily in Node.js (via `npx` execution pattern inspired by `gsd`), decoupling LLM non-determinism via strict Markdown contracts (`STATE.md`, `ROADMAP.md`).
2. **Atomic Context Files:** Agents MUST strictly read exactly what they need for an atomic task and write directly to a state file.
3. **No mega-prompts:** Adhere strictly to the Strangler Fig pattern. Isolate features into singular workflows.

## Mandatory Maintenance
Agents working on this repository **MUST** keep the following documentation files strictly up to date at all times:
- `planning.md` - Tracks the overall project intent and current focus.
- `roadmap.md` - Tracks the chronological phases and completion state.
- `backlog.md` - Tracks features or alternative implementations (like Python/Typer architecture ideas) excluded from the immediate sprint.
- `sources.md` - Tracks all external repositories, ecosystems, and scanning tools relevant to the suite's architecture and security. If integrating new tools or performing analysis, agents MUST consult and update [sources.md](./sources.md).

## Git Protocol
- Every successful atomic feature completion MUST result in an isolated commit describing the specific logic added.
