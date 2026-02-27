# Run Artifacts Reference

Super-ralph writes run-level artifacts so long executions are observable and diagnosable.

## Location

Each loop run creates a unique directory:

`.super-ralph/runs/<runId>/`

It also mirrors the latest session state to:

`.super-ralph/session.json`

## Files

### `session.json`

Run state snapshot. Contains:

- `runId`
- `status` (`running`, `completed`, `failed`)
- `description`
- `maxIterations`
- `startedAt`, `updatedAt`
- `currentIteration`
- `completed`, `failed`, `skipped`

This file is updated as events arrive.

### `events.jsonl`

Newline-delimited JSON event stream for the run.

Each line has:

- `ts` — event timestamp
- `event` — structured engine event payload

Common event types:

- `loop.description`
- `server.started`, `server.attached`, `server.attach_hint`
- `iteration.started`, `iteration.session_created`
- `iteration.completed`, `iteration.blocked`, `iteration.retrying`, `iteration.failed`, `iteration.error`
- `loop.completed`

### `iterations/*.log`

Per-iteration transcript files named like:

`001-create-auth-middleware.log`

When available, each transcript contains:

- `Display Stream` — what users saw in real-time
- `Raw Event Stream` — raw stream lines captured from OpenCode events

Transcript file paths are also recorded in `.super-ralph/progress.md` entries.

## Typical Debug Flow

1. Open `.super-ralph/session.json` to verify whether the run is still moving.
2. Inspect `events.jsonl` for the last emitted event and completion reason.
3. Open the latest `iterations/*.log` to understand what happened inside the last iteration.

## Notes

- Transcript writing is best-effort: if neither raw nor display stream is captured, no transcript file is created for that iteration.
- Run IDs are generated per execution and include a timestamp prefix.
