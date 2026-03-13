---
name: scratchpad
description: >
  External working memory for long-running tasks. Use when the user says
  "scratchpad", "take notes", "remember this", "save for later", or during
  complex multi-step tasks where intermediate results should be externalized
  to free up context window space. Inspired by the agent scratchpad pattern
  from LangChain's context engineering research.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
metadata:
  version: "1.0.0"
  author: "claude-suite"
  category: "context-engineering"
---

# Scratchpad — External Working Memory

Externalizes intermediate findings, decisions, and state to a `.scratchpad`
file so the context window stays focused on the current step. Like a human
jotting notes on paper to free up working memory.

## Activation

Trigger on: `/scratchpad`, `/scratchpad <action>`, "take notes", "save for later",
"remember this", or proactively during long multi-step tasks.

Actions:
- `/scratchpad write <note>` — Append a timestamped note
- `/scratchpad read` — Load the current scratchpad into context
- `/scratchpad clear` — Archive and reset the scratchpad
- `/scratchpad summary` — Generate a compressed summary of all notes

---

## How It Works

### Storage Location

The scratchpad lives at `.scratchpad` in the project root (or `.suite/.scratchpad`
if a .suite directory exists). It is a simple markdown file.

### Format

```markdown
# Scratchpad
Last updated: <timestamp>

## Session: <date>

### <timestamp> — <category>
<note content>

### <timestamp> — <category>
<note content>
```

### Categories

When writing notes, classify them into one of:
- **finding** — Something discovered during investigation
- **decision** — A design or implementation choice made
- **todo** — Something to do later
- **blocker** — An issue preventing progress
- **context** — Background info that may be needed later

---

## Phase 1: Write

When asked to write a note (or when proactively noting something during a task):

1. Read the existing `.scratchpad` file (or create it)
2. Append a new timestamped entry with the appropriate category
3. Confirm what was written

### Proactive Writing

During long tasks, proactively write to the scratchpad when:
- You discover something unexpected about the codebase
- You make a design decision that affects later steps
- You encounter an error and find the fix (note both)
- You identify something that needs cleanup later
- You find a pattern that will be reused

---

## Phase 2: Read

When asked to read the scratchpad:

1. Read the `.scratchpad` file
2. If it's large (> 100 lines), show a compressed version:
   - All category headers
   - Only the most recent 10 entries in full
   - Older entries as 1-line summaries

---

## Phase 3: Clear / Archive

When asked to clear:

1. If there are notes, move the current content to `.scratchpad.archive`
   (append, don't overwrite)
2. Create a fresh `.scratchpad` with just the header
3. Report how many entries were archived

---

## Phase 4: Summary

When asked for a summary:

1. Read all scratchpad entries
2. Group by category
3. For each category, list key points as bullets
4. Output the summary (do NOT write it to the scratchpad itself)
5. Offer to clear the scratchpad if the summary is sufficient

---

## Integration with Other Skills

- **/dev**: The dev skill should proactively write findings to the scratchpad
  during the SENSE phase and decisions during the PLAN phase
- **/context**: The context skill should include scratchpad notes when
  assembling context packages (they contain task-relevant decisions)
