# super-ralph: Deep Source Material Analysis

> Prepared for clean-room specification authoring.
> This document describes WHAT the system does and WHY — not how the code is structured.

---

## 1. System Summary

**super-ralph** is a three-phase SDLC loop engine for AI-assisted software development. It orchestrates autonomous AI coding agents (via the OpenCode SDK) to perform structured software engineering work, with dependency-aware task tracking (via the `br` CLI / Beads system).

The system implements a pipeline of three phases:

1. **Reverse** — Generate a specification from inputs (human Q&A or autonomous analysis)
2. **Decompose** — Break a specification into dependency-ordered work items (beads)
3. **Forward** — Implement work items one at a time, respecting dependency order

Each phase shares a common engine that manages iteration loops, error recovery, event emission, progress logging, run state persistence, and sub-agent lifecycle. The engine is phase-agnostic; phases supply callbacks that define iteration-specific behavior.

---

## 2. Features and Capabilities

### 2.1 Three-Phase Pipeline

| Phase | Input | Output | Purpose |
|-------|-------|--------|---------|
| Reverse | Paths, URLs, descriptions, human answers | Markdown spec file | Understand WHAT to build |
| Decompose | Spec file | Epic + child beads with dependencies | Plan HOW to build it |
| Forward | Epic ID | Implemented code (closed beads) | Build it autonomously |

### 2.2 Execution Modes

- **Autonomous loop** (forward, decompose, reverse-autonomous): Engine iterates, dispatching prompts to a sub-agent per iteration.
- **Interactive session** (reverse-interactive): Single long session with human-in-the-loop Q&A via terminal UI.
- **Mixed mode** (reverse with inputs + `--interactive`): Seed inputs guide an interactive interrogation.
- **Dry-run** (`--dry-run`): Simulates iterations without starting a server or executing prompts.
- **Attach mode** (`--attach <url>`): Connects to an existing OpenCode server instead of starting an ephemeral one.

### 2.3 Error Recovery

Three configurable strategies (`config.engine.strategy`):
- **retry**: Re-attempt failed iterations up to `max_retries` times per iteration label.
- **skip**: Count as failed, continue to next iteration.
- **abort**: Count as failed, stop the loop immediately.

### 2.4 Observability

- **Event system**: 14 typed events emitted throughout the lifecycle (loop start/end, server lifecycle, iteration lifecycle, errors, retries).
- **Console renderer**: Human-readable real-time output of all events.
- **Run artifacts**: Per-run directory with `session.json` state, `events.jsonl` log, and per-iteration transcript files.
- **Progress log**: Append-only Markdown file recording every iteration result.
- **JSON output**: `--json <path>` writes structured `LoopResult` to a file for programmatic consumption.

### 2.5 Sub-Agent Integration

- Starts/connects to an OpenCode server.
- Creates named sessions per iteration.
- Streams SSE events in real time (text deltas, tool status, session lifecycle).
- Detects completion via a `task_complete` tool convention.
- Dual timeout: absolute timeout per iteration + inactivity watchdog.

### 2.6 Task Tracking (Beads)

- Beads are dependency-ordered work items managed by the external `br` CLI.
- Beads can be children of an epic (parent-child relationship).
- The forward phase picks the highest-priority unblocked bead each iteration.
- Closing a bead may unblock downstream beads.
- Hybrid sort combines priority and dependency ordering.

### 2.7 Prompt Customization

- Handlebars templates in `.super-ralph/` define prompts per phase.
- Templates are copied during `init` and can be edited per project.
- Skills (Markdown files) provide additional context injected into prompts.
- Built-in skills: `feature`, `bug`, `hotfix`, `refactor`.
- Custom skills via file path.

### 2.8 Model Routing

- Default model configurable in `config.toml`.
- Per-area model overrides via `[models.areas]` config section.
- Beads with `area:X` labels are routed to area-specific models.
- CLI `--model` flag overrides all configuration.
- Model format: `"provider/model"` (e.g., `"anthropic/claude-sonnet-4-6"`).

