# Three-Phase Ralph Loop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor super-ralph into a pure Ralph loop engine with three composable phases (reverse, decompose, forward), self-contained via `createOpencode()`.

**Architecture:** Replace `createOpencodeClient()` with `createOpencode()` so the CLI spawns its own ephemeral OpenCode server. Refactor the monolithic engine into three phase-specific loop functions sharing a common loop runner. Add `phase_done` completion status. Create prompt templates for each phase.

**Tech Stack:** TypeScript (Bun), OpenCode SDK (`@opencode-ai/sdk` v1.2.10), Handlebars, TOML config, `br` CLI

---

### Task 1: Update types for three-phase model

**Files:**
- Modify: `src/types.ts`

**Step 1: Add `phase_done` to CompletionResult status**

In `CompletionResult`, add `"phase_done"` to the status union:

```typescript
export interface CompletionResult {
  status: "complete" | "phase_done" | "blocked" | "failed" | "stalled" | "timeout" | "error";
  reason?: string;
}
```

**Step 2: Replace `modelsAuto` with `modelsAreas` in LoopConfig**

Replace the `modelsAuto` property with `modelsAreas`:

```typescript
export interface LoopConfig {
  engine: {
    timeout_minutes: number;
    iteration_delay_ms: number;
    strategy: ErrorStrategy;
    max_retries: number;
  };
  opencode: {
    url: string;
  };
  cli: {
    path: string;
  };
  models: {
    default: string;
    [key: string]: string;
  };
  modelsAreas: {
    [key: string]: string; // area name -> provider/model
  };
  reverse: {
    output_dir: string;
  };
  decompose: {
    include_review: boolean;
    include_bugscan: boolean;
    include_audit: boolean;
  };
}
```

**Step 3: Add phase-specific flag types**

After `EngineFlags`, add:

```typescript
export interface ForwardFlags extends EngineFlags {
  epicId: string;
}

export interface DecomposeFlags {
  specPath: string;
  epicTitle?: string;
  dryRun: boolean;
  maxIterations?: number;
  modelOverride?: string;
}

export interface ReverseFlags {
  inputs: string[]; // paths, URLs, descriptions — anything
  outputDir?: string;
  dryRun: boolean;
  maxIterations?: number;
  modelOverride?: string;
}
```

**Step 4: Run typecheck**

Run: `bun run typecheck`
Expected: FAIL (config.ts and engine.ts reference old types — will fix in later tasks)

**Step 5: Commit**

```bash
git add src/types.ts
git commit -m "feat: update types for three-phase Ralph loop model"
```

---

### Task 2: Update config for three-phase model

**Files:**
- Modify: `src/config.ts`
- Modify: `.super-ralph/config.toml`
- Modify: `templates/super-ralph-config.toml`

**Step 1: Update DEFAULT_CONFIG in config.ts**

Replace `modelsAuto` with `modelsAreas` and add `reverse` and `decompose` sections:

```typescript
const DEFAULT_CONFIG: LoopConfig = {
  engine: {
    timeout_minutes: 30,
    iteration_delay_ms: 2000,
    strategy: "retry",
    max_retries: 3,
  },
  opencode: {
    url: "http://localhost:4096",
  },
  cli: {
    path: "",
  },
  models: {
    default: "anthropic/claude-sonnet-4-6",
  },
  modelsAreas: {},
  reverse: {
    output_dir: "docs/specs",
  },
  decompose: {
    include_review: true,
    include_bugscan: true,
    include_audit: true,
  },
};
```

**Step 2: Update loadConfig merge logic**

Replace the `modelsAuto` merge with `modelsAreas`, and add `reverse` and `decompose` merges:

```typescript
    modelsAreas: {
      ...(parsed["models.areas"] as Record<string, string> || {}),
      ...((parsed.models as Record<string, unknown>)?.areas as Record<string, string> || {}),
    },
    reverse: {
      ...DEFAULT_CONFIG.reverse,
      ...(parsed.reverse as Record<string, unknown> || {}),
    },
    decompose: {
      ...DEFAULT_CONFIG.decompose,
      ...(parsed.decompose as Record<string, unknown> || {}),
    },
```

**Step 3: Update resolveModel to use modelsAreas**

Replace the auto-assignment block in `resolveModel` with area label resolution:

