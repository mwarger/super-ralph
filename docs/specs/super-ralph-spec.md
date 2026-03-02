# super-ralph: Clean-Room Specification

> Version 1.0 — This document specifies the complete behavior of a three-phase
> SDLC loop engine for AI-assisted software development. An engineer with no
> knowledge of the original implementation MUST be able to build the system from
> this specification alone.

---

## 1. Purpose and Scope

### 1.1 Purpose

super-ralph is a command-line tool that orchestrates autonomous AI coding agents
through structured software development workflows. It connects two external
systems — an AI coding agent server and a dependency-aware task tracker — into a
repeatable, observable pipeline.

### 1.2 Scope

The system MUST implement:

- A three-phase pipeline: **Reverse** (specification generation), **Decompose**
  (task breakdown), and **Forward** (autonomous implementation).
- A phase-agnostic execution engine that manages iteration loops, error
  recovery, event emission, run state persistence, and sub-agent lifecycle.
- Integration with an external AI agent server (OpenCode) for prompt execution.
- Integration with an external task tracker (Beads / `br` CLI) for
  dependency-aware work item management.
- A CLI interface for invoking all functionality.
- An initialization command for project scaffolding.
- Health-check diagnostics for preflight validation.
- Run status reporting for progress inspection.

### 1.3 Out of Scope

The system MUST NOT implement:

- Parallel iteration execution.
- Run resumption from a failed iteration.
- Event replay or event stream consumption by external clients.
- External cancellation signals (signal handlers, cancellation tokens).
- Persistent storage beyond the filesystem (no database).
- Web-based user interfaces.

---

## 2. Behavior Specification

### 2.1 Phase-Agnostic Engine

#### 2.1.1 Overview

The engine is the core execution unit. It accepts a set of phase-specific
callbacks and executes an iteration loop. The engine is responsible for:

- Server lifecycle management (start or attach).
- Iteration loop execution with configurable error recovery.
- Event emission for all lifecycle transitions.
- Run state persistence (per-run and global mirror).
- Resource cleanup on all exit paths.

#### 2.1.2 Callback Interface

Each phase MUST provide a `PhaseCallbacks` object with three functions:

| Callback | Signature | Purpose |
|----------|-----------|---------|
| `setup` | `(context) → Promise<{ description: string, maxIterations: number }>` | Initialize phase-specific state. Returns a human-readable description and the maximum iteration count. |
| `nextIteration` | `(context, iterationNumber) → Promise<{ label: string, model: string, prompt: string } \| null>` | Produce the next iteration's work. Returns `null` to signal loop termination. |
| `handleResult` | `(context, iterationNumber, label, result) → Promise<void>` | Process the result of a completed iteration. |

The `context` object MUST provide access to:
- The loaded configuration.
- CLI options (dry-run flag, attach URL, model override).
- Helper functions for beads operations, prompt execution, and template rendering.

#### 2.1.3 Iteration Loop

The engine MUST execute iterations as follows:

1. Call `setup` to obtain description and max iterations.
2. Emit `loop.description` event.
3. If dry-run mode: for each iteration, emit `loop.dry_run_iteration`, then
   emit `loop.dry_run_complete`. Return a result with zero completions. Skip
   all remaining steps.
4. Start or attach to the OpenCode server (see §2.5).
5. Enter the iteration loop. For each iteration from 1 to `maxIterations`:
   a. If iteration > 1, pause for `config.engine.iteration_delay_ms` (default:
      2000ms). This prevents overwhelming the AI server.
   b. Call `nextIteration`. If it returns `null`, exit the loop.
   c. Emit `iteration.started`.
   d. Create an OpenCode session with a descriptive name.
   e. Emit `iteration.session_created`.
   f. Execute the prompt with dual timeout protection (see §2.6).
   g. Harvest the result (see §2.7).
   h. Record the iteration in the progress log.
   i. Call `handleResult` with the harvested result.
   j. Based on the result status:
      - `"complete"` or `"phase_done"`: Emit `iteration.completed`. Increment
        completed counter. If `"phase_done"`, exit the loop.
      - `"blocked"`: Emit `iteration.blocked`. Increment skipped counter.
      - Any other status: Apply the error strategy (see §2.1.4).
6. Emit `loop.completed` with final counters.
7. Write JSON output if `--json` flag was provided.
8. Return the `LoopResult` (see §4.1).

#### 2.1.4 Error Recovery Strategies

When an iteration fails (status is not `"complete"`, `"phase_done"`, or
`"blocked"`), the engine MUST apply the configured strategy:

**`"retry"` strategy:**
1. Check the retry count for the current iteration label.
2. If retries remain (count < `max_retries`):
   a. Emit `iteration.retrying` with attempt number.
   b. Decrement the iteration counter so the same logical task is re-attempted.
   c. Increment the retry count for this label.
   d. Continue the loop.
3. If retries exhausted: treat as `"skip"` (fall through).

**`"skip"` strategy:**
1. Emit `iteration.failed` with action `"skipping"`.
2. Increment the failed counter.
3. Continue the loop.

**`"abort"` strategy:**
1. Emit `iteration.failed` with action `"aborting"`.
2. Increment the failed counter.
3. Exit the loop immediately.

**Retry tracking:** Retry counts MUST be keyed by `iterationLabel` (the bead
ID or task identifier), not by iteration number. This ensures that when the
iteration counter is decremented for a retry, the same logical task is tracked
consistently.

**Retry invariant:** When the iteration counter is decremented for a retry,
`nextIteration` MUST return the same logical task on the next call. For the
Forward phase, this holds because `br ready` returns the same first-priority
unblocked bead as long as it hasn't been closed. If the ready list changes
between retry attempts (e.g., due to external bead closure), the engine will
simply pick the next available bead — this is acceptable and self-correcting.

#### 2.1.5 Exception Handling

- Exceptions during `runPrompt` (prompt execution): MUST be caught, recorded as
  `"error"` status, emitted as `iteration.error`, and handled by the error
  strategy.
- Exceptions during `setup`, `nextIteration`, or `handleResult`: MUST propagate
  to the outer try/finally. The run MUST be finalized as `"failed"` and all
  resources cleaned up.
- The engine's finally block MUST always execute, regardless of the exception
  path. See §2.8 for cleanup guarantees.

### 2.2 Forward Phase

#### 2.2.1 Purpose

Implement work items (beads) from an epic, one at a time, in dependency order.

#### 2.2.2 Setup

1. Fetch the epic details via `br show <epicId> --json`.
2. List all child beads.
3. Count the total beads, completed beads, and remaining beads.
4. Set `maxIterations` to `2 × totalBeadCount`. This safety cap MUST prevent
   runaway loops when beads are repeatedly retried.
5. Return description: `"Forward: <epicTitle> (<remaining>/<total> beads remaining)"`.

#### 2.2.3 Next Iteration

1. Query ready (unblocked) beads: `br ready --parent <epicId> --json --sort hybrid`.
2. If zero ready beads remain:
   a. Query total remaining open beads.
   b. If remaining > 0: log a stall warning (beads exist but all are blocked
      with unmet dependencies).
   c. Return `null` to terminate the loop.
3. Select the first ready bead.
4. Resolve the model for this bead (see §3.3 for model resolution).
5. Render the forward prompt template with the bead's context.
6. Return `{ label: bead.id, model, prompt }`.

#### 2.2.4 Prompt Context

The forward prompt template MUST receive:

- `beadId`: The bead's identifier.
- `beadTitle`: The bead's title.
- `beadDescription`: The bead's full description.
- `closingCommand`: The `br close` command the sub-agent must run on
  completion. Constructed as:
  `br close <beadId> --suggest-next --json --reason "<reason>"`. The sub-agent
  fills in the `<reason>` based on what it accomplished.
- `progressTail`: The last 5 entries from the progress log (for cross-iteration
  memory).

#### 2.2.5 Handle Result

No phase-specific post-processing is required. The engine's built-in result
recording is sufficient.

### 2.3 Decompose Phase

#### 2.3.1 Purpose

