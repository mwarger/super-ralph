# Core Workflows

> Behavioral specification of the primary user-visible workflows in the
> super-ralph agent framework, covering triggers, preconditions, normal flow,
> alternate flows, failure outcomes, and observable outputs.

**Source examined at commit:** `ecc95c0` (2026-02-27)

## Purpose

This document captures the end-to-end behavior of each command a project
operator can invoke. Each workflow section describes what the operator
observes from the outside: what to provide, what happens in sequence, what
changes on disk, and what can go wrong.

For internal module interactions see
[`spec/architecture/overview.md`](../architecture/overview.md) and
[`spec/architecture/runtime-lifecycle.md`](../architecture/runtime-lifecycle.md).

---

## WF-01: Project Initialization (`super-ralph init`)

**Summary:** Scaffolds a project for first use. Must be run once before any
phase command.

### Participating Modules

- `src/init.ts` — orchestrates all scaffolding steps
- `src/config.ts` — provides config defaults written to `config.toml`
- `src/index.ts` — CLI dispatch

### Trigger

The operator runs `super-ralph init` inside a project directory.

### Preconditions

- `bun` is installed and on `PATH`. [CONFIRMED: `src/init.ts`]
- `br` CLI is installed and on `PATH`. [CONFIRMED: `src/init.ts`]
- The working directory is the intended project root.
- `.super-ralph/` does not exist (idempotent if it does; existing files are
  preserved).

### Normal Flow

1. `src/init.ts:runInit` creates `.super-ralph/` if it does not exist.
2. Five template files are copied from the CLI's `templates/` directory into
   `.super-ralph/`. Any file that already exists at the destination is skipped.
3. `.super-ralph/config.toml` is written with defaults. The `cli.path` key is
   set to the absolute path of `src/index.ts` as detected at runtime.
4. `.opencode/plugins/super-ralph.js` is created (the `task_complete` plugin).
   `bun install` is run inside `.opencode/` to install its dependencies.
5. `tasks/` directory is created if absent.
6. If `.beads/` does not exist, `br init` is run to create the beads workspace.
7. `AGENTS.md` is created (or appended to) with a reference to
   `.super-ralph/AGENTS.md`.

### Alternate Flow: Re-run on Initialized Project

If `.super-ralph/` already exists, steps 2–7 are still attempted. Template
files that already exist are skipped without error. `br init` is skipped if
`.beads/` already exists. The command is safe to re-run.

### Failure Outcomes

| Condition | Observed Behavior |
| --- | --- |
| `bun` not on `PATH` | Step 4 fails; `bun install` exits non-zero; error is printed to stderr |
| `br` not on `PATH` | Step 6 fails; `br init` exits non-zero; error is printed to stderr |
| Write permission denied on project root | File creation fails; error propagates to stderr |

### Observable Outputs and State Changes

- `.super-ralph/` directory created.
- `.super-ralph/config.toml` written with defaults.
- `.super-ralph/forward.hbs`, `decompose.hbs`, `reverse.hbs` written.
- `.super-ralph/intake-checklist.md` and `AGENTS.md` written.
- `.opencode/plugins/super-ralph.js` written; `bun install` run in `.opencode/`.
- `tasks/` directory created.
- `.beads/` workspace initialized via `br init`.
- `AGENTS.md` in the project root created or updated.
- Exit code `0` on success; `1` on any error.

---

## WF-02: Spec Generation (`super-ralph reverse`)

**Summary:** Elicits requirements from the operator (interactively or from
provided inputs) and produces a Markdown spec file. Three sub-modes share
the same command.

### Participating Modules

- `src/reverse.ts` — phase orchestration and mode selection
- `src/engine.ts` — loop execution for autonomous mode
- `src/opencode.ts` — server lifecycle and prompt streaming
- `src/interactive.ts` — SSE event interception and terminal prompts
- `src/template.ts` — renders `reverse.hbs`
- `src/skills.ts` — resolves skill content
- `src/config.ts` — model resolution
- `src/run-state.ts` — run artifact persistence
- `src/progress.ts` — iteration progress log
- `src/events.ts` — event emission and console output
- `src/index.ts` — CLI dispatch

### Trigger

The operator runs one of:

```text
super-ralph reverse
super-ralph reverse [inputs...] [options]
super-ralph reverse [inputs...] --interactive [options]
```

### Preconditions

- `super-ralph init` has been run in the project directory.
- An opencode server can be started (API credentials available in the
  environment) unless `--dry-run` is set.