```typescript
    // Priority 2: Bead area label -> models.areas mapping
    const areaLabel = beadLabels.find((l) => l.startsWith("area:"));
    if (areaLabel) {
      const area = areaLabel.slice(5); // strip "area:"
      const areaModel = config.modelsAreas[area];
      if (areaModel) {
        modelString = areaModel;
      } else {
        // Fall through to default
        modelString = config.models.default;
      }
    } else {
      // Priority 3: Default
      modelString = config.models.default;
    }
```

Remove the old `model:alias` label logic and the `titleLower.startsWith("review")` auto-assignment block entirely.

**Step 4: Update config TOML files**

In `.super-ralph/config.toml` and `templates/super-ralph-config.toml`, replace `[models.auto]` with:

```toml
[models.areas]
# Map semantic area labels to models
# frontend-design = "google/gemini-2.5-pro"
# frontend-ui = "anthropic/claude-sonnet-4-6"
# backend = "anthropic/claude-sonnet-4-6"
# review = "anthropic/claude-sonnet-4-6"

[reverse]
output_dir = "docs/specs"

[decompose]
include_review = true
include_bugscan = true
include_audit = true
```

**Step 5: Run typecheck**

Run: `bun run typecheck`
Expected: FAIL (engine.ts still uses old patterns — fixed in Task 4)

**Step 6: Commit**

```bash
git add src/config.ts .super-ralph/config.toml templates/super-ralph-config.toml
git commit -m "feat: update config for three-phase model with area-based model routing"
```

---

### Task 3: Switch OpenCode client to self-contained server

**Files:**
- Modify: `src/opencode.ts`

**Step 1: Replace connectToServer with startServer**

Replace the `connectToServer` function with `startServer` that uses `createOpencode`:

```typescript
import { createOpencode, createOpencodeClient, type OpencodeClient, type Part } from "@opencode-ai/sdk";

export type { OpencodeClient };

export interface ServerHandle {
  client: OpencodeClient;
  url: string;
  close: () => void;
}

// Start an ephemeral OpenCode server and return a client + handle
export async function startServer(): Promise<ServerHandle> {
  const { client, server } = await createOpencode({ port: 0 });

  // Verify server is ready
  try {
    await client.session.list();
  } catch (err) {
    server.close();
    throw new Error(`OpenCode server started but not responding: ${(err as Error).message}`);
  }

  return {
    client,
    url: server.url,
    close: () => server.close(),
  };
}

// Connect to an existing OpenCode server (for --attach mode)
export async function connectToServer(url: string): Promise<ServerHandle> {
  const client = createOpencodeClient({ baseUrl: url });

  try {
    await client.session.list();
  } catch (err) {
    throw new Error(`Cannot connect to OpenCode server at ${url}: ${(err as Error).message}`);
  }

  return {
    client,
    url,
    close: () => {}, // External server — don't close it
  };
}
```

**Step 2: Update extractCompletion to handle phase_done**

In the `extractCompletion` function, the existing logic already handles arbitrary status strings from the `task_complete` tool. Verify that `phase_done` flows through correctly — it should, since we cast `input.status` to `CompletionResult["status"]` which now includes `"phase_done"`.

**Step 3: Update the plugin to accept phase_done**

This will be done in Task 6 (plugin update).

**Step 4: Run typecheck**

Run: `bun run typecheck`
Expected: FAIL (engine.ts still imports `connectToServer` — fixed in Task 4)

**Step 5: Commit**

```bash
git add src/opencode.ts
git commit -m "feat: add self-contained server via createOpencode(), keep connectToServer for attach mode"
```

---

### Task 4: Refactor engine into phase-specific loops

**Files:**
- Modify: `src/engine.ts`
- Create: `src/forward.ts`
- Create: `src/decompose.ts`
- Create: `src/reverse.ts`

**Step 1: Create the shared loop runner in engine.ts**

Refactor `engine.ts` to export a generic `runPhaseLoop` function that all three phases use. This handles: server startup, iteration counting, error handling, retry logic, delay, and shutdown.

Replace the entire content of `src/engine.ts` with:

