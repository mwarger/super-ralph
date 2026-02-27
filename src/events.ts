import type { CompletionResult } from "./types.js";

export type EngineEvent =
  | { type: "loop.description"; description: string }
  | { type: "loop.dry_run_iteration"; iteration: number; label: string; model: string }
  | { type: "loop.dry_run_complete"; iterations: number; maxIterations: number }
  | { type: "server.started"; url: string }
  | { type: "server.attached"; url: string }
  | { type: "server.attach_hint"; url: string }
  | { type: "iteration.started"; iteration: number; label: string; model: string }
  | { type: "iteration.session_created"; sessionId: string }
  | {
      type: "iteration.completed";
      iteration: number;
      label: string;
      status: Extract<CompletionResult["status"], "complete" | "phase_done">;
      reason?: string;
    }
  | { type: "iteration.blocked"; iteration: number; label: string; reason?: string }
  | {
      type: "iteration.retrying";
      iteration: number;
      label: string;
      status: Exclude<CompletionResult["status"], "complete" | "phase_done" | "blocked">;
      attempt: number;
      maxRetries: number;
    }
  | {
      type: "iteration.failed";
      iteration: number;
      label: string;
      status: Exclude<CompletionResult["status"], "complete" | "phase_done" | "blocked">;
      action: "aborting" | "skipping";
    }
  | { type: "iteration.error"; iteration: number; label: string; error: string }
  | {
      type: "loop.completed";
      completed: number;
      failed: number;
      skipped: number;
      totalTimeMs: number;
    };

export type EngineEventListener = (event: EngineEvent) => void;

export class EngineEventEmitter {
  private listeners = new Set<EngineEventListener>();

  on(listener: EngineEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: EngineEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export function attachDefaultConsoleRenderer(emitter: EngineEventEmitter): () => void {
  return emitter.on((event) => {
    switch (event.type) {
      case "loop.description":
        console.log(event.description);
        break;
      case "loop.dry_run_iteration":
        console.log(`[dry-run] Iteration ${event.iteration}: ${event.label} (model: ${event.model})`);
        break;
      case "loop.dry_run_complete":
        console.log(`\n[dry-run] Would run up to ${event.iterations} iterations`);
        break;
      case "server.started":
        console.log(`OpenCode server at ${event.url}`);
        break;
      case "server.attached":
        console.log(`Attached to OpenCode server at ${event.url}`);
        break;
      case "server.attach_hint":
        console.log(`Attach TUI: opencode attach ${event.url}`);
        break;
      case "iteration.started":
        console.log(`\n--- Iteration ${event.iteration} ---`);
        console.log(event.label);
        console.log(`Model: ${event.model}`);
        break;
      case "iteration.session_created":
        console.log(`Session: ${event.sessionId} — sending prompt...`);
        break;
      case "iteration.completed":
        console.log(`✓ ${event.label} — ${event.status}`);
        if (event.reason) {
          console.log(`  reason: ${event.reason}`);
        }
        break;
      case "iteration.blocked":
        console.log(`⚠ ${event.label} blocked: ${event.reason || "unknown"}`);
        break;
      case "iteration.retrying":
        console.log(`⚠ ${event.label} ${event.status}, retrying (${event.attempt}/${event.maxRetries})`);
        break;
      case "iteration.failed":
        console.log(`✗ ${event.label} ${event.status} — ${event.action}`);
        break;
      case "iteration.error":
        console.error(`✗ ${event.label} error: ${event.error}`);
        break;
      case "loop.completed":
        console.log("\n=== Phase Complete ===");
        console.log(`Completed: ${event.completed}, Failed: ${event.failed}, Skipped: ${event.skipped}`);
        console.log(`Total time: ${Math.round(event.totalTimeMs / 1000)}s`);
        break;
    }
  });
}
