import { tool } from "@opencode-ai/plugin";

export default async (ctx) => {
  return {
    tool: {
      task_complete: tool({
        description:
          "Signal task/iteration completion. MUST be called as the final action in every session.",
        args: {
          status: tool.schema
            .enum(["complete", "phase_done", "blocked", "failed"])
            .describe(
              'Completion status: "complete" = done, loop continues; "phase_done" = all work done, loop ends; "blocked" = cannot proceed; "failed" = error occurred',
            ),
          reason: tool.schema
            .string()
            .optional()
            .describe("Explanation of the status (required for blocked/failed)"),
        },
        async execute(args) {
          return `Task marked as ${args.status}${args.reason ? ": " + args.reason : ""}`;
        },
      }),
    },
  };
};
