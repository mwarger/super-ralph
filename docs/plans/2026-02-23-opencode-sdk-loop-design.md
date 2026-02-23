# OpenCode SDK Execution Loop — Design Document

> Supersedes the ralph-tui dependency entirely. Super-ralph becomes a self-contained
> SDLC framework with its own execution loop built on the OpenCode SDK.

## Decision

Build a thin TypeScript CLI (`super-ralph`) that orchestrates autonomous bead
execution through the OpenCode SDK. This replaces ralph-tui for both Phase 1
(planning — via direct skill injection) and Phase 2 (execution — via SDK loop).

**Why not fork ralph-tui:** ~2000-3000 lines after trimming, subprocess management,
stdout parsing, agent plugin abstraction — all unnecessary when the OpenCode SDK
handles LLM sessions, rate limits, and retries natively.

**Estimated size:** ~800-1200 lines for the core loop + CLI.

## Architecture

```
Phase 1 (Planning):
  /superralph:feature "dark mode"
    → OpenCode loads skills/feature-prd/SKILL.md as instructions
    → Agent does intake, design, PRD, bead creation in current session
    → No external tool needed

Phase 2 (Execution):
  npx super-ralph run --epic <EPIC_ID>
    → CLI reads .super-ralph/config.toml
    → Loop: pick next bead (br ready) → render prompt (Handlebars)
      → create OpenCode session → send prompt with per-task model
      → watch SSE events for task_complete tool call
      → close bead (br close) → send toast → next bead
    → Exits when all beads complete or max iterations reached
```

### Components

**CLI entry point** (`src/index.ts`): Arg parsing, config loading, command dispatch.

**Engine** (`src/engine.ts`): Core loop — iterates over beads, manages sessions,
handles errors (retry/skip/abort), tracks progress.

**Beads module** (`src/beads.ts`): Wraps the `br` CLI. Key operations:
- `br ready --parent <epic-id> --json --limit 1` — next ready bead
- `br show <id> --json` — bead details and labels
- `br close <id> --suggest-next --json` — complete bead, get newly unblocked
- `br list --parent <epic-id> --json` — all beads for progress check

**OpenCode module** (`src/opencode.ts`): Wraps `@opencode-ai/sdk`. Key operations:
- `createOpencode()` or `createOpencodeClient()` — connect to server
- `client.session.create()` — new session per bead
- `client.session.promptAsync()` — send prompt without waiting
- SSE event subscription — watch for `message.part.updated` with tool calls
- `client.session.abort()` — timeout handling
- Toast notifications via `tui.toast.show` events

**Template module** (`src/template.ts`): Loads and renders `.super-ralph/prompt.hbs`
with bead context (task details, dependencies, recent progress).

**Config module** (`src/config.ts`): Loads `.super-ralph/config.toml`, merges with
CLI flags.

**Progress module** (`src/progress.ts`): Reads/writes `.super-ralph/progress.md`
for cross-iteration context.

### Plugin: task_complete tool

The existing `.opencode/plugins/super-ralph.js` gets a new tool registration:

```javascript
import { tool } from "@opencode-ai/plugin/tool";

tool: {
  task_complete: tool({
    description: "Signal completion of the current bead/task.",
    args: {
      status: tool.schema.enum(["complete", "blocked", "failed"]),
      reason: tool.schema.string().optional(),
    },
    async execute(args) {
      return `Task marked as ${args.status}`;
    },
  }),
}
```

The loop watches `message.part.updated` SSE events for `part.type === "tool"`
and `part.tool === "task_complete"` with `part.state.status === "completed"`.
The tool's execute function just returns a message — the actual bead state
change happens in the loop.

## Completion Detection

The `task_complete` tool is the primary signal. The agent calls it when done.

**Fallback:** If the session goes idle (status: "idle") without a `task_complete`
call, the loop treats it as a stalled/failed iteration and applies the error
strategy.

**Timeout:** Configurable per-bead timeout (default: 30 minutes). If exceeded,
the loop calls `session.abort()` and applies the error strategy.

## Per-Task Model Selection

Three layers, in priority order:

1. **CLI flag** (`--model`): Overrides everything
2. **Bead label** (`model:opus`): Per-bead override via br labels
3. **Auto-assignment** by bead type: REVIEW/AUDIT beads get the `review` model
   from config, BUGSCAN gets `bugscan` model (if configured)
4. **Config default** (`[models] default`): Fallback

The loop reads labels from `br show <id> --json`, checks for `model:*` labels,
and resolves to a `providerID/modelID` pair via the config mapping.

