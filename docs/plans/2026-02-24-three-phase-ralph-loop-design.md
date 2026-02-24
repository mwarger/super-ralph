# Three-Phase Ralph Loop Design

> Super-ralph becomes a pure Ralph loop engine with three composable phases:
> reverse (input -> spec), decompose (spec -> beads), forward (beads -> code).

## 1. Conceptual Model

All three phases are the same Ralph loop (SELECT -> PROMPT -> EXECUTE -> EVALUATE),
differing only in what they consume and produce.

```
REVERSE                    DECOMPOSE                  FORWARD
input -> spec              spec -> beads              beads -> code

Input:  anything           Input:  spec/PRD file      Input:  epic ID
Output: spec file(s)       Output: beads (.beads/)    Output: code + commits

SELECT: agent reviews      SELECT: agent picks        SELECT: agent picks
        current spec                next missing               next ready bead
        for gaps                    bead to create             to implement
PROMPT: input + current    PROMPT: spec + existing    PROMPT: all ready beads +
        spec draft                  beads so far               spec + progress
EXECUTE: agent expands/    EXECUTE: agent creates     EXECUTE: agent implements,
          refines spec               one bead via br            tests, commits
EVALUATE: task_complete?   EVALUATE: task_complete?   EVALUATE: task_complete?
          complete->loop             complete->loop             complete->loop
          phase_done->exit           phase_done->exit           no more ready->exit
```

### Composability

Each phase works standalone. They also chain:

```
super-ralph reverse --input ./src --output docs/specs/
super-ralph decompose --spec docs/specs/spec.md --epic-title "Rebuild from spec"
super-ralph forward --epic bd-xxx
```

Or enter at any point — have a PRD already? Skip to decompose. Have beads? Skip to forward.

### The Ralph Loop Principle

Each iteration gets a **fresh agent context** — no memory of previous iterations. This prevents
context rot. The orchestrator carries state between iterations (the growing accumulator of specs
or beads), not the agent. The agent picks "the most important thing" each iteration, constrained
by what's already been done and what's available.

## 2. Runtime Architecture

### Self-Contained CLI

```
super-ralph <command> [args]
    |
    v
1. Load .super-ralph/config.toml
2. createOpencode({ port: 0 })     <-- spawns ephemeral server, random port
3. Print: "OpenCode server at http://localhost:XXXX"
4. Print: "Attach TUI: opencode attach http://localhost:XXXX"
5. Run the phase-specific loop
6. server.close() in finally block
```

No prerequisites beyond `opencode` and `br` being installed. The CLI spawns its own
OpenCode server via the SDK's `createOpencode()` function, runs the loop, and tears
down the server when done. Port 0 (or random available port) avoids conflicts.

### TUI Attachment for Visibility

The spawned server is a real OpenCode HTTP server. At any time, the user can run:

```
opencode attach http://localhost:XXXX
```

This opens a full OpenCode TUI connected to the same server. The user can:
- Watch the active agent session in real-time
- Browse past sessions in the sidebar
- Intervene (type into a session if an agent gets stuck)
- Detach without affecting the loop

Future enhancement: a richer terminal dashboard showing dependency graph, progress,
cost tracking, and model usage.

### Per-Bead Agent Sessions

Each iteration creates a fresh OpenCode session (fresh context window), sends the prompt,
waits for completion synchronously via `session.prompt()`, then moves on. This is the Ralph
loop's core anti-context-rot mechanism.

### Graceful Shutdown

`Ctrl-C` (SIGINT) triggers `server.close()` and exits cleanly. In-progress work stays
in its current state (open bead, partial spec) so it can be resumed.

## 3. Completion Signaling

All three phases use the same `task_complete` custom tool registered in the OpenCode plugin.

The agent calls `task_complete` with one of two statuses:

- `{ status: "complete" }` — this iteration's work is done. The orchestrator loops back
  for the next iteration.
