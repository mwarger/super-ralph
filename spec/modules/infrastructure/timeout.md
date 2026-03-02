# Timeout

> Races a promise against a deadline timer; rejects with a custom error
> message if the timeout elapses first.

**Source:** `src/timeout.ts` (examined at commit `ecc95c0` / 2026-02-27)

## Purpose

The timeout module provides a single generic utility for enforcing
wall-clock deadlines on asynchronous operations. The Engine uses it to
bound each opencode prompt invocation; the Reverse phase uses it to bound
interactive sessions. The module always cancels the timer in a `finally`
block to prevent timer leaks.

## Triggers

- `withTimeout(task, timeoutMs, errorMessage)` — called by the Engine per
  iteration and by `src/reverse.ts` for interactive sessions.
  (`src/engine.ts`, `src/reverse.ts`)

## Inputs

| Name | Type | Source | Description |
| --- | --- | --- | --- |
| `task` | `Promise<T>` | Engine / `src/reverse.ts` | The asynchronous operation to race against the deadline |
| `timeoutMs` | `number` | `src/config.ts` (via caller) | Deadline duration in milliseconds |
| `errorMessage` | `string` | caller | Error message used when constructing the rejection `Error` |

## Outputs

| Name | Type | Destination | Description |
| --- | --- | --- | --- |
| Return value | `Promise<T>` | Engine / `src/reverse.ts` | Resolves with `task` result if it completes before the deadline |

## Side Effects

None. The module only uses `setTimeout` / `clearTimeout` internally and
does not perform I/O.

## Failure Modes

| Condition | Behavior | Recovery |
| --- | --- | --- |
| Timeout elapses before `task` resolves | Rejects with `new Error(errorMessage)` | Caller applies error strategy or marks the session failed |
| `task` rejects before timeout | Rejection propagates immediately; timer is cleared in `finally` | Caller handles rejection normally |
| `task` resolves before timeout | Timer is cleared in `finally`; resolved value returned | Normal path |

## Dependencies

| Dependency | Type | Purpose |
| --- | --- | --- |
| _(none)_ | — | No external or internal imports; uses only built-in `setTimeout`/`clearTimeout` |

## Open Questions

- After the timeout fires, the underlying `task` promise continues running.
  There is no cancellation signal sent to the task. Whether callers are
  responsible for aborting the underlying operation (e.g., via
  `session.abort()`) is a caller-level convention, not enforced here.
