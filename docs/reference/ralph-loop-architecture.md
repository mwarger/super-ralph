# Ralph Loop Architecture — Reference Documentation

> Technical reference for understanding the ralph-tui execution loop and how to
> build an OpenCode SDK-based equivalent. This is research documentation, not an
> implementation plan.

## Source

All analysis is based on `github.com/subsy/ralph-tui` (MIT License, v0.10.0).
Key files: `src/engine/index.ts` (2,283 lines), `src/engine/types.ts` (~530 lines),
`src/plugins/agents/types.ts` (~330 lines), `src/plugins/trackers/types.ts` (~310 lines),
`src/templates/engine.ts` (~470 lines).

---

## The Loop (simplified)

The entire ralph-tui execution model reduces to this:

```
while (!shouldStop):
    if paused: poll every 100ms until resumed
    if on fallback agent: attempt primary agent recovery
    if currentIteration >= maxIterations: stop(max_iterations)
    if tracker.isComplete(): stop(completed)
    
    task = getNextAvailableTask()   // dependency-aware, skips completed
    if !task: stop(no_tasks)
    
    try:
        result = runIteration(task)
    catch:
        if strategy == retry && retries < max: retry with backoff
        if strategy == skip: add to skippedTasks, continue
        if strategy == abort: break
    
    updateSession(currentIteration)
    sleep(iterationDelay)           // default 1000ms
```

## Single Iteration

```
1. Increment iteration counter
2. Set task status to in_progress via tracker
3. Build prompt:
   a. Load recent progress (last 5 iterations from progress.md)
   b. Load codebase patterns (from progress.md)
   c. Get PRD context from tracker (if available)
   d. Get template (5-level hierarchy: custom > project > global > tracker > builtin)
   e. Build template variables (26+ vars: task, epic, config, dates, context)
   f. Compile and render Handlebars template
4. Execute agent:
   a. Spawn agent CLI as subprocess
   b. Stream stdout/stderr to bounded buffers (250K char cap)
   c. Parse JSONL for subagent tracing + telemetry
   d. Wait for process exit
5. Check for rate limit:
   a. If detected: exponential backoff (5s * 3^attempt)
   b. If retries exhausted: switch to fallback agent
   c. If all agents limited: pause engine
6. Check for completion:
   ONLY <promise>COMPLETE</promise> in stdout counts.
   Exit code 0 alone is NOT completion.
7. If completed:
   a. tracker.completeTask(taskId)
   b. Auto-commit if enabled
8. Save iteration log
```

## Completion Detection

This is a critical design decision. Ralph-tui uses an explicit marker:

```typescript
const PROMISE_COMPLETE_PATTERN = /<promise>\s*COMPLETE\s*<\/promise>/i;
```

The agent must emit this exact pattern in its stdout. A clean exit (code 0) does NOT
indicate completion — the agent might exit cleanly after asking a clarifying question
or hitting a tool limit.

This matters for the OpenCode SDK approach: since we're using the SDK instead of
parsing stdout, we need a different completion signal. Options:

1. **Check session status** — `session.status === "idle"` means the LLM finished.
   But "finished" doesn't mean "task completed successfully."
2. **Check for a tool call** — register a custom tool `task_complete` that the
   agent calls when done. The tool's invocation IS the completion signal.
3. **Parse the final message** — look for a completion marker in the last
   assistant message text. Same concept as `<promise>COMPLETE</promise>` but
   read from the message API instead of stdout.
4. **Check todo list** — OpenCode has a `session.todo()` API. The prompt could
   instruct the agent to mark a todo as complete, and the loop checks `todo.updated`
   events.

## Rate Limit Handling

Three-tier cascade:

1. **Detect**: Parse agent output for rate limit patterns
2. **Backoff**: `baseDelay * 3^attempt` (default: 5s, 15s, 45s)
3. **Fallback**: Switch to a different agent entirely
4. **Pause**: If all agents rate-limited, pause the engine

