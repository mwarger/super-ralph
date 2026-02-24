#!/usr/bin/env bun
import { runLoop } from "./engine.js";
import { getEpicProgress, getAllBeads } from "./beads.js";
import { loadConfig } from "./config.js";
import type { EngineFlags } from "./types.js";

function printUsage(): void {
  console.log(`
super-ralph — OpenCode SDK execution loop for beads

Usage:
  super-ralph run --epic <ID> [options]    Run the execution loop
  super-ralph status --epic <ID>           Show epic progress
  super-ralph doctor                       Preflight checks
  super-ralph help                         Show this help

Run options:
  --epic <ID>              Epic bead ID (required)
  --model <provider/model> Override default model for all beads
  --max-iterations <n>     Maximum iterations (default: beads x 2)
  --timeout <minutes>      Per-bead timeout in minutes (default: 30)
  --strategy <s>           Error strategy: retry, skip, abort (default: retry)
  --dry-run                Show what would run without executing
  --headless               Skip toast notifications
`);
}

function parseArgs(args: string[]): { command: string; flags: Record<string, string | boolean> } {
  const command = args[0] || "help";
  const flags: Record<string, string | boolean> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (key === "dry-run" || key === "headless") {
        flags[key] = true;
      } else if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        flags[key] = args[++i];
      } else {
        flags[key] = true;
      }
    }
  }

  return { command, flags };
}

async function cmdRun(flags: Record<string, string | boolean>): Promise<void> {
  const epicId = flags.epic as string;
  if (!epicId) {
    console.error("Error: --epic <ID> is required");
    process.exit(1);
  }

  const engineFlags: EngineFlags = {
    dryRun: !!flags["dry-run"],
    headless: !!flags.headless,
    maxIterations: flags["max-iterations"] ? parseInt(flags["max-iterations"] as string, 10) : undefined,
    modelOverride: flags.model as string | undefined,
  };

  const projectDir = process.cwd();
  const result = await runLoop(projectDir, epicId, engineFlags);

  if (result.failed > 0) {
    process.exit(1);
  }
}

async function cmdStatus(flags: Record<string, string | boolean>): Promise<void> {
  const epicId = flags.epic as string;
  if (!epicId) {
    console.error("Error: --epic <ID> is required");
    process.exit(1);
  }

  const progress = await getEpicProgress(epicId);
  const beads = await getAllBeads(epicId);

  console.log(`Epic: ${epicId}`);
  console.log(`Progress: ${progress.completed}/${progress.total} beads complete`);
  console.log(`Remaining: ${progress.remaining}`);

  const byStatus = {
    open: beads.filter((b) => b.status === "open"),
    in_progress: beads.filter((b) => b.status === "in_progress"),
    closed: beads.filter((b) => b.status === "closed"),
  };

  if (byStatus.in_progress.length > 0) {
    console.log(`\nIn progress:`);
    byStatus.in_progress.forEach((b) => console.log(`  ${b.id}: ${b.title}`));
  }

  if (byStatus.open.length > 0) {
    console.log(`\nOpen:`);
    byStatus.open.forEach((b) => console.log(`  ${b.id}: ${b.title}`));
  }

  if (progress.remaining === 0) {
    console.log(`\nAll beads complete!`);
  }
}

async function cmdDoctor(): Promise<void> {
  const projectDir = process.cwd();
  let allGood = true;

  const { existsSync } = await import("fs");
  const { join } = await import("path");

  // Check bun
  try {
    const proc = Bun.spawn(["bun", "--version"], { stdout: "pipe", stderr: "pipe" });
    const stdout = await new Response(proc.stdout).text();
    await proc.exited;
    console.log(`✓ bun: ${stdout.trim()}`);
  } catch {
    console.log("✗ bun: not found");
    console.log('  Fix: curl -fsSL https://bun.sh/install | bash');
    allGood = false;
  }

  // Check br CLI
  try {
    const proc = Bun.spawn(["br", "--version"], { stdout: "pipe", stderr: "pipe" });
    const stdout = await new Response(proc.stdout).text();
    await proc.exited;
    console.log(`✓ br CLI: ${stdout.trim()}`);
  } catch {
    console.log("✗ br CLI: not found");
    console.log('  Fix: curl -fsSL "https://raw.githubusercontent.com/Dicklesworthstone/beads_rust/main/install.sh?$(date +%s)" | bash');
    allGood = false;
  }

  // Check .super-ralph directory
  if (existsSync(join(projectDir, ".super-ralph", "AGENTS.md"))) {
    console.log("✓ Project initialized (.super-ralph/AGENTS.md)");
  } else {
    console.log("✗ Project not initialized");
    console.log("  Fix: /superralph:init");
    allGood = false;
  }

  if (existsSync(join(projectDir, ".super-ralph", "prompt.hbs"))) {
    console.log("✓ Prompt template (.super-ralph/prompt.hbs)");
  } else {
    console.log("✗ Prompt template missing");
    console.log("  Fix: /superralph:init");
    allGood = false;
  }

  if (existsSync(join(projectDir, ".super-ralph", "config.toml"))) {
    console.log("✓ Config (.super-ralph/config.toml)");
  } else {
    console.log("✗ Config not found");
    console.log("  Fix: /superralph:init");
    allGood = false;
  }

  // Check OpenCode server
  const config = loadConfig(projectDir);
  try {
    const response = await fetch(`${config.opencode.url}/session`);
    if (response.ok) {
      console.log(`✓ OpenCode server: ${config.opencode.url}`);
    } else {
      console.log(`✗ OpenCode server: responded with ${response.status}`);
      console.log("  Fix: opencode serve --port 4096");
      allGood = false;
    }
  } catch {
    console.log(`✗ OpenCode server: not reachable at ${config.opencode.url}`);
    console.log("  Fix: opencode serve --port 4096");
    allGood = false;
  }

  // Check plugin
  if (existsSync(join(projectDir, ".opencode", "plugins", "super-ralph.js"))) {
    console.log("✓ OpenCode plugin (.opencode/plugins/super-ralph.js)");
  } else {
    console.log("✗ OpenCode plugin missing");
    console.log("  Fix: /superralph:init");
    allGood = false;
  }

  // Check .beads/ workspace
  if (existsSync(join(projectDir, ".beads"))) {
    console.log("✓ Beads workspace (.beads/)");
  } else {
    console.log("✗ Beads workspace not initialized");
    console.log("  Fix: br init");
    allGood = false;
  }

  // Check cli.path
  if (config.cli.path && existsSync(config.cli.path)) {
    console.log(`✓ CLI path: ${config.cli.path}`);
  } else if (config.cli.path) {
    console.log(`✗ CLI path not found: ${config.cli.path}`);
    console.log("  Fix: /superralph:init to re-detect");
    allGood = false;
  } else {
    console.log("⚠ CLI path not set in config");
    console.log("  Fix: /superralph:init to set [cli] path");
  }

  if (allGood) {
    console.log("\nAll checks passed!");
  } else {
    console.log("\nSome checks failed — fix issues above.");
    process.exit(1);
  }
}

// Main
const args = process.argv.slice(2);
const { command, flags } = parseArgs(args);

switch (command) {
  case "run":
    await cmdRun(flags);
    break;
  case "status":
    await cmdStatus(flags);
    break;
  case "doctor":
    await cmdDoctor();
    break;
  case "help":
  case "--help":
  case "-h":
    printUsage();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
}
