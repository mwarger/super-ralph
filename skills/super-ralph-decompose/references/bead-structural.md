# Bead 5: Add Structural Beads (REVIEW, BUGSCAN, AUDIT)

Use this as the description for bead 5. Replace template variables at stamp time.

```markdown
## Objective
Add quality-gate beads to the work bead graph: REVIEW beads for
phase-boundary code review, a BUGSCAN bead for dedicated bug hunting,
and an AUDIT bead for final verification.

This runs after all decompose review passes — the work bead graph is
finalized. You are adding quality gates to a finished plan.

## Instructions

### Step 1: Understand the Current Bead Graph
  br list --parent {{workEpicId}}

Identify: phase count, last impl bead per phase, existing REVIEW gates.

### Step 2: Create Phase-Boundary REVIEW Beads
For each phase, create (or verify existing) REVIEW bead:

  br create --parent {{workEpicId}} \
    --title "REVIEW: Phase <N> code review" \
    --type task --priority <N × 10 + 5> --area "review" \
    --description "## Objective
  Fresh-eyes review of all Phase <N> code.
  ## Context
  Phase <N> implemented: <list what it covers — embed from spec>
  Beads implemented: <list titles and IDs>
  ## Review Instructions
  For each bead's implementation: read every file, trace execution,
  verify acceptance criteria. Look for: off-by-one errors, missing
  error handling, race conditions, incorrect data format assumptions,
  missing null checks, logic errors, resource leaks, security issues.
  Run phase tests. For each issue, create fix-up bead with specific
  bug description, expected behavior, fix instructions, verification.
  Wire: br dep add <fix_id> {{thisBeadId}}
  ## Completion
  br close <id> --reason 'Phase <N> review: M files, K issues, J fixes'"

Wire: REVIEW-N depends on all Phase N beads.
Phase N+1 first beads depend on REVIEW-N.

### Step 3: Create BUGSCAN Bead
  br create --parent {{workEpicId}} \
    --title "BUGSCAN: Full codebase bug scan" \
    --type task --priority 90 --area "review" \
    --description "## Objective
  Randomly explore code. Deeply investigate. Trace execution flows.
  Find bugs with completely fresh eyes. NOT reviewing against a spec.
  ## Instructions
  Overview project structure. Pick files at random. Trace every path:
  valid/invalid/empty/concurrent/dependency-failure inputs. Look for:
  off-by-one, missing error handling, race conditions, type assumptions,
  missing validation, resource leaks, security vulnerabilities, silent
  logic errors, inconsistencies between code paths.
  For each bug: create bead with file/function/line, bug description,
  expected behavior, fix instructions, verification.
  Wire: br dep add <bug_id> {{thisBeadId}}
        br dep add {{auditBeadId}} <bug_id>
  ## Completion
  br close <id> --reason 'BUGSCAN: N files, M bugs, M fix beads'"

Wire: BUGSCAN depends on last phase's REVIEW.

### Step 4: Create AUDIT Bead
  br create --parent {{workEpicId}} \
    --title "AUDIT: Final verification and integration test" \
    --type task --priority 95 --area "review" \
    --description "## Objective
  Final verification — last bead. After this, work epic is done.
  ## Instructions
  1. Run FULL test suite. Fix failures in-place. Re-run.
  2. Integration: start app, exercise primary workflows, verify outputs,
     test error/edge case path end-to-end.
  3. Completeness: list all beads, verify each closed bead's acceptance
     criteria by examining actual code/tests.
  4. Code quality: remove TODOs/FIXMEs, commented-out code, console.logs,
     hardcoded values, 'any' types, naming inconsistencies.
  5. Final report: tests passing, skipped tests, quality issues fixed,
     overall assessment.
  ## Completion
  br close <id> --reason 'AUDIT: N tests passing, M issues fixed, [ready/not ready]'"

Wire: AUDIT depends on BUGSCAN.

### Step 5: Verify Complete Structure
  br list --parent {{workEpicId}}

Verify:
1. Every bead belongs to exactly one phase
2. Every REVIEW depends on all its phase's beads
3. Every phase's first beads depend on previous REVIEW
4. BUGSCAN depends on last REVIEW
5. AUDIT depends on BUGSCAN
6. No circular deps
7. No orphan beads (except Phase 1)

## Completion
br close {{thisBeadId}} --reason "Added structural beads: K REVIEW gates, 1 BUGSCAN, 1 AUDIT under {{workEpicId}}"
```
