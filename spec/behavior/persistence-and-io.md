# Persistence and I/O

> Read/write boundaries, filesystem layout, external network calls, and
> subprocess interactions.

**Source examined at commit:** `ecc95c0` (2026-02-27)

## Overview

super-ralph interacts with the outside world through four channels:

1. **Filesystem** — reads configuration, templates, and prior-run artifacts;
   writes run artifacts, progress logs, and scaffolding files.
2. **Network** — all agent interactions route through the opencode HTTP/SSE
   API via the `@opencode-ai/sdk`.
3. **Child processes** — the `br` CLI is spawned as a subprocess for all
   bead operations.
4. **Standard streams** — `stdout` for operator-visible output and event
   rendering; `stderr` for debug and error messages; `stdin` consumed by
   `@clack/prompts` in interactive mode.

No database, message queue, or remote state store is used. [CONFIRMED:
no imports of database libraries in any `src/*.ts` file]

---

## Filesystem Read Boundary

All filesystem reads use synchronous Node.js `fs.readFileSync` or
`fs.existsSync`. Reads occur at well-defined points in the lifecycle and
are never performed in the background.

### Files Read at Run Start (once per run)

| File | Module | Trigger |
| --- | --- | --- |
| `.super-ralph/config.toml` | `src/config.ts:40` | `loadConfig(projectDir)` called in `runPhaseLoop` |
| `.super-ralph/<phase>.hbs` | `src/template.ts` | Phase `setup()` callback |
| `skills/<name>.md` or custom path | `src/skills.ts` | Reverse `setup()` if `--skill` flag set |
| `<answersFile>` (JSON) | `src/interactive.ts` | Reverse setup if `--answers` flag set |

### Files Read Per Iteration

| File | Module | Trigger |
| --- | --- | --- |
| `.super-ralph/progress.md` | `src/progress.ts:readRecentProgress` | Forward and reverse `nextIteration()` |
| `<specPath>` (Markdown) | `src/decompose.ts` | Every `nextIteration()` in decompose phase |
| `docs/specs/*.md` (latest by mtime) | `src/reverse.ts` | Reverse `nextIteration()` on iterations > 1 |

### Files Read by Status Command

| File | Module | Trigger |
| --- | --- | --- |
| `.super-ralph/runs/<runId>/session.json` | `src/run-status.ts` | `super-ralph status --run <ref>` |
| `.super-ralph/runs/<runId>/events.jsonl` | `src/run-status.ts` | Same as above (line count) |
| `.super-ralph/runs/<runId>/iterations/` | `src/run-status.ts` | Same as above (directory listing) |

### Files Read by Init Command

| File | Module | Trigger |
| --- | --- | --- |
| `templates/agents.md` | `src/init.ts` | `super-ralph init` |
| `templates/forward.hbs` | `src/init.ts` | `super-ralph init` |
| `templates/decompose.hbs` | `src/init.ts` | `super-ralph init` |
| `templates/reverse.hbs` | `src/init.ts` | `super-ralph init` |
| `templates/intake-checklist.md` | `src/init.ts` | `super-ralph init` |
| `templates/super-ralph-config.toml` | `src/init.ts` | `super-ralph init` |
| `.opencode/plugins/super-ralph.js` (source) | `src/init.ts` | `super-ralph init` |
| `AGENTS.md` (project root) | `src/init.ts` | `super-ralph init` (read-then-append pattern) |

---

## Filesystem Write Boundary

All filesystem writes use synchronous Node.js `fs.writeFileSync` or
`fs.appendFileSync`. Writes are blocking and occur on the calling thread.
There is no write queue, buffering layer, or async flush.

### Run Artifacts (created per run)

All paths are relative to `<project-root>/.super-ralph/runs/<runId>/`.

| File | Write mode | Trigger | Module |
| --- | --- | --- | --- |
| `session.json` | Overwrite | Every `EngineEvent` and `finalize` | `src/run-state.ts:66–70` |
| `events.jsonl` | Append | Every `EngineEvent` | `src/run-state.ts:103` |
| `iterations/<NNN>-<label>.log` | Create | After each iteration if output exists | `src/run-state.ts:107–128` |

In addition, `.super-ralph/session.json` (global pointer) is overwritten
on every state flush alongside the per-run `session.json`
(`src/run-state.ts:69`).

### Progress Log

| File | Write mode | Trigger | Module |
| --- | --- | --- | --- |
| `.super-ralph/progress.md` | Append | After every iteration | `src/progress.ts:appendProgress` |

The file is created on first append if it does not exist. It is never
truncated or rewritten during a run.

