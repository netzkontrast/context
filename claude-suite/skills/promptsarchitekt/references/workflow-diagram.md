# Promptsarchitekt — Workflow Diagram

## Execution Flow

```
User: "/promptsarchitekt init"           User: "/promptsarchitekt [target]"
       │                                        │
       ▼                                        ▼
┌──────────────────┐                    ┌───────────────────┐
│  Phase 0: INIT   │                    │  Check INIT state │
│                  │                    │  (has seed genome?)│
│  Detect project  │                    └────────┬──────────┘
│  Build registry  │                             │
│  Scan infra      │                     yes ────┤──── no
│  Generate seed   │                     │       │
└────────┬─────────┘                     │   Run Phase 0
         │                               │       │
         ▼                               ▼       ▼
    [Ready Report]              ┌──────────────────────────────┐
                                │  Phase 1: HARVEST            │
                                │                              │
                                │  ┌────────────┬────────────┐ │
                                │  │ Explorer-A │ Explorer-B │ │
                                │  │  (Sonnet)  │  (Sonnet)  │ │
                                │  │ Researcher │  Verifier  │ │
                                │  │            │            │ │
                                │  │ +patterns  │ -patterns  │ │
                                │  │ +genomes   │ +failures  │ │
                                │  │ +context   │ +signals   │ │
                                │  └─────┬──────┴─────┬──────┘ │
                                │        └────┬───────┘        │
                                │             ▼                │
                                │     [Merged Context]         │
                                └──────────────┬───────────────┘
                                               │
                                               ▼
                                ┌──────────────────────────────┐
                                │  Phase 2: DISTILL            │
                                │                              │
                                │  BM25 retrieve prior genomes │
                                │  Apply SQ3R methodology      │
                                │  Generate 3-5 candidates     │
                                │  Each < 500 tokens           │
                                └──────────────┬───────────────┘
                                               │
                                               ▼
                                ┌──────────────────────────────┐
                                │  Phase 3: CHALLENGE          │
                                │                              │
                                │  ┌────────────────────────┐  │
                                │  │   Critic (Sonnet)      │  │
                                │  │   Verifier Persona     │  │
                                │  │                        │  │
                                │  │  5-dim scoring:        │  │
                                │  │   Specificity     /10  │  │
                                │  │   Constraint      /10  │  │
                                │  │   Failure Resist  /10  │  │
                                │  │   Memory Density  /10  │  │
                                │  │   Composability   /10  │  │
                                │  │                        │  │
                                │  │  Adversarial testing   │  │
                                │  └────────────────────────┘  │
                                └──────────────┬───────────────┘
                                               │
                                               ▼
                                ┌──────────────────────────────┐
                                │  Phase 4: ARBITRATE          │
                                │                              │
                                │  ┌────────────────────────┐  │
                                │  │   Judge (Opus)         │  │
                                │  │   Planner Persona      │  │
                                │  │                        │  │
                                │  │  Weighted ranking      │  │
                                │  │  Gene recombination    │  │
                                │  │  Written rationale     │  │
                                │  │  Confidence assignment │  │
                                │  └────────────────────────┘  │
                                └──────────────┬───────────────┘
                                               │
                                               ▼
                                ┌──────────────────────────────┐
                                │  Phase 5: REINFORCE          │
                                │                              │
                                │  Triple-Write:               │
                                │  ┌──────────┬──────┬───────┐ │
                                │  │ Context  │  KG  │Memory │ │
                                │  │  Store   │      │Engine │ │
                                │  │ (FTS5)   │(edges)│(decay)│ │
                                │  └──────────┴──────┴───────┘ │
                                │                              │
                                │  = Irreversible Memory       │
                                └──────────────┬───────────────┘
                                               │
                                               ▼
                                ┌──────────────────────────────┐
                                │  Phase 6: EVOLVE             │
                                │                              │
                                │  Compute delta vs history    │
                                │  Classify: breakthrough /    │
                                │           stable / regression│
                                │  Update lineage              │
                                │  Output winning genome       │
                                └──────────────┬───────────────┘
                                               │
                                               ▼ (next invocation)
                                        ┌──────────────┐
                                        │ Phase 1:     │
                                        │ HARVEST      │
                                        │ (retrieves   │
                                        │  evolved     │
                                        │  genomes)    │
                                        └──────────────┘
```

## Subagent Allocation

| Agent | Model | Persona | Context Budget | Phase |
|-------|-------|---------|---------------|-------|
| Explorer-A | Sonnet | Researcher | 20% | 1 (HARVEST) |
| Explorer-B | Sonnet | Verifier | 25% | 1 (HARVEST) |
| Critic | Sonnet | Verifier | 25% | 3 (CHALLENGE) |
| Judge | Opus | Planner | 30% | 4 (ARBITRATE) |

## Data Flow

```
HARVEST ──raw patterns──> DISTILL ──candidates──> CHALLENGE ──scores──> ARBITRATE
   ▲                                                                       │
   │                                                                       ▼
   └──────────── EVOLVE <──delta── REINFORCE <──winner + rationale─────────┘
```

## Persistence Layers (Triple-Write)

```
┌─────────────────────────────────────────────────────────────┐
│                    Prompt Genome                             │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ ContextStore │  │ Knowledge    │  │ MemoryEngine     │  │
│  │              │  │ Graph        │  │                  │  │
│  │ FTS5 search  │  │ IMPLEMENTS   │  │ Confidence decay │  │
│  │ BM25 ranked  │  │ OBSOLETES    │  │ Reinforcement    │  │
│  │ Key-value    │  │ DEPENDS_ON   │  │ BM25 retrieval   │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
│  Any 2 of 3 layers sufficient for knowledge recovery.       │
│  = Irreversible memory.                                     │
└─────────────────────────────────────────────────────────────┘
```
