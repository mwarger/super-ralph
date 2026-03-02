# Runtime Lifecycle

> Description of how super-ralph initializes, executes the steady-state loop,
> and shuts down for each phase invocation.

**Source examined at commit:** `ecc95c0` (2026-02-27)

## Overview

Every phase invocation (`reverse`, `decompose`, `forward`) follows the same
runtime lifecycle managed by `runPhaseLoop` in `src/engine.ts`. The lifecycle
has three stages:

1. **Initialization** — load configuration, create run artifacts, start server.
2. **Steady-state loop** — iterate: select, prompt, execute, evaluate.
3. **Shutdown** — finalize artifacts, close server, detach listeners.

The lifecycle is the same regardless of which phase runs. Phase-specific
behavior is injected through the `PhaseCallbacks` interface
(`src/engine.ts:18`).

---

## Stage 1: Initialization

### 1.1 CLI Dispatch

The operator invokes `super-ralph <phase> [flags]`. The shell wrapper calls
`bun run src/index.ts "$@"`. Argument parsing in `src/index.ts` produces a
`ParsedArgs` object (`command`, `positionals`, `flags`). Control transfers
to the phase command function (e.g., `cmdForward` in `src/forward.ts`).

### 1.2 Phase Setup

The phase command function calls `runPhaseLoop(projectDir, callbacks, flags)`.

Inside `runPhaseLoop` (`src/engine.ts:24`):

1. An `EngineEventEmitter` is created (`src/engine.ts:30`).
2. A console renderer is attached (`attachDefaultConsoleRenderer`,
   `src/engine.ts:31`). This listener writes events to stdout.
3. An optional external listener is attached if `onEvent` is provided
   (`src/engine.ts:32`). Used for testing and TUI integration.
4. Configuration is loaded: `loadConfig(projectDir)` (`src/engine.ts:44`).
   This reads `.super-ralph/config.toml`, merges defaults, and returns a
   `LoopConfig` object.
5. `callbacks.setup(config, dryRun)` is called (`src/engine.ts:46`). The
   phase determines `maxIterations` and `description`.
6. A `RunTracker` is created: `startRunTracker(projectDir, description,
   maxIterations)` (`src/engine.ts:48`). This creates the run directory at
   `.super-ralph/runs/<runId>/` and writes an initial `session.json`.
7. The tracker's event listener is attached (`src/engine.ts:49`).

### 1.3 Server Start

If `flags.dryRun` is set, server startup is skipped entirely
(`src/engine.ts:55`).

Otherwise:

- If `flags.attach` is set: `connectToServer(url)` wraps an existing
  opencode server (`src/engine.ts:80`). The `server.attached` event is
  emitted.
- Otherwise: `startServer()` spawns a new opencode process on a random
  port (`src/engine.ts:83`). The `server.started` and `server.attach_hint`
  events are emitted.

`startServer` is implemented in `src/opencode.ts`. It calls
`createOpencode({ port: 0 })` from the opencode SDK, then verifies the server
is responsive by calling `client.session.list()`.

---

## Stage 2: Steady-State Loop

The main loop runs while `iteration < maxIterations` (`src/engine.ts:96`).

### 2.1 Work Selection

`callbacks.nextIteration(config, iteration + 1)` is called
(`src/engine.ts:97`). The phase implementation selects the next unit of work
and returns a `PhaseIteration` object containing:

- `prompt` — the rendered Handlebars template.
- `model` — resolved `{ providerID, modelID }`.
- `sessionTitle` — displayed in the opencode session list.
- `iterationLabel` — used for transcript filenames and event labels.
- `beadId` (optional) — the bead being worked on.
- `systemPrompt` (optional) — injected as the system message.

If `nextIteration` returns `null`, the loop exits (`src/engine.ts:98`). This
is the normal termination path: no more work remains.

### 2.2 Session Creation

