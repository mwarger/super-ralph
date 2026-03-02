# Architecture Overview

> High-level description of the major domains, module boundaries, and
> cross-domain interaction patterns in the super-ralph agent framework.

**Source examined at commit:** `ecc95c0` (2026-02-27)

## Purpose

super-ralph is a CLI-driven orchestration framework that coordinates three
external systems — an AI coding agent (opencode), a task tracker (`br`), and
a structured intake methodology (Superpowers) — through a single configurable
runtime loop called the Ralph Loop.

The framework sits between a human operator and an AI agent. It selects work
items, renders prompts from templates, streams agent execution, and records
results. The agent itself runs inside opencode and has no direct knowledge of
the orchestration layer.

## Major Domains

The nineteen modules in `src/` fall into five domains.

### 1. CLI Entry Point

**Module:** `src/index.ts`

The CLI entry point parses arguments and dispatches to the appropriate phase
or utility command. It is the single process boundary between the operator and
the framework internals. No business logic lives here; it delegates immediately
to phase or utility functions.

**Commands dispatched:** `forward`, `decompose`, `reverse`, `init`, `status`,
`doctor`, `help`.

### 2. Phases

**Modules:** `src/forward.ts`, `src/decompose.ts`, `src/reverse.ts`

Phase modules implement the three top-level workflow commands. Each phase
constructs a `PhaseCallbacks` object (`src/types.ts`) and passes it to the
engine. The three callbacks define phase-specific behavior:

- `setup` — reads configuration, resolves work items, returns iteration count.
- `nextIteration` — selects the next item and renders a prompt.
- `handleResult` — interprets the agent's completion signal.

The phases share no code with each other. They are isolated strategy
implementations that plug into the single engine loop.

| Phase | Input | Output |
| --- | --- | --- |
| `reverse` | Free-text inputs, skill file | Markdown spec file in `docs/specs/` |
| `decompose` | Markdown spec file | beads (tasks) created via `br` CLI |
| `forward` | Epic ID (set of beads) | Committed code changes |

### 3. Engine

**Module:** `src/engine.ts`

The engine owns the generic select-prompt-execute-evaluate loop. All three
phases use the same `runPhaseLoop` function. The engine is responsible for:

- Starting or attaching to an opencode server (`src/opencode.ts`).
- Iterating until work is exhausted or a stop condition is reached.
- Applying the configured retry or failure strategy.
- Emitting typed engine events (`src/events.ts`).
- Writing run artifacts via the run tracker (`src/run-state.ts`).

The engine has no knowledge of beads, spec files, or prompt content. Those
concerns belong entirely to the phase callbacks.

### 4. Integrations

**Modules:** `src/opencode.ts`, `src/interactive.ts`, `src/beads.ts`

Integration modules wrap external services behind typed interfaces.

**opencode adapter** (`src/opencode.ts`) manages the full lifecycle of the
opencode server: spawning a process on a random port, creating sessions,
streaming prompt results over Server-Sent Events (SSE), and extracting
completion signals from session message history.

**Interactive session handler** (`src/interactive.ts`) extends the opencode
adapter for the interactive reverse mode. It intercepts `question.asked` SSE
events and renders them to the terminal using `@clack/prompts`, then sends
the operator's answers back to the agent via `question.reply`.

**bead integration** (`src/beads.ts`) wraps the `br` CLI. It spawns child
processes, parses JSON output, and returns typed `BeadInfo` objects. The
framework never reads `.beads/` files directly.

### 5. Infrastructure

**Modules:** `src/config.ts`, `src/template.ts`, `src/skills.ts`,
`src/events.ts`, `src/run-state.ts`, `src/run-status.ts`, `src/progress.ts`,
`src/output-parser.ts`, `src/timeout.ts`, `src/init.ts`, `src/types.ts`

Infrastructure modules provide cross-cutting support consumed by the engine
and phases.