Between iterations, ralph-tui probes the primary agent with a 5-second test:
"Reply with just the word ok." If no rate limit is detected, it switches back.

For the OpenCode SDK approach, rate limiting is handled by OpenCode internally.
The `session.status` event reports `{ type: "retry", attempt, message, next }`
when a rate limit is hit. The loop just needs to wait for `"idle"` or `"busy"`.

## Error Handling Strategies

- **retry**: Exponential backoff, up to maxRetries (default 3), then falls through to skip
- **skip**: Add task to `skippedTasks` set, move to next task
- **abort**: Stop the entire engine immediately

## Task Selection

The tracker's `getNextTask()` is dependency-aware. For beads-bv, this uses
PageRank priority — tasks with more dependents get higher priority. The engine
also maintains a `skippedTasks` set and `filteredTaskIds` list to exclude tasks.

## Template System

Five-level hierarchy for prompt templates:

1. **Custom path**: `--prompt` CLI flag or config `prompt_template`
2. **Project**: `.ralph-tui/templates/{tracker}.hbs`
3. **Global**: `~/.config/ralph-tui/templates/{tracker}.hbs`
4. **Tracker plugin**: `tracker.getTemplate()` return value
5. **Built-in**: hardcoded default template

Template variables include: taskId, taskTitle, taskDescription,
acceptanceCriteria, epicId, epicTitle, trackerName, labels, priority,
dependsOn, blocks, model, agentName, cwd, recentProgress,
prdContent, codebasePatterns, and more.

## Plugin Interfaces

### AgentPlugin (what ralph-tui needs from each agent)

```
- meta: { id, name, description, version, skillsPaths }
- detect() → { available, version, executablePath }
- execute(prompt, files?, options?) → { executionId, promise, interrupt() }
- preflight() → { success, durationMs }
- validateModel(model) → error | null
```

For the OpenCode SDK approach, this entire interface is replaced by SDK calls.
No agent plugin needed — you talk to the server directly.

### TrackerPlugin (what ralph-tui needs from each tracker)

```
- getTasks(filter?) → TrackerTask[]
- getNextTask(filter?) → TrackerTask | undefined
- completeTask(id, reason?) → { success, task }
- updateTaskStatus(id, status) → TrackerTask
- isComplete(filter?) → boolean
- isTaskReady(id) → boolean
- sync() → { success, added, updated, removed }
- getTemplate() → string (Handlebars template)
- getPrdContext?() → { name, description, content, completedCount, totalCount }
```

For the OpenCode SDK approach, this interface remains useful. The beads-bv
tracker logic (shelling out to `bd` CLI) would be extracted or reimplemented.

### TrackerTask (unified task model)

```
- id: string
- title: string
- status: 'open' | 'in_progress' | 'blocked' | 'completed' | 'cancelled'
- priority: 0-4 (0 = critical, 4 = backlog)
- description?: string
- labels?: string[]
- dependsOn?: string[]
- blocks?: string[]
- metadata?: Record<string, unknown>
```

---

## OpenCode SDK Integration Points

### Creating sessions

```typescript
const session = await client.session.create({
  body: { title: "US-003: Create auth middleware" }
})
```

### Sending prompts with per-task model

```typescript
await client.session.prompt({
  path: { id: session.id },
  body: {
    model: { providerID: "anthropic", modelID: "claude-sonnet-4-20250514" },
    parts: [{ type: "text", text: renderedPrompt }]
  }
})
```

### Streaming events

```typescript
const events = await client.event.subscribe()
for await (const event of events.stream) {
  if (event.type === "session.status") {
    const { sessionID, status } = event.properties
    if (status.type === "idle") { /* session finished */ }
    if (status.type === "retry") { /* rate limited, waiting */ }
  }
  if (event.type === "message.part.updated") {
    const part = event.properties.part
    if (part.type === "text") { /* streaming text */ }
    if (part.type === "tool" && part.state.status === "completed") { /* tool done */ }
  }
}
```

