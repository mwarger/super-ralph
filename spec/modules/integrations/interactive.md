# Interactive Session

> Handles interactive Reverse mode: subscribes to SSE events, intercepts
> agent questions, and renders them to the user via `@clack/prompts` or
> fulfils them with pre-loaded mock answers.

**Source:** `src/interactive.ts` (examined at commit `ecc95c0` / 2026-02-27)

## Purpose

The interactive session module is a parallel AI execution path used
exclusively by the Reverse phase in interactive mode. Unlike the standard
`runPrompt` in the opencode adapter, this module listens for
`question.asked` events emitted by the AI agent and surfaces them as
terminal prompts (select, multiselect, or text input). It supports
pre-recorded mock answers for automated testing, accumulating a Q&A log
for inspection after the session.

## Triggers

- `runInteractiveSession(...)` — called by `src/reverse.ts:runInteractive`
  when `flags.interactive` is set. (`src/reverse.ts`)
- `loadMockAnswers(filePath)` / `clearMockAnswers()` — called by
  `src/reverse.ts` when `flags.answersFile` is provided or in test teardown.

## Inputs

| Name | Type | Source | Description |
| --- | --- | --- | --- |
| `client` | `OpencodeClient` | `src/reverse.ts` via `createInteractiveClient` | v2 SDK client for the opencode server |
| `sessionId` | `string` | `src/opencode.ts:createSession` | Identifier for the active session |
| `prompt` | `string` | `src/reverse.ts` | Rendered prompt text sent to start the session |
| `model` | `{ providerID, modelID }` | `src/config.ts` | AI model for the session |
| `systemPrompt` | `string \| undefined` | `src/reverse.ts` | Optional system-level instruction |
| `inactivityTimeoutMs` | `number \| undefined` | `src/config.ts` | Milliseconds of silence before aborting |
| Mock answers file | JSON file | file system | Pre-recorded `{ match, answer }` pairs, loaded via `loadMockAnswers` |

## Outputs

| Name | Type | Destination | Description |
| --- | --- | --- | --- |
| Return value | `InteractiveResult` | `src/reverse.ts` | `{ completion, cost, tokens, filesChanged, rawOutput, displayOutput }` |
| Mock answer log | module state | test callers | Accumulated Q&A pairs readable via `getMockAnswerLog()` |

## Side Effects

- Writes real-time text deltas to `process.stdout` as the agent streams
  output.
- Renders terminal select, multiselect, or text prompts to stdout/stdin
  via `@clack/prompts` when a `question.asked` event arrives and no mock
  answers are loaded.
- Calls `session.abort()` (best-effort) when the inactivity timeout elapses.
- Maintains module-level mutable singleton state for mock answers and the
  Q&A log. `clearMockAnswers()` resets both.

## Failure Modes

| Condition | Behavior | Recovery |
| --- | --- | --- |
| Inactivity timeout elapses | `session.abort()` called; rejects with timeout error | Caller (`src/reverse.ts`) catches and marks run failed |
| `session.error` event received | Session terminates; `completion.status` reflects the error | Caller handles via `LoopResult.failed` |
| `session.idle` event received | Session ends normally; `completion.status` is `"complete"` | Caller continues |
| Mock answer has no matching question | Default: first option (index 0) selected | Q&A log records the fallback selection |
| `@clack/prompts` cancel (Ctrl+C) | Prompt returns `undefined`; session continues with no answer sent | [UNKNOWN] — exact behavior on cancel not confirmed |

## Dependencies

| Dependency | Type | Purpose |
| --- | --- | --- |
| `@opencode-ai/sdk/v2` | npm | Typed v2 SDK client and SSE event stream subscription |
| `@clack/prompts` | npm | Terminal UI: `select`, `multiselect`, `text` prompt renderers |
| `src/types.ts` | internal | `CompletionResult` type definition |
| `src/output-parser.ts` | internal | `StreamCapture` for accumulating raw and display output |
| `fs` | node | Reads the mock answers JSON file |

## Open Questions

- The behavior when `@clack/prompts` returns a cancel symbol (user presses
  Ctrl+C mid-question) is not explicitly handled in source. `[UNKNOWN]`
- Whether the mock answer matching is case-sensitive or accent-normalized
  beyond lowercasing is not confirmed from source.
- The module uses module-level singleton state for mock answers. Concurrent
  use of multiple interactive sessions in the same process would share this
  state. Whether concurrent sessions are possible is `[UNKNOWN]`.
