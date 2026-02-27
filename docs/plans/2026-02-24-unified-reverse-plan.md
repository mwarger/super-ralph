# Unified Reverse Phase Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Collapse the planning phase into a unified reverse command that handles interactive interviews, autonomous synthesis, and mixed mode — replacing all slash commands, skills, and plugin.

**Architecture:** The reverse phase becomes the universal CLI entry point (`super-ralph reverse [inputs...] [flags]`). Interactive mode uses `promptAsync()` + SSE event stream to intercept `question.asked` events and render them with `@clack/prompts`. Autonomous mode uses the existing `runPhaseLoop` engine. The init command moves from a skill to a non-interactive CLI subcommand.

**Tech Stack:** TypeScript/Bun, @opencode-ai/sdk (SSE events, question API), @clack/prompts (terminal UI), Handlebars templates

---

### Task 1: Add @clack/prompts dependency

**Files:**
- Modify: `package.json`

**Step 1: Install @clack/prompts**

Run: `bun add @clack/prompts`

**Step 2: Verify installation**

Run: `bun run typecheck`
Expected: PASS (no type errors)

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "deps: add @clack/prompts for interactive terminal UI"
```

---

### Task 2: Update ReverseFlags and LoopConfig types

**Files:**
- Modify: `src/types.ts`

**Step 1: Update ReverseFlags**

Add `skill`, `interactive`, and update `inputs` to be optional (interactive mode has no inputs):

```typescript
export interface ReverseFlags extends PhaseFlags {
  inputs: string[];         // paths, URLs, descriptions — anything
  outputDir?: string;
  skill?: string;           // --skill <name-or-path> — question bank
  interactive?: boolean;    // --interactive — force interactive mode
}
```

**Step 2: Run typecheck to see what breaks**

Run: `bun run typecheck`
Expected: PASS (inputs is still string[], no breaking change yet)

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add skill and interactive flags to ReverseFlags"
```

---

### Task 3: Update CLI argument parsing for new reverse interface

**Files:**
- Modify: `src/index.ts`

**Step 1: Update parseArgs for positional inputs**

Replace the `--input` flag with positional argument collection for the reverse command. After the command word, everything that isn't a `--flag` or a flag's value is a positional input.

In `parseArgs()`, update the argument parsing logic:

```typescript
function parseArgs(args: string[]): { command: string; positionals: string[]; flags: Record<string, string | boolean | string[]> } {
  const command = args[0] || "help";
  const flags: Record<string, string | boolean | string[]> = {};
  const positionals: string[] = [];

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (key === "dry-run" || key === "interactive") {
        flags[key] = true;
      } else if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        flags[key] = args[++i];
      } else {
        flags[key] = true;
      }
    } else {
      positionals.push(arg);
    }
  }

  return { command, positionals, flags };
}
```

**Step 2: Update cmdReverse to use positionals + new flags**

```typescript
async function cmdReverse(positionals: string[], flags: Record<string, string | boolean | string[]>): Promise<void> {
  const inputs = positionals;
  const interactive = !!flags.interactive;

  // Mode detection per design doc:
  // - No inputs and no --interactive -> interactive (implied)
  // - Inputs without --interactive -> autonomous
  // - Inputs with --interactive -> mixed
  // - --interactive without inputs -> interactive
  const isInteractive = interactive || inputs.length === 0;

  const reverseFlags: ReverseFlags = {
    inputs,
    outputDir: flags.output as string | undefined,
    skill: flags.skill as string | undefined,
    interactive: isInteractive,
    dryRun: !!flags["dry-run"],
    maxIterations: flags["max-iterations"] ? parseInt(flags["max-iterations"] as string, 10) : undefined,
    modelOverride: flags.model as string | undefined,
    attach: flags.attach as string | undefined,
  };

  const projectDir = process.cwd();
  const result = await runReverse(projectDir, reverseFlags);

  if (result.failed > 0) {
    process.exit(1);
  }
}
```

**Step 3: Update printUsage() for new reverse syntax**

Update the help text:

