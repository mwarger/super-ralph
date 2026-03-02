# Decompose

> Implements the Decompose phase: creates an epic and iteratively instructs
> the AI agent to read a spec file and produce beads from it until the spec
> is fully covered.

**Source:** `src/decompose.ts` (examined at commit `ecc95c0` / 2026-02-27)

## Purpose

The Decompose phase bridges a written specification document and a bead
backlog. It creates a parent epic via the `br` CLI, then drives the AI agent
in a loop to produce small, verifiable child beads until the agent signals
that the spec is fully decomposed. Loop orchestration is delegated to the
Engine; Decompose supplies the three phase callbacks.

## Triggers

- Invoked by `src/index.ts` when the user runs `super-ralph decompose`.
  (`src/index.ts:cmdDecompose`)
- Exposed as `runDecompose(projectDir, flags)`. (`src/decompose.ts`)

## Inputs

| Name | Type | Source | Description |
| --- | --- | --- | --- |
| `projectDir` | `string` | CLI caller | Absolute path to the project root |
| `flags` | `DecomposeFlags` | CLI parser | `dryRun`, `maxIterations?`, `modelOverride?`, `attach?`, `specPath`, `epicTitle?` |
| `specContent` (per iteration) | `string` | file system | Full text of the spec file read each iteration |
| `existingBeads` (per iteration) | `BeadInfo[]` | `src/beads.ts` | beads already created under the epic, fetched each iteration |
| `config` | `LoopConfig` | `src/config.ts` | Determines `includeReview`, `includeBugscan`, `includeAudit` flags for the template |

## Outputs

| Name | Type | Destination | Description |
| --- | --- | --- | --- |
| Return value | `LoopResult` | CLI caller | Aggregate run counts and per-iteration results |
| Epic bead | side effect | `br` CLI / `.beads/` | An epic created at `setup` time (skipped in dry-run) |
| Child beads | side effect | `br` CLI / `.beads/` | beads created by the AI agent during the session |

## Side Effects

- Calls `br create --type epic` at startup (unless `dryRun`), creating a
  persistent epic in the `.beads/` workspace.
- Reads the spec file from disk each iteration.
- Fetches existing beads from the `br` CLI each iteration.
- All AI session and file-write side effects are delegated to the Engine.

## Failure Modes

| Condition | Behavior | Recovery |
| --- | --- | --- |
| Spec file does not exist at `setup` | `loadTemplate` or spec read throws; propagates to Engine | Run terminates with failed status |
| Epic creation fails (`br create` non-zero exit) | `runBr` throws; propagates before loop starts | Run never starts; caller receives error |
| Agent signals `phase_done` | `handleResult` returns `false`; Engine exits cleanly | Normal termination |
| 50 iterations reached without `phase_done` | Engine exits due to `maxIterations` | Caller receives `LoopResult` with partial completion |

## Dependencies

| Dependency | Type | Purpose |
| --- | --- | --- |
| `src/engine.ts` | internal | Provides `runPhaseLoop`; owns iteration loop and server lifecycle |
| `src/template.ts` | internal | Loads and renders `decompose.hbs` prompt template |
| `src/config.ts` | internal | Reads `decompose.*` config flags for template variables |
| `src/beads.ts` | internal | Creates the epic; fetches existing child beads each iteration |
| `src/types.ts` | internal | `DecomposeFlags`, `LoopResult`, `BeadInfo` type definitions |
| `fs` | node | Reads the spec file contents each iteration |

## Open Questions

- `maxIterations` is hard-coded to `50`. It is unclear whether this value
  is configurable via `config.toml`.
- The system prompt is defined inline in `decompose.ts`. Its versioning and
  test coverage are not observable from source.
