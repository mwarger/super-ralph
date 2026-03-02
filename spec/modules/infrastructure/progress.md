# Progress

> Appends human-readable Markdown progress entries to `progress.md` after
> each iteration; reads recent entries back for agent context.

**Source:** `src/progress.ts` (examined at commit `ecc95c0` / 2026-02-27)

## Purpose

The progress module maintains a running Markdown log of iteration outcomes
at `.super-ralph/progress.md`. The Engine appends one entry per iteration
so that the AI agent in subsequent iterations can see what was tried and
what happened. The same file is read back by phase `nextIteration` callbacks
and injected into prompts as recent history.

## Triggers

- `appendProgress(projectDir, iteration, result)` — called by the Engine
  after each iteration completes. (`src/engine.ts`)
- `readRecentProgress(projectDir, count?)` — called by phase modules in
  their `nextIteration` callbacks to build prompt context.
  (`src/forward.ts`, `src/reverse.ts`)
- `formatProgressEntry(iteration, result)` — utility called internally by
  `appendProgress`; exposed for testing.

## Inputs

| Name | Type | Source | Description |
| --- | --- | --- | --- |
| `projectDir` | `string` | Engine / phase caller | Absolute path to the project root |
| `iteration` | `number` | Engine | Current iteration index (1-based) |
| `result` | `IterationResult` | Engine | Outcome of the completed iteration |
| `count` | `number \| undefined` | phase caller | Number of recent iteration blocks to return; defaults to a module constant |

## Outputs

| Name | Type | Destination | Description |
| --- | --- | --- | --- |
| `readRecentProgress` return | `string` | phase `nextIteration` | Concatenated Markdown text of the last N iteration blocks |
| `formatProgressEntry` return | `string` | `appendProgress` / tests | Single Markdown block for one iteration |

## Side Effects

- Reads `.super-ralph/progress.md` synchronously in `readRecentProgress`.
  Creates the file with empty content if it does not exist. [INFERRED]
- Appends one Markdown block to `.super-ralph/progress.md` synchronously
  in `appendProgress`.

## Failure Modes

| Condition | Behavior | Recovery |
| --- | --- | --- |
| `progress.md` does not exist on first read | File is created (or read returns empty string); no error thrown [INFERRED] | `readRecentProgress` returns an empty string |
| File system write failure in `appendProgress` | Exception propagates to the Engine | Engine's error handling applies; run may continue or terminate depending on error strategy |

## Dependencies

| Dependency | Type | Purpose |
| --- | --- | --- |
| `src/types.ts` | internal | `IterationResult` type definition |
| `fs` | node | Reads and appends to `progress.md` |
| `path` | node | Resolves `progress.md` path from `projectDir` |

## Open Questions

- The default value of `count` in `readRecentProgress` (when `undefined`) is
  a module-level constant whose value is not documented in source comments.
- `formatProgressEntry` includes `cost`, `tokens`, and `filesChanged` fields
  from `IterationResult`. The exact format and units of the cost field are
  not confirmed.