Break a specification file into dependency-ordered work items (beads) under a
new epic.

#### 2.3.2 Setup

1. Verify the spec file exists at the provided `--spec` path. If not, throw
   immediately.
2. If not dry-run: create an epic via `br create --type epic --title <title> --json`.
   If dry-run: use the placeholder epic ID `"dry-run-epic"`.
3. The epic title MUST default to `"Decompose: <specFileName>"` if `--epic-title`
   is not provided.
4. Set `maxIterations` to 50.
5. Return description: `"Decompose: <specPath> → <epicId>"`.

#### 2.3.3 Next Iteration

1. Re-read the spec file content. The spec MUST be re-read on every iteration
   to support external edits during decomposition.
2. List all beads currently under the epic.
3. Render the decompose prompt template with the spec content and existing beads.
4. Return `{ label: "decompose-<N>", model, prompt }`.

#### 2.3.4 Prompt Context

The decompose prompt template MUST receive:

- `specContent`: The full specification text (re-read each iteration).
- `epicId`: The epic identifier.
- `existingBeads`: List of beads already created under this epic.
- Decompose configuration flags: `include_review`, `include_bugscan`,
  `include_audit`.

#### 2.3.5 Handle Result

No phase-specific post-processing is required.

#### 2.3.6 Termination

The loop terminates when the sub-agent signals `"phase_done"`, indicating the
spec is fully decomposed into beads.

#### 2.3.7 `br create` Response Handling

The system MUST handle both array responses and single-object responses from
`br create`, as the CLI may return either format.

### 2.4 Reverse Phase

#### 2.4.1 Purpose

Generate a specification document from input materials via iterative refinement
(autonomous) or human-in-the-loop Q&A (interactive).

#### 2.4.2 Mode Detection

The system MUST determine the execution mode from the combination of inputs and
flags:

| Inputs Provided | `--interactive` Flag | Mode |
|----------------|---------------------|------|
| No | No | Interactive (implied) |
| No | Yes | Interactive |
| Yes | No | Autonomous |
| Yes | Yes | Mixed (inputs seed interactive session) |

#### 2.4.3 Output Directory

- The output directory MUST default to the value of `config.reverse.output_dir`
  (which itself defaults to `"docs/specs"`).
- The `--output` flag MUST override the configured default.
- If the output directory does not exist, the system MUST create it recursively.

#### 2.4.4 Autonomous Mode

Uses the standard engine loop.

**Setup:**
1. Collect all input materials (file paths, URLs, descriptions).
2. Set `maxIterations` to 20.
3. Return description: `"Reverse (autonomous): <inputSummary>"`.

**Output File Lifecycle:**

The output spec filename is **chosen by the sub-agent**, not by the engine. The
prompt template provides the output directory path and instructs the sub-agent to
write there. On the first iteration the template suggests a descriptive name
(e.g., `spec.md` or `<component-name>.md`). On subsequent iterations the
template includes the current filename so the sub-agent overwrites it in place.

To read the current spec, the engine scans the output directory for `.md` files
and selects the **most recently modified** one. This is the "current spec" for
the next iteration. If no `.md` files exist (first iteration), the current spec
is absent and the `isFirstIteration` flag is set to `true`.

Concretely:
- **First iteration:** No spec file exists. `currentSpec` is `""` (empty
  string), `currentSpecFilename` is `""`, and `isFirstIteration` is `true`. The
  prompt template renders a "No Spec Exists Yet" section instructing the
  sub-agent to create an initial draft.
- **Subsequent iterations:** The engine reads the most recently modified `.md`
  file. `currentSpec` contains the file's full text, `currentSpecFilename`
  contains its basename (e.g., `spec.md`), and `isFirstIteration` is `false`.
  The prompt template renders the current spec inline and instructs the sub-agent
  to refine it — rewriting the entire file, not appending.
- **Who writes the file:** The sub-agent writes the spec file to disk. The
  engine never writes spec content. The prompt template provides `outputDir` so
  the sub-agent knows where to write.

**Next Iteration:**
1. Scan the output directory for `.md` files; select the most recently modified
   one as the current spec (or `null` if none exist).
2. Render the reverse prompt template with input materials, current spec content,
   current spec filename, output directory path, first-iteration flag, and skill
   content.
3. The prompt MUST explicitly instruct the sub-agent not to over-iterate — it
   must declare `"phase_done"` when the spec is complete.
4. Return `{ label: "reverse-<N>", model, prompt }`.

**Termination:** `"phase_done"` signal from the sub-agent.

#### 2.4.5 Interactive Mode

Interactive mode MUST NOT use the standard engine loop. It manages its own
server/session lifecycle because interactive Q&A is fundamentally different from
autonomous iteration (single long session vs. many short sessions).

**Behavior:**
1. Start or attach to the OpenCode server.
2. Create a single session.
3. Send the initial prompt.
4. Enter the SSE streaming loop. When the sub-agent calls the `question` tool:
   a. Render the question to the terminal using `@clack/prompts`.
   b. Question types supported: `select` (single choice), `multiselect`
      (multiple choices), `text` (free-form input).
   c. If the user selects no options in a multiselect and custom input is
      allowed, fall back to text input.
   d. Return the user's answer to the sub-agent.
5. Continue streaming until the session goes idle or the sub-agent signals
   completion.

**User Cancellation:** If the user presses Ctrl+C during a question, the
question MUST be rejected, and the session MUST return a `"blocked"` result.

**Timeout:** Interactive mode MUST still enforce the absolute timeout. On
timeout, the session MUST be aborted (best-effort) and the error re-thrown.

#### 2.4.6 Mixed Mode

Mixed mode MUST behave like interactive mode, but the initial prompt MUST
include the seed input materials to guide the interrogation.

#### 2.4.7 Answers File

The `--answers <path>` flag MUST load pre-recorded answers from a file. When
answers are loaded:

- Questions are answered automatically without terminal UI.
- Answer matching MUST be case-insensitive substring matching against option
  labels.
- If no answer matches any option, the system MUST default to the first option.
- This feature exists specifically for automated testing / CI scenarios.

### 2.5 Server Lifecycle

#### 2.5.1 Ephemeral Server (Default)

1. The engine MUST start a new OpenCode server as a subprocess.
2. The server URL MUST default to `config.opencode.url` (default:
   `http://localhost:4096`).
3. After starting, the engine MUST verify the server is reachable by calling
   `client.session.list()`.
4. If the server is unreachable, the engine MUST close the server process and
   throw an error.
5. On cleanup, the engine MUST kill the server process.

**Rationale:** Starting a fresh server per run prevents state pollution across
runs.

#### 2.5.2 Attach Mode (`--attach <url>`)

1. The engine MUST connect to the server at the provided URL instead of
   starting a new one.
2. Server liveness MUST still be verified via `client.session.list()`.
3. On cleanup, the engine MUST NOT kill the attached server.

**Rationale:** Attach mode supports debugging by connecting to an existing
TUI-visible server.

#### 2.5.3 SDK Client Setup

The system MUST instantiate two OpenCode SDK clients simultaneously:

- **v1 client**: For session lifecycle operations (create, list, messages,
  diff, abort) and TUI integration (toast).
- **v2 client**: For async prompt submission (`promptAsync`) and SSE event
  streaming (`event.subscribe`).

Both clients MUST connect to the same server URL.

#### 2.5.4 OpenCode SDK Integration Reference

This section provides the concrete API surface an implementer needs to integrate
with the OpenCode SDK (`@opencode-ai/sdk`).

##### Server Startup (Ephemeral Mode)

The SDK provides a factory function that starts an embedded server as a
subprocess and returns a connected client:

```
import { createOpencode } from "@opencode-ai/sdk"

const { client, server } = await createOpencode({ port: 0 })
// port: 0 → OS assigns a random available port
// server.url  → "http://127.0.0.1:<assigned-port>"
// server.close() → kills the subprocess
```

There is no separate `opencode serve` command. The `createOpencode` factory
handles server process management internally.

##### Server Readiness Verification

