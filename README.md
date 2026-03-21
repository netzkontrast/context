# Claude Suite

**Enterprise-grade orchestration for autonomous AI development workflows.**

[![Node.js](https://img.shields.io/badge/Node.js-16%2B-green)]()
[![Tests](https://img.shields.io/badge/tests-163%20passing-brightgreen)]()
[![Dependencies](https://img.shields.io/badge/deps-2%20(commander%2C%20better--sqlite3)-blue)]()
[![Version](https://img.shields.io/badge/version-0.1.0-orange)]()
[![License](https://img.shields.io/badge/license-MIT-lightgrey)]()

---

Claude Suite is a deterministic, multi-agent development orchestrator that transforms LLMs into parallel execution swarms. It eliminates context rot, token bloat, and hallucination by spawning ephemeral agents in sterile subprocess contexts — each with fresh memory, sandboxed filesystem access, and statistically verified outputs.

This is not a chat interface. It is a "get-shit-done" toolkit that follows the **One Task, One Chat** doctrine.

## Architecture

```
                          +--------------------------+
                          |   Command Parser (CLI)   |   Layer 1: Commander.js
                          |   install.js             |   routing & flags
                          +------------+-------------+
                                       |
                          +------------v-------------+
                          |  Context Engine           |   Layer 2: .suite/ directory
                          |  PROJECT.md | ROADMAP.md  |   Markdown + SQLite (planned)
                          |  STATE.md | REQUIREMENTS  |   Git-backed persistence
                          +------------+-------------+
                                       |
                          +------------v-------------+
                          |  Agent Orchestrator       |   Layer 3: DAG construction
                          |  Wave Execution Engine    |   Parallel task waves
                          |  Sterile Context Spawning |   Subprocess isolation
                          +------------+-------------+
                                       |
                    +------------------+------------------+
                    |                                     |
          +---------v----------+              +-----------v--------+
          |  MCP Registry      |              |  Nyquist Layer     |  Layer 5:
          |  Tool discovery    |  Layer 4:    |  AST verification  |  Zero-trust
          |  Progressive       |  Integration |  Command classify  |  execution
          |  disclosure        |              |  Truth verification|  sandbox
          +--------------------+              +--------------------+
```

**5-Layer Hexagonal Architecture:**

| Layer | Component | Responsibility |
|-------|-----------|---------------|
| 1 | **Command Parser** | CLI routing via Commander.js. Translates terminal commands into structured intents. |
| 2 | **Context Engine** | Persistent memory via `.suite/` directory. Markdown files + Git as undo mechanism. |
| 3 | **Agent Orchestrator** | Builds DAGs from ROADMAP.md, executes parallel task waves with configurable concurrency. |
| 4 | **MCP Registry** | Model Context Protocol tool bus. 6 filesystem tools with sandbox path validation. |
| 5 | **Nyquist Layer** | Zero-trust command classification (safe/guarded/blocked), AST parsing, truth verification. |

## Quick Start

```bash
# Install globally
npx claude-suite install --global

# Initialize a new project
claude-suite new-project

# Plan a phase (generates DAG from ROADMAP.md)
claude-suite plan-phase 0 --dag

# Execute a phase (spawns parallel agents)
claude-suite execute-phase 0 --concurrency 4

# Verify a shell command's safety classification
claude-suite verify "rm -rf /tmp/build"

# List available MCP tools
claude-suite mcp-tools
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `install [--global\|--local]` | Install Claude Suite |
| `new-project [--auto]` | Scaffold `.suite/` with PROJECT.md, ROADMAP.md, REQUIREMENTS.md, STATE.md |
| `plan-phase <n> [--dag] [--research]` | Parse ROADMAP.md into a DAG execution plan |
| `execute-phase <n> [--concurrency N]` | Run Wave Execution with N parallel agents (default: 4) |
| `verify <command...>` | Classify a shell command as safe/guarded/blocked |
| `mcp-tools` | List all registered MCP tool capabilities |

## Core Modules

### Agent Orchestrator (`lib/orchestrator.js`)
Manages wave-based parallel execution. Builds wave plans from DAG phases, spawns agents in isolated subprocesses with 5-minute timeouts, and validates all JSON outputs via TruthVerifier before accepting state changes.

```javascript
const orchestrator = new AgentOrchestrator({
  concurrency: 4,
  suitePath: '.suite',
  basePath: process.cwd()
});
const wavePlan = orchestrator.planWaves(dag, phaseIndex);
const result = await orchestrator.execute(wavePlan);
```

**Events:** `phase:start`, `phase:end`, `wave:start`, `wave:complete`, `wave:blocked`, `agent:start`, `agent:end`, `agent:output`, `agent:verify`

### Nyquist Layer (`lib/nyquist.js`)
Three-tier command classification inspired by the Nyquist sampling theorem — inspect at 2x the frequency of potential harm.

- **SAFE** (33 commands): `ls`, `cat`, `grep`, `git status`, `node`, `npm`, etc. Auto-approved.
- **GUARDED**: `rm`, `mv`, `git commit`, `npm install`, `>` redirects. Require permission.
- **BLOCKED** (15 patterns): `rm -rf`, `sudo`, `chmod 777`, `curl|bash`, `eval`, `mkfs`, `dd`, `shutdown`. Always rejected.

### MCP Registry (`lib/mcp-registry.js`)
Model Context Protocol tool registry with sandbox isolation. All file paths validated against project root — no `../` escapes.

**Registered tools:** `read_file`, `write_file`, `list_directory`, `file_exists`, `delete_file`, `append_file`

### Truth Verifier (`lib/truth-verifier.js`)
JSON schema validation with statistical confidence scoring. Formula: `confidence = passed_checks / total_checks`.

| Schema | Threshold | Use |
|--------|-----------|-----|
| `agent-report` | 0.85 (85%) | Validate agent subprocess output |
| `wave-result` | 1.0 (100%) | Validate wave execution results (strict) |

### Roadmap Parser (`lib/roadmap-parser.js`)
Parses `ROADMAP.md` Markdown into structured phases and constructs a DAG with sequential phase dependencies and parallel intra-phase tasks.

## Project Memory Structure

When you run `claude-suite new-project`, it scaffolds:

```
.suite/
  PROJECT.md        # Immutable vision and constraints (never changes)
  ROADMAP.md        # Sequential phases with parallel task checklists
  REQUIREMENTS.md   # Feature specs with traceability matrix (REQ-01, REQ-02, ...)
  STATE.md          # Ephemeral execution state (current phase, blockers, active tasks)
```

**Design principle:** Agents are ephemeral. They receive sterile context (task description + PROJECT.md + REQUIREMENTS.md) in a fresh subprocess. No shared memory. No conversational history. External Git-backed files are the single source of truth.

## Security Model

Claude Suite implements a **zero-trust security posture**:

1. **Command Classification** — Every shell command is AST-parsed and classified before execution
2. **Sandbox Isolation** — MCP file operations cannot escape the project root directory
3. **Subprocess Isolation** — Each agent runs in a fresh child process with no shared memory
4. **Output Verification** — All agent JSON outputs validated against registered schemas with confidence thresholds
5. **Permission Gating** — Write operations require explicit `--dangerously-skip-permissions` flag

## Testing

```bash
cd claude-suite && npm test
```

163 tests across 16 test suites using Node.js built-in `node:test` runner. Zero test dependencies.

| Suite | Tests | Coverage |
|-------|-------|----------|
| `orchestrator.test.js` | 41 | Constructor, planWaves, execute, wave execution, state writing, verification |
| `truth-verifier.test.js` | 37 | Schema validation, confidence scoring, thresholds |
| `personas.test.js` | 35 | Registry, keyword routing, schema validation |
| `skill-loader.test.js` | 28 | YAML parsing, discovery, loading, SkillLoader class |
| `nyquist.test.js` | 27 | Command classification, tokenization, batch verify |
| `roadmap-parser.test.js` | 25 | Phase parsing, DAG generation, path resolution |
| `mcp-registry.test.js` | 18 | Tool registration, invocation, sandbox escapes |
| `agent-runner.test.js` | 10 | Env validation, output structure, MCP tools, permissions |
| + 8 more suites | — | coherence-monitor, context-store, knowledge-graph, ldar, sq3r, telemetry |

## Dependencies

**Production:** 2 dependencies — `commander@^11.0.0` (CLI routing), `better-sqlite3@^12.8.0` (persistent storage)

**Runtime:** Node.js built-ins only (`fs`, `path`, `events`, `child_process`, `os`)

**Testing:** Node.js built-in `node:test` and `node:assert/strict`

## Repository Structure

```
.
├── .github/                   # CI/CD workflows
├── .gitignore
├── README.md                  # Main entry point (this file)
├── Concept.md                 # High-level vision and paradigm shift
├── docs/                      # Architectural Research & Blueprints
│   ├── README.md              # Entry point for deep reading
│   ├── agenticSystemArchitecture.md
│   ├── advancedArchitecturalBlueprint.md
│   ├── comprehensiveArchitectureBlueprint.md
│   ├── strategicResearchRoadmap.md
│   ├── gedanken.md            # Structural refactoring analysis
│   └── plan.md                # Structural refactoring plan
└── claude-suite/              # The actual CLI application
    ├── package.json
    ├── skills/                # Unified Agentic Capabilities Registry
    │   ├── audit/             # Security & code scanning skills
    │   ├── dev/               # Code modification & logic skills
    │   ├── diagnose/          # Error resolution skills
    │   ├── init/              # Project scaffolding skills
    │   ├── research/          # Documentation & stack discovery skills
    │   ├── retro/             # Memory & state management skills
    │   └── verify/            # Testing & validation skills
    ├── bin/                   # CLI entry points
    ├── lib/                   # Core orchestrator and execution engines (14 modules)
    ├── templates/             # Markdown template scaffolding
    ├── workflows/             # Workflow definitions
    ├── test/                  # Test suites (16 files, 163+ tests)
    ├── CLAUDE.md              # Context planning & memory directives
    ├── AGENTS.md              # Autonomous agent operating rules
    ├── planning.md            # Current focus & phase tracking
    ├── roadmap.md             # Development roadmap (Phases 1–7 complete)
    ├── backlog.md             # Deferred work & future ideas
    └── sources.md             # External references & inspirations
```

## Inspirations

- [gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done) — Wave Execution blueprint
- [EliaAlberti/superbeads-universal-framework](https://github.com/EliaAlberti/superbeads-universal-framework) — Four-agent topology, context auto-archiving
- [ruvnet/ruflo](https://github.com/ruvnet/ruflo) — Swarm intelligence, Q-Learning routing
- [pydantic-ai](https://github.com/pydantic/pydantic-ai) — Progressive disclosure, structured I/O
- [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) — Ecosystem consolidation

---

*v0.1.0 — Phases 1–7 complete. ~3,850 lines of source, 163 tests, 2 dependencies.*

## High-Coherence Agentic Systems & Software 3.0 Architecture

Claude Suite integrates cutting-edge paradigms to handle open-ended, multi-agent workflows across massive contexts while mitigating "Context Rot."

- **Learning Distraction-Aware Retrieval (LDAR) & SQ3R**: Overcomes the "Context Quality Paradox" by filtering distracting "hard negative" chunks dynamically and enforcing strict algorithmic reading limits (Survey, Question, Read, Recite, Review) instead of naive RAG or long-context raw text dumping.
- **Dual-System Processing & TSDP Frameworks**: Implements System 1 (Intuitive heuristic search) and System 2 (Deliberate Chain-of-Thought) alongside preference optimization metrics to maintain systemic stability. AI failure patterns are mapped using the Theory of Structural Dissociation (TSDP) to execute self-healing "therapy loops".
- **Git-Backed Persistence via Dolt & Beads**: Context scaling limits and multi-agent concurrency are resolved by migrating state out of the LLM context and into distributed graph issue trackers via Beads, backed by Dolt for true Git semantics over JSON payloads.