### 2.9 Health Checks (Doctor)

Preflight validation of the entire tool chain:
- Bun runtime available
- `br` CLI available
- Project initialized (`.super-ralph/` with templates and config)
- Beads workspace initialized (`.beads/`)
- CLI path valid
- No broken symlinks in `~/.config/opencode/`

---

## 3. CLI Interface

### 3.1 Binary Name

`super-ralph`

### 3.2 Command Structure

```
super-ralph <command> [options]
```

### 3.3 Commands

#### `forward` (alias: `run`)

Implements beads from an epic autonomously.

```
super-ralph forward --epic <ID> [--model <provider/model>] [--max-iterations <n>]
                    [--dry-run] [--attach <url>] [--json <path>]
```

**Required:** `--epic <ID>`
**Behavior:** Iterates over unblocked beads in priority order. Each iteration: picks the next ready bead, prompts the sub-agent to implement and close it, records results.
**Max iterations:** `2 * beadCount` (safety cap).
**Termination:** No ready beads remain (all done or all blocked) OR `phase_done` signal.

#### `decompose`

Creates beads from a specification file.

```
super-ralph decompose --spec <path> [--epic-title <title>] [--model <provider/model>]
                      [--max-iterations <n>] [--dry-run] [--attach <url>] [--json <path>]
```

**Required:** `--spec <path>` (must exist)
**Behavior:** Creates an epic, then iteratively creates child beads until the spec is fully covered. Re-reads the spec each iteration (supports external edits). May create multiple beads per iteration.
**Max iterations:** 50.
**Config flags:** `include_review`, `include_bugscan`, `include_audit` control quality gate bead creation.
**Termination:** `phase_done` signal from sub-agent.

#### `reverse`

Generates a specification from inputs.

```
super-ralph reverse [inputs...] [--skill <name-or-path>] [--interactive]
                    [--output <dir>] [--answers <path>] [--model <provider/model>]
                    [--max-iterations <n>] [--dry-run] [--attach <url>] [--json <path>]
```

**Mode detection:**
- No inputs, no `--interactive`: interactive (implied)
- Inputs without `--interactive`: autonomous
- Inputs with `--interactive`: mixed
- `--interactive` without inputs: interactive

**Autonomous behavior:** Iteratively refines a Markdown spec in `outputDir`. Each iteration reads the current spec and decides whether to refine or declare done.
**Max iterations (autonomous):** 20.
**Interactive behavior:** Single session with terminal Q&A via `@clack/prompts`. Sub-agent asks questions using the `question` tool; user answers via select/multiselect/text UI.
**Output directory:** Defaults to `docs/specs` (configurable).
**Answers file:** `--answers <path>` loads pre-recorded answers for automated testing.
**Termination:** `phase_done` when spec is complete.

#### `init`

Scaffolds a project for super-ralph.

```
super-ralph init
```

**Creates:**
- `.super-ralph/` directory
- `AGENTS.md`, prompt templates (`forward.hbs`, `decompose.hbs`, `reverse.hbs`), `intake-checklist.md`
- `config.toml` (from template, with CLI path patched)
- `.opencode/plugins/super-ralph.js` (provides `task_complete` tool)
- `.opencode/package.json` + `bun install` for plugin dependencies
- `tasks/` directory (legacy)
- `.beads/` workspace via `br init`
- Updates root `AGENTS.md` with reference to `.super-ralph/AGENTS.md`

**Skip-if-exists:** Safe to re-run; never overwrites existing files.

#### `status`

Shows progress information.

```
super-ralph status --epic <ID>
super-ralph status --run <runId|latest>
```

**`--epic`:** Shows bead progress (total, completed, remaining, individual bead statuses).
**`--run`:** Shows run artifact status (session state, event count, last event, latest transcript).
**Mutually exclusive:** Using both `--epic` and `--run` is an error.

#### `doctor`

Preflight health checks.

```
super-ralph doctor [--fix]
```

