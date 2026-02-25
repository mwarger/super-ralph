import { runPhaseLoop, type PhaseCallbacks } from "./engine.js";
import { loadTemplate, renderPrompt } from "./template.js";
import { resolveModel, loadConfig } from "./config.js";
import { startServer, connectToServer } from "./opencode.js";
import { runInteractiveSession, createInteractiveClient } from "./interactive.js";
import { loadSkill, getCliDir } from "./skills.js";
import type { ReverseFlags, LoopResult } from "./types.js";
import { readdirSync, readFileSync, existsSync, mkdirSync, statSync } from "fs";
import { join } from "path";

export async function runReverse(projectDir: string, flags: ReverseFlags): Promise<LoopResult> {
  if (flags.interactive) {
    return runInteractive(projectDir, flags);
  }
  return runAutonomous(projectDir, flags);
}

async function runInteractive(projectDir: string, flags: ReverseFlags): Promise<LoopResult> {
  const config = loadConfig(projectDir);
  const template = loadTemplate(projectDir, "reverse.hbs");
  const outputDir = flags.outputDir || join(projectDir, config.reverse.output_dir);

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Load skill content
  const cliDir = getCliDir();
  const skillContent = loadSkill(flags.skill, cliDir);

  // Build seed description from inputs
  const seedDescription = flags.inputs.length > 0 ? flags.inputs.join(", ") : null;

  // Render template for interactive mode
  const prompt = renderPrompt(template, {
    interactive: true,
    hasInputs: flags.inputs.length > 0,
    inputs: flags.inputs,
    outputDir,
    skillContent,
    seedDescription,
  });

  const model = resolveModel([], "", config, flags.modelOverride);

  const systemPrompt = [
    "You are a super-ralph reverse session agent.",
    "Your job: understand what needs to be built through structured interrogation, then synthesize a spec.",
    "Use the question tool to ask the user questions. Ask ONE question at a time.",
    "Prefer multiple choice questions when possible.",
    "Signal completion via the task_complete tool:",
    '- status: "phase_done" — the spec is written and saved',
    '- status: "blocked" — you can\'t proceed, explain why',
  ].join("\n");

  if (flags.dryRun) {
    const modelStr = `${model.providerID}/${model.modelID}`;
    const mode = flags.inputs.length > 0 ? "mixed" : "interactive";
    console.log(`[dry-run] Would start ${mode} reverse session`);
    console.log(`[dry-run] Model: ${modelStr}`);
    console.log(`[dry-run] Output: ${outputDir}`);
    if (flags.skill) console.log(`[dry-run] Skill: ${flags.skill}`);
    if (flags.inputs.length > 0) console.log(`[dry-run] Inputs: ${flags.inputs.join(", ")}`);
    return { completed: 0, failed: 0, skipped: 0, totalTime: 0 };
  }

  // Start server
  const startTime = Date.now();
  let server;
  if (flags.attach) {
    server = await connectToServer(flags.attach);
    console.log(`Attached to OpenCode server at ${server.url}`);
  } else {
    server = await startServer();
    console.log(`OpenCode server at ${server.url}`);
  }

  try {
    // Create a v2 client for interactive session (has question API)
    const v2Client = createInteractiveClient(server.url);

    // Create session
    const mode = flags.inputs.length > 0 ? "mixed" : "interactive";
    const sessionResponse = await v2Client.session.create({ title: `Reverse: ${mode} session` });
    if (!sessionResponse.data) {
      throw new Error("Failed to create session");
    }
    const sessionId = sessionResponse.data.id;

    console.log(`Session: ${sessionId} — starting ${mode} reverse...`);

    // Run interactive session
    const result = await runInteractiveSession(v2Client, sessionId, prompt, model, systemPrompt);

    const totalTime = Date.now() - startTime;

    if (result.completion.status === "phase_done") {
      console.log("\nSpec complete.");
      return { completed: 1, failed: 0, skipped: 0, totalTime };
    } else if (result.completion.status === "blocked") {
      console.log(`\nBlocked: ${result.completion.reason || "unknown"}`);
      return { completed: 0, failed: 0, skipped: 1, totalTime };
    } else {
      console.log(`\nSession ended: ${result.completion.status}`);
      return { completed: 0, failed: 1, skipped: 0, totalTime };
    }
  } finally {
    server.close();
  }
}

async function runAutonomous(projectDir: string, flags: ReverseFlags): Promise<LoopResult> {
  let template: ReturnType<typeof loadTemplate>;
  let outputDir: string;
  let skillContent: string | null = null;

  const callbacks: PhaseCallbacks = {
    async setup(config, dryRun) {
      template = loadTemplate(projectDir, "reverse.hbs");
      outputDir = flags.outputDir || join(projectDir, config.reverse.output_dir);

      if (!dryRun && !existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      // Load skill content
      const cliDir = getCliDir();
      skillContent = loadSkill(flags.skill, cliDir);

      const inputSummary = flags.inputs.join(", ");
      return {
        maxIterations: 20,
        description: `Reverse loop: ${inputSummary} -> spec in ${outputDir}`,
      };
    },

    async nextIteration(config, iteration) {
      const currentSpec = getCurrentSpec(outputDir);
      const model = resolveModel([], "", config, flags.modelOverride);

      const prompt = renderPrompt(template, {
        interactive: false,
        hasInputs: true,
        inputs: flags.inputs,
        outputDir,
        currentSpec: currentSpec?.content || "",
        currentSpecFilename: currentSpec?.filename || "",
        isFirstIteration: !currentSpec,
        skillContent,
      });

      const systemPrompt = [
        "You are an autonomous coding agent in a super-ralph reverse loop iteration.",
        "Your job: analyze the input and create or refine a specification document.",
        "Describe WHAT and WHY, not HOW. Write clean-room specs, not code descriptions.",
        "Signal completion via the task_complete tool:",
        '- status: "complete" — you expanded/refined the spec, loop continues',
        '- status: "phase_done" — the spec comprehensively covers the input, loop ends',
        '- status: "blocked" — you can\'t proceed, explain why',
        '- status: "failed" — something went wrong, explain what',
      ].join("\n");

      return {
        prompt,
        model,
        systemPrompt,
        sessionTitle: `Reverse: iteration ${iteration}`,
        iterationLabel: `reverse iteration ${iteration}${currentSpec ? " (refining " + currentSpec.filename + ")" : " (initial draft)"}`,
      };
    },

    async handleResult(result, iteration) {
      if (result.status === "phase_done") {
        console.log("Input fully specified.");
        return false;
      }
      return result.status === "complete";
    },
  };

  return runPhaseLoop(projectDir, callbacks, flags);
}

function getCurrentSpec(outputDir: string): { filename: string; content: string } | null {
  if (!existsSync(outputDir)) return null;

  const mdFiles = readdirSync(outputDir)
    .filter(f => f.endsWith(".md"))
    .map(f => ({
      filename: f,
      path: join(outputDir, f),
      mtime: statSync(join(outputDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (mdFiles.length === 0) return null;

  const latest = mdFiles[0];
  return {
    filename: latest.filename,
    content: readFileSync(latest.path, "utf-8"),
  };
}
