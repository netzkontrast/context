# Claude Suite Sources & Scanning Targets

This document tracks all external repositories, ecosystems, and scanning utilities that serve as the foundational architecture or security boundaries for the Claude Suite. When integrating new capabilities or analyzing execution safety, refer to these primary sources.

## 🛡️ Relevant for Security & Code Scanning (The Nyquist Layer)
These tools are specifically designed to scan inputs, outputs, and Abstract Syntax Trees (AST) to ensure the AI operates safely within its sandbox.

1. **`parry`**: A dedicated prompt injection scanner. Used as a security boundary (often in git hooks or pre-execution) to scan and block malicious prompt injections before they can contaminate the agent's context.
2. **`Dippy`**: A validation and execution sandbox tool. It utilizes AST-based parsing to scan generated shell scripts and code blocks. It auto-approves explicitly safe, read-only commands while aggressively blocking destructive operations (like `rm -rf` or unauthorized network requests).

## 🏗️ Relevant for Architectural Scanning & Reference
These are the core repositories that must be analyzed to extract orchestration patterns, DAG routing, and context management logic.

3. **`gsd-build/get-shit-done`**: The foundational blueprint. Relevant for scanning its Wave Execution logic, XML-structured atomic task planning, and `npx` CLI routing.
4. **`EliaAlberti/superbeads-universal-framework`**: Relevant for scanning its formalized four-agent topology (Strategist, Executor, Specialist, Critic) and its mathematical mechanics for auto-archiving context memory to prevent token bloat.
5. **`ruvnet/ruflo`**: Relevant for scanning its implementation of advanced distributed swarm intelligence, Q-Learning routing logic, and Byzantine Fault Tolerance consensus algorithms.
6. **`shajith003/awesome-claude-skills`**: Relevant for scanning its highly organized directory structure for discrete skills and progressive skill disclosure templates.
7. **`pydantic-ai-skills`**: Relevant for scanning structured I/O and dynamic schema validation to prevent LLM formatting hallucinations.
8. **`hesreallyhim/awesome-claude-code`**: The overarching ecosystem repository. Relevant for scanning various fragmented standalone execution tools to consolidate them into our unified suite.
