# Super-Ralph

A unified SDLC framework for AI-assisted software development. Combines [Superpowers](https://github.com/obra/superpowers) (rigorous intake, design, review), the [OpenCode SDK](https://opencode.ai) (autonomous agent sessions), and [Beads](https://jeffreyemanuel.com) (dependency-aware task tracking with dependency-aware prioritization via `br` CLI).

Every piece of work — feature, bug, refactor, hotfix — flows through the same pipeline: relentless intake, three-phase autonomous execution, embedded review, audited completion.

The engine has three composable phases — **reverse**, **decompose**, and **forward** — each running the same Ralph loop (SELECT -> PROMPT -> EXECUTE -> EVALUATE) but consuming and producing different artifacts.

## Prerequisites

- [OpenCode](https://opencode.ai) — AI coding agent
- [bun](https://bun.sh) — JavaScript runtime
- [br](https://github.com/Dicklesworthstone/beads_rust) — beads CLI for task tracking

## Installation

### Claude Code

Tell Claude Code:

```
Fetch and follow instructions from https://raw.githubusercontent.com/mwarger/super-ralph/main/.claude/INSTALL.md
```

### OpenCode

Tell OpenCode:

```
Fetch and follow instructions from https://raw.githubusercontent.com/mwarger/super-ralph/main/.opencode/INSTALL.md
```

### Codex

Tell Codex:

```
Fetch and follow instructions from https://raw.githubusercontent.com/mwarger/super-ralph/main/.codex/INSTALL.md
```

## Per-Project Setup

After installing globally, initialize any project:

```
/superralph:init
```

Or say: "Initialize this project for super-ralph"

Init will:
1. **Validate prerequisites** — checks that `bun` and `br` are installed, offers install commands if missing
2. **Create project files:**
   - `.super-ralph/AGENTS.md` — Framework agent instructions
   - `.super-ralph/forward.hbs` — Prompt template for forward phase (beads -> code)
   - `.super-ralph/decompose.hbs` — Prompt template for decompose phase (spec -> beads)
   - `.super-ralph/reverse.hbs` — Prompt template for reverse phase (input -> spec)
   - `.super-ralph/intake-checklist.md` — Growing intake checklist
   - `.super-ralph/config.toml` — Project config with auto-detected `cli.path`
   - `tasks/` — Directory for generated PRDs
3. **Auto-detect `cli.path`** — resolves the absolute path to the super-ralph CLI and records it in `.super-ralph/config.toml`
4. **Initialize `.beads/` workspace** — runs `br init` if no beads workspace exists yet

## Commands

### Slash Commands (Planning — Phase 1)

- `/superralph:init` — Initialize project for the framework
- `/superralph:feature [desc]` — New feature: full intake -> design doc -> PRD -> beads -> launch
- `/superralph:bug [desc]` — Fix a bug: focused intake -> PRD -> beads -> launch
- `/superralph:hotfix [desc]` — Urgent fix: minimal intake, 1-3 beads -> launch
- `/superralph:refactor [desc]` — Restructure code: architecture intake -> design doc -> PRD -> beads -> launch
- `/superralph:plan [desc]` — Plan only: full intake -> design doc -> STOP
- `/superralph:resume` — Resume an interrupted epic
- `/superralph:status` — Check progress on current epic

All pipeline commands accept an optional inline description (e.g., `/superralph:feature add dark mode toggle`).

### CLI Commands (Execution — Phase 2)

- `super-ralph forward --epic <ID>` — Beads -> code. Agent picks the next ready bead, implements it, tests, commits, loops.
- `super-ralph decompose --spec <path>` — Spec -> beads. Agent reads the spec, creates one bead per iteration via `br`, loops until fully decomposed.
- `super-ralph reverse --input <path> [--output <dir>]` — Input -> spec. Agent analyzes input (code, docs, URLs), produces/refines a spec iteratively. `--input` is repeatable.
- `super-ralph status --epic <ID>` — Show epic progress.
- `super-ralph doctor` — Preflight checks (bun, br, templates, config).
- `super-ralph help` — Show usage.

Common options for all phase commands:
- `--model <provider/model>` — Override default model for all iterations
- `--max-iterations <n>` — Maximum iterations (default varies by phase)
- `--dry-run` — Show what would run without executing
- `--attach <url>` — Attach to existing OpenCode server instead of spawning one

`run` is a backward-compatibility alias for `forward`.

## The Three-Phase Model

Super-ralph is a pure Ralph loop engine with three composable phases. Each phase runs the same loop — SELECT, PROMPT, EXECUTE, EVALUATE — but consumes and produces different artifacts:

### Reverse: input -> spec

```
super-ralph reverse --input <path|url> [--output <dir>]
```

Takes any input (source code, documentation, URLs, descriptions) and iteratively produces a specification. The agent reviews the current spec draft for gaps, expands or refines it, then signals `task_complete` with status `complete` or `phase_done`. Output goes to `docs/specs/` by default.

### Decompose: spec -> beads

```
super-ralph decompose --spec <path> [--epic-title <title>]
```

Takes a spec/PRD file and creates beads one at a time. Each iteration, the agent reads the spec and the beads created so far, picks the next missing piece of work, creates it via `br create`, and loops. Automatically adds review, bugscan, audit, and learning beads based on config.

### Forward: beads -> code

```
super-ralph forward --epic <ID>
```

Takes an epic ID and implements beads. Each iteration, the agent sees all ready beads, picks the most important one, implements it, runs quality gates, commits, and closes the bead. The loop exits when no ready beads remain. Review and audit beads execute automatically at their dependency-defined points.

### Composability

Each phase works standalone. They also chain:

```
super-ralph reverse --input ./src --output docs/specs/
super-ralph decompose --spec docs/specs/spec.md --epic-title "Rebuild from spec"
super-ralph forward --epic bd-xxx
```

Or enter at any point — have a PRD already? Skip to decompose. Have beads? Skip to forward.

### Completion Signaling

All phases use the same `task_complete` tool with four statuses:
- `{ status: "complete" }` — this iteration is done, loop back for the next one
- `{ status: "phase_done" }` — the entire phase is finished, exit the loop
- `{ status: "blocked" }` — this bead is blocked, skip and continue
- `{ status: "failed" }` — this iteration failed, exit the loop

For forward, there's a third exit condition: no ready beads means the epic is complete.

## Model Selection

Beads carry semantic `area:` labels (e.g., `area:frontend-design`, `area:backend`, `area:review`) that describe the type of work. The config maps areas to models:

```toml
[models]
default = "anthropic/claude-sonnet-4-6"

[models.areas]
frontend-design = "google/gemini-2.5-pro"
backend = "anthropic/claude-sonnet-4-6"
review = "anthropic/claude-sonnet-4-6"
```

Resolution order:
1. CLI `--model` override (applies to all iterations in this run)
2. Bead `area:X` label -> `models.areas.X` in config
3. `models.default`

Remap any area to any model/provider by editing `.super-ralph/config.toml` — no need to re-create beads.

Note: In forward phase, the agent picks the bead after session creation (pure Ralph), so area-based routing doesn't apply — forward always uses `--model` or `models.default`.

## The Pipeline (End-to-End)

### Phase 1: Planning (slash commands invoke skills directly)

Type `/superralph:feature` (or `:bug`, `:hotfix`, `:refactor`). This invokes the corresponding skill directly in your current agent session — no external tool required:

1. **Intake** — Relentless interrogation: business context, technical deep-dive, learned questions. Depth scales to work type (feature: 10-15 questions, hotfix: 1-3).
2. **Design doc** — For features and refactors, produces a design document with user approval.
3. **PRD** — Generates phase-labeled user stories sized for single execution iterations.
4. **Beads** — Creates an epic with implementation beads, review beads at phase boundaries, bug scan beads, audit beads, and a learning extraction bead — all wired into a dependency graph (using `br` CLI).
5. **Launch offer** — Asks whether to start Phase 2 now or later.

### Phase 2: Execution (three-phase loop engine)

Execution launches from inside your agent session — no second terminal needed. At the end of Phase 1, the launch wizard offers to start execution immediately. To resume a previously started epic, use `/superralph:resume`.

The super-ralph CLI runs the three-phase loop engine via the OpenCode SDK. For the common case (beads already exist from Phase 1), the `forward` command handles execution: select (priority-sorted) -> prompt -> execute -> evaluate. Review beads execute automatically at phase boundaries. Audit beads review the entire implementation at the end. The learning bead extracts lessons and updates the intake checklist for next time.

For advanced workflows, chain all three phases: `reverse` (input -> spec), `decompose` (spec -> beads), `forward` (beads -> code).

**Advanced — manual CLI invocation:**

```bash
bun run <cli_path> forward --epic <epic-id>
```

Where `<cli_path>` is the absolute path stored in `.super-ralph/config.toml` under `[cli] path`.

## Skills

- `super-ralph-init` — Initialize a project for the framework
- `feature-prd` — Full feature pipeline: intake -> design doc -> PRD -> beads -> launch
- `bug-prd` — Bug fix pipeline: focused intake -> PRD -> beads -> launch
- `hotfix-prd` — Urgent fix pipeline: minimal intake -> PRD (1-3 stories) -> beads -> launch
- `refactor-prd` — Refactoring pipeline: architecture intake -> design doc -> PRD -> beads -> launch
- `plan-prd` — Planning only: full intake -> design doc -> STOP

## Updating

```bash
cd ~/.agents/super-ralph && git pull
```

Skills update instantly through symlinks. The `cli.path` in `.super-ralph/config.toml` points to the global install directory, so it stays stable across `git pull` — no need to re-run init after updating.

## Design Documentation

- [Three-Phase Ralph Loop Design](docs/plans/2026-02-24-three-phase-ralph-loop-design.md) — Current architecture (reverse, decompose, forward phases)
- [Two-Phase Pipeline Design](docs/plans/2026-02-22-two-phase-pipeline-design.md) — Historical (superseded by three-phase model)
- [Distribution Design](docs/plans/2026-02-21-super-ralph-distribution-design.md) — How global install works
- [Original SDLC Design](docs/plans/2026-02-21-superpowers-ralph-sdlc-design.md) — Historical (superseded by two-phase pipeline)

## License

MIT
