# config

> Loads and merges `.super-ralph/config.toml` with hard-coded defaults, and
> resolves the AI model to use for a given bead.

**Source:** `src/config.ts` (examined at commit `ecc95c0` / 2026-02-27)

## Purpose

The config module provides the single entry point for reading project-level
configuration. It performs a deep merge of user-supplied TOML values over
built-in defaults, so callers always receive a fully populated `LoopConfig`
regardless of what the user has specified. It also centralises model
selection logic, applying a three-tier priority: CLI override, bead area
label, default model.

## Triggers

- `loadConfig(projectDir)` — called during `setup` by every phase module
  (via the Engine). (`src/engine.ts`)
- `resolveModel(beadLabels, beadTitle, config, cliOverride?)` — called each
  iteration by phase modules to pick the AI model for the current bead.
  (`src/forward.ts`, `src/reverse.ts`, `src/decompose.ts`)

## Inputs

| Name | Type | Source | Description |
| --- | --- | --- | --- |
| `projectDir` | `string` | Engine / phase caller | Absolute path to the project root; config file is at `<projectDir>/.super-ralph/config.toml` |
| `beadLabels` | `string[]` | `src/beads.ts` | Labels on the current bead, searched for `area:*` prefixes |
| `beadTitle` | `string` | `src/beads.ts` | Title of the bead (used as a fallback label source) |
| `config` | `LoopConfig` | `loadConfig` return value | Full merged config, used for `modelsAreas` and `models.default` |
| `cliOverride` | `string \| undefined` | CLI `--model` flag | Optional `"provider/model"` string that takes precedence over all other sources |

## Outputs

| Name | Type | Destination | Description |
| --- | --- | --- | --- |
| `loadConfig` return | `LoopConfig` | Engine / phase callers | Fully merged configuration object |
| `resolveModel` return | `{ providerID: string; modelID: string }` | phase callers | Resolved AI model for the current bead |

## Side Effects

- Reads `.super-ralph/config.toml` from disk synchronously.
- If the file is missing, returns the hard-coded defaults silently (no error).
- Throws if a model string (CLI override or config value) is not in
  `"provider/model"` format.

## Failure Modes

| Condition | Behavior | Recovery |
| --- | --- | --- |
| config file missing | Returns defaults; no error thrown | Caller proceeds with defaults |
| TOML parse error | `@iarna/toml` throws a parse error; propagates to caller | Phase setup fails; run never starts |
| Model string not in `"provider/model"` format | Throws `Error` with descriptive message | Phase setup fails |
| No `area:*` label found on bead | Falls back to `config.models.default` | Model resolution always succeeds if default is set |

## Dependencies

| Dependency | Type | Purpose |
| --- | --- | --- |
| `@iarna/toml` | npm | Parses `.super-ralph/config.toml` |
| `src/types.ts` | internal | `LoopConfig` type definition |
| `fs` | node | Reads the TOML file synchronously |
| `path` | node | Resolves the config file path from `projectDir` |

## Open Questions

- The deep merge strategy (user values over defaults) is applied recursively.
  The exact merge semantics for array-valued config keys are not documented
  in source.
- `beadTitle` is accepted as a label source in `resolveModel` but the exact
  mechanism by which it maps to an area is not confirmed from source
  comments.
