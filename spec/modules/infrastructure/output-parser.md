# Output Parser

> Accumulates raw SSE event lines and rendered display text during an
> opencode session; caps total size at 250,000 characters per stream.

**Source:** `src/output-parser.ts` (examined at commit `ecc95c0` / 2026-02-27)

## Purpose

The output parser provides a stateful buffer that the opencode adapter and
interactive session module use to capture two parallel streams of session
output: the raw JSON event log and the human-readable display text. It
enforces a size cap on each stream and formats tool-call status lines for
display. The captured output is later written to per-iteration transcript
files by the Engine via `RunTracker`.

## Triggers

- Instantiated by `src/opencode.ts:runPrompt` and
  `src/interactive.ts:runInteractiveSession` at the start of each session.
- `addRawLine(line)` / `addDisplayText(text)` — called as SSE events arrive.
- `getRawOutput()` / `getDisplayOutput()` — called at session end to hand
  off accumulated content to the Engine.

## Inputs

| Name | Type | Source | Description |
| --- | --- | --- | --- |
| `line` | `string` | SSE event stream | A single raw JSON event line appended to the raw buffer |
| `text` | `string` | SSE event stream | Rendered text chunk appended to the display buffer |
| `toolName` | `string` | `toolStatusText` caller | Name of the tool being reported |
| `status` | `string` | `toolStatusText` caller | Status token for the tool call (e.g., `"done"`, `"error"`) |
| `error` | `string \| undefined` | `toolStatusText` caller | Optional error message appended to the status line |

## Outputs

| Name | Type | Destination | Description |
| --- | --- | --- | --- |
| `getRawOutput()` | `string` | `src/opencode.ts` / `src/interactive.ts` | Full accumulated raw event log (truncated if over limit) |
| `getDisplayOutput()` | `string` | `src/opencode.ts` / `src/interactive.ts` | Full accumulated display text (truncated if over limit) |
| `toolStatusText(...)` | `string` | caller | Formatted status line, e.g., `"[tool: bash] done\n"` |

## Side Effects

None. `StreamCapture` is a pure in-memory state container with no I/O.

## Failure Modes

| Condition | Behavior | Recovery |
| --- | --- | --- |
| Accumulated content exceeds 250,000 characters | A truncation marker is prepended to the buffer; further additions are silently dropped | Caller receives truncated output; no exception thrown |

## Dependencies

| Dependency | Type | Purpose |
| --- | --- | --- |
| _(none)_ | — | No external or internal imports |

## Open Questions

- It is not confirmed whether the 250,000-character cap applies to the
  combined raw + display buffers or to each independently.
- The exact format of the truncation marker prepended on cap overflow is
  not documented in source comments.
