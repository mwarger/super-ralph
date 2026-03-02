# opencode Adapter

> Manages the opencode AI coding agent server lifecycle, session creation,
> real-time SSE prompt streaming, and result extraction.

**Source:** `src/opencode.ts` (examined at commit `ecc95c0` / 2026-02-27)

## Purpose

The opencode adapter is the primary AI execution layer. It abstracts the
mechanics of starting or attaching to an opencode server, creating named
sessions, streaming prompt responses over SSE, and extracting structured
results from the event stream. The Engine calls this module for every
prompt iteration; phase modules never call it directly.

## Triggers

- `startServer()` — called by the Engine when `flags.attach` is not set.
  (`src/engine.ts`)
- `connectToServer(url)` — called by the Engine when `flags.attach` is set.
  (`src/engine.ts`)
- `runPrompt(...)` — called by the Engine once per iteration.
  (`src/engine.ts`)
- `checkBrokenSymlinks(opts?)` — called at server start and by
  `src/index.ts:cmdDoctor`.

## Inputs

| Name | Type | Source | Description |
| --- | --- | --- | --- |
| `url` | `string` | Engine / `attach` flag | Base URL of an existing opencode server |
| `client` | `OpencodeClient` | `startServer` / `connectToServer` | Typed SDK client for the opencode API |
| `sessionId` | `string` | `createSession` return value | Identifier for the active session |
| `prompt` | `string` | Engine (from phase callbacks) | The rendered prompt text to send |
| `model` | `{ providerID, modelID }` | `src/config.ts` | AI model to use for the session |
| `systemPrompt` | `string \| undefined` | phase callbacks | Optional system-level instruction prepended to the session |
| `serverUrl` | `string \| undefined` | `startServer` | Base URL used to stream SSE events directly |
| `inactivityTimeoutMs` | `number \| undefined` | Engine (from config) | Milliseconds of silence before aborting the session |

## Outputs

| Name | Type | Destination | Description |
| --- | --- | --- | --- |
| `ServerHandle` | object | Engine | `{ client, url, close }` — handle to the running server |
| `PromptResult` | object | Engine | `{ completion, cost, tokens, filesChanged, rawOutput, displayOutput }` |
| `brokenPaths` | `string[]` | `cmdDoctor` | List of broken symlink paths found in `~/.config/opencode/` |

## Side Effects

- Spawns an opencode server process via the `@opencode-ai/sdk` `createOpencode`
  factory (ephemeral, OS-assigned port). (`src/opencode.ts:startServer`)
- Establishes SSE network connections to stream session events.
- Writes real-time text deltas to `process.stdout` as they arrive.
- Writes debug event JSON to `process.stderr` when the `SUPER_RALPH_DEBUG`
  environment variable is set.
- Reads and optionally removes broken symlink files under
  `~/.config/opencode/plugins/` and `~/.config/opencode/commands/`.
- Calls `session.abort()` (best-effort) when the inactivity timeout elapses.

## Failure Modes

| Condition | Behavior | Recovery |
| --- | --- | --- |
| Server fails to start or becomes unreachable | Exception thrown from `startServer`; propagates to Engine | Engine's `finally` block calls `close()` and `finalize` |
| Inactivity timeout elapses | `session.abort()` called; rejects with `"Session inactive for Ns"` | Engine applies error strategy (retry/skip/abort) |
| `task_complete` tool call never arrives | `runPrompt` resolves with `status: "error"` after SSE stream closes | Engine applies error strategy |
| Broken symlinks detected | Listed in return value of `checkBrokenSymlinks`; removed if `fix: true` | Server startup calls `checkBrokenSymlinks({ fix: true })` automatically |

## Dependencies

| Dependency | Type | Purpose |
| --- | --- | --- |
| `@opencode-ai/sdk` | npm | v1 SDK client: `createOpencode`, session and model APIs |
| `@opencode-ai/sdk/v2` | npm | v2 SDK client: typed event stream for SSE subscription |
| `src/types.ts` | internal | `CompletionResult` type definition |
| `src/output-parser.ts` | internal | `StreamCapture` for accumulating raw and display output |
| `fs` | node | Reads/removes symlink files in `~/.config/opencode/` |
| `path` | node | Resolves plugin and command directory paths |
| `os` | node | Resolves `~/.config/opencode/` to an absolute path |

## Open Questions

- The distinction between the v1 and v2 SDK clients is not documented in
  source. It is unclear which event types are exclusive to each version.
- The exact set of SSE event types that contribute to `cost`, `tokens`, and
  `filesChanged` aggregation is not enumerated in observable source comments.
