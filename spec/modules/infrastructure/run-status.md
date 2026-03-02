# Run Status

> Read-only companion to Run State: resolves a run reference and reads back
> session state, event counts, and transcript paths.

**Source:** `src/run-status.ts` (examined at commit `ecc95c0` / 2026-02-27)

## Purpose

The run-status module provides the read side of the run artifact system.
It is used by the `super-ralph status` command to surface a human-readable
summary of a completed or in-progress run. It reads the files written by
`src/run-state.ts` without modifying them, and supports resolving runs by
explicit ID or by the special reference `"latest"`.

## Triggers

- `getRunStatus(projectDir, runRef)` — called by `src/index.ts:cmdStatus`
  when the `--run` flag is provided. (`src/index.ts`)

## Inputs

| Name | Type | Source | Description |
| --- | --- | --- | --- |
| `projectDir` | `string` | CLI caller | Absolute path to the project root |
| `runRef` | `string` | CLI `--run` flag | Either an explicit run ID or the string `"latest"` |

## Outputs

| Name | Type | Destination | Description |
| --- | --- | --- | --- |
| Return value | `RunStatus` | `src/index.ts:cmdStatus` | `{ runId, runDir, session, eventCount, lastEventType?, lastEventTimestamp?, latestTranscript? }` |

## Side Effects

- Reads `.super-ralph/runs/<runId>/session.json` synchronously.
- Reads `.super-ralph/runs/<runId>/events.jsonl` to count lines.
- Reads the `iterations/` subdirectory listing to find the most recent
  transcript file.
- All access is read-only; no files are created or modified.

## Failure Modes

| Condition | Behavior | Recovery |
| --- | --- | --- |
| `.super-ralph/runs/` directory does not exist | Throws descriptive `Error` | Caller (`cmdStatus`) prints error and exits |
| `runRef` does not match any run ID | Throws descriptive `Error` listing available IDs | Caller prints error and exits |
| `session.json` is missing from the resolved run directory | Throws descriptive `Error` | Caller prints error and exits |
| `events.jsonl` is missing | Event count is `0`; no error thrown [INFERRED] | Status returned with `eventCount: 0` |
| `iterations/` directory is empty | `latestTranscript` is `undefined` | Status returned without transcript path |

## Dependencies

| Dependency | Type | Purpose |
| --- | --- | --- |
| `src/types.ts` | internal | `RunSessionStatus` shape referenced in return type |
| `fs` | node | Reads run directories and artifact files synchronously |
| `path` | node | Resolves run directory paths from `projectDir` |

## Open Questions

- The exact sort order used to determine "latest" when multiple runs share
  the same timestamp prefix is not documented in source. `[UNKNOWN]`
- Whether `events.jsonl` line counting reads the entire file into memory or
  uses a streaming approach is not confirmed from source.
