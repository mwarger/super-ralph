# Context Minimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Minimize context overhead for autonomous loop agents by injecting per-phase system prompts via the SDK, slimming AGENTS.md to human-only essentials, and fixing all 40+ documentation bugs found by audit.

**Architecture:** Each phase (forward/decompose/reverse) builds a ~150-token system prompt string and passes it via `session.prompt({ body: { system } })`. Handlebars templates become purely task-focused (completion signaling docs removed). AGENTS.md shrinks to ~10 lines. Plugin stops directing agents to read files.

**Tech Stack:** TypeScript, OpenCode SDK (`@opencode-ai/sdk`), Handlebars

---

### Task 1: Add `systemPrompt` to `runPrompt()` and engine

**Files:**
- Modify: `src/opencode.ts:73-85`
- Modify: `src/engine.ts:6-12,81`
- Modify: `src/types.ts` (no changes needed — PhaseIteration is in engine.ts)

**Step 1: Add `systemPrompt` parameter to `runPrompt()`**

In `src/opencode.ts`, change the `runPrompt` function signature and body:

```typescript
export async function runPrompt(
  client: OpencodeClient,
  sessionId: string,
  prompt: string,
  model: { providerID: string; modelID: string },
  systemPrompt?: string,
): Promise<PromptResult> {
  const response = await client.session.prompt({
    path: { id: sessionId },
    body: {
      model,
      ...(systemPrompt && { system: systemPrompt }),
      parts: [{ type: "text" as const, text: prompt }],
    },
  });
```

**Step 2: Add `systemPrompt` to `PhaseIteration` in engine.ts**

```typescript
export interface PhaseIteration {
  prompt: string;
  model: { providerID: string; modelID: string };
  sessionTitle: string;
  iterationLabel: string;
  beadId?: string;
  systemPrompt?: string;  // <-- add this
}
```

**Step 3: Pass `systemPrompt` through in the engine loop**

In `src/engine.ts:81`, change:
```typescript
runPrompt(server.client, sessionId, next.prompt, next.model),
```
to:
```typescript
runPrompt(server.client, sessionId, next.prompt, next.model, next.systemPrompt),
```

**Step 4: Run typecheck**