```
Reverse options:
  [inputs...]                Positional: file paths, URLs, text descriptions
  --skill <name-or-path>     Question bank (feature, bug, hotfix, refactor, or file path)
  --interactive              Force interactive mode (default when no inputs)
  --output <dir>             Output directory for specs (default: docs/specs)
```

**Step 4: Remove old --input accumulation logic from parseArgs**

Delete the `key === "input"` special case since inputs are now positional.

**Step 5: Update switch statement to pass positionals**

```typescript
const { command, positionals, flags } = parseArgs(args);
// ...
case "reverse":
  await cmdReverse(positionals, flags);
  break;
```

**Step 6: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 7: Commit**

```bash
git add src/index.ts
git commit -m "feat: positional inputs for reverse, add --skill and --interactive flags"
```

---

### Task 4: Create question bank skill files

**Files:**
- Create: `skills/feature.md` (~35 lines)
- Create: `skills/bug.md` (~20 lines)
- Create: `skills/hotfix.md` (~10 lines)
- Create: `skills/refactor.md` (~35 lines)

**Step 1: Create skills/feature.md**

Extract the question banks from `skills/feature-prd/SKILL.md` into a lightweight format:

```markdown
# Feature Question Bank

## Business Interrogation
1. Why does this matter? Business case, cost of not doing it, cost of delay.
2. Who is affected? Users, systems, teams, downstream effects.
3. What does success look like? Measurable changes, metrics, behavior changes.
4. What are the boundaries? What is this NOT? Adjacent scope we're not touching? Tempting scope creep?
5. What has been tried before? Prior art in codebase? Previous attempts? Why abandoned?
6. What are the risks? Failure modes, blast radius if it breaks.

## Technical Deep-Dive
7. What exists already? Related code, patterns, abstractions. Extend or build new?
8. What's the data model? Entities, relationships, storage, migrations.
9. What are the integration points? APIs, databases, queues, external services.
10. What are the edge cases? Error states, race conditions, empty states, permission boundaries.
11. What are the performance constraints? Latency budgets, data volume, concurrency.
12. What's the testing strategy? Automatic vs manual verification, test infrastructure.

## Learned Questions
Check `.super-ralph/intake-checklist.md` if it exists for learned questions from past epics.
```

**Step 2: Create skills/bug.md**

```markdown
# Bug Fix Question Bank

## Investigation
1. What's the bug? Reproduction steps, expected vs actual behavior.
2. When did it start? Regression? Always broken? What deploy triggered it?
3. What's the impact? Who's affected, how badly, is this in production?
4. Root cause hypothesis? Code paths involved.
5. What's the blast radius? What else might be affected by the fix?

## Technical
- Edge cases around the fix: related inputs or states that could also be broken.
- Data implications: corrupted data? Need migration or cleanup?
- Test gaps: why wasn't this caught? What test is missing?

## Learned Questions
Check `.super-ralph/intake-checklist.md` if it exists for learned questions from past epics.
```

**Step 3: Create skills/hotfix.md**

```markdown
# Hotfix Question Bank

## Fast Intake (1-3 questions max)
1. What's broken? Symptoms, error messages, stack traces.
2. What's the impact? Production down? Data loss? User-facing? Workaround?
3. What's the fix? If known, confirm. If not, investigate and propose.
```

**Step 4: Create skills/refactor.md**

```markdown
# Refactor Question Bank

## Architecture Interrogation
1. What's the pain? Code smells, maintenance burden, performance issues, architectural problems.
2. What's the desired end state? Target architecture, patterns, structure.
3. What must NOT change? Behavior, APIs, contracts, external interfaces consumers depend on.
4. What's the migration path? Incremental refactoring vs big-bang rewrite? Stages that leave system working?
5. What are the invariants? Properties that must remain true throughout every step.
6. What's the risk? Regression hotspots, fragile integration points, poor test coverage.

## Technical Deep-Dive
7. Current patterns vs target patterns? What exists today, what should exist after.
8. Test coverage of affected areas? Unit, integration, E2E — where are the gaps?
9. Coupling points? What modules depend on the code being refactored?
10. Data migration story? If data shapes change — migration plan? Online migration?
11. What can be parallelized? Independent parts vs sequential dependencies.
12. Rollback strategy? Feature flags? Backward-compatible changes?

## Learned Questions
Check `.super-ralph/intake-checklist.md` if it exists for learned questions from past epics.
```