- `{ status: "phase_done" }` — the entire phase is finished. The orchestrator exits the loop.

For forward, there's a third termination condition: if `br ready --parent <epic>` returns
no ready beads and no beads are in-progress, the epic is complete.

The orchestrator scans all session messages for `task_complete` tool calls after
`session.prompt()` returns (the tool call may be in an earlier turn of a multi-step agent,
not in the final response).

## 4. Model Selection

### Semantic Labels + Config Mapping

Beads carry semantic `area:` labels that describe the type of work, not the model to use.
The decompose agent naturally understands what kind of work a bead represents and applies
appropriate labels (e.g., `area:frontend-design`, `area:backend`, `area:database`,
`area:review`).

The config maps areas to models:

```toml
[models]
default = "anthropic/claude-sonnet-4-6"

[models.areas]
frontend-design = "google/gemini-2.5-pro"
frontend-ui = "anthropic/claude-sonnet-4-6"
backend = "anthropic/claude-sonnet-4-6"
database = "anthropic/claude-sonnet-4-6"
review = "anthropic/claude-sonnet-4-6"
bugscan = "anthropic/claude-sonnet-4-6"
```

Resolution order:
1. CLI `--model` override (applies to all beads in this run)
2. Bead `area:X` label -> `models.areas.X` in config
3. `models.default`

The user controls model assignment by editing config — no need to re-create beads.
Areas can be remapped to any model/provider at any time.

**Forward phase limitation:** In forward, the agent picks the bead after session creation
(pure Ralph). The orchestrator doesn't know which bead was picked at model resolution time,
so area-based routing doesn't apply — forward always uses `--model` or `models.default`.
Future enhancement: a two-step approach where the orchestrator asks the agent which bead
it would pick, then creates the session with the area-resolved model.

## 5. Forward Phase (beads -> code)

### Command

```
super-ralph forward --epic <ID> [--model <provider/model>] [--dry-run] [--max-iterations <n>]
```

### Loop

The accumulator pattern: all ready beads + spec + progress notes are the context.
The agent picks which ready bead to work on.

```
while true:
    ready_beads = br ready --parent <epic> --json
    if no ready beads and no in-progress beads:
        break  // epic complete

    prompt = render(forward.hbs, {
        spec: read epic description / linked PRD,
        ready_beads: ready_beads,
        progress: read .super-ralph/progress.md (last N entries),
        completed_beads: list of already-closed beads for context,
    })

    session = createSession(client, "Forward: <epic title>")
    result = runPrompt(client, session, prompt, resolveModel(bead))

    if result.status == "complete":
        // Agent implemented a bead and closed it via br close
        record progress
        continue
    elif result.status == "phase_done" or no more ready:
        break
```

### Agent's Job (per iteration)

The agent receives: the spec, all ready beads, completed beads for context, and progress notes.
It picks one ready bead, implements it (code, tests, quality gates, git commit), closes it
via `br close`, and signals `task_complete({ status: "complete" })`.

The dependency graph constrains ordering — the agent can only pick from ready (unblocked) beads.
Review beads don't become ready until all implementation beads they depend on are closed.
This means the phased structure created by decompose (impl -> review -> bugscan -> next phase)
is enforced automatically.

### Changes from Current Implementation

- `createOpencodeClient()` -> `createOpencode()` (self-contained)
- Agent picks the bead (pure Ralph) instead of orchestrator selecting via `br ready --limit 1`
- Agent runs `br close` itself instead of orchestrator closing after completion
- Prompt includes all ready beads, not just one
- `run` command becomes `forward` (keep `run` as alias)

## 6. Decompose Phase (spec -> beads)

### Command

```
super-ralph decompose --spec <path> [--epic-title <title>] [--model <provider/model>] [--dry-run]
```

### Loop

The accumulator pattern: the spec is constant, the bead list grows each iteration.

