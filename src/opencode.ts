import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk";
import type { CompletionResult } from "./types.js";

export type { OpencodeClient };

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

// Send a prompt to a session (fire and forget via async endpoint)
export async function sendPrompt(
  client: OpencodeClient,
  sessionId: string,
  prompt: string,
  model: { providerID: string; modelID: string },
): Promise<void> {
  await client.session.promptAsync({
    path: { id: sessionId },
    body: {
      model,
      parts: [{ type: "text" as const, text: prompt }],
    },
  });
}

// Wait for a session to complete, watching for task_complete tool call
export async function waitForCompletion(
  client: OpencodeClient,
  sessionId: string,
  timeoutMs: number,
): Promise<CompletionResult> {
  return new Promise<CompletionResult>((resolve) => {
    let resolved = false;

    const safeResolve = (result: CompletionResult) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      clearInterval(pollInterval);
      resolve(result);
    };

    // Timeout handler
    const timer = setTimeout(async () => {
      try {
        await client.session.abort({ path: { id: sessionId } });
      } catch {
        // Ignore abort errors
      }
      safeResolve({
        status: "timeout",
        reason: `Session timed out after ${timeoutMs / 1000}s`,
      });
    }, timeoutMs);

    // Poll for completion by checking session status and messages
    const pollInterval = setInterval(async () => {
      try {
        // Check session status
        const statusResponse = await client.session.status();
        if (statusResponse.data) {
          const sessionStatus = statusResponse.data[sessionId];
          if (sessionStatus && sessionStatus.type === "idle") {
            // Session is idle — check the session messages for a task_complete tool call
            const messagesResponse = await client.session.messages({
              path: { id: sessionId },
            });

            if (messagesResponse.data) {
              for (const msg of messagesResponse.data) {
                for (const part of msg.parts) {
                  if (
                    part.type === "tool" &&
                    part.tool === "task_complete" &&
                    part.state.status === "completed"
                  ) {
                    const input = part.state.input as Record<string, unknown>;
                    safeResolve({
                      status:
                        (input.status as CompletionResult["status"]) ||
                        "complete",
                      reason: input.reason as string | undefined,
                    });
                    return;
                  }
                }
              }
            }

            // No task_complete found — session stalled
            safeResolve({
              status: "stalled",
              reason: "Session went idle without calling task_complete",
            });
          }
          // If busy or retry, keep polling
        }
      } catch (err) {
        // Network errors during polling — just keep trying
        console.error(`Poll error: ${(err as Error).message}`);
      }
    }, 3000); // Poll every 3 seconds
  });
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

// Get session summary (cost, tokens, diffs) after completion
export async function getSessionSummary(
  client: OpencodeClient,
  sessionId: string,
): Promise<{
  cost: number;
  tokens: { input: number; output: number; reasoning: number };
  filesChanged: string[];
}> {
  // Get session messages to sum up costs
  const messagesResponse = await client.session.messages({
    path: { id: sessionId },
  });

  let totalCost = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let totalReasoning = 0;

  if (messagesResponse.data) {
    for (const msg of messagesResponse.data) {
      if (msg.info.role === "assistant") {
        totalCost += msg.info.cost;
        totalInput += msg.info.tokens.input;
        totalOutput += msg.info.tokens.output;
        totalReasoning += msg.info.tokens.reasoning;
      }
    }
  }

  // Get diffs for files changed
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
    cost: totalCost,
    tokens: {
      input: totalInput,
      output: totalOutput,
      reasoning: totalReasoning,
    },
    filesChanged,
  };
}
