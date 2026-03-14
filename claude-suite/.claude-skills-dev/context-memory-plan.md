# Context Memory — Skill + Hooks Implementation Plan

## Executive Summary

A persistent, cross-session memory system for Claude Suite that automatically captures decisions, patterns, errors, and learned preferences during agent execution — and resurfaces them at precisely the right moment via hook-driven injection. Memory is stored in a SQLite FTS5 database, captured through deterministic hooks, and retrieved via BM25-ranked search through a `/memory` skill and automatic PreToolUse injection.

**Core Principle:** Memory lives *outside* the LLM context window. Hooks inject only the relevant sliver at the moment of need, achieving the same 98% context reduction philosophy already established in the architecture.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Claude Suite Session                     │
│                                                             │
│  ┌───────────┐    ┌──────────────┐    ┌──────────────────┐ │
│  │ /memory    │    │  Hooks Layer │    │  Agent           │ │
│  │  skill     │    │              │    │  Orchestrator    │ │
│  │ (manual)   │    │  (automatic) │    │  (events)        │ │
│  └─────┬─────┘    └──────┬───────┘    └────────┬─────────┘ │
│        │                 │                      │           │
│        ▼                 ▼                      ▼           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Memory Engine (lib/memory.js)              ││
│  │                                                         ││
│  │  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ ││
│  │  │ Capture │  │ Retrieve │  │ Decay    │  │ Index   │ ││
│  │  │ Module  │  │ Module   │  │ Manager  │  │ Builder │ ││
│  │  └────┬────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ ││
│  │       │            │              │              │      ││
│  │       ▼            ▼              ▼              ▼      ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │        SQLite FTS5 Database (.suite/memory.db)      │││
│  │  │                                                     │││
│  │  │  memories        memory_fts5       memory_meta      │││
│  │  │  (core store)    (search index)    (stats/decay)    │││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Integration Points

| Integration Point | Direction | Purpose |
|---|---|---|
| **SessionStart hook** | DB → Context | Load top-K relevant memories into session preamble |
| **PreToolUse hook** | DB → Context | Inject relevant memories before tool execution |
| **PostToolUse hook** | Context → DB | Extract learnings from tool outputs (errors, patterns) |
| **Stop hook (End-of-turn)** | Context → DB | Consolidate session learnings before handoff |
| **`/memory` skill** | Bidirectional | Manual CRUD, search, and memory management |
| **Orchestrator events** | Context → DB | Capture `agent:verify`, `wave:blocked`, `phase:end` outcomes |

---

## 2. Data Model

### 2.1 SQLite Schema

