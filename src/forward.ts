import { runPhaseLoop, type PhaseCallbacks } from "./engine.js";
import { getAllBeads, getAllReady, getBeadDetails, getEpicProgress } from "./beads.js";
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
      const readyBeads = await getAllReady(epicId);
      if (readyBeads.length === 0) {
        const progress = await getEpicProgress(epicId);
        if (progress.remaining === 0) {
          console.log("All beads complete!");
        } else {
          console.log(`No ready beads. ${progress.completed}/${progress.total} complete.`);
        }
        return null;
      }

      // Orchestrator picks the highest-priority ready bead
      const picked = readyBeads[0];
      const bead = await getBeadDetails(picked.id);
      console.log(`Selected bead: ${bead.id} — ${bead.title}`);

      const recentProgress = readRecentProgress(projectDir, 5);
      const model = resolveModel(bead.labels, bead.title, config, flags.modelOverride);

      const prompt = renderPrompt(template, {
        epicId,
        beadId: bead.id,
        beadTitle: bead.title,
        beadDescription: bead.description || "",
        beadLabels: bead.labels,
        beadDependsOn: bead.dependsOn,
        readyCount: readyBeads.length,
        recentProgress,
      });

      const systemPrompt = [
        "You are an autonomous coding agent in a super-ralph forward loop iteration.",
        "Your job: implement the assigned bead and close it.",
        "Use `br show`, `br close` to interact with beads.",
        "Run `bun run typecheck` before committing. Fix any failures.",
        "",
        "CRITICAL: You MUST call task_complete as your FINAL action. Never end without it.",
        "Signal completion via the task_complete tool:",
        '- status: "complete" — you implemented and closed the bead, loop continues',
        '- status: "phase_done" — all work is done, loop ends',
        '- status: "blocked" — you can\'t proceed, explain why',
        '- status: "failed" — something went wrong, explain what',
        "",
        "IMPORTANT: Always provide a `reason` explaining your status decision. For complete, summarize what you implemented and which acceptance criteria you verified. For blocked/failed, explain what went wrong. This is critical for evaluation.",
      ].join("\n");

      return {
        prompt,
        model,
        systemPrompt,
        beadId: bead.id,
        sessionTitle: `Forward: ${bead.id} — ${bead.title}`,
        iterationLabel: `${bead.id}: ${bead.title} (${readyBeads.length} ready)`,
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
