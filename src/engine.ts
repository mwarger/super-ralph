import { loadConfig } from "./config.js";
import { startServer, connectToServer, createSession, runPrompt, type ServerHandle } from "./opencode.js";
import { appendProgress } from "./progress.js";
import type { LoopConfig, LoopResult, IterationResult, CompletionResult, PhaseFlags } from "./types.js";

export interface PhaseIteration {
  prompt: string;
  model: { providerID: string; modelID: string };
  sessionTitle: string;
  iterationLabel: string;
  beadId?: string;
  systemPrompt?: string;
}

export interface PhaseCallbacks {
  setup(config: LoopConfig, dryRun: boolean): Promise<{ maxIterations: number; description: string }>;
  nextIteration(config: LoopConfig, iteration: number): Promise<PhaseIteration | null>;
  handleResult(result: CompletionResult, iteration: number): Promise<boolean>;
}

export async function runPhaseLoop(
  projectDir: string,
  callbacks: PhaseCallbacks,
  flags: PhaseFlags,
): Promise<LoopResult> {
  const config = loadConfig(projectDir);

  const { maxIterations: defaultMax, description } = await callbacks.setup(config, flags.dryRun);
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

        const timeoutMs = config.engine.timeout_minutes * 60 * 1000;
        const promptResult = await Promise.race([
          runPrompt(server.client, sessionId, next.prompt, next.model, next.systemPrompt),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Iteration timed out after ${config.engine.timeout_minutes}m`)), timeoutMs)
          ),
        ]);
        const result = promptResult.completion;
        const iterDuration = Date.now() - iterStartTime;

        const iterResult: IterationResult = {
          beadId: next.beadId || `iter-${iteration}`,
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
          const key = next.iterationLabel;
          const currentRetries = retryCount.get(key) || 0;
          if (config.engine.strategy === "retry" && currentRetries < config.engine.max_retries) {
            retryCount.set(key, currentRetries + 1);
            console.log(`⚠ ${next.iterationLabel} ${result.status}, retrying (${currentRetries + 1}/${config.engine.max_retries})`);
            iteration--;
          } else if (config.engine.strategy === "abort") {
            failed++;
            console.log(`✗ ${next.iterationLabel} ${result.status} — aborting`);
            break;
          } else {
            failed++;
            console.log(`✗ ${next.iterationLabel} ${result.status} — skipping`);
          }
        }

        if (!shouldContinue) break;

      } catch (err) {
        const iterDuration = Date.now() - iterStartTime;
        const iterResult: IterationResult = {
          beadId: next.beadId || `iter-${iteration}`,
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
