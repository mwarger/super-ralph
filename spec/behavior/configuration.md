# Configuration

> Configuration sources, precedence order, defaults, merge semantics,
> and validation behavior.

**Source examined at commit:** `ecc95c0` (2026-02-27)

## Overview

super-ralph uses a single configuration file per project. All runtime
knobs are declared in `.super-ralph/config.toml`. A hard-coded
`DEFAULT_CONFIG` constant in `src/config.ts:6` provides values for every
key; user-supplied values are merged over the defaults on load. CLI flags
provide a separate, higher-priority override channel for a small number of
settings.

---

## Configuration Sources

There are three sources of configuration, applied in the following
precedence order (highest wins):

1. **CLI flags** — passed by the operator at invocation time.
2. **`.super-ralph/config.toml`** — the project configuration file.
3. **Hard-coded defaults** — the `DEFAULT_CONFIG` constant in
   `src/config.ts:6`.

### Source 1: CLI Flags

CLI flags are parsed in `src/index.ts` and passed to phase modules as
`PhaseFlags` (or a phase-specific extension: `ForwardFlags`,
`DecomposeFlags`, `ReverseFlags`). They are **not** merged into
`LoopConfig`; they travel as a separate parameter (`flags`) through the
call stack.

The only CLI flag that overrides a configuration-equivalent value is:

| Flag | Overrides | Scope |
| --- | --- | --- |
| `--model <provider/model>` | `models.default` / `models.areas` | All iterations in the current run |
| `--max-iterations <n>` | Phase-computed `maxIterations` from `setup()` | Current run only |

Both overrides are applied in `src/engine.ts` at the start of
`runPhaseLoop`, before any iteration begins.

### Source 2: `.super-ralph/config.toml`

**Path:** `<project-root>/.super-ralph/config.toml`
**Format:** TOML, parsed by `@iarna/toml` (`src/config.ts:3`).
**Loaded:** Once per `runPhaseLoop` call, synchronously, before
`callbacks.setup()` is invoked (`src/engine.ts:44`).

The file is read by `loadConfig(projectDir)` in `src/config.ts:34`. If
the file does not exist, `DEFAULT_CONFIG` is returned unchanged and no
error is raised (`src/config.ts:36–38`).

### Source 3: Hard-Coded Defaults

Defined as `DEFAULT_CONFIG` in `src/config.ts:6`. Every key always has a
default value. The full default table is:

| TOML key | Default value |
| --- | --- |
| `engine.timeout_minutes` | `30` |
| `engine.inactivity_timeout_seconds` | `180` |
| `engine.iteration_delay_ms` | `2000` |
| `engine.strategy` | `"retry"` |
| `engine.max_retries` | `3` |
| `opencode.attach_url` | `"http://localhost:4096"` |
| `cli.path` | `""` (empty string) |
| `models.default` | `"anthropic/claude-sonnet-4-6"` |
| `models.areas` | `{}` (empty map) |
| `reverse.output_dir` | `"docs/specs"` |
| `decompose.include_review` | `true` |
| `decompose.include_bugscan` | `true` |
| `decompose.include_audit` | `true` |

---

## Merge Semantics

`loadConfig` performs a section-level shallow merge: for each top-level
TOML section (`engine`, `opencode`, `cli`, `models`, `reverse`,
`decompose`), the user-supplied key-value pairs are spread over the
corresponding default object (`src/config.ts:56–85`). Keys present in the
user file overwrite the default; keys absent from the user file retain
their default.

The `models` section has special handling:

1. The nested `models.areas` sub-object is extracted separately and stored
   in `LoopConfig.modelsAreas` (`src/config.ts:45`).
2. All other entries under `[models]` must be flat string values; the
   `areas` key itself is excluded (`src/config.ts:48–53`).
3. `modelsAreas` receives no defaults; if absent from the user file it is
   an empty map (`{}`).

Array-valued keys are not present in `LoopConfig`. Merge behavior for
hypothetical future array keys is not defined. [UNKNOWN]

---

## Model Resolution

Model selection is a three-tier lookup performed once per iteration by
`resolveModel` in `src/config.ts:88`. It consults, in order:

1. **CLI override** (`--model` flag) — if present, used for all iterations.
2. **Area label** — if the bead carries a label matching `area:<name>`,
   the value at `config.modelsAreas[name]` is used. If the area name
   exists in the label but has no mapping in `modelsAreas`, the lookup
   falls through to the default (`src/config.ts:107–110`).
3. **Default model** — `config.models.default`.

The resolved string must be in `"provider/model"` format (containing
exactly one `/`). If it is not, `resolveModel` throws an `Error` with a
descriptive message (`src/config.ts:118–121`). This causes the phase setup
to fail before any iteration begins.

---

## Validation Behavior

`loadConfig` itself performs no schema validation beyond TOML parsing.
Validation occurs at point-of-use:

| Condition | Where validated | Behavior on failure |
| --- | --- | --- |
| TOML syntax error | `@iarna/toml` parse in `loadConfig` | Parse error thrown; run never starts |
| Model string not in `"provider/model"` format | `resolveModel` on each iteration | `Error` thrown; phase setup fails |
| Unknown keys in TOML | Not validated | Silently ignored (spread merge) |
| Wrong type for a key (e.g., string where number expected) | Not validated at load | May propagate as a runtime type error |
| Missing config file | `existsSync` check in `loadConfig` | Returns defaults silently |

---

## Environment Variables

One environment variable is used by super-ralph:

| Variable | Module | Effect |
| --- | --- | --- |
| `SUPER_RALPH_DEBUG` | `src/opencode.ts` | If set to any non-empty value, enables verbose SSE debug logging to `stderr` |

All AI provider API keys (e.g., `ANTHROPIC_API_KEY`) are consumed by the
opencode server process, not by super-ralph itself.

---

## Configuration Scope and Lifetime

Configuration is loaded once at the start of each `runPhaseLoop` call. The
resulting `LoopConfig` object is passed by value to all callbacks and
adapters for the duration of that run. Changes to `config.toml` during a
run are not observed until the next invocation.

The config object is not shared between runs. Each `runPhaseLoop` call
produces its own `LoopConfig` snapshot.

---

## Module References

| Module | Role |
| --- | --- |
| [`spec/modules/infrastructure/config.md`](../modules/infrastructure/config.md) | Full module spec: inputs, outputs, side effects, failure modes |
| [`spec/modules/infrastructure/types.md`](../modules/infrastructure/types.md) | Defines `LoopConfig`, `ErrorStrategy`, `PhaseFlags` |
| [`spec/modules/engine/engine.md`](../modules/engine/engine.md) | Calls `loadConfig`; passes result to all callbacks |
| [`spec/modules/cli/index.md`](../modules/cli/index.md) | Parses CLI flags; applies `--model` and `--max-iterations` overrides |

## Open Questions

- ~~Whether `opencode.url` is ever used in practice~~ **RESOLVED**: Renamed
  to `opencode.attach_url`. In ephemeral mode (default), the SDK spawns the
  server on a random port via `createOpencode({ port: 0 })` and discovers the
  URL dynamically — the config value is not used. `opencode.attach_url` is
  the default URL used by `--attach` mode when no explicit URL is provided.
- The `cli.path` key purpose is not fully documented in source comments.
  [UNKNOWN]
- Merge behavior for array-valued config keys is undefined in source. [UNKNOWN]
