# Engine

> Implements the generic iteration loop shared by all three phases: server
> startup, prompt dispatch, result classification, retry/skip/abort strategy,
> event emission, progress logging, and run artifact tracking.

**Source:** `src/engine.ts` (examined at commit `ecc95c0` / 2026-02-27)

## Purpose

The Engine is the single orchestration core of the framework. All three
phases (Forward, Decompose, Reverse-autonomous) delegate their looping
behavior here via `runPhaseLoop`. The Engine enforces iteration limits,
applies error strategy, manages the opencode server lifecycle, and writes
structured run artifacts. Phase-specific logic is injected through the
`PhaseCallbacks` interface.

## Triggers

- Called by `src/forward.ts`, `src/decompose.ts`, and `src/reverse.ts` via
  `runPhaseLoop(projectDir, callbacks, flags, onEvent?)`.
  (`src/engine.ts:runPhaseLoop`)

## Inputs

| Name | Type | Source | Description |
| --- | --- | --- | --- |
| `projectDir` | `string` | phase caller | Absolute path to the project root |
| `callbacks` | `PhaseCallbacks` | phase caller | `setup`, `nextIteration`, `handleResult` implementations |
| `flags` | `PhaseFlags` | CLI parser | `dryRun`, `maxIterations?`, `modelOverride?`, `attach?` |
| `onEvent` | `EngineEventListener \| undefined` | phase caller | Optional additional event subscriber |
| `config` | `LoopConfig` | `src/config.ts` | Engine-level settings: `timeout_minutes`, `inactivity_timeout_seconds`, `iteration_delay_ms`, `strategy`, `max_retries` |
| `PhaseIteration` | object | `callbacks.nextIteration` | Per-iteration data: `prompt`, `model`, `sessionTitle`, `iterationLabel`, `beadId?`, `systemPrompt?` |

## Outputs

| Name | Type | Destination | Description |
| --- | --- | --- | --- |
| Return value | `LoopResult` | phase caller | `{ completed, failed, skipped, totalTime, maxIterations, iterations[] }` |
| Run artifacts | side effect | `.super-ralph/runs/` | Per-run directory with `session.json`, `events.jsonl`, iteration transcripts |
| Progress log | side effect | `.super-ralph/progress.md` | One Markdown block appended per completed iteration |
| Engine events | side effect | `EngineEventEmitter` | Typed events emitted at each lifecycle milestone |

## Side Effects

- Creates and manages a `RunTracker` (via `src/run-state.ts`) for the
  entire run: creates the run directory, writes `session.json` and
  `events.jsonl` on each event, writes per-iteration transcript files.
- Appends one progress block to `.super-ralph/progress.md` per iteration
  via `src/progress.ts`.
- Spawns an opencode server (via `src/opencode.ts`) unless `flags.attach`
  is set, in which case it connects to an existing server.
- Emits typed `EngineEvent` values to all registered listeners at each
  lifecycle milestone.
- Sleeps for `iteration_delay_ms` milliseconds between iterations.
- In dry-run mode: iterates `nextIteration()` without running AI, emits
  `loop.dry_run_iteration` events, and returns immediately.

## Failure Modes

| Condition | Behavior | Recovery |
| --- | --- | --- |
| `setup()` throws | Error propagates to caller; no run directory created | Phase caller handles exception |
| `nextIteration()` returns `null` | Loop exits cleanly; `finalize` is called | Normal termination |
| Iteration completes with `failed`/`error`/`timeout` + `retry` strategy | Iteration counter is decremented; same bead is retried up to `max_retries` times | Automatic retry without user intervention |
| Iteration completes with failure + `abort` strategy | Loop breaks immediately after calling `finalize` | Caller receives partial `LoopResult` |
| Iteration completes with failure + `skip` strategy (default) | `failed` counter incremented; loop continues to next iteration | Next bead is attempted |
| Wall-clock timeout (`timeout_minutes`) elapsed | `withTimeout` rejects with a descriptive error message | Counted as a failed iteration; error strategy applied |
| opencode server fails to start | Exception propagates from `startServer`; `finalize` is called in `finally` block | Run is marked failed |

## Dependencies

| Dependency | Type | Purpose |
| --- | --- | --- |
| `src/config.ts` | internal | Loads `LoopConfig`; provides engine-level knobs |
| `src/opencode.ts` | internal | Starts or connects to the opencode server; runs prompts |
| `src/progress.ts` | internal | Appends iteration results to `progress.md` |
| `src/events.ts` | internal | `EngineEventEmitter` and `attachDefaultConsoleRenderer` |
| `src/run-state.ts` | internal | `startRunTracker`; manages run artifact directory |
| `src/timeout.ts` | internal | `withTimeout`; enforces per-iteration wall-clock deadline |
| `src/types.ts` | internal | `LoopResult`, `PhaseFlags`, `IterationResult`, `ErrorStrategy` |

## Open Questions

- The retry counter's exact bookkeeping (whether it resets per bead or is
  global across the run) is not explicitly documented in source.
- The `iteration_delay_ms` sleep is applied unconditionally between
  iterations, including after the last one. Whether this is intentional
  is not determinable from source alone.