```sql
-- Core memory store
CREATE TABLE IF NOT EXISTS memories (
  id          TEXT PRIMARY KEY,          -- ULID (sortable, unique)
  type        TEXT NOT NULL,             -- 'fact' | 'decision' | 'pattern' | 'error' | 'preference' | 'context'
  scope       TEXT NOT NULL DEFAULT 'project',  -- 'global' | 'project' | 'session'
  content     TEXT NOT NULL,             -- The memory itself (concise, structured)
  source      TEXT,                      -- What triggered capture (hook name, skill, manual)
  tags        TEXT,                      -- JSON array of tags for filtering
  confidence  REAL NOT NULL DEFAULT 1.0, -- 0.0-1.0, decays over time
  access_count INTEGER DEFAULT 0,       -- Times retrieved (reinforcement signal)
  created_at  TEXT NOT NULL,             -- ISO 8601 timestamp
  updated_at  TEXT NOT NULL,             -- ISO 8601 timestamp
  expires_at  TEXT,                      -- Optional TTL for session-scoped memories
  session_id  TEXT,                      -- Session that created this memory
  superseded_by TEXT,                    -- ID of memory that replaced this one
  FOREIGN KEY (superseded_by) REFERENCES memories(id)
);

-- FTS5 virtual table for BM25-ranked full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts5 USING fts5(
  content,
  tags,
  type,
  content=memories,
  content_rowid=rowid,
  tokenize='porter unicode61'
);

-- Triggers to keep FTS5 in sync
CREATE TRIGGER IF NOT EXISTS memory_ai AFTER INSERT ON memories BEGIN
  INSERT INTO memory_fts5(rowid, content, tags, type)
  VALUES (new.rowid, new.content, new.tags, new.type);
END;

CREATE TRIGGER IF NOT EXISTS memory_ad AFTER DELETE ON memories BEGIN
  INSERT INTO memory_fts5(memory_fts5, rowid, content, tags, type)
  VALUES ('delete', old.rowid, old.content, old.tags, old.type);
END;

CREATE TRIGGER IF NOT EXISTS memory_au AFTER UPDATE ON memories BEGIN
  INSERT INTO memory_fts5(memory_fts5, rowid, content, tags, type)
  VALUES ('delete', old.rowid, old.content, old.tags, old.type);
  INSERT INTO memory_fts5(rowid, content, tags, type)
  VALUES (new.rowid, new.content, new.tags, new.type);
END;

-- Relationship mapping (memory → memory edges)
CREATE TABLE IF NOT EXISTS memory_links (
  from_id  TEXT NOT NULL,
  to_id    TEXT NOT NULL,
  relation TEXT NOT NULL,  -- 'supersedes' | 'supports' | 'contradicts' | 'refines'
  PRIMARY KEY (from_id, to_id),
  FOREIGN KEY (from_id) REFERENCES memories(id),
  FOREIGN KEY (to_id) REFERENCES memories(id)
);

-- Index for fast scope + type filtering
CREATE INDEX IF NOT EXISTS idx_memories_scope_type ON memories(scope, type);
CREATE INDEX IF NOT EXISTS idx_memories_confidence ON memories(confidence);
CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
```

### 2.2 Memory Types

| Type | Description | Capture Source | Example |
|---|---|---|---|
| **fact** | Established truths about the project | Manual, SessionStart | "This project uses pnpm workspaces with Turborepo" |
| **decision** | Architectural choices with rationale | Manual, agent:end | "Chose SQLite over Postgres for portability — no server needed" |
| **pattern** | Recurring code patterns/conventions | PostToolUse, agent:verify | "Test files follow `*.test.js` naming, use `node:test` runner" |
| **error** | Mistakes to avoid, failed approaches | PostToolUse (exit≠0), wave:blocked | "Running `npm test` without `--experimental-vm-modules` fails on ESM" |
| **preference** | User/project stylistic preferences | Manual, PostToolUse | "User prefers single quotes, no semicolons in JS" |
| **context** | Ephemeral session context summaries | Stop hook | "Session focused on implementing truth-verifier; 4 tests added" |

### 2.3 Confidence Decay Model

Memories decay logarithmically based on age and reinforcement:

```
confidence(t) = base_confidence × (1 - decay_rate × ln(1 + days_since_access))
```

- **base_confidence**: Set at creation (1.0 for manual, 0.8 for auto-captured)
- **decay_rate**: 0.05 for facts/decisions, 0.1 for patterns, 0.15 for errors, 0.2 for context
- **Reinforcement**: Each access resets `days_since_access` to 0 and boosts `base_confidence` by 0.05 (capped at 1.0)
- **Pruning threshold**: Memories below 0.2 confidence are candidates for garbage collection

---

## 3. Memory Engine (`lib/memory.js`)

### 3.1 Module Structure

```
claude-suite/lib/
├── memory.js              # Core MemoryEngine class
├── memory-capture.js      # Extraction logic (parse tool outputs → memories)
├── memory-retrieve.js     # BM25 search + relevance scoring
└── memory-hooks.js        # Hook scripts (stdin/stdout protocol)
```

### 3.2 Core API

