import { runPhaseLoop, type PhaseCallbacks } from "./engine.js";
import { loadTemplate, renderPrompt } from "./template.js";
import { resolveModel } from "./config.js";
import type { ReverseFlags, LoopResult } from "./types.js";
import { readdirSync, readFileSync, existsSync, mkdirSync, statSync } from "fs";
import { join } from "path";

export async function runReverse(projectDir: string, flags: ReverseFlags): Promise<LoopResult> {
  let template: ReturnType<typeof loadTemplate>;
  let outputDir: string;

  const callbacks: PhaseCallbacks = {
    async setup(config, dryRun) {
      template = loadTemplate(projectDir, "reverse.hbs");
      outputDir = flags.outputDir || join(projectDir, config.reverse.output_dir);

      if (!dryRun && !existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

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
        inputs: flags.inputs,
        outputDir,
        currentSpec: currentSpec?.content || "",
        currentSpecFilename: currentSpec?.filename || "",
        isFirstIteration: !currentSpec,
      });

      return {
        prompt,
        model,
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
