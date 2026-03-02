# Gap Report

> Documents unresolved ambiguities and non-critical gaps identified during the
> reverse-engineering effort.

**Source examined at commit:** `ecc95c0` (2026-02-27)
**Assessment date:** 2026-02-27

## Severity Classifications

| Level | Meaning |
| --- | --- |
| **Critical** | Ambiguity blocks correct use of the module; spec cannot be trusted as a reference without resolution. |
| **Non-critical** | Ambiguity is noted for accuracy but does not prevent a reader from using the spec confidently. |

No critical gaps were identified. All gaps below are non-critical.

---

## Module Gaps

### CLI Entry Point — `src/index.ts`

**GAP-CLI-01:** Boolean flag enumeration is not documented for contributors.
The argument parser (`parseArgs`) hard-codes boolean flag names separately
from value flags. The complete list is derivable only by reading the parser
source; it is not described in comments or help text.
_Severity: non-critical. The current flag set is fully documented in_
_[modules/cli/index.md](modules/cli/index.md)._

**GAP-CLI-02:** Additional command aliases beyond `run` (alias for `forward`)
are not determinable from source.
_Severity: non-critical._

---

### Engine — `src/engine.ts`

**GAP-ENG-01:** The retry counter's scope — whether it resets per bead or
accumulates globally across a run — is not explicitly documented in source.
_Severity: non-critical. Behavioral effect is bounded by the error-handling_
_spec in [behavior/error-handling.md](behavior/error-handling.md)._

**GAP-ENG-02:** The `iteration_delay_ms` sleep is applied unconditionally
including after the final iteration. Whether this is intentional or an
oversight is not determinable from source alone.
_Severity: non-critical._

---

### Config — `src/config.ts`

**GAP-CFG-01:** The merge semantics for array-valued config keys under
shallow merge are not documented in source. It is unconfirmed whether
arrays are replaced wholesale or concatenated.
_Severity: non-critical. Only scalar config keys are currently in use._

**GAP-CFG-02:** The exact mechanism by which `beadTitle` maps to an area in
`resolveModel` is not confirmed from source comments.
_Severity: non-critical._

---

### Events — `src/events.ts`

**GAP-EVT-01:** Listener execution order when multiple listeners are
registered is not documented. FIFO order is assumed based on typical pub/sub
patterns but is not confirmed.
_Severity: non-critical._

**GAP-EVT-02:** Whether future engine behavior could add event variants
without updating the discriminated union type is not determinable from source.
_Severity: non-critical._

---

### Init — `src/init.ts`

**GAP-INI-01:** Whether the opencode plugin file written to
`.opencode/plugins/super-ralph.js` is versioned alongside the CLI or
generated from a template is not confirmed from source.
_Severity: non-critical._

**GAP-INI-02:** The merge strategy applied when step 9 appends to an
`AGENTS.md` file that already contains a super-ralph reference is not
documented in source.
_Severity: non-critical._

---

### Output Parser — `src/output-parser.ts`

**GAP-OUT-01:** Whether the 250,000-character cap applies to the combined
raw-plus-display buffers or to each buffer independently is not confirmed
from source.
_Severity: non-critical. The per-buffer interpretation is documented in the_
_spec as the most observable behavior._

**GAP-OUT-02:** The exact format of the truncation marker prepended on cap
overflow is not documented in source comments.
_Severity: non-critical._

---

### Progress — `src/progress.ts`

**GAP-PRG-01:** The default value of `count` in `readRecentProgress` when
the caller passes `undefined` is a module-level constant whose value is not
documented in source comments.
_Severity: non-critical._

**GAP-PRG-02:** The exact format and units of the `cost` field in a progress
entry are not confirmed. It is presumed to be a USD-denominated float based
on convention.
_Severity: non-critical._

---

### Run State — `src/run-state.ts`

**GAP-RST-01:** The clock source and entropy source for the random suffix in
the run ID format (`"<timestamp>-<random6chars>"`) are not documented in
source.
_Severity: non-critical._

**GAP-RST-02:** Whether `writeIterationTranscript` writes `rawOutput`,
`displayOutput`, or both to the same file or separate files is not
explicitly stated in observable source comments.
_Severity: non-critical._

---

### Run Status — `src/run-status.ts`

**GAP-RNS-01:** The sort order used to determine "latest" when multiple runs
share the same timestamp prefix is not documented.
_Severity: non-critical._

**GAP-RNS-02:** Whether `events.jsonl` line counting reads the entire file
into memory or uses a streaming approach is not confirmed from source.
_Severity: non-critical._

---

### Skills — `src/skills.ts`

**GAP-SKL-01:** The content and intended use of each built-in skill file
(`feature`, `bug`, `hotfix`, `refactor`) are not documented in source beyond
the file names.
_Severity: non-critical. The content is available in the installed skill_
_files and is used only at runtime._

