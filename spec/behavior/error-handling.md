# Error Handling

> Error classes, user-visible failure outcomes, retry and recovery behavior,
> and negative-path scenarios for each core workflow.

**Source examined at commit:** `ecc95c0` (2026-02-27)

## Purpose

This document describes how super-ralph classifies, surfaces, and responds to
errors across all phases and infrastructure components. It covers:

- The taxonomy of error and completion status values used throughout the system
- The three engine-level failure strategies and how they govern loop behavior
- Timeout and inactivity mechanisms
- Per-workflow negative-path scenarios
- Observable operator-visible outcomes for each failure class

For the normal-path behavior of each workflow see
[`spec/workflows/core-workflows.md`](../workflows/core-workflows.md).
For state field definitions see
[`spec/behavior/state-model.md`](state-model.md).

---

## Error Status Taxonomy

### CompletionResult.status

Defined in `src/types.ts:64`. Every iteration resolves to one of the
following status values. The engine uses these to decide whether to retry,
skip, abort, or continue the loop.

| Status | Source | Meaning |
| --- | --- | --- |
| `complete` | Agent via `task_complete` | Iteration finished; loop continues |
| `phase_done` | Agent via `task_complete` | All phase work done; loop exits |
| `blocked` | Agent via `task_complete` | Work item has unresolved dependencies; skip it |
| `failed` | Agent via `task_complete` | Agent explicitly reports it could not finish |
| `stalled` | Engine (default fallback) | Session ended without calling `task_complete` |
| `timeout` | Engine via `withTimeout` | Wall-clock deadline exceeded |
| `error` | Engine (exception catch) | Exception thrown inside the iteration try-block |

The `stalled`, `timeout`, and `error` statuses are set by the engine, not by
the agent. `complete`, `phase_done`, `blocked`, and `failed` are set by the
agent by calling the `task_complete` tool. [CONFIRMED: `src/types.ts:64`,
`src/engine.ts:208–228`, `src/opencode.ts:285–288`]

### SessionState.status

Defined in `src/run-state.ts:14`. The run-level lifecycle status written to
`session.json`:

| Status | Meaning |
| --- | --- |
| `running` | A phase loop is currently executing |
| `completed` | Loop finished with `failed == 0` |
| `failed` | Loop finished with `failed > 0` or an uncaught exception |

`finalize` is called exactly once per run, in the engine's `finally` block
(`src/engine.ts:248–252`). [CONFIRMED: `src/engine.ts`]

### BeadInfo.status

Defined in `src/types.ts:6`. Owned by the `br` CLI; super-ralph reads it but
does not set it directly:

| Status | Meaning |
| --- | --- |
| `open` | Not yet started |
| `in_progress` | Currently being worked on |
| `closed` | Completed |

Unknown status strings from `br` output default to `open`. [CONFIRMED:
`src/beads.ts:49–62`]

---

## Failure Strategies

Configured by `engine.strategy` in `.super-ralph/config.toml`. Default is
`retry`. The strategy is read from config once at loop start and applied
uniformly to all failure statuses (`failed`, `stalled`, `timeout`, `error`)
throughout the run. [CONFIRMED: `src/types.ts:103`, `src/engine.ts:173–203`]

### retry (default)

When an iteration resolves to a failure status and
`retryCount.get(iterationLabel) < engine.max_retries` (default: 3):

1. `retryCount` for the label is incremented.
2. The loop counter `iteration` is decremented by one, causing the same item
   to be selected again on the next pass.
3. An `iteration.retrying` event is emitted with the attempt number and
   maximum retry count.

When retry attempts are exhausted, the iteration falls through to `skip`
behavior: `failed` is incremented and the loop continues to the next item.
[CONFIRMED: `src/engine.ts:172–203`]

The `retryCount` map is local to each `runPhaseLoop` call and does not
persist across separate phase invocations. [INFERRED: `src/engine.ts:93`]

### skip

On any failure status (or when retry is exhausted):

1. `failed` counter is incremented.
2. An `iteration.failed` event is emitted with `action: "skipping"`.
3. The loop continues to the next iteration.

