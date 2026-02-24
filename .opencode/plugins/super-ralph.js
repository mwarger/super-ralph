import path from 'path';
import fs from 'fs';
import { tool } from "@opencode-ai/plugin/tool";

export const SuperRalphPlugin = async ({ client, directory }) => {
  return {
    'experimental.chat.system.transform': async (_input, output) => {
      const configPath = path.join(directory, '.super-ralph', 'AGENTS.md');
      const isInitialized = fs.existsSync(configPath);

      const message = isInitialized
        ? 'This project uses super-ralph. Commands: /super-ralph:feature, /super-ralph:bug, /super-ralph:hotfix, /super-ralph:refactor, /super-ralph:plan, /super-ralph:status.'
        : 'The super-ralph framework is available. Run /super-ralph:init to set up.';

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
