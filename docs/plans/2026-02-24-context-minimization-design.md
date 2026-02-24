# Context Minimization Design

> Informed by "Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?" (Gloaguen et al., Feb 2026, ETH Zurich / LogicStar.ai)

## Problem

The study found that context files (AGENTS.md, CLAUDE.md) tend to **reduce** task success rates while increasing inference cost by 20%+. Key findings:

1. LLM-generated context files decrease agent performance by ~3% on average
2. Even developer-written context files only marginally improve performance (+4%) while increasing cost
3. Codebase overviews don't help agents find relevant files faster
4. Agents dutifully follow instructions in context files, spending more steps and reasoning tokens on unnecessary requirements
5. Context files are largely redundant with existing documentation
6. **Recommendation: only describe minimal requirements (e.g., specific tooling)**

Super-ralph currently injects context into autonomous loop agents from 3 redundant sources:
- Plugin `system.transform` hook (tells agent to read AGENTS.md)
- `.super-ralph/AGENTS.md` (78 lines of workflow, conventions, completion signaling)
- Handlebars templates (task-specific prompts that already include completion signaling)

This means loop agents see ~800+ tokens of contextual overhead per session, much of it duplicated or irrelevant to the specific phase.

## Design

### Core Principle

Two audiences, two channels:
- **Human developers** (interactive editor agents): ultra-minimal AGENTS.md + README
- **Autonomous loop agents** (spawned by engine): per-phase system prompt via SDK + task-specific Handlebars template

### System Prompt Injection

The OpenCode SDK's `session.prompt()` accepts a `system` parameter:

```typescript
await client.session.prompt({
  path: { id: sessionId },
  body: {
    model,
    system: systemPrompt,  // <-- per-prompt system instructions
    parts: [{ type: "text", text: renderedTemplate }],
  },
});
```

Each phase builds a purpose-built system prompt (~150-200 tokens) containing ONLY:
- Role definition (1 sentence)
- `task_complete` tool semantics (what each status means for THIS phase)
- Quality gate commands
- Phase-specific exit conditions

Example forward system prompt:
```
You are an autonomous coding agent in a super-ralph forward loop iteration.
Your job: pick a ready bead, implement it, close it.
Use `br ready`, `br show`, `br close` to interact with beads.
Run `bun run typecheck` before committing.
Signal completion via task_complete tool:
- complete: this bead is done, loop continues
- phase_done: all work is done, loop ends
- blocked: can't proceed
- failed: error
```

No overview, no bead type conventions, no commit message format, no principles.

### File Changes

#### `.super-ralph/AGENTS.md` — shrink to ~10 lines (human-only)

```
# Super-Ralph SDLC Framework

CLI commands:
  super-ralph forward --epic <ID>     Beads -> code
  super-ralph decompose --spec <path> Spec -> beads
  super-ralph reverse --input <path>  Input -> spec
  super-ralph status --epic <ID>      Show progress
  super-ralph doctor                  Preflight checks

Quality gates:
  bun run typecheck

Config: .super-ralph/config.toml
Templates: .super-ralph/forward.hbs, decompose.hbs, reverse.hbs
```

#### Root `AGENTS.md` — minimal pointer

```
# Agent Instructions
See README.md for project documentation.
```

#### Plugin (`super-ralph.js`)

- `system.transform` hook: stop telling agents to "read .super-ralph/AGENTS.md". Keep the slash command listing for interactive editor agents only.
- `task_complete` tool: unchanged.

#### `src/opencode.ts`

Add `systemPrompt` parameter to `runPrompt()`:

```typescript
export async function runPrompt(
  client: Client,
  sessionId: string,
  prompt: string,
  model: string,
  systemPrompt?: string,
): Promise<CompletionResult> { ... }
```

#### `src/engine.ts`

`PhaseCallbacks.nextIteration` return type gains optional `systemPrompt` field. Engine passes it through to `runPrompt`.

#### Phase files (`forward.ts`, `decompose.ts`, `reverse.ts`)

Each phase builds its own system prompt string and returns it from `nextIteration`.

#### Handlebars templates

Remove `task_complete` documentation (it moves to the system prompt). Templates become purely task-focused.

#### `templates/agents.md`

Mirror the ultra-minimal `.super-ralph/AGENTS.md`.

### Documentation Bug Fixes

Fix all 40+ issues found by the audit across:

**README.md:**
- Remove "PageRank" (2x) → "dependency-aware prioritization"
- Fix "two statuses" → "four statuses"
- Fix `cli_path` → `[cli] path`
- Fix forward exit condition description
- Document `--input` as repeatable
- Fix `task_complete or phase_done` phrasing
- Add `--output` to reverse options

**PRD skill files (feature, bug, hotfix, refactor):**
- Remove `--headless` flag (10+ occurrences, doesn't exist)
- Fix `beads.jsonl` → `issues.jsonl`
- Fix bare model names → need `provider/model` format
- Remove PageRank references

**`commands/superralph:resume.md`:**
- `decompose --epic` → `decompose --spec`
- `reverse --epic` → `reverse --input`
- Fix phase descriptions

**`commands/superralph:status.md`:**
- Fix `br list --parent` → `br show` + `br list --id`

**`skills/super-ralph-init/SKILL.md`:**
- `[agentOptions]` → `[models]`
- `config.toml` → `super-ralph-config.toml`
- Add missing plugin copy step
- Fix model format

### Dead Code Cleanup

Remove unused exports while touching these files:
- `getNextReady()` from `src/beads.ts`
- `TemplateVars` interface and `buildTemplateVars()` from `src/template.ts`
- `mergeCliFlags()` from `src/config.ts`

## Expected Impact

- ~50% fewer tokens per autonomous loop session (system prompt ~200 tokens vs ~800+ from AGENTS.md + plugin)
- Elimination of redundant context sources (3 → 2, non-overlapping)
- Per-phase context means agents only see instructions relevant to their task
- Agents stop wasting steps reading/re-reading AGENTS.md
- All 40+ documentation inaccuracies fixed
