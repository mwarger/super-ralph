import {
  createOpencodeClient,
  type OpencodeClient,
  type Part,
  type QuestionInfo,
} from "@opencode-ai/sdk/v2";
import * as clack from "@clack/prompts";
import { readFileSync } from "fs";
import type { CompletionResult } from "./types.js";
import { StreamCapture } from "./output-parser.js";

export type { OpencodeClient as InteractiveClient };

export interface InteractiveResult {
  completion: CompletionResult;
  cost: number;
  tokens: { input: number; output: number; reasoning: number };
  filesChanged: string[];
  rawOutput: string;
  displayOutput: string;
}

/**
 * Pre-recorded answer for mock/test sessions.
 * Matched by substring against the question text.
 * If `answer` is a string, it's used as a custom text answer.
 * If `answer` is a number, it selects the Nth option (0-indexed).
 * If `answer` is "first", it selects the first option.
 */
export interface MockAnswer {
  match: string;           // substring to match against question text
  answer: string | number; // text answer, or option index
}

// Module-level state for mock answers
let mockAnswers: MockAnswer[] | null = null;
let mockAnswerLog: Array<{ question: string; answer: string[] }> = [];

/**
 * Load mock answers from a JSON file. Once loaded, all questions will be
 * answered from this file instead of prompting the user via clack.
 * Unmatched questions default to selecting the first option.
 */
export function loadMockAnswers(filePath: string): void {
  const content = readFileSync(filePath, "utf-8");
  mockAnswers = JSON.parse(content) as MockAnswer[];
  mockAnswerLog = [];
  console.log(`Loaded ${mockAnswers.length} mock answers from ${filePath}`);
}

/**
 * Get the log of questions asked and answers given during a mock session.
 */
export function getMockAnswerLog(): Array<{ question: string; answer: string[] }> {
  return mockAnswerLog;
}

/**
 * Create a v2 OpenCode client from a server URL.
 * The v2 client is required for interactive sessions because the question API
 * (question.reply, question.reject) is only available in the v2 SDK.
 */
export function createInteractiveClient(baseUrl: string): OpencodeClient {
  return createOpencodeClient({ baseUrl });
}

/**
 * Run an interactive session that handles question.asked events via @clack/prompts.
 *
 * Uses promptAsync() to start the session non-blocking, then subscribes to SSE
 * events. When a question.asked event arrives for our session, it renders the
 * question with clack and sends the answer back. When session.idle fires, we
 * break out and gather the results.
 */
export async function runInteractiveSession(
  client: OpencodeClient,
  sessionId: string,
  prompt: string,
  model: { providerID: string; modelID: string },
  systemPrompt?: string,
  inactivityTimeoutMs: number = 180000,
): Promise<InteractiveResult> {
  // Subscribe to SSE events BEFORE sending prompt so we don't miss anything
  const { stream } = await client.event.subscribe();

  // Start the session non-blocking
  await client.session.promptAsync({
    sessionID: sessionId,
    model,
    parts: [{ type: "text" as const, text: prompt }],
    ...(systemPrompt && { system: systemPrompt }),
  });

  // Process events until session goes idle, with inactivity watchdog + heartbeat.
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
        new Promise<{ type: "tick" }>((resolve) => {
          tickTimer = setTimeout(() => resolve({ type: "tick" }), pollMs);
        }),
      ]);

      if (tickTimer) clearTimeout(tickTimer);

      if (nextResult.type === "tick") {
        const idleForMs = Date.now() - lastEventAt;
        if (idleForMs >= inactivityTimeoutMs) {
          throw new Error(`Interactive session inactive for ${Math.round(inactivityTimeoutMs / 1000)}s`);
        }
        if (Date.now() - lastHeartbeatAt >= heartbeatMs) {
          const idleSec = Math.round(idleForMs / 1000);
          process.stdout.write(`\n[heartbeat] interactive session active, waiting for events (${idleSec}s idle)\n`);
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

      if (eventType === "message.part.delta") {
        // Stream text output in real-time
        const props = ev.properties as Record<string, unknown>;
        if ((props.sessionID as string) !== sessionId) continue;
        if ((props.field as string) === "text" && props.delta) {
          const text = props.delta as string;
          capture.addDisplayText(text);
          process.stdout.write(text);
        }
      } else if (eventType === "message.part.updated") {
        // Show tool call status
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
      } else if (eventType === "question.asked") {
        const props = ev.properties as Record<string, unknown>;
        const eventSessionId = props.sessionID as string;
        if (eventSessionId !== sessionId) continue;

        const requestId = props.id as string;
        const questions = props.questions as QuestionInfo[];

        const answers = await handleQuestions(questions);

        if (answers === null) {
          // User cancelled — reject the question
          await client.question.reject({ requestID: requestId });
          return buildBlockedResult(
            client,
            sessionId,
            "User cancelled question",
            capture.getRawOutput(),
            capture.getDisplayOutput(),
          );
        }

        await client.question.reply({
          requestID: requestId,
          answers,
        });
      } else if (eventType === "session.error") {
        const props = ev.properties as Record<string, unknown>;
        if ((props.sessionID as string) !== sessionId) continue;
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
      } else if (eventType === "session.idle") {
        const props = ev.properties as Record<string, unknown>;
        const eventSessionId = props.sessionID as string;
        if (eventSessionId !== sessionId) continue;
        capture.addDisplayText("\n");
        process.stdout.write("\n");
        break;
      }
    }
  } catch (err) {
    if ((err as Error).message.includes("Interactive session inactive for")) {
      // Best-effort abort to avoid zombie sessions after inactivity timeout.
      try {
        await client.session.abort({ sessionID: sessionId });
      } catch {
        // ignore abort failures
      }
    }
    throw err;
  } finally {
    if (typeof stream.return === "function") {
      await stream.return(undefined);
    }
  }

  // Session finished — gather results
  return gatherResults(client, sessionId, capture.getRawOutput(), capture.getDisplayOutput());
}

