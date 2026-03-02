# State Model

> Key state entities, their fields, transitions, and the modules that own them.

**Source examined at commit:** `ecc95c0` (2026-02-27)

## Overview

State in super-ralph is partitioned across three scopes:

- **In-process transient state** — lives only for the duration of a single
  `runPhaseLoop` call and is discarded when the process exits.
- **On-disk persistent state** — written to the `.super-ralph/` directory
  and survives process restarts.
- **External state** — owned by out-of-process services (the opencode server
  and the `br` CLI); super-ralph reads and mutates it only through typed
  interfaces.

---

## In-Process Transient State

### SessionState (run counters)

Defined in `src/run-state.ts:13`. A private interface maintained by the
`RunTracker` instance returned from `startRunTracker`. Its fields are:

| Field | Type | Initial value | Description |
| --- | --- | --- | --- |
| `runId` | `string` | set at construction | Unique run identifier |
| `status` | `"running" \| "completed" \| "failed"` | `"running"` | Current run lifecycle status |
| `description` | `string` | from `setup()` return | Human-readable phase description |
| `maxIterations` | `number` | from `setup()` return | Upper bound on iterations |
| `startedAt` | ISO 8601 string | construction time | When the run was created |
| `updatedAt` | ISO 8601 string | updated on each write | Timestamp of last state flush |
| `currentIteration` | `number` | `0` | Index of the iteration currently executing |
| `completed` | `number` | `0` | Count of successfully completed iterations |
| `failed` | `number` | `0` | Count of failed or error-status iterations |
| `skipped` | `number` | `0` | Count of blocked or skipped iterations |

**Mutations:** `updateFromEvent` (`src/run-state.ts:72`) maps incoming
`EngineEvent` types to counter increments:

- `iteration.started` → sets `currentIteration`
- `iteration.completed` → increments `completed`
- `iteration.blocked` → increments `skipped`
- `iteration.failed`, `iteration.error` → increments `failed`
- `loop.completed` → overwrites `completed`, `failed`, `skipped` with final
  loop totals

**Status transitions:**

```text
"running"
   |
   +-- finalize("completed")  →  "completed"   (when failed == 0)
   |
   +-- finalize("failed")     →  "failed"      (when failed > 0 or
                                                exception in loop)
```

`finalize` is called exactly once: in the engine's `finally` block
(`src/engine.ts:251`) or at the end of a successful loop
(`src/engine.ts:244`).

### Engine Loop Counters

Declared in `src/engine.ts:88–93` as plain `let`/`const` bindings:

| Binding | Type | Description |
| --- | --- | --- |
| `iteration` | `number` | Current 1-based loop counter; decremented on retry |
| `completed` | `number` | Iterations that resolved `"complete"` or `"phase_done"` |
| `failed` | `number` | Iterations that resolved as any failure status |
| `skipped` | `number` | Iterations that resolved `"blocked"` |
| `retryCount` | `Map<string, number>` | Retry attempts keyed by `iterationLabel` |
| `startTime` | `number` | `Date.now()` at loop entry; used to compute `totalTime` |

**Retry bookkeeping:** When the failure strategy is `"retry"` and
`retryCount.get(label) < max_retries`, `iteration` is decremented by one
(`src/engine.ts:183`) so the same item is selected again on the next loop
turn. The `retryCount` map is never reset within a run; retries accumulate
across the entire run, not per-phase-invocation. [CONFIRMED: `src/engine.ts`]

### IterationResult (per-iteration record)

Defined in `src/types.ts:48`. Built at the end of each iteration and pushed
to the `iterations` array:

| Field | Type | Description |
| --- | --- | --- |
| `iteration` | `number` | 1-based iteration index |
| `beadId` | `string` | bead ID or `"iter-<N>"` if no bead |
| `beadTitle` | `string` | Human-readable iteration label |
| `status` | see below | Outcome classification |
| `reason` | `string \| undefined` | Agent-provided explanation |
| `model` | `string` | `"provider/model"` string used |
| `duration` | `number` | Wall-clock milliseconds |
| `cost` | `number \| undefined` | Reported session cost |
| `tokens` | object \| undefined | `{ input, output, reasoning }` counts |
| `filesChanged` | `string[] \| undefined` | Paths modified in the session |
| `transcriptPath` | `string \| undefined` | Relative path to transcript log |

**Status values** (`src/types.ts:52`):

| Value | Meaning |
| --- | --- |
| `"complete"` | Agent signalled task done; loop continues |
| `"phase_done"` | Agent signalled all work done; loop exits |
| `"blocked"` | bead has unresolved dependencies; skipped |
| `"failed"` | Agent explicitly reported failure |
| `"stalled"` | Agent stopped producing output [INFERRED: stall detection] |
| `"timeout"` | Wall-clock deadline exceeded |
| `"error"` | Exception thrown inside iteration try-block |

### StreamCapture (session output buffer)

Defined in `src/output-parser.ts`. Holds two accumulation fields:

| Field | Max size | Description |
| --- | --- | --- |
| `raw` | 250,000 characters | Raw SSE event lines from the session |
| `display` | 250,000 characters | Rendered display text for the operator |

Both buffers are capped at 250,000 characters. [CONFIRMED: `src/output-parser.ts`]
Buffers are discarded when the session completes and the `PromptResult` is
returned to the engine.

### ServerHandle

Returned by `startServer()` or `connectToServer()` in `src/opencode.ts`.
Holds a reference to the active opencode server client and URL for the
duration of a run. Closed by `server.close()` in the engine's cleanup
function (`src/engine.ts:38`).

