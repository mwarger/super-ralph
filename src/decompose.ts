import { runPhaseLoop, type PhaseCallbacks } from "./engine.js";
import { loadTemplate, renderPrompt } from "./template.js";
import { resolveModel } from "./config.js";
import { runBr, getAllBeads } from "./beads.js";
import type { DecomposeFlags, LoopResult } from "./types.js";
import { readFileSync, existsSync } from "fs";

export async function runDecompose(projectDir: string, flags: DecomposeFlags): Promise<LoopResult> {
  let template: ReturnType<typeof loadTemplate>;
  let epicId: string;

  const callbacks: PhaseCallbacks = {
    async setup(config, dryRun) {
      template = loadTemplate(projectDir, "decompose.hbs");

      if (!existsSync(flags.specPath)) {
        throw new Error(`Spec file not found: ${flags.specPath}`);
      }

      if (dryRun) {
        epicId = "dry-run-epic";
        return {
          maxIterations: 50,
          description: `[dry-run] Decompose: ${flags.specPath} (epic creation skipped)`,
        };
      }

      const title = flags.epicTitle || `Decompose: ${flags.specPath}`;
      const result = await runBr(["create", "--type", "epic", "--title", title, "--json"]);
      const created = Array.isArray(result) ? result[0] : result;
      epicId = (created as Record<string, unknown>).id as string;
      console.log(`Created epic: ${epicId}`);

      return {
        maxIterations: 50,
        description: `Decompose loop: ${flags.specPath} -> beads (epic ${epicId})`,
      };
    },

    async nextIteration(config, iteration) {
      const specContent = readFileSync(flags.specPath, "utf-8");
      const existingBeads = epicId === "dry-run-epic" ? [] : await getAllBeads(epicId);
      const model = resolveModel([], "", config, flags.modelOverride);

      const prompt = renderPrompt(template, {
        specContent,
        epicId,
        existingBeads,
        includeReview: config.decompose.include_review,
        includeBugscan: config.decompose.include_bugscan,
        includeAudit: config.decompose.include_audit,
      });

      const systemPrompt = [
        "You are an autonomous coding agent in a super-ralph decompose loop iteration.",
        "Your job: read the spec and existing beads, then create ONE new bead for the most important missing piece.",
        "Use the `br` CLI to create beads, wire dependencies, and add area labels.",
        "Signal completion via the task_complete tool:",
        '- status: "complete" — you created one bead, loop continues',
        '- status: "phase_done" — the spec is fully decomposed into beads, loop ends',
        '- status: "blocked" — you can\'t proceed, explain why',
        '- status: "failed" — something went wrong, explain what',
      ].join("\n");

      return {
        prompt,
        model,
        systemPrompt,
        sessionTitle: `Decompose: ${epicId} (iteration ${iteration})`,
        iterationLabel: `${epicId}: decompose iteration ${iteration} (${existingBeads.length} beads exist)`,
      };
    },

    async handleResult(result, iteration) {
      if (result.status === "phase_done") {
        console.log("Spec fully decomposed.");
        return false;
      }
      return result.status === "complete";
    },
  };

  return runPhaseLoop(projectDir, callbacks, flags);
}
