# bead Integration

> Thin adapter around the `br` CLI: spawns child processes, parses JSON
> output, and returns typed `BeadInfo` objects.

**Source:** `src/beads.ts` (examined at commit `ecc95c0` / 2026-02-27)

## Purpose

The bead integration module isolates all communication with the `br`
(beads-rust) task management CLI behind typed async functions. Every bead
operation — listing, showing, closing, counting — is implemented as a
subprocess invocation followed by JSON extraction and parsing. Callers
receive typed `BeadInfo` objects or structured summaries without needing
to know the CLI's invocation details.

## Triggers

- `getAllReady(epicId)` — called by `src/forward.ts` each iteration to pick
  the next bead.
- `getBeadDetails(beadId)` — called by `src/forward.ts` after selecting a
  ready bead.
- `closeBead(beadId, reason?)` — called by the AI agent indirectly via the
  `br close` shell command; also available to phase modules.
- `getAllBeads(epicId)` — called by `src/forward.ts:setup` to count total
  beads and by `src/decompose.ts` to list existing beads.
- `getEpicProgress(epicId)` — called by phase modules to report completion
  counts.
- `runBr(args, cwd?)` — low-level general-purpose runner used internally
  and by `src/index.ts:cmdDoctor` / `src/init.ts`.

## Inputs

| Name | Type | Source | Description |
| --- | --- | --- | --- |
| `epicId` | `string` | phase caller | bead ID of the parent epic |
| `beadId` | `string` | phase caller | bead ID of a single work item |
| `reason` | `string \| undefined` | phase caller | Optional close reason appended to the `br close` invocation |
| `args` | `string[]` | internal callers | CLI argument list passed to `br` |
| `cwd` | `string \| undefined` | internal callers | Working directory for the subprocess; defaults to `process.cwd()` |

## Outputs

| Name | Type | Destination | Description |
| --- | --- | --- | --- |
| `getAllReady` | `BeadInfo[]` | `src/forward.ts` | Unblocked ready beads sorted by hybrid priority |
| `getBeadDetails` | `BeadInfo` | `src/forward.ts` | Full details of a single bead |
| `closeBead` | `{ suggestNext: BeadInfo[] }` | phase callers | Newly unblocked beads after close |
| `getAllBeads` | `BeadInfo[]` | phase callers | All child beads of an epic |
| `getEpicProgress` | `{ total, completed, remaining }` | phase callers | Aggregate bead counts by status |
| `runBr` | `unknown` | internal callers | Parsed JSON from `br` stdout |

## Side Effects

- Spawns a `br` subprocess (via `Bun.spawn`) for every public function call.
- Throws `Error` on non-zero `br` exit codes; error message includes the
  exit code and stderr content.

## Failure Modes

| Condition | Behavior | Recovery |
| --- | --- | --- |
| `br` exits with non-zero code | Throws `Error("br <args> failed (exit N): <stderr>")` | Propagates to phase caller or Engine |
| `br` produces no JSON output | JSON parse fails; throws `SyntaxError` or `Error` | Propagates to phase caller |
| Epic has no ready beads | `getAllReady` returns `[]` | Phase module interprets empty list as loop termination |
| `br` binary not on `PATH` | `Bun.spawn` throws or `br` exits with an OS error | Caught and re-thrown by `runBr`; `doctor` command detects absence |

## Dependencies

| Dependency | Type | Purpose |
| --- | --- | --- |
| `src/types.ts` | internal | `BeadInfo` type definition |
| `Bun.spawn` | system | Spawns `br` subprocesses; reads stdout/stderr |

## Open Questions

- `runBr` filters log lines before locating JSON. The exact filter criteria
  (prefix patterns) are not documented in source comments.
- Whether `closeBead` is intended to be called by phase modules directly or
  exclusively by the AI agent via shell is not stated in source.