### Init Scaffolding (created once by `super-ralph init`)

| File | Write mode | Condition | Module |
| --- | --- | --- | --- |
| `.super-ralph/config.toml` | Create | Only if absent | `src/init.ts` |
| `.super-ralph/forward.hbs` | Create | Only if absent | `src/init.ts` |
| `.super-ralph/decompose.hbs` | Create | Only if absent | `src/init.ts` |
| `.super-ralph/reverse.hbs` | Create | Only if absent | `src/init.ts` |
| `.super-ralph/intake-checklist.md` | Create | Only if absent | `src/init.ts` |
| `.opencode/plugins/super-ralph.js` | Create | Always | `src/init.ts` |
| `.opencode/package.json` | Create | Always | `src/init.ts` |
| `AGENTS.md` | Create or append | Creates if absent; appends if present | `src/init.ts` |
| `tasks/` | Create dir | Only if absent | `src/init.ts` |

### Phase-Produced Files

| File | Write mode | Produced by | Module |
| --- | --- | --- | --- |
| `docs/specs/<name>.md` (or `--output` dir) | Agent-managed | Agent during reverse phase | opencode session (agent) |
| `<flags.json>` | Create | After loop if `--json` flag | `src/index.ts` |

Spec files are written by the agent running inside the opencode session, not
by super-ralph directly. super-ralph creates the output directory
(`mkdirSync`, `src/reverse.ts`) but does not create or modify the spec file
itself.

### Directories Created

| Directory | Creator | Condition |
| --- | --- | --- |
| `.super-ralph/` | `src/init.ts` | `super-ralph init` |
| `.super-ralph/runs/` | `src/run-state.ts:40–42` | First run (recursive) |
| `.super-ralph/runs/<runId>/` | `src/run-state.ts:47` | Start of each run |
| `.super-ralph/runs/<runId>/iterations/` | `src/run-state.ts:47` | Start of each run |
| `.opencode/plugins/` | `src/init.ts` | `super-ralph init` |
| `tasks/` | `src/init.ts` | `super-ralph init` |
| `<outputDir>` (spec output) | `src/reverse.ts` | First reverse run |

All `mkdirSync` calls use `{ recursive: true }`, so intermediate directories
are created as needed.

---

## Network I/O

All network traffic is HTTP and SSE directed at the opencode server. There
are no direct outbound calls to third-party APIs; those are proxied by
opencode.

### opencode SDK Operations

Calls are made through `@opencode-ai/sdk` (`src/opencode.ts`). The server
runs locally and is discovered by its URL.

| Operation | SDK call | Caller | Purpose |
| --- | --- | --- | --- |
| Spawn server | `createOpencode({ port: 0 })` | `src/opencode.ts:startServer` | Start server on random port |
| Verify health | `client.session.list()` | `src/opencode.ts` | Confirm server is ready |
| Create session | `client.session.create(...)` | `src/opencode.ts:createSession` | Open a new agent session |
| Stream events | `v2.event.subscribe()` | `src/opencode.ts:runPrompt` | Receive SSE events |
| Send prompt | `v2.session.promptAsync(...)` | `src/opencode.ts:runPrompt` | Submit prompt non-blocking |
| Abort session | `v2.session.abort(...)` | `src/opencode.ts:runPrompt` | Stop on inactivity timeout |
| Fetch messages | `client.session.messages(...)` | `src/opencode.ts:runPrompt` | Read completion signal |
| Fetch diff | `client.session.diff(...)` | `src/opencode.ts:runPrompt` | Collect changed file paths |
| Reply to question | `client.question.reply(...)` | `src/interactive.ts` | Answer agent question |
| Reject question | `client.question.reject(...)` | `src/interactive.ts` | Dismiss unanswerable question |

### Inactivity Watchdog

The opencode adapter tracks the timestamp of the last received SSE event.
If no event arrives within `engine.inactivity_timeout_seconds` seconds, the
session is aborted via `v2.session.abort`. This fires independently of the
per-iteration `timeout_minutes` wall-clock deadline enforced by
`src/timeout.ts`. [CONFIRMED: `src/opencode.ts`]

---

## Child Process I/O

The `br` CLI is invoked as a child process by `src/beads.ts`. All calls
use `Bun.spawn` or equivalent with JSON output (`--json` flag). The calling
module reads `stdout`, parses it as JSON, and returns typed objects.
`stderr` from `br` is not captured and flows to the terminal.