```javascript
'use strict';

const Database = require('better-sqlite3');
const { randomULID } = require('./utils/ulid');

class MemoryEngine {
  constructor(dbPath) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');  // Write-Ahead Logging for concurrency
    this._initSchema();
  }

  // === CAPTURE ===

  /**
   * Store a new memory. Deduplicates against existing memories
   * with >0.85 cosine similarity (via FTS5 BM25 proxy).
   *
   * @param {Object} memory
   * @param {string} memory.type - fact|decision|pattern|error|preference|context
   * @param {string} memory.content - The memory text
   * @param {string} memory.scope - global|project|session
   * @param {string} memory.source - Origin hook/skill
   * @param {string[]} [memory.tags] - Classification tags
   * @param {number} [memory.confidence=1.0]
   * @returns {{ id: string, deduplicated: boolean }}
   */
  capture(memory) { /* ... */ }

  /**
   * Bulk capture from structured extraction results.
   * Used by PostToolUse and agent:end hooks.
   */
  captureMany(memories) { /* ... */ }

  // === RETRIEVE ===

  /**
   * Search memories using BM25-ranked FTS5 query.
   * Applies confidence weighting and scope filtering.
   *
   * @param {string} query - Natural language or keyword query
   * @param {Object} [options]
   * @param {string} [options.scope] - Filter by scope
   * @param {string} [options.type] - Filter by type
   * @param {number} [options.limit=5] - Max results
   * @param {number} [options.minConfidence=0.3] - Confidence floor
   * @returns {Array<{ id, type, content, confidence, rank }>}
   */
  search(query, options = {}) { /* ... */ }

  /**
   * Retrieve the top-K most relevant memories for a given context.
   * Combines BM25 search with recency and confidence scoring.
   *
   * @param {string} context - Description of current task/phase
   * @param {number} [k=5]
   * @returns {Array<{ id, type, content, relevance }>}
   */
  recall(context, k = 5) { /* ... */ }

  /**
   * Get all memories of a specific type, ordered by confidence.
   */
  listByType(type, options = {}) { /* ... */ }

  // === LIFECYCLE ===

  /**
   * Update a memory's content or metadata.
   * Creates a supersession link if content changes substantially.
   */
  update(id, changes) { /* ... */ }

  /**
   * Mark a memory as superseded by a newer one.
   */
  supersede(oldId, newId) { /* ... */ }

  /**
   * Reinforce a memory (bump access_count, reset decay clock).
   * Called automatically on every retrieval.
   */
  reinforce(id) { /* ... */ }

  /**
   * Run decay calculations and prune dead memories.
   * Called on SessionStart and periodically during long sessions.
   */
  decayAndPrune() { /* ... */ }

  /**
   * Export memories as structured markdown for human review.
   */
  exportMarkdown(options = {}) { /* ... */ }

  /**
   * Import memories from a markdown file (migration/bootstrap).
   */
  importMarkdown(filepath) { /* ... */ }
}
```

### 3.3 Deduplication Strategy

Before inserting a new memory, the engine runs a BM25 search against existing memories of the same type:

1. Query FTS5 with the new memory's content
2. If the top result has a BM25 rank above the dedup threshold (configurable, default -5.0):
   - **Same meaning, different wording**: Reinforce the existing memory, discard the new one
   - **Refinement of existing**: Create new memory, link as `refines`, supersede the old one
   - **Contradiction**: Create new memory, link as `contradicts`, flag for user review
3. If no match above threshold: Insert as new memory

---

## 4. Hook Implementations

### 4.1 Hook Configuration (`.claude/settings.json`)

```json
{
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "node claude-suite/lib/memory-hooks.js session-start",
        "timeout": 5000
      }
    ],
    "PreToolUse": [
      {
        "type": "command",
        "command": "node claude-suite/lib/memory-hooks.js pre-tool-use",
        "timeout": 3000
      }
    ],
    "PostToolUse": [
      {
        "type": "command",
        "command": "node claude-suite/lib/memory-hooks.js post-tool-use",
        "timeout": 5000
      }
    ],
    "Stop": [
      {
        "type": "command",
        "command": "node claude-suite/lib/memory-hooks.js stop",
        "timeout": 10000
      }
    ]
  }
}
```

### 4.2 Hook Script Protocol

All hooks receive context via **stdin** as JSON and communicate via **exit codes** and **stdout/stderr**.