### Toast notifications

```typescript
await client.tui.showToast({
  body: {
    message: "US-003 complete",
    variant: "success",   // info | success | warning | error
    duration: 3000
  }
})
```

### Session status types

- `{ type: "idle" }` — session is done processing
- `{ type: "busy" }` — session is actively working
- `{ type: "retry", attempt, message, next }` — rate limited, waiting to retry

### What the SDK replaces

| Ralph-TUI concept | OpenCode SDK equivalent |
|--------------------|------------------------|
| AgentPlugin.execute() | client.session.prompt() |
| stdout parsing | SSE event stream |
| `<promise>COMPLETE</promise>` | session.status === idle + custom tool or message check |
| Rate limit detection | session.status.type === "retry" (handled internally) |
| Fallback agents | Not needed (OpenCode handles provider routing) |
| Subprocess spawning | Not needed (HTTP API calls) |
| TUI (OpenTUI/React) | OpenCode's own TUI + toasts |
| Session persistence | OpenCode manages sessions natively |

---

## Architecture: OpenCode SDK Loop vs Ralph-TUI Loop

### Ralph-TUI (current)

```
ralph-tui process
  |
  |-- spawns --> agent CLI (opencode run / claude --print / etc.)
  |                |
  |                |-- stdout/stderr pipe back to ralph-tui
  |                |-- ralph-tui parses output for completion/errors
  |                |-- agent CLI exits
  |
  |-- calls --> bd CLI (beads tracker)
  |-- renders --> Handlebars templates
  |-- writes --> progress.md, iteration logs
  |-- displays --> OpenTUI/React terminal components
```

### OpenCode SDK Loop (proposed)

```
loop process (super-ralph)
  |
  |-- HTTP/SDK --> opencode server (already running, or started by loop)
  |                  |
  |                  |-- manages LLM sessions
  |                  |-- streams events back via SSE
  |                  |-- handles rate limits, retries internally
  |                  |-- the OpenCode TUI shows live session output
  |
  |-- calls --> bd CLI (beads tracker)
  |-- renders --> Handlebars templates
  |-- writes --> progress.md, iteration logs
  |-- toasts --> client.tui.showToast() (appears in OpenCode TUI)
```

The key difference: ralph-tui spawns agent CLIs as subprocesses and parses
their output. The SDK approach talks to a running server over HTTP. The LLM
interaction is mediated by the OpenCode server, not managed directly.

### What's simpler in the SDK approach

- No subprocess management, no stdout/stderr buffering, no signal handling
- No agent plugin abstraction (no 9 different CLIs to support)
- No TUI framework (OpenCode already has one)
- Per-task model is just a parameter, not a flag-ordering problem
- Rate limits handled by the server transparently

### What's the same

- Bead selection (still shell out to `bd` CLI)
- Prompt template rendering (still Handlebars)
- Progress tracking (still progress.md)
- Error handling strategy (retry/skip/abort)
- Completion detection (need a signal mechanism, just different from stdout parsing)

### What's harder

- Completion detection needs rethinking (no stdout to parse)
- Less control over the exact LLM interaction (server mediates)
- OpenCode-only (no Claude Code CLI, Codex, etc.)
- Depends on OpenCode server being available

---

## Key Numbers

- Ralph-TUI engine: ~2,283 lines (engine/index.ts)
- Ralph-TUI total: ~6,000+ lines across engine, types, templates, config
- Estimated OpenCode SDK loop: ~300-500 lines for core loop
- Beads integration: ~100-200 lines (shell out to `bd` CLI)
- Template rendering: ~100 lines (Handlebars, reuse patterns from ralph-tui)
- Toast/notification: ~20 lines
- CLI commands: ~200-300 lines

Total estimate for a minimal SDK-based loop: ~800-1200 lines

vs ralph-tui fork (trim to essentials): ~2000-3000 lines after removing
unused agent plugins, parallel execution, remote control, sandbox, etc.
