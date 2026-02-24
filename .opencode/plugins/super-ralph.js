import path from 'path';
import fs from 'fs';
import { tool } from "@opencode-ai/plugin/tool";

export const SuperRalphPlugin = async ({ client, directory }) => {
  return {
    'experimental.chat.system.transform': async (_input, output) => {
      const configPath = path.join(directory, '.super-ralph', 'AGENTS.md');
      const isInitialized = fs.existsSync(configPath);

      const message = isInitialized
        ? 'This project uses the super-ralph SDLC pipeline. Commands: /superralph:feature, /superralph:bug, /superralph:hotfix, /superralph:refactor, /superralph:plan, /superralph:resume, /superralph:status. Read .super-ralph/AGENTS.md for framework instructions.'
        : 'The super-ralph SDLC framework is available. Run /superralph:init or say "initialize this project for super-ralph" to set up this project.';

      (output.system ||= []).push(message);
    },
    tool: {
      task_complete: tool({
        description: "Signal task/iteration completion. complete = done with this iteration; phase_done = entire phase is finished (all specs written, all beads created, etc.); blocked = can't proceed; failed = error.",
        args: {
          status: tool.schema.enum(["complete", "phase_done", "blocked", "failed"])
            .describe("complete = done with this iteration (loop continues); phase_done = entire phase finished (loop ends); blocked = can't proceed; failed = error"),
          reason: tool.schema.string().optional()
            .describe("Brief explanation of the outcome"),
        },
        async execute(args) {
          return `Task marked as ${args.status}${args.reason ? ': ' + args.reason : ''}. The orchestration loop will handle the next steps.`;
        },
      }),
    },
  };
};
