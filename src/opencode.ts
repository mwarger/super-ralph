import { createOpencode, createOpencodeClient, type OpencodeClient, type Part } from "@opencode-ai/sdk";
import { createOpencodeClient as createV2Client } from "@opencode-ai/sdk/v2";
import { existsSync, lstatSync, readdirSync, unlinkSync, readlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { CompletionResult } from "./types.js";
import { StreamCapture } from "./output-parser.js";

export type { OpencodeClient };

export interface PromptResult {
  completion: CompletionResult;
  cost: number;
  tokens: { input: number; output: number; reasoning: number };
  filesChanged: string[];
  rawOutput: string;
  displayOutput: string;
}

export interface ServerHandle {
  client: OpencodeClient;
  url: string;
  close: () => void;
}

/**
 * Scan OpenCode's global config directories for broken symlinks.
 * OpenCode crashes on startup if it encounters broken plugin or command symlinks.
 * Returns a list of broken symlinks that were found (and optionally removed).
 */
export function checkBrokenSymlinks(opts: { fix?: boolean } = {}): string[] {
  const configDir = join(homedir(), ".config", "opencode");
  const dirsToCheck = ["plugins", "commands"];
  const broken: string[] = [];

  for (const sub of dirsToCheck) {
    const dir = join(configDir, sub);
    if (!existsSync(dir)) continue;

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        const stat = lstatSync(fullPath);
        if (stat.isSymbolicLink()) {
          // Check if the symlink target exists
          const target = readlinkSync(fullPath);
          if (!existsSync(fullPath)) {
            broken.push(fullPath);
            if (opts.fix) {
              unlinkSync(fullPath);
              console.log(`Removed broken symlink: ${fullPath} -> ${target}`);
            }
          }
        }
      } catch {
        // Can't stat — treat as broken
        broken.push(fullPath);
      }
    }
  }

  return broken;
}

// Start an ephemeral OpenCode server and return a client + handle
export async function startServer(): Promise<ServerHandle> {
  // Preflight: broken symlinks in ~/.config/opencode/ crash the server
  const broken = checkBrokenSymlinks({ fix: true });
  if (broken.length > 0) {
    console.log(`Fixed ${broken.length} broken symlink(s) in ~/.config/opencode/`);
  }

  const { client, server } = await createOpencode({ port: 0 });

  // Verify server is ready
  try {
    await client.session.list();
  } catch (err) {
    server.close();
    throw new Error(`OpenCode server started but not responding: ${(err as Error).message}`);
  }

  return {
    client,
    url: server.url,
    close: () => server.close(),
  };
}

