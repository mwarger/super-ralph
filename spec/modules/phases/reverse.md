# Reverse

> Implements the Reverse phase: converts a set of input files, URLs, or
> descriptions into a Markdown spec document, via either an interactive
> terminal session or an autonomous AI loop.

**Source:** `src/reverse.ts` (examined at commit `ecc95c0` / 2026-02-27)

## Purpose

The Reverse phase is the entry point for producing specification documents
from observable artifacts. It supports two execution modes. In interactive
mode the AI agent asks the user questions through a terminal UI and the user
answers them in real time. In autonomous mode the agent iteratively reads
its own evolving output and refines the spec until it signals completion.
The module dispatches to one of two internal handlers based on the
`interactive` flag.

## Triggers

- Invoked by `src/index.ts` when the user runs `super-ralph reverse`.
  (`src/index.ts:cmdReverse`)
- Exposed as `runReverse(projectDir, flags)`. (`src/reverse.ts`)

## Inputs

| Name | Type | Source | Description |
| --- | --- | --- | --- |
| `projectDir` | `string` | CLI caller | Absolute path to the project root |
| `flags` | `ReverseFlags` | CLI parser | `dryRun`, `maxIterations?`, `modelOverride?`, `attach?`, `inputs[]`, `outputDir?`, `skill?`, `interactive?`, `answersFile?` — `inputs` are raw CLI argument strings, not pre-processed content (see §2.4.4 Input Processing) |
| `skillContent` | `string \| null` | `src/skills.ts` | Optional skill file content prepended to the prompt |
| `specContent` (autonomous, per iteration) | `string` | file system | Most recently modified `.md` file in `outputDir`, read each iteration |
| `answersFile` | `string` | file system | JSON file of mock answers loaded when `flags.answersFile` is set |

## Outputs

| Name | Type | Destination | Description |
| --- | --- | --- | --- |
| Return value | `LoopResult` | CLI caller | Aggregate run counts and per-iteration results |
| Spec document | side effect | `outputDir/*.md` | Markdown spec file written or updated by the AI agent |
| Run artifacts | side effect | `.super-ralph/runs/` | Session JSON, event log, and transcripts via `RunTracker` |

## Side Effects

- Creates `outputDir` (default `docs/specs`) if it does not exist.
- Reads the most recently modified `.md` file in `outputDir` each
  autonomous iteration.
- Spawns or attaches to an opencode server (interactive mode: directly via
  `src/opencode.ts`; autonomous mode: via Engine).
- Renders terminal UI prompts via `@clack/prompts` in interactive mode.
- Writes transcript files via `RunTracker` (interactive mode manages
  `RunTracker` directly; autonomous mode delegates to Engine).
- Loads mock answers from `flags.answersFile` when provided (interactive
  mode only).

## Failure Modes

| Condition | Behavior | Recovery |
| --- | --- | --- |
| Timeout elapsed (interactive) | `withTimeout` rejects; best-effort `session.abort()` is called | `RunTracker.finalize("failed")` is called; `failed=1` returned |
| Agent signals `blocked` (interactive) | `skipped=1` returned | Caller decides whether to retry |
| Agent signals `phase_done` (autonomous) | `handleResult` returns `false`; Engine exits cleanly | Normal termination |
| `outputDir` has no `.md` files (autonomous, first iteration) | `specContent` is empty string; prompt proceeds with no prior content | Agent creates the initial spec from scratch |
| Skill file missing or named incorrectly | `loadSkill` throws | Propagates before the session starts |

## Dependencies

| Dependency | Type | Purpose |
| --- | --- | --- |
| `src/engine.ts` | internal | `runPhaseLoop` used by autonomous mode |
| `src/template.ts` | internal | Loads and renders `reverse.hbs` prompt template |
| `src/config.ts` | internal | Loads `LoopConfig` for model resolution and output dir default |
| `src/opencode.ts` | internal | Server lifecycle and session management (interactive mode) |
| `src/interactive.ts` | internal | Question-driven SSE session handler (interactive mode) |
| `src/skills.ts` | internal | Resolves skill name or path to Markdown content |
| `src/run-state.ts` | internal | `RunTracker` creation and transcript writing (interactive mode) |
| `src/timeout.ts` | internal | Deadline wrapper for interactive session |
| `src/types.ts` | internal | `ReverseFlags`, `LoopResult` type definitions |
| `fs` | node | Reads `outputDir` listing and spec file contents |
| `path` | node | Resolves `outputDir` and file paths |

## Open Questions

- The criterion for selecting the "most recently modified" `.md` file in
  autonomous mode assumes a single-file output convention. Behavior when the
  agent creates multiple spec files is not documented in source.
- Interactive mode creates its own `RunTracker` independently of `runPhaseLoop`.
  It is unclear whether the global `.super-ralph/session.json` pointer is
  updated correctly in all error paths.