**Checks (in order):**
1. `bun --version` — runtime available
2. `br --version` — beads CLI available
3. `.super-ralph/AGENTS.md` exists
4. Template files exist (`forward.hbs`, `decompose.hbs`, `reverse.hbs`)
5. `.super-ralph/config.toml` exists
6. `.beads/` workspace exists
7. `cli.path` from config exists on disk
8. No broken symlinks in `~/.config/opencode/`

**`--fix`:** Auto-removes broken symlinks (check 8 only).
**Exit code:** 1 if any check fails.

#### `help` / `--help` / `-h`

Prints usage text and exits.

---

## 4. Configuration Format

**File:** `<projectDir>/.super-ralph/config.toml`

```toml
[engine]
timeout_minutes = 30              # Absolute timeout per iteration
inactivity_timeout_seconds = 180  # Inactivity watchdog per iteration
iteration_delay_ms = 2000         # Pause between iterations
strategy = "retry"                # "retry" | "skip" | "abort"
max_retries = 3                   # Max retries per iteration label

[opencode]
url = "http://localhost:4096"     # Default OpenCode server URL

[cli]
path = ""                         # Path to super-ralph CLI install

[models]
default = "anthropic/claude-sonnet-4-6"

[models.areas]
# Area-specific model overrides, e.g.:
# frontend = "anthropic/claude-sonnet-4-6"
# review = "anthropic/claude-opus-4-6"

[reverse]
output_dir = "docs/specs"         # Default output directory for specs

[decompose]
include_review = true             # Create review beads at boundaries
include_bugscan = true            # Create bugscan beads
include_audit = true              # Create audit beads
```

### 4.1 Config Loading Behavior

- Missing file: full defaults returned.
- Present file: shallow merge per section with defaults (file values override defaults at the section-key level).
- The `[models.areas]` sub-table is extracted separately from flat `[models]` keys.

### 4.2 Model Resolution Priority

1. CLI `--model` override (highest)
2. First `area:X` label on the bead matched against `[models.areas]`
3. `[models].default` (lowest)

Model string format: `"provider/model"` — split on first `/`. Error if no `/` present.

---

## 5. Dependencies and External Integrations

### 5.1 Runtime Dependencies

| Package | Purpose |
|---------|---------|
| `@clack/prompts` | Terminal UI for interactive Q&A (select, multiselect, text input) |
| `@iarna/toml` | TOML configuration parser |
| `@opencode-ai/sdk` | OpenCode AI agent SDK (v1 + v2 clients, session management, SSE) |
| `handlebars` | Prompt template compilation and rendering |

### 5.2 External CLI Tools

| Tool | Purpose | Required |
|------|---------|----------|
| `bun` | JavaScript runtime and build tool | Yes |
| `br` | Beads CLI for dependency-aware task tracking | Yes (for forward/decompose) |
| `opencode` | AI coding agent server (started as subprocess or attached) | Yes |

### 5.3 OpenCode SDK Communication

- **v1 client**: Session lifecycle (create, list, messages, diff, abort), TUI integration (toast).
- **v2 client**: Async prompt submission (`promptAsync`), SSE event streaming (`event.subscribe`).
- Both clients used simultaneously per session.

### 5.4 Beads CLI Commands Used

| Command | Purpose |
|---------|---------|
| `br init` | Initialize beads workspace |
| `br ready --parent <id> --json --sort hybrid` | List unblocked beads |
| `br show <id> --json` | Show bead/epic details |
| `br close <id> --suggest-next --json [--reason]` | Close a bead |
| `br list --all --json --id <id> [--id ...]` | List beads by ID |
| `br create --type epic --title <title> --json` | Create an epic |

**JSON parsing strategy:** Filter out non-JSON log lines by finding the first line starting with `[` or `{`.

**Status normalization:** `"done"` and `"completed"` → `"closed"`. `"in-progress"` → `"in_progress"`. Unknown → `"open"`.

---

## 6. Constraints

### 6.1 Runtime

