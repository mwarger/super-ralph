# Forward

> Implements the Forward phase: selects the highest-priority ready bead from
> an epic and drives the AI agent to implement it, repeating until no ready
> beads remain.

**Source:** `src/forward.ts` (examined at commit `ecc95c0` / 2026-02-27)

## Purpose

The Forward phase translates a prioritized backlog of beads into implemented
code. It delegates loop orchestration to the Engine and supplies
phase-specific callbacks: a bead-selection strategy, a Handlebars-rendered
prompt, and a result handler that decides whether to continue or halt.
It sits directly between the CLI entry point and the Engine in the call
stack.

## Triggers

- Invoked by `src/index.ts` when the user runs `super-ralph forward` (or its
  alias `super-ralph run`). (`src/index.ts:cmdForward`)
- Exposed as `runForward(projectDir, flags)`. (`src/forward.ts`)

## Inputs

| Name | Type | Source | Description |
| --- | --- | --- | --- |
| `projectDir` | `string` | CLI caller | Absolute path to the project root |
| `flags` | `ForwardFlags` | CLI parser | Parsed CLI flags: `dryRun`, `maxIterations?`, `modelOverride?`, `attach?`, `epicId` |
| `config` (resolved) | `LoopConfig` | `src/config.ts` | Full merged configuration, loaded during `setup` |
| `beads` (resolved) | `BeadInfo[]` | `src/beads.ts` | All beads under the epic, fetched during `setup` |
| `readyBeads` (per iteration) | `BeadInfo[]` | `src/beads.ts` | Unblocked ready beads sorted by hybrid priority, fetched each iteration |
| `recentProgress` | `string` | `src/progress.ts` | Last few iteration summaries read from `progress.md` |

## Outputs

| Name | Type | Destination | Description |
| --- | --- | --- | --- |
| Return value | `LoopResult` | CLI caller | Aggregate counts: `completed`, `failed`, `skipped`, `totalTime`, `iterations[]` |

## Side Effects

- Reads bead data from the `br` CLI (via `src/beads.ts`) each iteration.
- Reads `.super-ralph/progress.md` each iteration for context injection.
- Reads and renders the `forward.hbs` Handlebars template each iteration.
- All file writes and AI session side effects are delegated to the Engine.

## Failure Modes

| Condition | Behavior | Recovery |
| --- | --- | --- |
| Epic has no beads at `setup` | `maxIterations` is set to `0`; loop exits immediately with zero iterations | None — caller receives empty `LoopResult` |
| `getAllReady()` returns empty list | `nextIteration` returns `null`; Engine exits the loop cleanly | Engine calls `finalize` and returns |
| Template file missing | `loadTemplate` throws with a hint to run `super-ralph init` | Propagates to Engine, which marks the run failed |
| `handleResult` receives `phase_done` | Returns `false`, causing Engine to exit the loop | Normal termination |

## Dependencies

| Dependency | Type | Purpose |
| --- | --- | --- |
| `src/engine.ts` | internal | Provides `runPhaseLoop`; owns the iteration loop and server lifecycle |
| `src/beads.ts` | internal | Fetches ready beads and epic details from the `br` CLI |
| `src/template.ts` | internal | Loads and renders `forward.hbs` prompt template |
| `src/progress.ts` | internal | Reads recent iteration history for prompt context |
| `src/config.ts` | internal | Resolves the AI model for each bead via labels and area mapping |
| `src/types.ts` | internal | `ForwardFlags`, `LoopResult`, `BeadInfo`, `LoopConfig` type definitions |

## Open Questions

- The system prompt content injected into the agent is defined inline in
  `forward.ts`. It is unclear whether this prompt is versioned or tested
  independently of the template.
- The `maxIterations` calculation (`beads.length * 2`) is a heuristic whose
  rationale is not documented in source.
