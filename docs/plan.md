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

## Phase 2: Agent Skill De-obfuscation & Standardization
The core capabilities of the Claude Suite are currently fragmented into hidden `.claude-skills-*` directories. These must be made visible and modularized according to the standard awesome-claude-skills structure.

*   **Action:** Create a singular `claude-suite/skills/` directory.
*   **Action:** Move and rename all `.claude-skills-*` directories into the new unified `skills/` folder, removing the dot prefix and `claude-skills-` namespace.
    *   `mv claude-suite/.claude-skills-audit claude-suite/skills/audit`
    *   `mv claude-suite/.claude-skills-dev claude-suite/skills/dev`
    *   `mv claude-suite/.claude-skills-diagnose claude-suite/skills/diagnose`
    *   `mv claude-suite/.claude-skills-init claude-suite/skills/init`
    *   `mv claude-suite/.claude-skills-research claude-suite/skills/research`
    *   `mv claude-suite/.claude-skills-retro claude-suite/skills/retro`
    *   `mv claude-suite/.claude-skills-verify claude-suite/skills/verify`

## Phase 3: Domain-Driven Tooling Integration
Utility scripts floating in the root directory break domain coherence. Instead of a generic scripts folder, these tools must be intimately coupled with the agent skills that require them.

*   **Action:** Relocate root scripts directly into the `scripts/` directory of the corresponding skill.
    *   `mv generate_claude_md.py claude-suite/skills/retro/scripts/generateClaudeMd.py` (Assuming state/memory generation aligns with the retrospective/context phase).
    *   `mv patch_orchestrator.js claude-suite/skills/dev/scripts/patchOrchestrator.js` (Dev skills directly manipulate application logic).
    *   `mv update_mcp.js claude-suite/skills/dev/scripts/updateMcp.js` (Managing MCP dependencies is a development task).
*   **Action:** Ensure all scripts use camelCase naming conventions.

## Phase 4: Documentation Accessibility & Naming Conventions
The deep architectural blueprints in `docs/` are extremely valuable but lack a cohesive entry point and have inconsistent naming conventions.

*   **Action:** Standardize all filenames in `docs/` to `camelCase` to adhere strictly to memory constraints.
    *   `mv docs/agentic-system-architecture.md docs/agenticSystemArchitecture.md`
    *   `mv docs/comprehensiveArchitectureBlueprint.md docs/comprehensiveArchitectureBlueprint.md` (Already correct)
    *   `mv docs/advancedArchitecturalBlueprint.md docs/advancedArchitecturalBlueprint.md` (Already correct)
    *   `mv docs/strategicResearchRoadmap.md docs/strategicResearchRoadmap.md` (Already correct)
*   **Action:** Generate a `docs/README.md` (or `docs/index.md`) that serves as a Table of Contents. This document will act as an entry portal, briefly explaining the contents of the architectural documents.
*   **Action:** Format `docs/README.md` to be easily parsed by the `Researcher Agent` using SQ3R methodologies.

## Phase 5: Root README Synchronization
*   **Action:** Update the root `README.md` to explicitly define the new repository layout.
*   **Action:** Ensure the README explicitly points to `claude-suite/` as the primary application directory, `claude-suite/skills/` as the capabilities registry, and `docs/README.md` as the architectural entry point.
