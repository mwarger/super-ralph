# Progress

Cross-iteration learnings, patterns, and gotchas.

---

## 2026-02-24: REVIEW-001 — SDK loop migration completeness

**Finding:** 2 stale `ralph-tui` references found in active files:
- `.super-ralph/intake-checklist.md:3` — "ralph-tui PRD skills" -> "super-ralph PRD skills"
- `templates/intake-checklist.md:3` — same fix

**Clean areas (0 stale references):**
- commands/, skills/, src/, templates/, .super-ralph/, .opencode/, README.md — no `ralph-tui`, no `.ralph-tui/`, no `bd ` (old Go CLI)
- No `<promise>COMPLETE</promise>` in any active file

**Expected references in docs/plans/ and docs/reference/:**
- Old design docs (2026-02-21, 2026-02-22) contain `ralph-tui` references — these are historical and describe the migration. Left as-is.
- `<promise>COMPLETE</promise>` appears in old design docs describing the former completion signal. Left as-is.

**Quality gates:** `bun run typecheck` passes.

## 2026-02-24: Epic bd-3qe — All-in-One OpenCode UX

Completed all 7 tasks. Key patterns:
- `cli.path` in config.toml allows the execution loop to be launched from inside the agent
- All `npx super-ralph` references replaced with `bun run <cli_path>`
- Doctor now prints actionable fix commands for every failing check
- Init skill validates bun + br prerequisites before proceeding
## Iteration 1 — iter-1: reverse iteration 1 (initial draft) [ERROR]
- Model: anthropic/claude-sonnet-4-6
- Duration: 0s
- Notes: Failed to create session

## Iteration 2 — iter-2: reverse iteration 2 (initial draft) [ERROR]
- Model: anthropic/claude-sonnet-4-6
- Duration: 0s
- Notes: Failed to create session

## Iteration 3 — iter-3: reverse iteration 3 (initial draft) [ERROR]
- Model: anthropic/claude-sonnet-4-6
- Duration: 0s
- Notes: Failed to create session

