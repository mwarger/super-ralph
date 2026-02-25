#!/usr/bin/env bun
import { runForward } from "./forward.js";
import { runDecompose } from "./decompose.js";
import { runReverse } from "./reverse.js";
import { runInit } from "./init.js";
import { getEpicProgress, getAllBeads } from "./beads.js";
import { loadConfig } from "./config.js";
import { checkBrokenSymlinks } from "./opencode.js";
import { writeFileSync } from "fs";
import type { ForwardFlags, DecomposeFlags, ReverseFlags, LoopResult } from "./types.js";

function writeJsonResult(path: string, result: LoopResult): void {
  writeFileSync(path, JSON.stringify(result, null, 2) + "\n");
}

function printUsage(): void {
  console.log(`
super-ralph — Three-phase Ralph loop engine

Usage:
  super-ralph forward --epic <ID> [options]     Beads -> code (implement beads)
  super-ralph decompose --spec <path> [options]  Spec -> beads (create beads from spec)
  super-ralph reverse [inputs...] [options]      Input -> spec (generate spec from input)
  super-ralph init                                Scaffold .super-ralph/ in current project
  super-ralph status --epic <ID>                 Show epic progress
  super-ralph doctor                             Preflight checks
  super-ralph help                               Show this help

Aliases:
  super-ralph run --epic <ID> [options]          Alias for 'forward'

Common options:
  --model <provider/model>   Override default model for all iterations
  --max-iterations <n>       Maximum iterations (default varies by phase)
  --dry-run                  Show what would run without executing
  --attach <url>             Attach to existing OpenCode server instead of spawning one
  --json <path>              Write structured JSON results to file

Forward options:
  --epic <ID>                Epic bead ID (required)

Decompose options:
  --spec <path>              Path to spec/PRD file (required)
  --epic-title <title>       Title for the created epic

Reverse options:
  [inputs...]                Positional args: paths, URLs, or descriptions
  --skill <name-or-path>     Question bank / skill to use
  --interactive              Force interactive mode (default when no inputs)
  --output <dir>             Output directory for specs (default: docs/specs)

Reverse modes:
  No inputs, no --interactive  → interactive (implied)
  Inputs without --interactive → autonomous
  Inputs with --interactive    → mixed
  --interactive without inputs → interactive
`);
}

/** Boolean flags that never take a value argument */
const BOOLEAN_FLAGS = new Set(["dry-run", "interactive", "fix"]);

function parseArgs(args: string[]): {
  command: string;
  positionals: string[];
  flags: Record<string, string | boolean>;
} {
  const command = args[0] || "help";
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (BOOLEAN_FLAGS.has(key)) {
        flags[key] = true;
      } else if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        flags[key] = args[++i];
      } else {
        flags[key] = true;
      }
    } else {
      positionals.push(arg);
    }
  }

  return { command, positionals, flags };
}

async function cmdForward(flags: Record<string, string | boolean>): Promise<void> {
  const epicId = flags.epic as string;
  if (!epicId) {
    console.error("Error: --epic <ID> is required");
    process.exit(1);
  }

  const forwardFlags: ForwardFlags = {
    epicId,
    dryRun: !!flags["dry-run"],
    maxIterations: flags["max-iterations"] ? parseInt(flags["max-iterations"] as string, 10) : undefined,
    modelOverride: flags.model as string | undefined,
    attach: flags.attach as string | undefined,
  };

  const projectDir = process.cwd();
  const result = await runForward(projectDir, forwardFlags);

  if (flags.json) writeJsonResult(flags.json as string, result);
  if (result.failed > 0) {
    process.exit(1);
  }
}

async function cmdDecompose(flags: Record<string, string | boolean>): Promise<void> {
  const specPath = flags.spec as string;
  if (!specPath) {
    console.error("Error: --spec <path> is required");
    process.exit(1);
  }

  const decomposeFlags: DecomposeFlags = {
    specPath,
    epicTitle: flags["epic-title"] as string | undefined,
    dryRun: !!flags["dry-run"],
    maxIterations: flags["max-iterations"] ? parseInt(flags["max-iterations"] as string, 10) : undefined,
    modelOverride: flags.model as string | undefined,
    attach: flags.attach as string | undefined,
  };

  const projectDir = process.cwd();
  const result = await runDecompose(projectDir, decomposeFlags);

  if (flags.json) writeJsonResult(flags.json as string, result);
  if (result.failed > 0) {
    process.exit(1);
  }
}