```javascript
// lib/memory-hooks.js — Entry point for all memory hooks

'use strict';

const { MemoryEngine } = require('./memory');
const { extractMemories } = require('./memory-capture');

const DB_PATH = process.env.SUITE_MEMORY_DB
  || path.join(process.cwd(), '.suite', 'memory.db');

const engine = new MemoryEngine(DB_PATH);
const hookType = process.argv[2]; // 'session-start' | 'pre-tool-use' | 'post-tool-use' | 'stop'

// Read stdin (hook context payload)
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  const context = input ? JSON.parse(input) : {};
  handlers[hookType](context);
});

const handlers = {
  'session-start': sessionStartHandler,
  'pre-tool-use':  preToolUseHandler,
  'post-tool-use': postToolUseHandler,
  'stop':          stopHandler,
};
```

### 4.3 SessionStart Hook — Memory Hydration

**Purpose:** When a new session begins, load the most relevant memories into the agent's initial context as a compressed preamble.

```javascript
async function sessionStartHandler(context) {
  // 1. Run decay/pruning on stale memories
  engine.decayAndPrune();

  // 2. Load project-level facts and decisions (always relevant)
  const coreFacts = engine.listByType('fact', { scope: 'project', limit: 10, minConfidence: 0.5 });
  const coreDecisions = engine.listByType('decision', { scope: 'project', limit: 5, minConfidence: 0.5 });

  // 3. Load recent error memories (prevent repeating mistakes)
  const recentErrors = engine.listByType('error', { limit: 5, minConfidence: 0.4 });

  // 4. Load user preferences
  const preferences = engine.listByType('preference', { limit: 5, minConfidence: 0.5 });

  // 5. Format as compact markdown block
  const preamble = formatMemoryPreamble({
    facts: coreFacts,
    decisions: coreDecisions,
    errors: recentErrors,
    preferences: preferences,
  });

  // 6. Output to stdout — injected into session context
  if (preamble.trim()) {
    process.stdout.write(preamble);
  }

  process.exit(0); // Success, continue session
}

function formatMemoryPreamble({ facts, decisions, errors, preferences }) {
  const sections = [];

  if (facts.length > 0) {
    sections.push('## Recalled Facts\n' +
      facts.map(f => `- ${f.content}`).join('\n'));
  }
  if (decisions.length > 0) {
    sections.push('## Prior Decisions\n' +
      decisions.map(d => `- ${d.content}`).join('\n'));
  }
  if (errors.length > 0) {
    sections.push('## Known Pitfalls\n' +
      errors.map(e => `- ⚠ ${e.content}`).join('\n'));
  }
  if (preferences.length > 0) {
    sections.push('## Preferences\n' +
      preferences.map(p => `- ${p.content}`).join('\n'));
  }

  if (sections.length === 0) return '';

  return `<!-- Context Memory: ${facts.length + decisions.length + errors.length + preferences.length} memories loaded -->\n` +
    sections.join('\n\n') + '\n';
}
```

**Budget:** Max 2KB output to avoid context bloat. If memories exceed budget, prioritize by confidence × recency score, truncate lowest-ranked entries.

### 4.4 PreToolUse Hook — Contextual Memory Injection

**Purpose:** Before a tool executes, check if any stored memories are relevant to the tool + arguments being invoked. Inject as a hint.

```javascript
async function preToolUseHandler(context) {
  const { tool_name, tool_input } = context;

  // Only inject for high-signal tools (skip Read, Glob, Grep — too noisy)
  const INJECTABLE_TOOLS = ['Edit', 'Write', 'Bash', 'Agent'];
  if (!INJECTABLE_TOOLS.includes(tool_name)) {
    process.exit(0); // Pass through silently
  }

  // Build search query from tool context
  const searchQuery = buildToolQuery(tool_name, tool_input);
  if (!searchQuery) {
    process.exit(0);
  }

  // Search for relevant memories
  const relevant = engine.recall(searchQuery, 3);

  if (relevant.length > 0) {
    const hint = relevant
      .map(m => `[memory:${m.type}] ${m.content}`)
      .join('\n');

    // Write to stderr — feeds back into agent context (Exit Code 0 = continue)
    process.stderr.write(`\n<!-- Memory hints -->\n${hint}\n`);
  }

  process.exit(0); // Always allow the tool to proceed
}

function buildToolQuery(toolName, input) {
  switch (toolName) {
    case 'Edit':
    case 'Write':
      return input.file_path ? path.basename(input.file_path) : null;
    case 'Bash':
      return input.command ? input.command.slice(0, 100) : null;
    case 'Agent':
      return input.prompt ? input.prompt.slice(0, 150) : null;
    default:
      return null;
  }
}
```