```typescript
import { loadConfig, mergeCliFlags } from "./config.js";
import { startServer, connectToServer, createSession, runPrompt, showToast, type ServerHandle } from "./opencode.js";
import { appendProgress } from "./progress.js";
import type { LoopConfig, LoopResult, IterationResult, CompletionResult } from "./types.js";

export interface PhaseIteration {
  prompt: string;
  model: { providerID: string; modelID: string };
  sessionTitle: string;
  iterationLabel: string; // for logging, e.g. "bd-3qe.1: Task 1"
}

export interface PhaseCallbacks {
  // Called before the loop to print phase-specific info. Return max iterations.
  setup(config: LoopConfig): Promise<{ maxIterations: number; description: string }>;
  // Called each iteration to get the prompt and model. Return null to end the loop.
  nextIteration(config: LoopConfig, iteration: number): Promise<PhaseIteration | null>;
  // Called after each iteration with the result. Return true to continue, false to stop.
  handleResult(result: CompletionResult, iteration: number): Promise<boolean>;
}

export async function runPhaseLoop(
  projectDir: string,
  callbacks: PhaseCallbacks,
  flags: { dryRun: boolean; maxIterations?: number; modelOverride?: string; attach?: string },
): Promise<LoopResult> {
  const config = loadConfig(projectDir);

  const { maxIterations: defaultMax, description } = await callbacks.setup(config);
  const maxIterations = flags.maxIterations || defaultMax;

  console.log(description);

  if (flags.dryRun) {
    let iteration = 0;
    while (iteration < maxIterations) {
      const next = await callbacks.nextIteration(config, iteration + 1);
      if (!next) break;
      iteration++;
      const modelStr = `${next.model.providerID}/${next.model.modelID}`;
      console.log(`[dry-run] Iteration ${iteration}: ${next.iterationLabel} (model: ${modelStr})`);
    }
    console.log(`\n[dry-run] Would run up to ${iteration} iterations`);
    return { completed: 0, failed: 0, skipped: 0, totalTime: 0 };
  }

  // Start or attach to OpenCode server
  let server: ServerHandle;
  if (flags.attach) {
    server = await connectToServer(flags.attach);
    console.log(`Attached to OpenCode server at ${server.url}`);
  } else {
    server = await startServer();
    console.log(`OpenCode server at ${server.url}`);
    console.log(`Attach TUI: opencode attach ${server.url}`);
  }

  let iteration = 0;
  let completed = 0;
  let failed = 0;
  let skipped = 0;
  const retryCount = new Map<string, number>();
  const startTime = Date.now();

  try {
    while (iteration < maxIterations) {
      const next = await callbacks.nextIteration(config, iteration + 1);
      if (!next) break;

      iteration++;
      const modelStr = `${next.model.providerID}/${next.model.modelID}`;
      console.log(`\n--- Iteration ${iteration} ---`);
      console.log(`${next.iterationLabel}`);
      console.log(`Model: ${modelStr}`);

      const iterStartTime = Date.now();

      try {
        const sessionId = await createSession(server.client, next.sessionTitle);
        console.log(`Session: ${sessionId} — sending prompt...`);

        const promptResult = await runPrompt(server.client, sessionId, next.prompt, next.model);
        const result = promptResult.completion;
        const iterDuration = Date.now() - iterStartTime;

        const iterResult: IterationResult = {
          beadId: next.iterationLabel.split(":")[0] || `iter-${iteration}`,
          beadTitle: next.iterationLabel,
          status: result.status === "phase_done" ? "complete" : result.status,
          reason: result.reason,
          model: modelStr,
          duration: iterDuration,
          cost: promptResult.cost,
          tokens: promptResult.tokens,
          filesChanged: promptResult.filesChanged,
        };
        appendProgress(projectDir, iteration, iterResult);

        const shouldContinue = await callbacks.handleResult(result, iteration);

        if (result.status === "complete" || result.status === "phase_done") {
          completed++;
          console.log(`✓ ${next.iterationLabel} — ${result.status}`);
        } else if (result.status === "blocked") {
          skipped++;
          console.log(`⚠ ${next.iterationLabel} blocked: ${result.reason || "unknown"}`);
        } else {
          // failed/stalled/timeout/error
          const key = next.iterationLabel;
          const currentRetries = retryCount.get(key) || 0;
          if (config.engine.strategy === "retry" && currentRetries < config.engine.max_retries) {
            retryCount.set(key, currentRetries + 1);
            console.log(`⚠ ${next.iterationLabel} ${result.status}, retrying (${currentRetries + 1}/${config.engine.max_retries})`);
          } else if (config.engine.strategy === "abort") {
            failed++;
            console.log(`✗ ${next.iterationLabel} ${result.status} — aborting`);
            break;
          } else {
            failed++;
            skipped++;
            console.log(`✗ ${next.iterationLabel} ${result.status} — skipping`);
          }
        }

        if (!shouldContinue) break;

      } catch (err) {
        const iterDuration = Date.now() - iterStartTime;
        const iterResult: IterationResult = {
          beadId: next.iterationLabel.split(":")[0] || `iter-${iteration}`,
          beadTitle: next.iterationLabel,
          status: "error",
          reason: (err as Error).message,
          model: modelStr,
          duration: iterDuration,
        };
        appendProgress(projectDir, iteration, iterResult);
        failed++;
        console.error(`✗ ${next.iterationLabel} error: ${(err as Error).message}`);
        if (config.engine.strategy === "abort") break;
      }

      if (config.engine.iteration_delay_ms > 0) {
        await new Promise((r) => setTimeout(r, config.engine.iteration_delay_ms));
      }
    }
  } finally {
    server.close();
  }

  const totalTime = Date.now() - startTime;
  console.log(`\n=== Phase Complete ===`);
  console.log(`Completed: ${completed}, Failed: ${failed}, Skipped: ${skipped}`);
  console.log(`Total time: ${Math.round(totalTime / 1000)}s`);

  return { completed, failed, skipped, totalTime };
}
```