- **Bun-only**: Uses `Bun.spawn` for subprocess management. Not Node.js compatible.
- **Single-process**: No parallelism within the loop. Iterations are strictly sequential.
- **No resume**: A failed run cannot be resumed from the last successful iteration.

### 6.2 Timeouts

- **Absolute**: `timeout_minutes` (default 30) per iteration via `Promise.race`.
- **Inactivity**: `inactivity_timeout_seconds` (default 180) — if no SSE events arrive within the window, the session is aborted and the iteration fails.
- **Heartbeat**: Every 30 seconds of idle, a status message is printed.
- **Poll granularity**: 10-second tick timer means inactivity detection has ~10s granularity.

### 6.3 Memory

- **Stream capture**: Bounded to 250,000 characters per buffer (raw and display independently). Tail-preserving truncation with `[truncated]` marker.

### 6.4 Filesystem

- All state is file-based. No database, no network state store.
- Synchronous I/O for state writes (reliability over performance).
- Dual-write pattern: per-run state + global state mirror.

### 6.5 Sub-Agent Protocol

- The sub-agent MUST call the `task_complete` tool to signal completion status.
- Without `task_complete`, the iteration is classified as `"stalled"`.
- The `task_complete` tool is provided via the `.opencode/plugins/super-ralph.js` plugin.
- Completion status vocabulary: `complete`, `phase_done`, `blocked`, `failed`.

### 6.6 Configuration

- TOML format only (no JSON/YAML alternative).
- Shallow merge: file values override defaults at the section-key level, not deeply.
- Model strings must contain `/` separator.

---

## 7. Edge Cases and Error Handling

### 7.1 Engine Level

- **Exception during prompt execution**: Caught, recorded as `"error"` status, emitted as `iteration.error`. Strategy determines whether to retry, skip, or abort.
- **Exception during callbacks** (`setup`, `nextIteration`, `handleResult`): Propagates to outer try/finally. Run finalized as `"failed"`, all resources cleaned up.
- **Server startup failure**: Verified via `client.session.list()`. If unreachable, server is closed and error thrown.
- **Inactivity timeout**: Best-effort session abort, then error thrown (handled by engine error strategy).
- **Absolute timeout**: Via `Promise.race`. Original promise remains pending (no cancellation); cleanup is engine's responsibility.
- **Zero or negative timeout**: `setTimeout` fires immediately, causing near-instant rejection.
- **Guaranteed cleanup**: `finally` block always detaches listeners, finalizes run tracker, closes server.

### 7.2 Forward Phase

- **No ready beads, remaining > 0**: Logged as stall (blocked beads with unmet dependencies). Loop stops gracefully.
- **Max iterations cap**: `2 * beadCount` prevents runaway loops.

### 7.3 Decompose Phase

- **Missing spec file**: Throws immediately during setup.
- **Spec re-read each iteration**: Supports external edits during decomposition.
- **Dry-run**: Uses placeholder epic ID `"dry-run-epic"`, skips epic creation.
- **`br create` response format**: Handles both array and single-object responses.

### 7.4 Reverse Phase

- **Output directory missing**: Created recursively.
- **Interactive timeout**: Best-effort abort, then re-throws.
- **User cancellation (Ctrl+C)**: Question rejected, session returns `"blocked"` result.
- **Autonomous anti-over-iteration**: Prompt explicitly instructs sub-agent not to over-iterate.

### 7.5 Beads Integration

- **Non-zero exit from `br`**: Throws with stderr content and args.
- **Empty results**: Returns `[]` (not an error).
- **Broken symlinks in OpenCode config**: Pre-flight detection with optional auto-fix.

### 7.6 Interactive Session

- **SSE stream ending**: Breaks loop cleanly.
- **Stream capture overflow**: Truncates from head, keeps tail.
- **Unknown tool statuses**: Silently ignored.
- **Question with no options selected**: Falls back to text input (if custom allowed).
- **Mock answer matching**: Case-insensitive substring. Unmatched defaults to first option.

### 7.7 Initialization

