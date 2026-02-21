# Super-Ralph SDLC Framework — Agent Instructions

> Instructions for AI coding agents working in a project that uses the super-ralph framework.
> Read this file at the start of every session and after any context compaction.

## Project Overview

This project uses the **super-ralph SDLC framework** — a unified pipeline for AI-assisted software development that combines:

- **Superpowers** for rigorous intake, design, planning, TDD, and code review
- **Ralph TUI** for autonomous execution loops
- **Beads** (with BV) for dependency-aware task tracking

Every piece of work flows through the same pipeline: relentless intake, autonomous execution, embedded review, audited completion.

## Project Structure (super-ralph files)

```
.ralph-tui/
  config.toml                      # Ralph TUI configuration
  progress.md                      # Cross-iteration learning (auto-managed by Ralph)
.super-ralph/
  AGENTS.md                        # This file
  prompt.hbs                       # Custom prompt template for Ralph TUI iterations
  intake-checklist.md              # Growing intake question checklist (learned over time)
tasks/                             # Generated PRDs
```

## Key Principles

1. **Same pipeline, always.** Features, bugs, hotfixes, refactors — all go through the same process. Intake depth varies; the pipeline does not.
2. **No placeholders.** Every implementation must be complete. If something can't be finished in one iteration, document what remains in progress.md and create a follow-up bead.
3. **Search before implementing.** Always search the codebase before writing code. Do not assume something doesn't exist or isn't already implemented.
4. **Self-review before committing.** Check every acceptance criterion. Run all quality gates. No exceptions.
5. **Leave notes for future iterations.** Append learnings, patterns, and gotchas to `.ralph-tui/progress.md` before signaling completion.
6. **Scope discipline.** Do only what the current bead asks. If you discover adjacent work, document it in progress.md. Do not fix unrelated bugs unless they block your task.

## Quality Gates

These commands must pass before any commit. If a command doesn't apply to the current project yet (e.g., no tests exist), note it in progress.md but don't fail the bead.

```bash
# Typecheck (if applicable)
# npm run typecheck / tsc --noEmit / pyright / etc.

# Lint (if applicable)
# npm run lint / ruff check / etc.

# Test (if applicable)
# npm test / pytest / etc.

# Build (if applicable)
# npm run build / cargo build / etc.
```

Quality gate commands should be defined in the PRD's Quality Gates section and are project-specific. The above are placeholders — replace them with actual commands once the project's tech stack is established.

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
3. `.ralph-tui/progress.md` (for recent learnings)
4. The PRD referenced in the epic's `--external-ref`
