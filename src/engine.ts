import { loadConfig } from "./config.js";
import { startServer, connectToServer, createSession, runPrompt, type ServerHandle } from "./opencode.js";
import { appendProgress } from "./progress.js";
import type { LoopConfig, LoopResult, IterationResult, CompletionResult, PhaseFlags } from "./types.js";
import { EngineEventEmitter, attachDefaultConsoleRenderer, type EngineEventListener } from "./events.js";
import { startRunTracker } from "./run-state.js";
import { withTimeout } from "./timeout.js";

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
  onEvent?: EngineEventListener,
): Promise<LoopResult> {
  const emitter = new EngineEventEmitter();
  const detachConsole = attachDefaultConsoleRenderer(emitter);
  const detachExternal = onEvent ? emitter.on(onEvent) : null;

  let server: ServerHandle | undefined;

  const cleanup = () => {
    if (server) {
      server.close();
    }
    detachConsole();
    if (detachExternal) detachExternal();
  };

  const config = loadConfig(projectDir);

  const { maxIterations: defaultMax, description } = await callbacks.setup(config, flags.dryRun);
  const maxIterations = flags.maxIterations || defaultMax;
  const runTracker = startRunTracker(projectDir, description, maxIterations);
  const detachTracker = emitter.on((event) => runTracker.recordEvent(event));
  let finalized = false;

  try {
    emitter.emit({ type: "loop.description", description });

    if (flags.dryRun) {
      let iteration = 0;
      while (iteration < maxIterations) {
        const next = await callbacks.nextIteration(config, iteration + 1);
        if (!next) break;
        iteration++;
        const modelStr = `${next.model.providerID}/${next.model.modelID}`;
        emitter.emit({
          type: "loop.dry_run_iteration",
          iteration,
          label: next.iterationLabel,
          model: modelStr,
        });
      }
      emitter.emit({
        type: "loop.dry_run_complete",
        iterations: iteration,
        maxIterations,
      });
      runTracker.finalize("completed");
      finalized = true;
      return { completed: 0, failed: 0, skipped: 0, totalTime: 0, maxIterations, iterations: [] };
    }

    if (flags.attach) {
      server = await connectToServer(flags.attach);
      emitter.emit({ type: "server.attached", url: server.url });
    } else {
      server = await startServer();
      emitter.emit({ type: "server.started", url: server.url });
      emitter.emit({ type: "server.attach_hint", url: server.url });
    }

    let iteration = 0;
    let completed = 0;
    let failed = 0;
    let skipped = 0;
    const iterations: IterationResult[] = [];
    const retryCount = new Map<string, number>();
    const startTime = Date.now();

    while (iteration < maxIterations) {
      const next = await callbacks.nextIteration(config, iteration + 1);
      if (!next) break;

      iteration++;
      const modelStr = `${next.model.providerID}/${next.model.modelID}`;
      emitter.emit({
        type: "iteration.started",
        iteration,
        label: next.iterationLabel,
        model: modelStr,
      });

      const iterStartTime = Date.now();

      try {
        const sessionId = await createSession(server.client, next.sessionTitle);
        emitter.emit({ type: "iteration.session_created", sessionId });

        const timeoutMs = config.engine.timeout_minutes * 60 * 1000;
        const inactivityTimeoutMs = config.engine.inactivity_timeout_seconds * 1000;
        const promptResult = await withTimeout(
          runPrompt(server.client, sessionId, next.prompt, next.model, next.systemPrompt, server.url, inactivityTimeoutMs),
          timeoutMs,
          `Iteration timed out after ${config.engine.timeout_minutes}m`,
        );
        const result = promptResult.completion;
        const iterDuration = Date.now() - iterStartTime;

        const iterResult: IterationResult = {
          iteration,
          beadId: next.beadId || `iter-${iteration}`,
          beadTitle: next.iterationLabel,
          status: result.status,
          reason: result.reason,
          model: modelStr,
          duration: iterDuration,
          cost: promptResult.cost,
          tokens: promptResult.tokens,
          filesChanged: promptResult.filesChanged,
        };

        const transcriptPath = runTracker.writeIterationTranscript(
          iteration,
          next.iterationLabel,
          promptResult.rawOutput,
          promptResult.displayOutput,
        );
        if (transcriptPath) {
          iterResult.transcriptPath = transcriptPath;
        }

        iterations.push(iterResult);
        appendProgress(projectDir, iteration, iterResult);

        const shouldContinue = await callbacks.handleResult(result, iteration);

        if (result.status === "complete" || result.status === "phase_done") {
          completed++;
          emitter.emit({
            type: "iteration.completed",
            iteration,
            label: next.iterationLabel,
            status: result.status,
            reason: result.reason,
          });
        } else if (result.status === "blocked") {
          skipped++;
          emitter.emit({
            type: "iteration.blocked",
            iteration,
            label: next.iterationLabel,
            reason: result.reason,
          });
        } else {
          const key = next.iterationLabel;
          const currentRetries = retryCount.get(key) || 0;
          if (config.engine.strategy === "retry" && currentRetries < config.engine.max_retries) {
            retryCount.set(key, currentRetries + 1);
            emitter.emit({
              type: "iteration.retrying",
              iteration,
              label: next.iterationLabel,
              status: result.status,
              attempt: currentRetries + 1,
              maxRetries: config.engine.max_retries,
            });
            iteration--;
          } else if (config.engine.strategy === "abort") {
            failed++;
            emitter.emit({
              type: "iteration.failed",
              iteration,
              label: next.iterationLabel,
              status: result.status,
              action: "aborting",
            });
            break;
          } else {
            failed++;
            emitter.emit({
              type: "iteration.failed",
              iteration,
              label: next.iterationLabel,
              status: result.status,
              action: "skipping",
            });
          }
        }

        if (!shouldContinue) break;

      } catch (err) {
        const iterDuration = Date.now() - iterStartTime;
        const iterResult: IterationResult = {
          iteration,
          beadId: next.beadId || `iter-${iteration}`,
          beadTitle: next.iterationLabel,
          status: "error",
          reason: (err as Error).message,
          model: modelStr,
          duration: iterDuration,
        };
        iterations.push(iterResult);
        appendProgress(projectDir, iteration, iterResult);
        failed++;
        emitter.emit({
          type: "iteration.error",
          iteration,
          label: next.iterationLabel,
          error: (err as Error).message,
        });
        if (config.engine.strategy === "abort") break;
      }

      if (config.engine.iteration_delay_ms > 0) {
        await new Promise((r) => setTimeout(r, config.engine.iteration_delay_ms));
      }
    }
    const totalTime = Date.now() - startTime;
    emitter.emit({
      type: "loop.completed",
      completed,
      failed,
      skipped,
      totalTimeMs: totalTime,
    });

    runTracker.finalize(failed > 0 ? "failed" : "completed");
    finalized = true;

    return { completed, failed, skipped, totalTime, maxIterations, iterations };
  } finally {
    detachTracker();
    if (!finalized) {
      runTracker.finalize("failed");
    }
    cleanup();
  }
}