`createSession(server.client, sessionTitle)` creates a new opencode session
(`src/engine.ts:112`). Each iteration gets a fresh context window; no session
state carries over between iterations.

### 2.3 Prompt Execution

`runPrompt(client, sessionId, prompt, model, systemPrompt, serverUrl,
inactivityTimeoutMs)` is called inside `withTimeout(...)` (`src/engine.ts:
117`). Two timeout guards are active simultaneously:

- **Hard timeout:** `withTimeout` rejects after
  `config.engine.timeout_minutes * 60 * 1000` milliseconds (`src/engine.ts:
  115`). This is an absolute wall-clock limit per iteration.
- **Inactivity timeout:** Inside `runPrompt`, a watchdog fires every ten
  seconds. If no SSE event has arrived for
  `config.engine.inactivity_timeout_seconds` seconds, the session is aborted
  (`src/opencode.ts`).

`runPrompt` opens an SSE event stream via the opencode SDK v2 client, sends
the prompt, and processes events until the session becomes idle:

- `message.part.delta` — streams text to stdout via `StreamCapture`.
- `message.part.updated` — displays tool-call status lines.
- `session.idle` — normal completion; exits the event loop.
- `session.error` — error completion; exits the event loop.

After the event loop exits, `runPrompt` reads `session.messages()` to locate
the `task_complete` tool-call result. This becomes the `CompletionResult`
(`status`, `reason`). Cost and token metadata are also extracted.

`runPrompt` returns a `PromptResult` (`src/opencode.ts`).

### 2.4 Artifact Recording

After `runPrompt` returns (`src/engine.ts:138`):

1. `runTracker.writeIterationTranscript(...)` writes raw SSE lines and
   display text to `.super-ralph/runs/<runId>/iterations/<N>-<label>.log`.
2. `appendProgress(projectDir, iteration, iterResult)` appends a summary
   entry to `.super-ralph/progress.md`.

### 2.5 Result Evaluation

`callbacks.handleResult(result, iteration)` is called (`src/engine.ts:151`).
The phase returns `true` to continue or `false` to stop the loop.

The engine then applies the result status:

| Status | Counter | Action |
| --- | --- | --- |
| `complete` or `phase_done` | `completed++` | emit `iteration.completed`, continue |
| `blocked` | `skipped++` | emit `iteration.blocked`, continue |
| `failed`, `stalled`, `timeout`, `error` | see below | apply strategy |

**Failure strategy** (`src/engine.ts:172`):

- `retry` (default): if `retryCount < config.engine.max_retries`, decrement
  `iteration` and re-run the same work item on the next pass. Retry counts
  are tracked per `iterationLabel`.
- `abort`: increment `failed`, emit `iteration.failed` with
  `action: "aborting"`, break the loop.
- `skip`: increment `failed`, emit `iteration.failed` with
  `action: "skipping"`, continue to the next item.

If `handleResult` returned `false`, the loop exits after applying the result
(`src/engine.ts:206`).

### 2.6 Inter-iteration Delay

If `config.engine.iteration_delay_ms > 0`, the engine sleeps before the next
iteration (`src/engine.ts:231`). Default is 2000 ms.

---

## Primary Runtime Path: Sequence Diagram

The following diagram shows a single successful iteration in the forward phase.
Steady-state loops repeat steps 3 through 12 until no beads remain.