**Step 2: Create src/forward.ts**

```typescript
import { runPhaseLoop, type PhaseCallbacks } from "./engine.js";
import { getAllBeads, getEpicProgress } from "./beads.js";
import { loadTemplate, renderPrompt } from "./template.js";
import { readRecentProgress } from "./progress.js";
import { resolveModel } from "./config.js";
import type { ForwardFlags, LoopResult } from "./types.js";

export async function runForward(projectDir: string, flags: ForwardFlags): Promise<LoopResult> {
  const epicId = flags.epicId;
  let template: HandlebarsTemplateDelegate;

  const callbacks: PhaseCallbacks = {
    async setup(config) {
      const allBeads = await getAllBeads(epicId);
      template = loadTemplate(projectDir, "forward.hbs");
      return {
        maxIterations: allBeads.length * 2,
        description: `Forward loop for epic ${epicId}: ${allBeads.length} beads`,
      };
    },

    async nextIteration(config, iteration) {
      // Check if there are any ready beads left (orchestrator just checks, doesn't pass them)
      const { getAllReady } = await import("./beads.js");
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

      // Use default model — agent discovers and picks the bead itself
      const model = resolveModel([], "", config, flags.modelOverride);

      const prompt = renderPrompt(template, {
        epicId,
        recentProgress,
      });

      return {
        prompt,
        model,
        sessionTitle: `Forward: ${epicId} (iteration ${iteration})`,
        iterationLabel: `${epicId}: forward iteration ${iteration} (${readyCount} ready)`,
      };
    },

    async handleResult(result, iteration) {
      if (result.status === "phase_done") return false;
      if (result.status === "complete") return true;
      return true; // retry/skip handled by engine
    },
  };

  return runPhaseLoop(projectDir, callbacks, {
    dryRun: flags.dryRun,
    maxIterations: flags.maxIterations,
    modelOverride: flags.modelOverride,
  });
}

```

Note: The orchestrator only checks ready bead count to know whether to continue the loop. The agent discovers and picks its own bead via `br ready`. Task 7 will update the template system.

**Step 3: Create src/decompose.ts**

```typescript
import { runPhaseLoop, type PhaseCallbacks } from "./engine.js";
import { loadTemplate, renderPrompt } from "./template.js";
import { resolveModel } from "./config.js";
import type { LoopConfig, DecomposeFlags, LoopResult } from "./types.js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export async function runDecompose(projectDir: string, flags: DecomposeFlags): Promise<LoopResult> {
  let template: HandlebarsTemplateDelegate;
  let epicId: string;

  const callbacks: PhaseCallbacks = {
    async setup(config) {
      template = loadTemplate(projectDir, "decompose.hbs");

      // Read spec content
      if (!existsSync(flags.specPath)) {
        throw new Error(`Spec file not found: ${flags.specPath}`);
      }

      // Create the epic
      const { runBr } = await import("./beads.js");
      const title = flags.epicTitle || `Decompose: ${flags.specPath}`;
      const result = await runBr(["create", "--type", "epic", "--title", title, "--json"]);
      const created = Array.isArray(result) ? result[0] : result;
      epicId = (created as Record<string, unknown>).id as string;
      console.log(`Created epic: ${epicId}`);

      return {
        maxIterations: 50, // reasonable cap for decompose iterations
        description: `Decompose loop: ${flags.specPath} -> beads (epic ${epicId})`,
      };
    },

    async nextIteration(config, iteration) {
      // Read spec (constant across iterations)
      const specContent = readFileSync(flags.specPath, "utf-8");

      // Get existing beads (growing accumulator)
      const { getAllBeads } = await import("./beads.js");
      const existingBeads = await getAllBeads(epicId);

      const model = resolveModel([], "", config, flags.modelOverride);

      const prompt = renderPrompt(template, {
        specContent,
        epicId,
        existingBeads,
        includeReview: config.decompose.include_review,
        includeBugscan: config.decompose.include_bugscan,
        includeAudit: config.decompose.include_audit,
      });

      return {
        prompt,
        model,
        sessionTitle: `Decompose: ${epicId} (iteration ${iteration})`,
        iterationLabel: `${epicId}: decompose iteration ${iteration} (${existingBeads.length} beads exist)`,
      };
    },

    async handleResult(result, iteration) {
      if (result.status === "phase_done") {
        console.log("Spec fully decomposed.");
        return false;
      }
      return result.status === "complete";
    },
  };

  return runPhaseLoop(projectDir, callbacks, {
    dryRun: flags.dryRun,
    maxIterations: flags.maxIterations,
    modelOverride: flags.modelOverride,
  });
}
```

