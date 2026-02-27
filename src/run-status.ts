import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";

export interface RunSessionStatus {
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

export interface RunStatus {
  runId: string;
  runDir: string;
  session: RunSessionStatus;
  eventCount: number;
  lastEventType?: string;
  lastEventTimestamp?: string;
  latestTranscript?: string;
}

function getRunsDir(projectDir: string): string {
  return join(projectDir, ".super-ralph", "runs");
}

function resolveRunId(projectDir: string, runRef: string): string {
  const runsDir = getRunsDir(projectDir);
  if (!existsSync(runsDir)) {
    throw new Error("No run artifacts found (.super-ralph/runs)");
  }

  if (runRef !== "latest") {
    const runDir = join(runsDir, runRef);
    if (!existsSync(runDir)) {
      throw new Error(`Run not found: ${runRef}`);
    }
    return runRef;
  }

  const runIds = readdirSync(runsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const latest = runIds.at(-1);
  if (!latest) {
    throw new Error("No run artifacts found (.super-ralph/runs)");
  }
  return latest;
}

export function getRunStatus(projectDir: string, runRef: string): RunStatus {
  const runId = resolveRunId(projectDir, runRef);
  const runDir = join(getRunsDir(projectDir), runId);
  const sessionPath = join(runDir, "session.json");

  if (!existsSync(sessionPath)) {
    throw new Error(`Run session artifact missing: ${sessionPath}`);
  }

  const session = JSON.parse(readFileSync(sessionPath, "utf-8")) as RunSessionStatus;

  const eventsPath = join(runDir, "events.jsonl");
  let eventCount = 0;
  let lastEventType: string | undefined;
  let lastEventTimestamp: string | undefined;

  if (existsSync(eventsPath)) {
    const lines = readFileSync(eventsPath, "utf-8")
      .split("\n")
      .filter((line) => line.trim().length > 0);
    eventCount = lines.length;
    const lastLine = lines.at(-1);
    if (lastLine) {
      try {
        const parsed = JSON.parse(lastLine) as { ts?: string; event?: { type?: string } };
        lastEventType = parsed.event?.type;
        lastEventTimestamp = parsed.ts;
      } catch {
        // Best effort only.
      }
    }
  }

  const iterationsDir = join(runDir, "iterations");
  let latestTranscript: string | undefined;
  if (existsSync(iterationsDir)) {
    const transcripts = readdirSync(iterationsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".log"))
      .map((entry) => entry.name)
      .sort();

    const latest = transcripts.at(-1);
    if (latest) {
      latestTranscript = join(".super-ralph", "runs", runId, "iterations", latest);
    }
  }

  return {
    runId,
    runDir,
    session,
    eventCount,
    lastEventType,
    lastEventTimestamp,
    latestTranscript,
  };
}
