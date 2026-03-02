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

## Question Tool Protocol

The agent asks questions by calling a `question` tool provided by the
opencode server. The server translates each tool call into a
`question.asked` SSE event. The host answers by calling a REST endpoint,
which delivers the response back to the agent as the tool call result.

### Question Tool Parameter Schema

The agent's `question` tool call produces a `QuestionInfo` object with the
following fields. (`@opencode-ai/sdk/v2`, type `QuestionInfo`)

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `question` | `string` | yes | Full question text presented to the user |
| `header` | `string` | yes | Short label, max 30 characters |
| `options` | `QuestionOption[]` | yes | Available choices |
| `multiple` | `boolean` | no | Allow selecting multiple choices (default `false`) |
| `custom` | `boolean` | no | Allow typing a custom answer (default `true`) |

Each `QuestionOption` contains:

| Field | Type | Description |
| --- | --- | --- |
| `label` | `string` | Label shown to the user, max 200 characters |
| `description` | `string` | Explanation of the choice |

The `custom` field determines whether the user can type a free-text
answer instead of selecting a predefined option. When `custom` is `true`
(or omitted — it defaults to `true`), single-select renders an
additional "Type your own answer" option, and multiselect falls back to
a text prompt if the user selects zero options.
(`src/interactive.ts:285-291`)

### `question.asked` SSE Event

When the agent calls the question tool, the opencode server emits a
`question.asked` SSE event. The event payload is a `QuestionRequest`
with the following fields. (`@opencode-ai/sdk/v2`, type
`EventQuestionAsked`)

| Field | Type | Description |
| --- | --- | --- |
| `type` | `"question.asked"` | Event discriminator |
| `properties.id` | `string` | Unique request identifier used to reply or reject |
| `properties.sessionID` | `string` | Session that originated the question |
| `properties.questions` | `QuestionInfo[]` | Array of questions to present (typically one) |
| `properties.tool.messageID` | `string` | Parent message containing the tool call |
| `properties.tool.callID` | `string` | Identifier of the specific tool invocation |

The host filters events by `properties.sessionID` to handle only
questions from its own session. (`src/interactive.ts:179-180`)

### Answer Return Mechanism

Answers are returned via the v2 SDK's `Question` API, which maps to
REST endpoints on the opencode server.

**Reply** — send answers back to the agent:

```
client.question.reply({
  requestID: string,   // from properties.id of the question.asked event
  answers: string[][], // one string[] per question in the batch
})
```

Each inner `string[]` contains the selected option label(s) or a
single-element array with the custom text. For single-select, this is
`[selectedLabel]`. For multiselect, this is the array of all selected
labels. (`src/interactive.ts:199-202`)

**Reject** — cancel the question (e.g., user pressed Ctrl+C):

```
client.question.reject({
  requestID: string,   // from properties.id of the question.asked event
})
```

After rejection, the session returns with `completion.status: "blocked"`
and `reason: "User cancelled question"`.
(`src/interactive.ts:187-196`)

### Relationship Between `question.asked` and `message.part.updated`

These are distinct event types serving different purposes:

- **`question.asked`** — the dedicated event for question detection.
  The host listens for this event to know when to render a question
  prompt. It carries the full question payload (`QuestionRequest`) and
  is the sole trigger for question handling.
  (`src/interactive.ts:177-202`)

- **`message.part.updated`** — reports tool status changes (pending,
  running, completed, error) for all tool calls, including the question
  tool. The interactive session uses this event to display tool progress
  indicators but does **not** use it to detect questions.
  (`src/interactive.ts:155-176`)

In summary: `question.asked` triggers question rendering;
`message.part.updated` provides status display for all tools.

## Question Rendering

Questions are rendered using `@clack/prompts` based on the `multiple`
and `custom` flags.

**Single select** (`multiple` is `false` or absent): rendered via
`clack.select()`. If `custom !== false`, an extra "Type your own
answer" option is appended. Selecting it opens a `clack.text()` prompt.
(`src/interactive.ts:327-360`)

**Multiselect** (`multiple` is `true`): rendered via
`clack.multiselect()` with `required: false`. If the user selects zero
options and `custom !== false`, a `clack.text()` fallback prompt is
shown. (`src/interactive.ts:362-391`)

**Cancel** (Ctrl+C): detected via `clack.isCancel()`. Returns `null`
from the render function, which triggers `question.reject`.
(`src/interactive.ts:353, 381, 399`)

**Display format**: the prompt message is constructed as
`"${header}: ${question}"` when `header` is present, or just
`"${question}"` otherwise. (`src/interactive.ts:346`)

## Mock Answers (Testing)

When mock answers are loaded via `loadMockAnswers(filePath)`, questions
are answered programmatically instead of via `@clack/prompts`.

### Mock Answer Schema

The JSON file contains an array of `MockAnswer` objects:

| Field | Type | Description |
| --- | --- | --- |
| `match` | `string` | Case-insensitive substring matched against the question text |
| `answer` | `string \| number` | Text answer, option index (0-based), or `"first"` |

Matching is case-insensitive substring search against the combined
`"${header}: ${question}"` text. (`src/interactive.ts:298-299`)

**Answer resolution:**
- `number` — selects option at that index (clamped to options length).
- `"first"` — selects the first option.
- Any other `string` — used as a custom text answer.
- No match — defaults to selecting the first option.
(`src/interactive.ts:304-318`)

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
| `@clack/prompts` cancel (Ctrl+C) | `isCancel()` returns `true`; `question.reject` is called; session returns with `status: "blocked"` | Caller receives `InteractiveResult` with `completion.status: "blocked"` |

## Dependencies

| Dependency | Type | Purpose |
| --- | --- | --- |
| `@opencode-ai/sdk/v2` | npm | Typed v2 SDK client and SSE event stream subscription |
| `@clack/prompts` | npm | Terminal UI: `select`, `multiselect`, `text` prompt renderers |
| `src/types.ts` | internal | `CompletionResult` type definition |
| `src/output-parser.ts` | internal | `StreamCapture` for accumulating raw and display output |
| `fs` | node | Reads the mock answers JSON file |

## Open Questions

- Whether the mock answer matching is case-sensitive or accent-normalized
  beyond lowercasing is not confirmed from source.
- The module uses module-level singleton state for mock answers. Concurrent
  use of multiple interactive sessions in the same process would share this
  state. Whether concurrent sessions are possible is `[UNKNOWN]`.