- **Missing templates**: Warning printed, not fatal.
- **Failed `bun install`**: Warning printed, not fatal.
- **Failed `br init`**: Warning printed, not fatal.
- **Existing files**: Never overwritten (skip-if-exists semantics).

---

## 8. Data Formats

### 8.1 LoopResult (JSON output)

```typescript
{
  completed: number;
  failed: number;
  skipped: number;
  totalTime: number;       // milliseconds
  maxIterations: number;
  iterations: Array<{
    iteration: number;
    beadId: string;
    beadTitle: string;
    status: "complete" | "phase_done" | "blocked" | "failed" | "stalled" | "timeout" | "error";
    reason?: string;
    model: string;
    duration: number;      // milliseconds
    cost?: number;         // USD
    tokens?: { input: number; output: number; reasoning: number };
    filesChanged?: string[];
    transcriptPath?: string;
  }>;
}
```

### 8.2 CompletionResult (task_complete protocol)

```typescript
{
  status: "complete" | "phase_done" | "blocked" | "failed" | "stalled" | "timeout" | "error";
  reason?: string;
}
```

### 8.3 BeadInfo

```typescript
{
  id: string;
  title: string;
  description?: string;
  status: "open" | "in_progress" | "closed";
  labels: string[];
  priority: number;       // 0 (critical) to 4
  dependsOn: string[];
  blocks: string[];
  type?: string;          // "epic", "task", etc.
  parentId?: string;
}
```

### 8.4 SessionState (run tracker)

```typescript
{
  runId: string;           // "<timestamp>-<random6chars>"
  status: "running" | "completed" | "failed";
  description: string;
  maxIterations: number;
  startedAt: string;       // ISO 8601
  updatedAt: string;       // ISO 8601
  currentIteration: number;
  completed: number;
  failed: number;
  skipped: number;
}
```

### 8.5 Engine Events (events.jsonl)

Each line is a JSON object with a `type` field discriminating the event variant. 14 event types total (see section 2.4).

### 8.6 Progress File (progress.md)

Append-only Markdown. Each iteration entry:

```markdown
## Iteration N — <beadId>: <beadTitle> [STATUS]
- Model: <provider/model>
- Duration: <Xm Ys>
- Cost: $<amount>
- Tokens: <input> in / <output> out / <reasoning> reasoning
- Files changed: <file1>, <file2>
- Transcript: <relative-path>
- Notes: <reason>
```

### 8.7 Filesystem Layout

```
<project>/
  .super-ralph/
    config.toml                    # Configuration
    AGENTS.md                      # Agent instructions
    forward.hbs                    # Forward phase prompt template
    decompose.hbs                  # Decompose phase prompt template
    reverse.hbs                    # Reverse phase prompt template
    intake-checklist.md            # Intake checklist
    progress.md                    # Append-only progress log
    session.json                   # Global state mirror (latest run)
    runs/
      <runId>/
        session.json               # Per-run state
        events.jsonl               # Append-only event log
        iterations/
          001-<label>.log          # Per-iteration transcript
          002-<label>.log
          ...
  .opencode/
    plugins/
      super-ralph.js               # task_complete plugin
    package.json                   # Plugin dependencies
    node_modules/                  # Installed dependencies
  .beads/
    issues.jsonl                   # Beads data store
    ...
```

---

## 9. Design Decisions and Rationale

### 9.1 Callback-Driven Engine

The engine is phase-agnostic. Phases provide `setup`, `nextIteration`, and `handleResult` callbacks. This separates universal concerns (server lifecycle, error recovery, observability, resource cleanup) from phase-specific logic (bead selection, spec refinement, decomposition strategy). New phases can be added by implementing `PhaseCallbacks`.

### 9.2 Interactive Reverse Breaks the Pattern

The interactive reverse path does NOT use `runPhaseLoop`. It manages its own server/session lifecycle because interactive Q&A is fundamentally different from autonomous iteration (single long session vs. many short sessions). This is an explicit architectural divergence, accepted to avoid forcing a square peg into a round hole.

### 9.3 task_complete Convention

