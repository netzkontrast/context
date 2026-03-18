# Research Skill — Workflow Reference

## Execution Flow (SQ3R Method)

```
  User: "/research <topic>"
         │
         ▼
  ┌──────────────┐
  │  0. SURVEY   │  Scan target structure, read headings/signatures
  │  (Overview)  │  Check Context Store for prior research
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  1. QUESTION │  Generate 3-5 focused research questions
  │  (Focus)     │  Confirm with user, refine scope
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  2. READ     │  Deep-read in chunks (~200 lines)
  │  (Analyze)   │  Extract: concepts, decisions, patterns, risks
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  3. RECITE   │  Synthesize into knowledge document
  │  (Produce)   │  Summary, concepts, decisions, patterns, open Qs
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  4. REVIEW   │  Cross-reference with existing knowledge
  │  (Persist)   │  Save to Context Store for other skills
  └──────────────┘
```

## Research Target Types

```
  File path    → Single-file deep analysis
  Directory    → Structural exploration + key file deep-reads
  URL          → External resource fetch + analysis
  Topic string → Codebase search + multi-file synthesis
```

## Knowledge Document Structure

```
  research:<topic>:<timestamp>
  ├── Executive Summary (3-5 sentences)
  ├── Key Concepts (definitions)
  ├── Architecture Decisions (table)
  ├── Code Patterns (descriptions)
  ├── Integration Points (dependencies)
  └── Open Questions (unknowns)
```
