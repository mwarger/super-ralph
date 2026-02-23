import { createOpencodeClient, type OpencodeClient, type Part } from "@opencode-ai/sdk";
import type { CompletionResult } from "./types.js";

export type { OpencodeClient };

export interface PromptResult {
  completion: CompletionResult;
  cost: number;
  tokens: { input: number; output: number; reasoning: number };
  filesChanged: string[];
}

// Connect to an existing OpenCode server
export async function connectToServer(url: string): Promise<OpencodeClient> {
  const client = createOpencodeClient({ baseUrl: url });

  // Verify server is reachable by listing sessions
  try {
    await client.session.list();
    return client;
  } catch (err) {
    throw new Error(
      `Cannot connect to OpenCode server at ${url}: ${(err as Error).message}`,
    );
  }
}

// Create a new session for a bead
export async function createSession(
  client: OpencodeClient,
  title: string,
): Promise<string> {
  const response = await client.session.create({ body: { title } });
  if (!response.data) {
    throw new Error("Failed to create session");
  }
  return response.data.id;
}

// Send a prompt and wait for the complete response (synchronous API).
// session.prompt() blocks until the agent finishes all turns and returns the
// final assistant message. We then scan all session messages for task_complete.
export async function runPrompt(
  client: OpencodeClient,
  sessionId: string,
  prompt: string,
  model: { providerID: string; modelID: string },
): Promise<PromptResult> {
  const response = await client.session.prompt({
    path: { id: sessionId },
    body: {
      model,
      parts: [{ type: "text" as const, text: prompt }],
    },
  });

  if (!response.data) {
    return {
      completion: { status: "error", reason: "No response data from prompt" },
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0 },
      filesChanged: [],
    };
  }

  const { info, parts } = response.data;

  // Check for errors in the assistant message
  if (info.role === "assistant" && info.error) {
    const errorName = (info.error as Record<string, unknown>).name as string || "unknown";
    const errorMsg = (info.error as Record<string, unknown>).message as string || "unknown error";
    return {
      completion: { status: "error", reason: `${errorName}: ${errorMsg}` },
      cost: info.cost || 0,
      tokens: {
        input: info.tokens?.input || 0,
        output: info.tokens?.output || 0,
        reasoning: info.tokens?.reasoning || 0,
      },
      filesChanged: [],
    };
  }

  // The synchronous prompt() returns only the final assistant message.
  // But task_complete may have been called in an earlier turn (multi-step agent).
  // First check the returned parts, then fall back to scanning all session messages.
  let completion = extractCompletion(parts);
  if (completion.status === "stalled") {
    const allMessages = await client.session.messages({
      path: { id: sessionId },
    });
    if (allMessages.data) {
      for (const msg of allMessages.data) {
        const found = extractCompletion(msg.parts);
        if (found.status !== "stalled") {
          completion = found;
          break;
        }
      }
    }
  }

  // Sum cost/tokens across ALL assistant messages in the session
  let totalCost = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let totalReasoning = 0;
  const allMsgs = await client.session.messages({ path: { id: sessionId } });
  if (allMsgs.data) {
    for (const msg of allMsgs.data) {
      if (msg.info.role === "assistant") {
        totalCost += (msg.info as Record<string, unknown>).cost as number || 0;
        const tok = (msg.info as Record<string, unknown>).tokens as Record<string, number> | undefined;
        if (tok) {
          totalInput += tok.input || 0;
          totalOutput += tok.output || 0;
          totalReasoning += tok.reasoning || 0;
        }
      }
    }
  }

  // Get files changed from session diff
  let filesChanged: string[] = [];
  try {
    const diffResponse = await client.session.diff({
      path: { id: sessionId },
    });
    if (diffResponse.data) {
      filesChanged = diffResponse.data.map((d) => d.file);
    }
  } catch {
    // Diffs might not be available
  }

  return {
    completion,
    cost: totalCost,
    tokens: { input: totalInput, output: totalOutput, reasoning: totalReasoning },
    filesChanged,
  };
}

// Extract completion status from message parts
function extractCompletion(parts: Part[]): CompletionResult {
  for (const part of parts) {
    if (
      part.type === "tool" &&
      part.tool === "task_complete" &&
      part.state.status === "completed"
    ) {
      const input = part.state.input as Record<string, unknown>;
      return {
        status: (input.status as CompletionResult["status"]) || "complete",
        reason: input.reason as string | undefined,
      };
    }
  }

  // No task_complete found — session completed without calling it
  return {
    status: "stalled",
    reason: "Session completed without calling task_complete",
  };
}

// Show a toast notification in the OpenCode TUI
export async function showToast(
  client: OpencodeClient,
  message: string,
  variant: "info" | "success" | "warning" | "error",
): Promise<void> {
  try {
    await client.tui.showToast({
      body: { message, variant, duration: 5000 },
    });
  } catch {
    // If toast fails, just log
    const icon =
      variant === "success"
        ? "\u2713"
        : variant === "error"
          ? "\u2717"
          : variant === "warning"
            ? "\u26A0"
            : "\u2139";
    console.log(`[${icon}] ${message}`);
  }
}

// Abort a running session
export async function abortSession(
  client: OpencodeClient,
  sessionId: string,
): Promise<void> {
  await client.session.abort({ path: { id: sessionId } });
}
