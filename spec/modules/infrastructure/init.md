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
2. Copies template files into `.super-ralph/` (skips each file if already
   present). See [Template Source Paths](#template-source-paths) for where
   templates are read from, and [Template File Contents](#template-file-contents)
   for what each file contains.
3. Creates `.super-ralph/config.toml` from a template, substituting the
   `cli.path` value. See [cli.path Resolution](#clipath-resolution).
4. Creates `.opencode/plugins/super-ralph.js` (the `task_complete` tool
   plugin for opencode).
5. Creates `.opencode/package.json` with `@opencode-ai/plugin` dependency.
6. Spawns `bun install --silent` in `.opencode/` to install plugin
   dependencies.
7. Creates `tasks/` directory.
8. Spawns `br init` to initialise the `.beads/` workspace.
9. Creates or updates the root `AGENTS.md`. See
   [Root AGENTS.md Update](#root-agentsmd-update).

## Template Source Paths

All template files are **bundled in the CLI package** under the `templates/`
directory at the repository root. At runtime, the CLI locates them via
`getCliDir()` (from `src/skills.ts`), which resolves the CLI install root
using `import.meta.url`:

```ts
// src/skills.ts
export function getCliDir(): string {
  const url = new URL(".", import.meta.url);
  return resolve(url.pathname, "..");  // up from src/ to repo root
}
```

The template source directory is therefore `join(getCliDir(), "templates")`.
The following files are copied:

| Source (in `templates/`) | Destination (in `.super-ralph/`) |
| --- | --- |
| `agents.md` | `AGENTS.md` |
| `forward.hbs` | `forward.hbs` |
| `decompose.hbs` | `decompose.hbs` |
| `reverse.hbs` | `reverse.hbs` |
| `intake-checklist.md` | `intake-checklist.md` |
| `super-ralph-config.toml` | `config.toml` (with `cli.path` substitution) |

Note: `agents.md` is renamed to `AGENTS.md` on copy (uppercase) to follow
the convention for agent instruction files.

## Template File Contents

### `.super-ralph/AGENTS.md`

This is the file that sub-agents read to understand the super-ralph
framework. It is a quick-reference listing of all CLI commands, quality
gates, and key configuration file paths. Content:

```markdown
# Super-Ralph SDLC Framework

CLI commands:
  super-ralph init                              Scaffold .super-ralph/ in current project
  super-ralph reverse [inputs...] [--skill ...] Input -> spec (interactive or autonomous)
  super-ralph decompose --spec <path>           Spec -> beads
  super-ralph forward --epic <ID>               Beads -> code
  super-ralph status --epic <ID>                Show progress
  super-ralph doctor                            Preflight checks
  super-ralph help                              Show all options

Quality gates:
  bun run typecheck

Config: .super-ralph/config.toml
Templates: .super-ralph/forward.hbs, decompose.hbs, reverse.hbs
Progress log: .super-ralph/progress.md
```

**Purpose:** Gives any agent operating in the project enough context to
discover and invoke super-ralph commands, locate configuration, and
understand the available phases. It intentionally does not duplicate the
full spec — it is a signpost, not documentation.

### `.super-ralph/intake-checklist.md`

A living document of "learned questions" — things the team has discovered
should always be asked during project intake. It is read by the reverse
phase (Phase C of the intake protocol) so the agent can ask domain-specific
questions that aren't covered by the standard business and technical
interrogation.

The file ships with seed questions organised into categories:

- **Data & Storage** — soft/hard deletes, audit logging, retention, GDPR
- **Security & Access** — rate limiting, authorization boundaries, secrets
- **Operations** — monitoring, rollback strategy, feature flags
- **User Experience** — empty states, loading states, error messages
- **Integration** — webhooks, background jobs, API rate limits, offline

The `LEARN-001` bead at the end of each epic appends new entries to this
file, so it grows over the life of the project. Questions are not
all-or-nothing — the reverse skill uses judgment about which are relevant
to the current piece of work.

### Handlebars Templates

`forward.hbs`, `decompose.hbs`, and `reverse.hbs` are prompt templates
injected into agent sessions by the respective phase commands. Their
contents are specified in the corresponding phase module specs:

- `forward.hbs` — see `spec/modules/phases/forward.md`
- `decompose.hbs` — see `spec/modules/phases/decompose.md`
- `reverse.hbs` — see `spec/modules/phases/reverse.md`

## cli.path Resolution

The `[cli]` section of `config.toml` contains a `path` key that must
resolve to the CLI's entry point. Init determines this as follows:

1. Call `getCliDir()` (which uses `import.meta.url` to locate the
   directory containing the running `src/init.ts` file, then resolves
   `..` to get the repository root).
2. Join with `"src/index.ts"` to get the absolute path to the CLI
   entry point: `join(getCliDir(), "src", "index.ts")`.
3. In the config template, replace the placeholder `path = ""` with
   `path = "<resolved absolute path>"` using a regex substitution
   (`/^path\s*=\s*""/m`).

The resulting value is an absolute filesystem path, e.g.:

```toml
[cli]
path = "/home/user/.local/share/super-ralph/src/index.ts"
```

This path is used by phase commands to spawn the CLI for sub-operations
(e.g., `br create` calls during decompose).

## Root AGENTS.md Update

Step 9 ensures the project's root `AGENTS.md` points agents toward
`.super-ralph/AGENTS.md`. The logic handles three cases:

| Condition | Action |
| --- | --- |
| Root `AGENTS.md` does not exist | Create it with heading and reference line |
| Root `AGENTS.md` exists but does not mention `.super-ralph/AGENTS.md` | Append the reference line |
| Root `AGENTS.md` already contains `.super-ralph/AGENTS.md` | Skip (no-op) |

**When creating** a new root `AGENTS.md`, the content is:

```markdown
# Agent Instructions

Also read .super-ralph/AGENTS.md for SDLC framework instructions.
```

**When appending** to an existing file, only the reference line is added
(preceded by a newline):

```
\nAlso read .super-ralph/AGENTS.md for SDLC framework instructions.\n
```

The detection check is a simple substring match: if the file content
includes the string `.super-ralph/AGENTS.md` anywhere, the step is
skipped. This means any prior reference — whether added by init or
manually by the user — satisfies the check.

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
  from the CLI install at `.opencode/plugins/super-ralph.js`. Whether this
  file is versioned alongside the CLI or generated from a template is not
  confirmed from source.
