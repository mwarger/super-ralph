import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { EngineEvent } from "./events.js";

export interface RunTracker {
  runId: string;
  runDir: string;
  recordEvent(event: EngineEvent): void;
  writeIterationTranscript(iteration: number, label: string, rawOutput?: string, displayOutput?: string): string | undefined;
  finalize(status: "completed" | "failed"): void;
}

interface SessionState {
  runId: string;
  status: "running" | "completed" | "failed";
  description: string;
  maxIterations: number;
  startedAt: string;
  updatedAt: string;
  currentIteration: number;
  completed: number;
  failed: number;
  skipped: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function sanitizeName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "iteration";
}

export function startRunTracker(projectDir: string, description: string, maxIterations: number): RunTracker {
  const baseDir = join(projectDir, ".super-ralph", "runs");
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true });
  }

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const runDir = join(baseDir, runId);
  const iterationsDir = join(runDir, "iterations");
  mkdirSync(iterationsDir, { recursive: true });

  const statePath = join(runDir, "session.json");
  const globalStatePath = join(projectDir, ".super-ralph", "session.json");
  const eventsPath = join(runDir, "events.jsonl");

  const state: SessionState = {
    runId,
    status: "running",
    description,
    maxIterations,
    startedAt: nowIso(),
    updatedAt: nowIso(),
    currentIteration: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
  };

  const writeState = () => {
    state.updatedAt = nowIso();
    writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
    writeFileSync(globalStatePath, JSON.stringify(state, null, 2) + "\n");
  };

  const updateFromEvent = (event: EngineEvent) => {
    switch (event.type) {
      case "iteration.started":
        state.currentIteration = event.iteration;
        break;
      case "iteration.completed":
        state.completed += 1;
        break;
      case "iteration.blocked":
        state.skipped += 1;
        break;
      case "iteration.failed":
      case "iteration.error":
        state.failed += 1;
        break;
      case "loop.completed":
        state.completed = event.completed;
        state.failed = event.failed;
        state.skipped = event.skipped;
        break;
      default:
        break;
    }
  };

  writeState();

  return {
    runId,
    runDir,
    recordEvent(event: EngineEvent) {
      appendFileSync(eventsPath, JSON.stringify({ ts: nowIso(), event }) + "\n");
      updateFromEvent(event);
      writeState();
    },
    writeIterationTranscript(iteration: number, label: string, rawOutput?: string, displayOutput?: string) {
      const hasRaw = !!rawOutput && rawOutput.trim().length > 0;
      const hasDisplay = !!displayOutput && displayOutput.trim().length > 0;
      if (!hasRaw && !hasDisplay) return undefined;

      const filename = `${String(iteration).padStart(3, "0")}-${sanitizeName(label)}.log`;
      const relPath = join(".super-ralph", "runs", runId, "iterations", filename);
      const absPath = join(iterationsDir, filename);

      let body = "";
      body += `# Iteration ${iteration} Transcript\n`;
      body += `# Label: ${label}\n\n`;
      if (hasDisplay) {
        body += "## Display Stream\n\n";
        body += `${displayOutput}\n\n`;
      }
      if (hasRaw) {
        body += "## Raw Event Stream\n\n";
        body += `${rawOutput}\n`;
      }
      writeFileSync(absPath, body);
      return relPath;
    },
    finalize(status: "completed" | "failed") {
      state.status = status;
      writeState();
    },
  };
}
