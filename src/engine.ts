import { loadConfig, resolveModel, mergeCliFlags } from "./config.js";
import { getNextReady, closeBead, getEpicProgress, getAllBeads } from "./beads.js";
import { loadTemplate, renderPrompt, buildTemplateVars } from "./template.js";
import { readRecentProgress, appendProgress } from "./progress.js";
import {
  connectToServer,
  createSession,
  sendPrompt,
  waitForCompletion,
  showToast,
  getSessionSummary,
} from "./opencode.js";
import type { LoopConfig, EngineFlags, LoopResult, IterationResult, CompletionResult } from "./types.js";

export async function runLoop(
  projectDir: string,
  epicId: string,
  flags: EngineFlags
): Promise<LoopResult> {
  // Load config and merge CLI flags
  let config = loadConfig(projectDir);
  config = mergeCliFlags(config, {});

  // Get initial bead count for max iterations default
  const allBeads = await getAllBeads(epicId);
  const maxIterations = flags.maxIterations || allBeads.length * 2;

  console.log(`Starting loop for epic ${epicId}: ${allBeads.length} beads, max ${maxIterations} iterations`);

  // Dry run doesn't need a server connection or prompt template
  if (flags.dryRun) {
    let iteration = 0;
    const seen = new Set<string>();
    while (iteration < maxIterations) {
      const bead = await getNextReady(epicId);
      if (!bead || seen.has(bead.id)) break;
      seen.add(bead.id);
      iteration++;
      const model = resolveModel(bead.labels, bead.title, config, flags.modelOverride);
      const modelString = `${model.providerID}/${model.modelID}`;
      console.log(`[dry-run] Iteration ${iteration}: ${bead.id} — ${bead.title} (model: ${modelString})`);
    }
    console.log(`\n[dry-run] Would process up to ${allBeads.length} beads`);
    return { completed: 0, failed: 0, skipped: 0, totalTime: 0 };
  }

  // Connect to OpenCode server (only needed for real runs)
  const client = await connectToServer(config.opencode.url);
  console.log(`Connected to OpenCode server at ${config.opencode.url}`);

  // Load prompt template
  const template = loadTemplate(projectDir);

  if (!flags.headless) {
    await showToast(client, `Starting epic ${epicId}: ${allBeads.length} beads`, "info");
  }

  let iteration = 0;
  let completed = 0;
  let failed = 0;
  let skipped = 0;
  const skippedBeads = new Set<string>();
  const retryCount = new Map<string, number>();
  const startTime = Date.now();

  while (iteration < maxIterations) {
    // Get next ready bead
    const bead = await getNextReady(epicId);

    if (!bead) {
      // No more ready beads — either all done or all blocked/skipped
      const progress = await getEpicProgress(epicId);
      if (progress.remaining === 0) {
        console.log("All beads complete!");
      } else {
        console.log(`No ready beads. ${progress.completed}/${progress.total} complete, ${progress.remaining} remaining (blocked or skipped).`);
      }
      break;
    }

    // Skip if this bead was previously skipped
    if (skippedBeads.has(bead.id)) {
      continue;
    }

    iteration++;

    // Resolve model for this bead
    const model = resolveModel(bead.labels, bead.title, config, flags.modelOverride);
    const modelString = `${model.providerID}/${model.modelID}`;

    console.log(`\n--- Iteration ${iteration} ---`);
    console.log(`Bead: ${bead.id} — ${bead.title}`);
    console.log(`Model: ${modelString}`);

    if (!flags.headless) {
      await showToast(client, `Starting ${bead.id}: ${bead.title}`, "info");
    }

    // Build and render prompt
    const recentProgress = readRecentProgress(projectDir, 5);
    const templateVars = buildTemplateVars(bead, recentProgress);
    const prompt = renderPrompt(template, templateVars);

    // Create session and send prompt
    const iterStartTime = Date.now();
    let result: CompletionResult;

    try {
      const sessionId = await createSession(client, `${bead.id}: ${bead.title}`);
      await sendPrompt(client, sessionId, prompt, model);

      // Wait for completion
      const timeoutMs = config.engine.timeout_minutes * 60 * 1000;
      result = await waitForCompletion(client, sessionId, timeoutMs);

      // Get session summary for progress tracking
      const summary = await getSessionSummary(client, sessionId);
      const iterDuration = Date.now() - iterStartTime;

      // Record iteration in progress.md
      const iterResult: IterationResult = {
        beadId: bead.id,
        beadTitle: bead.title,
        status: result.status,
        reason: result.reason,
        model: modelString,
        duration: iterDuration,
        cost: summary.cost,
        tokens: summary.tokens,
        filesChanged: summary.filesChanged,
      };

      appendProgress(projectDir, iteration, iterResult);

      // Handle result
      switch (result.status) {
        case "complete": {
          const { suggestNext } = await closeBead(bead.id);
          completed++;
          const unblocked = suggestNext.map((b) => b.id).join(", ");
          const message = unblocked
            ? `${bead.id} complete — ${unblocked} now unblocked`
            : `${bead.id} complete`;
          console.log(`✓ ${message}`);
          if (!flags.headless) {
            await showToast(client, message, "success");
          }
          break;
        }

        case "blocked": {
          skippedBeads.add(bead.id);
          skipped++;
          console.log(`⚠ ${bead.id} blocked: ${result.reason || "unknown reason"}`);
          if (!flags.headless) {
            await showToast(client, `${bead.id} blocked: ${result.reason || "unknown"}`, "warning");
          }
          break;
        }

        case "failed":
        case "stalled":
        case "timeout":
        case "error": {
          const currentRetries = retryCount.get(bead.id) || 0;

          if (config.engine.strategy === "retry" && currentRetries < config.engine.max_retries) {
            retryCount.set(bead.id, currentRetries + 1);
            console.log(`⚠ ${bead.id} ${result.status}, retrying (${currentRetries + 1}/${config.engine.max_retries})`);
            if (!flags.headless) {
              await showToast(
                client,
                `${bead.id} ${result.status}, retrying (${currentRetries + 1}/${config.engine.max_retries})`,
                "warning"
              );
            }
            // Don't skip — will be picked up again on next iteration
          } else if (config.engine.strategy === "abort") {
            failed++;
            console.log(`✗ ${bead.id} ${result.status} — aborting loop`);
            if (!flags.headless) {
              await showToast(client, `${bead.id} ${result.status} — aborting`, "error");
            }
          } else {
            // Skip (either strategy is "skip" or retries exhausted)
            skippedBeads.add(bead.id);
            skipped++;
            failed++;
            console.log(`✗ ${bead.id} skipped after ${currentRetries} retries`);
            if (!flags.headless) {
              await showToast(client, `${bead.id} skipped after ${currentRetries} retries`, "warning");
            }
          }
          break;
        }
      }

      // Check if we should abort (strategy === "abort" and a failure occurred)
      if (config.engine.strategy === "abort" && result.status !== "complete" && result.status !== "blocked") {
        break;
      }
    } catch (err) {
      const iterDuration = Date.now() - iterStartTime;
      const iterResult: IterationResult = {
        beadId: bead.id,
        beadTitle: bead.title,
        status: "error",
        reason: (err as Error).message,
        model: modelString,
        duration: iterDuration,
      };
      appendProgress(projectDir, iteration, iterResult);

      failed++;
      console.error(`✗ ${bead.id} error: ${(err as Error).message}`);

      if (config.engine.strategy === "abort") {
        break;
      }
      skippedBeads.add(bead.id);
      skipped++;
    }

    // Delay between iterations
    if (config.engine.iteration_delay_ms > 0) {
      await new Promise((resolve) => setTimeout(resolve, config.engine.iteration_delay_ms));
    }
  }

  // Final summary
  const totalTime = Date.now() - startTime;
  const progress = await getEpicProgress(epicId);

  console.log(`\n=== Loop Complete ===`);
  console.log(`Completed: ${completed}, Failed: ${failed}, Skipped: ${skipped}`);
  console.log(`Epic progress: ${progress.completed}/${progress.total} beads done`);
  console.log(`Total time: ${Math.round(totalTime / 1000)}s`);

  if (!flags.headless) {
    if (progress.remaining === 0) {
      await showToast(
        client,
        `Epic complete! ${progress.total} beads in ${Math.round(totalTime / 60000)}m`,
        "success"
      );
    } else {
      await showToast(
        client,
        `Loop ended. ${progress.completed}/${progress.total} beads done.`,
        "info"
      );
    }
  }

  return { completed, failed, skipped, totalTime };
}
