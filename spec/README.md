# Spec Directory

This directory contains reverse-engineered specifications for the super-ralph
agent framework. All documents are produced by reading observable behavior,
source code, and runtime artifacts — not from internal design documents or
author interviews.

## Status

**Complete.** All 19 source modules are fully documented. 100% module
coverage confirmed. See [coverage-matrix.md](coverage-matrix.md) and
[gap-report.md](gap-report.md).

## Purpose

The `spec/` tree provides a clean-room description of how super-ralph works
so that:

- Contributors can understand module contracts without reading all source
  code.
- The forward phase can use these docs as authoritative context when
  implementing beads.
- Reviewers have a stable reference for verifying that behavior matches
  intent.

## Scope

Specifications cover the following layers:

- **Engine** — The core Ralph loop (select, prompt, execute, evaluate).
- **Phases** — Reverse, decompose, and forward phase orchestration.
- **Subsystems** — Configuration loading, bead integration, opencode SDK
  adapter, template resolution, run-state persistence, and output parsing.
- **CLI** — Command-line interface surface and option handling.

Out of scope: internal opencode SDK implementation, beads-rust internals,
and third-party tooling not imported by this project.

## Navigation

Read documents in this order for a top-down understanding:

1. [CONVENTIONS.md](CONVENTIONS.md) — Writing rules, clean-room constraints,
   confidence labels, and the module doc template.
2. [module-catalog.md](module-catalog.md) — Inventory of all 19 source
   modules with coverage status and links to spec files.
3. [architecture/overview.md](architecture/overview.md) — System-level
   description of all five domains and their interaction boundaries.
4. [architecture/runtime-lifecycle.md](architecture/runtime-lifecycle.md)
   — Step-by-step walkthrough of startup, steady-state loop, and shutdown.
5. [behavior/](behavior/) — Cross-cutting behavioral specs (configuration,
   error handling, persistence, state model).
6. [workflows/core-workflows.md](workflows/core-workflows.md) — End-to-end
   specs for all seven user-visible workflows.
7. [modules/](modules/) — One file per source module.
8. [coverage-matrix.md](coverage-matrix.md) — Mapping of every module to
   its spec section(s).
9. [gap-report.md](gap-report.md) — Non-critical ambiguities and open
   questions from the reverse-engineering effort.

## Artifact Index

### Meta

| Artifact | Path | Status |
| --- | --- | --- |
| Writing conventions | [CONVENTIONS.md](CONVENTIONS.md) | stable |
| Module catalog | [module-catalog.md](module-catalog.md) | stable |
| Coverage matrix | [coverage-matrix.md](coverage-matrix.md) | stable |
| Gap report | [gap-report.md](gap-report.md) | stable |

### Architecture

| Artifact | Path | Status | Covers |
| --- | --- | --- | --- |
| System overview | [architecture/overview.md](architecture/overview.md) | stable | All 5 domains |
| Runtime lifecycle | [architecture/runtime-lifecycle.md](architecture/runtime-lifecycle.md) | stable | Engine loop, phase lifecycle |

### Behavior

| Artifact | Path | Status | Covers |
| --- | --- | --- | --- |
| Configuration | [behavior/configuration.md](behavior/configuration.md) | stable | `src/config.ts` |
| Error handling | [behavior/error-handling.md](behavior/error-handling.md) | stable | Retry/skip/abort, timeouts |
| Persistence and I/O | [behavior/persistence-and-io.md](behavior/persistence-and-io.md) | stable | All I/O boundaries |
| State model | [behavior/state-model.md](behavior/state-model.md) | stable | In-process and on-disk state |

### Workflows

| Artifact | Path | Status | Covers |
| --- | --- | --- | --- |
| Core workflows | [workflows/core-workflows.md](workflows/core-workflows.md) | stable | WF-01 through WF-07 |

### Module Specs

| Artifact | Path | Status | Covers |
| --- | --- | --- | --- |
| Engine loop | [modules/engine/engine.md](modules/engine/engine.md) | stable | `src/engine.ts` |
| Forward phase | [modules/phases/forward.md](modules/phases/forward.md) | stable | `src/forward.ts` |
| Reverse phase | [modules/phases/reverse.md](modules/phases/reverse.md) | stable | `src/reverse.ts` |
| Decompose phase | [modules/phases/decompose.md](modules/phases/decompose.md) | stable | `src/decompose.ts` |
| opencode adapter | [modules/integrations/opencode.md](modules/integrations/opencode.md) | stable | `src/opencode.ts` |
| Interactive session | [modules/integrations/interactive.md](modules/integrations/interactive.md) | stable | `src/interactive.ts` |
| bead integration | [modules/integrations/beads.md](modules/integrations/beads.md) | stable | `src/beads.ts` |
| Types | [modules/infrastructure/types.md](modules/infrastructure/types.md) | stable | `src/types.ts` |
| config loading | [modules/infrastructure/config.md](modules/infrastructure/config.md) | stable | `src/config.ts` |
| Template resolution | [modules/infrastructure/template.md](modules/infrastructure/template.md) | stable | `src/template.ts` |
| Output parsing | [modules/infrastructure/output-parser.md](modules/infrastructure/output-parser.md) | stable | `src/output-parser.ts` |
| Run-state persistence | [modules/infrastructure/run-state.md](modules/infrastructure/run-state.md) | stable | `src/run-state.ts` |
| Run status | [modules/infrastructure/run-status.md](modules/infrastructure/run-status.md) | stable | `src/run-status.ts` |
| Progress tracking | [modules/infrastructure/progress.md](modules/infrastructure/progress.md) | stable | `src/progress.ts` |
| Skills loading | [modules/infrastructure/skills.md](modules/infrastructure/skills.md) | stable | `src/skills.ts` |
| Timeout utility | [modules/infrastructure/timeout.md](modules/infrastructure/timeout.md) | stable | `src/timeout.ts` |
| Init scaffolding | [modules/infrastructure/init.md](modules/infrastructure/init.md) | stable | `src/init.ts` |
| Events system | [modules/infrastructure/events.md](modules/infrastructure/events.md) | stable | `src/events.ts` |
| CLI entry point | [modules/cli/index.md](modules/cli/index.md) | stable | `src/index.ts` |

_Status values: `stable` | `draft` | `pending` | `superseded`_

## Adding a New Spec

1. Copy the module doc template from [CONVENTIONS.md](CONVENTIONS.md).
2. Name the file using lowercase kebab-case under the appropriate
   subdirectory.
3. Add a row to the Artifact Index above and to
   [module-catalog.md](module-catalog.md).
4. Update [coverage-matrix.md](coverage-matrix.md) with the new module row.
5. Follow all clean-room rules in [CONVENTIONS.md](CONVENTIONS.md).