```
epic_id = br create --type epic --title <title>

while true:
    existing_beads = getAllBeads(epic_id)

    prompt = render(decompose.hbs, {
        spec: read spec file(s),
        epic_id: epic_id,
        existing_beads: existing_beads,
    })

    session = createSession(client, "Decompose: <epic title>")
    result = runPrompt(client, session, prompt, model)

    if result.status == "complete":
        // Agent created one bead — loop back to show updated state
        continue
    elif result.status == "phase_done":
        // Agent determined spec is fully decomposed
        break
```

### Agent's Job (per iteration)

The agent receives: the full spec, the epic ID, and all beads created so far.

It picks the most important missing piece from the spec and creates ONE bead:
- `br create --parent <epic_id> --title "..." --description "..."`
- `br dep add <new_bead> <dependency>` for any dependencies on existing beads
- `br label add <new_bead> area:<category>` for semantic model routing

When the existing beads fully cover the spec — including implementation beads, review beads
(REVIEW-XXX), bugscan beads (BUGSCAN-XXX), and audit beads — the agent signals
`task_complete({ status: "phase_done" })`.

### Decompose Prompt Guidance

The prompt template instructs the agent to:
- Structure beads into phases (Phase 1 impl, Phase 1 review, Phase 2 impl, etc.)
- Add REVIEW beads that depend on all impl beads in their phase
- Add BUGSCAN beads that depend on the REVIEW bead
- Apply semantic `area:` labels for model routing
- Wire dependencies so the forward phase respects ordering
- Keep each bead right-sized: one agent context should be able to complete it
- Include acceptance criteria and quality gates in each bead's description

### Orchestrator Creates the Epic

The orchestrator runs `br create --type epic --title <title>` before entering the loop.
The epic ID is passed to every iteration so the agent uses `--parent <epic_id>` consistently.

## 7. Reverse Phase (input -> spec)

### Command

```
super-ralph reverse --input <path|url|description> [--output <dir>] [--model <provider/model>] [--dry-run]
```

### Input Types

The `--input` accepts anything:
- A folder path (codebase to analyze)
- A file path (single file or spec to reverse)
- A URL (product to research and spec)
- A screenshot path (UI to analyze)
- A product name or description (agent researches it)
- Multiple inputs separated by spaces or via repeated `--input` flags

The orchestrator does not parse or understand the input. It passes it through to the
agent as-is. The agent has tools (file reading, web fetching, image viewing) to work
with whatever it receives.

### Loop

The accumulator pattern: the input is constant, the spec grows richer each iteration.

Unlike decompose (where each iteration creates a new discrete bead), reverse builds up
a single spec file iteratively. The first iteration creates the initial draft. Subsequent
iterations read the current spec, identify gaps or shallow areas, and expand/refine it.
The agent may occasionally create additional spec files if the input genuinely covers
multiple distinct components, but the default expectation is one progressively refined spec.

```
while true:
    current_spec = read spec file if it exists (the growing accumulator)

    prompt = render(reverse.hbs, {
        input: input description/path,
        output_dir: output directory,
        current_spec: current_spec content (or empty if first iteration),
    })

    session = createSession(client, "Reverse: <input summary>")
    result = runPrompt(client, session, prompt, model)

    if result.status == "complete":
        // Agent refined/expanded the spec — loop back
        continue
    elif result.status == "phase_done":
        // Agent determined the spec is comprehensive
        break
```

### Agent's Job (per iteration)

The agent receives: the input reference, the output directory, and the current spec
content (if any exists from previous iterations).

- **Iteration 1:** Agent examines the input (reads files, fetches URLs, views screenshots),
  creates an initial draft spec covering the highest-level purpose, behavior, and interfaces.
- **Iteration 2+:** Agent re-reads the input, reviews the current spec, identifies the most
  important gap or shallow area, and rewrites/expands the spec to address it.
- **Final iteration:** Agent determines the spec comprehensively covers the input and signals
  `task_complete({ status: "phase_done" })`.

