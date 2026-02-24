# All-in-One OpenCode UX Design

**Date:** 2026-02-23
**Status:** Draft
**Supersedes:** Launch wizard sections in PRD skills

## Problem

The super-ralph pipeline has two phases: planning (conversational, inside OpenCode) and execution (CLI, separate terminal). After planning finishes, the user must:

1. Open a second terminal
2. Start the OpenCode server (`opencode serve --port 4096`)
3. Run `bun run src/index.ts run --epic <ID>`

This is fragmented. The user is already inside OpenCode for planning — execution should happen there too.

Additionally:
- `npx super-ralph run` is referenced in skills but the package is not published to npm
- Prerequisites (bun, br, OpenCode) are not validated upfront
- The `doctor` command exists but is not documented or integrated into the flow

## Decision

**Execution via shell command from the agent.** After planning completes, the agent runs the execution loop as a shell command inside the OpenCode session. The user stays in the TUI. Toast notifications fire per bead. Output streams in the chat.

This was chosen over:
- **Plugin tool:** Would block the agent's session for 30+ minutes with no way to interact. Simpler but worse UX.
- **Session-per-bead from agent:** Orchestration logic would live in the prompt instead of TypeScript. Fragile, hard to debug.

## Design

### User flow

```
1. User opens OpenCode in their project
   $ opencode

2. Init (first time)
   > /superralph:init
   Agent scaffolds .super-ralph/, config, beads workspace
   Agent records CLI path in config

3. Plan
   > /superralph:feature "add auth"
   ... intake, design, PRD, beads ...
   Agent: "Epic bd-xyz created. Execute now?"

4. Execute (same session)
   Agent runs: bun run /path/to/src/index.ts run --epic bd-xyz
   Output streams in chat. Toasts fire per bead.

5. Resume (if interrupted)
   > /superralph:resume
   Agent re-runs the command
```

No second terminal. No server management. No npm package needed.

### Changes required

#### 1. Add `cli_path` to config

Add a `[cli]` section to `.super-ralph/config.toml`:

```toml
[cli]
# Absolute path to the super-ralph CLI entry point
path = "/Users/mat/dev/farsight/agent-framework/src/index.ts"
```

The init skill detects this automatically from the install location.

The execution command becomes:
```bash
bun run <cli_path> run --epic <ID>
```

#### 2. Update PRD skill launch wizards

All five PRD skills (feature, bug, hotfix, refactor, plan) have a launch wizard at the end that references `npx super-ralph run`. Update to:

- Read `cli_path` from `.super-ralph/config.toml`
- **Run now:** Agent executes `bun run <cli_path> run --epic <ID>` via shell
- **Copy command:** Copy to clipboard
- **Show command:** Display it

#### 3. Update resume command

Same change — read `cli_path` from config, use `bun run <cli_path>` instead of `npx`.

#### 4. Make `doctor` interactive and helpful

Current `doctor` (in `src/index.ts`) prints pass/fail. Update to:

For each failed check, print the specific fix command:
- `bun` missing: `curl -fsSL https://bun.sh/install | bash`
- `br` missing: `curl -fsSL "https://raw.githubusercontent.com/Dicklesworthstone/beads_rust/main/install.sh?$(date +%s)" | bash`
- `.beads/` missing: `br init`
- `.super-ralph/` missing: Run `/superralph:init`
- OpenCode not reachable: `opencode serve --port 4096` (or detect correct port if in TUI)
- Plugin missing: Copy from templates

When run by an agent (via the launch wizard or resume command), the agent can offer to run the fixable commands automatically before starting execution.

#### 5. Update init skill

- Detect and record `cli_path` in config
- Validate `bun` and `br` are installed (fail early, offer install commands)
- Initialize `.beads/` workspace if not present

#### 6. Update README

Document the actual user flow:
- Prerequisites: OpenCode, bun, br
- Init: `/superralph:init`
- Plan: `/superralph:feature "..."` (or bug/hotfix/refactor/plan)
- Execute: Happens automatically from the launch wizard
- Resume: `/superralph:resume`
- CLI (advanced): `bun run <path>/src/index.ts run --epic <ID>`

### What stays the same

- The TypeScript execution loop (engine.ts, opencode.ts, beads.ts)
- The OpenCode plugin (task_complete tool, system prompt injection)
- The br CLI usage
- The prompt templates
- The beads data model

### How toasts work

The execution loop (`engine.ts`) already calls `showToast()` via the OpenCode SDK client. When running as a shell command inside an OpenCode session, the loop connects to the same server (localhost:4096) and sends toast notifications. These appear in the TUI regardless of which session is active.

### Error recovery

- If the shell command is interrupted (Ctrl-C, context compaction), the user runs `/superralph:resume` to continue
- Beads track their own state — partially completed work is preserved
- The `--strategy retry` flag (default) retries failed beads up to 3 times
- The `doctor` command validates prerequisites before execution starts