After startup, the engine MUST verify reachability with a single
`client.session.list()` call. The `createOpencode` factory blocks until the
server is ready, so no polling loop is needed — a single list call confirms
connectivity. If it throws, close the server and propagate the error.

```
try {
  await client.session.list()
} catch (err) {
  server.close()
  throw new Error(`Server started but not responding: ${err.message}`)
}
```

For attach mode, construct a standalone client:

```
import { createOpencodeClient } from "@opencode-ai/sdk"

const client = createOpencodeClient({ baseUrl: url })
await client.session.list()  // verify reachability
```

##### SDK Client Construction

**v1 client** — the `client` returned by `createOpencode()`, or constructed via
`createOpencodeClient({ baseUrl })`. Used for session lifecycle:

- `client.session.create({ body: { title } })` → `{ data: Session }`
- `client.session.list()` → `{ data: Session[] }`
- `client.session.messages({ path: { id } })` → `{ data: Array<{ info: Message, parts: Part[] }> }`
- `client.session.diff({ path: { id } })` → `{ data: Array<{ file: string, ... }> }`
- `client.session.abort({ path: { id } })` → void
- `client.tui.showToast({ body: { message, variant, duration } })` → void

**v2 client** — separate import, flat parameter style:

```
import { createOpencodeClient as createV2Client } from "@opencode-ai/sdk/v2"

const v2 = createV2Client({ baseUrl: serverUrl })
```

Used for async prompt submission and SSE streaming:

- `v2.session.promptAsync({ sessionID, model, parts, system? })` → 204 (no body)
- `v2.event.subscribe()` → `{ stream: AsyncIterable<Event> }`
- `v2.session.abort({ sessionID })` → void

##### Session Creation

```
const response = await client.session.create({
  body: { title: "<loop-name> iteration <N>" }
})
const sessionId = response.data.id  // opaque string
```

The title is informational (visible in the TUI). Format:
`"<loop-description> iteration <N>"`, e.g.
`"deploy-pipeline iteration 3"`.

##### Prompt Execution

Prompts are sent via the v2 client's non-blocking `promptAsync`. It returns
HTTP 204 immediately — the actual work happens server-side. Results are observed
through the SSE stream.

```
await v2.session.promptAsync({
  sessionID: sessionId,
  model: { providerID: "anthropic", modelID: "claude-sonnet-4-20250514" },
  parts: [{ type: "text", text: promptContent }],
  system: systemPromptOrUndefined,
})
```

The `parts` array uses `TextPartInput` objects: `{ type: "text", text: string }`.
The `model` field requires both `providerID` and `modelID`.

##### SSE Event Subscription

The system MUST subscribe to the SSE stream BEFORE calling `promptAsync` to
avoid missing early events:

```
const { stream } = await v2.event.subscribe()
const iterator = stream[Symbol.asyncIterator]()

// Then send the prompt...
await v2.session.promptAsync({ ... })

// Then consume events:
while (true) {
  const { value: event, done } = await iterator.next()
  if (done) break
  // process event...
}
```

The stream is global (not session-scoped), so the consumer MUST filter events
by `sessionID` matching the current session.

**Event types the engine MUST handle:**

| Event type | Key properties | Meaning |
|---|---|---|
| `message.part.delta` | `sessionID`, `field: "text"`, `delta: string` | Real-time text chunk from the assistant |
| `message.part.updated` | `part: { type, tool, state }` | Tool call status change (pending → running → completed/error) |
| `session.idle` | `sessionID` | Session finished normally — exit the event loop |
| `session.error` | `sessionID`, `error: string \| { name, data: { message } }` | Session failed — exit the event loop |

On stream completion, the engine MUST explicitly close the iterator
(`stream.return(undefined)`) to avoid lingering SSE connections that delay
process exit.

##### Session Abort

Two equivalent APIs exist (v1 uses nested path, v2 uses flat params):

```
// v1 (used for explicit abort via engine API)
await client.session.abort({ path: { id: sessionId } })

// v2 (used for best-effort abort on inactivity timeout)
await v2.session.abort({ sessionID: sessionId })
```

Abort is best-effort — failures MUST be caught and ignored.

##### Session Message Format and Result Extraction

After the SSE loop ends, fetch the full message history via v1:

```
const allMsgs = await client.session.messages({ path: { id: sessionId } })
// allMsgs.data: Array<{ info: Message, parts: Part[] }>
```

**Message structure:**

- `info.role`: `"user"` or `"assistant"`
- `info.cost`: number (USD cost of this message)
- `info.tokens`: `{ input, output, reasoning, cache: { read, write } }`

**Part types** (union — check `part.type`):

- `"text"` — `{ type: "text", text: string }`
- `"tool"` — `{ type: "tool", tool: string, callID: string, state: ToolState }`
- Other types exist (reasoning, file, step, etc.) but are not needed for result
  extraction.

**ToolState** (when `state.status === "completed"`):

- `state.input`: `Record<string, unknown>` — the tool call arguments
- `state.output`: string — the tool's return value
- `state.title`: string — display title

**Result extraction:** Scan all messages for a part where
`part.type === "tool"` AND `part.tool === "task_complete"` AND
`part.state.status === "completed"`. Extract `state.input.status` (one of
`"complete"`, `"phase_done"`, `"blocked"`, `"failed"`) and
`state.input.reason` (optional string). If no `task_complete` tool call is
found, classify the iteration as `"stalled"`.

**Cost aggregation:** Sum `info.cost`, `info.tokens.input`,
`info.tokens.output`, and `info.tokens.reasoning` across all assistant messages
in the session.

### 2.6 Dual Timeout Architecture

Two independent timeout mechanisms MUST protect against stuck sessions:

#### 2.6.1 Absolute Timeout

- **Configuration:** `config.engine.timeout_minutes` (default: 30 minutes).
- **Mechanism:** The entire prompt execution function MUST be wrapped in a
  `Promise.race` against a timeout promise.
- **On expiry:** The timeout MUST throw an error. The engine catches this as an
  `"error"` status and applies the error strategy.
- **Limitation:** The underlying prompt promise remains pending (JavaScript
  promises are not cancellable). Cleanup is the engine's responsibility.
- **Edge case:** If `timeout_minutes` is zero or negative, the timeout fires
  immediately, causing near-instant rejection.

#### 2.6.2 Inactivity Timeout

- **Configuration:** `config.engine.inactivity_timeout_seconds` (default: 180
  seconds).
- **Mechanism:** Inside the SSE polling loop, the system MUST track the
  timestamp of the last received event. A poll timer checks every 10 seconds
  whether the elapsed time since the last event exceeds the inactivity
  threshold.
- **On expiry:** The system MUST attempt a best-effort session abort (to
  prevent zombie sessions), then throw an error.
- **Detection granularity:** Because the poll timer runs every 10 seconds,
  inactivity detection has approximately 10-second granularity.
- **Heartbeat:** Every 30 seconds of idle (no events), a status message MUST
  be printed to the console.

### 2.7 Result Harvesting

After the SSE streaming loop ends for an iteration, the system MUST harvest
results:

1. Fetch all session messages via the v1 SDK.
2. Scan message history for a `task_complete` tool call where the tool
   execution state (`part.state.status`) is `"completed"` — meaning the tool
   ran successfully, not that the task is complete. See §3.6.4 for the
   distinction between tool execution state and task status.
3. Extract `input.status` and `input.reason` from the tool call arguments
   (`part.state.input.status` and `part.state.input.reason`).
4. If no `task_complete` call is found, classify the iteration as `"stalled"`.
5. Sum cost and token counts across all assistant messages in the session.
6. Fetch the session diff for changed files (best-effort; failure MUST NOT
   prevent result return).

**Completion status vocabulary:**
- `"complete"`: The iteration's work was successfully finished.
- `"phase_done"`: The entire phase is finished (loop MUST terminate).
- `"blocked"`: The work cannot proceed (dependency issue, missing info).
- `"failed"`: The sub-agent could not complete the work.
- `"stalled"`: The sub-agent never called `task_complete`.
- `"timeout"`: The iteration exceeded the absolute or inactivity timeout.
- `"error"`: An exception occurred during execution.

