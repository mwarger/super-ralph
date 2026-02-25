import {
  createOpencodeClient,
  type OpencodeClient,
  type Part,
  type QuestionInfo,
} from "@opencode-ai/sdk/v2";
import * as clack from "@clack/prompts";
import type { CompletionResult } from "./types.js";

export type { OpencodeClient as InteractiveClient };

export interface InteractiveResult {
  completion: CompletionResult;
  cost: number;
  tokens: { input: number; output: number; reasoning: number };
  filesChanged: string[];
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
): Promise<InteractiveResult> {
  // Start the session non-blocking
  await client.session.promptAsync({
    sessionID: sessionId,
    model,
    parts: [{ type: "text" as const, text: prompt }],
    ...(systemPrompt && { system: systemPrompt }),
  });

  // Subscribe to SSE events
  const { stream } = await client.event.subscribe();

  // Process events until session goes idle
  for await (const event of stream) {
    const ev = event as Record<string, unknown>;
    const eventType = ev.type as string;

    if (eventType === "question.asked") {
      const props = ev.properties as Record<string, unknown>;
      const eventSessionId = props.sessionID as string;
      if (eventSessionId !== sessionId) continue;

      const requestId = props.id as string;
      const questions = props.questions as QuestionInfo[];

      const answers = await handleQuestions(questions);

      if (answers === null) {
        // User cancelled — reject the question
        await client.question.reject({ requestID: requestId });
        return buildBlockedResult(client, sessionId, "User cancelled question");
      }

      await client.question.reply({
        requestID: requestId,
        answers,
      });
    } else if (eventType === "session.idle") {
      const props = ev.properties as Record<string, unknown>;
      const eventSessionId = props.sessionID as string;
      if (eventSessionId !== sessionId) continue;
      break;
    }
  }

  // Session finished — gather results
  return gatherResults(client, sessionId);
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
  const allowCustom = q.custom !== false;
  const CUSTOM_SENTINEL = "__custom_input__";

  if (q.multiple) {
    return renderMultiSelect(q, allowCustom, CUSTOM_SENTINEL);
  }
  return renderSingleSelect(q, allowCustom, CUSTOM_SENTINEL);
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
): Promise<InteractiveResult> {
  const totals = await gatherCostAndTokens(client, sessionId);
  return {
    completion: { status: "blocked", reason },
    ...totals,
    filesChanged: [],
  };
}

/**
 * After the event loop ends, scan all session messages for completion status
 * and gather cost/tokens/files changed.
 */
async function gatherResults(
  client: OpencodeClient,
  sessionId: string,
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
