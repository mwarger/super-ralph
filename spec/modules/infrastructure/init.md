# Init

> Scaffolds a new project: creates `.super-ralph/`, copies templates, writes
> `config.toml`, installs the opencode plugin, and runs `br init`.

**Source:** `src/init.ts` (examined at commit `ecc95c0` / 2026-02-27)

## Purpose

The init module performs one-time project setup for `super-ralph`. It is
idempotent: running it more than once will skip files that already exist
rather than overwriting them. The module wires together the three external
dependencies a project needs: the `.super-ralph/` configuration directory,
the opencode plugin that provides the `task_complete` tool, and the `.beads/`
workspace.

## Triggers

- `runInit(projectDir)` — called by `src/index.ts` when the user runs
  `super-ralph init`. (`src/index.ts:cmdInit`)

## Inputs

| Name | Type | Source | Description |
| --- | --- | --- | --- |
| `projectDir` | `string` | CLI caller | Absolute path to the project root where the project is scaffolded |

## Outputs

_Not applicable for this module._ `runInit` returns `Promise<void>` and
communicates results only through console output and side effects.

## Side Effects

All side effects are idempotent (skip if the target already exists):

1. Creates `.super-ralph/` directory.
2. Copies `AGENTS.md`, `forward.hbs`, `decompose.hbs`, `reverse.hbs`,
   and `intake-checklist.md` from the CLI install directory into
   `.super-ralph/` (skips each file if already present).
3. Creates `.super-ralph/config.toml` from a template, substituting the
   actual `src/index.ts` path of the CLI install.
4. Creates `.opencode/plugins/super-ralph.js` (the `task_complete` tool
   plugin for opencode).
5. Creates `.opencode/package.json` with `@opencode-ai/plugin` dependency.
6. Spawns `bun install --silent` in `.opencode/` to install plugin
   dependencies.
7. Creates `tasks/` directory.
8. Spawns `br init` to initialise the `.beads/` workspace.
9. Creates or updates the root `AGENTS.md` to include a reference to
   `.super-ralph/AGENTS.md`.

## Failure Modes

| Condition | Behavior | Recovery |
| --- | --- | --- |
| Template file missing from CLI install | Warning logged to console; step skipped | Remaining steps continue |
| Plugin source file missing | Warning logged; plugin file not created | opencode plugin will not be available until `init` is re-run after repair |
| `bun install` fails | Error caught and logged as a warning | Remaining steps continue; plugin may not function |
| `br init` fails | Error caught and logged as a warning | Remaining steps continue; `.beads/` workspace may be incomplete |
| File already exists (any step) | Step is skipped silently | idempotent; no data loss |

## Dependencies

| Dependency | Type | Purpose |
| --- | --- | --- |
| `src/skills.ts` | internal | `getCliDir()` — locates the CLI install directory for template source paths |
| `fs` | node | Creates directories, copies files, writes `config.toml` and plugin files |
| `path` | node | Resolves source and destination paths |
| `Bun.spawn` | system | Runs `bun install` and `br init` as subprocesses |

## Open Questions

- The plugin file written to `.opencode/plugins/super-ralph.js` is copied
  from the CLI install. Whether this file is versioned alongside the CLI
  or generated from a template is not confirmed from source.
- Step 9 (updating root `AGENTS.md`) creates or appends content. The exact
  merge strategy when the file already contains a super-ralph reference is
  not documented in source.
