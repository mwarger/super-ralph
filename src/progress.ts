import { readFileSync, appendFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import type { IterationResult } from "./types.js";

const PROGRESS_FILE = "progress.md";

export function readRecentProgress(projectDir: string, count: number = 5): string {
  const progressPath = join(projectDir, ".super-ralph", PROGRESS_FILE);
  if (!existsSync(progressPath)) {
    return "";
  }
  
  const content = readFileSync(progressPath, "utf-8");
  
  // Split by iteration headers (## Iteration N)
  const blocks = content.split(/(?=^## Iteration \d+)/m);
  
  // Take the last N blocks (skip the first element if it's empty or a file header)
  const iterationBlocks = blocks.filter((b) => b.trim().startsWith("## Iteration"));
  const recent = iterationBlocks.slice(-count);
  
  return recent.join("\n").trim();
}

export function appendProgress(
  projectDir: string,
  iteration: number,
  result: IterationResult
): void {
  const progressPath = join(projectDir, ".super-ralph", PROGRESS_FILE);
  
  // Create file with header if it doesn't exist
  if (!existsSync(progressPath)) {
    writeFileSync(progressPath, "# Execution Progress\n\n", "utf-8");
  }
  
  const entry = formatProgressEntry(iteration, result);
  appendFileSync(progressPath, entry, "utf-8");
}

export function formatProgressEntry(iteration: number, result: IterationResult): string {
  const statusLabel = result.status.toUpperCase();
  const duration = formatDuration(result.duration);
  
  let entry = `## Iteration ${iteration} — ${result.beadId}: ${result.beadTitle} [${statusLabel}]\n`;
  entry += `- Model: ${result.model}\n`;
  entry += `- Duration: ${duration}\n`;
  
  if (result.cost !== undefined) {
    entry += `- Cost: $${result.cost.toFixed(4)}\n`;
  }
  
  if (result.tokens) {
    entry += `- Tokens: ${result.tokens.input} in / ${result.tokens.output} out`;
    if (result.tokens.reasoning > 0) {
      entry += ` / ${result.tokens.reasoning} reasoning`;
    }
    entry += "\n";
  }
  
  if (result.filesChanged && result.filesChanged.length > 0) {
    entry += `- Files changed: ${result.filesChanged.join(", ")}\n`;
  }
  
  if (result.reason) {
    entry += `- Notes: ${result.reason}\n`;
  }
  
  entry += "\n";
  return entry;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }
  return `${minutes}m ${remainingSeconds}s`;
}