**Step 5: Commit**

```bash
git add skills/feature.md skills/bug.md skills/hotfix.md skills/refactor.md
git commit -m "feat: add lightweight question bank skill files for reverse phase"
```

---

### Task 5: Create interactive session runner (src/interactive.ts)

This is the core new module. It uses `promptAsync()` to start a non-blocking session, subscribes to SSE events to catch `question.asked`, renders questions with `@clack/prompts`, and sends answers back via `client.question.reply()`.

**Files:**
- Create: `src/interactive.ts`

**Step 1: Write the interactive session runner**

```typescript
import { select, multiselect, text, intro, outro, log, isCancel, cancel } from "@clack/prompts";
import type { OpencodeClient, ServerHandle } from "./opencode.js";
import type { CompletionResult } from "./types.js";

export interface InteractiveResult {
  completion: CompletionResult;
  cost: number;
  tokens: { input: number; output: number; reasoning: number };
  filesChanged: string[];
}

/**
 * Run an interactive session that intercepts question.asked events
 * and renders them with @clack/prompts.
 *
 * Uses promptAsync() to start the session non-blocking, then
 * listens to the SSE event stream for question and completion events.
 */
export async function runInteractiveSession(
  client: OpencodeClient,
  sessionId: string,
  prompt: string,
  model: { providerID: string; modelID: string },
  systemPrompt?: string,
): Promise<InteractiveResult> {
  // Start the prompt asynchronously
  await client.session.promptAsync({
    sessionID: sessionId,
    model,
    parts: [{ type: "text" as const, text: prompt }],
    ...(systemPrompt && { system: systemPrompt }),
  });

  // Subscribe to event stream
  const { stream } = await client.event.subscribe();

  for await (const event of stream) {
    const evt = event as Record<string, unknown>;
    const eventType = evt.type as string;

    if (eventType === "question.asked") {
      const props = evt.properties as {
        id: string;
        sessionID: string;
        questions: Array<{
          question: string;
          header: string;
          options: Array<{ label: string; description: string }>;
          multiple?: boolean;
          custom?: boolean;
        }>;
      };

      // Only handle questions for our session
      if (props.sessionID !== sessionId) continue;

      const answers: string[][] = [];

      for (const q of props.questions) {
        const answer = await renderQuestion(q);
        if (answer === null) {
          // User cancelled (Ctrl+C)
          await client.question.reject({ requestID: props.id });
          return {
            completion: { status: "blocked", reason: "User cancelled" },
            cost: 0,
            tokens: { input: 0, output: 0, reasoning: 0 },
            filesChanged: [],
          };
        }
        answers.push(answer);
      }

      await client.question.reply({
        requestID: props.id,
        answers,
      });
    }

    // Check for session completion
    if (eventType === "session.idle") {
      const props = evt.properties as { sessionID: string };
      if (props.sessionID === sessionId) {
        break;
      }
    }

    // Render text output from the agent
    if (eventType === "message.part.updated" || eventType === "message.part.delta") {
      // Let the terminal show agent output naturally
      // The SSE stream carries message parts but we don't need to render them
      // since the agent's text output appears in the session
    }
  }

  // Session complete — gather results
  const allMsgs = await client.session.messages({ sessionID: sessionId });
  let totalCost = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let totalReasoning = 0;
  let completion: CompletionResult = { status: "stalled", reason: "Session completed without task_complete" };

  if (allMsgs.data) {
    for (const msg of allMsgs.data) {
      if (msg.info.role === "assistant") {
        totalCost += (msg.info as Record<string, unknown>).cost as number || 0;
        const tok = (msg.info as Record<string, unknown>).tokens as Record<string, number> | undefined;
        if (tok) {
          totalInput += tok.input || 0;
          totalOutput += tok.output || 0;
          totalReasoning += tok.reasoning || 0;
        }
      }
      // Check for task_complete in parts
      for (const part of msg.parts) {
        if (
          part.type === "tool" &&
          (part as Record<string, unknown>).tool === "task_complete" &&
          (part as Record<string, unknown>).state &&
          ((part as Record<string, unknown>).state as Record<string, unknown>).status === "completed"
        ) {
          const input = ((part as Record<string, unknown>).state as Record<string, unknown>).input as Record<string, unknown>;
          completion = {
            status: (input.status as CompletionResult["status"]) || "complete",
            reason: input.reason as string | undefined,
          };
        }
      }
    }
  }

  // Get files changed
  let filesChanged: string[] = [];
  try {
    const diffResponse = await client.session.diff({ sessionID: sessionId });
    if (diffResponse.data) {
      filesChanged = diffResponse.data.map((d) => d.file);
    }
  } catch {
    // Diffs might not be available
  }

  return {
    completion,
    cost: totalCost,
    tokens: { input: totalInput, output: totalOutput, reasoning: totalReasoning },
    filesChanged,
  };
}

/**
 * Render a single question using @clack/prompts
 */
async function renderQuestion(q: {
  question: string;
  header: string;
  options: Array<{ label: string; description: string }>;
  multiple?: boolean;
  custom?: boolean;
}): Promise<string[] | null> {
  const customEnabled = q.custom !== false; // default true

  if (q.multiple) {
    // Multi-select
    const options = q.options.map(o => ({
      value: o.label,
      label: o.label,
      hint: o.description,
    }));

    const result = await multiselect({
      message: q.question,
      options,
      required: false,
    });

    if (isCancel(result)) return null;

    let selected = result as string[];

    // If custom is enabled and user wants to add a custom answer
    if (customEnabled && selected.length === 0) {
      const custom = await text({
        message: "Type your answer:",
        placeholder: "Your response...",
      });
      if (isCancel(custom)) return null;
      selected = [custom as string];
    }

    return selected;
  } else {
    // Single select
    const options = q.options.map(o => ({
      value: o.label,
      label: o.label,
      hint: o.description,
    }));

    if (customEnabled) {
      options.push({
        value: "__custom__",
        label: "Type your own answer",
        hint: "Enter a custom response",
      });
    }

    const result = await select({
      message: q.question,
      options,
    });

    if (isCancel(result)) return null;

    if (result === "__custom__") {
      const custom = await text({
        message: "Type your answer:",
        placeholder: "Your response...",
      });
      if (isCancel(custom)) return null;
      return [custom as string];
    }

    return [result as string];
  }
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: May have type issues with the SDK types — fix as needed

**Step 3: Commit**

```bash
git add src/interactive.ts
git commit -m "feat: interactive session runner with @clack/prompts question rendering"
```

---

### Task 6: Create skill loader utility (src/skills.ts)

**Files:**
- Create: `src/skills.ts`

**Step 1: Write the skill loader**

```typescript
import { existsSync, readFileSync } from "fs";
import { join, isAbsolute, resolve } from "path";