**Step 4: Create src/reverse.ts**

```typescript
import { runPhaseLoop, type PhaseCallbacks } from "./engine.js";
import { loadTemplate, renderPrompt } from "./template.js";
import { resolveModel } from "./config.js";
import type { LoopConfig, ReverseFlags, LoopResult } from "./types.js";
import { readdirSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join, basename } from "path";

export async function runReverse(projectDir: string, flags: ReverseFlags): Promise<LoopResult> {
  let template: HandlebarsTemplateDelegate;
  let outputDir: string;

  const callbacks: PhaseCallbacks = {
    async setup(config) {
      template = loadTemplate(projectDir, "reverse.hbs");
      outputDir = flags.outputDir || join(projectDir, config.reverse.output_dir);

      // Ensure output directory exists
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      const inputSummary = flags.inputs.join(", ");
      return {
        maxIterations: 50,
        description: `Reverse loop: ${inputSummary} -> specs in ${outputDir}`,
      };
    },

    async nextIteration(config, iteration) {
      // Collect existing spec summaries (growing accumulator)
      const existingSpecs = getExistingSpecs(outputDir);

      const model = resolveModel([], "", config, flags.modelOverride);

      const prompt = renderPrompt(template, {
        inputs: flags.inputs,
        outputDir,
        existingSpecs,
      });

      return {
        prompt,
        model,
        sessionTitle: `Reverse: iteration ${iteration}`,
        iterationLabel: `reverse iteration ${iteration} (${existingSpecs.length} specs written)`,
      };
    },

    async handleResult(result, iteration) {
      if (result.status === "phase_done") {
        console.log("Input fully specified.");
        return false;
      }
      return result.status === "complete";
    },
  };

  return runPhaseLoop(projectDir, callbacks, {
    dryRun: flags.dryRun,
    maxIterations: flags.maxIterations,
    modelOverride: flags.modelOverride,
  });
}

function getExistingSpecs(outputDir: string): { filename: string; summary: string }[] {
  if (!existsSync(outputDir)) return [];

  return readdirSync(outputDir)
    .filter(f => f.endsWith(".md"))
    .map(f => {
      const content = readFileSync(join(outputDir, f), "utf-8");
      // Extract first heading and first paragraph as summary
      const lines = content.split("\n");
      const heading = lines.find(l => l.startsWith("# ")) || f;
      const bodyStart = lines.findIndex(l => l.trim() !== "" && !l.startsWith("#"));
      const summary = bodyStart >= 0 ? lines[bodyStart].trim() : "";
      return { filename: f, summary: `${heading.replace(/^#+ /, "")} — ${summary}`.slice(0, 200) };
    });
}
```

**Step 5: Run typecheck**

Run: `bun run typecheck`
Expected: May have errors — template system and beads.ts need updating (Tasks 5, 7).

**Step 6: Commit**

```bash
git add src/engine.ts src/forward.ts src/decompose.ts src/reverse.ts
git commit -m "feat: refactor engine into three-phase loop runner with forward, decompose, reverse"
```

---

### Task 5: Update beads.ts — add getAllReady and export runBr

**Files:**
- Modify: `src/beads.ts`

**Step 1: Export runBr**

Change `async function runBr` to `export async function runBr` so decompose.ts can use it to create epics.

**Step 2: Add getAllReady function**

After `getNextReady`, add:

```typescript
// Get ALL ready (unblocked) beads in an epic — agent picks from these
export async function getAllReady(epicId: string): Promise<BeadInfo[]> {
  const result = await runBr(["ready", "--parent", epicId, "--json", "--sort", "hybrid"]);
  const beads = result as Record<string, unknown>[];
  if (!beads || beads.length === 0) return [];
  return beads.map(mapBead);
}
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: Closer to passing, but template.ts still needs updates.

