import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import { getCliDir } from "./skills.js";

export async function runInit(projectDir: string): Promise<void> {
  const cliDir = getCliDir();
  const templatesDir = join(cliDir, "templates");
  const superRalphDir = join(projectDir, ".super-ralph");

  console.log("Initializing super-ralph...\n");

  // 1. Create .super-ralph/ directory
  if (!existsSync(superRalphDir)) {
    mkdirSync(superRalphDir, { recursive: true });
    console.log("  Created .super-ralph/");
  } else {
    console.log("  .super-ralph/ already exists");
  }

  // 2. Copy templates (skip if exists)
  const templateFiles = [
    { src: "agents.md", dest: "AGENTS.md" },
    { src: "forward.hbs", dest: "forward.hbs" },
    { src: "decompose.hbs", dest: "decompose.hbs" },
    { src: "reverse.hbs", dest: "reverse.hbs" },
    { src: "intake-checklist.md", dest: "intake-checklist.md" },
  ];

  for (const { src, dest } of templateFiles) {
    const srcPath = join(templatesDir, src);
    const destPath = join(superRalphDir, dest);

    if (existsSync(destPath)) {
      console.log(`  Skipped .super-ralph/${dest} (already exists)`);
      continue;
    }

    if (!existsSync(srcPath)) {
      console.log(`  Warning: template ${src} not found at ${srcPath}`);
      continue;
    }

    writeFileSync(destPath, readFileSync(srcPath, "utf-8"));
    console.log(`  Created .super-ralph/${dest}`);
  }

  // 3. Create config.toml with cli.path set
  const configDest = join(superRalphDir, "config.toml");
  if (existsSync(configDest)) {
    console.log("  Skipped .super-ralph/config.toml (already exists)");
  } else {
    const configSrc = join(templatesDir, "super-ralph-config.toml");
    if (existsSync(configSrc)) {
      let configContent = readFileSync(configSrc, "utf-8");
      // Set cli.path to the src/index.ts in the CLI project
      const cliPath = join(cliDir, "src", "index.ts");
      configContent = configContent.replace(
        /^path\s*=\s*""/m,
        `path = "${cliPath}"`,
      );
      writeFileSync(configDest, configContent);
      console.log("  Created .super-ralph/config.toml");
    } else {
      console.log("  Warning: config template not found");
    }
  }

  // 4. Create tasks/ directory
  const tasksDir = join(projectDir, "tasks");
  if (!existsSync(tasksDir)) {
    mkdirSync(tasksDir, { recursive: true });
    console.log("  Created tasks/");
  } else {
    console.log("  tasks/ already exists");
  }

  // 5. Initialize beads workspace
  const beadsDir = join(projectDir, ".beads");
  if (existsSync(beadsDir)) {
    console.log("  .beads/ already exists");
  } else {
    try {
      const proc = Bun.spawn(["br", "init"], {
        cwd: projectDir,
        stdout: "pipe",
        stderr: "pipe",
      });
      await proc.exited;
      if (existsSync(beadsDir)) {
        console.log("  Initialized .beads/ workspace");
      } else {
        console.log("  Warning: br init ran but .beads/ not created");
      }
    } catch {
      console.log("  Warning: br init failed (run manually: br init)");
    }
  }

  // 6. Update root AGENTS.md
  const rootAgents = join(projectDir, "AGENTS.md");
  const referenceLine =
    "Also read .super-ralph/AGENTS.md for SDLC framework instructions.";

  if (existsSync(rootAgents)) {
    const content = readFileSync(rootAgents, "utf-8");
    if (content.includes(".super-ralph/AGENTS.md")) {
      console.log("  AGENTS.md already references .super-ralph/AGENTS.md");
    } else {
      appendFileSync(rootAgents, `\n${referenceLine}\n`);
      console.log("  Updated AGENTS.md with .super-ralph reference");
    }
  } else {
    writeFileSync(
      rootAgents,
      `# Agent Instructions\n\n${referenceLine}\n`,
    );
    console.log("  Created AGENTS.md");
  }

  // Report
  console.log("\nInit complete. Next steps:");
  console.log("  1. Edit .super-ralph/config.toml to customize settings");
  console.log("  2. Run: super-ralph reverse");
  console.log("  3. Run: super-ralph doctor to verify setup");
}
