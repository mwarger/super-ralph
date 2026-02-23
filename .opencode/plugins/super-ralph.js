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
        description: "Signal that the current bead/task is complete, blocked, or failed. Call this ONLY after you have finished all acceptance criteria, run quality gates, committed your work, and updated progress.md.",
        args: {
          status: tool.schema.enum(["complete", "blocked", "failed"])
            .describe("complete = all criteria met; blocked = can't proceed due to dependency/issue; failed = error or unable to complete"),
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
