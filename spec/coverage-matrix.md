# Coverage Matrix

> Maps every cataloged module from `spec/module-catalog.md` to at least one
> detailed spec section.

**Source examined at commit:** `ecc95c0` (2026-02-27)

## Coverage Summary

- **Total modules:** 19
- **Modules with detailed specs:** 19
- **Coverage:** 100%

## How to Read This Table

Each row corresponds to one module entry in `spec/module-catalog.md`. The
"Primary spec" column links to the dedicated module spec file. The "Also
covered in" column lists every additional spec document that describes the
module's behavior, interactions, or contracts.

All 8 required sections from the module doc template (Purpose, Triggers,
Inputs, Outputs, Side Effects, Failure Modes, Dependencies, Open Questions)
are present in every primary spec file.

---

## Phases Domain

| Module | Source | Primary Spec | Also Covered In |
| --- | --- | --- | --- |
| Forward | `src/forward.ts` | [modules/phases/forward.md](modules/phases/forward.md) | [architecture/overview.md](architecture/overview.md) § Phases, [architecture/runtime-lifecycle.md](architecture/runtime-lifecycle.md) § Steady-State Loop, [behavior/error-handling.md](behavior/error-handling.md) § Forward Failure, [workflows/core-workflows.md](workflows/core-workflows.md) § WF-04 |
| Decompose | `src/decompose.ts` | [modules/phases/decompose.md](modules/phases/decompose.md) | [architecture/overview.md](architecture/overview.md) § Phases, [behavior/error-handling.md](behavior/error-handling.md) § Decompose Failure, [workflows/core-workflows.md](workflows/core-workflows.md) § WF-03 |
| Reverse | `src/reverse.ts` | [modules/phases/reverse.md](modules/phases/reverse.md) | [architecture/overview.md](architecture/overview.md) § Phases, [behavior/error-handling.md](behavior/error-handling.md) § Reverse Failure, [workflows/core-workflows.md](workflows/core-workflows.md) § WF-02 |

---

## Engine Domain

| Module | Source | Primary Spec | Also Covered In |
| --- | --- | --- | --- |
| Engine | `src/engine.ts` | [modules/engine/engine.md](modules/engine/engine.md) | [architecture/overview.md](architecture/overview.md) § Engine, [architecture/runtime-lifecycle.md](architecture/runtime-lifecycle.md) § Steady-State Loop, [behavior/error-handling.md](behavior/error-handling.md) § Retry/Skip/Abort Strategies, [behavior/state-model.md](behavior/state-model.md) § In-Process State |

---

## Integrations Domain

| Module | Source | Primary Spec | Also Covered In |
| --- | --- | --- | --- |
| opencode adapter | `src/opencode.ts` | [modules/integrations/opencode.md](modules/integrations/opencode.md) | [architecture/overview.md](architecture/overview.md) § Integrations, [architecture/runtime-lifecycle.md](architecture/runtime-lifecycle.md) § opencode Lifecycle, [behavior/persistence-and-io.md](behavior/persistence-and-io.md) § Network I/O, [behavior/state-model.md](behavior/state-model.md) § External State |
| Interactive session | `src/interactive.ts` | [modules/integrations/interactive.md](modules/integrations/interactive.md) | [workflows/core-workflows.md](workflows/core-workflows.md) § WF-02 Interactive Mode, [behavior/state-model.md](behavior/state-model.md) § Singleton State |
| bead integration | `src/beads.ts` | [modules/integrations/beads.md](modules/integrations/beads.md) | [architecture/overview.md](architecture/overview.md) § Integrations, [behavior/persistence-and-io.md](behavior/persistence-and-io.md) § Child Processes, [workflows/core-workflows.md](workflows/core-workflows.md) § WF-01 through WF-04 |

---

## Infrastructure Domain

