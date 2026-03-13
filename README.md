# The Claude Suite

**An Advanced Architectural Blueprint for a Modular, Command-Driven AI Engineering Toolkit.**

## Executive Summary
The Claude Suite is not a conversational chat interface. It is a strictly functional, "get-shit-done" orchestrator designed to systematically mitigate AI context rot, token bloat, and hallucination during complex enterprise software development.

By leveraging a decoupled **Hexagonal Architecture**, **Wave Execution algorithms**, and the **Model Context Protocol (MCP)**, the suite transforms Large Language Models (LLMs) into highly cohesive, multi-agent development swarms capable of ingesting requirements, architecting solutions, and executing verifiable code with surgical precision.

This repository serves as the definitive reference blueprint for the suite's structural design, operating principles, and development best practices.

## System Overview
The architecture is fundamentally built upon the "One Task, One Chat" doctrine and is split across 5 crucial layers:
1. **Command Parser Layer:** A Node.js CLI translating human intent into structured workflows.
2. **Context Engine Layer:** Persistent memory relying entirely on deterministic Markdown files and SQLite stores.
3. **Agent Orchestrator:** The brain that constructs Directed Acyclic Graphs (DAGs) to execute parallel task waves.
4. **Integration Layer:** Progressive disclosure mechanisms utilizing MCP servers for zero-bloat tool discovery.
5. **Execution Environment:** A strict zero-trust AST parsing and test-driven validation sandbox.

> **Note:** The exact agent roster and feature set are subject to continuous developmental research. The suite is engineered to consume any highly specialized agent natively.

## User Journey
The human orchestrates the AI entirely via standard terminal commands:

- `/suite:new-project`: Interactively establishes the architectural boundaries and initializes persistent memory files (`roadmap.md`, `backlog.md`).
- `/suite:plan-phase`: Deploys domain researchers to construct the deeply structured XML Execution Graph.
- `/suite:execute-phase`: Initiates the parallel Wave Execution engine, spawning Executors to implement code autonomously.
- `/suite:quick`: Bypasses the exhaustive planning phase for surgical, ad-hoc bug squashing.

## Reference Documentation
For a deep dive into the engineering logic behind this system, please explore the reference materials:
- `Concept.md`: The high-level theoretical design and architectural layers.
- `AGENTS.md`: The strict operational rules dictating agent behavior, security sandboxing, and project state.
- `docs/advancedArchitecturalBlueprint.md`: Foundational research regarding repository ecosystems and context engineering.
- `docs/comprehensiveArchitectureBlueprint.md`: Deep technical implementation strategies regarding Event-Driven Architecture (EDA), Code Digital Twins, and the SQ3R Deep-Reading skill.

---

*This blueprint draws significant foundational inspiration from methodologies extracted from `gsd-build/get-shit-done`, `EliaAlberti/superbeads-universal-framework`, and the broader `awesome-claude-code` ecosystem.*