- If `--answers <path>` is supplied, the file exists and contains valid JSON.
- If `--skill <path>` is supplied with a file path, that file exists and is
  readable.

### Mode A: Interactive (no positional inputs)

#### Normal Flow

1. `src/reverse.ts` detects no positional inputs and spawns an event-loop
   that subscribes to SSE events from the opencode session.
2. `src/interactive.ts:runInteractiveSession` opens a session and sends the
   rendered `reverse.hbs` prompt with `{{interactive}}` enabled.
3. When the agent emits a `question.asked` SSE event, `src/interactive.ts`
   renders the question to the terminal using `@clack/prompts`.
4. The operator types or selects an answer; the answer is sent back to the
   agent via `question.reply`.
5. Steps 3–4 repeat until the agent has collected enough information.
6. The agent synthesizes and writes a Markdown spec file to `docs/specs/`
   (or `--output` directory) and calls `task_complete({ status: "complete" })`.
7. The session ends; the framework exits with code `0`.

#### Alternate Flow: Mock Answers (`--answers <path>`)

If `--answers <json>` is supplied, `src/interactive.ts:loadMockAnswers` reads
the file. When a `question.asked` event fires, stored answers are replayed in
order instead of prompting the terminal. Useful for automated testing.

### Mode B: Autonomous (positional inputs provided)

#### Normal Flow

1. `src/reverse.ts` constructs `PhaseCallbacks` and calls
   `src/engine.ts:runPhaseLoop`.
2. The engine loads config, creates a run tracker, and starts an opencode
   server.
3. Each iteration: `nextIteration` renders `reverse.hbs` with the inputs,
   optional skill content, and (on iterations > 1) the current spec file
   content for refinement.
4. The agent creates or refines the spec file and calls `task_complete`.
5. If `status` is `"complete"` or `"phase_done"`, the loop exits.
6. The run tracker finalizes; the server shuts down.

Maximum iterations: `--max-iterations` (default 20). [CONFIRMED: `src/reverse.ts`]

### Mode C: Mixed (inputs + `--interactive`)

The operator provides both positional inputs and `--interactive`. The inputs
are passed as context to the agent while the interactive question-answer flow
is still used. Behavior otherwise follows Mode A.

### Failure Outcomes

| Condition | Observed Behavior |
| --- | --- |
| No API credentials in environment | opencode server startup fails; error on stderr; exit `1` |
| Agent does not call `task_complete` | Result is `stalled`; failure strategy applied (`retry`/`skip`/`abort`) |
| Iteration limit reached | Loop exits with `failed > 0`; exit code `1` |
| `--answers` file not found or invalid JSON | Error thrown before session starts; exit `1` |
| Inactivity timeout (default 180 s) | Session aborted; result recorded as `timeout`; strategy applied |
| Hard timeout (default 30 min) | Session aborted; result recorded as `timeout`; strategy applied |

### Observable Outputs and State Changes

- Markdown spec file written to `docs/specs/<name>.md` (default) or
  `--output <dir>/<name>.md`.
- `.super-ralph/runs/<runId>/session.json` — run summary.
- `.super-ralph/runs/<runId>/events.jsonl` — structured event log.
- `.super-ralph/runs/<runId>/iterations/001-<label>.log` — transcript per
  iteration.
- `.super-ralph/progress.md` — iteration summary appended.
- `.super-ralph/session.json` — live run state mirror updated.
- Streaming text from the agent printed to stdout in real time.
- Exit code `0` if `failed == 0`; `1` otherwise.

---

## WF-03: Spec Decomposition (`super-ralph decompose`)

**Summary:** Reads a Markdown spec and creates a dependency-ordered set of
beads (tasks) under a new epic via the `br` CLI.

### Participating Modules

- `src/decompose.ts` — phase orchestration and bead creation logic
- `src/engine.ts` — loop execution
- `src/opencode.ts` — server lifecycle and prompt streaming
- `src/beads.ts` — `br` CLI adapter
- `src/template.ts` — renders `decompose.hbs`
- `src/config.ts` — model resolution
- `src/run-state.ts` — run artifact persistence
- `src/progress.ts` — iteration progress log
- `src/events.ts` — event emission and console output
- `src/index.ts` — CLI dispatch

### Trigger

```text
super-ralph decompose --spec <path> [options]
```

### Preconditions

- `super-ralph init` has been run.
- `--spec <path>` points to a readable Markdown file.
- `br` CLI is on `PATH` and `.beads/` workspace is initialized.
- opencode API credentials are available in the environment, unless
  `--dry-run` is set.

