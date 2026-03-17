# Super-Ralph

Bead packs and prompt templates that encode proven SDLC methodologies for any Ralph loop. Beads are the universal unit — any runner that works ready beads until none remain can execute these packs. Built with [ralph-tui](https://github.com/obra/ralph-tui) in mind, but not coupled to it.

## Two-Layer Model

Super-Ralph separates **what to do** from **how to run it**:

```
┌─────────────────────────────────────────────────┐
│  Strategy Layer (this repo)                      │
│                                                  │
│  Skills that stamp process beads into an epic.   │
│  Fat descriptions carry all instructions.        │
│  Agents spawn child beads during execution.      │
├──────────────────────────────────────────────────┤
│  Execution Layer (any Ralph loop)                │
│                                                  │
│  Picks next ready bead. Renders prompt template. │
│  Spawns agent session. Detects completion.       │
│  Marks done. Repeats until no ready beads.       │
└─────────────────────────────────────────────────┘
```

**Strategy layer** (this repo): bead packs + prompt templates. Each phase of the SDLC is a skill that stamps a graph of process beads with fat descriptions — every bead carries its full instructions, file references, spawning rules, and completion protocol.

**Execution layer** (ralph-tui or any bead runner): picks the next ready bead, renders the prompt template, spawns a fresh agent session, marks the bead done, and repeats until no ready beads remain. No knowledge of the methodology is required.

## The Three Phases

Every piece of work flows through three phases. Each phase is a **bead pack** — a skill that stamps process beads into an epic.

### Reverse: any input → clean-room spec

Analyze source code, requirements, or any input and produce a verified specification. The bead pack stamps beads for: analyze → draft → fresh-eyes reviews → verification. Review beads spawn dynamically based on spec complexity.

Reverse agents explore the codebase first — if a question can be answered by reading code, they read code instead of asking. When studying existing code, agents leave `[see file:NN-MM]` citations in the spec that act as breadcrumbs for later phases. The synthesis step uses "Design It Twice" — proposing radically different approaches under different constraints, not minor variations — so the spec captures a deliberate architectural choice.

### Decompose: spec → work beads

Break a specification into implementable work beads. The bead pack stamps beads for: analyze spec → stamp area beads → cross-review. Each work bead is a **vertical slice** — a narrow but complete path through all layers (schema, API, logic, UI, tests), not a horizontal slice of one layer. The first bead is always a "tracer bullet": the narrowest end-to-end path that proves the architecture works. Subsequent beads widen the path one behavior at a time.

Any `[see file:NN-MM]` citations from the spec are carried into bead descriptions, so implementing agents can follow the breadcrumbs back to the source code that informed the design.

### Forward: work beads → code

No bead-stamping step needed — Decompose already produced the work beads. This is ralph-tui's native mode — just `ralph-tui run`. The runner selects the highest-priority ready bead, routes it to the appropriate agent/model, and the agent implements, tests, commits, and closes the bead.

Forward agents follow TDD discipline: for each acceptance criterion, write a failing test first (RED), then write minimal code to pass it (GREEN). One test at a time, one slice at a time — never batch all tests up front. If the bead description contains `[see file:NN-MM]` citations, agents read those references first to ground their implementation in the existing codebase.

## How It Works

There are two distinct steps: **stamp beads** (skill, runs in your agent), then **execute beads** (ralph-tui).

### Step 1: Invoke a skill to stamp beads

Skills run inside an agent session (Claude Code, OpenCode, etc.). You describe what you want in natural language. The skill stamps process beads into an epic via `br create`, wires dependencies, and reports the epic ID.

```
You:   /super-ralph-reverse the auth module at src/auth/

Agent: Creates epic "Reverse: auth module" (br-epic-001)
       Stamps 6 process beads:
         br-001: Deep study of src/auth/
         br-002: Draft clean-room spec (depends on br-001)
         br-003: Fresh eyes review 1 (depends on br-002)
         br-004: Fresh eyes review 2 (depends on br-003)
         br-005: Fresh eyes review 3 (depends on br-004)
         br-006: Consolidation (depends on br-005)

       "Created epic br-epic-001 with 6 reverse process beads.
        Run: ralph-tui run"
```

### Step 2: ralph-tui executes the beads

Ralph-tui picks the next ready bead, renders the prompt template with the bead's fat description, spawns a fresh agent session, and repeats until no ready beads remain.

```bash
ralph-tui run
```

Each iteration gets fresh context. Agents can spawn child beads during execution (e.g., a review bead finds gaps and creates fix-up beads). Ralph-tui re-queries ready beads each iteration, so dynamically spawned beads are picked up automatically.

### End-to-end example

```bash
# Phase 1: Reverse — invoke a skill to stamp beads
#   In Claude Code: /super-ralph-feature the auth module at src/auth/
#   Stamps 6 reverse process beads with feature question bank
ralph-tui run
#   Output: docs/specs/auth-analysis.md, docs/specs/auth-spec.md

# Phase 2: Decompose — invoke skill with the spec
#   In Claude Code: /super-ralph-decompose docs/specs/auth-spec.md
#   Stamps 5 decompose process beads + creates work epic
ralph-tui run
#   Output: work beads created under implementation epic

# Phase 3: Forward — no skill needed, work beads already exist
ralph-tui run
#   Output: implemented code, committed to git
```

Each phase is independent — have a spec already? Skip to decompose. Have work beads? Skip straight to forward.

### Fat descriptions: the key design decision

All process intelligence lives in bead descriptions, not in the prompt template. The template is a thin wrapper that renders the bead's own description and injects progress context. Each bead description contains:

- What the agent should do
- What files/paths to examine
- When and how to spawn child beads
- How to signal completion

This means the runner needs zero knowledge of the methodology — it just renders descriptions and executes.

## Available Skills

### Bead-Stamping Skills (slash commands)

These skills run inside Claude Code (or any agent that supports skills). Each stamps a bead graph and reports the epic ID.

| Skill | Purpose | Beads Stamped |
|---|---|---|
| `/super-ralph-reverse` | Reverse-engineer any input into a clean-room spec | 6: study → draft → 3 reviews → consolidation |
| `/super-ralph-feature` | Reverse with feature question bank (business + technical) | Same 6, with 13 feature questions in bead 1 |
| `/super-ralph-bug` | Reverse with bug investigation question bank | Same 6, with 8 bug questions in bead 1 |
| `/super-ralph-refactor` | Reverse with refactor/migration question bank | Same 6, with 13 refactor questions in bead 1 |
| `/super-ralph-hotfix` | Reverse with fast-track hotfix question bank | Same 6, with 4 hotfix questions in bead 1 |
| `/super-ralph-decompose` | Decompose a spec into phased work beads | 5: analyze → 3 graph reviews → structural gates |

The domain-specific skills (feature, bug, refactor, hotfix) compose with `/super-ralph-reverse` — they stamp the same bead graph but inject a domain-specific question bank into bead 1's study instructions.

### Input Classification

The reverse skills accept natural language and classify inputs automatically:

| Input Type | Example |
|---|---|
| Local source code | `src/auth/` |
| GitHub repo URL | `https://github.com/user/repo` |
| Live product URL | `https://app.example.com` |
| Documentation URL | `https://docs.example.com/api` |
| Description/brief | "A system that does X, Y, Z" |
| Mixed | GitHub URL + "but ours should differ by..." |

## What's in This Repo

```
skills/
  super-ralph-reverse/       Bead-stamping skill: any input → clean-room spec
    SKILL.md                 Skill entry point (input classification, stamping procedure)
    references/              Fat bead description templates
      bead-1-deep-study.md   Deep study of source material
      bead-2-draft-spec.md   Draft clean-room specification
      bead-review-pass.md    Fresh eyes review (parameterized by pass number)
      bead-consolidation.md  Clean-room verification and final polish
  super-ralph-decompose/     Bead-stamping skill: spec → phased work beads
    SKILL.md                 Skill entry point (spec input, work epic creation)
    references/              Fat bead description templates
      bead-1-analyze-spec.md Analyze spec, create phased beads (includes quality standard)
      bead-review-graph.md   Review bead graph (7 criteria, parameterized by pass)
      bead-structural.md     Add REVIEW gates, BUGSCAN, AUDIT
  super-ralph-feature/       Composable: reverse + feature question bank
  super-ralph-bug/           Composable: reverse + bug question bank
  super-ralph-refactor/      Composable: reverse + refactor question bank
  super-ralph-hotfix/        Composable: reverse + hotfix question bank
  feature.md                 Feature question bank (13 questions)
  bug.md                     Bug question bank (8 questions)
  refactor.md                Refactor question bank (13 questions)
  hotfix.md                  Hotfix question bank (4 questions)

templates/
  reverse.hbs               Interactive/autonomous reverse prompt template
  decompose.hbs             Autonomous decompose iteration template
  forward.hbs               TDD-driven forward implementation template

docs/
  specs/
    super-ralph-spec.md      Clean-room spec of the three-phase SDLC loop (2,436 lines)
    super-ralph-analysis.md  Reverse-engineered analysis of the framework
  plans/
    2026-03-01-beads-as-engine-design.md   Current strategic design document

spec/                        Modular behavioral specification (31 files)
  README.md                  Scope, reading order, artifact index
  architecture/              System overview, runtime lifecycle
  behavior/                  Config, error handling, persistence, state model
  workflows/                 7 end-to-end user workflows
  modules/                   Per-module specs (19 files, one per source module)

src/                         Legacy CLI engine (superseded — see Status)
```

## Prerequisites

- [ralph-tui](https://github.com/obra/ralph-tui) — the execution engine (any Ralph loop runner works)
- [br](https://github.com/Dicklesworthstone/beads_rust) — beads CLI for task tracking
- An agent that supports skills (Claude Code, OpenCode, etc.)

## Installation

The bead-stamping skills need to be symlinked into your agent's skill directory. For Claude Code:

```bash
# From this repo's root
ln -s "$(pwd)/skills/super-ralph-reverse" ~/.claude/skills/super-ralph-reverse
ln -s "$(pwd)/skills/super-ralph-feature" ~/.claude/skills/super-ralph-feature
ln -s "$(pwd)/skills/super-ralph-bug" ~/.claude/skills/super-ralph-bug
ln -s "$(pwd)/skills/super-ralph-refactor" ~/.claude/skills/super-ralph-refactor
ln -s "$(pwd)/skills/super-ralph-hotfix" ~/.claude/skills/super-ralph-hotfix
ln -s "$(pwd)/skills/super-ralph-decompose" ~/.claude/skills/super-ralph-decompose
```

After symlinking, a new Claude Code session will show all 6 skills in the available skill list.

## Design Documentation

- [Beads-as-Engine Design](docs/plans/2026-03-01-beads-as-engine-design.md) — The strategic design: why bead packs replace a custom engine, fat descriptions, phase-specific bead packs, and how ralph-tui runs them
- [Clean-Room Specification](docs/specs/super-ralph-spec.md) — Complete behavioral spec of the three-phase SDLC loop (2,436 lines)
- [Modular Spec](spec/README.md) — Reverse-engineered behavioral specification across 31 files with 100% module coverage

Historical (superseded by beads-as-engine):
- [Three-Phase Ralph Loop Design](docs/plans/2026-02-24-three-phase-ralph-loop-design.md) — The original custom-engine architecture
- [Run Artifacts Reference](docs/reference/run-artifacts.md) — Event logs, session state, and transcript files
- [Two-Phase Pipeline Design](docs/plans/2026-02-22-two-phase-pipeline-design.md)
- [Distribution Design](docs/plans/2026-02-21-super-ralph-distribution-design.md)
- [Original SDLC Design](docs/plans/2026-02-21-superpowers-ralph-sdlc-design.md)

## Status

The beads-as-engine architecture is implemented. All six bead-stamping skills are complete and available as slash commands:

- **Reverse pack** (`/super-ralph-reverse` and domain variants): stamps 6-bead process graphs for producing clean-room specifications from any input type
- **Decompose pack** (`/super-ralph-decompose`): stamps 5-bead process graphs for breaking specs into phased, self-contained work beads with quality gates (REVIEW, BUGSCAN, AUDIT)
- **Question banks** (`skills/*.md`): complete for feature, bug, refactor, and hotfix domains
- **Prompt templates** (`templates/`): complete for all three phases (reverse, decompose, forward)

A legacy super-ralph CLI (standalone TypeScript engine using the OpenCode SDK) exists at `src/` and is fully specified in `docs/specs/super-ralph-spec.md` and `spec/`. It is superseded by the beads-as-engine architecture — ralph-tui replaces the custom engine entirely.

## License

MIT