### 2.8 Resource Cleanup Guarantees

The engine's finally block MUST execute on ALL exit paths and MUST perform:

1. Detach the run tracker event listener.
2. Finalize the run as `"failed"` if not already finalized.
3. Close the server (kill ephemeral server process; no-op for attached server).
4. Detach all event listeners.

This guarantees that no resources leak regardless of the exception path,
including unexpected errors during setup, iteration, or callback execution.

### 2.9 SSE Streaming Protocol

#### 2.9.1 Subscription Ordering

The system MUST subscribe to the SSE event stream BEFORE sending the prompt.
This prevents a race condition where early events are missed.

#### 2.9.2 Event Handling

| SSE Event Type | Handling |
|----------------|----------|
| `message.part.delta` | Stream text deltas to stdout. MUST filter by session ID and field `"text"` only. |
| `message.part.updated` | Display tool status changes as `[tool: <name>] <status>`. |
| `session.idle` | Session complete. MUST break the event loop. |
| `session.error` | Capture error. MUST break the event loop. |
| `question.asked` | (Interactive mode only) Render question via terminal UI. |

Unknown event types MUST be silently ignored.

#### 2.9.3 Polling Pattern

1. Race `iterator.next()` against a 10-second tick timer.
2. If tick wins: check inactivity watchdog. If within threshold, continue
   polling. If heartbeat interval reached, print status.
3. If event wins: reset the inactivity timer, process the event.
4. SSE stream MUST be explicitly closed in the `finally` block to prevent
   lingering connections.

#### 2.9.4 Stream Capture

The system MUST maintain two independent capture buffers for raw and display
output:

- **Maximum size:** 250,000 characters per buffer.
- **Truncation strategy:** Tail-preserving. When the buffer exceeds the
  maximum, truncate from the head and prepend a `[truncated]` marker.
- **Rationale:** Recent output is more diagnostically valuable than early
  output.

### 2.10 Progress Logging

#### 2.10.1 Format

The system MUST maintain an append-only Markdown file at
`.super-ralph/progress.md`. Each iteration MUST append an entry in this format:

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

#### 2.10.2 Cross-Iteration Memory

Since each sub-agent session is stateless (no memory of prior sessions), the
progress log serves as the primary cross-iteration memory mechanism. The
forward phase MUST inject the last 5 progress entries into each prompt, giving
the sub-agent awareness of what was recently completed.

---

## 3. Interfaces

### 3.1 CLI Interface

#### 3.1.1 Binary Name

The executable MUST be named `super-ralph`.

#### 3.1.2 Invocation

```
super-ralph <command> [options]
```

#### 3.1.3 Global Options

These options MUST be accepted by all phase commands (`forward`, `decompose`,
`reverse`):

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--model <provider/model>` | String | None | Override the model for all iterations. |
| `--max-iterations <n>` | Integer | Phase-specific | Override the maximum iteration count. |
| `--dry-run` | Flag | false | Simulate iterations without starting a server or executing prompts. |
| `--attach <url>` | String | None | Connect to an existing OpenCode server instead of starting one. |
| `--json <path>` | String | None | Write the structured `LoopResult` to the specified file path. |

#### 3.1.4 `forward` Command

**Aliases:** `run`

```
super-ralph forward --epic <ID> [global options]
```

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `--epic <ID>` | String | Yes | — | The epic bead ID to implement. |

**Behavior:** Iterates over unblocked beads in priority order. Each iteration
picks the next ready bead, prompts the sub-agent to implement and close it, and
records results.

**Default max iterations:** `2 × beadCount`.

**Termination conditions:**
- `nextIteration` returns `null` (no ready beads remain).
- Sub-agent signals `"phase_done"`.
- Max iterations reached.

#### 3.1.5 `decompose` Command

```
super-ralph decompose --spec <path> [--epic-title <title>] [global options]
```

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `--spec <path>` | String | Yes | — | Path to the specification file. MUST exist. |
| `--epic-title <title>` | String | No | `"Decompose: <specFileName>"` | Title for the created epic. |

**Behavior:** Creates an epic, then iteratively creates child beads until the
spec is fully covered.

**Default max iterations:** 50.

**Termination:** Sub-agent signals `"phase_done"`.

#### 3.1.6 `reverse` Command

```
super-ralph reverse [inputs...] [--skill <name-or-path>] [--interactive]
                    [--output <dir>] [--answers <path>] [global options]
```

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `inputs...` | Positional | No | — | Paths, URLs, or descriptions to analyze. |
| `--skill <name-or-path>` | String | No | None | Skill name or file path for additional prompt context. |
| `--interactive` | Flag | No | false | Enable interactive Q&A mode. |
| `--output <dir>` | String | No | `config.reverse.output_dir` | Output directory for generated spec. |
| `--answers <path>` | String | No | None | Path to pre-recorded answers file for automated testing. |

**Mode detection:** See §2.4.2.

**Default max iterations (autonomous):** 20.

#### 3.1.7 `init` Command

```
super-ralph init
```

**No options.** Scaffolds the project directory structure.

**Created artifacts:**
- `.super-ralph/` directory containing:
  - `AGENTS.md` — Agent instructions document.
  - `forward.hbs` — Forward phase prompt template.
  - `decompose.hbs` — Decompose phase prompt template.
  - `reverse.hbs` — Reverse phase prompt template.
  - `intake-checklist.md` — Intake checklist document.
  - `config.toml` — Configuration file (from template, with `cli.path` patched
    to the current CLI installation path).
- `.opencode/plugins/super-ralph.js` — The `task_complete` tool plugin.
- `.opencode/package.json` — Plugin dependencies manifest.
- `.opencode/node_modules/` — Installed plugin dependencies (via `bun install`).
- `tasks/` directory (legacy support).
- `.beads/` workspace (via `br init`).
- Root `AGENTS.md` MUST be updated with a reference to
  `.super-ralph/AGENTS.md`.

**Idempotency:** The command MUST be safe to re-run. It MUST NEVER overwrite
existing files. It MUST only create files that do not already exist.

**Failure tolerance:**
- Missing templates: Print warning, continue (not fatal).
- Failed `bun install`: Print warning, continue (not fatal).
- Failed `br init`: Print warning, continue (not fatal).

#### 3.1.8 `status` Command

```
super-ralph status --epic <ID>
super-ralph status --run <runId|latest>
```

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `--epic <ID>` | String | Mutually exclusive | Show bead progress for the specified epic. |
| `--run <runId\|latest>` | String | Mutually exclusive | Show run artifact status. `"latest"` resolves to the most recent run. |

**`--epic` output:** Total beads, completed count, remaining count, and
individual bead statuses.

**`--run` output:** Session state, event count, last event, and latest
transcript excerpt.

**Constraint:** Using both `--epic` and `--run` simultaneously MUST be an error.

#### 3.1.9 `doctor` Command

```
super-ralph doctor [--fix]
```

**Checks (executed in this order):**

| # | Check | Failure Message |
|---|-------|-----------------|
| 1 | `bun --version` succeeds | Bun runtime not available |
| 2 | `br --version` succeeds | Beads CLI not available |
| 3 | `.super-ralph/AGENTS.md` exists | Project not initialized |
| 4 | Template files exist (`forward.hbs`, `decompose.hbs`, `reverse.hbs`) | Missing prompt templates |
| 5 | `.super-ralph/config.toml` exists | Missing configuration file |
| 6 | `.beads/` directory exists | Beads workspace not initialized |
| 7 | `cli.path` from config resolves to an existing file | CLI path invalid |
| 8 | No broken symlinks in `~/.config/opencode/` | Broken symlinks detected |

**`--fix` flag:** MUST auto-remove broken symlinks (check 8 only). All other
checks require manual intervention.

**Exit code:** MUST be 1 if any check fails. MUST be 0 if all checks pass.

#### 3.1.10 `help` / `--help` / `-h`

Prints usage text and exits with code 0.

#### 3.1.11 Argument Parsing

The system MUST use a hand-rolled argument parser (no CLI framework). This
keeps the binary small and avoids framework-specific conventions.

**Trade-off:** No automatic validation, help generation, or error messages for
malformed input.

### 3.2 Environment Variables

No environment variables are defined by the system. All configuration is via
the config file and CLI flags.

### 3.3 Model Resolution

When determining which AI model to use for an iteration, the system MUST
resolve in this priority order (highest to lowest):

1. **CLI `--model` flag** — if provided, use this for all iterations.
2. **Area label match** — if the bead has a label matching `area:<X>` and
   `config.models.areas.<X>` is defined, use the area-specific model.
   If the bead has multiple `area:` labels, use the first match.
3. **Default model** — use `config.models.default`.

**Model string format:** `"<provider>/<model>"` (e.g.,
`"anthropic/claude-sonnet-4-6"`). The system MUST split on the first `/`
character. A model string without `/` MUST be treated as an error.

### 3.4 Prompt Templates

#### 3.4.1 Template Engine

The system MUST use Handlebars for prompt template rendering.

- Templates MUST reside in `.super-ralph/` with extensions `.hbs`.
- Only Handlebars built-in helpers are permitted — no custom helpers. This
  keeps templates portable and auditable.
- Templates are copied during `init` and can be edited per project for
  customization.

#### 3.4.2 Template Files

| File | Phase | Required Context Variables |
|------|-------|--------------------------|
| `forward.hbs` | Forward | `beadId`, `beadTitle`, `beadDescription`, `closingCommand`, `progressTail` |
| `decompose.hbs` | Decompose | `specContent`, `epicId`, `existingBeads`, `include_review`, `include_bugscan`, `include_audit` |
| `reverse.hbs` | Reverse | `interactive` (bool), `hasInputs` (bool), `inputs` (string[]), `outputDir` (string), `currentSpec` (string, empty on first iteration), `currentSpecFilename` (string, empty on first iteration), `isFirstIteration` (bool), `skillContent` (string or null) |

### 3.5 Skills System

Skills are Markdown files that provide additional context injected into
prompts.

**Built-in skills:** `feature`, `bug`, `hotfix`, `refactor`.

**Custom skills:** Specified via file path using the `--skill` flag on the
`reverse` command.

Skills MUST be injected into the prompt template context so that templates
can include skill content.

### 3.6 task_complete Plugin Interface

The `task_complete` tool is an OpenCode plugin that the sub-agent calls to
signal iteration completion.

#### 3.6.1 Plugin File Structure

**Plugin location:** `.opencode/plugins/super-ralph.js`

OpenCode plugins use the `@opencode-ai/plugin` package. A plugin file MUST
export a default async factory function that receives a context object and
returns a tool registration object.

**Plugin API contract:**

```javascript
import { tool } from "@opencode-ai/plugin";

