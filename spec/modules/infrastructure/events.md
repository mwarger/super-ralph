# Events

> Defines the engine event union type, a lightweight pub/sub emitter, and
> a default console renderer for terminal output.

**Source:** `src/events.ts` (examined at commit `ecc95c0` / 2026-02-27)

## Purpose

The events module provides the typed event bus that the Engine uses to
broadcast lifecycle milestones without coupling to specific output targets.
Callers register listeners (or use the bundled default console renderer)
and are notified synchronously as the Engine progresses through its loop.
The emitter is intentionally minimal — no queuing, no async dispatch, no
wildcard subscriptions.

## Triggers

- `EngineEventEmitter` is instantiated by the Engine at the start of each
  run. (`src/engine.ts`)
- `attachDefaultConsoleRenderer(emitter)` — called by the Engine to wire
  up formatted terminal output. (`src/engine.ts`)
- `emitter.emit(event)` — called by the Engine at each lifecycle milestone.
- `emitter.on(listener)` — called by the Engine (for the default renderer)
  and optionally by phase callers via `onEvent` in `runPhaseLoop`.

## Inputs

| Name | Type | Source | Description |
| --- | --- | --- | --- |
| `event` | `EngineEvent` | Engine | Discriminated union value describing the lifecycle milestone |
| `listener` | `EngineEventListener` | Engine / phase caller | Callback `(event: EngineEvent) => void` |

## Outputs

| Name | Type | Destination | Description |
| --- | --- | --- | --- |
| `emitter.on` return | `() => void` | Engine / phase caller | Unsubscribe function; call to remove the listener |
| `attachDefaultConsoleRenderer` return | `() => void` | Engine | Detach function for the default renderer |

## Side Effects

- The default console renderer calls `console.log` and `console.error`
  for formatted terminal output on each received event.
- `emitter.emit` calls all registered listeners synchronously and
  immediately; no deferred or async dispatch occurs.

## Failure Modes

| Condition | Behavior | Recovery |
| --- | --- | --- |
| Listener throws an exception | Exception propagates through `emit`, potentially interrupting other listeners | [UNKNOWN] — no error isolation around listener calls is confirmed in source |
| Unsubscribe function called after emitter is discarded | No-op; no error thrown [INFERRED] | Safe to call in `finally` blocks |

## Dependencies

| Dependency | Type | Purpose |
| --- | --- | --- |
| `src/types.ts` | internal | `LoopResult` and `IterationResult` referenced in event payloads |

## Open Questions

- The 12-event discriminated union covers all currently known lifecycle
  milestones. Whether future engine behavior adds events without updating
  this type is not determinable from source.
- Listener execution order when multiple listeners are registered is not
  documented. `[ASSUMED]` FIFO order based on typical pub/sub patterns.