The sub-agent signals completion status by calling a `task_complete` tool. The engine detects this tool call in the session message history after the session goes idle. If the agent never calls it, the status is `"stalled"`. This structured signaling avoids parsing free-text output and provides reliable status detection.

### 9.4 Ephemeral Server by Default

Starting a fresh OpenCode server per run avoids state pollution across runs. The `--attach` flag supports debugging by connecting to an existing TUI-visible server.

### 9.5 No CLI Framework

Hand-rolled argument parser keeps the binary small and avoids framework-specific conventions, at the cost of validation, help generation, and error messages for malformed input.

### 9.6 TOML Configuration

Human-readable, supports comments, nested tables map well to the config shape. TOML over JSON/YAML was chosen for readability and simplicity.

### 9.7 Handlebars Templates

Allows project-level customization of prompts without code changes. Templates are copied during `init` and can be edited per project. No custom helpers — only Handlebars built-ins — keeps templates portable and auditable.

### 9.8 Retry by Label, Not Number

Retry tracking is keyed by `iterationLabel` (the bead title/identifier), not by iteration number. When retrying, the iteration counter is decremented so `nextIteration` receives the same argument again. This ensures the same logical task is re-attempted.

### 9.9 Dual-Write State

Per-run state in `runs/<runId>/session.json` plus a global mirror at `.super-ralph/session.json` enables both historical per-run inspection and quick "what's happening now" queries without resolving the latest run.

### 9.10 Progress as Cross-Iteration Memory

Since each sub-agent session is stateless, the progress file is the primary mechanism for later iterations to learn from earlier ones. The forward phase injects the last 5 progress entries into each prompt, giving the sub-agent awareness of recent work.

### 9.11 Tail-Preserving Truncation

Stream capture truncates from the head, keeping the most recent 250K characters. Recent output is more useful than early output for debugging and progress tracking.

### 9.12 Mock Answers for Testing

The `--answers` flag and module-level mock state enable automated testing of the interactive reverse flow without human interaction. This is specifically designed for CI/E2E test scenarios.

### 9.13 Skip-If-Exists Initialization

`init` is safe to re-run. It never overwrites existing files, only fills gaps. This supports incremental setup and prevents accidental loss of customizations.

### 9.14 Model Routing by Area Labels

Semantic labels on beads (`area:frontend`, `area:review`) allow different AI models for different types of work. This enables cost optimization (cheaper models for simple tasks) and capability matching (stronger models for complex tasks) without changing bead definitions.

### 9.15 Synchronous Filesystem I/O

State writes use synchronous I/O for reliability. These operations happen between iterations, not during streaming, so blocking is acceptable and simplifies error handling. The `finally` block cleanup guarantees depend on synchronous operations completing.

---

## 10. Event System Details

### 10.1 Complete Event Catalog

| Event Type | Payload Fields | When Emitted |
|-----------|---------------|-------------|
| `loop.description` | `description` | Start of run, after setup |
| `loop.dry_run_iteration` | `iteration, label, model` | Each iteration in dry-run mode |
| `loop.dry_run_complete` | `iterations, maxIterations` | End of dry-run |
| `server.started` | `url` | After starting ephemeral server |
| `server.attached` | `url` | After connecting to existing server |
| `server.attach_hint` | `url` | After server start (TUI hint) |
| `iteration.started` | `iteration, label, model` | Before each iteration executes |
| `iteration.session_created` | `sessionId` | After OpenCode session created |
| `iteration.completed` | `iteration, label, status, reason?` | Iteration succeeded (`complete` or `phase_done`) |
| `iteration.blocked` | `iteration, label, reason?` | Iteration returned `blocked` |
| `iteration.retrying` | `iteration, label, status, attempt, maxRetries` | Retry scheduled |
| `iteration.failed` | `iteration, label, status, action` | Failed, being skipped or aborting |
| `iteration.error` | `iteration, label, error` | Exception caught during iteration |
| `loop.completed` | `completed, failed, skipped, totalTimeMs` | Loop finished (normal exit) |