**GAP-SKL-02:** The behavior of `getCliDir()` when the module is bundled or
relocated after install is not confirmed from source.
_Severity: non-critical._

---

### Template — `src/template.ts`

**GAP-TPL-01:** There is no schema or validation of variable names passed to
templates. The set of available variables in each `.hbs` file is defined by
the calling phase module, not by `template.ts`.
_Severity: non-critical._

**GAP-TPL-02:** Whether Handlebars strict mode is enabled — which would
throw on missing variables rather than silently producing empty strings —
is not confirmed from source.
_Severity: non-critical._

---

### Timeout — `src/timeout.ts`

**GAP-TMO-01:** After a timeout fires, the underlying task promise continues
running. There is no cancellation signal. Whether callers are expected to
abort the underlying operation is a caller-level convention not enforced by
`timeout.ts`.
_Severity: non-critical. Documented in_
_[modules/infrastructure/timeout.md](modules/infrastructure/timeout.md) and_
_[behavior/error-handling.md](behavior/error-handling.md)._

---

### Types — `src/types.ts`

**GAP-TYP-01:** The behavioral difference between `CompletionResult.status`
values `"stalled"` and `"timeout"` is not documented within `types.ts`
itself.
_Severity: non-critical. The distinction is described in_
_[behavior/error-handling.md](behavior/error-handling.md)._

---

### bead integration — `src/beads.ts`

**GAP-BRD-01:** The exact log-line filter criteria used by `runBr` before
locating JSON output are not documented in source comments.
_Severity: non-critical._

**GAP-BRD-02:** Whether `closeBead` is intended to be called by phase
modules directly or exclusively by the AI agent via shell is not stated in
source.
_Severity: non-critical._

---

### Interactive session — `src/interactive.ts`

**GAP-INT-01:** ~~The behavior when `@clack/prompts` returns a cancel symbol
(user presses Ctrl+C mid-question) is not explicitly handled in source.~~
_Resolved: cancel is detected via `clack.isCancel()`, which returns `null`
from the render function. This triggers `client.question.reject()` and
returns `InteractiveResult` with `completion.status: "blocked"`.
(`src/interactive.ts:187-196, 353, 381, 399`)_

**GAP-INT-02:** Whether mock answer matching is case-sensitive beyond
lowercasing is not confirmed from source.
_Severity: non-critical._

**GAP-INT-03:** The module uses module-level singleton state for mock
answers. Concurrent use of multiple interactive sessions in the same process
would share this state. Whether concurrent sessions are intended is unknown.
_Severity: non-critical. Single-session use is the only documented usage_
_pattern._

---

### opencode adapter — `src/opencode.ts`

**GAP-OC-01:** The distinction between the v1 and v2 SDK clients used
internally is not documented in source. It is unclear which SSE event types
are exclusive to each version.
_Severity: non-critical._

**GAP-OC-02:** The exact set of SSE event types that contribute to `cost`,
`tokens`, and `filesChanged` aggregation is not enumerated in observable
source comments.
_Severity: non-critical._

---

### Decompose phase — `src/decompose.ts`

**GAP-DCP-01:** Whether `maxIterations = 50` is configurable via
`config.toml` is not confirmed from source.
_Severity: non-critical._

**GAP-DCP-02:** The system prompt defined inline in `decompose.ts` has no
documented versioning or independent test coverage.
_Severity: non-critical._

---

### Forward phase — `src/forward.ts`

**GAP-FWD-01:** The system prompt content injected by the forward phase is
defined inline. Its versioning and independent test coverage are not
documented.
_Severity: non-critical._

**GAP-FWD-02:** The `maxIterations = beadCount * 2` heuristic has no
documented rationale in source.
_Severity: non-critical._

---

### Reverse phase — `src/reverse.ts`

**GAP-RVS-01:** The behavior when the agent creates multiple spec files in
autonomous mode is not documented. The spec assumes the "most recently
modified `.md` file" convention.
_Severity: non-critical._

**GAP-RVS-02:** Whether the global `.super-ralph/session.json` pointer is
updated correctly by interactive mode in all error paths is not confirmed
from source. Interactive mode creates its own `RunTracker` independently
of `runPhaseLoop`.
_Severity: non-critical._

---

## Summary

| Category | Count |
| --- | --- |
| Critical gaps | 0 |
| Non-critical gaps | 36 |
| Modules with at least one open question | 19 |
| Modules with no open questions | 0 |

All 36 non-critical gaps are documentation ambiguities arising from the
clean-room reverse-engineering method. None prevent the spec from being used
as a working reference. Resolving them would require either reading additional
source context or consulting the original authors.
