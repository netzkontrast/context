# AGENTS.md: Core Operating Directives

This document explicitly defines **HOW** the Claude Suite operates autonomously, outlining the absolute rules for agentic reasoning, multi-agent orchestration, architectural standards, and security boundaries.

## 1. Zero-Trust Security Posture
Autonomous coding systems possess destructive capabilities. The suite is engineered structurally to treat all execution environments as zero-trust.
*   **A Dedicated Security Agent is Mandated.** To properly isolate domain logic, a specific agent persona with high skills in AST parsing (similar to tools like `parry` and `dippy`) must evaluate generated code before execution.
*   **Strict Blocking Rules:** Agents are strictly prohibited from natively executing destructive shell commands (e.g., `rm -rf`, `DROP TABLE`, remote POST requests) without explicit, human-in-the-loop manual confirmation triggers.
*   **Sandboxing:** Execution must occur within constrained, sandboxed subprocess boundaries where only STDOUT is retrieved to prevent external context poisoning.

## 2. Harmonized Project Memory
The suite utilizes file-based memory rather than conversational history to establish deterministic intent. The AI must manage these files directly to construct its execution graphs:
*   `planning.md`: Serves as the ephemeral **STATE.md**. It tracks current decisions, workflow blockers, and the specific DAG/XML task nodes required for the active Wave Execution phase.
*   `roadmap.md`: Represents the overarching **PROJECT.md** architecture. It is an immutable vision statement detailing overarching methodology and stack choices.
*   `backlog.md`: Represents **REQUIREMENTS.md**. It maps scoped feature definitions and test coverage mandates specifically to the build phases.

## 3. The "One Task, One Chat" Doctrine
To prevent "context rot" (up to 40% performance degradation per session):
*   Agents must **NEVER** attempt multi-file refactors or disparate tasks within a continuous logical loop.
*   Upon completing an isolated node within the DAG, the agent's context window must be aggressively mathematical reset (via a `/clear` directive) before assigning a new task.

## 4. Wave Execution and Directed Task Graphs (DAGs)
*   The Orchestrator agent constructs execution steps into a dependency-aware Directed Acyclic Graph (DAG) saved in `planning.md`.
*   Independent tasks are processed via massively parallel execution threads.
*   Dependent tasks remain locked in sequential queues until prerequisites report successful Exit Codes.

## 5. Hexagonal Architecture and MCP
*   The core reasoning loop (the domain) is mathematically isolated from external integration APIs.
*   Agents must **NEVER** utilize hardcoded curl or REST API endpoints within their prompt.
*   The **Model Context Protocol (MCP)** acts as the universal integration bus. Agents dynamically discover required execution scripts, schemas, and API definitions via YAML metadata during execution, effectively loading logic only when explicitly required.

## 6. Event-Driven Architecture (EDA)
*   Asynchronous multi-agent swarms rely entirely on event broadcasting. An agent assigned to security checks publishes an analyzed payload to the main thread. A separate Refactoring Agent assigned to the error listens to this payload, generating a surgical patch without maintaining point-to-point connections with the initial scanner.

## 7. Atomic Commits
*   The ultimate measure of task completion is version control. Every successful execution cycle within the DAG must result in an immediate, isolated git commit.
*   This pattern provides the AI suite with a high-fidelity "undo button," heavily relying on standard `git` operations for rapid bug reversion.

## 8. Mitigating Multi-Turn Degradation
To resolve "Lost in Conversation" patterns (Premature Answer Attempts, Verbosity Inflation, U-shaped recall), agents must strictly evaluate their own active reasoning path. All agents must enforce a `/clear` directive and perform a complete mathematical reset of their context window after every resolved execution graph node, entirely dropping legacy history to preserve token efficiency.

## 9. The SQ3R Execution Pipeline (Deep-Reading Agents)
When researching massive technical documentation or codebase architectures, agents must **NEVER** utilize standard bash commands like `cat`, `curl`, or `wget` to raw-read text into their context. Agents must adhere to the **SQ3R (Survey, Question, Read, Recite, Review)** cognitive pipeline:
*   **Survey:** Extract structural boundaries (Tables of Contents) into SQLite FTS5 databases without reading body text.
*   **Question:** Formulate 3-5 specific query strings using Porter stemming within the internal reasoning block.
*   **Read:** Execute BM25 ranked searches to extract "smart snippets" limited to a maximum depth of 3 iterations.
*   **Recite:** Synthesize retrieved findings into intermediate summaries answering the Phase 2 formulated questions.
*   **Review:** Execute a context reset `/clear` upon finalizing the specification to purge intermediate search history.
