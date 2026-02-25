# Live Integration Test Design

## Problem

The existing E2E tests validate CLI argument parsing, dry-run output, and error handling — but never actually call a model. There is no test that verifies the full pipeline (reverse → decompose → forward) works end-to-end with real model calls and real OpenCode sessions.

## Solution

A single integration test script (`tests/e2e-live.sh`) that runs the complete SDLC pipeline against a tiny fixture project using `anthropic/claude-haiku-3-5` (fast, cheap). Each phase chains into the next: reverse produces a spec, decompose breaks it into beads, forward implements the first bead.

## Fixture

`tests/fixtures/tiny-project/` — a ~20-line calculator module (`calc.ts`) and a one-liner `README.md`. Intentionally trivial so Haiku can handle it in seconds.

The test copies this fixture into a temp directory so agent file changes don't pollute the repo.

## Pipeline

### Phase 1: Reverse
- **Input**: `calc.ts`
- **Output**: `docs/specs/*.md`
- **Assert**: spec file exists, non-empty, mentions "calculator" or "calc"

### Phase 2: Decompose
- **Input**: spec file from phase 1
- **Output**: beads epic with child beads
- **Assert**: epic created, at least 1 child bead exists

### Phase 3: Forward
- **Input**: epic from phase 2
- **Output**: agent works on first bead
- **Assert**: iteration ran, got a non-error completion status

## Config

```toml
[engine]
timeout_minutes = 2
iteration_delay_ms = 0
strategy = "abort"
max_retries = 0

[models]
default = "anthropic/claude-haiku-3-5"

[reverse]
output_dir = "docs/specs"

[decompose]
include_review = false
include_bugscan = false
include_audit = false
```

All phases also get `--model anthropic/claude-haiku-3-5` and `--max-iterations 1` as CLI flags.

## Constraints

- 2-minute timeout per iteration (config level)
- 5-minute total test timeout (script-level watchdog)
- `--max-iterations 1` on all phases
- `strategy = "abort"` and `max_retries = 0` (fail fast)
- Cleanup removes temp dir and created beads on exit

## Integration

- `e2e-all.sh --live` runs `e2e-live.sh` after the dry-run suites
- `e2e-live.sh` is also runnable standalone
- Existing per-phase `--live` blocks in individual test files stay as-is

## Failure handling

- If any phase fails, test prints captured output and exits non-zero
- Temp dir path is printed on failure for manual inspection
- Each phase gets its own assertion block with pass/fail reporting