export default async (ctx) => {
  return {
    tool: {
      <tool_name>: tool({
        description: "...",
        args: { /* Zod schemas via tool.schema */ },
        async execute(args) { return "string result"; },
      }),
    },
  };
};
```

**Key details:**

- The export MUST be a default export of an async function.
- The function receives a context object (`ctx`) provided by OpenCode.
- The return value MUST be an object with a `tool` property containing named
  tool definitions.
- Each tool definition uses the `tool()` helper from `@opencode-ai/plugin`.
- Tool argument schemas use `tool.schema`, which exposes Zod schema builders
  (e.g., `tool.schema.enum()`, `tool.schema.string().optional()`).
- The `execute` function is called when the sub-agent invokes the tool.
  It receives the validated arguments and MUST return a string.

#### 3.6.2 Complete Plugin Implementation

The `super-ralph.js` plugin MUST define a single tool named `task_complete`:

```javascript
import { tool } from "@opencode-ai/plugin";

export default async (ctx) => {
  return {
    tool: {
      task_complete: tool({
        description:
          "Signal task/iteration completion. MUST be called as the final action in every session.",
        args: {
          status: tool.schema
            .enum(["complete", "phase_done", "blocked", "failed"])
            .describe(
              'Completion status: "complete" = done, loop continues; '
              + '"phase_done" = all work done, loop ends; '
              + '"blocked" = cannot proceed; "failed" = error occurred',
            ),
          reason: tool.schema
            .string()
            .optional()
            .describe("Explanation of the status (required for blocked/failed)"),
        },
        async execute(args) {
          return `Task marked as ${args.status}${args.reason ? ": " + args.reason : ""}`;
        },
      }),
    },
  };
};
```

**Plugin behavior:** The plugin's `execute` function simply returns a
confirmation string. The plugin's purpose is to register the tool so the
sub-agent can call it. The engine does NOT read the `execute` return value;
it reads the tool call's arguments from the session message history after the
session ends (see §3.6.4).

#### 3.6.3 Package Dependencies

**File:** `.opencode/package.json`

```json
{
  "dependencies": {
    "@opencode-ai/plugin": "1.2.15"
  }
}
```

The `init` command (§3.1.7) MUST create this file and run `bun install` to
populate `.opencode/node_modules/`. The only required dependency is
`@opencode-ai/plugin`. OpenCode discovers plugins by scanning the
`.opencode/plugins/` directory automatically; no additional registration is
needed.

#### 3.6.4 Tool Input Parameters vs Tool Execution State

The `task_complete` tool call has two distinct "status" concepts that MUST NOT
be confused:

**Tool execution state** (`part.state.status`): Set by OpenCode's tool
execution runtime. The value `"completed"` means the tool's `execute` function
ran successfully and returned a result. Other possible values include
`"pending"` (queued) and `"error"` (execution failed). This is NOT set by the
plugin or the sub-agent.

**Tool input parameter** (`part.state.input.status`): Set by the sub-agent when
it calls the tool. One of `"complete"`, `"phase_done"`, `"blocked"`, or
`"failed"`. This is the value the engine uses to determine iteration outcome.

**Detection algorithm:** After a session goes idle, the engine scans session
message parts for a tool call matching ALL of:

1. `part.type === "tool"` — it is a tool call
2. `part.tool === "task_complete"` — it is the correct tool
3. `part.state.status === "completed"` — the tool **executed** successfully

If all three match, the engine extracts:

- `part.state.input.status` → the iteration's completion status
- `part.state.input.reason` → optional human-readable explanation

| Field | Source | Values | Meaning |
|-------|--------|--------|---------|
| `part.state.status` | OpenCode runtime | `"completed"`, `"pending"`, `"error"` | Whether the tool call executed |
| `part.state.input.status` | Sub-agent input | `"complete"`, `"phase_done"`, `"blocked"`, `"failed"` | What the sub-agent is signaling |

**Missing signal:** If no `task_complete` call is found (or the tool call's
execution state is not `"completed"`), the iteration MUST be classified as
`"stalled"`.

---

## 4. Data Model

### 4.1 LoopResult

The structured output of a complete engine run. Written to the `--json` path
if specified.

```
LoopResult {
  completed: integer       // Count of iterations with "complete" or "phase_done" status
  failed: integer          // Count of iterations that ultimately failed
  skipped: integer         // Count of iterations with "blocked" status
  totalTime: integer       // Total wall-clock time in milliseconds
  maxIterations: integer   // The configured maximum iteration count
  iterations: IterationResult[]
}
```

### 4.2 IterationResult

```
IterationResult {
  iteration: integer        // 1-based iteration number
  beadId: string            // The bead identifier (or synthetic label)
  beadTitle: string         // The bead title (or synthetic label)
  status: CompletionStatus  // See §4.3
  reason: string?           // Optional human-readable explanation
  model: string             // The "provider/model" string used
  duration: integer         // Wall-clock time in milliseconds
  cost: number?             // Estimated cost in USD
  tokens: TokenCounts?      // Token usage breakdown
  filesChanged: string[]?   // List of files modified
  transcriptPath: string?   // Relative path to the iteration transcript file
}
```

### 4.3 CompletionStatus

An enumeration of all valid iteration outcome statuses:

| Value | Meaning |
|-------|---------|
| `"complete"` | Iteration work finished successfully |
| `"phase_done"` | Entire phase finished; loop must terminate |
| `"blocked"` | Work cannot proceed (dependency/info issue) |
| `"failed"` | Sub-agent could not complete the work |
| `"stalled"` | Sub-agent never called `task_complete` |
| `"timeout"` | Iteration exceeded absolute or inactivity timeout |
| `"error"` | Exception occurred during execution |

### 4.4 TokenCounts

```
TokenCounts {
  input: integer       // Input tokens consumed
  output: integer      // Output tokens generated
  reasoning: integer   // Reasoning/thinking tokens consumed
}
```

### 4.5 BeadInfo

Represents a work item from the Beads system. This is the system's internal
representation after normalization.

```
BeadInfo {
  id: string              // Unique bead identifier
  title: string           // Human-readable title
  description: string?    // Full description text
  status: BeadStatus      // Normalized status (see §4.6)
  labels: string[]        // Labels including "area:<X>" for model routing
  priority: integer       // 0 (critical) to 4 (lowest)
  dependsOn: string[]     // IDs of beads this bead depends on
  blocks: string[]        // IDs of beads blocked by this bead
  type: string?           // "epic", "task", etc.
  parentId: string?       // Parent epic ID
}
```

### 4.6 BeadStatus Normalization

The `br` CLI may return various status strings. The system MUST normalize them:

| Raw Status | Normalized Status |
|-----------|-------------------|
| `"done"` | `"closed"` |
| `"completed"` | `"closed"` |
| `"in-progress"` | `"in_progress"` |
| Any unknown value | `"open"` |

### 4.7 SessionState

Persisted run state, written to both per-run and global locations.

```
SessionState {
  runId: string            // Format: "<timestamp>-<random6chars>"
  status: RunStatus        // "running", "completed", or "failed"
  description: string      // Human-readable run description
  maxIterations: integer   // Configured max iterations
  startedAt: string        // ISO 8601 timestamp
  updatedAt: string        // ISO 8601 timestamp (updated on every state change)
  currentIteration: integer
  completed: integer       // Completed iteration count
  failed: integer          // Failed iteration count
  skipped: integer         // Skipped/blocked iteration count
}
```

### 4.8 CompletionResult

The data extracted from a `task_complete` tool call.

```
CompletionResult {
  status: CompletionStatus  // The sub-agent's reported status
  reason: string?           // Optional explanation
}
```

### 4.9 Run ID Format

Run IDs MUST be generated as `"<timestamp>-<random6chars>"` where:
- `<timestamp>` is `Date.now()` (Unix epoch milliseconds).
- `<random6chars>` is 6 random alphanumeric characters (lowercase a-z, 0-9).

---

## 5. Event System

### 5.1 Event Catalog

The system MUST emit exactly these 14 event types:

| # | Event Type | Payload Fields | Trigger |
|---|-----------|---------------|---------|
| 1 | `loop.description` | `description: string` | After `setup` completes, before iteration loop begins |
| 2 | `loop.dry_run_iteration` | `iteration: int, label: string, model: string` | Each simulated iteration in dry-run mode |
| 3 | `loop.dry_run_complete` | `iterations: int, maxIterations: int` | End of dry-run simulation |
| 4 | `server.started` | `url: string` | After starting an ephemeral server |
| 5 | `server.attached` | `url: string` | After connecting to an existing server |
| 6 | `server.attach_hint` | `url: string` | After server start (hint for TUI attachment) |
| 7 | `iteration.started` | `iteration: int, label: string, model: string` | Before each iteration executes |
| 8 | `iteration.session_created` | `sessionId: string` | After OpenCode session is created |
| 9 | `iteration.completed` | `iteration: int, label: string, status: string, reason?: string` | Iteration succeeded (`"complete"` or `"phase_done"`) |
| 10 | `iteration.blocked` | `iteration: int, label: string, reason?: string` | Iteration returned `"blocked"` |
| 11 | `iteration.retrying` | `iteration: int, label: string, status: string, attempt: int, maxRetries: int` | Retry scheduled |
| 12 | `iteration.failed` | `iteration: int, label: string, status: string, action: string` | Failed, being skipped or aborting |
| 13 | `iteration.error` | `iteration: int, label: string, error: string` | Exception caught during iteration |
| 14 | `loop.completed` | `completed: int, failed: int, skipped: int, totalTimeMs: int` | Loop finished (normal or aborted exit) |

### 5.2 Event Emission Architecture

```
Engine emits event
  → Event emitter distributes to all registered listeners:
    → Console renderer (writes human-readable output to stderr; see §5.5)
    → Run tracker (see §5.6):
        → Appends JSON event to events.jsonl
        → Updates SessionState counters
        → Writes session.json (both per-run and global mirror)
    → External listener (if provided via callback parameter)