### Normal Flow

1. `src/decompose.ts` reads the spec file content.
2. An epic bead is created via `br create --type epic` with the title from
   `--epic-title` (or derived from the spec filename). The resulting epic ID
   is stored in memory for all subsequent calls.
3. The engine starts an opencode server and begins the iteration loop.
4. Each iteration: `nextIteration` renders `decompose.hbs` with the spec
   content, the epic ID, and the list of beads already created.
5. The agent analyzes the spec and the existing bead list, then calls `br
   create` to add one bead. It sets `area:` labels, `depends:` fields, and
   an appropriate title and description.
6. When the agent has created beads for all spec requirements, it calls
   `task_complete({ status: "phase_done" })`.
7. Depending on config flags, additional beads may be appended:
   review beads (`include_review`), bugscan beads (`include_bugscan`),
   and an audit bead (`include_audit`). [CONFIRMED: `src/decompose.ts`]
8. The loop exits; the server shuts down.

Maximum iterations: `--max-iterations` (default 50). [CONFIRMED: `src/decompose.ts`]

### Alternate Flow: Dry Run

With `--dry-run`, the engine iterates `nextIteration` to show which bead
would be created on each pass, but no opencode server starts and no `br
create` calls are made. Exits `0`.

### Failure Outcomes

| Condition | Observed Behavior |
| --- | --- |
| `--spec` file not found | Error on stderr before loop starts; exit `1` |
| `br create` fails | Exception propagates; iteration recorded as `error`; strategy applied |
| Agent does not call `task_complete` | Result is `stalled`; strategy applied |
| Iteration limit reached | Loop exits; if any iterations failed, exit code `1` |
| Epic creation fails | Error before loop; exit `1` |

### Observable Outputs and State Changes

- New epic bead created in `.beads/` via `br`.
- One child bead created per iteration in `.beads/` via `br`.
- Optional review, bugscan, and audit beads appended.
- `.super-ralph/runs/<runId>/` artifacts written.
- `.super-ralph/progress.md` appended per iteration.
- Streaming agent text printed to stdout.
- Exit code `0` if `failed == 0`; `1` otherwise.

---

## WF-04: Implementation (`super-ralph forward`)

**Summary:** Implements beads in dependency order. For each ready bead, an
agent session is created, the bead is implemented and committed, and the bead
is closed. The loop continues until no ready beads remain.

### Participating Modules

- `src/forward.ts` — phase orchestration and bead selection
- `src/engine.ts` — loop execution
- `src/opencode.ts` — server lifecycle and prompt streaming
- `src/beads.ts` — `br` CLI adapter
- `src/template.ts` — renders `forward.hbs`
- `src/config.ts` — model resolution (by area label)
- `src/progress.ts` — recent progress for agent context
- `src/run-state.ts` — run artifact persistence
- `src/events.ts` — event emission and console output
- `src/index.ts` — CLI dispatch

### Trigger

```text
super-ralph forward --epic <epicId> [options]
```

### Preconditions

- `super-ralph init` has been run.
- `--epic <epicId>` refers to an existing epic in `.beads/`.
- At least one child bead is in the `ready` state (dependencies satisfied).
- opencode API credentials are available, unless `--dry-run` is set.
- The project is a git repository (agents commit changes).

### Normal Flow

1. `src/forward.ts:setup` queries `br ready --epic <epicId>` to retrieve
   ready beads and determines `maxIterations` (default: twice the bead count).
2. The engine starts an opencode server.
3. Each iteration: `nextIteration` calls `br ready` again to get the current
   highest-priority ready bead.
4. `getBeadDetails` fetches full bead metadata (title, description, labels,
   dependencies).
5. Recent progress entries are read from `.super-ralph/progress.md` via
   `src/progress.ts:readRecentProgress`.
6. `forward.hbs` is rendered with all bead and progress data.
7. The model is resolved: CLI `--model` override, or `area:<X>` label mapped
   to `[models.areas].X` in config, or `[models].default`.
8. The agent receives the prompt and executes an 11-step implementation
   workflow (read progress → inspect bead → implement → quality gates →
   self-review → commit → close bead → update progress → call
   `task_complete`). [CONFIRMED: `templates/forward.hbs`]
9. After `task_complete({ status: "complete" })`, `handleResult` returns
   `true` to continue the loop.
10. When `br ready` returns no beads, `nextIteration` returns `null`; the
    loop exits normally.