The failed item is not retried. The loop exits normally only when all items
are exhausted or `maxIterations` is reached. [CONFIRMED: `src/engine.ts:194–203`]

### abort

On any failure status:

1. `failed` counter is incremented.
2. An `iteration.failed` event is emitted with `action: "aborting"`.
3. The loop exits immediately via `break`.
4. The run is finalized as `failed`.

No further iterations are attempted after the first failure. [CONFIRMED:
`src/engine.ts:184–193`]

---

## Timeout Mechanisms

Two independent timeout mechanisms operate on every agent session. They are
independent; either can fire first.

### Hard wall-clock timeout

Implemented in `src/timeout.ts` via `withTimeout`. Every call to
`runPrompt(...)` is wrapped:

```text
withTimeout(runPrompt(...), timeoutMs, "Iteration timed out after Nm")
```

`timeoutMs` is `engine.timeout_minutes * 60 * 1000` (default: 30 minutes).
[CONFIRMED: `src/engine.ts:115–121`]

When the deadline passes, `withTimeout` rejects the promise with a
descriptive `Error`. The engine's iteration `catch` block catches this,
records the iteration as `status: "error"` with the timeout message as
`reason`, and applies the configured failure strategy.
[CONFIRMED: `src/engine.ts:208–228`]

**User-visible outcome:** The timeout message is printed to stderr as part of
the `iteration.error` event output. The transcript for the timed-out
iteration is written with whatever output was captured before the deadline.

### Inactivity watchdog

Implemented inside `runPrompt` in `src/opencode.ts:163–187`. A polling loop
races `iterator.next()` against a 10-second tick timer. If no SSE event
arrives within `inactivityTimeoutMs` (default: 180 seconds,
`engine.inactivity_timeout_seconds`), the watchdog throws:

```text
Session inactive for Ns
```

Before re-throwing, a best-effort `session.abort()` call is made on the
opencode session to prevent orphaned sessions from continuing to consume API
tokens. The abort call failure is silently ignored.
[CONFIRMED: `src/opencode.ts:266–274`]

A heartbeat message is printed to stdout every 30 seconds while waiting:

```text
[heartbeat] session active, waiting for events (Ns idle)
```

**User-visible outcome:** The error propagates to the engine's iteration
catch block. The iteration is recorded as `status: "error"`. The failure
strategy is applied.

---

## Thrown Errors by Component

### src/opencode.ts

| Condition | Error message | Recovery |
| --- | --- | --- |
| opencode server starts but `session.list()` fails | `OpenCode server started but not responding: <detail>` | Server is closed; exception propagates to caller; run aborts |
| `--attach` URL unreachable | `Cannot connect to OpenCode server at <url>: <detail>` | Exception propagates to caller; run aborts |
| `client.session.create` returns no data | `Failed to create session` | Exception caught by engine iteration catch; strategy applied |
| No SSE events for `inactivity_timeout_seconds` | `Session inactive for Ns` | Best-effort session abort; exception caught by iteration catch; strategy applied |

### src/beads.ts

| Condition | Error message | Recovery |
| --- | --- | --- |
| `br` subprocess exits non-zero | `br <args> failed (exit <N>): <stderr>` | Exception propagates to caller; in engine context, caught by iteration catch; strategy applied |

### src/decompose.ts

| Condition | Error message | Recovery |
| --- | --- | --- |
| `--spec` file not found | `Spec file not found: <path>` | Thrown before loop starts; run aborts; exit code `1` |

### src/config.ts

| Condition | Error message | Recovery |
| --- | --- | --- |
| Model string lacks a `/` separator | `Invalid model format "<value>" — expected "provider/model"` | Thrown at model resolution time; propagates to iteration catch or aborts run startup |

### src/timeout.ts

| Condition | Error message | Recovery |
| --- | --- | --- |
| Deadline exceeded | Message passed by caller (e.g., `Iteration timed out after 30m`) | Exception caught by engine iteration catch; strategy applied |

---

## Per-Workflow Negative-Path Scenarios

### WF-01: Project Initialization (`super-ralph init`)

#### Scenario: `bun` not on PATH

The operator runs `super-ralph init` on a machine where `bun` is not
installed.

