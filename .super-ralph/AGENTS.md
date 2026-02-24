# Super-Ralph SDLC Framework — Agent Instructions

> Instructions for AI coding agents working in a project that uses the super-ralph framework.
> Read this file at the start of every session and after any context compaction.

## Project Overview

This project uses the **super-ralph SDLC framework** — a unified pipeline for AI-assisted software development that combines:

- **Superpowers** for rigorous intake, design, planning, TDD, and code review
- **OpenCode SDK** for autonomous agent sessions via the three-phase loop engine (`super-ralph forward`, `decompose`, `reverse`)
- **Beads** (via `br` CLI) for dependency-aware task tracking

Every piece of work flows through the same pipeline: relentless intake, three-phase autonomous execution (reverse: input -> spec, decompose: spec -> beads, forward: beads -> code), embedded review, audited completion.

## Project Structure (super-ralph files)

```
.super-ralph/
  AGENTS.md                        # This file
  forward.hbs                      # Prompt template for forward phase (beads -> code)
  decompose.hbs                    # Prompt template for decompose phase (spec -> beads)
  reverse.hbs                      # Prompt template for reverse phase (input -> spec)
  intake-checklist.md              # Growing intake question checklist (learned over time)
  progress.md                      # Cross-iteration learning
tasks/                             # Generated PRDs
```

## Key Principles

1. **Same pipeline, always.** Features, bugs, hotfixes, refactors — all go through the same process. Intake depth varies; the pipeline does not.
2. **No placeholders.** Every implementation must be complete. If something can't be finished in one iteration, document what remains in progress.md and create a follow-up bead.
3. **Search before implementing.** Always search the codebase before writing code. Do not assume something doesn't exist or isn't already implemented.
4. **Self-review before committing.** Check every acceptance criterion. Run all quality gates. No exceptions.
5. **Leave notes for future iterations.** Append learnings, patterns, and gotchas to `.super-ralph/progress.md` before signaling completion.
6. **Scope discipline.** Do only what the current bead asks. If you discover adjacent work, document it in progress.md. Do not fix unrelated bugs unless they block your task.

## Completion Signaling

When working inside a super-ralph loop iteration, signal completion via the `task_complete` tool:

- `{ status: "complete" }` — this iteration's work is done. The orchestrator loops back for the next iteration.
- `{ status: "phase_done" }` — the entire phase is finished. The orchestrator exits the loop.

For forward phase: if no ready beads remain, the orchestrator exits automatically.

## Quality Gates

These commands must pass before any commit. If a command doesn't apply to the current project yet (e.g., no tests exist), note it in progress.md but don't fail the bead.

```bash
# Typecheck
bun run typecheck
```

Additional quality gates (lint, test, build) will be added as the project grows. If a gate doesn't apply yet, note it in progress.md but don't fail the bead.

## Bead Types You May Encounter

- **US-XXX:** Implementation beads. Build the thing described in acceptance criteria.
- **REVIEW-XXX:** Phase review beads. Review all work from the preceding phase against the design document. Run quality gates. Check for drift, placeholders, and scope creep. Document findings. Create corrective beads if needed.
- **BUGSCAN-XXX:** Fresh-eyes bug review beads. Re-read all code from the preceding phase looking for bugs, errors, silly mistakes. Fix what you find. Document everything.
- **AUDIT-XXX:** Post-completion audit beads. Deep review of the entire implementation. Test coverage verification. Learning extraction.
- **LEARN-001:** Learning extraction bead. Summarize learnings, update `.super-ralph/intake-checklist.md`, index sessions if CASS is available.

## Commit Messages

Use the format: `feat: {{taskId}} - {{taskTitle}}`

For corrective beads created during review: `fix: {{taskId}} - {{taskTitle}}`

## Files to Re-read After Context Compaction

If your context window is compacted mid-iteration, re-read these files:
1. This file (`.super-ralph/AGENTS.md`)
2. The project's root `AGENTS.md` and `README.md` (if they exist)
3. `.super-ralph/progress.md` (for recent learnings)
4. The PRD referenced in the epic's `--external-ref`
