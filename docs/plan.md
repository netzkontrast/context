# Claude Suite Restructuring & Refactoring Plan

> **Status: ALL PHASES COMPLETE** — This plan has been fully executed. Retained as a historical record.

Based on the architectural analysis in [gedanken.md](./gedanken.md) and the principles of "Software 3.0" execution, the repository was restructured to eliminate context rot, ensure deterministic state management, and make documentation accessible to both humans and AI agents.

## Phase 1: Context Consolidation & De-duplication ✅

Duplicate state files were removed from the root directory to eliminate the split-brain scenario for agent memory.

- [x] Delete `./AGENTS.md` (canonical version kept in `claude-suite/`)
- [x] Delete `./planning.md` (canonical version kept in `claude-suite/`)
- [x] Delete `./roadmap.md` (canonical version kept in `claude-suite/`)
- [x] Delete `./backlog.md` (canonical version kept in `claude-suite/`)
- [x] Move `CLAUDE.md` into `claude-suite/` to encapsulate all execution state

## Phase 2: Agent Skill De-obfuscation & Standardization ✅

Hidden `.claude-skills-*` directories were made visible and modularized under a unified `skills/` directory.

- [x] Create `claude-suite/skills/` directory
- [x] Move `.claude-skills-audit` → `skills/audit`
- [x] Move `.claude-skills-dev` → `skills/dev`
- [x] Move `.claude-skills-diagnose` → `skills/diagnose`
- [x] Move `.claude-skills-init` → `skills/init`
- [x] Move `.claude-skills-research` → `skills/research`
- [x] Move `.claude-skills-retro` → `skills/retro`
- [x] Move `.claude-skills-verify` → `skills/verify`

## Phase 3: Domain-Driven Tooling Integration ✅

Root scripts were relocated into the `scripts/` directory of their corresponding skill domain.

- [x] Move `generate_claude_md.py` → `skills/retro/scripts/generateClaudeMd.py`
- [x] Move `patch_orchestrator.js` → `skills/dev/scripts/patchOrchestrator.js`
- [x] Move `update_mcp.js` → `skills/dev/scripts/updateMcp.js`
- [x] Standardize all scripts to camelCase naming

## Phase 4: Documentation Accessibility & Naming Conventions ✅

Documentation filenames were standardized and an index was created.

- [x] Rename `docs/agentic-system-architecture.md` → `docs/agenticSystemArchitecture.md`
- [x] Create `docs/README.md` as Table of Contents with reading order and scope
- [x] Format `docs/README.md` for SQ3R consumption

## Phase 5: Root README Synchronization ✅

- [x] Update root `README.md` to reflect the new repository layout
- [x] Point to `claude-suite/` as the primary application directory
- [x] Point to `claude-suite/skills/` as the capabilities registry
- [x] Point to `docs/README.md` as the architectural entry point
