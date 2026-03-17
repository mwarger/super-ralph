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

### Decompose: spec → work beads

Break a specification into implementable work beads. The bead pack stamps beads for: analyze spec → stamp area beads → cross-review. Each work bead gets a fat description with implementation instructions, file targets, and acceptance criteria.

### Forward: work beads → code

No bead-stamping step needed — Decompose already produced the work beads. This is ralph-tui's native mode — just `ralph-tui run`. The runner selects the highest-priority ready bead, routes it to the appropriate agent/model, and the agent implements, tests, commits, and closes the bead.

## How It Works

There are two distinct steps: **stamp beads** (skill, runs in your agent), then **execute beads** (ralph-tui).

### Step 1: Invoke a skill to stamp beads

Skills run inside an agent session (Claude Code, OpenCode, etc.). You describe what you want in natural language. The skill stamps process beads into an epic via `br create`, wires dependencies, and reports the epic ID.

```
You:   "Reverse-engineer the auth module at src/auth/ and produce a spec"

Agent: Invokes reverse skill internally
       → Creates epic "Reverse: auth module" (br-epic-001)
       → Stamps 6 process beads:
         br-001: Deep study of src/auth/
         br-002: Draft clean-room spec (depends on br-001)
         br-003: Fresh eyes review 1 (depends on br-002)
         br-004: Fresh eyes review 2 (depends on br-003)
         br-005: Fresh eyes review 3 (depends on br-004)
         br-006: Consolidation (depends on br-005)

Agent: "Created epic br-epic-001 with 6 reverse process beads.
        Run: ralph-tui run --tracker beads-rust --epic br-epic-001"
```

### Step 2: ralph-tui executes the beads

Ralph-tui picks the next ready bead, renders the prompt template with the bead's fat description, spawns a fresh agent session, and repeats until no ready beads remain.

```bash
ralph-tui run --tracker beads-rust --epic br-epic-001
```

Each iteration gets fresh context. Agents can spawn child beads during execution (e.g., a review bead finds gaps and creates fix-up beads). Ralph-tui re-queries ready beads each iteration, so dynamically spawned beads are picked up automatically.

### End-to-end example

```bash
# Phase 1: Reverse
#   1. Invoke reverse skill in your agent → stamps beads, reports epic ID
#   2. Execute:
ralph-tui run --tracker beads-rust --epic br-epic-001
#   Output: docs/specs/<name>-spec.md

# Phase 2: Decompose
#   1. Invoke decompose skill in your agent → stamps beads, reports epic ID
#   2. Execute:
ralph-tui run --tracker beads-rust --epic br-epic-002
#   Output: work beads created under br-epic-003

# Phase 3: Forward — no skill needed, work beads already exist
ralph-tui run --tracker beads-rust --epic br-epic-003
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

## What's in This Repo

```
skills/                    Question banks for intake interviews
  feature.md               Business + technical interrogation for features
  bug.md                   Reproduction, root cause, impact analysis
  hotfix.md                Minimal urgent-fix questions (1-3)
  refactor.md              Architecture, migration, risk assessment
docs/
  specs/super-ralph-spec.md    Clean-room spec of the three-phase SDLC loop
  plans/                       Design documents (see below)
src/                       Legacy CLI (superseded — see Status)
```

## Prerequisites

- [ralph-tui](https://github.com/obra/ralph-tui) — the execution engine (any Ralph loop runner works)
- [br](https://github.com/Dicklesworthstone/beads_rust) — beads CLI for task tracking

## Design Documentation

- [Beads-as-Engine Design](docs/plans/2026-03-01-beads-as-engine-design.md) — The strategic design: why bead packs replace a custom engine
- [Clean-Room Specification](docs/specs/super-ralph-spec.md) — Complete behavioral spec of the three-phase SDLC loop (2,436 lines)

Historical (superseded by beads-as-engine):
- [Three-Phase Ralph Loop Design](docs/plans/2026-02-24-three-phase-ralph-loop-design.md) — The original custom-engine architecture
- [Run Artifacts Reference](docs/reference/run-artifacts.md) — Event logs, session state, and transcript files
- [Two-Phase Pipeline Design](docs/plans/2026-02-22-two-phase-pipeline-design.md)
- [Distribution Design](docs/plans/2026-02-21-super-ralph-distribution-design.md)
- [Original SDLC Design](docs/plans/2026-02-21-superpowers-ralph-sdlc-design.md)

## Status

The bead packs are under active development. The question banks (`skills/`) are complete. The bead-stamping skills (reverse, decompose) and prompt templates are being built.

A legacy super-ralph CLI (standalone TypeScript engine using the OpenCode SDK) exists at `src/` and is fully specified in `docs/specs/super-ralph-spec.md`. It is superseded by the beads-as-engine architecture — ralph-tui replaces the custom engine entirely.

## License

MIT
