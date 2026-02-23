# OpenCode SDK Execution Loop — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace ralph-tui entirely with a self-contained super-ralph CLI and OpenCode SDK-based execution loop.

**Architecture:** Thin TypeScript CLI shells out to `br` for bead tracking, uses the OpenCode SDK for LLM sessions, and renders Handlebars templates for prompts. A plugin tool (`task_complete`) provides the completion signal.

**Tech Stack:** Bun, TypeScript, @opencode-ai/sdk, @opencode-ai/plugin, Handlebars, TOML parser, br CLI

**Design doc:** `docs/plans/2026-02-23-opencode-sdk-loop-design.md`

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/types.ts`

**Step 1: Create package.json**

```json
{
  "name": "super-ralph",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "super-ralph": "./dist/index.js"
  },
  "scripts": {
    "build": "bun build src/index.ts --outdir dist --target bun",
    "dev": "bun run src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@opencode-ai/sdk": "1.2.10",
    "handlebars": "^4.7.8",
    "@iarna/toml": "^2.2.5"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.8.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create src/types.ts**

Define shared types: `BeadInfo` (id, title, description, status, labels, priority, dependsOn, blocks), `LoopConfig` (engine settings, model mappings), `IterationResult` (beadId, status, duration, model, filesChanged), `ErrorStrategy` enum.

**Step 4: Install dependencies**

Run: `bun install`

**Step 5: Run typecheck**

Run: `bun run typecheck`
Expected: PASS (no source files with errors yet)

**Step 6: Commit**

```bash
git add package.json tsconfig.json bun.lockb src/types.ts
git commit -m "feat: scaffold super-ralph CLI project"
```

---

## Task 2: Config module

**Files:**
- Create: `src/config.ts`
- Create: `templates/super-ralph-config.toml`

**Step 1: Create the config template**

Create `templates/super-ralph-config.toml` with default values:

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

[models.auto]
review = "default"
audit = "default"
bugscan = "default"
```

**Step 2: Write src/config.ts**

- `loadConfig(projectDir: string): LoopConfig` — reads `.super-ralph/config.toml`, parses with `@iarna/toml`, returns typed config with defaults for missing values
- `resolveModel(beadLabels: string[], beadType: string, config: LoopConfig, cliOverride?: string): { providerID: string, modelID: string }` — resolves model from CLI override > bead label > auto-assignment > default
- `mergeCliFlags(config: LoopConfig, flags: Record<string, unknown>): LoopConfig` — merges CLI flags over config values

**Step 3: Typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/config.ts templates/super-ralph-config.toml
git commit -m "feat: add config module and default config template"
```

---

## Task 3: Beads module (br CLI wrapper)

**Files:**
- Create: `src/beads.ts`

**Step 1: Write src/beads.ts**

Functions:
- `getNextReady(epicId: string): Promise<BeadInfo | null>` — runs `br ready --parent <epicId> --json --limit 1 --sort hybrid`, parses JSON, returns first bead or null
- `getBeadDetails(beadId: string): Promise<BeadInfo>` — runs `br show <beadId> --json`, parses JSON
- `closeBead(beadId: string, reason?: string): Promise<{ suggestNext: BeadInfo[] }>` — runs `br close <beadId> --suggest-next --json`, returns newly unblocked beads
- `getAllBeads(epicId: string): Promise<BeadInfo[]>` — runs `br list --parent <epicId> --json`, returns all beads
- `getEpicProgress(epicId: string): Promise<{ total: number, completed: number, remaining: number }>` — counts bead statuses
- `updateStatus(beadId: string, status: string): Promise<void>` — runs `br update <beadId> --state <status>` (if br supports it, otherwise skip)

All functions shell out via `Bun.spawn` or `Bun.$`, parse JSON output, and throw typed errors on failure.

**Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Manual verification**

Initialize a test beads workspace and verify the module works:

Run: `bun run src/beads.ts` (with a simple test at bottom, remove before commit)

**Step 4: Commit**

```bash
git add src/beads.ts
git commit -m "feat: add beads module wrapping br CLI"
```

---

## Task 4: Template module

**Files:**
- Create: `src/template.ts`

**Step 1: Write src/template.ts**

Functions:
- `loadTemplate(projectDir: string): HandlebarsTemplateDelegate` — reads `.super-ralph/prompt.hbs`, compiles with Handlebars
- `renderPrompt(template: HandlebarsTemplateDelegate, vars: TemplateVars): string` — renders with variables
- `TemplateVars` type: `{ taskId, taskTitle, taskDescription, acceptanceCriteria, dependsOn, blocks, recentProgress, prdContent, selectionReason }`
- `buildTemplateVars(bead: BeadInfo, progress: string, prdContent?: string): TemplateVars` — maps bead fields to template variables

**Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/template.ts
git commit -m "feat: add template module for prompt rendering"
```

---

## Task 5: Progress module

**Files:**
- Create: `src/progress.ts`

**Step 1: Write src/progress.ts**

Functions:
- `readRecentProgress(projectDir: string, count: number): Promise<string>` — reads `.super-ralph/progress.md`, extracts last N iteration blocks, returns as string for template injection
- `appendProgress(projectDir: string, entry: IterationResult): Promise<void>` — appends a formatted iteration block to progress.md
- `formatProgressEntry(result: IterationResult): string` — formats an IterationResult into the markdown block format

Creates the file if it doesn't exist.

**Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/progress.ts
git commit -m "feat: add progress module for cross-iteration context"
```

---

## Task 6: OpenCode module

**Files:**
- Create: `src/opencode.ts`

**Step 1: Write src/opencode.ts**

This is the most complex module. Functions:

- `connectToServer(url: string): Promise<OpencodeClient>` — creates SDK client, verifies server is reachable (probe health endpoint), throws if not
- `ensureServer(url: string): Promise<OpencodeClient>` — tries `connectToServer`, if fails starts `opencode serve` as background process, retries connection with backoff
- `createSession(client: OpencodeClient, title: string): Promise<Session>` — creates a new session
- `sendPrompt(client: OpencodeClient, sessionId: string, prompt: string, model: { providerID: string, modelID: string }): Promise<void>` — sends prompt via `promptAsync` endpoint (fire and forget)
- `waitForCompletion(client: OpencodeClient, sessionId: string, timeoutMs: number): Promise<CompletionResult>` — subscribes to SSE events, watches for:
  - `message.part.updated` with `part.type === "tool"` and `part.tool === "task_complete"` → extract status from `part.state.input`
  - `session.status` with `type === "idle"` → check if task_complete was seen, if not return `{ status: "stalled" }`
  - `session.status` with `type === "retry"` → log, continue waiting
  - `session.error` → return `{ status: "error", message }`
  - Timeout → call `client.session.abort()`, return `{ status: "timeout" }`
- `showToast(client: OpencodeClient, message: string, variant: "info" | "success" | "warning" | "error"): Promise<void>` — sends toast event
- `abortSession(client: OpencodeClient, sessionId: string): Promise<void>` — calls abort endpoint
- `getSessionSummary(client: OpencodeClient, sessionId: string): Promise<{ cost: number, tokens: object, diffs: FileDiff[] }>` — reads session info after completion for progress.md

`CompletionResult` type: `{ status: "complete" | "blocked" | "failed" | "stalled" | "timeout" | "error", reason?: string }`

**Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/opencode.ts
git commit -m "feat: add OpenCode SDK module for session management"
```

---

## Task 7: Engine (core loop)

**Files:**
- Create: `src/engine.ts`

**Step 1: Write src/engine.ts**

Main function: `runLoop(config: LoopConfig, epicId: string, flags: EngineFlags): Promise<LoopResult>`

```
EngineFlags: { dryRun, headless, maxIterations?, modelOverride? }
LoopResult: { completed: number, failed: number, skipped: number, totalTime: number }
```

Loop logic (pseudocode):

```
connect to opencode server
load prompt template
iteration = 0
skippedBeads = Set()

while iteration < maxIterations:
    bead = await getNextReady(epicId)
    if !bead: break (all done or all blocked/skipped)
    if skippedBeads.has(bead.id): continue
    
    iteration++
    model = resolveModel(bead.labels, bead.type, config, flags.modelOverride)
    
    if flags.dryRun:
        log("Would run: {bead.id} {bead.title} with {model}")
        continue
    
    toast("Starting {bead.id}: {bead.title}", "info")
    recentProgress = await readRecentProgress(projectDir, 5)
    prompt = renderPrompt(template, buildTemplateVars(bead, recentProgress))
    
    session = await createSession(client, "{bead.id}: {bead.title}")
    await sendPrompt(client, session.id, prompt, model)
    result = await waitForCompletion(client, session.id, config.engine.timeout_minutes * 60000)
    
    summary = await getSessionSummary(client, session.id)
    await appendProgress(projectDir, { beadId: bead.id, ... })
    
    switch result.status:
        case "complete":
            suggestNext = await closeBead(bead.id)
            toast("{bead.id} complete — {suggestNext} now unblocked", "success")
        case "blocked":
            toast("{bead.id} blocked: {result.reason}", "warning")
            skippedBeads.add(bead.id)
        case "failed", "stalled", "timeout", "error":
            if strategy == "retry" && retries < maxRetries:
                toast("{bead.id} failed, retrying ({retries}/{maxRetries})", "warning")
                // don't increment skipped, will retry on next loop
            else if strategy == "skip" || retries >= maxRetries:
                toast("{bead.id} skipped after {retries} retries", "warning")
                skippedBeads.add(bead.id)
            else if strategy == "abort":
                toast("{bead.id} failed — aborting", "error")
                break
    
    await sleep(config.engine.iteration_delay_ms)

// Final summary
progress = await getEpicProgress(epicId)
if progress.remaining == 0:
    toast("Epic complete! {progress.total} beads in {elapsed}", "success")
else:
    toast("Loop ended. {progress.completed}/{progress.total} beads done.", "info")

return { completed, failed, skipped, totalTime }
```

**Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/engine.ts
git commit -m "feat: add core execution loop engine"
```

---

## Task 8: CLI entry point

**Files:**
- Create: `src/index.ts`

**Step 1: Write src/index.ts**

Parse CLI args (use Bun's `process.argv` with a simple parser — no heavy CLI framework):

```
super-ralph run --epic <ID> [--model <m>] [--max-iterations <n>] [--timeout <min>]
                [--strategy retry|skip|abort] [--dry-run] [--headless]
super-ralph status --epic <ID>
super-ralph doctor
super-ralph init
```

Commands:
- `run`: Load config, call `runLoop()`, print summary, exit with code 0 (success) or 1 (failures)
- `status`: Call `getEpicProgress()` + `getAllBeads()`, print formatted summary
- `doctor`: Check `br --version`, probe opencode server, check `.super-ralph/` exists, check plugin installed
- `init`: Delegate to the init skill (or implement directly — copy templates, create config)

Add `#!/usr/bin/env bun` shebang for direct execution.

**Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Test CLI**

Run: `bun run src/index.ts --help`
Expected: prints usage

Run: `bun run src/index.ts doctor`
Expected: runs preflight checks, reports results

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: add CLI entry point with run/status/doctor/init commands"
```

---

## Task 9: Update OpenCode plugin with task_complete tool

**Files:**
- Modify: `.opencode/plugins/super-ralph.js`

**Step 1: Add task_complete tool**

Add the `tool` import and `tool` hook to the existing plugin:

```javascript
import { tool } from "@opencode-ai/plugin/tool";

export const SuperRalphPlugin = async ({ client, directory }) => {
  return {
    'experimental.chat.system.transform': async (_input, output) => {
      // ...existing code unchanged...
    },
    tool: {
      task_complete: tool({
        description: "Signal that the current bead/task is complete, blocked, or failed. Call this ONLY after you have finished all acceptance criteria, run quality gates, committed your work, and updated progress.md.",
        args: {
          status: tool.schema.enum(["complete", "blocked", "failed"])
            .describe("complete = all criteria met; blocked = can't proceed due to dependency/issue; failed = error or unable to complete"),
          reason: tool.schema.string().optional()
            .describe("Brief explanation of the outcome"),
        },
        async execute(args) {
          return `Task marked as ${args.status}${args.reason ? ': ' + args.reason : ''}. The orchestration loop will handle the next steps.`;
        },
      }),
    },
  };
};
```

**Step 2: Verify plugin loads**

Run OpenCode and check that the `task_complete` tool appears in the tool list.
Or run: `bun run .opencode/plugins/super-ralph.js` to check for syntax errors.

**Step 3: Commit**

```bash
git add .opencode/plugins/super-ralph.js
git commit -m "feat: add task_complete tool to OpenCode plugin"
```

---

## Task 10: Update prompt.hbs for task_complete

**Files:**
- Modify: `.super-ralph/prompt.hbs`
- Modify: `templates/prompt.hbs`

**Step 1: Replace `<promise>COMPLETE</promise>` with task_complete**

In both files, find the completion signal instructions and replace:

Before: Instructions to emit `<promise>COMPLETE</promise>`
After: Instructions to call the `task_complete` tool with status "complete"

Also update the workflow checklist step that mentions the completion signal.

Keep the same overall structure — just change the signal mechanism.

**Step 2: Verify template still renders**

Quick manual check: ensure Handlebars variables (`{{taskId}}`, etc.) are still present and the template is valid.

**Step 3: Commit**

```bash
git add .super-ralph/prompt.hbs templates/prompt.hbs
git commit -m "feat: update prompt template to use task_complete tool instead of promise signal"
```

---

## Task 11: Migrate PRD skills from bd to br

**Files:**
- Modify: `skills/feature-prd/SKILL.md`
- Modify: `skills/bug-prd/SKILL.md`
- Modify: `skills/hotfix-prd/SKILL.md`
- Modify: `skills/refactor-prd/SKILL.md`
- Modify: `skills/plan-prd/SKILL.md`
- Modify: `commands/superralph:status.md` (one `bd reopen` reference)

Use the `bd-to-br-migration` skill. This is a mechanical transform:

**Step 1: Migrate feature-prd**

Apply the bd-to-br migration transforms to `skills/feature-prd/SKILL.md`:
- `bd create` → `br create`
- `bd dep add` → `br dep add`
- `bd label add` → `br label add`
- `bd update` → `br update`
- `bd sync` → `br sync --flush-only` + git add/commit
- Section headers: "bd (beads)" → "br (beads_rust)"
- Add non-invasive note about br not executing git commands

**Step 2: Verify no bd references remain**

Run: `grep -c '` + "`" + `bd ` + "`" + `' skills/feature-prd/SKILL.md`
Expected: 0

**Step 3: Repeat for bug-prd, hotfix-prd, refactor-prd, plan-prd**

Same transforms for each file. Verify each with grep.

**Step 4: Fix status command**

In `commands/superralph:status.md`, change `bd reopen <id>` to `br reopen <id>`.

**Step 5: Full verification**

Run: `grep -r '` + "`" + `bd ` + "`" + `' skills/ commands/`
Expected: 0 matches (no remaining bd references in skills or commands)

**Step 6: Commit**

```bash
git add skills/ commands/superralph:status.md
git commit -m "refactor: migrate all PRD skills and commands from bd to br"
```

---

## Task 12: Rewrite slash commands (drop ralph-tui)

**Files:**
- Modify: `commands/superralph:feature.md`
- Modify: `commands/superralph:bug.md`
- Modify: `commands/superralph:hotfix.md`
- Modify: `commands/superralph:refactor.md`
- Modify: `commands/superralph:plan.md`
- Modify: `commands/superralph:resume.md`
- Modify: `commands/superralph:status.md`

**Step 1: Rewrite planning commands**

For feature, bug, hotfix, refactor, and plan — replace the ralph-tui dispatcher with direct skill invocation:

```markdown
---
description: "Start building a new feature through the super-ralph pipeline"
---

## Pipeline: Feature

1. Verify the project is initialized: check that `.super-ralph/AGENTS.md` exists.
   If not, tell the user to run `/superralph:init` first.

2. Load and follow the skill at `skills/feature-prd/SKILL.md` exactly.

3. If the user provided a description after the command, use it as the initial context
   for the intake phase.
```

Adapt the description and skill path for each command type.

**Step 2: Rewrite resume command**

Replace `ralph-tui resume` with instructions to run `super-ralph run`:

```markdown
---
description: "Resume an interrupted super-ralph execution loop"
---

## Resume Execution

1. Check for active epics: run `br list --type epic --json` to find open epics.

2. If multiple epics, ask the user which one to resume.

3. Show current progress: run `br list --parent <epicId> --json` and summarize
   bead counts (completed/remaining/blocked).

4. Offer three options:
   a. Run headless now: execute `npx super-ralph run --epic <epicId>` in a terminal
   b. Copy command to clipboard
   c. Display the command
```

**Step 3: Rewrite status command**

Replace `ralph-tui status` with direct `br` commands:

```markdown
---
description: "Check the status of the current super-ralph execution"
---

## Epic Status

1. Find active epics: run `br list --type epic --json`.

2. For each epic, run `br list --parent <epicId> --json` and count by status.

3. Format summary: epic name, total beads, completed, in-progress, blocked, remaining.

4. If beads are blocked, show which ones and suggest `br reopen <id>`.

5. If all complete, congratulate and suggest running AUDIT review.
```

**Step 4: Verify no ralph-tui references remain**

Run: `grep -r 'ralph-tui' commands/`
Expected: 0 matches

**Step 5: Commit**

```bash
git add commands/
git commit -m "refactor: rewrite all slash commands to drop ralph-tui dependency"
```

---

## Task 13: Update init skill

**Files:**
- Modify: `skills/super-ralph-init/SKILL.md`

**Step 1: Remove ralph-tui dependency from init**

Update the init skill to:
- Remove the `ralph-tui doctor` step
- Remove the `ralph-tui template show` step
- Remove the `.ralph-tui/config.toml` creation step
- Add `.super-ralph/config.toml` creation (copy from `templates/super-ralph-config.toml`)
- Keep everything else (AGENTS.md, prompt.hbs, intake-checklist.md, tasks/ dir)
- Update the agent detection to only detect OpenCode (since that's the only supported agent now)
- Update the model selection to set the model in `.super-ralph/config.toml` instead of `.ralph-tui/config.toml`

**Step 2: Verify the skill reads coherently**

Read through the full skill and check that all steps reference the right paths and tools.

**Step 3: Commit**

```bash
git add skills/super-ralph-init/SKILL.md
git commit -m "refactor: update init skill to drop ralph-tui, add super-ralph config"
```

---

## Task 14: Update documentation

**Files:**
- Modify: `README.md`
- Modify: `.claude/INSTALL.md`
- Modify: `.codex/INSTALL.md`
- Modify: `.opencode/INSTALL.md`
- Modify: `.super-ralph/AGENTS.md` (project-local copy)
- Modify: `templates/agents.md` (template)

**Step 1: Update README.md**

- Remove ralph-tui from prerequisites
- Add `br` (beads-rust) to prerequisites
- Update the "How it works" section for the new two-phase model
- Update installation instructions
- Add `npx super-ralph run` usage examples

**Step 2: Update INSTALL files**

Remove ralph-tui installation steps. Add `br` installation if needed.
Update the setup flow to reference `super-ralph init` instead of `ralph-tui doctor`.

**Step 3: Update AGENTS.md template**

In `templates/agents.md`, update any references to ralph-tui to reference super-ralph.
Ensure the execution model description matches the new SDK loop.

**Step 4: Update project-local AGENTS.md**

Same changes to `.super-ralph/AGENTS.md`.

**Step 5: Commit**

```bash
git add README.md .claude/INSTALL.md .codex/INSTALL.md .opencode/INSTALL.md
git add .super-ralph/AGENTS.md templates/agents.md
git commit -m "docs: update all documentation to reflect super-ralph CLI and br migration"
```

---

## Task 15: Cleanup

**Files:**
- Remove: `.ralph-tui/config.toml` (from templates — project-local copies stay for now)
- Remove: `templates/config.toml`
- Mark superseded: `docs/plans/2026-02-21-super-ralph-distribution-design.md`
- Mark superseded: `docs/plans/2026-02-21-superpowers-ralph-sdlc-design.md` (if not already)

**Step 1: Remove ralph-tui config template**

```bash
git rm templates/config.toml
```

Note: Don't remove `.ralph-tui/config.toml` from the project yet — Phase 1 skills
may still reference it during the transition. It can be cleaned up in a follow-up.

**Step 2: Mark old design docs as superseded**

Add a note at the top of each old design doc pointing to the new one.

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove ralph-tui config template, mark old design docs superseded"
```

---

## Task 16: End-to-end verification

**Step 1: Typecheck**

Run: `bun run typecheck`
Expected: PASS with no errors

**Step 2: Doctor command**

Run: `bun run src/index.ts doctor`
Expected: Reports br version, opencode server status, plugin status

**Step 3: Dry run**

Create a test epic with 2 beads using br, then:

Run: `bun run src/index.ts run --epic <EPIC_ID> --dry-run`
Expected: Shows what would run without executing

**Step 4: Verify no ralph-tui references in commands/skills**

Run: `grep -r 'ralph-tui' commands/ skills/`
Expected: 0 matches (ralph-tui should only appear in design docs and archived files)

**Step 5: Verify no bd references in commands/skills**

Run: `grep -r '` + "`" + `bd ` + "`" + `' commands/ skills/`
Expected: 0 matches

**Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during end-to-end verification"
```

---

## Task order and dependencies

```
Task 1 (scaffold) → Task 2 (config) → Task 3 (beads) → Task 4 (template)
                                                       → Task 5 (progress)
Task 3 + Task 4 + Task 5 → Task 6 (opencode) → Task 7 (engine) → Task 8 (CLI)
Task 8 → Task 16 (e2e verification)

Independent (can run in parallel with anything):
  Task 9 (plugin)
  Task 10 (prompt.hbs)
  Task 11 (bd→br migration)
  Task 12 (command rewrites)
  Task 13 (init skill update)
  Task 14 (documentation)
  Task 15 (cleanup)
```

Tasks 1-8 are sequential (each builds on the previous).
Tasks 9-15 are independent and can be done in any order.
Task 16 requires all other tasks to be complete.
