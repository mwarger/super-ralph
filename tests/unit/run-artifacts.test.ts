import { describe, it, expect } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { startRunTracker } from "../../src/run-state";
import { getRunStatus } from "../../src/run-status";

function withTempProject(run: (projectDir: string) => void): void {
  const projectDir = mkdtempSync(join(tmpdir(), "super-ralph-run-artifacts-"));
  try {
    run(projectDir);
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
}

describe("run-state artifacts", () => {
  it("creates session artifacts and global mirror", () => {
    withTempProject((projectDir) => {
      const tracker = startRunTracker(projectDir, "Unit test run", 5);

      const runSessionPath = join(projectDir, ".super-ralph", "runs", tracker.runId, "session.json");
      const globalSessionPath = join(projectDir, ".super-ralph", "session.json");

      expect(existsSync(runSessionPath)).toBe(true);
      expect(existsSync(globalSessionPath)).toBe(true);

      const runSession = JSON.parse(readFileSync(runSessionPath, "utf-8"));
      const globalSession = JSON.parse(readFileSync(globalSessionPath, "utf-8"));

      expect(runSession.runId).toBe(tracker.runId);
      expect(runSession.status).toBe("running");
      expect(runSession.maxIterations).toBe(5);
      expect(globalSession.runId).toBe(tracker.runId);
      expect(globalSession.status).toBe("running");
    });
  });

  it("records events and updates counters", () => {
    withTempProject((projectDir) => {
      const tracker = startRunTracker(projectDir, "Counter test", 10);

      tracker.recordEvent({ type: "iteration.started", iteration: 1, label: "Task 1", model: "test/model" });
      tracker.recordEvent({
        type: "iteration.completed",
        iteration: 1,
        label: "Task 1",
        status: "complete",
        reason: "done",
      });
      tracker.recordEvent({ type: "loop.completed", completed: 1, failed: 2, skipped: 3, totalTimeMs: 100 });

      const runDir = join(projectDir, ".super-ralph", "runs", tracker.runId);
      const eventsPath = join(runDir, "events.jsonl");
      const sessionPath = join(runDir, "session.json");

      const lines = readFileSync(eventsPath, "utf-8")
        .split("\n")
        .filter((line) => line.trim().length > 0);
      const session = JSON.parse(readFileSync(sessionPath, "utf-8"));

      expect(lines.length).toBe(3);
      expect(session.currentIteration).toBe(1);
      expect(session.completed).toBe(1);
      expect(session.failed).toBe(2);
      expect(session.skipped).toBe(3);
    });
  });

  it("writes transcripts only when stream data is present", () => {
    withTempProject((projectDir) => {
      const tracker = startRunTracker(projectDir, "Transcript test", 3);

      const empty = tracker.writeIterationTranscript(1, "No Output", "", "");
      expect(empty).toBeUndefined();

      const relPath = tracker.writeIterationTranscript(
        2,
        "Create auth middleware",
        "raw event line",
        "display stream"
      );
      expect(relPath).toBeDefined();

      const absPath = join(projectDir, relPath!);
      const content = readFileSync(absPath, "utf-8");

      expect(content.includes("# Iteration 2 Transcript")).toBe(true);
      expect(content.includes("## Display Stream")).toBe(true);
      expect(content.includes("display stream")).toBe(true);
      expect(content.includes("## Raw Event Stream")).toBe(true);
      expect(content.includes("raw event line")).toBe(true);
    });
  });

  it("finalize updates run status", () => {
    withTempProject((projectDir) => {
      const tracker = startRunTracker(projectDir, "Finalize test", 2);
      tracker.finalize("completed");

      const sessionPath = join(projectDir, ".super-ralph", "runs", tracker.runId, "session.json");
      const session = JSON.parse(readFileSync(sessionPath, "utf-8"));

      expect(session.status).toBe("completed");
    });
  });
});

describe("run-status inspection", () => {
  it("reads run status for a specific run", () => {
    withTempProject((projectDir) => {
      const tracker = startRunTracker(projectDir, "Inspect run", 4);
      tracker.recordEvent({ type: "iteration.started", iteration: 1, label: "Task", model: "test/model" });
      tracker.recordEvent({ type: "iteration.blocked", iteration: 1, label: "Task", reason: "blocked" });
      tracker.writeIterationTranscript(1, "Task", "raw", "display");

      const status = getRunStatus(projectDir, tracker.runId);
      expect(status.runId).toBe(tracker.runId);
      expect(status.session.description).toBe("Inspect run");
      expect(status.eventCount).toBe(2);
      expect(status.lastEventType).toBe("iteration.blocked");
      expect(status.latestTranscript?.endsWith(".log")).toBe(true);
    });
  });

  it("resolves latest run when --run latest is requested", () => {
    withTempProject((projectDir) => {
      const runsDir = join(projectDir, ".super-ralph", "runs");
      const oldRun = join(runsDir, "1000-old");
      const newRun = join(runsDir, "2000-new");
      mkdirSync(join(oldRun, "iterations"), { recursive: true });
      mkdirSync(join(newRun, "iterations"), { recursive: true });

      writeFileSync(
        join(oldRun, "session.json"),
        JSON.stringify({
          runId: "1000-old",
          status: "completed",
          description: "Old run",
          maxIterations: 1,
          startedAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:01:00.000Z",
          currentIteration: 1,
          completed: 1,
          failed: 0,
          skipped: 0,
        }) + "\n"
      );

      writeFileSync(
        join(newRun, "session.json"),
        JSON.stringify({
          runId: "2000-new",
          status: "running",
          description: "New run",
          maxIterations: 10,
          startedAt: "2026-01-01T01:00:00.000Z",
          updatedAt: "2026-01-01T01:01:00.000Z",
          currentIteration: 2,
          completed: 1,
          failed: 0,
          skipped: 0,
        }) + "\n"
      );

      const status = getRunStatus(projectDir, "latest");
      expect(status.runId).toBe("2000-new");
      expect(status.session.description).toBe("New run");
    });
  });
});