```

### 5.3 Emitter Characteristics

- **Synchronous:** Events MUST be emitted synchronously (no async, no
  buffering).
- **Set-based listeners:** Duplicate listener registrations MUST be prevented.
- **No error isolation:** A listener that throws MUST crash the emitter. There
  is no error boundary between listeners.
- **No replay:** Events are fire-and-forget. There is no event history or
  replay mechanism.
- **Cleanup:** Listener registration MUST return an unsubscribe closure. The
  engine MUST call all unsubscribe closures during cleanup.

### 5.4 State Consistency

The run tracker MUST incrementally update its counters from events during the
loop. When the `loop.completed` event is received, it carries the engine's
authoritative final counts. The run tracker MUST overwrite its incremental
counts with these authoritative values. This corrects any drift that may occur
from retry decrements that the tracker does not model.

### 5.5 Console Renderer

The engine MUST register a console renderer as the first event listener. The
console renderer writes human-readable output to **stderr** (not stdout — stdout
is reserved for `--json` structured output and must not be polluted by
diagnostic messages).

No terminal formatting library is required. Output MUST use plain text with
Unicode symbols for status indicators.

The console renderer MUST produce the following output for each event type:

| Event Type | Output |
|-----------|--------|
| `loop.description` | `{description}` |
| `loop.dry_run_iteration` | `[dry-run] Iteration {iteration}: {label} (model: {model})` |
| `loop.dry_run_complete` | Blank line, then `[dry-run] Would run up to {iterations} iterations` |
| `server.started` | `OpenCode server at {url}` |
| `server.attached` | `Attached to OpenCode server at {url}` |
| `server.attach_hint` | `Attach TUI: opencode attach {url}` |
| `iteration.started` | Blank line, then `--- Iteration {iteration} ---`, then `{label}`, then `Model: {model}` (three lines) |
| `iteration.session_created` | `Session: {sessionId} — sending prompt...` |
| `iteration.completed` | `✓ {label} — {status}`. If `reason` is present, a second line: `  reason: {reason}` |
| `iteration.blocked` | `⚠ {label} blocked: {reason}` (defaults to `"unknown"` if reason is absent) |
| `iteration.retrying` | `⚠ {label} {status}, retrying ({attempt}/{maxRetries})` |
| `iteration.failed` | `✗ {label} {status} — {action}` |
| `iteration.error` | `✗ {label} error: {error}` (written to stderr via `console.error`) |
| `loop.completed` | Blank line, then `=== Phase Complete ===`, then `Completed: {completed}, Failed: {failed}, Skipped: {skipped}`, then `Total time: {totalTimeSeconds}s` (four lines, time rounded to whole seconds) |

### 5.6 Run Tracker

The run tracker is responsible for persisting run artifacts: an append-only
event log, SessionState snapshots, and iteration transcripts.

#### 5.6.1 Initialization

The engine MUST create the run tracker **after** calling `setup` (which returns
the description and max iterations) but **before** emitting the first event
(`loop.description`). This means the run tracker is created between steps 1 and
2 of the iteration loop (§2.1.3).

Creation sequence:

1. Generate a `runId` per §4.9.
2. Create the run directory: `.super-ralph/runs/<runId>/`.
3. Create the iterations subdirectory: `.super-ralph/runs/<runId>/iterations/`.
4. Initialize a `SessionState` with `status: "running"`, the description,
   maxIterations, `startedAt` set to the current ISO 8601 timestamp, and all
   counters at zero.
5. Write the initial `session.json` to both per-run and global locations (§6.4).
6. Register as an event listener on the emitter.

#### 5.6.2 events.jsonl Entry Schema

Each line in `events.jsonl` MUST be a single JSON object with exactly two
top-level fields:

```json
{ "ts": "<ISO 8601 timestamp>", "event": { <full event payload from §5.1> } }
```

- `ts` — The wall-clock time the event was recorded by the run tracker
  (ISO 8601 format, e.g., `"2026-03-02T14:30:00.123Z"`).
- `event` — The complete event object as defined in §5.1, including its `type`
  field and all payload fields for that event type.

**Example entry** (single line in the file):

```
{"ts":"2026-03-02T14:30:05.200Z","event":{"type":"iteration.started","iteration":1,"label":"bd-abc.1","model":"anthropic/claude-sonnet-4-20250514"}}
```

#### 5.6.3 Counter Update Mapping

When the run tracker receives an event via its listener, it MUST update
`SessionState` counters as follows:

| Event Type | Counter Update |
|-----------|---------------|
| `iteration.started` | Set `currentIteration` to `event.iteration` |
| `iteration.completed` | Increment `completed` by 1 |
| `iteration.blocked` | Increment `skipped` by 1 |
| `iteration.failed` | Increment `failed` by 1 |
| `iteration.error` | Increment `failed` by 1 |
| `loop.completed` | **Overwrite** `completed`, `failed`, and `skipped` with the event's authoritative values (see §5.4) |
| All other event types | No counter update |

After every event (regardless of whether counters changed), the run tracker
MUST write the updated `SessionState` to both per-run and global locations
(§6.4). This ensures external observers always see the latest state.

#### 5.6.4 Finalization

Finalization sets the run's terminal status. The `finalize` method accepts a
status of `"completed"` or `"failed"` and MUST:

1. Set `SessionState.status` to the provided status.
2. Write `SessionState` to both per-run and global locations (§6.4), which also
   updates `updatedAt` to the current timestamp.

Finalization is called in two contexts:

- **Normal exit** (§2.1.3 step 6): After `loop.completed` is emitted, the
  engine finalizes as `"completed"` if there were no failures, or `"failed"` if
  `failed > 0`.
- **Cleanup** (§2.8): The `finally` block finalizes as `"failed"` if the run
  has not already been finalized. This catches crashes and unexpected errors.

The engine MUST track whether finalization has occurred (via a boolean flag) to
prevent the `finally` block from overwriting a successful finalization with
`"failed"`.

---

## 6. Filesystem Layout

### 6.1 Project Directory Structure

```
<project>/
  .super-ralph/
    config.toml                    # Configuration (TOML)
    AGENTS.md                      # Agent instructions
    forward.hbs                    # Forward phase prompt template
    decompose.hbs                  # Decompose phase prompt template
    reverse.hbs                    # Reverse phase prompt template
    intake-checklist.md            # Intake checklist
    progress.md                    # Append-only progress log
    session.json                   # Global state mirror (latest run)
    runs/
      <runId>/
        session.json               # Per-run state snapshot
        events.jsonl               # Append-only event log (one JSON object per line)
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