1. `src/init.ts` reaches the step that runs `bun install` inside `.opencode/`.
2. The child process spawn fails or exits non-zero.
3. The error is printed to stderr.
4. The opencode plugin is not installed; `task_complete` will not be
   registered in subsequent phase runs.

**Observable outcome:** Error message on stderr. `.opencode/plugins/` is
absent or incomplete. Subsequent `forward`, `decompose`, or `reverse` runs
will always produce `stalled` results because the agent cannot call
`task_complete`.

**Assumption:** The operator must install `bun` and re-run `super-ralph init`
to recover. [ASSUMED]

---

### WF-02: Spec Generation (`super-ralph reverse`)

#### Scenario: Agent never calls `task_complete`

The operator runs `super-ralph reverse --interactive`. The agent asks
questions and writes a spec, but does not call `task_complete` before the
session goes idle.

1. `runPrompt` streams the session until `session.idle` fires
   (`src/opencode.ts:239`).
2. `extractCompletion` scans session messages and finds no `task_complete`
   tool call.
3. `CompletionResult` defaults to `{ status: "stalled", reason: "Session
   completed without calling task_complete" }`.
4. The engine applies the configured failure strategy.

**Observable outcome:** Iteration is recorded as `stalled`. With strategy
`retry`, the same session re-runs up to `max_retries` times. With `abort`,
the run exits immediately with code `1`. With `skip`, the loop continues to
the next iteration (or exits if `maxIterations` is reached). [CONFIRMED:
`src/opencode.ts:285–288`, `src/engine.ts:170–203`]

---

### WF-03: Spec Decomposition (`super-ralph decompose`)

#### Scenario: `br create` fails during epic creation

The operator runs `super-ralph decompose --spec docs/specs/foo.md` but the
`br` CLI is not on `PATH`.

1. `src/decompose.ts` calls `runBr(["create", "--type", "epic", ...])`.
2. The spawn fails or exits non-zero.
3. `runBr` throws `br create --type epic failed (exit N): <stderr>`.
4. The exception propagates before the loop starts.
5. The run is finalized as `failed` in the engine's `finally` block.

**Observable outcome:** Error message on stderr. No epic is created in
`.beads/`. No iterations run. Exit code `1`. [CONFIRMED: `src/beads.ts:16`,
`src/engine.ts:248–252`]

---

### WF-04: Implementation (`super-ralph forward`)

#### Scenario: Agent times out while implementing a bead

The operator runs `super-ralph forward --epic E-001`. During iteration 3,
the agent issues a long-running shell command and produces no SSE output for
longer than `inactivity_timeout_seconds` (default: 180 seconds).

1. The inactivity watchdog in `runPrompt` detects that no SSE event has
   arrived in 180 seconds and throws `Session inactive for 180s`.
2. A best-effort `session.abort()` is called on the opencode session.
3. The exception propagates out of `runPrompt` and `withTimeout`.
4. The engine's iteration `catch` block records the iteration as
   `status: "error"` with `reason: "Session inactive for 180s"`.
5. The failure strategy is applied. With `retry` (default), the bead is
   retried up to `max_retries` times.
6. The transcript for the failed iteration is written with whatever output
   was captured before the timeout.

**Observable outcome:** Error message printed to stdout (via `iteration.error`
event). The bead remains open in `.beads/`. Run continues if strategy is `retry`
or `skip`. With `abort`, the run exits with code `1` and remaining beads are
not processed. [CONFIRMED: `src/opencode.ts:177–178`, `src/engine.ts:208–228`]

---

### WF-05: Run Status (`super-ralph status`)

#### Scenario: Referenced run ID does not exist

The operator runs `super-ralph status --run 1234567890-abc` but no such run
directory exists under `.super-ralph/runs/`.

1. `src/run-status.ts:getRunStatus` attempts to resolve the run ID.
2. No matching directory is found.
3. An error is thrown and printed to stderr.

**Observable outcome:** Error on stderr. Exit code `1`. No files are
modified. [CONFIRMED: `src/run-status.ts` — behavior inferred from structure]

---

### WF-06: Environment Validation (`super-ralph doctor`)

