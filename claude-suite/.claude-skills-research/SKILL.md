---
name: research
description: >
  SQ3R deep-reading researcher. Use when the user says "research", "analyze this",
  "deep read", "summarize", or wants to deeply understand a document, codebase area,
  or topic before making decisions. Implements the SQ3R methodology (Survey, Question,
  Read, Recite, Review) to produce structured knowledge summaries that persist in the
  Context Store for retrieval by other skills.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Agent
  - TodoWrite
  - WebSearch
  - WebFetch
metadata:
  version: "1.0.0"
  author: "claude-suite"
  category: "research"
---

# Research — SQ3R Deep-Reading Researcher

A knowledge acquisition skill that deeply analyzes documents, codebases, or external resources using the SQ3R (Survey, Question, Read, Recite, Review) methodology. Produces structured knowledge summaries persisted to the Context Store for cross-session retrieval.

## Activation

Trigger on: `/research <topic>`, `/research <path>`, `/research <url>`, "research this", "analyze this document", "deep read", "summarize this area".

The argument specifies the research target:
- A file path or directory → local code/document analysis
- A URL → external resource analysis
- A topic string → exploratory research across the codebase

---

## Phase 0: Survey (SURVEY)

Build a structural overview of the target before deep-reading.

### 0.1 — Identify Target Type

Determine what we're researching:
- **Single file**: Read first/last 50 lines, extract headings, function signatures, exports
- **Directory**: Build a structural map with `Glob` and `ls`, identify entry points and key files
- **URL**: Fetch the resource, extract title, headings, and structure
- **Topic**: Search the codebase with `Grep` for the topic keyword, identify relevant files

### 0.2 — Check Prior Research

Search the Context Store for existing research on this topic:
- Key pattern: `research:<topic>*`
- If prior research exists, note its date and key findings
- Decide whether to build on it or start fresh

### 0.3 — Build Structural Map

Output a brief overview of what was found:
```
Research Target: <target>
Type: file | directory | url | topic
Scope: <N files, M lines> or <URL title>
Prior Research: <exists from date> | <none found>
```

---

## Phase 1: Question (QUESTION)

Generate focused questions to guide the deep-read.

### 1.1 — Generate Questions

Based on the survey, formulate 3-5 specific questions:
- What is the primary purpose of this code/document?
- What are the key design decisions and their trade-offs?
- What patterns or conventions does it follow?
- What are the external dependencies and integration points?
- What are the potential risks or areas of concern?

### 1.2 — Refine with User

Present the questions to the user for confirmation:
- Allow them to add, remove, or modify questions
- If the user provides no feedback, proceed with the generated questions

---

## Phase 2: Read (READ)

Deep-read the source material systematically.

### 2.1 — Chunked Reading

For large files (over 500 lines), read in manageable chunks:
- Read in sections of ~200 lines
- For each section, extract: key concepts, decisions, patterns

For directories, read files in dependency order:
- Entry points first (index.js, main.py, lib.rs)
- Then dependencies, then utilities, then tests

### 2.2 — Extract Knowledge

For each section or file, capture:
- **Concepts**: Named ideas, abstractions, domain terms
- **Decisions**: Explicit or implied design choices with rationale
- **Patterns**: Recurring code structures, conventions, idioms
- **Interfaces**: Public APIs, exports, function signatures
- **Dependencies**: What this code relies on, integrates with
- **Risks**: Potential bugs, security concerns, fragile areas

### 2.3 — Answer Questions

Explicitly address each question from Phase 1 as evidence is found.

---

## Phase 3: Recite (RECITE)

Synthesize findings into a structured knowledge document.

### 3.1 — Knowledge Document Structure

```markdown
# Research: <topic>
**Date:** <timestamp>
**Target:** <path | url | topic>
**Scope:** <summary of what was analyzed>

## Executive Summary
<3-5 sentences capturing the essential understanding>

## Key Concepts
- **<Concept>**: <definition and context>

## Architecture & Design Decisions
| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| ...      | ...       | ...        |

## Code Patterns
- **<Pattern name>**: <where it appears, what it achieves>

## Integration Points
- <dependency/interface and how it's used>

## Open Questions
- <things that remain unclear or need further investigation>
```

---

## Phase 4: Review (REVIEW)

Cross-reference and persist findings.

### 4.1 — Cross-Reference

Compare findings against:
- Existing Context Store entries for related topics
- Project documentation (README, AGENTS.md, planning.md)
- Identify contradictions, confirmations, or gaps

### 4.2 — Persist to Context Store

Save the research document:
- Key: `research:<topic>:<timestamp>`
- Include metadata: source files read, questions answered, confidence level

### 4.3 — Final Summary

Output a brief summary to the user:
```
Research complete: <topic>
  Analyzed: <N files, M lines>
  Key findings: <2-3 bullet points>
  Persisted as: research:<topic>:<timestamp>
  Open questions: <count>
```

---

## Decision Framework

When facing choices about research depth:

1. **User's questions** — always answer what the user asked first
2. **Breadth vs depth** — prefer depth on fewer files over shallow coverage of many
3. **Signal vs noise** — extract decisions and trade-offs, not implementation details
4. **Reusability** — write findings so other skills (especially `/dev`) can consume them

## Anti-Patterns (Do NOT)

- Don't read every file in a large directory — sample strategically
- Don't produce raw file listings as research output — synthesize
- Don't answer questions with "it depends" — commit to findings based on evidence
- Don't skip the Question phase — it focuses the research
- Don't modify any code files — this is a read-only skill