Run: `bun run typecheck`
Expected: PASS (no callers pass systemPrompt yet, so it's backward-compatible)

**Step 5: Commit**

```bash
git add src/opencode.ts src/engine.ts
git commit -m "feat: add systemPrompt parameter to runPrompt and PhaseIteration"
```

---

### Task 2: Build per-phase system prompts

**Files:**
- Modify: `src/forward.ts:37-47`
- Modify: `src/decompose.ts:44-59`
- Modify: `src/reverse.ts:32-45`

**Step 1: Add system prompt to forward phase**

In `src/forward.ts`, add the system prompt string and return it from `nextIteration`:

```typescript
async nextIteration(config, iteration) {
  const readyCount = (await getAllReady(epicId)).length;
  if (readyCount === 0) {
    const progress = await getEpicProgress(epicId);
    if (progress.remaining === 0) {
      console.log("All beads complete!");
    } else {
      console.log(`No ready beads. ${progress.completed}/${progress.total} complete.`);
    }
    return null;
  }

  const recentProgress = readRecentProgress(projectDir, 5);
  const model = resolveModel([], "", config, flags.modelOverride);

  const prompt = renderPrompt(template, {
    epicId,
    recentProgress,
  });

  const systemPrompt = [
    "You are an autonomous coding agent in a super-ralph forward loop iteration.",
    "Your job: pick one ready bead from the epic, implement it, close it.",
    "Use `br ready`, `br show`, `br close` to interact with beads.",
    "Run `bun run typecheck` before committing. Fix any failures.",
    "Signal completion via the task_complete tool:",
    "- status: \"complete\" — you implemented and closed one bead, loop continues",
    "- status: \"phase_done\" — all work is done, loop ends",
    "- status: \"blocked\" — you can't proceed, explain why",
    "- status: \"failed\" — something went wrong, explain what",
  ].join("\n");

  return {
    prompt,
    model,
    systemPrompt,
    sessionTitle: `Forward: ${epicId} (iteration ${iteration})`,
    iterationLabel: `${epicId}: forward iteration ${iteration} (${readyCount} ready)`,
  };
},
```

**Step 2: Add system prompt to decompose phase**

In `src/decompose.ts`, add to `nextIteration` return:

```typescript
const systemPrompt = [
  "You are an autonomous coding agent in a super-ralph decompose loop iteration.",
  "Your job: read the spec and existing beads, then create ONE new bead for the most important missing piece.",
  "Use the `br` CLI to create beads, wire dependencies, and add area labels.",
  "Signal completion via the task_complete tool:",
  "- status: \"complete\" — you created one bead, loop continues",
  "- status: \"phase_done\" — the spec is fully decomposed into beads, loop ends",
  "- status: \"blocked\" — you can't proceed, explain why",
  "- status: \"failed\" — something went wrong, explain what",
].join("\n");

return {
  prompt,
  model,
  systemPrompt,
  sessionTitle: `Decompose: ${epicId} (iteration ${iteration})`,
  iterationLabel: `${epicId}: decompose iteration ${iteration} (${existingBeads.length} beads exist)`,
};
```

**Step 3: Add system prompt to reverse phase**

In `src/reverse.ts`, add to `nextIteration` return:

```typescript
const systemPrompt = [
  "You are an autonomous coding agent in a super-ralph reverse loop iteration.",
  "Your job: analyze the input and create or refine a specification document.",
  "Describe WHAT and WHY, not HOW. Write clean-room specs, not code descriptions.",
  "Signal completion via the task_complete tool:",
  "- status: \"complete\" — you expanded/refined the spec, loop continues for further refinement",
  "- status: \"phase_done\" — the spec comprehensively covers the input, loop ends",
  "- status: \"blocked\" — you can't proceed, explain why",
  "- status: \"failed\" — something went wrong, explain what",
].join("\n");

return {
  prompt,
  model,
  systemPrompt,
  sessionTitle: `Reverse: iteration ${iteration}`,
  iterationLabel: `reverse iteration ${iteration}${currentSpec ? " (refining " + currentSpec.filename + ")" : " (initial draft)"}`,
};
```

**Step 4: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 5: Run E2E tests**

Run: `bash tests/e2e-all.sh`
Expected: ALL PASSED (dry-run doesn't exercise the system prompt, but should still pass)

**Step 6: Commit**

```bash
git add src/forward.ts src/decompose.ts src/reverse.ts
git commit -m "feat: add per-phase system prompts to forward, decompose, reverse"
```

---

### Task 3: Remove completion signaling from Handlebars templates

**Files:**
- Modify: `.super-ralph/forward.hbs:41-45` (remove "Completion Signals" section)
- Modify: `.super-ralph/decompose.hbs:69-73` (remove "Completion Signals" section)
- Modify: `.super-ralph/reverse.hbs:62-66` (remove "Completion Signals" section)
- Modify: `.super-ralph/forward.hbs:27` (remove "Read AGENTS.md" instruction)
- Modify: `templates/forward.hbs`, `templates/decompose.hbs`, `templates/reverse.hbs` (mirror changes)

**Step 1: Edit forward.hbs**

Remove the "Completion Signals" section (lines 41-45):
```
## Completion Signals

- `task_complete({ status: "complete" })` — You implemented and closed one bead. Loop continues.
- `task_complete({ status: "blocked" })` — You can't proceed. Explain why.
- `task_complete({ status: "failed" })` — Something went wrong. Explain what.
```

Also in the Workflow section, change line 27 from:
```
1. Read AGENTS.md and README.md if they exist.
```
to:
```
1. Read `.super-ralph/progress.md` for learnings from previous iterations.
```
And renumber subsequent steps (removing the old step 2 about progress.md since it's now step 1, and the old step 3 "Review the ready beads above" should say "Review the ready beads" since there's nothing "above").

**Step 2: Edit decompose.hbs**

Remove the "Completion Signals" section (lines 69-73):
```
## Completion Signals

- `task_complete({ status: "complete" })` — You created one bead. Loop continues.
- `task_complete({ status: "phase_done" })` — The spec is fully decomposed...
- `task_complete({ status: "failed" })` — Something went wrong.
```

**Step 3: Edit reverse.hbs**

Remove the "Completion Signals" section (lines 62-66):
```
## Completion Signals

- `task_complete({ status: "complete" })` — You expanded/refined the spec...
- `task_complete({ status: "phase_done" })` — The spec comprehensively covers the input...
- `task_complete({ status: "failed" })` — Something went wrong.
```

**Step 4: Copy changes to templates/ directory**

Copy the updated `.super-ralph/*.hbs` files to `templates/*.hbs` to keep them in sync.

**Step 5: Run E2E tests**

Run: `bash tests/e2e-all.sh`
Expected: ALL PASSED

**Step 6: Commit**

```bash
git add .super-ralph/*.hbs templates/*.hbs
git commit -m "refactor: remove completion signaling from templates (moved to system prompt)"
```

---

### Task 4: Slim down AGENTS.md files

**Files:**
- Modify: `.super-ralph/AGENTS.md` (rewrite from 78 lines to ~12)
- Modify: `AGENTS.md` (root — simplify)
- Modify: `templates/agents.md` (mirror .super-ralph/AGENTS.md)

**Step 1: Rewrite `.super-ralph/AGENTS.md`**

Replace entire contents with:

```markdown
# Super-Ralph SDLC Framework

CLI commands:
  super-ralph forward --epic <ID>     Beads -> code
  super-ralph decompose --spec <path> Spec -> beads
  super-ralph reverse --input <path>  Input -> spec
  super-ralph status --epic <ID>      Show progress
  super-ralph doctor                  Preflight checks
  super-ralph help                    Show all options

Quality gates:
  bun run typecheck

Config: .super-ralph/config.toml
Templates: .super-ralph/forward.hbs, decompose.hbs, reverse.hbs
Progress log: .super-ralph/progress.md
```

**Step 2: Simplify root `AGENTS.md`**

Replace with:
```markdown
# Agent Instructions
See README.md for project documentation.
```

**Step 3: Mirror to `templates/agents.md`**

Copy the new `.super-ralph/AGENTS.md` content to `templates/agents.md`.

**Step 4: Commit**

```bash
git add .super-ralph/AGENTS.md AGENTS.md templates/agents.md
git commit -m "refactor: slim AGENTS.md to minimal requirements (study-informed)"
```

---

### Task 5: Update plugin to stop directing agents to read files

**Files:**
- Modify: `.opencode/plugins/super-ralph.js:7-16`

**Step 1: Change the system.transform message**

Replace the current message that says "Read .super-ralph/AGENTS.md for framework instructions" with a shorter message that only lists available slash commands (for the human developer's interactive sessions):

```javascript
'experimental.chat.system.transform': async (_input, output) => {
  const configPath = path.join(directory, '.super-ralph', 'AGENTS.md');
  const isInitialized = fs.existsSync(configPath);

  const message = isInitialized
    ? 'This project uses super-ralph. Commands: /superralph:feature, /superralph:bug, /superralph:hotfix, /superralph:refactor, /superralph:plan, /superralph:resume, /superralph:status.'
    : 'The super-ralph framework is available. Run /superralph:init to set up.';

  (output.system ||= []).push(message);
},
```

Key change: removed "Read .super-ralph/AGENTS.md for framework instructions." from the initialized message.

**Step 2: Commit**

```bash
git add .opencode/plugins/super-ralph.js
git commit -m "refactor: plugin stops directing agents to read AGENTS.md"
```

---

### Task 6: Remove dead code

**Files:**
- Modify: `src/beads.ts:66-71` (remove `getNextReady`)
- Modify: `src/template.ts:6-16,31-63` (remove `TemplateVars` and `buildTemplateVars`)
- Modify: `src/config.ts:128-141` (remove `mergeCliFlags`)
- Modify: `src/forward.ts:2` (update import if needed — `getNextReady` isn't imported here but check)

**Step 1: Remove `getNextReady` from beads.ts**

Delete lines 65-71:
```typescript
// Get the next ready (unblocked) bead in an epic
export async function getNextReady(epicId: string): Promise<BeadInfo | null> {
  const result = await runBr(["ready", "--parent", epicId, "--json", "--limit", "1", "--sort", "hybrid"]);
  const beads = result as Record<string, unknown>[];
  if (!beads || beads.length === 0) return null;
  return mapBead(beads[0]);
}
```

**Step 2: Remove `TemplateVars` and `buildTemplateVars` from template.ts**

Delete the `TemplateVars` interface (lines 6-16) and `buildTemplateVars` function (lines 31-63). Also remove the `import type { BeadInfo }` since it's only used by `buildTemplateVars`.

**Step 3: Remove `mergeCliFlags` from config.ts**

Delete lines 128-141.

**Step 4: Verify no imports reference the removed exports**

Run: `bun run typecheck`
Expected: PASS (these are all unused exports)

**Step 5: Commit**

```bash
git add src/beads.ts src/template.ts src/config.ts
git commit -m "refactor: remove dead code (getNextReady, TemplateVars, mergeCliFlags)"
```

---

### Task 7: Fix README.md bugs

**Files:**
- Modify: `README.md`

**Step 1: Fix all audit findings in README**

1. Remove "PageRank" (2 occurrences):
   - Line 3: "PageRank prioritization" → "dependency-aware prioritization"
   - Line 183: "select (PageRank-optimized)" → "select (priority-sorted)"

2. Fix "two statuses" → "four statuses":
   - Line 138: "two statuses" → "four statuses: complete, phase_done, blocked, failed"

3. Fix forward exit condition:
   - Line 142: Remove "and no in-progress beads" — code only checks ready count

4. Fix `cli_path` → `[cli] path`:
   - Lines 59, 61, 210: Replace `cli_path` with `cli.path` (TOML section notation)

5. Fix `task_complete or phase_done` phrasing:
   - Line 106: "signals task_complete or phase_done" → "signals task_complete with status complete or phase_done"

6. Document `--input` as repeatable:
   - Lines 83, 103: Add "(repeatable)" after `--input <path>`

7. Add `--output` to reverse options in CLI summary:
   - After the reverse command line, note `--output <dir>` option

**Step 2: Run a quick visual review of the changes**

Read back the modified README sections to verify accuracy.

**Step 3: Commit**

```bash
git add README.md
git commit -m "fix: correct 7 factual errors in README (PageRank, statuses, flags, exit condition)"
```

---

### Task 8: Fix PRD skill files

**Files:**
- Modify: `skills/feature-prd/SKILL.md`
- Modify: `skills/bug-prd/SKILL.md`
- Modify: `skills/hotfix-prd/SKILL.md`
- Modify: `skills/refactor-prd/SKILL.md`

**Step 1: Remove `--headless` from all 4 skill files**

Search and remove `--headless` from all command examples. The CLI has no headless mode. Affected lines:
- `skills/feature-prd/SKILL.md`: lines 688, 704, 706, 715, 786
- `skills/bug-prd/SKILL.md`: line 393
- `skills/hotfix-prd/SKILL.md`: line 264
- `skills/refactor-prd/SKILL.md`: lines 769, 786, 788, 796

Also remove any sentences describing `--headless` behavior (e.g., "The --headless flag streams structured logs to stdout instead of launching the TUI").

**Step 2: Fix `beads.jsonl` → `issues.jsonl`**

In feature-prd, bug-prd, and refactor-prd, replace `beads.jsonl` with `issues.jsonl`.

**Step 3: Fix bare model names**

In feature-prd (line 699) and refactor-prd (line 780), where it says "Override model — e.g., opus, sonnet", change to:
"Override model — e.g., `anthropic/claude-opus-4-6`, `anthropic/claude-sonnet-4-6`"

**Step 4: Remove PageRank references**

In feature-prd (line 614), bug-prd (line 328), refactor-prd (line 693): replace "BV's PageRank will naturally prioritize" with "Dependency ordering will naturally prioritize"

**Step 5: Commit**

```bash
git add skills/
git commit -m "fix: remove --headless, fix beads.jsonl, model format, PageRank in PRD skills"
```

---

### Task 9: Fix command files

**Files:**
- Modify: `commands/superralph:resume.md`
- Modify: `commands/superralph:status.md`

**Step 1: Fix resume command**

In `commands/superralph:resume.md`:
- Line 35: `decompose --epic <EPIC_ID>` → `decompose --spec <path-to-spec>`
- Line 36: `reverse --epic <EPIC_ID>` → `reverse --input <path>`
- Lines 23-25: Fix phase descriptions:
  - Decompose: "Break down a spec/PRD into beads (task items)"
  - Reverse: "Generate a spec from input (files, URLs, descriptions)"

**Step 2: Fix status command**

In `commands/superralph:status.md`:
- Line 14: `br list --parent <epicId> --json` → `br show <epicId> --json` (to get children via dependents array), then `br list --all --json --id <id1> --id <id2>` for details

**Step 3: Commit**

```bash
git add commands/
git commit -m "fix: correct flags and descriptions in resume and status commands"
```

---

### Task 10: Fix init skill

**Files:**
- Modify: `skills/super-ralph-init/SKILL.md`

**Step 1: Fix config section name**

Line 135: `[agentOptions]` → `[models]`

**Step 2: Fix template filename**

Lines 99, 133: `config.toml` → `super-ralph-config.toml`

**Step 3: Fix model format**

Lines 118-120: `claude-sonnet-4-6` → `anthropic/claude-sonnet-4-6`

**Step 4: Add plugin copy step**

Add a step to copy `.opencode/plugins/super-ralph.js` — the doctor command checks for it but the init skill doesn't create it. Add after the template copy steps:
```
Create `.opencode/plugins/` directory if needed, then copy the super-ralph plugin from the templates.
```

**Step 5: Commit**

```bash
git add skills/super-ralph-init/
git commit -m "fix: correct config section, template filename, model format, add plugin step in init skill"
```

---

### Task 11: Run full verification

**Step 1: Typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 2: E2E tests**

Run: `bash tests/e2e-all.sh`
Expected: ALL PASSED (3/3 suites)

**Step 3: Doctor check**

Run: `bun run src/index.ts doctor`
Expected: All checks pass

**Step 4: Verify dry-run for each phase still works**

Run: `bun run src/index.ts help`
Verify: Output shows all commands correctly

**Step 5: Push**

```bash
git push origin main
```