/**
 * Handle a batch of questions from a question.asked event.
 * Returns an array of answers (one per question), or null if the user cancelled.
 *
 * Each answer is string[] (QuestionAnswer type in the SDK).
 */
async function handleQuestions(
  questions: QuestionInfo[],
): Promise<string[][] | null> {
  const allAnswers: string[][] = [];

  for (const q of questions) {
    const answer = await renderQuestion(q);
    if (answer === null) return null;
    allAnswers.push(answer);
  }

  return allAnswers;
}

/**
 * Render a single question using @clack/prompts.
 *
 * - Single select (multiple !== true): uses clack.select() with options.
 *   If custom input is allowed (q.custom !== false), adds a "Type your own answer" option.
 * - Multi select (multiple === true): uses clack.multiselect().
 *   If custom input is allowed and nothing selected, falls back to text input.
 *
 * Returns string[] of selected answers, or null if the user pressed Ctrl+C.
 */
async function renderQuestion(q: QuestionInfo): Promise<string[] | null> {
  // If mock answers are loaded, use them instead of clack
  if (mockAnswers) {
    return renderMockAnswer(q);
  }

  const allowCustom = q.custom !== false;
  const CUSTOM_SENTINEL = "__custom_input__";

  if (q.multiple) {
    return renderMultiSelect(q, allowCustom, CUSTOM_SENTINEL);
  }
  return renderSingleSelect(q, allowCustom, CUSTOM_SENTINEL);
}

function renderMockAnswer(q: QuestionInfo): string[] {
  const questionText = q.header ? `${q.header}: ${q.question}` : q.question;

  // Find a matching mock answer
  const match = mockAnswers!.find(m =>
    questionText.toLowerCase().includes(m.match.toLowerCase())
  );

  let answer: string[];

  if (match) {
    if (typeof match.answer === "number") {
      // Select by option index
      const idx = Math.min(match.answer, q.options.length - 1);
      answer = [q.options[idx]?.label || q.options[0]?.label || "yes"];
    } else if (match.answer === "first") {
      answer = [q.options[0]?.label || "yes"];
    } else {
      // Custom text answer
      answer = [match.answer];
    }
  } else {
    // Default: select first option
    answer = [q.options[0]?.label || "yes"];
  }

  console.log(`[mock] Q: ${questionText.slice(0, 120)}`);
  console.log(`[mock] A: ${answer.join(", ")}`);

  mockAnswerLog.push({ question: questionText, answer });
  return answer;
}

