# Module Catalog

> Complete inventory of all source modules in the super-ralph agent framework,
> grouped by domain.

**Source examined at commit:** `ecc95c0` (2026-02-27)

## Coverage Key

| Status | Meaning |
| --- | --- |
| `covered` | A detailed spec file exists in `spec/`. |
| `partial` | Spec exists but is incomplete or draft. |
| `todo` | No spec file yet. |

## Domains

The nineteen source modules in `src/` fall into five domains:

1. [Phases](#phases) — Top-level command orchestration (3 modules)
2. [Engine](#engine) — Core iteration loop and lifecycle (1 module)
3. [Integrations](#integrations) — External service adapters (3 modules)
4. [Infrastructure](#infrastructure) — Cross-cutting support utilities
   (11 modules)
5. [CLI Entry Point](#cli-entry-point) — Argument parsing and dispatch
   (1 module)

---

## Phases

Phase modules implement the three top-level commands. Each module calls
`runPhaseLoop` from the engine and supplies phase-specific callbacks for
selecting work, building prompts, and handling results.

| Module | Path | Responsibility | Status |
| --- | --- | --- | --- |
| Forward | `src/forward.ts` | Picks the highest-priority ready bead, renders a prompt, and drives the engine until all epic beads are closed. | `covered` |
| Decompose | `src/decompose.ts` | Creates an epic via `br`, then iteratively prompts the agent to read a spec file and produce beads from it. | `covered` |
| Reverse | `src/reverse.ts` | Runs either an interactive SSE session (human-driven Q&A) or an autonomous loop that refines a Markdown spec document. | `covered` |

---

## Engine

The engine module owns the generic iteration loop shared by all three phases.

| Module | Path | Responsibility | Status |
| --- | --- | --- | --- |
| Engine | `src/engine.ts` | Drives the select-prompt-execute-evaluate loop; manages retries, error strategy, event emission, run tracking, and timeouts. | `covered` |

---

## Integrations

Integration modules wrap external services and tools behind typed interfaces
used by the engine and phase modules.

| Module | Path | Responsibility | Status |
| --- | --- | --- | --- |
| opencode adapter | `src/opencode.ts` | Manages opencode server lifecycle, session creation, real-time SSE prompt streaming, and result extraction. | `covered` |
| Interactive session | `src/interactive.ts` | Handles the interactive reverse mode: subscribes to SSE events, intercepts questions, and renders them via `@clack/prompts` or mock answers. | `covered` |
| bead integration | `src/beads.ts` | Thin adapter around the `br` CLI: spawns child processes, parses JSON output, and returns typed `BeadInfo` objects. | `covered` |

---

## Infrastructure

Infrastructure modules provide cross-cutting support — configuration,
templating, persistence, event routing, and utilities — consumed by the
engine and phases.

| Module | Path | Responsibility | Status |
| --- | --- | --- | --- |
| Types | `src/types.ts` | Central type definitions: all shared interfaces and type aliases used across the codebase. | `covered` |
| config | `src/config.ts` | Loads and merges `.super-ralph/config.toml` with defaults; resolves AI model selection by bead labels or CLI override. | `covered` |
| Template | `src/template.ts` | Loads and renders Handlebars `.hbs` prompt templates stored in `.super-ralph/`. | `covered` |
| Output parser | `src/output-parser.ts` | Accumulates raw SSE event lines and display text during a session; caps total size at 250,000 characters. | `covered` |
| Run state | `src/run-state.ts` | Persists per-run artifacts: timestamped run directory, live `session.json`, jsonl event log, and per-iteration transcripts. | `covered` |
| Run status | `src/run-status.ts` | Read-only companion to run state; resolves a run reference and reads back session state, event counts, and transcript paths. | `covered` |
| Progress | `src/progress.ts` | Appends human-readable Markdown progress entries to `progress.md` after each iteration; reads recent entries back for agent context. | `covered` |
| Skills | `src/skills.ts` | Resolves a skill name or file path to its Markdown content; supports built-in skills and arbitrary user-supplied paths. | `covered` |
| Timeout | `src/timeout.ts` | Races a promise against a deadline; rejects with a custom error message if the timeout elapses first. | `covered` |
| Init | `src/init.ts` | Scaffolds a new project: creates `.super-ralph/`, copies templates, writes `config.toml`, installs the opencode plugin, and runs `br init`. | `covered` |
| Events | `src/events.ts` | Defines the engine event union type, a lightweight pub/sub emitter, and a default console renderer for terminal output. | `covered` |

---

## CLI Entry Point

| Module | Path | Responsibility | Status |
| --- | --- | --- | --- |
| Index | `src/index.ts` | CLI entry point: parses command-line arguments and dispatches to `forward`, `decompose`, `reverse`, `init`, `status`, or `doctor`. | `covered` |

---

## Detailed Spec Files

All 19 modules are fully covered. Each spec file follows the required section
template from [CONVENTIONS.md](CONVENTIONS.md).

| Spec File | Module | Source Path |
| --- | --- | --- |
| [modules/phases/forward.md](modules/phases/forward.md) | Forward | `src/forward.ts` |
| [modules/phases/decompose.md](modules/phases/decompose.md) | Decompose | `src/decompose.ts` |
| [modules/phases/reverse.md](modules/phases/reverse.md) | Reverse | `src/reverse.ts` |
| [modules/engine/engine.md](modules/engine/engine.md) | Engine | `src/engine.ts` |
| [modules/integrations/opencode.md](modules/integrations/opencode.md) | opencode adapter | `src/opencode.ts` |
| [modules/integrations/interactive.md](modules/integrations/interactive.md) | Interactive session | `src/interactive.ts` |
| [modules/integrations/beads.md](modules/integrations/beads.md) | bead integration | `src/beads.ts` |
| [modules/infrastructure/types.md](modules/infrastructure/types.md) | Types | `src/types.ts` |
| [modules/infrastructure/config.md](modules/infrastructure/config.md) | config | `src/config.ts` |
| [modules/infrastructure/template.md](modules/infrastructure/template.md) | Template | `src/template.ts` |
| [modules/infrastructure/output-parser.md](modules/infrastructure/output-parser.md) | Output parser | `src/output-parser.ts` |
| [modules/infrastructure/run-state.md](modules/infrastructure/run-state.md) | Run state | `src/run-state.ts` |
| [modules/infrastructure/run-status.md](modules/infrastructure/run-status.md) | Run status | `src/run-status.ts` |
| [modules/infrastructure/progress.md](modules/infrastructure/progress.md) | Progress | `src/progress.ts` |
| [modules/infrastructure/skills.md](modules/infrastructure/skills.md) | Skills | `src/skills.ts` |
| [modules/infrastructure/timeout.md](modules/infrastructure/timeout.md) | Timeout | `src/timeout.ts` |
| [modules/infrastructure/init.md](modules/infrastructure/init.md) | Init | `src/init.ts` |
| [modules/infrastructure/events.md](modules/infrastructure/events.md) | Events | `src/events.ts` |
| [modules/cli/index.md](modules/cli/index.md) | Index | `src/index.ts` |