Each spec describes WHAT something does and WHY — behavior, interfaces, constraints —
not implementation details. This is the "clean room" principle from Huntley's reverse Ralph.

### Spec File Format

Loose enough for the agent to adapt, structured enough to feed into decompose:

```markdown
# Component: [Name]

## Purpose
[What it does and why it exists]

## Behavior
[Observable behavior, user-facing functionality]

## Interfaces
[Public API, inputs, outputs, events]

## Constraints
[Performance requirements, security considerations, limitations]

## Dependencies
[What it depends on, what depends on it]
```

## 8. Prompt Templates

Three new Handlebars templates in `.super-ralph/`:

- `forward.hbs` — forward phase (replaces current `prompt.hbs`)
- `decompose.hbs` — decompose phase
- `reverse.hbs` — reverse phase

Each template receives phase-specific variables from the orchestrator and renders the
full prompt for each iteration. The templates encode the Ralph loop instructions:
pick one thing, do it, signal completion.

## 9. CLI Command Summary

```
super-ralph forward --epic <ID> [options]     Beads -> code
super-ralph decompose --spec <path> [options] Spec -> beads
super-ralph reverse --input <path> [options]  Input -> specs
super-ralph status --epic <ID>                Show epic progress
super-ralph doctor                            Preflight checks
super-ralph help                              Show help
```

Common options: `--model`, `--dry-run`, `--max-iterations`, `--port` (override server port)

Aliases: `run` -> `forward` (backward compatibility)

## 10. Config Changes

```toml
[engine]
timeout_minutes = 30
iteration_delay_ms = 2000
strategy = "retry"         # retry | skip | abort
max_retries = 3

[opencode]
# No longer needed for URL — server is self-contained
# Kept for potential future use (attach to existing server)
url = ""

[cli]
path = "/path/to/src/index.ts"

[models]
default = "anthropic/claude-sonnet-4-6"

[models.areas]
frontend-design = "google/gemini-2.5-pro"
frontend-ui = "anthropic/claude-sonnet-4-6"
backend = "anthropic/claude-sonnet-4-6"
database = "anthropic/claude-sonnet-4-6"
review = "anthropic/claude-sonnet-4-6"
bugscan = "anthropic/claude-sonnet-4-6"
# Users add their own area mappings here

[reverse]
output_dir = "docs/specs"  # default output for reverse phase

[decompose]
# Phase structure guidance (read by decompose prompt template)
include_review = true
include_bugscan = true
include_audit = true
```

## 11. File Changes Summary

### New files
- `.super-ralph/forward.hbs` — forward prompt template
- `.super-ralph/decompose.hbs` — decompose prompt template
- `.super-ralph/reverse.hbs` — reverse prompt template

### Modified files
- `src/index.ts` — add forward/decompose/reverse commands, createOpencode() startup
- `src/opencode.ts` — switch to createOpencode(), add server lifecycle management
- `src/engine.ts` — refactor into phase-specific loop functions
- `src/types.ts` — add models.areas, reverse/decompose config sections
- `src/config.ts` — parse new config sections
- `.super-ralph/config.toml` — add new sections
- `templates/super-ralph-config.toml` — add new sections
- `.opencode/plugins/super-ralph.js` — update task_complete to support phase_done status

### Removed/renamed
- `.super-ralph/prompt.hbs` -> `.super-ralph/forward.hbs` (rename)

## 12. Future Enhancements

- **Rich terminal dashboard** — TUI with dependency graph, progress bars, cost tracking
- **Pipeline command** — `super-ralph pipeline --input X` chains reverse -> decompose -> forward
- **Swarm-compatible beads** — area labels could route to parallel workers if swarm-tools is installed
- **Learning system** — track which models/strategies work best for which areas over time
- **Resume support** — `super-ralph forward --epic X` detects partially-complete epics and continues
