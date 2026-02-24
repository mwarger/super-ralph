import { runPhaseLoop, type PhaseCallbacks } from "./engine.js";
import { getAllBeads, getAllReady, getEpicProgress } from "./beads.js";
import { loadTemplate, renderPrompt } from "./template.js";
import { readRecentProgress } from "./progress.js";
import { resolveModel } from "./config.js";
import type { ForwardFlags, LoopResult } from "./types.js";

export async function runForward(projectDir: string, flags: ForwardFlags): Promise<LoopResult> {
  const epicId = flags.epicId;
  let template: ReturnType<typeof loadTemplate>;

  const callbacks: PhaseCallbacks = {
    async setup(config, dryRun) {
      const allBeads = await getAllBeads(epicId);
      template = loadTemplate(projectDir, "forward.hbs");
      return {
        maxIterations: allBeads.length * 2,
        description: `Forward loop for epic ${epicId}: ${allBeads.length} beads`,
      };
    },

    async nextIteration(config, iteration) {
      const readyCount = (await getAllReady(epicId)).length;
      if (readyCount === 0) {
        const progress = await getEpicProgress(epicId);
        if (progress.remaining === 0) {
          console.log("All beads complete!");
        } else {
          console.log(`No ready beads. ${progress.completed}/${progress.total} complete.`);
        }
        return null;
      }

      const recentProgress = readRecentProgress(projectDir, 5);
      const model = resolveModel([], "", config, flags.modelOverride);

      const prompt = renderPrompt(template, {
        epicId,
        recentProgress,
      });

      const systemPrompt = [
        "You are an autonomous coding agent in a super-ralph forward loop iteration.",
        "Your job: pick one ready bead from the epic, implement it, close it.",
        "Use `br ready`, `br show`, `br close` to interact with beads.",
        "Run `bun run typecheck` before committing. Fix any failures.",
        "Signal completion via the task_complete tool:",
        '- status: "complete" — you implemented and closed one bead, loop continues',
        '- status: "phase_done" — all work is done, loop ends',
        '- status: "blocked" — you can\'t proceed, explain why',
        '- status: "failed" — something went wrong, explain what',
      ].join("\n");

      return {
        prompt,
        model,
        systemPrompt,
        sessionTitle: `Forward: ${epicId} (iteration ${iteration})`,
        iterationLabel: `${epicId}: forward iteration ${iteration} (${readyCount} ready)`,
      };
    },

    async handleResult(result, iteration) {
      if (result.status === "phase_done") return false;
      if (result.status === "complete") return true;
      return true;
    },
  };

  return runPhaseLoop(projectDir, callbacks, flags);
}
