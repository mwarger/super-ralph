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

Implement work beads one at a time. This is ralph-tui's native mode — just `ralph-tui run`. The runner selects the highest-priority ready bead, routes it to the appropriate agent/model, and the agent implements, tests, commits, and closes the bead.

## How It Works

1. **Invoke a skill** — the skill stamps process beads into an epic via `br create`
2. **Fat descriptions carry everything** — each bead's description contains full instructions, not the prompt template. The template is a thin wrapper that renders the bead's own description and injects progress context
3. **`ralph-tui run`** — the runner picks ready beads and executes them with fresh agent sessions
4. **Dynamic expansion** — agents can spawn child beads during execution (e.g., a review bead spawns fix beads), and the runner re-queries ready beads each iteration
5. **Steady-state detection** — fixed minimum passes + adaptive tail ensure thoroughness without infinite loops

## Prerequisites

- A Ralph loop runner (e.g., [ralph-tui](https://github.com/obra/ralph-tui)) — the execution engine
- [br](https://github.com/Dicklesworthstone/beads_rust) — beads CLI for task tracking

## Getting Started

```bash
# 1. Produce a spec from source code or requirements
#    (invoke the reverse bead pack skill)
ralph-tui skill reverse ./src "rebuild auth layer"

# 2. Decompose the spec into work beads
ralph-tui skill decompose --spec docs/specs/auth-spec.md

# 3. Implement — ralph-tui's native mode
ralph-tui run
```

Each step is independent — have a spec already? Skip to decompose. Have beads? Skip straight to `ralph-tui run`.

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

The bead packs and prompt templates are under active development. The legacy super-ralph CLI (a standalone TypeScript engine using the OpenCode SDK) exists at `src/` and is fully specified in `docs/specs/super-ralph-spec.md`. It will be superseded as the bead packs mature and ralph-tui becomes the sole execution layer.

## License

MIT