| Module | Role |
| --- | --- |
| `config.ts` | Loads `.super-ralph/config.toml`, merges defaults, resolves AI models |
| `template.ts` | Loads and renders Handlebars `.hbs` prompt templates |
| `skills.ts` | Resolves skill names to Markdown question-bank content |
| `events.ts` | Defines the engine event union type and a pub/sub emitter |
| `run-state.ts` | Writes per-run artifacts: `session.json`, `events.jsonl`, transcripts |
| `run-status.ts` | Read-only companion: resolves run references and reads artifacts |
| `progress.ts` | Appends and reads Markdown progress summaries per iteration |
| `output-parser.ts` | Captures raw SSE lines and display text during agent sessions |
| `timeout.ts` | Races a promise against a deadline |
| `init.ts` | Scaffolds new projects: directories, templates, opencode plugin |
| `types.ts` | Central type definitions shared across all modules |

## Entry Points

There is one primary entry point and one secondary entry point.

**Primary:** `src/index.ts` — invoked by the shell wrapper installed by
`install.sh`. The wrapper calls `bun run ~/.super-ralph-cli/src/index.ts "$@"`.

**Secondary:** `.opencode/plugins/super-ralph.js` — loaded by the opencode
server at startup. This plugin registers the `task_complete` tool that agents
call to signal iteration completion. It is not invoked by the operator.

## Cross-Domain Interaction Boundaries

### CLI to Phase

`src/index.ts` calls a command function in the phase module (for example,
`cmdForward` in `src/forward.ts`). The call transfers control entirely;
`index.ts` only inspects the returned `LoopResult` to set the process exit
code.

### Phase to Engine

Each phase constructs a `PhaseCallbacks` literal and calls
`runPhaseLoop(projectDir, callbacks, flags)` from `src/engine.ts`. The engine
invokes the callbacks at defined points in the loop. This is the only
coupling between phase modules and the engine.

### Engine to opencode Adapter

The engine calls `startServer()` or `connectToServer()`, then
`createSession(client, title)` and `runPrompt(...)` from `src/opencode.ts`.
The adapter returns a `PromptResult` containing the agent's completion signal,
cost metadata, and token counts.

### Engine to bead Integration

Phase callbacks call functions from `src/beads.ts` (such as `getAllReady`,
`getBeadDetails`, `runBr`) to read and update task state. The engine itself
does not call `src/beads.ts` directly; only phase callbacks do.

### Agent to Orchestrator (task\_complete plugin)

The agent running inside opencode signals completion by calling the
`task_complete` tool registered by `.opencode/plugins/super-ralph.js`. After
the agent session becomes idle, the engine scans `session.messages()` for a
`task_complete` tool-call result. This is the only channel through which the
agent communicates its outcome to the orchestrator.

### Phase to Phase (filesystem)

The three phases communicate only through the filesystem and the `br` CLI.
There is no direct function call or shared in-process state between phases.

```text
reverse   -->  writes Markdown spec  -->  docs/specs/<name>.md
decompose -->  reads spec, writes beads via br  -->  .beads/
forward   -->  reads beads via br, writes code  -->  project source files
```

### Engine to Run Artifacts

After each iteration the engine writes to `.super-ralph/runs/<runId>/` via
`src/run-state.ts`. It also appends to `.super-ralph/progress.md` via
`src/progress.ts`. These files are read back by the `status` command and,
in the forward phase, by the agent as prior-iteration context.

## Configuration Boundary

Configuration is loaded once per run by `loadConfig(projectDir)` in
`src/config.ts`. The resulting `LoopConfig` object is passed through
`runPhaseLoop` to callbacks and adapter functions. No module reads
`config.toml` directly except `src/config.ts`.

## Filesystem Layout (per project)

After `super-ralph init`, a project contains the following framework-managed
directories:

```text
<project-root>/
  .super-ralph/
    config.toml          # Runtime configuration
    *.hbs                # Customizable prompt templates
    intake-checklist.md  # Accumulated intake questions
    progress.md          # Per-iteration progress log (runtime)
    session.json         # Live run state mirror (runtime)
    runs/
      <runId>/
        session.json     # Run summary
        events.jsonl     # Structured event log
        iterations/
          001-<label>.log
  .opencode/
    plugins/
      super-ralph.js     # task_complete tool plugin
  .beads/                # Managed by br CLI
  docs/specs/            # Spec files from reverse phase (default location)
```

## Open Questions

- The `--attach <url>` flag mode is confirmed in `src/engine.ts` and
  `src/opencode.ts`, but the behavior when the attached server shuts down
  externally is not fully characterized. [UNKNOWN]
