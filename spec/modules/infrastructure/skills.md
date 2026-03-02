# Skills

> Resolves a skill name or file path to its Markdown content; supports
> built-in skills and arbitrary user-supplied paths.

**Source:** `src/skills.ts` (examined at commit `ecc95c0` / 2026-02-27)

## Purpose

The skills module provides the Reverse phase with domain-specific prompt
content (question banks, focus areas) bundled into Markdown files called
"skills". A skill is selected by name (from a fixed built-in set) or by
an explicit file path. The module also exposes the CLI install directory
path, which other modules use to locate bundled assets.

## Triggers

- `loadSkill(skillNameOrPath, cliDir)` — called by `src/reverse.ts` before
  starting a session when `flags.skill` is set. (`src/reverse.ts`)
- `getCliDir()` — called by `src/reverse.ts` and `src/init.ts` to locate
  the CLI installation directory. (`src/reverse.ts`, `src/init.ts`)

## Inputs

| Name | Type | Source | Description |
| --- | --- | --- | --- |
| `skillNameOrPath` | `string \| undefined` | `flags.skill` | A built-in skill name or an absolute/relative file path; `undefined` means no skill |
| `cliDir` | `string` | `getCliDir()` | Directory where the `super-ralph` CLI is installed |

## Outputs

| Name | Type | Destination | Description |
| --- | --- | --- | --- |
| `loadSkill` return | `string \| null` | `src/reverse.ts` | Markdown content of the skill file, or `null` if no skill specified |
| `getCliDir` return | `string` | `src/reverse.ts`, `src/init.ts` | Absolute path to the CLI install directory |

## Side Effects

- Reads the skill file from disk synchronously in `loadSkill`.
- Throws if a named built-in skill file cannot be found in the CLI
  install directory.
- Throws if an explicit file path does not exist on disk.

## Failure Modes

| Condition | Behavior | Recovery |
| --- | --- | --- |
| Named built-in skill file missing from CLI install | Throws `Error` | Propagates to `src/reverse.ts`; run never starts |
| Explicit file path does not exist | Throws `Error` | Propagates to `src/reverse.ts`; run never starts |
| `skillNameOrPath` is `undefined` | Returns `null` immediately; no file access | Caller receives `null` and omits skill content from prompt |

## Dependencies

| Dependency | Type | Purpose |
| --- | --- | --- |
| `fs` | node | Reads skill file contents synchronously |
| `path` | node | Resolves skill file paths relative to CLI install directory |

## Open Questions

- The `BUILT_IN_SKILLS` set is `["feature", "bug", "hotfix", "refactor"]`.
  The content and intended use of each skill file are not documented in
  source beyond the file names.
- `getCliDir()` resolves via `import.meta.url`. The behavior when the
  module is bundled or relocated after install is not confirmed.
