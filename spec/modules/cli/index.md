# Index (CLI Entry Point)

> CLI entry point: parses command-line arguments and dispatches to `forward`,
> `decompose`, `reverse`, `init`, `status`, or `doctor`.

**Source:** `src/index.ts` (examined at commit `ecc95c0` / 2026-02-27)

## Purpose

The index module is the `super-ralph` binary's entry point. It owns
argument parsing and subcommand dispatch. Each subcommand is implemented
as a local command handler (`cmdForward`, `cmdDecompose`, `cmdReverse`,
`cmdStatus`, `cmdDoctor`) that constructs the appropriate flags object and
calls the corresponding phase or utility module. The module handles
process exit codes and optional JSON result output.

## Triggers

- Executed directly by `bun` when the user runs `super-ralph <command>`.
  The shebang line (`#!/usr/bin/env bun`) makes this module the process
  entry point.

## Inputs

| Name | Type | Source | Description |
| --- | --- | --- | --- |
| `process.argv` | `string[]` | OS / shell | Raw command-line arguments |
| `--dry-run` | boolean flag | CLI | Simulate iterations without running AI |
| `--interactive` | boolean flag | CLI | Use interactive mode (Reverse phase only) |
| `--fix` | boolean flag | CLI | Repair broken symlinks (doctor command only) |
| `--model <value>` | string flag | CLI | Override AI model for all iterations |
| `--epic <value>` | string flag | CLI | Epic bead ID (Forward and status commands) |
| `--spec <value>` | string flag | CLI | Spec file path (Decompose command) |
| `--title <value>` | string flag | CLI | Epic title (Decompose command) |
| `--inputs <value>` | string flag | CLI | Input files or descriptions (Reverse command) |
| `--output-dir <value>` | string flag | CLI | Output directory for spec files (Reverse command) |
| `--skill <value>` | string flag | CLI | Skill name or file path (Reverse command) |
| `--answers <value>` | string flag | CLI | Mock answers JSON file path (Reverse command) |
| `--run <value>` | string flag | CLI | Run ID or `"latest"` (status command) |
| `--json <value>` | string flag | CLI | File path to write JSON result output |
| `--attach <value>` | string flag | CLI | URL of an existing opencode server to attach to |
| `--max-iterations <value>` | string flag | CLI | Override maximum iteration count |

## Outputs

| Name | Type | Destination | Description |
| --- | --- | --- | --- |
| Console output | text | `stdout` / `stderr` | Formatted status, doctor results, or error messages |
| JSON result file | file | path from `--json` flag | `LoopResult` serialized to JSON, if `--json` is provided |
| Exit code `0` | process | OS | Returned when the run completes with no failures |
| Exit code `1` | process | OS | Returned on error or when `result.failed > 0` |

## Side Effects

- Calls `process.exit(1)` on argument errors, missing required flags, or
  when `result.failed > 0` after a phase run.
- Writes a JSON file via `fs.writeFileSync` when `--json <path>` is
  provided.
- Inherits all side effects of the subcommand handlers it invokes (server
  spawning, file writes, etc.).

## Failure Modes

| Condition | Behavior | Recovery |
| --- | --- | --- |
| Unknown subcommand | Prints usage and calls `process.exit(1)` | User corrects the command |
| Required flag missing (e.g., `--epic` for `forward`) | Prints error and calls `process.exit(1)` | User provides the flag |
| Phase run returns `failed > 0` | Calls `process.exit(1)` after printing summary | Caller (shell script, CI) detects non-zero exit |
| `--json` path is not writable | `fs.writeFileSync` throws; exception propagates | Process terminates with unhandled exception |

## Dependencies

| Dependency | Type | Purpose |
| --- | --- | --- |
| `src/forward.ts` | internal | `runForward` — Forward phase handler |
| `src/decompose.ts` | internal | `runDecompose` — Decompose phase handler |
| `src/reverse.ts` | internal | `runReverse` — Reverse phase handler |
| `src/init.ts` | internal | `runInit` — Project scaffolding |
| `src/beads.ts` | internal | `getAllBeads`, `getEpicProgress` — used by `cmdStatus` |
| `src/config.ts` | internal | `loadConfig` — used by `cmdStatus` and `cmdDoctor` |
| `src/opencode.ts` | internal | `checkBrokenSymlinks` — used by `cmdDoctor` |
| `src/run-status.ts` | internal | `getRunStatus` — used by `cmdStatus --run` |
| `src/types.ts` | internal | `LoopResult`, flag type definitions |
| `fs` | node | Writes JSON result file |
| `path` | node | Resolves `--json` output path |
| `Bun.spawn` | system | Used by `cmdDoctor` to check for `bun` and `br` on `PATH` |

## Open Questions

- The argument parser (`parseArgs`) handles boolean flags differently from
  value flags. The exact list of boolean flags is hard-coded. Adding new
  boolean flags requires modifying the parser; this is not documented for
  contributors.
- The `forward` alias `run` is accepted by the CLI. Whether additional
  aliases exist or are planned is not determinable from source.