**Step 4: Commit**

```bash
git add src/beads.ts
git commit -m "feat: export runBr and add getAllReady for pure Ralph agent selection"
```

---

### Task 6: Update plugin to support phase_done status

**Files:**
- Modify: `.opencode/plugins/super-ralph.js`

**Step 1: Add phase_done to the status enum**

Change the `status` schema from:

```javascript
tool.schema.enum(["complete", "blocked", "failed"])
```

to:

```javascript
tool.schema.enum(["complete", "phase_done", "blocked", "failed"])
```

Update the description to mention `phase_done`:

```javascript
description: "Signal task/iteration completion. complete = done with this iteration; phase_done = entire phase is finished (all specs written, all beads created, etc.); blocked = can't proceed; failed = error.",
```

**Step 2: Commit**

```bash
git add .opencode/plugins/super-ralph.js
git commit -m "feat: add phase_done status to task_complete plugin tool"
```

---

### Task 7: Refactor template system for multiple templates

**Files:**
- Modify: `src/template.ts`

**Step 1: Update loadTemplate to accept a template filename**

Change the `loadTemplate` function signature to accept a filename parameter:

```typescript
export function loadTemplate(projectDir: string, filename: string = "forward.hbs"): HandlebarsTemplateDelegate {
  const templatePath = join(projectDir, ".super-ralph", filename);
  if (!existsSync(templatePath)) {
    throw new Error(`Prompt template not found at ${templatePath}. Run 'super-ralph init' first.`);
  }
  const source = readFileSync(templatePath, "utf-8");
  return Handlebars.compile(source);
}
```

**Step 2: Make renderPrompt accept any vars object**

Change `renderPrompt` to accept `Record<string, unknown>` instead of `TemplateVars`:

```typescript
export function renderPrompt(template: HandlebarsTemplateDelegate, vars: Record<string, unknown>): string {
  return template(vars);
}
```

Keep the old `TemplateVars` interface and `buildTemplateVars` function for backward compatibility, but they won't be used by the new phase loops (each phase passes its own vars shape directly).

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: Should be close to passing now.

**Step 4: Commit**

```bash
git add src/template.ts
git commit -m "feat: generalize template system for multiple phase-specific templates"
```

---

### Task 8: Create prompt templates for all three phases

**Files:**
- Rename: `.super-ralph/prompt.hbs` -> `.super-ralph/forward.hbs`
- Create: `.super-ralph/decompose.hbs`
- Create: `.super-ralph/reverse.hbs`
- Create: `templates/forward.hbs`
- Create: `templates/decompose.hbs`
- Create: `templates/reverse.hbs`

**Step 1: Rename prompt.hbs to forward.hbs and rewrite for pure Ralph**

The forward template now shows ALL ready beads and lets the agent pick. Replace the content of `.super-ralph/prompt.hbs` (renamed to `forward.hbs`) with:

```handlebars
{{!-- Forward Phase: beads -> code --}}
{{!-- The agent picks which ready bead to work on (pure Ralph). --}}

## Your Mission

You are one iteration of a Ralph loop. You have a fresh context — no memory of previous iterations. Your job: pick one ready bead from the epic, implement it, and signal completion.

## Epic: {{epicId}}

## Using `br` to Get Context

You have the `br` CLI available. Use it to discover and inspect beads:
- `br ready --parent {{epicId}} --json` — list all ready (unblocked) beads you can work on
- `br show <bead-id>` — full details for any bead (description, acceptance criteria, dependencies)
- `br show {{epicId}} --json` — epic overview with all children and their status
- `br dep tree <bead-id>` — dependency tree for a bead

Start by running `br ready --parent {{epicId}} --json` to see what's available, then pick the most important one.

{{#if recentProgress}}
## Recent Progress Notes
{{recentProgress}}
{{/if}}

## Workflow

1. Read AGENTS.md and README.md if they exist.
2. Read `.super-ralph/progress.md` for learnings from previous iterations.
3. Review the ready beads above. Pick the most important one.
4. Use `br show <bead-id>` to get full details for the bead you picked.
5. If you need context about completed beads (e.g., what a dependency implemented), use `br show` to look them up.
6. Search the codebase before implementing. Do not assume anything.
7. Implement the bead following its acceptance criteria exactly.
8. Run all quality gate commands. Fix any failures.
9. Self-review: every acceptance criterion met, no scope creep, no placeholders.
10. Commit with message: `feat: <bead-id> - <bead-title>`
11. Close the bead: `br close <bead-id>`
12. Update `.super-ralph/progress.md` with learnings.
13. Call `task_complete` with `status: "complete"`.

## Completion Signals

- `task_complete({ status: "complete" })` — You implemented and closed one bead. Loop continues.
- `task_complete({ status: "blocked" })` — You can't proceed. Explain why.
- `task_complete({ status: "failed" })` — Something went wrong. Explain what.
```