**Key design choice:** PreToolUse uses **exit code 0** (not 2), so it never blocks tool execution. It only *hints* via stderr. This keeps memory advisory, not authoritative.

### 4.5 PostToolUse Hook — Automatic Memory Extraction

**Purpose:** After a tool executes, analyze the output for extractable learnings: errors to remember, patterns discovered, conventions observed.

```javascript
async function postToolUseHandler(context) {
  const { tool_name, tool_input, stdout, stderr, exit_code } = context;

  const extracted = extractMemories(tool_name, tool_input, stdout, stderr, exit_code);

  if (extracted.length > 0) {
    engine.captureMany(extracted.map(m => ({
      ...m,
      source: `PostToolUse:${tool_name}`,
      scope: 'project',
      confidence: 0.8,  // Auto-captured starts lower than manual
    })));
  }

  process.exit(0);
}
```

**Extraction Rules (`memory-capture.js`):**

```javascript
function extractMemories(toolName, input, stdout, stderr, exitCode) {
  const memories = [];

  // Rule 1: Bash errors → error memories
  if (toolName === 'Bash' && exitCode !== 0 && stderr) {
    const errorSummary = summarizeError(input.command, stderr);
    if (errorSummary) {
      memories.push({
        type: 'error',
        content: errorSummary,
        tags: JSON.stringify(['bash', 'error', extractCommandName(input.command)]),
      });
    }
  }

  // Rule 2: Successful test runs → pattern memories
  if (toolName === 'Bash' && exitCode === 0 && isTestCommand(input.command)) {
    const testInfo = parseTestOutput(stdout);
    if (testInfo) {
      memories.push({
        type: 'pattern',
        content: `Test command: \`${input.command}\` — ${testInfo.passed} passed, ${testInfo.failed} failed`,
        tags: JSON.stringify(['testing', 'pattern']),
      });
    }
  }

  // Rule 3: File edits → detect naming conventions, import patterns
  if (toolName === 'Edit' || toolName === 'Write') {
    const conventions = detectConventions(input.file_path, input.content || input.new_string);
    memories.push(...conventions);
  }

  // Rule 4: Agent task completions → decision/outcome memories
  if (toolName === 'Agent' && stdout) {
    const agentLearnings = extractAgentLearnings(stdout);
    memories.push(...agentLearnings);
  }

  return memories;
}

function summarizeError(command, stderr) {
  // Truncate to first meaningful error line, skip noise
  const lines = stderr.split('\n').filter(l =>
    l.trim() &&
    !l.includes('npm WARN') &&
    !l.includes('ExperimentalWarning')
  );
  if (lines.length === 0) return null;

  const cmd = command.length > 80 ? command.slice(0, 80) + '...' : command;
  const err = lines[0].length > 200 ? lines[0].slice(0, 200) + '...' : lines[0];
  return `Command \`${cmd}\` failed: ${err}`;
}