#### Scenario: Broken plugin symlink causes opencode startup failure

The operator runs a phase command on a machine where a prior project's
opencode plugin left a dangling symlink in `~/.config/opencode/plugins/`.

1. `startServer()` in `src/opencode.ts:75` calls
   `checkBrokenSymlinks({ fix: true })` before spawning the server.
2. The broken symlink is detected and removed automatically.
3. A message is printed: `Fixed N broken symlink(s) in ~/.config/opencode/`.
4. Server startup proceeds normally.

**Observable outcome:** Broken symlinks are repaired transparently. The
operator may notice the `Fixed N broken symlink(s)` message but the run is
not interrupted. [CONFIRMED: `src/opencode.ts:74–78`]

#### Scenario: `super-ralph doctor` finds broken symlink without `--fix`

1. `doctor` runs `checkBrokenSymlinks({ fix: false })`.
2. The broken path is added to the `broken` array.
3. The check is printed as failed.
4. Exit code `1`.

The operator must re-run `super-ralph doctor --fix` or manually remove the
symlink to repair the environment. [CONFIRMED: `src/opencode.ts:31–69`]

---

### WF-07: Agent Completion Signaling (`task_complete` tool)

#### Scenario: Plugin not installed

The operator initializes a project but the `bun install` step during init
failed, leaving `.opencode/plugins/super-ralph.js` absent.

1. The opencode server starts successfully.
2. The agent receives the prompt and executes normally.
3. The agent attempts to call `task_complete` but the tool is not registered.
4. The agent either errors on the tool call or completes the session without
   signaling.
5. `extractCompletion` finds no `task_complete` call in session messages.
6. Result defaults to `stalled`.
7. The failure strategy is applied.

**Observable outcome:** Every iteration stalls. With `retry` strategy and
default `max_retries: 3`, each item is attempted four times before being
skipped. The run exits with exit code `1` after all items are exhausted or
the iteration limit is reached. [CONFIRMED: `src/opencode.ts:285–288`]

---

## Resilience Summary

| Mechanism | Scope | Default value | Behavior |
| --- | --- | --- | --- |
| `engine.strategy = "retry"` | Per-iteration failure | `retry` | Re-run up to `max_retries` times |
| `engine.max_retries` | Per-iteration failure | `3` | Retry limit before fallback to skip |
| `engine.timeout_minutes` | Per-iteration | `30` minutes | Hard wall-clock timeout; kills session |
| `engine.inactivity_timeout_seconds` | Per-session | `180` seconds | No-event watchdog; aborts session |
| `checkBrokenSymlinks({ fix: true })` | Server startup | Always | Auto-repairs broken plugin symlinks |
| `finally` block in `runPhaseLoop` | Run lifetime | Always | Ensures run is finalized and server is closed |
| Best-effort `session.abort()` | Inactivity timeout | Always | Prevents orphaned API sessions |
| SSE stream `stream.return()` | Per-session cleanup | Always | Closes SSE connection to unblock process exit |

---

## Open Questions

- Whether the agent's `task_complete({ status: "failed" })` call is
  distinguished from `stalled` in the operator-visible event log is not
  fully confirmed; both result in the failure strategy being applied.
  [UNKNOWN]
- The exact error surfaced when the opencode API provider rejects a prompt
  (for example, due to a rate limit or invalid credentials) is not
  characterized; it likely manifests as a `session.error` SSE event but
  the exact message format is unconfirmed. [UNKNOWN]
- Whether `session.abort()` always prevents further token consumption after
  an inactivity timeout depends on opencode server behavior, which is
  outside the scope of this codebase. [ASSUMED]
- The behavior when `engine.max_retries` is set to `0` is unconfirmed;
  the condition `currentRetries < max_retries` would be false on the first
  attempt, causing immediate fallback to `skip`. [INFERRED: `src/engine.ts:173`]
- The `session.error` SSE event is captured and breaks out of the streaming
  loop (`src/opencode.ts:246–263`), but it is not clear whether it is
  recorded as a distinct `CompletionResult` status or falls through to the
  default `stalled` result. [UNKNOWN]