**Step 2: Create decompose.hbs**

Create `.super-ralph/decompose.hbs`:

```handlebars
{{!-- Decompose Phase: spec -> beads --}}
{{!-- The agent reads the spec + existing beads, creates ONE new bead per iteration. --}}

## Your Mission

You are one iteration of a decompose loop. You have a fresh context. Your job: read the spec and the beads created so far, then create ONE new bead for the most important missing piece.

## The Spec

{{{specContent}}}

## Epic ID: {{epicId}}

## Beads Created So Far

{{#if existingBeads.length}}
{{#each existingBeads}}
- **{{this.id}}**: {{this.title}} [{{this.status}}]
  Labels: {{#each this.labels}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
  Depends on: {{#each this.dependsOn}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
  {{#if this.description}}
  {{this.description}}
  {{/if}}
{{/each}}
{{else}}
No beads created yet — this is the first iteration.
{{/if}}

## Your Job

1. Read the spec carefully.
2. Review the existing beads.
3. Identify the most important piece of the spec NOT yet covered by a bead.
4. Create ONE bead using the `br` CLI:
   - `br create --parent {{epicId}} --title "US-NNN: <title>" --description "<description with acceptance criteria and quality gates>"`
   - Wire dependencies: `br dep add <new-bead-id> <depends-on-bead-id>` for each dependency
   - Add semantic area label: `br label add <new-bead-id> area:<category>` (e.g., area:frontend-design, area:backend, area:database, area:review)
5. Signal completion.

## Structuring Beads

- **Structure into phases.** Group related implementation beads into phases.
- **Right-size beads.** Each bead should be completable by a single agent in one context window.
- **Include acceptance criteria** in the bead description with a `## Acceptance Criteria` section.
- **Include quality gates** in the bead description with a `## Quality Gates` section.
{{#if includeReview}}
- **Add REVIEW beads** after each implementation phase. A REVIEW bead depends on all impl beads in its phase. Title format: `REVIEW-NNN: Review Phase N`.
{{/if}}
{{#if includeBugscan}}
- **Add BUGSCAN beads** after each REVIEW bead. A BUGSCAN bead depends on the REVIEW bead. Title format: `BUGSCAN-NNN: Bugscan Phase N`.
{{/if}}
{{#if includeAudit}}
- **Add an AUDIT bead** at the end that depends on all other beads. Title format: `AUDIT-001: Final audit`.
{{/if}}

## Area Labels

Apply ONE `area:` label per bead to guide model selection:
- `area:frontend-design` — UI/UX design, mockups, layout decisions
- `area:frontend-ui` — React/HTML/CSS implementation
- `area:backend` — API endpoints, business logic, server-side code
- `area:database` — Schema design, migrations, queries
- `area:infrastructure` — CI/CD, deployment, config
- `area:review` — code review beads
- `area:bugscan` — bug scanning beads
- Or any other descriptive area name.

## Completion Signals

- `task_complete({ status: "complete" })` — You created one bead. Loop continues.
- `task_complete({ status: "phase_done" })` — The spec is fully decomposed. All user stories, review, bugscan, and audit beads are created. Loop ends.
- `task_complete({ status: "failed" })` — Something went wrong.
```

**Step 3: Create reverse.hbs**

Create `.super-ralph/reverse.hbs`:

```handlebars
{{!-- Reverse Phase: input -> specs --}}
{{!-- The agent analyzes input, writes ONE spec file per iteration. --}}

## Your Mission

You are one iteration of a reverse loop. You have a fresh context. Your job: analyze the input and write ONE specification file for the most important unspecified aspect.

## Input

{{#each inputs}}
- `{{this}}`
{{/each}}

Use your tools to examine the input: read files, fetch URLs, view images, research products — whatever is appropriate.

## Output Directory: {{outputDir}}

## Specs Written So Far

{{#if existingSpecs.length}}
{{#each existingSpecs}}
- **{{this.filename}}**: {{this.summary}}
{{/each}}
{{else}}
No specs written yet — this is the first iteration.
{{/if}}

## Your Job

1. Examine the input using appropriate tools (read files, fetch URLs, view screenshots, etc.).
2. Review the specs already written to understand what's covered.
3. Identify the most important unspecified aspect.
4. Write ONE spec file to `{{outputDir}}/` with this structure:

```markdown
# Component: [Name]

## Purpose
[What it does and why it exists]

## Behavior
[Observable behavior, user-facing functionality, key flows]

## Interfaces
[Public API, inputs, outputs, events, data formats]

## Constraints
[Performance requirements, security, limitations, compatibility]

## Dependencies
[What it depends on, what depends on it]
```

5. Signal completion.

## Principles

- Describe WHAT and WHY, not HOW (no implementation details).
- This is a clean-room specification — describe behavior, not code structure.
- Each spec should cover one logical component, module, or feature area.
- Reference other specs by filename when describing dependencies.

## Completion Signals

- `task_complete({ status: "complete" })` — You wrote one spec file. Loop continues.
- `task_complete({ status: "phase_done" })` — All significant aspects of the input are specified. Loop ends.
- `task_complete({ status: "failed" })` — Something went wrong.
```

**Step 4: Copy templates to templates/ directory**

Copy the three `.hbs` files to `templates/` for the init skill to use when initializing new projects.

**Step 5: Commit**

```bash
git add .super-ralph/forward.hbs .super-ralph/decompose.hbs .super-ralph/reverse.hbs
git add templates/forward.hbs templates/decompose.hbs templates/reverse.hbs
git rm .super-ralph/prompt.hbs
git commit -m "feat: create prompt templates for all three phases (forward, decompose, reverse)"
```

---

### Task 9: Rewrite CLI entry point with three commands

**Files:**
- Modify: `src/index.ts`

**Step 1: Replace the entire CLI**

Rewrite `src/index.ts` with the three phase commands (`forward`, `decompose`, `reverse`) plus `status`, `doctor`, and `help`. Keep `run` as an alias for `forward`.

The `cmdForward` function calls `runForward()` from `src/forward.ts`.
The `cmdDecompose` function calls `runDecompose()` from `src/decompose.ts`.
The `cmdReverse` function calls `runReverse()` from `src/reverse.ts`.

Update `printUsage()` to show all three commands.

Update `cmdDoctor()` to check for all three template files (`forward.hbs`, `decompose.hbs`, `reverse.hbs`) instead of just `prompt.hbs`.

Update the `parseArgs` switch to handle `forward`, `decompose`, `reverse`, `run` (alias), `status`, `doctor`, `help`.

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Test doctor**

Run: `bun run src/index.ts doctor`
Expected: Shows checks including new template files.

**Step 4: Test dry-run**

Run: `bun run src/index.ts forward --epic bd-3fk --dry-run`
Expected: Shows dry-run output.

**Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: rewrite CLI with forward, decompose, reverse commands"
```

---

### Task 10: Update init skill and resume command for new templates

**Files:**
- Modify: `skills/super-ralph-init/SKILL.md`
- Modify: `commands/superralph:resume.md`

**Step 1: Update init skill**

The init skill currently copies `prompt.hbs`. Update it to copy three templates: `forward.hbs`, `decompose.hbs`, `reverse.hbs`. Update the checklist and report to mention all three.

**Step 2: Update resume command**

The resume command currently offers to run `bun run <cli_path> run`. Update it to offer `bun run <cli_path> forward` instead (or keep `run` since it's an alias). Add options for `decompose` and `reverse` commands.

**Step 3: Commit**

```bash
git add skills/super-ralph-init/SKILL.md commands/superralph:resume.md
git commit -m "feat: update init skill and resume for three-phase templates"
```

---

### Task 11: Verify and push

**Step 1: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 2: Run doctor**

Run: `bun run src/index.ts doctor`
Expected: All checks pass (except OpenCode server — expected in dev)

**Step 3: Run forward dry-run**

Run: `bun run src/index.ts forward --epic bd-3fk --dry-run`
Expected: Shows beads that would be processed

**Step 4: Run decompose dry-run**

Run: `bun run src/index.ts decompose --spec docs/plans/2026-02-24-three-phase-ralph-loop-design.md --dry-run`
Expected: Shows iteration output without creating beads

**Step 5: Run reverse dry-run**

Run: `bun run src/index.ts reverse --input ./src --dry-run`
Expected: Shows iteration output without writing specs

**Step 6: Push**

```bash
git push
```