## Error Handling

Three strategies (matching ralph-tui's model):

- **retry**: Exponential backoff, up to `max_retries` (default 3). If all retries
  exhausted, falls through to skip.
- **skip**: Add bead to in-memory skip set, send warning toast, move to next bead.
- **abort**: Stop the entire loop immediately.

Rate limiting is handled by OpenCode internally. The loop sees `session.status`
events with `type: "retry"` and just waits.

## Beads Integration

Uses `br` (beads-rust CLI) exclusively. Key design decisions:

- **Task selection:** `br ready --parent <epic-id> --json --limit 1 --sort hybrid`.
  Hybrid sort puts P0/P1 first, then by creation order. No PageRank needed.
- **Completion:** `br close <id> --suggest-next --json` — closes and reports
  newly unblocked beads (used for toast messages).
- **Epic done check:** `br ready --parent <epic-id> --json --limit 1` returns
  empty array when all beads are closed.
- **PRD skills migrated from `bd` to `br`** as part of this work.

## Progress Tracking

After each iteration, the loop appends to `.super-ralph/progress.md`:

```markdown
## Iteration N — BEAD_ID: Title [STATUS]
- Model: provider/model
- Duration: Xm Ys
- Cost: $X.XX (if available from session)
- Files changed: (from session diff)
```

Before each prompt render, the loop reads the last 5 entries and passes them
to the template as `recentProgress`.

## CLI Interface

```
npx super-ralph run --epic <EPIC_ID> [options]
  --model <provider/model>     Override default model
  --max-iterations <n>         Max iterations (default: beads x 2)
  --timeout <minutes>          Per-bead timeout (default: 30)
  --strategy <retry|skip|abort> Error strategy (default: retry)
  --dry-run                    Show plan without executing
  --headless                   Skip toasts

npx super-ralph status --epic <EPIC_ID>
  Show epic progress

npx super-ralph doctor
  Preflight checks (br, opencode server, plugin)

npx super-ralph init
  Initialize project (templates, config, plugin)
```

## Config: `.super-ralph/config.toml`

```toml
[engine]
timeout_minutes = 30
iteration_delay_ms = 2000
strategy = "retry"
max_retries = 3

[opencode]
url = "http://localhost:4096"

[models]
default = "anthropic/claude-sonnet-4-6"
opus = "anthropic/claude-opus-4-6"
sonnet = "anthropic/claude-sonnet-4-6"

[models.auto]
review = "opus"
audit = "opus"
bugscan = "sonnet"
```

## UI: Toasts Only

The loop runs headless. You watch the active session in OpenCode's TUI.
Toast notifications announce:

- "Starting US-003: Create auth middleware" (info)
- "US-003 complete — REVIEW-001 now unblocked" (success)
- "US-003 failed, retrying (attempt 2/3)" (warning)
- "Epic EPIC-001 complete! 12 beads in 2h 15m" (success)

## Tech Stack

- **Runtime:** Bun (TypeScript)
- **Dependencies:** `@opencode-ai/sdk`, `handlebars`, TOML parser
- **Bead tracking:** `br` CLI (shelled out)
- **Plugin:** `@opencode-ai/plugin` (existing dependency)
- **No TUI framework** — OpenCode handles the UI

## Migration Scope

### New code
1. `src/` with ~6-7 TypeScript files (~800-1200 lines)
2. `package.json` + `tsconfig.json` at project root
3. Update `.opencode/plugins/super-ralph.js` with `task_complete` tool
4. `.super-ralph/config.toml` template in `templates/`
5. Update `skills/super-ralph-init/SKILL.md` for new config

### bd → br migration
6. Migrate all 5 PRD skills from `bd` to `br` commands
7. Update AGENTS.md template if it references `bd`
8. Update prompt.hbs template if it references `bd`

### Command rewrites (drop ralph-tui)
9. Rewrite feature, bug, hotfix, refactor, plan commands to directly
   invoke skills (no ralph-tui dispatcher)
10. Rewrite resume command to use super-ralph CLI
11. Rewrite status command to use br directly

### Cleanup
12. Remove `.ralph-tui/` directory from templates
13. Update README.md, INSTALL files
14. Update design docs to reflect new architecture

### Cross-iteration learning
15. Progress.md read/write in the loop
16. Template integration for recentProgress variable

## Not in Scope

- Web UI client
- Parallel execution / worktrees
- Custom OpenCode TUI panels
- Agent fallback (non-OpenCode agents)