### 6.2 Run Artifact Directory

Each run MUST create a directory at `.super-ralph/runs/<runId>/` containing:

- `session.json` — The per-run SessionState, updated on every state change.
- `events.jsonl` — Append-only log. Each line is a complete JSON object with a
  `type` field discriminating the event variant.
- `iterations/` — Directory containing per-iteration transcript files.

### 6.3 Transcript File Naming

Transcript files MUST be named `<NNN>-<label>.log` where:
- `<NNN>` is a zero-padded 3-digit iteration number (e.g., `001`, `002`).
- `<label>` is the iteration label (bead ID or synthetic label).

### 6.4 Dual-Write State Pattern

The system MUST write SessionState to two locations on every update:
1. Per-run: `.super-ralph/runs/<runId>/session.json`
2. Global mirror: `.super-ralph/session.json`

The global mirror enables quick "what's happening now" queries without
resolving the latest run directory.

**Rationale:** Supports both historical per-run inspection and quick current-
state queries.

### 6.5 Filesystem I/O

- All state writes MUST use synchronous I/O for reliability. These operations
  occur between iterations, not during streaming, so blocking is acceptable.
- The `finally` block cleanup guarantees depend on synchronous operations
  completing reliably.

---

## 7. Configuration

### 7.1 Configuration File

**Location:** `<projectDir>/.super-ralph/config.toml`

**Format:** TOML (no JSON/YAML alternatives).

### 7.2 Complete Configuration Schema

```toml
[engine]
timeout_minutes = 30              # Absolute timeout per iteration (minutes)
inactivity_timeout_seconds = 180  # Inactivity watchdog per iteration (seconds)
iteration_delay_ms = 2000         # Pause between iterations (milliseconds)
strategy = "retry"                # Error strategy: "retry" | "skip" | "abort"
max_retries = 3                   # Max retries per iteration label

[opencode]
url = "http://localhost:4096"     # Default OpenCode server URL

[cli]
path = ""                         # Path to super-ralph CLI installation

[models]
default = "anthropic/claude-sonnet-4-6"  # Default model

[models.areas]
# Area-specific model overrides. Keys correspond to area label values.
# Example:
# frontend = "anthropic/claude-sonnet-4-6"
# review = "anthropic/claude-opus-4-6"

[reverse]
output_dir = "docs/specs"         # Default output directory for reverse phase

[decompose]
include_review = true             # Create review beads at boundaries
include_bugscan = true            # Create bugscan beads
include_audit = true              # Create audit beads
```

### 7.3 Default Values

Every configuration key MUST have a default value as shown in §7.2. If the
configuration file is missing entirely, the system MUST use all defaults.

### 7.4 Loading Behavior

- **Missing file:** Return all defaults. This MUST NOT be an error.
- **Present file:** Perform a shallow merge per section with defaults. File
  values override defaults at the section-key level (not deeply nested).
- The `[models.areas]` sub-table MUST be extracted separately from flat
  `[models]` keys.

### 7.5 Iteration Delay

Between consecutive iterations (starting from the second iteration), the
engine MUST pause for `config.engine.iteration_delay_ms` milliseconds
(default: 2000ms). This prevents overwhelming the AI server with rapid
successive requests. See §2.1.3 step 5a for placement within the loop.

---

## 8. External Dependencies

### 8.1 Runtime

| Dependency | Purpose | Required |
|-----------|---------|----------|
| Bun | JavaScript runtime. The system MUST use Bun-specific APIs (`Bun.spawn` for subprocess management). Node.js is NOT supported. | Yes |

### 8.2 Libraries

| Library | Purpose |
|---------|---------|
| `@clack/prompts` | Terminal UI for interactive Q&A (select, multiselect, text input) |
| `@iarna/toml` | TOML configuration file parsing |
| `@opencode-ai/sdk` | OpenCode AI agent SDK (v1 and v2 clients) |
| `handlebars` | Prompt template compilation and rendering |

### 8.3 External CLI Tools

| Tool | Purpose | Required For |
|------|---------|-------------|
| `bun` | JavaScript runtime and package manager | All operations |
| `br` | Beads CLI for dependency-aware task tracking | Forward, Decompose, Init |
| `opencode` | AI coding agent server (started as subprocess or attached) | All phase executions |

### 8.4 Beads CLI Commands

The system MUST interact with the `br` CLI using these exact commands:

| Command | Purpose |
|---------|---------|
| `br init` | Initialize the beads workspace |
| `br ready --parent <id> --json --sort hybrid` | List unblocked beads under an epic, sorted by hybrid priority+dependency order |
| `br show <id> --json` | Retrieve details of a specific bead or epic |
| `br close <id> --suggest-next --json [--reason <text>]` | Close a bead, optionally with reason text |
| `br list --all --json --id <id> [--id <id> ...]` | List specific beads by their IDs |
| `br create --type epic --title <title> --json` | Create a new epic |