// Connect to an existing OpenCode server (for --attach mode)
export async function connectToServer(url: string): Promise<ServerHandle> {
  const client = createOpencodeClient({ baseUrl: url });

  // Verify server is reachable by listing sessions
  try {
    await client.session.list();
  } catch (err) {
    throw new Error(
      `Cannot connect to OpenCode server at ${url}: ${(err as Error).message}`,
    );
  }

  return {
    client,
    url,
    close: () => {}, // External server — don't close it
  };
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

// Send a prompt and stream output to the terminal in real-time.
// Uses promptAsync() to start non-blocking, then subscribes to SSE events
// to display text deltas as they arrive. Returns when session goes idle.
export async function runPrompt(
  client: OpencodeClient,
  sessionId: string,
  prompt: string,
  model: { providerID: string; modelID: string },
  systemPrompt?: string,
  serverUrl?: string,
  inactivityTimeoutMs: number = 180000,
): Promise<PromptResult> {
  // Use v2 client for promptAsync + event streaming
  const v2 = createV2Client({ baseUrl: serverUrl || "http://127.0.0.1:4096" });

  // Subscribe to events BEFORE sending prompt so we don't miss anything
  const { stream } = await v2.event.subscribe();

  // Start the prompt asynchronously
  await v2.session.promptAsync({
    sessionID: sessionId,
    model,
    parts: [{ type: "text" as const, text: prompt }],
    ...(systemPrompt && { system: systemPrompt }),
  });

  // Stream events until session goes idle, with inactivity watchdog + heartbeat.
  const capture = new StreamCapture();
  const iterator = stream[Symbol.asyncIterator]();
  const pollMs = 10_000;
  const heartbeatMs = 30_000;
  let lastEventAt = Date.now();
  let lastHeartbeatAt = Date.now();

  try {
    while (true) {
      let tickTimer: ReturnType<typeof setTimeout> | undefined;
      const nextResult = await Promise.race([
        iterator.next().then((result) => ({ type: "event" as const, result })),
        new Promise<{ type: "tick" }>((resolve) =>
          { tickTimer = setTimeout(() => resolve({ type: "tick" }), pollMs); }
        ),
      ]);

      if (tickTimer) clearTimeout(tickTimer);

      if (nextResult.type === "tick") {
        const idleForMs = Date.now() - lastEventAt;
        if (idleForMs >= inactivityTimeoutMs) {
          throw new Error(`Session inactive for ${Math.round(inactivityTimeoutMs / 1000)}s`);
        }

        if (Date.now() - lastHeartbeatAt >= heartbeatMs) {
          const idleSec = Math.round(idleForMs / 1000);
          process.stdout.write(`\n[heartbeat] session active, waiting for events (${idleSec}s idle)\n`);
          lastHeartbeatAt = Date.now();
        }
        continue;
      }

      if (nextResult.result.done) break;

      const ev = nextResult.result.value as Record<string, unknown>;
      const eventType = ev.type as string;
      lastEventAt = Date.now();

      if (eventType) {
        capture.addRawLine(JSON.stringify(ev));
      }

      // Debug: log event details
      if (process.env.SUPER_RALPH_DEBUG) {
        if (eventType === "message.part.delta" || eventType === "message.part.updated") {
          const props = ev.properties as Record<string, unknown>;
          process.stderr.write(`[debug] ${eventType}: ${JSON.stringify(props).slice(0, 300)}\n`);
        } else if (eventType === "session.idle" || eventType === "session.error") {
          process.stderr.write(`[debug] ${eventType}: ${JSON.stringify(ev.properties).slice(0, 300)}\n`);
        }
      }

      if (eventType === "message.part.delta") {
        // Real-time text streaming — print deltas as they arrive
        const props = ev.properties as Record<string, unknown>;
        if ((props.sessionID as string) !== sessionId) continue;
        if ((props.field as string) === "text" && props.delta) {
          const text = props.delta as string;
          capture.addDisplayText(text);
          process.stdout.write(text);
        }
      } else if (eventType === "message.part.updated") {
        const props = ev.properties as Record<string, unknown>;
        const part = props.part as Record<string, unknown> | undefined;
        const eventSessionId = part?.sessionID as string || props.sessionID as string;
        if (eventSessionId !== sessionId || !part) continue;

        const partType = part.type as string;
        if (partType === "tool") {
          const toolName = part.tool as string;
          const state = part.state as Record<string, unknown> | undefined;
          const status = state?.status as string | undefined;
          const error = state?.error as string | undefined;

          if (status) {
            const toolText = capture.toolStatusText(toolName, status, error);
            if (toolText) {
              capture.addDisplayText(toolText);
              process.stdout.write(toolText);
            }
          }
        }
      } else if (eventType === "session.idle") {
        const props = ev.properties as Record<string, unknown>;
        if ((props.sessionID as string) === sessionId) {
          capture.addDisplayText("\n");
          process.stdout.write("\n");
          break;
        }
      } else if (eventType === "session.error") {
        const props = ev.properties as Record<string, unknown>;
        if ((props.sessionID as string) === sessionId) {
          const error = props.error as Record<string, unknown> | string | undefined;
          let errorMsg = "unknown error";
          if (typeof error === "string") {
            errorMsg = error;
          } else if (error && typeof error === "object") {
            const name = error.name as string || "Error";
            const data = error.data as Record<string, unknown> | undefined;
            const message = data?.message as string || JSON.stringify(error);
            errorMsg = `${name}: ${message}`;
          }
          const errorText = `\n[session error: ${errorMsg}]\n`;
          capture.addDisplayText(errorText);
          process.stdout.write(errorText);
          break;
        }
      }
    }
  } catch (err) {
    if ((err as Error).message.includes("Session inactive for")) {
      // Best-effort abort to avoid zombie sessions after inactivity timeout.
      try {
        await v2.session.abort({ sessionID: sessionId });
      } catch {
        // ignore abort failures
      }
    }
    throw err;
  } finally {
    // Explicitly close the event stream to avoid lingering SSE connections
    // that can delay process exit by minutes.
    if (typeof stream.return === "function") {
      await stream.return(undefined);
    }
  }

  // Session complete — gather results from v1 client (which has the right types)
  let completion: CompletionResult = {
    status: "stalled",
    reason: "Session completed without calling task_complete",
  };

  const allMsgs = await client.session.messages({ path: { id: sessionId } });
  let totalCost = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let totalReasoning = 0;

  if (allMsgs.data) {
    for (const msg of allMsgs.data) {
      // Check for task_complete
      const found = extractCompletion(msg.parts);
      if (found.status !== "stalled") {
        completion = found;
      }

      // Sum cost/tokens
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
    rawOutput: capture.getRawOutput(),
    displayOutput: capture.getDisplayOutput(),
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
