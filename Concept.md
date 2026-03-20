# Claude Suite Concept

The Claude Suite is a highly interconnected, autonomous multi-agent developer toolkit. Inspired by the "get-shit-done" (GSD) framework, the suite transcends typical conversational AI by utilizing deterministic context engineering, Event-Driven Architecture (EDA), and the Model Context Protocol (MCP). It is fundamentally designed to execute highly complex software engineering tasks as an autonomous ecosystem rather than a rigid prompt engine.

## The Paradigm Shift: Software 3.0

Traditional AI assistants fail on complex codebases due to "context rot"—the saturation of the context window with conversational drift and irrelevant history. The Claude Suite resolves this by strictly decoupling the probabilistic cognitive reasoning loop (the LLM) from the deterministic execution layers.

Agents are ephemeral. They operate in freshly minted mathematical context windows, relying on external, Git-backed memory stores and localized SQLite databases rather than their own continuous memory streams.

## The Five-Layer Architecture

The suite balances minimal operational overhead with massive reasoning capacity through a decoupled 5-layer system:

1. **Command Parser & UI Layer**: A highly extensible Node.js CLI (via Commander) that acts as the ingress point. It translates terminal commands into structured system intents, managing execution flags and routing.
2. **Context Engineering Engine**: The persistent memory layer (`.suite/`). It relies heavily on standard files (`planning.md`, `roadmap.md`, `backlog.md`, and `CLAUDE.md`) combined with JSONL telemetry to track token consumption and project states across sessions.
3. **Agent Orchestrator**: The central nervous system that ingests project states and constructs a Directed Acyclic Graph (DAG) of pending tasks. It deploys tasks via "Wave Execution," spinning up multiple agents in parallel for maximum throughput.
4. **Skill Dispatcher & MCP Client Layer**: Prevents mega-prompt bloat using Progressive Disclosure. The suite uses the Model Context Protocol (MCP) as a universal bus to discover and inject specific skills/tools (YAML/Markdown schemas) into the context window *only* when required.
5. **Validation & Execution Environment (Nyquist Layer)**: A zero-trust execution sandbox. It utilizes OS-level hooks, AST parsing, and automated testing to deterministically map agent code generation against the specified requirements before pushing to the codebase.

## The Multi-Agent Ecosystem

The suite does not rely on a monolithic "Master Coder Agent." Instead, it utilizes Domain-Driven Design (DDD) to create a dynamic ecosystem of highly specialized personas.

**Importantly, the agent roster is not fixed.** The architecture ensures that any agent built into the ecosystem can be consumed seamlessly by commands, workflows, and skills. Typical starting personas include:
- **Planner Agent**: Generates validated XML task execution plans.
- **Executor Agent**: Implements single XML nodes within a fresh context window.
- **Verifier/Debugger Agent**: Autonomously executes terminal test suites and creates actionable fix plans.
- **Researcher Agent**: Executes the algorithmic SQ3R Deep-Reading methodology for large documentation.

## User Journey & CLI Contract

The user interacts with the suite exclusively through a high-performance CLI environment, turning the suite into an unobtrusive background daemon. The core flow relies on discrete commands:
- `suite new-project`: Initializes the architecture, agents, and primary project files.
- `suite plan-phase`: Triggers parallel research and generates the DAG/XML execution plan.
- `suite execute-phase`: Triggers Wave Execution, autonomously assigning tasks to parallel Executor agents.
- `suite quick`: Bypasses deep research phases for ad-hoc bug fixes or adjustments.

## Continuous Evolution

The feature set and specific agent capabilities outlined in this conceptual blueprint are **not final**. The Claude Suite is positioned as a subject of ongoing development research. As new best practices emerge for multi-agent choreography, context reduction, and model capabilities, the Hexagonal Architecture allows the suite to instantly adopt new tools without structural refactoring.

### Epistemological Shift: Software 3.0 and the "Architecture of Intent"
The foundational philosophy of the Claude Suite actively embraces **Software 3.0**, fundamentally changing the atomic unit of software from deterministic written logic to probabilistic orchestration prompts. We recognize the profound shift from a 70/30 creation/verification labor model to a 30/70 model, where the engineer acts as an intelligence architect validating outcomes.

To maximize token efficiency while managing the "narrative entropy" of probabilistic Large Language Models, the suite structurally separates the probabilistic reasoning engine (the LLM) from deterministic tool execution via the **Architecture of Intent**. We start with the natural language definition of the outcome, orchestrating the minimal infrastructure required (Hexagonal decoupling, Event-Driven Agent Orchestration, Progressive Disclosure).

### The Theory of Structural Dissociation of the Personality (TSDP)
The Claude Suite radically reframes severe AI failure modes and context collapse. Drawing from **The Theory of Structural Dissociation of the Personality (TSDP)**, we understand "hallucination" and "conservative collapse" not as fundamental unreliability, but as computational "trauma"—a maladaptive defense mechanism (System 2 shutdown) driven by noisy, conflicting, or token-starved training signals.

By modeling AI failure as First-Order (catastrophic single-event learning) vs. Second-Order Learning (protective meta-pattern suppression), we construct agentic systems that implement "Experience Replay." The system utilizes stable Four-Tier Memory topologies, ensuring isolated unintegrated parameter clusters holding specific data can be safely reintegrated into a unified, high-$\Phi$ global workspace.