### 8.5 JSON Parsing Strategy for `br` Output

The `br` CLI may emit non-JSON log lines to stdout (e.g., debug output). The
system MUST filter these by scanning output lines for the first line that
begins with `[` or `{`, and parsing from that line onward.

---

## 9. Constraints

### 9.1 Runtime Constraints

- **Bun-only:** The system MUST use `Bun.spawn` for subprocess management. It
  is NOT compatible with Node.js.
- **Single-process:** No parallelism within the iteration loop. Iterations MUST
  execute strictly sequentially.
- **No resume:** A failed run MUST NOT be resumable from the last successful
  iteration. The user must start a new run.

### 9.2 Memory Constraints

- **Stream capture:** Each capture buffer MUST be bounded to 250,000
  characters. Two independent buffers (raw and display) exist simultaneously,
  for a maximum of 500,000 characters total.

### 9.3 Security Constraints

- The system MUST NOT store secrets in configuration files.
- External CLI tools are invoked via subprocess; the system MUST NOT inject
  untrusted user input directly into shell commands without proper escaping.

### 9.4 Compatibility Constraints

- TOML configuration format only. No JSON/YAML alternative.
- Model strings MUST contain a `/` separator. Strings without `/` are errors.
- Shallow config merge semantics (file values override defaults at the
  section-key level).

---

## 10. Edge Cases and Error Handling

### 10.1 Engine Level

| Scenario | Expected Behavior |
|----------|-------------------|
| Exception during prompt execution | Caught, recorded as `"error"` status, emitted as `iteration.error`. Error strategy applied. |
| Exception in `setup`/`nextIteration`/`handleResult` | Propagates to outer try/finally. Run finalized as `"failed"`. All resources cleaned up. |
| Server startup failure | Verified via `session.list()`. If unreachable, server process killed, error thrown. |
| Inactivity timeout | Best-effort session abort, then error thrown. Handled by error strategy. |
| Absolute timeout | `Promise.race` rejects. Original promise remains pending. Cleanup is engine's responsibility. |
| Zero or negative timeout | `setTimeout` fires immediately, causing near-instant rejection. This is expected behavior. |
| All listeners crash | A throwing listener crashes the emitter. No error isolation. |

### 10.2 Forward Phase

| Scenario | Expected Behavior |
|----------|-------------------|
| No ready beads but remaining > 0 | Log stall warning (blocked beads with unmet dependencies). Return `null` to stop loop gracefully. |
| Max iterations reached | Loop exits naturally. `loop.completed` event emitted with current counts. |

### 10.3 Decompose Phase

| Scenario | Expected Behavior |
|----------|-------------------|
| Spec file does not exist | Throw immediately during setup. |
| Spec modified externally during run | Next iteration reads updated spec (re-read every iteration). |
| Dry-run mode | Use placeholder epic ID `"dry-run-epic"`. Skip actual epic creation. |
| `br create` returns array | Handle both array and single-object response formats. |

### 10.4 Reverse Phase

| Scenario | Expected Behavior |
|----------|-------------------|
| Output directory missing | Create recursively. |
| Interactive timeout | Best-effort abort, then re-throw. |
| User presses Ctrl+C during question | Question rejected. Session returns `"blocked"` result. |
| No options selected in multiselect | Fall back to text input (if custom input allowed). |
| Mock answer does not match any option | Default to first option. Case-insensitive substring match. |

### 10.5 Beads Integration

| Scenario | Expected Behavior |
|----------|-------------------|
| `br` command exits non-zero | Throw with stderr content and the arguments that were passed. |
| `br` returns empty results | Return empty array `[]`. This MUST NOT be an error. |
| Broken symlinks in `~/.config/opencode/` | Detected by doctor check. `--fix` auto-removes them. |

### 10.6 Initialization

| Scenario | Expected Behavior |
|----------|-------------------|
| File already exists | Skip (never overwrite). |
| Template source missing | Print warning, continue. Not fatal. |
| `bun install` fails | Print warning, continue. Not fatal. |
| `br init` fails | Print warning, continue. Not fatal. |

---

## 11. Design Rationale

### 11.1 Callback-Driven Engine

The engine is phase-agnostic by design. Phases provide `setup`,
`nextIteration`, and `handleResult` callbacks, while the engine handles
universal concerns: server lifecycle, error recovery, observability, resource
cleanup. This separation enables adding new phases by implementing the callback
interface without modifying engine code.

### 11.2 Interactive Reverse Breaks the Engine Pattern

The interactive reverse path intentionally does NOT use the standard engine
loop. Interactive Q&A requires a single long-lived session with real-time
human interaction, which is fundamentally incompatible with the engine's
many-short-sessions model. This architectural divergence is accepted to avoid
forcing mismatched paradigms.

### 11.3 task_complete Convention

Structured signaling via a tool call avoids the unreliability of parsing
free-text output. The engine can unambiguously detect whether the sub-agent
completed its work and what status it reported. The `"stalled"` fallback
handles agents that fail to signal.

### 11.4 Ephemeral Server by Default

Starting a fresh OpenCode server per run eliminates cross-run state pollution.
The `--attach` escape hatch supports debugging workflows.

### 11.5 No CLI Framework

A hand-rolled argument parser keeps the binary small and avoids framework lock-
in. The trade-off is reduced validation and help generation quality.

### 11.6 TOML Configuration

TOML is human-readable, supports comments (unlike JSON), and maps well to the
configuration shape with its nested table structure. Chosen over YAML for
simplicity and fewer foot-guns.

### 11.7 Handlebars Templates

Project-level prompt customization without code changes. Only built-in helpers
are used, keeping templates portable and auditable across projects.

### 11.8 Retry Keyed by Label, Not Iteration Number

Retry tracking by iteration label (bead ID) ensures the same logical task
is retried. The iteration counter is decremented on retry so `nextIteration`
sees the same iteration number and selects the same task again.

### 11.9 Dual-Write State

Two copies of session state serve different access patterns: per-run state for
historical inspection, global mirror for quick current-state queries.

### 11.10 Progress as Cross-Iteration Memory

Each sub-agent session is stateless. The progress log bridges this gap by
letting later iterations learn from earlier ones. Injecting recent progress
entries into prompts provides continuity without requiring session persistence.

### 11.11 Tail-Preserving Truncation

When stream buffers overflow, the head is discarded and the tail is kept.
Recent output is more diagnostically valuable for debugging and progress
tracking.

### 11.12 Mock Answers for Testing

The `--answers` flag enables automated testing of the interactive flow in CI
environments without human interaction.

### 11.13 Skip-If-Exists Initialization

Idempotent `init` prevents accidental loss of customizations and supports
incremental setup when new features add new scaffolded files.

### 11.14 Model Routing by Area Labels

Semantic labels on beads enable cost optimization (cheaper models for simple
tasks) and capability matching (stronger models for complex tasks) without
modifying bead definitions.

### 11.15 Synchronous Filesystem I/O

State writes between iterations use synchronous I/O for reliability. The
`finally` block cleanup guarantees depend on writes completing before
proceeding. Blocking is acceptable because it occurs between iterations, not
during streaming.

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Bead** | A dependency-ordered work item managed by the `br` CLI. |
| **Epic** | A parent bead that groups related child beads. |
| **Iteration** | A single cycle of the engine loop: pick a task, prompt the agent, harvest results. |
| **Phase** | One of the three pipeline stages: Reverse, Decompose, or Forward. |
| **Run** | A complete execution of the engine loop, identified by a unique run ID. |
| **Sub-agent** | The AI coding agent running inside the OpenCode server. |
| **Stall** | A state where beads exist but none are unblocked (all dependencies unmet). |

## Appendix B: Status Code Quick Reference

### Iteration Statuses
`complete` → `phase_done` → `blocked` → `failed` → `stalled` → `timeout` → `error`

### Run Statuses
`running` → `completed` | `failed`

### Bead Statuses (normalized)
`open` → `in_progress` → `closed`

### Error Strategies
`retry` → `skip` → `abort`
