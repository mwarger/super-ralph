# Live Integration Test Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create an end-to-end integration test that runs the full reverse → decompose → forward pipeline against a tiny fixture project using `anthropic/claude-haiku-3-5`.

**Architecture:** A bash test script (`tests/e2e-live.sh`) copies a fixture project to a temp dir, configures it with Haiku as the model, runs the three phases in sequence (each with `--max-iterations 1`), and validates outputs at each stage. The `e2e-all.sh` runner gains the ability to invoke it when `--live` is passed.

**Tech Stack:** Bash, bun, br CLI, existing E2E test helpers pattern

---

### Task 1: Create the fixture project

**Files:**
- Create: `tests/fixtures/tiny-project/calc.ts`
- Create: `tests/fixtures/tiny-project/README.md`

**Step 1: Create the fixture directory and files**

`tests/fixtures/tiny-project/calc.ts`:
```typescript
// A simple calculator module

export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}

export function divide(a: number, b: number): number {
  if (b === 0) throw new Error("Division by zero");
  return a / b;
}
```

`tests/fixtures/tiny-project/README.md`:
```markdown
# Tiny Calculator
A minimal calculator module for testing.
```

**Step 2: Verify files exist**

Run: `ls tests/fixtures/tiny-project/`
Expected: `calc.ts  README.md`

**Step 3: Commit**

```bash
git add tests/fixtures/tiny-project/
git commit -m "test: add tiny-project fixture for live integration test"
```

---

### Task 2: Create the live integration test script

**Files:**
- Create: `tests/e2e-live.sh`

**Step 1: Write the test script**

The script follows the same patterns as existing E2E tests (pass/fail/skip helpers, trap cleanup, temp dir). Structure:

1. Prerequisites check (bun, br)
2. Setup: copy fixture to temp dir, create `.super-ralph/` config with Haiku model, copy all three `.hbs` templates, init git repo, init beads workspace
3. Phase 1 — Reverse: run `reverse calc.ts --output docs/specs --max-iterations 1 --model anthropic/claude-haiku-3-5`, assert spec file created and non-empty
4. Phase 2 — Decompose: find the spec from phase 1, run `decompose --spec <spec> --epic-title "E2E Live Test" --max-iterations 1 --model anthropic/claude-haiku-3-5`, assert epic exists with child beads
5. Phase 3 — Forward: run `forward --epic <epic-id> --max-iterations 1 --model anthropic/claude-haiku-3-5`, assert iteration ran
6. Summary

Key details:
- Config uses `timeout_minutes = 2`, `strategy = "abort"`, `max_retries = 0`
- Script-level 5-minute timeout via `timeout` command or manual check
- Cleanup removes temp dir and cascading-deletes any created beads
- On failure, prints captured output and temp dir path for debugging

**Step 2: Make executable**

Run: `chmod +x tests/e2e-live.sh`

**Step 3: Verify script is syntactically valid**

Run: `bash -n tests/e2e-live.sh`
Expected: no output (no syntax errors)

**Step 4: Commit**

```bash
git add tests/e2e-live.sh
git commit -m "test: add live integration test for full reverse/decompose/forward pipeline"
```

---

### Task 3: Wire into e2e-all.sh

**Files:**
- Modify: `tests/e2e-all.sh`

**Step 1: Add live integration test to the suite runner**

After the existing four `run_test` calls (line 66), add:

```bash
# Live integration test (only when --live is passed)
if $LIVE; then
  run_test "Live Integration Pipeline" "$SCRIPT_DIR/e2e-live.sh"
fi
```

This means `e2e-all.sh --live` runs all 4 dry-run suites plus the live pipeline test. Without `--live`, the live test is skipped entirely (not even counted).

**Step 2: Run dry-run to verify no regression**

Run: `./tests/e2e-all.sh`
Expected: All 4 dry-run suites pass, no mention of live integration test

**Step 3: Commit**

```bash
git add tests/e2e-all.sh
git commit -m "test: wire live integration test into e2e-all.sh --live"
```

---

### Task 4: Run the live integration test

**Step 1: Run standalone**

Run: `./tests/e2e-live.sh`
Expected: All phases complete, all assertions pass. Approximately 1-3 minutes runtime.

**Step 2: Fix any issues that arise**

Common issues to watch for:
- OpenCode server startup failures (broken symlinks — should be auto-fixed)
- Haiku model not available (API key issues)
- Spec file not created (model output format mismatch)
- Epic/bead creation failures (br CLI issues)
- Timeout (increase if needed, but 2 min per phase should be plenty for Haiku)

**Step 3: Run full suite with --live**

Run: `./tests/e2e-all.sh --live`
Expected: All 5 suites pass (4 dry-run + 1 live integration)

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found in live integration test"
```

---

### Task 5: Final verification and cleanup

**Step 1: Run typecheck**

Run: `bun run typecheck`
Expected: Clean pass (no TS changes, but verify nothing was broken)

**Step 2: Run dry-run suite to confirm no regression**

Run: `./tests/e2e-all.sh`
Expected: All 4 dry-run suites pass

**Step 3: Squash any fix commits if needed, push**
