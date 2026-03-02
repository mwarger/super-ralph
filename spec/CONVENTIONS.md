# Spec Conventions

This document defines the rules, terminology, and templates that all documents
under `spec/` must follow.

## Clean-Room Rules

All spec documents are produced by reverse engineering — reading observable
artifacts (source code, runtime logs, CLI output) rather than relying on
undocumented design intent. The following rules enforce that constraint.

1. **Cite observable evidence.** Every behavioral claim must reference a source
   location (file and line range) or a reproducible runtime observation.
2. **Never infer intent.** Describe what the code does, not why the author
   chose to do it that way.
3. **Distinguish levels of confidence.** Use the confidence labels defined
   below on any claim that is not directly confirmed by code.
4. **Do not copy source code verbatim** beyond short illustrative snippets
   (five lines or fewer). Paraphrase logic in prose or pseudocode.
5. **Flag gaps explicitly.** Use the Open Questions section rather than
   speculating in the body of the document.
6. **Version your observations.** Record the commit SHA or date range of the
   source examined at the top of each document.

## Confidence Labels

Place a label inline after any claim whose certainty is less than direct
code confirmation. Labels use the format `[CONFIDENCE: <level>]`.

| Label | Meaning |
| --- | --- |
| `[CONFIRMED]` | Directly verified in source code (cite file:line). |
| `[INFERRED]` | Logically follows from confirmed facts but not directly observed. |
| `[ASSUMED]` | Reasonable assumption; plausible but unverified. |
| `[UNKNOWN]` | Not determinable from available evidence; add to Open Questions. |

Omit the label only when the entire statement is `[CONFIRMED]` and the
citation is present in the same sentence.

## Terminology

| Term | Definition |
| --- | --- |
| **bead** | A discrete unit of work tracked by the `br` CLI. |
| **epic** | A parent bead that groups related child beads. |
| **iteration** | One pass of the Ralph loop: select, prompt, execute, evaluate. |
| **phase** | A top-level command (`reverse`, `decompose`, `forward`). |
| **run** | A single invocation of a phase command, identified by a `runId`. |
| **session** | The opencode SDK conversation context for one iteration. |
| **skill** | A named question set or prompt variant used during reverse. |
| **template** | A Handlebars `.hbs` file that generates an agent prompt. |

When introducing a term not in this table, define it in the module doc and
propose adding it here via a PR comment.

## Required Section Template

Every module spec must include the following sections in this order. Omit a
section only if it genuinely does not apply, and note the omission with
`_Not applicable for this module._`

---

```markdown
# <Module Name>

> One-sentence description of the module's role in the system.

**Source:** `src/<filename>.ts` (examined at commit `<sha>` / `<date>`)

## Purpose

Two to four sentences. What problem does this module solve and where does it
sit in the overall architecture?

## Triggers

What causes this module to execute? List entry points: exported functions,
CLI commands, or events that invoke this module. Cite source locations.

## Inputs

| Name | Type | Source | Description |
|---|---|---|---|
| `<name>` | `<type>` | `<caller / env / file>` | What it represents |

## Outputs

| Name | Type | Destination | Description |
|---|---|---|---|
| `<name>` | `<type>` | `<caller / file / stdout>` | What it represents |

## Side Effects

List observable effects outside the return value: file writes, environment
mutations, process exits, network calls, spawned child processes.

## Failure Modes

| Condition | Behavior | Recovery |
|---|---|---|
| `<condition>` | `<what happens>` | `<how it is handled>` |

## Dependencies

| Dependency | Type | Purpose |
|---|---|---|
| `<name>` | internal / npm / system | Why this module uses it |

## Open Questions

- List anything that could not be determined from available evidence.
```

---

## Markdown Style

- Use ATX-style headings (`#`, `##`, `###`). Never use Setext underlines.
- Wrap prose at 80 characters. Code blocks and tables are exempt.
- Use fenced code blocks with an explicit language tag.
- Prefer ordered lists for sequential steps; unordered lists for
  unordered items.
- Do not use bare URLs. Wrap links in Markdown link syntax.
- One blank line before and after every block element (heading, list,
  table, code block).
- Do not use trailing spaces for line breaks. Use a blank line or HTML
  `<br>` only when necessary.

## File Naming

- Use lowercase kebab-case: `run-state.md`, `output-parser.md`.
- Match the source filename where possible (drop the `.ts` extension).
- The two meta-documents (`README.md`, `CONVENTIONS.md`) are the only
  permitted uppercase filenames in `spec/`.