### 10.2 Event Flow

```
Engine emits event
  → EngineEventEmitter.emit()
    → Console renderer listener (writes to stdout)
    → RunTracker.recordEvent() listener
      → Appends to events.jsonl
      → Updates SessionState counters
      → Writes session.json (both per-run and global)
    → External listener (if provided via onEvent parameter)
```

### 10.3 State Consistency

The run tracker incrementally updates counters from events. At loop end, the `loop.completed` event carries the engine's authoritative counts, and the run tracker overwrites its incremental counts. This corrects any drift from retry decrements that the tracker doesn't model.

### 10.4 Emitter Characteristics

- Synchronous emission (no async, no buffering).
- Set-based listeners (no duplicate registrations).
- No error isolation between listeners (a throwing listener crashes the emitter).
- No event replay or history.
- Listener cleanup via returned unsubscribe closures.

---

## 11. SSE Streaming Protocol

### 11.1 Event Types Consumed from OpenCode

| SSE Event | Handling |
|-----------|----------|
| `message.part.delta` | Text deltas streamed to stdout. Filtered by session ID and `field === "text"`. |
| `message.part.updated` | Tool status changes displayed (`[tool: <name>]` + status). |
| `session.idle` | Session complete. Breaks event loop. |
| `session.error` | Error captured. Breaks event loop. |
| `question.asked` | (Interactive only) Questions rendered via `@clack/prompts`. |

### 11.2 Streaming Pattern

1. Subscribe to SSE **before** sending prompt (prevents race conditions).
2. `Promise.race` between `iterator.next()` and 10-second tick timer.
3. Inactivity watchdog: throws after configurable timeout of no events.
4. Heartbeat: prints status every 30 seconds of idle.
5. On inactivity timeout: best-effort `session.abort()` to prevent zombie sessions.
6. SSE stream explicitly closed in `finally` to prevent lingering connections.

### 11.3 Result Harvesting

After the SSE loop ends:
1. Fetch all session messages via v1 SDK.
2. Scan for `task_complete` tool call with `state.status === "completed"`.
3. Extract `input.status` and `input.reason` from the tool call.
4. Sum cost and tokens across all assistant messages.
5. Fetch diff for changed files (best-effort).

---

## 12. Dual Timeout Architecture

Two independent timeout mechanisms protect against stuck sessions:

### 12.1 Absolute Timeout

- **Source:** `config.engine.timeout_minutes` (default 30 minutes).
- **Mechanism:** `withTimeout()` wraps the entire `runPrompt()` call via `Promise.race`.
- **On fire:** Throws an error caught by the engine, recorded as `"error"` status.
- **Limitation:** Does not cancel the underlying operation (JavaScript promises are not cancellable).

### 12.2 Inactivity Timeout

- **Source:** `config.engine.inactivity_timeout_seconds` (default 180 seconds).
- **Mechanism:** Inside the SSE polling loop, tracks time since last event. Checked every 10 seconds (poll tick).
- **On fire:** Attempts to abort the OpenCode session, then throws an error.
- **Purpose:** Handles cases where the LLM backend stalls but the SSE connection stays alive.

---

## 13. Resource Cleanup Guarantees

The engine's `finally` block ensures:
1. Run tracker listener detached.
2. Run finalized as `"failed"` if not already finalized.
3. Server closed (ephemeral server killed; attached server no-op).
4. All event listeners detached.

This makes the engine safe against any exception path, including unexpected errors during setup, iteration, or callback execution.

---

## 14. Absence of Certain Features

Notable capabilities the system does NOT have:
- **No parallelism**: Iterations run strictly sequentially.
- **No resume**: Failed runs cannot be resumed from the last successful iteration.
- **No event replay**: Events are write-once; the reader only counts lines and reads the last event.
- **No external cancellation signal**: No signal handler or cancellation token for graceful mid-iteration stop.
- **No database**: All state is file-based.
- **No web UI**: Console-only output (though events can be consumed by external tools).