```text
Operator         index.ts         engine.ts        opencode.ts        br CLI
   |                |                 |                  |               |
   |-- super-ralph forward ---------->|                  |               |
   |                |-- cmdForward -->|                  |               |
   |                |                |-- loadConfig ---->|               |
   |                |                |-- setup() ------->|               |
   |                |                |  [callbacks.setup calls br ready] |
   |                |                |<-----------------------------------br ready
   |                |                |-- startServer() ->|               |
   |                |                |<-- ServerHandle --|               |
   |                |                |                  |               |
   |             [loop begins]       |                  |               |
   |                |                |-- nextIteration()->              |
   |                |                |  [calls br ready, br show]       |
   |                |                |<---------------------------------br
   |                |                |-- createSession()->|             |
   |                |                |<-- sessionId ------|             |
   |                |                |-- runPrompt() ---->|             |
   |                |                |  [SSE stream open] |             |
   |<-- text output ----------------[streaming text]------             |
   |                |                |  [session.idle]    |             |
   |                |                |-- session.messages()-->|         |
   |                |                |<-- task_complete result          |
   |                |                |-- writeTranscript()              |
   |                |                |-- appendProgress()               |
   |                |                |-- handleResult()  |             |
   |             [loop repeats or exits]                 |             |
   |                |                |-- loop.completed  |             |
   |                |                |-- finalize()      |             |
   |                |                |-- server.close() ->|            |
   |<-- exit code --|                |                  |              |
```

---

## Stage 3: Shutdown

Shutdown is handled in the `finally` block of `runPhaseLoop`
(`src/engine.ts:248`).

### 3.1 Normal Shutdown

After the loop exits or `nextIteration` returns `null`:

1. The `loop.completed` event is emitted with totals (`src/engine.ts:236`).
2. `runTracker.finalize("completed")` or `runTracker.finalize("failed")` is
   called depending on whether `failed > 0` (`src/engine.ts:244`).
3. The `finally` block runs: the tracker listener is detached
   (`src/engine.ts:249`), and `cleanup()` closes the server and detaches
   console and external listeners (`src/engine.ts:36`).

### 3.2 Error Shutdown

If an uncaught exception exits the `try` block before `finalize` is called,
the `finally` block checks `!finalized` and calls
`runTracker.finalize("failed")` (`src/engine.ts:250`). The server is always
closed in `cleanup()`.

### 3.3 Dry-Run Shutdown

In dry-run mode, the engine iterates `nextIteration` without executing
prompts, emits `loop.dry_run_iteration` per item, then calls
`runTracker.finalize("completed")` and returns early (`src/engine.ts:74`).
The server is never started. The `finally` block still runs to detach
listeners.

### 3.4 Exit Code

`runPhaseLoop` returns a `LoopResult`. If `result.failed > 0`, the phase
command function calls `process.exit(1)` (`src/index.ts`).

---

## Initialization Sequence: super-ralph init

`super-ralph init` has a different lifecycle from phase commands. It does not
run a loop. `runInit(projectDir)` in `src/init.ts`:

1. Creates `.super-ralph/` directory.
2. Copies five template files from the CLI's `templates/` directory, skipping
   any that already exist.
3. Writes `.super-ralph/config.toml` with auto-detected `cli.path`.
4. Installs `.opencode/plugins/super-ralph.js` (the `task_complete` plugin)
   and runs `bun install` in `.opencode/`.
5. Creates `tasks/` directory.
6. Runs `br init` if `.beads/` does not exist.
7. Creates or appends to `AGENTS.md` to reference `.super-ralph/AGENTS.md`.

`init` does not start an opencode server and writes no run artifacts.

---

## Configuration Values That Govern Lifecycle

All values are loaded from `.super-ralph/config.toml` via `src/config.ts`.

| Key | Default | Effect |
| --- | --- | --- |
| `engine.timeout_minutes` | 30 | Hard wall-clock limit per iteration |
| `engine.inactivity_timeout_seconds` | 180 | Max seconds with no SSE events |
| `engine.iteration_delay_ms` | 2000 | Sleep between iterations |
| `engine.strategy` | `retry` | Failure handling: `retry`, `skip`, or `abort` |
| `engine.max_retries` | 3 | Maximum retries per item when `strategy=retry` |

---

## Open Questions

- The behavior when `connectToServer` is called with a URL pointing to a
  server that goes offline mid-run is not fully characterized. [UNKNOWN]
- Whether `session.abort()` in `src/opencode.ts` is reliably honored by the
  opencode SDK during inactivity timeout is not confirmed. [INFERRED]