| Module | Source | Primary Spec | Also Covered In |
| --- | --- | --- | --- |
| Types | `src/types.ts` | [modules/infrastructure/types.md](modules/infrastructure/types.md) | [architecture/overview.md](architecture/overview.md) § Shared Types, [behavior/error-handling.md](behavior/error-handling.md) § CompletionResult |
| config | `src/config.ts` | [modules/infrastructure/config.md](modules/infrastructure/config.md) | [behavior/configuration.md](behavior/configuration.md) (entire document), [architecture/overview.md](architecture/overview.md) § Configuration Boundary |
| Template | `src/template.ts` | [modules/infrastructure/template.md](modules/infrastructure/template.md) | [behavior/configuration.md](behavior/configuration.md) § Template Resolution, [architecture/runtime-lifecycle.md](architecture/runtime-lifecycle.md) § Prompt Construction |
| Output parser | `src/output-parser.ts` | [modules/infrastructure/output-parser.md](modules/infrastructure/output-parser.md) | [behavior/state-model.md](behavior/state-model.md) § StreamCapture, [behavior/persistence-and-io.md](behavior/persistence-and-io.md) § Transcript Files |
| Run state | `src/run-state.ts` | [modules/infrastructure/run-state.md](modules/infrastructure/run-state.md) | [behavior/persistence-and-io.md](behavior/persistence-and-io.md) § Filesystem Writes, [behavior/state-model.md](behavior/state-model.md) § On-Disk State |
| Run status | `src/run-status.ts` | [modules/infrastructure/run-status.md](modules/infrastructure/run-status.md) | [workflows/core-workflows.md](workflows/core-workflows.md) § WF-05, [behavior/persistence-and-io.md](behavior/persistence-and-io.md) § Read-Only Access |
| Progress | `src/progress.ts` | [modules/infrastructure/progress.md](modules/infrastructure/progress.md) | [behavior/state-model.md](behavior/state-model.md) § progress.md, [behavior/persistence-and-io.md](behavior/persistence-and-io.md) § Filesystem Writes |
| Skills | `src/skills.ts` | [modules/infrastructure/skills.md](modules/infrastructure/skills.md) | [architecture/runtime-lifecycle.md](architecture/runtime-lifecycle.md) § Reverse Initialization, [workflows/core-workflows.md](workflows/core-workflows.md) § WF-02 |
| Timeout | `src/timeout.ts` | [modules/infrastructure/timeout.md](modules/infrastructure/timeout.md) | [behavior/error-handling.md](behavior/error-handling.md) § Timeout Mechanisms, [architecture/runtime-lifecycle.md](architecture/runtime-lifecycle.md) § Timeout Handling |
| Init | `src/init.ts` | [modules/infrastructure/init.md](modules/infrastructure/init.md) | [workflows/core-workflows.md](workflows/core-workflows.md) § WF-01, [behavior/persistence-and-io.md](behavior/persistence-and-io.md) § Init Filesystem Writes |
| Events | `src/events.ts` | [modules/infrastructure/events.md](modules/infrastructure/events.md) | [architecture/runtime-lifecycle.md](architecture/runtime-lifecycle.md) § Event Emission, [behavior/state-model.md](behavior/state-model.md) § In-Process State |

---

## CLI Entry Point Domain

| Module | Source | Primary Spec | Also Covered In |
| --- | --- | --- | --- |
| Index | `src/index.ts` | [modules/cli/index.md](modules/cli/index.md) | [architecture/overview.md](architecture/overview.md) § CLI Layer, [behavior/persistence-and-io.md](behavior/persistence-and-io.md) § Process Exit Codes, [workflows/core-workflows.md](workflows/core-workflows.md) § WF-05 Status, WF-06 Doctor |

---

## Supporting Spec Documents

The following documents provide cross-cutting coverage that supplements the
per-module specs above. They are referenced in the "Also Covered In" column
and are listed here for completeness.

| Document | Path | Coverage Scope |
| --- | --- | --- |
| Architecture overview | [architecture/overview.md](architecture/overview.md) | All 5 domains, cross-module interaction boundaries |
| Runtime lifecycle | [architecture/runtime-lifecycle.md](architecture/runtime-lifecycle.md) | Engine loop, phase startup/teardown, timeout paths |
| Configuration behavior | [behavior/configuration.md](behavior/configuration.md) | Full config loading, merge, and model-resolution spec |
| Error handling behavior | [behavior/error-handling.md](behavior/error-handling.md) | Error taxonomy, retry/skip/abort, per-workflow negative paths |
| Persistence and I/O | [behavior/persistence-and-io.md](behavior/persistence-and-io.md) | All filesystem, network, and subprocess I/O |
| State model | [behavior/state-model.md](behavior/state-model.md) | In-process, on-disk, and external state inventory |
| Core workflows | [workflows/core-workflows.md](workflows/core-workflows.md) | End-to-end behavioral specs for all 7 user-visible workflows |
