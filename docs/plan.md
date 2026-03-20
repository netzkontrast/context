# Claude Suite Restructuring & Refactoring Plan

Based on the architectural analysis and the principles of "Software 3.0" execution, the repository structure must be streamlined to eliminate context rot, ensure deterministic state management, and make the documentation accessible to both humans and AI agents.

## Phase 1: Context Consolidation & De-duplication
The project currently suffers from duplicated state files across the root directory and the `claude-suite/` application directory. This creates a split-brain scenario for agent memory.

*   **Action:** Delete the duplicate operational files located in the root directory.
    *   `rm ./AGENTS.md`
    *   `rm ./planning.md`
    *   `rm ./roadmap.md`
    *   `rm ./backlog.md`
*   **Action:** Ensure the canonical versions of these files remain exclusively inside `claude-suite/` or are mapped strictly according to the `.suite/` local memory paradigm discussed in the blueprints.
*   **Action:** Move `CLAUDE.md` from the root into `claude-suite/` so all execution state variables are encapsulated within the active project directory.

## Phase 2: Tooling & Script Standardization
Utility scripts are floating in the root directory, cluttering the top-level namespace.

*   **Action:** Create a `scripts/` directory at the project root.
*   **Action:** Move and optionally rename utility scripts to follow the camelCase convention as prescribed in memory guidelines.
    *   `mv generate_claude_md.py scripts/generateClaudeMd.py`
    *   `mv patch_orchestrator.js scripts/patchOrchestrator.js`
    *   `mv update_mcp.js scripts/updateMcp.js`

## Phase 3: Documentation Accessibility & Naming Conventions
The deep architectural blueprints in `docs/` are extremely valuable but lack a cohesive entry point and have inconsistent naming conventions.

*   **Action:** Standardize all filenames in `docs/` to `camelCase` to adhere strictly to memory constraints.
    *   `mv docs/agentic-system-architecture.md docs/agenticSystemArchitecture.md`
*   **Action:** Generate a `docs/README.md` (or `docs/index.md`) that serves as a Table of Contents. This document will act as an entry portal, briefly explaining the contents of `advancedArchitecturalBlueprint.md`, `agenticSystemArchitecture.md`, `comprehensiveArchitectureBlueprint.md`, and `strategicResearchRoadmap.md`.
*   **Action:** Format `docs/README.md` to be easily parsed by the `Researcher Agent` using SQ3R methodologies.

## Phase 4: Root README Synchronization
*   **Action:** Update the root `README.md` to explicitly define the new repository layout.
*   **Action:** Ensure the README explicitly points to `claude-suite/` as the primary application directory and `docs/README.md` as the architectural entry point.