function isTestCommand(command) {
  return /\b(test|jest|vitest|pytest|cargo test|go test)\b/i.test(command);
}
```

**Throttling:** Max 3 memories captured per PostToolUse invocation. If extraction produces more, keep only the highest-signal ones (errors > patterns > conventions).

### 4.6 Stop Hook — Session Consolidation

**Purpose:** When a session ends, consolidate the session's work into a compact context memory for future sessions.

```javascript
async function stopHandler(context) {
  const { session_id, conversation_summary } = context;

  // 1. Generate session summary memory
  if (conversation_summary) {
    engine.capture({
      type: 'context',
      content: conversation_summary.slice(0, 500),
      scope: 'session',
      source: 'Stop',
      tags: JSON.stringify(['session-summary']),
      session_id: session_id,
      confidence: 0.7,
      // Session context memories expire after 7 days
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  // 2. Promote high-access session memories to project scope
  const sessionMemories = engine.db.prepare(`
    SELECT * FROM memories
    WHERE session_id = ? AND scope = 'session' AND access_count >= 3
  `).all(session_id);

  for (const mem of sessionMemories) {
    engine.update(mem.id, { scope: 'project' });
  }

  // 3. Run consolidation — merge near-duplicate memories
  engine.consolidate();

  process.exit(0);
}
```

---

## 5. The `/memory` Skill

### 5.1 Skill Definition

```yaml
---
name: memory
description: >
  Manage persistent context memory across sessions. Use when the user says
  "remember this", "forget", "what do you know about", "memory", or wants to
  store/recall/manage learned context. Also triggered by "don't forget",
  "note that", "keep in mind".
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
metadata:
  version: "1.0.0"
  author: "claude-suite"
  category: "context-management"
  negative_triggers:
    - Do not use for ephemeral task tracking (use TodoWrite instead)
    - Do not use for file search operations
    - Do not use for git history queries
---
```

### 5.2 Skill Commands

The `/memory` skill supports the following sub-commands:

```
/memory                        — Show memory dashboard (stats + recent)
/memory remember <text>        — Manually store a fact/decision/preference
/memory recall <query>         — Search memories by natural language query
/memory forget <id|query>      — Delete or decay a specific memory
/memory list [type] [scope]    — List memories with optional filters
/memory export                 — Export all memories as markdown
/memory import <file>          — Import memories from markdown
/memory consolidate            — Run dedup + decay + pruning manually
/memory stats                  — Show memory database statistics
```

### 5.3 Skill Prompt (body of SKILL.md)

```markdown
# Memory — Persistent Context Manager

## Activation

Trigger on: `/memory`, `/memory <subcommand>`, "remember this", "don't forget",
"what do you know about", "recall", or any request to persist/retrieve learned context.

## Execution

### Route by Subcommand

Parse the user's intent into one of these operations:

#### `remember` — Store a Memory
1. Classify the memory type: fact | decision | pattern | error | preference
2. Extract the core content (strip conversational fluff, keep essence)
3. Auto-tag based on content analysis (file paths → file tags, tech terms → stack tags)
4. Check for duplicates via FTS5 search
5. Store with appropriate scope:
   - If about this specific project → `project`
   - If a general preference/pattern → `global`
6. Confirm to user: `✓ Remembered [type]: "<content>" (id: <short-id>)`

#### `recall` — Search Memories
1. Run BM25 search against memory_fts5
2. Apply confidence and recency weighting
3. Format results as a concise table:
   ```
   | # | Type     | Memory                                      | Confidence |
   |---|----------|---------------------------------------------|------------|
   | 1 | decision | Chose SQLite for portability — no server     | 0.95       |
   | 2 | pattern  | Tests use node:test runner, *.test.js naming | 0.87       |
   ```
4. Reinforce all returned memories (bump access_count)

#### `forget` — Remove a Memory
1. If given an ID: delete directly
2. If given text: search, show matches, confirm before deleting
3. Never hard-delete without confirmation — decay to 0.0 first, prune on next cycle

#### `list` — Browse Memories
1. Query with optional type/scope filters
2. Sort by confidence DESC, then created_at DESC
3. Paginate at 20 entries per page

#### `export` — Markdown Export
1. Group memories by type, then by scope
2. Format as structured markdown with YAML frontmatter per entry
3. Write to `.suite/memory-export.md`

#### `stats` — Dashboard
Output:
```
Memory Database Stats
─────────────────────
Total memories:     47
  Facts:            12  (avg confidence: 0.91)
  Decisions:         8  (avg confidence: 0.88)
  Patterns:         15  (avg confidence: 0.72)
  Errors:            7  (avg confidence: 0.65)
  Preferences:       3  (avg confidence: 0.95)
  Context:           2  (avg confidence: 0.50)

Storage: .suite/memory.db (128 KB)
Last pruned: 2h ago (removed 3 stale memories)
```

## Anti-Patterns
- Don't store memories that duplicate CLAUDE.md or AGENTS.md content
- Don't capture trivial tool outputs (ls, pwd, etc.)
- Don't store full file contents — store the *insight* about the file
- Don't exceed 200 characters per memory content — be concise
- Don't auto-capture memories from Read/Glob/Grep tools (too noisy)
```

---

## 6. Orchestrator Integration

### 6.1 Event Listeners for Memory Capture

The orchestrator's EventEmitter hooks feed directly into the memory engine:

```javascript
// In orchestrator.js or a separate orchestrator-memory.js adapter

const { MemoryEngine } = require('./memory');

function attachMemoryListeners(orchestrator, engine) {

  // Capture blocked waves as error memories
  orchestrator.on('wave:blocked', ({ waveIndex, failures }) => {
    for (const failure of failures) {
      engine.capture({
        type: 'error',
        content: `Wave ${waveIndex} blocked: Task "${failure.description}" failed — ${failure.output?.slice(0, 150)}`,
        source: 'orchestrator:wave:blocked',
        scope: 'project',
        tags: JSON.stringify(['orchestrator', 'wave-failure']),
        confidence: 0.9,
      });
    }
  });

  // Capture successful phase completions as facts
  orchestrator.on('phase:end', ({ phase, status }) => {
    if (status === 'completed') {
      engine.capture({
        type: 'fact',
        content: `Phase "${phase}" completed successfully`,
        source: 'orchestrator:phase:end',
        scope: 'project',
        tags: JSON.stringify(['orchestrator', 'milestone']),
        confidence: 1.0,
      });
    }
  });

  // Capture verification failures as error memories
  orchestrator.on('agent:verify', ({ taskId, passed, confidence, errors }) => {
    if (!passed) {
      engine.capture({
        type: 'error',
        content: `Agent ${taskId} failed verification (${(confidence * 100).toFixed(0)}%): ${errors.join('; ').slice(0, 150)}`,
        source: 'orchestrator:agent:verify',
        scope: 'project',
        tags: JSON.stringify(['orchestrator', 'verification-failure']),
        confidence: 0.85,
      });
    }
  });
}
```

---

## 7. File Structure (New + Modified)

### New Files

```
claude-suite/
├── lib/
│   ├── memory.js               # MemoryEngine class (core CRUD + FTS5)
│   ├── memory-capture.js       # Extraction rules (tool output → memories)
│   ├── memory-retrieve.js      # BM25 search + relevance scoring helpers
│   ├── memory-hooks.js         # Hook entry point (stdin/stdout protocol)
│   └── utils/
│       └── ulid.js             # ULID generator (sortable unique IDs)
├── test/
│   ├── memory.test.js          # Core engine unit tests
│   ├── memory-capture.test.js  # Extraction rule tests
│   └── memory-hooks.test.js    # Hook integration tests
└── .claude-skills-dev/
    └── memory/
        ├── SKILL.md            # /memory skill definition
        └── scripts/
            └── memory-cli.sh   # Optional: standalone memory CLI wrapper
```

### Modified Files

```
claude-suite/
├── package.json                # Add better-sqlite3 dependency
├── lib/orchestrator.js         # Add memory event listener attachment
└── .claude/settings.json       # Add hook configurations (NEW file)
```

---

## 8. Dependencies

| Package | Purpose | Size |
|---|---|---|
| `better-sqlite3` | Synchronous SQLite3 bindings with FTS5 support | ~8MB (native) |
| (built-in) `crypto` | ULID generation fallback | 0 |
| (built-in) `path`, `fs` | File system operations | 0 |

**No other external dependencies.** The system deliberately avoids vector databases, embedding APIs, or external services to maintain the suite's zero-dependency philosophy and offline-first capability.

---

## 9. Implementation Phases

### Phase 1: Foundation (Core Engine)
- [ ] Implement `lib/memory.js` — MemoryEngine class with SQLite FTS5 schema
- [ ] Implement `lib/utils/ulid.js` — ULID generator
- [ ] Add `better-sqlite3` to package.json
- [ ] Write `test/memory.test.js` — CRUD, search, decay, dedup tests
- [ ] Verify FTS5 BM25 ranking works with Porter stemming

### Phase 2: Hooks Integration
- [ ] Implement `lib/memory-hooks.js` — Hook entry point with stdin/stdout protocol
- [ ] Implement `lib/memory-capture.js` — Extraction rules for tool outputs
- [ ] Implement SessionStart handler (memory hydration)
- [ ] Implement PreToolUse handler (contextual injection)
- [ ] Implement PostToolUse handler (automatic capture)
- [ ] Implement Stop handler (session consolidation)
- [ ] Create `.claude/settings.json` with hook configuration
- [ ] Write `test/memory-hooks.test.js`
- [ ] Write `test/memory-capture.test.js`

### Phase 3: Skill Implementation
- [ ] Create `.claude-skills-dev/memory/SKILL.md` — Full skill definition
- [ ] Implement all subcommands: remember, recall, forget, list, export, import, stats, consolidate
- [ ] Create `scripts/memory-cli.sh` for standalone usage

### Phase 4: Orchestrator Integration
- [ ] Add `attachMemoryListeners()` to orchestrator.js
- [ ] Wire `wave:blocked`, `phase:end`, `agent:verify` events
- [ ] Test memory capture from orchestrator lifecycle events

### Phase 5: Refinement
- [ ] Tune BM25 weights and dedup thresholds
- [ ] Add memory budget enforcement (max 2KB in SessionStart, max 512B in PreToolUse)
- [ ] Add `memory export` → markdown format for human review
- [ ] Add `memory import` for bootstrapping from existing CLAUDE.md content
- [ ] Performance test with 1000+ memories
- [ ] Document in README

---

## 10. Design Decisions & Trade-offs

### Why SQLite FTS5 over Vector Embeddings?
- **Zero external dependencies**: No embedding API calls, no vector DB servers
- **Offline-first**: Works entirely locally, no network required
- **Deterministic**: BM25 ranking is reproducible, not probabilistic
- **Fast**: FTS5 with Porter stemming handles 10K+ documents in <10ms
- **Aligned**: The architecture blueprint already specifies SQLite FTS5 for the deep-reading skill

### Why Hooks over MCP Tools?
- **Automatic**: Hooks fire without LLM cooperation — the LLM can't "forget" to use memory
- **Deterministic**: OS-level execution, not dependent on prompt adherence
- **Low-overhead**: Hook scripts are short-lived processes, not persistent servers
- **Non-blocking**: Exit code 0 means memory never blocks tool execution

### Why ULID over UUID?
- **Sortable**: ULIDs are lexicographically sortable by creation time
- **Compact**: 26 characters vs 36 for UUID
- **No dependency**: Can be generated with just `Date.now()` + random bytes

### Why Logarithmic Decay over Linear?
- **Natural**: Mirrors human memory — rapid initial forgetting, then plateaus
- **Reinforceable**: Accessed memories resist decay, unused ones fade
- **Tunable**: Per-type decay rates allow errors to fade faster than decisions

---

## 11. Risk Mitigation

| Risk | Mitigation |
|---|---|
| Memory DB grows unbounded | Decay + prune on every SessionStart; hard cap at 5000 memories |
| Noisy auto-capture floods DB | Throttle: max 3 memories per PostToolUse; skip Read/Glob/Grep tools |
| Hook latency slows tool execution | Strict timeouts (3s PreToolUse, 5s PostToolUse); async where possible |
| FTS5 false positives inject irrelevant context | Confidence threshold (0.3 min) + relevance scoring; budget caps |
| Memory contradictions confuse agent | `contradicts` link type + user review flag; newer memory wins by default |
| better-sqlite3 native compilation fails | Fallback: use `sql.js` (pure JS WASM SQLite); slower but zero-native |
| Privacy: sensitive data in memories | Never capture content from .env, credentials, or secret files; PreToolUse filter |

---

## 12. Success Metrics

1. **Session continuity**: Agent resumes work without re-reading the same files or repeating the same mistakes across sessions
2. **Error non-repetition**: Known errors from previous sessions are surfaced before the agent hits them again
3. **Context budget**: SessionStart preamble stays under 2KB; PreToolUse hints stay under 512B
4. **Latency**: All hooks complete within their timeout budgets (p99)
5. **Memory quality**: >80% of auto-captured memories rated "useful" in manual review
6. **Storage efficiency**: <1MB for 1000 memories including FTS5 index
