# Template

> Loads and renders Handlebars `.hbs` prompt templates stored in
> `.super-ralph/`.

**Source:** `src/template.ts` (examined at commit `ecc95c0` / 2026-02-27)

## Purpose

The template module abstracts Handlebars compilation and rendering behind
two small functions. Phase modules call `loadTemplate` once at setup time
to compile a template, then call `renderPrompt` each iteration with the
current variable context. This separation allows the compiled template
delegate to be reused across iterations without re-reading the file.

## Triggers

- `loadTemplate(projectDir, filename?)` — called during phase `setup`
  callbacks. (`src/forward.ts`, `src/decompose.ts`, `src/reverse.ts`)
- `renderPrompt(template, vars)` — called each iteration in the phase
  `nextIteration` callback.

## Inputs

| Name | Type | Source | Description |
| --- | --- | --- | --- |
| `projectDir` | `string` | phase caller | Absolute path to the project root |
| `filename` | `string \| undefined` | phase caller | Template filename within `.super-ralph/`; defaults to `"forward.hbs"` |
| `template` | `HandlebarsTemplateDelegate` | `loadTemplate` return | Compiled Handlebars template |
| `vars` | `Record<string, unknown>` | phase caller | Variable bindings injected into the template at render time |

## Outputs

| Name | Type | Destination | Description |
| --- | --- | --- | --- |
| `loadTemplate` return | `HandlebarsTemplateDelegate` | phase `nextIteration` | Compiled Handlebars template ready for rendering |
| `renderPrompt` return | `string` | Engine (as prompt text) | Fully rendered prompt string |

## Side Effects

- Reads the `.hbs` file from disk synchronously in `loadTemplate`.
- Throws if the template file does not exist, with a message suggesting
  `super-ralph init` to restore missing templates.

## Failure Modes

| Condition | Behavior | Recovery |
| --- | --- | --- |
| Template file missing | Throws `Error` with a hint to run `super-ralph init` | Phase setup fails; run never starts |
| Handlebars syntax error in template | Handlebars throws a compile-time error | Phase setup fails |
| Missing variable at render time | Handlebars renders the missing reference as an empty string (default Handlebars behavior) | Prompt proceeds with a gap; no exception thrown |

## Dependencies

| Dependency | Type | Purpose |
| --- | --- | --- |
| `handlebars` | npm | Template compilation and rendering |
| `src/types.ts` | internal | No direct type imports; types used implicitly via `LoopConfig` context |
| `fs` | node | Reads `.hbs` file synchronously |
| `path` | node | Resolves template path from `projectDir` |

## Open Questions

- The set of variables available in each template (e.g., `forward.hbs`,
  `decompose.hbs`, `reverse.hbs`) is defined by the phase modules, not
  by `template.ts`. There is no schema or validation of variable names.
- Whether Handlebars strict mode is enabled (which would throw on missing
  variables rather than silently producing empty strings) is not confirmed
  from source.