const BUILT_IN_SKILLS = ["feature", "bug", "hotfix", "refactor"];

/**
 * Resolve a skill name or path to its content.
 *
 * - "feature" -> reads skills/feature.md from the super-ralph install
 * - "/path/to/custom.md" -> reads the file at that path
 * - undefined -> returns null (agent infers from context)
 */
export function loadSkill(skillNameOrPath: string | undefined, cliDir: string): string | null {
  if (!skillNameOrPath) return null;

  // Check if it's a built-in skill name
  if (BUILT_IN_SKILLS.includes(skillNameOrPath)) {
    const skillPath = join(cliDir, "skills", `${skillNameOrPath}.md`);
    if (!existsSync(skillPath)) {
      throw new Error(`Built-in skill '${skillNameOrPath}' not found at ${skillPath}`);
    }
    return readFileSync(skillPath, "utf-8");
  }

  // Treat as a file path
  const resolvedPath = isAbsolute(skillNameOrPath) ? skillNameOrPath : resolve(skillNameOrPath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`Skill file not found: ${resolvedPath}`);
  }
  return readFileSync(resolvedPath, "utf-8");
}

/**
 * Get the directory where the super-ralph CLI lives.
 * This is needed to resolve built-in skill files.
 */
export function getCliDir(): string {
  // __dirname equivalent for ESM
  const url = new URL(".", import.meta.url);
  // Go up from src/ to the project root
  return resolve(url.pathname, "..");
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/skills.ts
git commit -m "feat: skill loader for question bank files"
```

---

### Task 7: Rewrite the reverse template (templates/reverse.hbs)

The new template carries all the process intelligence. It handles three modes: interactive (with interrogation + synthesis phases), autonomous (research-driven), and mixed (inputs + follow-up questions).

**Files:**
- Modify: `templates/reverse.hbs`
- Modify: `.super-ralph/reverse.hbs` (project copy)

**Step 1: Write the new reverse template**

Replace `templates/reverse.hbs` with the full unified template. The template uses Handlebars conditionals to switch between modes and embeds the superpowers-quality constraints.

The template should include:
- Mode-specific instructions (interactive vs autonomous vs mixed)
- The hard gate: no spec content until interrogation complete and approach approved (interactive)
- Anti-rationalization red flags
- One-question-at-a-time constraint (using the question tool)
- Incremental validation for design sections
- Skill question bank content (if provided)
- The spec structure and principles
- Completion signaling

**Step 2: Copy to .super-ralph/reverse.hbs**

```bash
cp templates/reverse.hbs .super-ralph/reverse.hbs
```

**Step 3: Commit**

```bash
git add templates/reverse.hbs .super-ralph/reverse.hbs
git commit -m "feat: unified reverse template with interactive/autonomous/mixed modes"
```

---

### Task 8: Rewrite src/reverse.ts for unified mode support

**Files:**
- Modify: `src/reverse.ts`

The reverse module now needs to handle three code paths:
1. **Autonomous mode** (inputs, no interactive) — uses the existing `runPhaseLoop` engine
2. **Interactive mode** (no inputs, or --interactive without inputs) — uses `runInteractiveSession`
3. **Mixed mode** (inputs + --interactive) — uses `runInteractiveSession` with seed context

**Step 1: Rewrite reverse.ts**

Key changes:
- Import the interactive session runner and skill loader
- Add mode detection logic
- For interactive/mixed: start a server, create a single session, render the template with interactive variables, run `runInteractiveSession()`
- For autonomous: use the existing `runPhaseLoop` pattern (mostly unchanged)
- Load skill content and pass it to the template

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/reverse.ts
git commit -m "feat: unified reverse with interactive/autonomous/mixed mode routing"
```

---

### Task 9: Add init as a CLI command

**Files:**
- Create: `src/init.ts`
- Modify: `src/index.ts`

**Step 1: Write src/init.ts**

Non-interactive init command that:
1. Creates `.super-ralph/` directory
2. Copies templates (forward.hbs, decompose.hbs, reverse.hbs, intake-checklist.md)
3. Copies config.toml template and fills in cli.path
4. Creates AGENTS.md
5. Creates tasks/ directory
6. Initializes beads workspace (`br init`) if .beads/ doesn't exist
7. Updates root AGENTS.md with reference
8. Reports what it did

All operations are idempotent (skip if exists).

**Step 2: Register init in index.ts**

Add to the switch statement:
```typescript
case "init":
  await cmdInit();
  break;
```

Add to printUsage():
```
super-ralph init                          Scaffold .super-ralph/ in current project
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/init.ts src/index.ts
git commit -m "feat: add init as a non-interactive CLI command"
```

---

### Task 10: Delete slash commands, old skills, and plugin infrastructure

**Files:**
- Delete: `commands/` (entire directory — 7 files)
- Delete: `skills/feature-prd/` (entire directory)
- Delete: `skills/bug-prd/` (entire directory)
- Delete: `skills/hotfix-prd/` (entire directory)
- Delete: `skills/refactor-prd/` (entire directory)
- Delete: `skills/plan-prd/` (entire directory)
- Delete: `skills/super-ralph-init/` (entire directory)
- Delete: `.opencode/INSTALL.md`
- Delete: `.claude/INSTALL.md`
- Delete: `.codex/INSTALL.md`
- Delete: `hooks/` (entire directory)
- Delete: `.claude-plugin/` (entire directory)

**Step 1: Remove all the files**

```bash
rm -rf commands/
rm -rf skills/feature-prd/ skills/bug-prd/ skills/hotfix-prd/ skills/refactor-prd/ skills/plan-prd/ skills/super-ralph-init/
rm -f .opencode/INSTALL.md .claude/INSTALL.md .codex/INSTALL.md
rm -rf hooks/ .claude-plugin/
```

**Step 2: Verify no dangling imports**

Run: `bun run typecheck`
Expected: PASS (deleted files aren't imported by src/)

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: delete slash commands, old skills, plugin, and install docs"
```

---

### Task 11: Update doctor command for new structure

**Files:**
- Modify: `src/index.ts`

**Step 1: Update cmdDoctor()**

Remove the plugin check (`.opencode/plugins/super-ralph.js`). Update the "Fix" messages to reference `super-ralph init` instead of `/super-ralph:init`. Add a check for the `skills/` directory with question bank files.

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "fix: update doctor to remove plugin check, reference super-ralph init"
```

---

### Task 12: Update E2E tests for new reverse interface

**Files:**
- Modify: `tests/e2e-reverse.sh`

**Step 1: Update test commands**

Change `--input <path>` to positional arguments. Update the "missing input" test to verify that reverse with no inputs defaults to interactive mode (instead of erroring). Add a dry-run test for `--skill feature`.

Key test changes:
- `$CLI reverse --input $INPUT_PATH` → `$CLI reverse $INPUT_PATH`
- `$CLI reverse --input $P1 --input $P2` → `$CLI reverse $P1 $P2`
- Missing input test: now `super-ralph reverse` should detect interactive mode, not error
- Add: `$CLI reverse $INPUT_PATH --skill feature --dry-run`

**Step 2: Run dry-run tests**

Run: `./tests/e2e-reverse.sh`
Expected: All dry-run tests PASS

**Step 3: Commit**

```bash
git add tests/e2e-reverse.sh
git commit -m "test: update reverse E2E tests for positional inputs and --skill flag"
```

---

### Task 13: Update README and AGENTS.md

**Files:**
- Modify: `README.md`
- Modify: `.super-ralph/AGENTS.md`
- Modify: `templates/agents.md`

**Step 1: Update README.md**

Update the command reference to show the new reverse syntax:
```
super-ralph init                              # scaffold .super-ralph/
super-ralph reverse [inputs...] [--skill ...]  # any input -> spec
super-ralph decompose --spec <path>            # spec -> beads
super-ralph forward --epic <ID>                # beads -> code
super-ralph status --epic <ID>                 # progress check
super-ralph doctor                             # verify prerequisites
```

Remove references to slash commands, skills, and the plugin. Update installation section.

**Step 2: Update .super-ralph/AGENTS.md and templates/agents.md**

Update command reference to match new syntax.

**Step 3: Commit**

```bash
git add README.md .super-ralph/AGENTS.md templates/agents.md
git commit -m "docs: update README and AGENTS.md for unified reverse interface"
```

---

### Task 14: Run full typecheck and E2E test suite

**Files:** None (verification only)

**Step 1: Run typecheck**

Run: `bun run typecheck`
Expected: PASS with 0 errors

**Step 2: Run all E2E tests (dry-run)**

Run: `./tests/e2e-all.sh`
Expected: All tests PASS

**Step 3: Fix any issues found**

If anything fails, fix and commit with descriptive message.

---

### Task 15: Clean up .opencode/ directory and unused config

**Files:**
- Modify: `.opencode/` (remove plugin-related files if any remain)
- Modify: `templates/super-ralph-config.toml` (verify no stale references)

**Step 1: Check for remaining cruft**

Look for any remaining references to slash commands, skills directory paths, plugin files.

**Step 2: Clean up**

Remove any remaining dead files or stale references.

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: clean up remaining references to old slash command infrastructure"
```
