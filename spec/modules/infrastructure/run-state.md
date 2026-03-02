# Run State

> Persists per-run artifacts: timestamped run directory, live `session.json`,
> jsonl event log, and per-iteration transcripts.

**Source:** `src/run-state.ts` (examined at commit `ecc95c0` / 2026-02-27)

## Purpose

The run-state module creates and maintains the file-based record of a single
engine run. It is the write side of the run artifact system; `src/run-status.ts`
is the corresponding read side. A `RunTracker` instance is created at the
start of each engine run and holds the run directory open for the duration,
flushing state after every event and appending event records to an append-only
jsonl log.

## Triggers

- `startRunTracker(projectDir, description, maxIterations)` — called by the
  Engine at the beginning of every run. (`src/engine.ts`)
- `RunTracker.recordEvent(event)` — called by the Engine each time an
  `EngineEvent` is emitted.
- `RunTracker.writeIterationTranscript(iteration, label, rawOutput?,
  displayOutput?)` — called by the Engine after each iteration completes.
- `RunTracker.finalize(status)` — called by the Engine in its `finally`
  block when the run ends.

## Inputs

| Name | Type | Source | Description |
| --- | --- | --- | --- |
| `projectDir` | `string` | Engine | Absolute path to the project root |
| `description` | `string` | phase `setup` return | Human-readable description of the run |
| `maxIterations` | `number` | phase `setup` return | Upper bound on iterations for this run |
| `event` | `EngineEvent` | Engine event emitter | Typed engine lifecycle event to record |
| `iteration` | `number` | Engine | Iteration index (1-based) |
| `label` | `string` | Engine | Short label identifying the iteration (e.g., bead ID or title) |
| `rawOutput` | `string \| undefined` | `src/output-parser.ts` | Raw JSON event log from the session |
| `displayOutput` | `string \| undefined` | `src/output-parser.ts` | Human-readable session transcript |
| `status` | `string` | Engine | Final run status string written to `session.json` |

## Outputs

| Name | Type | Destination | Description |
| --- | --- | --- | --- |
| `startRunTracker` return | `RunTracker` | Engine | Handle with `runId`, `runDir`, and the four tracker methods |

## Side Effects

- Creates `.super-ralph/runs/<runId>/` directory and `iterations/`
  subdirectory on construction.
- Writes `.super-ralph/runs/<runId>/session.json` (full JSON state) after
  every `recordEvent` call and after `finalize`.
- Writes `.super-ralph/session.json` (global latest-run pointer) after
  every `recordEvent` call and after `finalize`.
- Appends one JSON line to `.super-ralph/runs/<runId>/events.jsonl` for
  each `recordEvent` call.
- Writes `.super-ralph/runs/<runId>/iterations/<NNN>-<label>.log` for each
  `writeIterationTranscript` call.

## Failure Modes

| Condition | Behavior | Recovery |
| --- | --- | --- |
| File system write fails | Exception propagates from the synchronous `fs.writeFileSync` call | Engine's `finally` block may not complete cleanly; artifacts are partially written |
| `startRunTracker` called when `.super-ralph/` does not exist | `fs.mkdirSync` creates the full path (recursive) | No error; directories are created on demand |

## Dependencies

| Dependency | Type | Purpose |
| --- | --- | --- |
| `src/events.ts` | internal | `EngineEvent` type used in `recordEvent` parameter |
| `fs` | node | All file creation, writing, and directory operations |
| `path` | node | Constructs paths within the run directory |

## Open Questions

- The run ID format (`"<timestamp>-<random6chars>"`) uses a timestamp and
  random suffix. The clock source and entropy source for the random component
  are not documented in source.
- Whether `writeIterationTranscript` writes `rawOutput`, `displayOutput`,
  or both to the same file or separate files is not explicitly stated in
  observable source comments.