async function cmdReverse(positionals: string[], flags: Record<string, string | boolean>): Promise<void> {
  const hasInputs = positionals.length > 0;
  const isInteractive = !!flags.interactive;

  // Mode detection:
  //   No inputs and no --interactive -> interactive (implied)
  //   Inputs without --interactive   -> autonomous
  //   Inputs with --interactive      -> mixed
  //   --interactive without inputs   -> interactive
  const interactive = !hasInputs || isInteractive;

  const reverseFlags: ReverseFlags = {
    inputs: positionals,
    outputDir: flags.output as string | undefined,
    skill: flags.skill as string | undefined,
    interactive,
    dryRun: !!flags["dry-run"],
    maxIterations: flags["max-iterations"] ? parseInt(flags["max-iterations"] as string, 10) : undefined,
    modelOverride: flags.model as string | undefined,
    attach: flags.attach as string | undefined,
  };

  const projectDir = process.cwd();
  const result = await runReverse(projectDir, reverseFlags);

  if (flags.json) writeJsonResult(flags.json as string, result);
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

async function cmdDoctor(flags: Record<string, string | boolean> = {}): Promise<void> {
  const shouldFix = !!flags.fix;
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
    console.log("  Fix: super-ralph init");
    allGood = false;
  }

  // Check prompt templates (all three phases)
  const templates = ["forward.hbs", "decompose.hbs", "reverse.hbs"];
  for (const tmpl of templates) {
    if (existsSync(join(projectDir, ".super-ralph", tmpl))) {
      console.log(`✓ Template: .super-ralph/${tmpl}`);
    } else {
      console.log(`✗ Template missing: .super-ralph/${tmpl}`);
      console.log("  Fix: super-ralph init");
      allGood = false;
    }
  }

  if (existsSync(join(projectDir, ".super-ralph", "config.toml"))) {
    console.log("✓ Config (.super-ralph/config.toml)");
  } else {
    console.log("✗ Config not found");
    console.log("  Fix: super-ralph init");
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
  const config = loadConfig(projectDir);
  if (config.cli.path && existsSync(config.cli.path)) {
    console.log(`✓ CLI path: ${config.cli.path}`);
  } else if (config.cli.path) {
    console.log(`✗ CLI path not found: ${config.cli.path}`);
    console.log("  Fix: super-ralph init");
    allGood = false;
  } else {
    console.log("⚠ CLI path not set in config");
    console.log("  Fix: super-ralph init");
  }

  // Check for broken symlinks in ~/.config/opencode/
  if (shouldFix) {
    const fixed = checkBrokenSymlinks({ fix: true });
    if (fixed.length > 0) {
      console.log(`✓ Fixed ${fixed.length} broken symlink(s) in ~/.config/opencode/`);
    } else {
      console.log("✓ No broken symlinks in ~/.config/opencode/");
    }
  } else {
    const brokenSymlinks = checkBrokenSymlinks();
    if (brokenSymlinks.length > 0) {
      console.log(`✗ Broken symlinks in ~/.config/opencode/ (${brokenSymlinks.length} found)`);
      for (const s of brokenSymlinks) {
        console.log(`    ${s}`);
      }
      console.log("  Fix: super-ralph doctor --fix (or remove them manually)");
      allGood = false;
    } else {
      console.log("✓ No broken symlinks in ~/.config/opencode/");
    }
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
const { command, positionals, flags } = parseArgs(args);

switch (command) {
  case "run":  // backward compatibility alias
  case "forward":
    await cmdForward(flags);
    break;
  case "decompose":
    await cmdDecompose(flags);
    break;
  case "reverse":
    await cmdReverse(positionals, flags);
    break;
  case "init":
    await runInit(process.cwd());
    break;
  case "status":
    await cmdStatus(flags);
    break;
  case "doctor":
    await cmdDoctor(flags);
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