async function renderSingleSelect(
  q: QuestionInfo,
  allowCustom: boolean,
  customSentinel: string,
): Promise<string[] | null> {
  const options = q.options.map((opt) => ({
    value: opt.label,
    label: opt.label,
    hint: opt.description,
  }));

  if (allowCustom) {
    options.push({
      value: customSentinel,
      label: "Type your own answer",
      hint: "",
    });
  }

  const message = q.header ? `${q.header}: ${q.question}` : q.question;

  const result = await clack.select({
    message,
    options,
  });

  if (clack.isCancel(result)) return null;

  if (result === customSentinel) {
    return getCustomInput(q.question);
  }

  return [result as string];
}

async function renderMultiSelect(
  q: QuestionInfo,
  allowCustom: boolean,
  _customSentinel: string,
): Promise<string[] | null> {
  const options = q.options.map((opt) => ({
    value: opt.label,
    label: opt.label,
    hint: opt.description,
  }));

  const message = q.header ? `${q.header}: ${q.question}` : q.question;

  const result = await clack.multiselect({
    message,
    options,
    required: false,
  });

  if (clack.isCancel(result)) return null;

  const selected = result as string[];

  // If nothing was selected and custom is allowed, offer text input
  if (selected.length === 0 && allowCustom) {
    return getCustomInput(q.question);
  }

  return selected;
}

async function getCustomInput(question: string): Promise<string[] | null> {
  const customAnswer = await clack.text({
    message: question,
    placeholder: "Type your answer...",
  });

  if (clack.isCancel(customAnswer)) return null;

  return [customAnswer as string];
}

/**
 * Build a result for when the user cancels/blocks the session.
 * Gathers whatever cost/token info is available so far.
 */
async function buildBlockedResult(
  client: OpencodeClient,
  sessionId: string,
  reason: string,
  rawOutput: string,
  displayOutput: string,
): Promise<InteractiveResult> {
  const totals = await gatherCostAndTokens(client, sessionId);
  return {
    completion: { status: "blocked", reason },
    ...totals,
    filesChanged: [],
    rawOutput,
    displayOutput,
  };
}

/**
 * After the event loop ends, scan all session messages for completion status
 * and gather cost/tokens/files changed.
 */
async function gatherResults(
  client: OpencodeClient,
  sessionId: string,
  rawOutput: string,
  displayOutput: string,
): Promise<InteractiveResult> {
  // Scan messages for task_complete
  let completion: CompletionResult = {
    status: "stalled",
    reason: "Session completed without calling task_complete",
  };

  const allMsgs = await client.session.messages({ sessionID: sessionId });
  if (allMsgs.data) {
    for (const msg of allMsgs.data) {
      const found = extractCompletion(msg.parts);
      if (found.status !== "stalled") {
        completion = found;
        break;
      }
    }
  }

  const totals = await gatherCostAndTokens(client, sessionId);

  // Get files changed
  let filesChanged: string[] = [];
  try {
    const diffResponse = await client.session.diff({ sessionID: sessionId });
    if (diffResponse.data) {
      filesChanged = diffResponse.data.map((d) => d.file);
    }
  } catch {
    // Diffs might not be available
  }

  return {
    completion,
    ...totals,
    filesChanged,
    rawOutput,
    displayOutput,
  };
}

/**
 * Sum cost/tokens across all assistant messages in the session.
 */
async function gatherCostAndTokens(
  client: OpencodeClient,
  sessionId: string,
): Promise<{
  cost: number;
  tokens: { input: number; output: number; reasoning: number };
}> {
  let totalCost = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let totalReasoning = 0;

  const allMsgs = await client.session.messages({ sessionID: sessionId });
  if (allMsgs.data) {
    for (const msg of allMsgs.data) {
      const info = msg.info as Record<string, unknown>;
      if (info.role === "assistant") {
        totalCost += (info.cost as number) || 0;
        const tok = info.tokens as Record<string, number> | undefined;
        if (tok) {
          totalInput += tok.input || 0;
          totalOutput += tok.output || 0;
          totalReasoning += tok.reasoning || 0;
        }
      }
    }
  }

  return {
    cost: totalCost,
    tokens: { input: totalInput, output: totalOutput, reasoning: totalReasoning },
  };
}

/**
 * Extract completion status from message parts.
 * Same logic as extractCompletion in opencode.ts.
 */
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

  return {
    status: "stalled",
    reason: "Session completed without calling task_complete",
  };
}