---

## On-Disk Persistent State

All persistent state lives under `<project-root>/.super-ralph/`.

### session.json (global latest-run pointer)

**Path:** `.super-ralph/session.json`
**Written by:** `src/run-state.ts:writeState` on every `recordEvent` call
and on `finalize`.
**Read by:** Not read by any module; intended for operator inspection.
**Format:** JSON serialization of `SessionState` with two-space indentation.

This file is overwritten (not appended) on every state change and always
reflects the most recently active run. It serves as a live mirror of
`SessionState` for external tooling and operators.

### runs/`<runId>`/session.json (per-run state)

**Path:** `.super-ralph/runs/<runId>/session.json`
**Written by:** Same as above — every `recordEvent` and `finalize`.
**Read by:** `src/run-status.ts:getRunStatus` when a run reference is
resolved.
**Format:** Identical to the global `session.json`.

This file accumulates state incrementally. Its `status` field transitions
from `"running"` to `"completed"` or `"failed"` on the final `finalize`
call.

### runs/`<runId>`/events.jsonl (append-only event log)

**Path:** `.super-ralph/runs/<runId>/events.jsonl`
**Written by:** `src/run-state.ts:recordEvent` — one line appended per event.
**Read by:** `src/run-status.ts` (line count only).
**Format:** One JSON object per line:
`{ "ts": "<ISO 8601>", "event": <EngineEvent> }`.

This is an append-only log. Each line is written synchronously with
`appendFileSync`. The file is never truncated or rewritten.

### runs/`<runId>`/iterations/`<NNN>`-`<label>`.log (transcript)

**Path:** `.super-ralph/runs/<runId>/iterations/<NNN>-<label>.log`
**Written by:** `src/run-state.ts:writeIterationTranscript` after each
iteration.
**Read by:** Operator; path surfaced by `run-status.ts` as
`latestTranscript`.
**Format:** Plain text with Markdown headings. Contains two sections:
`## Display Stream` (human-readable text) and `## Raw Event Stream` (SSE
lines), present only when the respective buffer is non-empty. The filename
zero-pads the iteration index to three digits and lowercases and
hyphen-separates the label, truncated to 80 characters
(`src/run-state.ts:30–35`).

### progress.md (iteration history)

**Path:** `.super-ralph/progress.md`
**Written by:** `src/progress.ts:appendProgress` after every iteration.
**Read by:** `src/progress.ts:readRecentProgress`, called by
`src/forward.ts` and `src/reverse.ts` in their `nextIteration` callbacks.
**Format:** Append-only Markdown. Each iteration appends one block describing
the outcome, cost, tokens, and files changed.

This file provides the agent with prior-iteration context. The forward phase
reads the last N entries and injects them into the prompt template.

---

## External State

### BeadInfo (owned by `br` CLI)

Defined in `src/types.ts:2`. super-ralph reads bead state by spawning
`br` subprocesses and parsing their JSON output. It never reads `.beads/`
files directly.

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique bead identifier |
| `title` | `string` | Short description |
| `description` | `string \| undefined` | Full task description |
| `status` | `"open" \| "in_progress" \| "closed"` | Lifecycle status |
| `labels` | `string[]` | Free-form labels; `area:<name>` prefix used for model routing |
| `priority` | `number` | 0–4 (0 = critical) |
| `dependsOn` | `string[]` | bead IDs that must close before this can start |
| `blocks` | `string[]` | bead IDs that this bead blocks |
| `type` | `string \| undefined` | `"epic"`, `"task"`, etc. |
| `parentId` | `string \| undefined` | ID of the parent epic |

**Status transitions** (driven by `br` CLI, not by super-ralph directly):

```text
"open"  →  "in_progress"  →  "closed"
```

The forward phase closes beads by calling `br close <beadId>` via
`src/beads.ts:closeBead`. The `"in_progress"` state is set by the `br`
CLI internally.

### opencode Session State (owned by opencode server)

The opencode server maintains its own in-process session store. super-ralph
creates sessions via `client.session.create(...)` and interacts with them
via the SSE stream. Session state is not accessible to super-ralph except
through the SDK methods.

---

## Module References

| Module | Role |
| --- | --- |
| [`spec/modules/infrastructure/run-state.md`](../modules/infrastructure/run-state.md) | Writes `SessionState` and all run artifacts |
| [`spec/modules/infrastructure/run-status.md`](../modules/infrastructure/run-status.md) | Reads run artifacts for the `status` command |
| [`spec/modules/infrastructure/progress.md`](../modules/infrastructure/progress.md) | Manages `progress.md` reads and writes |
| [`spec/modules/engine/engine.md`](../modules/engine/engine.md) | Owns engine loop counters and `IterationResult` construction |
| [`spec/modules/infrastructure/types.md`](../modules/infrastructure/types.md) | Defines `BeadInfo`, `IterationResult`, `LoopResult`, `CompletionResult` |
| [`spec/modules/integrations/beads.md`](../modules/integrations/beads.md) | Reads and mutates `BeadInfo` via `br` CLI |
| [`spec/modules/integrations/opencode.md`](../modules/integrations/opencode.md) | Manages `StreamCapture` and `ServerHandle` |

## Open Questions

- The exact behavior when `retryCount` reaches `max_retries` on the same
  label in a subsequent call to the same phase is unconfirmed; the map is
  local to the `runPhaseLoop` call and does not persist. [INFERRED]
- The distinction between `"stalled"` and `"timeout"` status values is not
  documented in `src/types.ts` comments. [UNKNOWN]