### Alternate Flow: Agent Signals `phase_done`

If the agent calls `task_complete({ status: "phase_done" })`, `handleResult`
returns `false` and the loop exits cleanly. This is used when the agent
determines all epic work is complete even if `br ready` would normally
continue.

### Alternate Flow: bead Blocked

If the agent calls `task_complete({ status: "blocked" })`, the iteration
counter increments `skipped` (not `failed`) and the loop continues to the
next ready bead. The blocked bead remains open in `.beads/`.

### Alternate Flow: Dry Run

With `--dry-run`, the engine lists the sequence of beads that would be
implemented without starting a server or running any agent sessions.

### Alternate Flow: Attach Mode

With `--attach <url>`, the engine connects to an already-running opencode
server instead of spawning one. The server is not shut down when the loop
ends. [CONFIRMED: `src/engine.ts`]

### Failure Outcomes

| Condition | Observed Behavior |
| --- | --- |
| No ready beads at startup | `nextIteration` returns `null` immediately; loop exits; `0` beads processed; exit `0` |
| Agent does not call `task_complete` | Result is `stalled`; failure strategy applied |
| Agent calls `task_complete({ status: "failed" })` | Failure strategy applied (`retry`/`skip`/`abort`) |
| Iteration limit reached | Loop exits with `failed > 0`; exit code `1` |
| `br` CLI not on `PATH` | Exception on first `nextIteration`; loop aborts; exit `1` |
| Inactivity or hard timeout | Session aborted; result is `timeout`; strategy applied |

### Observable Outputs and State Changes

- Source files in the project modified or created by the agent.
- Git commits created by the agent (one per bead, [INFERRED] from template).
- beads closed in `.beads/` via `br close <beadId>` [CONFIRMED: `templates/forward.hbs`].
- `.super-ralph/progress.md` appended per iteration.
- `.super-ralph/runs/<runId>/` artifacts written.
- Streaming agent output printed to stdout.
- Exit code `0` if `failed == 0`; `1` otherwise.

---

## WF-05: Run Status (`super-ralph status`)

**Summary:** Reads and displays the state of a prior run or the current state
of an epic's beads.

### Participating Modules

- `src/run-status.ts` — reads run artifacts
- `src/beads.ts` — queries bead state for `--epic` mode
- `src/index.ts` — CLI dispatch

### Trigger

```text
super-ralph status --run <runId>
super-ralph status --run latest
super-ralph status --epic <epicId>
```

### Preconditions

- For `--run`: `.super-ralph/runs/` exists; the referenced run directory
  (or `latest`) is present.
- For `--epic`: `br` CLI is on `PATH`; `.beads/` workspace is initialized.

### Normal Flow: Run Mode

1. `src/run-status.ts:getRunStatus` resolves `"latest"` to the most recently
   created run directory (sorted by `runId` which is epoch-prefixed).
2. `session.json` is read from the run directory.
3. Counters (completed, skipped, failed), status, iteration log, and
   transcript path are returned and printed to stdout.

### Normal Flow: Epic Mode

1. `src/beads.ts:getEpicProgress` calls `br show --epic <epicId>` and
   `br list --epic <epicId>` to obtain total, completed, and remaining counts.
2. In-progress and open beads are listed by title.
3. Results are printed to stdout.

### Failure Outcomes

| Condition | Observed Behavior |
| --- | --- |
| `--run` refers to a non-existent run ID | Error on stderr; exit `1` |
| `--run latest` with no runs present | Error on stderr; exit `1` |
| `--epic` refers to an unknown epic | `br` CLI exits non-zero; error on stderr; exit `1` |

### Observable Outputs and State Changes

- Read-only. No files are written.
- Human-readable run summary or epic progress printed to stdout.
- Exit code `0` on success; `1` on error.

---

## WF-06: Environment Validation (`super-ralph doctor`)

**Summary:** Checks that all dependencies and project configuration are
correct. Optionally repairs fixable issues.

### Participating Modules

- `src/opencode.ts` — `checkBrokenSymlinks` and optionally `--fix`
- `src/index.ts` — CLI dispatch (doctor logic is inline)

### Trigger

```text
super-ralph doctor
super-ralph doctor --fix
```

### Preconditions

None. `doctor` is designed to be run before or instead of `init`.

### Normal Flow

The command checks the following items in order. Each item is printed as
pass or fail:

1. `bun` binary reachable on `PATH`.
2. `br` CLI binary reachable on `PATH`.
3. `.super-ralph/` directory exists.
4. All three `.hbs` template files exist in `.super-ralph/`.
5. `.super-ralph/config.toml` is readable and valid TOML.
6. `.beads/` workspace directory exists.
7. `config.toml:cli.path` points to a readable file.
8. Broken symlinks under `~/.config/opencode/` are detected.

With `--fix`: broken symlinks detected in step 8 are removed.

### Failure Outcomes

| Condition | Observed Behavior |
| --- | --- |
| Any check fails | That check is printed as failed; overall exit code `1` |
| All checks pass | Exit code `0` |
| `--fix` removes a symlink | A line reporting the removed path is printed to stdout |

### Observable Outputs and State Changes

- With `--fix`: broken symlinks under `~/.config/opencode/` removed.
- Without `--fix`: read-only.
- Pass/fail summary printed to stdout per check.
- Exit code `0` if all checks pass; `1` if any fail.

---

## WF-07: Agent Completion Signaling (`task_complete` tool)

**Summary:** The mechanism by which an AI agent running inside opencode
communicates iteration outcome back to the orchestrator. This is not
operator-invoked; it is agent-invoked.

### Participating Modules

- `.opencode/plugins/super-ralph.js` — registers the tool with the opencode
  server
- `src/opencode.ts` — scans session messages for tool-call results
- `src/engine.ts` — interprets `CompletionResult` and applies loop logic

### Trigger

An agent calls the `task_complete` tool during a session. The tool is
registered by `.opencode/plugins/super-ralph.js` at server startup.

### Preconditions

- The opencode server was started or attached by the engine.
- The `super-ralph.js` plugin is installed in `.opencode/plugins/`.

### Normal Flow

1. The agent calls `task_complete({ status: "<value>", reason: "<text>" })`.
2. The plugin records the call result in the session message history.
3. When the session goes idle (`session.idle` SSE event), `runPrompt`
   reads `session.messages()` and scans for a `task_complete` tool-call
   result with `state.status === "completed"`.
4. The `input.status` value and optional `input.reason` become the
   `CompletionResult` returned to the engine.
5. The engine increments the appropriate counter and evaluates whether to
   continue the loop.

### Status Values and Engine Behavior

| `status` value | Engine counter | Loop action |
| --- | --- | --- |
| `complete` | `completed++` | Continue (if `handleResult` returns `true`) |
| `phase_done` | `completed++` | Stop (`handleResult` returns `false`) |
| `blocked` | `skipped++` | Continue to next item |
| `failed` | — | Apply failure strategy |

### Failure Outcomes

| Condition | Observed Behavior |
| --- | --- |
| Agent never calls `task_complete` | Result is `stalled`; strategy applied |
| Plugin not installed | `task_complete` tool unavailable; agent cannot signal; always `stalled` |
| Session ends with `session.error` | Result is `error`; strategy applied |

### Observable Outputs and State Changes

- No filesystem changes directly.
- `CompletionResult` influences counters in `session.json`.
- `status` and `reason` appended to `.super-ralph/progress.md` entry.
- Loop continuation or termination determined.

---

## Cross-Workflow Relationships

The three phase commands form a pipeline. Each phase reads what the previous
phase wrote and writes what the next phase needs.

```text
WF-02 reverse  -->  docs/specs/<name>.md
                           |
                           v
WF-03 decompose -->  .beads/ (epic + child beads via br)
                           |
                           v
WF-04 forward  -->  project source files + git commits
```

WF-01 (`init`) must precede all phase commands. WF-05 (`status`) and
WF-06 (`doctor`) are utility commands that can be run at any point.
WF-07 (`task_complete`) is internal to every phase execution.

---

## Common Flags Across Phase Commands

The following flags apply to `reverse`, `decompose`, and `forward`.

| Flag | Effect |
| --- | --- |
| `--dry-run` | Shows what would run; no server started; no agent sessions |
| `--model <id>` | Overrides model resolution for all iterations |
| `--max-iterations <n>` | Caps the iteration count |
| `--attach <url>` | Connects to an existing opencode server instead of spawning |

---

## Open Questions

- Whether the agent's git commit is always a single commit per bead or
  can span multiple commits is not confirmed by code inspection. [UNKNOWN]
- The exact format of bead IDs returned by `br create` is not confirmed by
  code inspection of `src/beads.ts`. [UNKNOWN]
- The behavior when `--attach` is used and the external server shuts down
  mid-run is not fully characterized. [UNKNOWN]
