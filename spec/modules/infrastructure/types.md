# Types

> Central type definitions: all shared interfaces and type aliases used
> across the codebase.

**Source:** `src/types.ts` (examined at commit `ecc95c0` / 2026-02-27)

## Purpose

The types module is a pure declaration file with no runtime logic. It
establishes the shared data model that all other modules depend on, ensuring
a single source of truth for the shapes of beads, configuration, iteration
results, phase flags, and error strategies. No functions, classes, or
constants are exported.

## Triggers

_Not applicable for this module._ The module contains no executable code and
is never "invoked". It is imported by other modules at compile time.

## Inputs

_Not applicable for this module._ Type declarations have no runtime inputs.

## Outputs

_Not applicable for this module._ Type declarations produce no runtime
outputs.

## Side Effects

None. The module contains only TypeScript type and interface declarations.

## Failure Modes

_Not applicable for this module._ No runtime behavior exists to fail.

## Dependencies

| Dependency | Type | Purpose |
| --- | --- | --- |
| _(none)_ | — | This module has no imports |

## Open Questions

- The `CompletionResult.status` union (`"complete" | "phase_done" | "blocked"
  | "failed" | "stalled" | "timeout" | "error"`) includes `"stalled"` and
  `"timeout"` as distinct values. The behavioral difference between the two
  is not documented within the types file itself.