| Command | Called by | Purpose |
| --- | --- | --- |
| `br ready --parent <epicId> --json --sort hybrid` | `src/beads.ts:getAllReady` | List unblocked, ready beads |
| `br show <beadId> --json` | `src/beads.ts:getBeadDetails` | Fetch full bead metadata |
| `br close <beadId> --suggest-next --json` | `src/beads.ts:closeBead` | Close a completed bead |
| `br show <epicId> --json` | `src/beads.ts:getAllBeads` | Fetch epic with children |
| `br list --all --json --id <id> ...` | `src/beads.ts:getAllBeads` | Fetch full bead list |
| `br create --type epic --title <t> --json` | `src/decompose.ts` | Create epic for decompose |
| `br init` | `src/init.ts` | Initialise beads workspace |
| `bun install --silent` | `src/init.ts` | Install opencode plugin deps |
| `bun --version` | `src/index.ts:cmdDoctor` | Health check |
| `br --version` | `src/index.ts:cmdDoctor` | Health check |

---

## Standard Streams

### stdout

All operator-visible output is written to `stdout`.

| Output type | Writer | Trigger |
| --- | --- | --- |
| Engine event lines | `src/events.ts:attachDefaultConsoleRenderer` | Each `EngineEvent` emitted |
| Agent SSE text deltas | `src/opencode.ts` via `process.stdout.write` | Character-by-character during session |
| Heartbeat messages | `src/opencode.ts` via `process.stdout.write` | Inactivity watchdog pulse |
| Status command output | `src/index.ts:cmdStatus` | `super-ralph status` |
| Doctor command output | `src/index.ts:cmdDoctor` | `super-ralph doctor` |
| `@clack/prompts` UI | `src/interactive.ts` | Interactive reverse mode |

### stderr

| Output type | Writer | Trigger |
| --- | --- | --- |
| Debug SSE event dump | `src/opencode.ts` | `SUPER_RALPH_DEBUG` env var set |
| Error messages | `console.error` across modules | Exception handling paths |

### stdin

stdin is read only in interactive reverse mode, where `@clack/prompts`
renders TTY prompts and reads operator keystrokes directly from stdin.
No other module reads stdin. [CONFIRMED: `src/interactive.ts`]

---

## Process Exit Codes

| Code | Condition |
| --- | --- |
| `0` | Run completed with `failed == 0`, or non-loop command succeeded |
| `1` | `result.failed > 0`, or any command-level error |

Exit code is set in `src/index.ts` after the phase command returns.

---

## I/O Ordering Guarantees

All file writes within a single `runPhaseLoop` call are synchronous and
sequential. There is no concurrent I/O within the process. The ordering
within a run is:

1. Run directory and `iterations/` subdirectory created (construction).
2. Initial `session.json` written (construction).
3. For each event: `events.jsonl` appended, then `session.json` overwritten.
4. After each iteration: `progress.md` appended, then transcript written.
5. On `finalize`: `session.json` overwritten with terminal status.

---

## Module References

| Module | Role |
| --- | --- |
| [`spec/modules/infrastructure/run-state.md`](../modules/infrastructure/run-state.md) | All per-run file writes |
| [`spec/modules/infrastructure/run-status.md`](../modules/infrastructure/run-status.md) | Per-run file reads (status command) |
| [`spec/modules/infrastructure/progress.md`](../modules/infrastructure/progress.md) | `progress.md` append and read |
| [`spec/modules/infrastructure/config.md`](../modules/infrastructure/config.md) | config file read |
| [`spec/modules/infrastructure/template.md`](../modules/infrastructure/template.md) | Template file reads |
| [`spec/modules/infrastructure/skills.md`](../modules/infrastructure/skills.md) | Skill file reads |
| [`spec/modules/infrastructure/init.md`](../modules/infrastructure/init.md) | All init scaffolding writes |
| [`spec/modules/integrations/opencode.md`](../modules/integrations/opencode.md) | All network I/O via SDK |
| [`spec/modules/integrations/beads.md`](../modules/integrations/beads.md) | All `br` subprocess calls |
| [`spec/modules/integrations/interactive.md`](../modules/integrations/interactive.md) | stdin reads via `@clack/prompts` |

## Open Questions

- Whether failed `br` subprocess exits (non-zero exit code) cause
  `src/beads.ts` to throw or return an empty result is not confirmed from
  source comments. [UNKNOWN]
- The maximum number of `events.jsonl` lines per run is unbounded; very
  long runs may produce large files. Whether any rotation or cap is applied
  is not observable from source. [UNKNOWN]
- The `opencode.url` config key is loaded but the actual server URL is
  determined at spawn time from the random port. The relationship between
  the configured URL and the runtime URL is not documented. [UNKNOWN]
