# Super-Ralph

A unified SDLC framework for AI-assisted software development. Combines [Superpowers](https://github.com/obra/superpowers) (rigorous intake, design, review), the [OpenCode SDK](https://opencode.ai) (autonomous agent sessions), and [Beads](https://jeffreyemanuel.com) (dependency-aware task tracking with dependency-aware prioritization via `br` CLI).

Every piece of work — feature, bug, refactor, hotfix — flows through the same pipeline: relentless intake, three-phase autonomous execution, embedded review, audited completion.

The engine has three composable phases — **reverse**, **decompose**, and **forward** — each running the same Ralph loop (SELECT -> PROMPT -> EXECUTE -> EVALUATE) but consuming and producing different artifacts.

## Prerequisites

- [OpenCode](https://opencode.ai) — AI coding agent
- [bun](https://bun.sh) — JavaScript runtime
- [br](https://github.com/Dicklesworthstone/beads_rust) — beads CLI for task tracking

## Installation

Quick install (one command):

```bash
curl -fsSL "https://raw.githubusercontent.com/mwarger/super-ralph/main/install.sh?$(date +%s)" | bash
```

This installer will:
- install missing prerequisites (`bun`, `br`) if needed
- clone/update super-ralph in `~/.super-ralph-cli`
- install dependencies
- install a `super-ralph` command into a writable bin directory

Manual install (if you prefer):

```bash
git clone https://github.com/mwarger/super-ralph.git ~/.super-ralph-cli
cd ~/.super-ralph-cli && bun install
```

Then add to your PATH or alias:

```bash
alias super-ralph="bun run ~/.super-ralph-cli/src/index.ts"
```

## Per-Project Setup

```bash
super-ralph init
```

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

```
super-ralph init                              Scaffold .super-ralph/ in current project
super-ralph reverse [inputs...] [--skill ...] Input -> spec (interactive or autonomous)
super-ralph decompose --spec <path>           Spec -> beads
super-ralph forward --epic <ID>               Beads -> code
super-ralph status --epic <ID>                Show bead progress for an epic
super-ralph status --run <runId|latest>       Show run artifact status
super-ralph doctor                            Preflight checks
super-ralph help                              Show all options
```

Common options for phase commands:
- `--model <provider/model>` — Override default model for all iterations
- `--max-iterations <n>` — Maximum iterations (default varies by phase)
- `--dry-run` — Show what would run without executing
- `--attach <url>` — Attach to existing OpenCode server instead of spawning one

## The Three-Phase Model

Super-ralph is a pure Ralph loop engine with three composable phases. Each phase runs the same loop — SELECT, PROMPT, EXECUTE, EVALUATE — but consumes and produces different artifacts:

### Reverse: input -> spec

```
super-ralph reverse [inputs...] [--skill ...] [--interactive] [--output <dir>]
```

Takes any combination of positional inputs (files, directories, descriptions, URLs) and produces a specification. Behavior depends on what you provide:

```bash
super-ralph reverse                                          # interactive interview
super-ralph reverse --skill feature                          # interview with feature questions
super-ralph reverse "build a calendly clone"                 # autonomous from description
super-ralph reverse ./src/ "refactor auth to use JWT"        # autonomous from code + description
super-ralph reverse mockup.png --interactive --skill feature # mixed: screenshot + interview
```

Without inputs, runs an interactive intake interview. With inputs, runs autonomously. Use `--interactive` to force an interview even with inputs. The `--skill` flag selects a question set (feature, bug, hotfix, refactor). Output goes to `tasks/` by default.

### Decompose: spec -> beads

```
super-ralph decompose --spec <path> [--epic-title <title>]
```

Takes a spec/PRD file and creates beads one at a time. Each iteration, the agent reads the spec and the beads created so far, picks the next missing piece of work, creates it via `br create`, and loops. Automatically adds review, bugscan, audit, and learning beads based on config.

### Forward: beads -> code

```
super-ralph forward --epic <ID>
```

Takes an epic ID and implements beads. Each iteration, the orchestrator selects the highest-priority ready bead, routes it to the appropriate model, and the agent implements it, runs quality gates, commits, and closes the bead. The loop exits when no ready beads remain. Review and audit beads execute automatically at their dependency-defined points.

### Composability

Each phase works standalone. They also chain:

```
super-ralph reverse ./src "rebuild auth layer" --output docs/specs/
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

## Run Artifacts and Debugging

Each phase run writes structured diagnostics under `.super-ralph/runs/<runId>/`:

- `session.json` — current state for this run (`running`, `completed`, `failed`), iteration counters, timestamps
- `events.jsonl` — newline-delimited engine events (`iteration.started`, `iteration.completed`, `loop.completed`, etc.)
- `iterations/*.log` — per-iteration transcripts with both display stream and raw event stream (when available)

The latest run state is also mirrored to `.super-ralph/session.json` for quick inspection.

Common checks during a long run:

```bash
# watch current run state
cat .super-ralph/session.json

# inspect recent events from a specific run
tail -n 30 .super-ralph/runs/<runId>/events.jsonl

# open the latest transcript
ls -1t .super-ralph/runs/<runId>/iterations | head -n 1
```

For a full artifact walkthrough, see [Run Artifacts Reference](docs/reference/run-artifacts.md).

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

The orchestrator picks the highest-priority ready bead before creating the session, so area-based routing works in all phases including forward.

## The Pipeline (End-to-End)

### Phase 1: Planning (reverse produces specs)

```bash
super-ralph reverse "add dark mode toggle" --skill feature
```

The reverse command runs intake and design. Depending on how you invoke it:

1. **Interactive** (no inputs) — Relentless interrogation: business context, technical deep-dive, learned questions. Depth scales to skill type (feature: 10-15 questions, hotfix: 1-3).
2. **Autonomous** (with inputs) — Analyzes provided files, code, descriptions, and produces a spec directly.
3. **Mixed** (inputs + `--interactive`) — Uses inputs as context, then runs the interview for refinement.

Output: a spec saved to `tasks/<name>-spec.md`.

### Phase 2: Execution (decompose + forward)

```bash
super-ralph decompose --spec tasks/<name>-spec.md
super-ralph forward --epic <ID>
```

The super-ralph CLI runs the loop engine via the OpenCode SDK. `decompose` reads the spec and autonomously creates beads. `forward` implements beads one at a time: select (priority-sorted) -> prompt -> execute -> evaluate. Review beads execute automatically at phase boundaries. Audit beads review the entire implementation at the end. The learning bead extracts lessons and updates the intake checklist for next time.

## Updating

```bash
curl -fsSL "https://raw.githubusercontent.com/mwarger/super-ralph/main/install.sh?$(date +%s)" | bash
```

The installer is idempotent: it updates the existing checkout, refreshes dependencies, and re-installs the `super-ralph` wrapper.

## Uninstalling

```bash
curl -fsSL "https://raw.githubusercontent.com/mwarger/super-ralph/main/uninstall.sh?$(date +%s)" | bash
```

This removes the managed `super-ralph` wrapper and `~/.super-ralph-cli`.

## Design Documentation

- [Three-Phase Ralph Loop Design](docs/plans/2026-02-24-three-phase-ralph-loop-design.md) — Current architecture (reverse, decompose, forward phases)
- [Run Artifacts Reference](docs/reference/run-artifacts.md) — Event logs, session state, and transcript files for debugging
- [Two-Phase Pipeline Design](docs/plans/2026-02-22-two-phase-pipeline-design.md) — Historical (superseded by three-phase model)
- [Distribution Design](docs/plans/2026-02-21-super-ralph-distribution-design.md) — How global install works
- [Original SDLC Design](docs/plans/2026-02-21-superpowers-ralph-sdlc-design.md) — Historical (superseded by two-phase pipeline)

## License

MIT
