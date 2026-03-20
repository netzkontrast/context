# Claude Suite Architectural Documentation

This directory contains the foundational research, blueprints, and implementation strategies for the Claude Suite. It is structured to support the SQ3R (Survey, Question, Read, Recite, Review) deep-reading methodology for AI agent ingestion.

## Core Architectural Blueprints

1. **[Strategic Research Roadmap](./strategicResearchRoadmap.md)**
   *   *Focus:* The epistemological shift to Software 3.0, the core "Architecture of Intent," and the necessity of structural decoupling (Hexagonal Architecture) in AI systems.
   *   *Read First:* Yes. This establishes the philosophical and theoretical baseline for all engineering decisions.

2. **[Agentic System Architecture](./agenticSystemArchitecture.md)**
   *   *Focus:* Deep dive into "Context Rot" mitigation. It outlines the Theory of Structural Dissociation of Personality (TSDP) in Large Language Models and how parallel execution environments solve context bloat.

3. **[Comprehensive Architecture Blueprint](./comprehensiveArchitectureBlueprint.md)**
   *   *Focus:* Detailed breakdown of the suite's Five-Layer decoupled system (CLI Layer, Context Engine, Orchestrator, MCP Registry, Nyquist Validation). It explains how state files (`planning.md`, `CLAUDE.md`) manage deterministic memory.

4. **[Advanced Architectural Blueprint](./advancedArchitecturalBlueprint.md)**
   *   *Focus:* A critical analysis of the open-source ecosystem (`awesome-claude-code`, `get-shit-done`). It dictates the strict methodologies for Wave Execution (DAGs), single-responsibility skills, and the Strangler Fig refactoring pattern.

## Project Planning & Restructuring

*   **[Gedanken (Refactoring Thoughts)](./gedanken.md):** The underlying analysis and reasoning for the directory restructuring, emphasizing the de-obfuscation of agent skills.
*   **[Execution Plan](./plan.md):** The step-by-step actionable phases used to reorganize the repository from its initial monolithic state to a modular, domain-driven structure.
