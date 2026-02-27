#!/usr/bin/env bash
set -euo pipefail

# Complex live integration test — runs the full reverse → decompose → forward pipeline
# against a multi-file task-manager fixture with real bugs, missing features, and
# incomplete tests. Designed to stress-test multi-iteration behavior and edge cases.
#
# Edge cases tested:
#   - Reverse: multiple source files with cross-imports, README/code contradictions
#   - Decompose: enough work for 6-12 beads, dependency chains, area labels
#   - Forward: real bugs to fix, cross-file changes, quality gates that matter
#
# Usage:
#   ./tests/e2e-live-complex.sh              # run the full pipeline
#   ./tests/e2e-all.sh --live                # run as part of the full suite

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CLI="bun run $PROJECT_ROOT/src/index.ts"
FIXTURE_DIR="$PROJECT_ROOT/tests/fixtures/task-manager"

MODEL="anthropic/claude-sonnet-4-6"
MAX_ITER=15
PHASE_TIMEOUT_SECS=1200

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASSED=0
FAILED=0
SKIPPED=0
TMPDIR=""
EPIC_ID=""

# --- Helpers ---

pass() {
  PASSED=$((PASSED + 1))
  echo -e "  ${GREEN}✓ PASS${NC}: $1"
}

fail() {
  FAILED=$((FAILED + 1))
  echo -e "  ${RED}✗ FAIL${NC}: $1"
  if [[ -n "${2:-}" ]]; then
    echo -e "    ${RED}$2${NC}"
  fi
}

skip() {
  SKIPPED=$((SKIPPED + 1))
  echo -e "  ${YELLOW}⊘ SKIP${NC}: $1"
}

info() {
  echo -e "${CYAN}▸${NC} $1"
}

header() {
  echo ""
  echo -e "${BOLD}═══ $1 ═══${NC}"
}

run_with_watchdog() {
  local name="$1"
  local timeout_secs="$2"
  local workdir="$3"
  local logfile="$4"
  local cmd="$5"

  : > "$logfile"
  info "[$name] command: $cmd"
  info "[$name] log: $logfile"

  (
    cd "$workdir"
    bash -lc "$cmd" 2>&1 | tee "$logfile"
  ) &

  local pid=$!
  local elapsed=0

  while kill -0 "$pid" 2>/dev/null; do
    sleep 10
    elapsed=$((elapsed + 10))
    info "[$name] still running (${elapsed}s)"

    if [[ "$elapsed" -ge "$timeout_secs" ]]; then
      echo -e "  ${RED}✗ TIMEOUT${NC}: $name exceeded ${timeout_secs}s"
      kill "$pid" 2>/dev/null || true
      sleep 2
      kill -9 "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
      return 124
    fi
  done

  wait "$pid"
  local rc=$?
  info "[$name] exited rc=$rc after ${elapsed}s"
  return "$rc"
}

# --- Cleanup ---

cleanup() {
  info "Cleaning up..."

  # Delete beads epic if one was created
  if [[ -n "$EPIC_ID" && "$EPIC_ID" != "dry-run-epic" ]]; then
    info "Deleting epic $EPIC_ID..."
    br delete "$EPIC_ID" --cascade 2>/dev/null || true
  fi

  if [[ -n "$TMPDIR" && -d "$TMPDIR" ]]; then
    if [[ $FAILED -gt 0 ]]; then
      echo -e "  ${YELLOW}Temp dir preserved for debugging: $TMPDIR${NC}"
    else
      rm -rf "$TMPDIR"
    fi
  fi

  info "Cleanup complete."
}

trap cleanup EXIT

# --- Prerequisites ---

header "Complex Live Integration Test"

info "Checking prerequisites..."

if ! command -v bun &>/dev/null; then
  fail "bun not found"
  exit 1
fi
pass "bun found: $(bun --version)"

if ! command -v br &>/dev/null; then
  fail "br CLI not found"
  exit 1
fi
pass "br CLI found: $(br --version 2>&1 | head -1)"

if ! command -v jq &>/dev/null; then
  fail "jq not found"
  exit 1
fi
pass "jq found: $(jq --version)"

if [[ ! -d "$FIXTURE_DIR" ]]; then
  fail "Fixture not found: $FIXTURE_DIR"
  exit 1
fi
pass "Fixture found: $FIXTURE_DIR"

# --- Setup ---

header "Setting up test environment"

TMPDIR="$(mktemp -d)"
info "Temp directory: $TMPDIR"

# Copy fixture into temp dir
cp -r "$FIXTURE_DIR/"* "$TMPDIR/"
pass "Copied fixture to temp dir"

# Initialize a git repo (OpenCode needs it)
(cd "$TMPDIR" && git init -q && git add -A && git commit -q -m "initial: task-manager fixture") || true
pass "Initialized git repo"

# Initialize beads workspace
(cd "$TMPDIR" && br init) || true
pass "Initialized beads workspace"

# Create .super-ralph config
mkdir -p "$TMPDIR/.super-ralph"

cat > "$TMPDIR/.super-ralph/config.toml" <<TOML
[engine]
timeout_minutes = 15
inactivity_timeout_seconds = 420
iteration_delay_ms = 0
strategy = "retry"
max_retries = 1

[models]
default = "$MODEL"

[models.areas]

[reverse]
output_dir = "docs/specs"

[decompose]
include_review = true
include_bugscan = false
include_audit = true
TOML

# Copy all phase templates
cp "$PROJECT_ROOT/.super-ralph/reverse.hbs" "$TMPDIR/.super-ralph/reverse.hbs"
cp "$PROJECT_ROOT/.super-ralph/decompose.hbs" "$TMPDIR/.super-ralph/decompose.hbs"
cp "$PROJECT_ROOT/.super-ralph/forward.hbs" "$TMPDIR/.super-ralph/forward.hbs"

# Set up .opencode/ plugin (provides task_complete tool)
mkdir -p "$TMPDIR/.opencode/plugins"
cp "$PROJECT_ROOT/.opencode/plugins/super-ralph.js" "$TMPDIR/.opencode/plugins/"
cat > "$TMPDIR/.opencode/package.json" <<'JSON'
{"dependencies":{"@opencode-ai/plugin":"1.2.10"}}
JSON
(cd "$TMPDIR/.opencode" && bun install --silent 2>/dev/null)
pass "Installed .opencode/ plugin"

# AGENTS.md
cp "$FIXTURE_DIR/AGENTS.md" "$TMPDIR/AGENTS.md"
cp "$FIXTURE_DIR/AGENTS.md" "$TMPDIR/.super-ralph/AGENTS.md"

# Create output dir for specs
mkdir -p "$TMPDIR/docs/specs"

pass "Created .super-ralph/ config with model: $MODEL"

# Verify fixture tests pass before we start
info "Running fixture tests to verify baseline..."
BASELINE_TEST_OUTPUT=$(cd "$TMPDIR" && bun test 2>&1) || true
BASELINE_TESTS=$(echo "$BASELINE_TEST_OUTPUT" | grep -E '^[[:space:]]*[0-9]+ pass$' | tail -1 | awk '{print $1}')
if [[ -n "$BASELINE_TESTS" && "$BASELINE_TESTS" -gt 0 ]]; then
  pass "Baseline: $BASELINE_TESTS tests pass before pipeline"
else
  fail "Baseline tests did not run" "$BASELINE_TEST_OUTPUT"
fi

# ============================================================
# Phase 0: Interactive Reverse (with mock answers)
# ============================================================

header "Phase 0: Interactive Reverse (mock answers)"

# Copy mock answers file
cp "$FIXTURE_DIR/mock-answers.json" "$TMPDIR/mock-answers.json"
pass "Copied mock answers file"

INTERACTIVE_JSON="$TMPDIR/interactive-result.json"
INTERACTIVE_SPEC_DIR="$TMPDIR/docs/interactive-specs"
mkdir -p "$INTERACTIVE_SPEC_DIR"

info "Running: reverse --interactive --skill feature --answers mock-answers.json --output $INTERACTIVE_SPEC_DIR --model $MODEL"

INTERACTIVE_LOG="$TMPDIR/interactive-phase.log"
INTERACTIVE_CMD="$CLI reverse types.ts task-manager.ts filters.ts stats.ts --interactive --skill feature --answers mock-answers.json --output \"$INTERACTIVE_SPEC_DIR\" --model \"$MODEL\""
run_with_watchdog "interactive-reverse" "$PHASE_TIMEOUT_SECS" "$TMPDIR" "$INTERACTIVE_LOG" "$INTERACTIVE_CMD" || true
INTERACTIVE_OUTPUT="$(<"$INTERACTIVE_LOG")"

# Check that mock answers were used
if echo "$INTERACTIVE_OUTPUT" | grep -q "\[mock\]"; then
  MOCK_COUNT=$(echo "$INTERACTIVE_OUTPUT" | grep -c "\[mock\] Q:" || echo "0")
  pass "Interactive: mock answers were used ($MOCK_COUNT questions answered)"
else
  fail "Interactive: mock answers were not used (no [mock] markers in output)"
fi

# Check that a spec was produced
INTERACTIVE_SPEC_FILES=($(find "$INTERACTIVE_SPEC_DIR" -name "*.md" 2>/dev/null))
INTERACTIVE_SPEC_COUNT=${#INTERACTIVE_SPEC_FILES[@]}

if [[ $INTERACTIVE_SPEC_COUNT -gt 0 ]]; then
  INTERACTIVE_SPEC_SIZE=$(wc -c < "${INTERACTIVE_SPEC_FILES[0]}" | tr -d ' ')
  pass "Interactive: spec file created ($INTERACTIVE_SPEC_SIZE bytes)"
else
  fail "Interactive: no spec file created"
fi

# ============================================================
# Phase 1: Reverse (multi-file project → spec, autonomous)
# ============================================================

header "Phase 1: Reverse (multi-file project → spec, autonomous)"

REVERSE_JSON="$TMPDIR/reverse-result.json"
info "Running: reverse types.ts task-manager.ts filters.ts stats.ts --output docs/specs --max-iterations $MAX_ITER --model $MODEL --json $REVERSE_JSON"

REVERSE_LOG="$TMPDIR/reverse-phase.log"
REVERSE_CMD="$CLI reverse types.ts task-manager.ts filters.ts stats.ts --output docs/specs --max-iterations \"$MAX_ITER\" --model \"$MODEL\" --json \"$REVERSE_JSON\""
run_with_watchdog "reverse" "$PHASE_TIMEOUT_SECS" "$TMPDIR" "$REVERSE_LOG" "$REVERSE_CMD" || true
REVERSE_OUTPUT="$(<"$REVERSE_LOG")"

# --- Structured assertions ---

if [[ ! -f "$REVERSE_JSON" ]]; then
  fail "Reverse: no JSON result file produced"
  echo -e "\n${RED}${BOLD}Cannot continue — reverse phase crashed.${NC}"
  echo -e "Output:\n$REVERSE_OUTPUT"
  exit 1
fi
pass "Reverse: JSON result file produced"

REVERSE_ITERS=$(jq '.iterations | length' "$REVERSE_JSON")
REVERSE_MAX=$(jq '.maxIterations' "$REVERSE_JSON")
REVERSE_COMPLETED=$(jq '.completed' "$REVERSE_JSON")
REVERSE_FAILED_COUNT=$(jq '.failed' "$REVERSE_JSON")
REVERSE_LAST_STATUS=$(jq -r '.iterations[-1].status // "none"' "$REVERSE_JSON")
REVERSE_HAS_REASON=$(jq -r '.iterations[-1].reason // ""' "$REVERSE_JSON")

if [[ "$REVERSE_ITERS" -ge 1 ]]; then
  pass "Reverse: ran $REVERSE_ITERS iteration(s)"
else
  fail "Reverse: no iterations ran"
fi

if [[ "$REVERSE_COMPLETED" -ge 1 ]]; then
  pass "Reverse: $REVERSE_COMPLETED iteration(s) completed"
else
  fail "Reverse: no iterations completed (completed=$REVERSE_COMPLETED)"
fi

if [[ "$REVERSE_FAILED_COUNT" -eq 0 ]]; then
  pass "Reverse: no failed iterations"
else
  fail "Reverse: $REVERSE_FAILED_COUNT iteration(s) failed"
fi

if [[ "$REVERSE_LAST_STATUS" == "phase_done" || "$REVERSE_LAST_STATUS" == "complete" ]]; then
  pass "Reverse: agent called task_complete (status: $REVERSE_LAST_STATUS)"
else
  fail "Reverse: agent did not call task_complete (status: $REVERSE_LAST_STATUS)"
fi

# Check that the agent provided a reason for its decision
if [[ -n "$REVERSE_HAS_REASON" ]]; then
  pass "Reverse: agent provided completion reason"
  info "Reason: ${REVERSE_HAS_REASON:0:200}"
else
  fail "Reverse: agent did not provide completion reason"
fi

if [[ "$REVERSE_ITERS" -lt "$REVERSE_MAX" ]]; then
  pass "Reverse: early exit after $REVERSE_ITERS/$REVERSE_MAX iterations"
else
  info "Reverse: used all $REVERSE_MAX iterations (no early exit)"
fi

# Check spec quality
SPEC_FILES=($(find "$TMPDIR/docs/specs" -name "*.md" 2>/dev/null))
SPEC_COUNT=${#SPEC_FILES[@]}

if [[ $SPEC_COUNT -gt 0 ]]; then
  pass "Reverse: spec file created ($SPEC_COUNT found)"
  SPEC_PATH="${SPEC_FILES[0]}"
  SPEC_SIZE=$(wc -c < "$SPEC_PATH" | tr -d ' ')

  if [[ $SPEC_SIZE -gt 500 ]]; then
    pass "Reverse: spec is substantial ($SPEC_SIZE bytes)"
  else
    fail "Reverse: spec too small for a multi-file project ($SPEC_SIZE bytes)"
  fi

  # Check that spec mentions key aspects of the project
  if grep -qi "filter\|sort" "$SPEC_PATH"; then
    pass "Reverse: spec covers filtering/sorting"
  else
    fail "Reverse: spec missing filtering/sorting coverage"
  fi

  if grep -qi "stats\|statistic\|report" "$SPEC_PATH"; then
    pass "Reverse: spec covers stats module"
  else
    fail "Reverse: spec missing stats module coverage"
  fi

  if grep -qi "valid\|input" "$SPEC_PATH"; then
    pass "Reverse: spec covers validation"
  else
    fail "Reverse: spec missing validation coverage"
  fi
else
  fail "Reverse: no spec file created"
  echo -e "\n${RED}${BOLD}Cannot continue — no spec produced.${NC}"
  exit 1
fi

info "Spec file: $SPEC_PATH"

# ============================================================
# Phase 2: Decompose (spec → beads)
# ============================================================

header "Phase 2: Decompose (spec → beads)"

DECOMPOSE_JSON="$TMPDIR/decompose-result.json"
info "Running: decompose --spec $SPEC_PATH --epic-title 'Task Manager' --max-iterations $MAX_ITER --model $MODEL --json $DECOMPOSE_JSON"

DECOMPOSE_LOG="$TMPDIR/decompose-phase.log"
DECOMPOSE_CMD="$CLI decompose --spec \"$SPEC_PATH\" --epic-title \"Task Manager\" --max-iterations \"$MAX_ITER\" --model \"$MODEL\" --json \"$DECOMPOSE_JSON\""
run_with_watchdog "decompose" "$PHASE_TIMEOUT_SECS" "$TMPDIR" "$DECOMPOSE_LOG" "$DECOMPOSE_CMD" || true
DECOMPOSE_OUTPUT="$(<"$DECOMPOSE_LOG")"

# Extract epic ID
EPIC_ID=$(echo "$DECOMPOSE_OUTPUT" | grep -o 'Created epic: [^ ]*' | head -1 | awk '{print $3}') || true

if [[ -n "$EPIC_ID" ]]; then
  pass "Decompose: epic created ($EPIC_ID)"
else
  fail "Decompose: no epic ID found"
  echo -e "\n${RED}${BOLD}Cannot continue — no epic created.${NC}"
  exit 1
fi

# --- Structured assertions ---

if [[ ! -f "$DECOMPOSE_JSON" ]]; then
  fail "Decompose: no JSON result file produced"
  exit 1
fi
pass "Decompose: JSON result file produced"

DECOMPOSE_ITERS=$(jq '.iterations | length' "$DECOMPOSE_JSON")
DECOMPOSE_COMPLETED=$(jq '.completed' "$DECOMPOSE_JSON")
DECOMPOSE_HAS_ERROR=$(jq '[.iterations[] | select(.status == "error")] | length' "$DECOMPOSE_JSON")
DECOMPOSE_LAST_STATUS=$(jq -r '.iterations[-1].status // "none"' "$DECOMPOSE_JSON")
DECOMPOSE_HAS_REASON=$(jq -r '.iterations[-1].reason // ""' "$DECOMPOSE_JSON")

if [[ "$DECOMPOSE_ITERS" -ge 1 ]]; then
  pass "Decompose: ran $DECOMPOSE_ITERS iteration(s)"
else
  fail "Decompose: no iterations ran"
fi

if [[ "$DECOMPOSE_HAS_ERROR" -eq 0 ]]; then
  pass "Decompose: no session errors"
else
  fail "Decompose: $DECOMPOSE_HAS_ERROR iteration(s) had errors"
fi

if [[ "$DECOMPOSE_LAST_STATUS" == "phase_done" || "$DECOMPOSE_LAST_STATUS" == "complete" ]]; then
  pass "Decompose: agent called task_complete (status: $DECOMPOSE_LAST_STATUS)"
else
  fail "Decompose: agent did not call task_complete (status: $DECOMPOSE_LAST_STATUS)"
fi

# Check that the agent provided a reason
if [[ -n "$DECOMPOSE_HAS_REASON" ]]; then
  pass "Decompose: agent provided completion reason"
  info "Reason: ${DECOMPOSE_HAS_REASON:0:200}"
else
  fail "Decompose: agent did not provide completion reason"
fi

# --- Artifact checks (beads) ---

EPIC_DETAIL=$(cd "$TMPDIR" && br show "$EPIC_ID" --json 2>/dev/null) || true
CHILD_COUNT=0
if [[ -n "$EPIC_DETAIL" ]]; then
  CHILD_COUNT=$(echo "$EPIC_DETAIL" | jq '[.[0].dependents[]? | select(.dependency_type == "parent-child")] | length' 2>/dev/null) || true
fi

if [[ "$CHILD_COUNT" -ge 6 ]]; then
  pass "Decompose: created $CHILD_COUNT child beads (>= 6 expected for this complexity)"
else
  fail "Decompose: only $CHILD_COUNT child beads — expected >= 6 for a project with bugs, missing features, and incomplete tests"
fi

# Check for variety in bead content (should cover different areas)
# Prefer structured JSON from EPIC_DETAIL, fallback to plain br list output.
ALL_BEADS_TEXT=""
if [[ -n "$EPIC_DETAIL" ]]; then
  ALL_BEADS_TEXT=$(echo "$EPIC_DETAIL" | jq -r '.[0].dependents[]? | select(.dependency_type == "parent-child") | (.bead.title // .title // "")' 2>/dev/null) || true
fi
if [[ -z "$ALL_BEADS_TEXT" ]]; then
  ALL_BEADS_TEXT=$(cd "$TMPDIR" && br list --parent "$EPIC_ID" 2>/dev/null) || true
fi

HAS_TEST_BEAD=false
HAS_BUG_BEAD=false
HAS_IMPL_BEAD=false

if echo "$ALL_BEADS_TEXT" | grep -qi "test"; then HAS_TEST_BEAD=true; fi
if echo "$ALL_BEADS_TEXT" | grep -qi "bug\|fix\|error"; then HAS_BUG_BEAD=true; fi
if echo "$ALL_BEADS_TEXT" | grep -qi "implement\|stat\|valid\|filter"; then HAS_IMPL_BEAD=true; fi

if $HAS_TEST_BEAD; then
  pass "Decompose: includes test-related beads"
else
  fail "Decompose: missing test-related beads"
fi

if $HAS_BUG_BEAD; then
  pass "Decompose: includes bug-fix beads"
else
  fail "Decompose: missing bug-fix beads (project has known bugs)"
fi

if $HAS_IMPL_BEAD; then
  pass "Decompose: includes implementation beads"
else
  fail "Decompose: missing implementation beads"
fi

# ============================================================
# Phase 3: Forward (beads → code)
# ============================================================

header "Phase 3: Forward (beads → code)"

if [[ "$CHILD_COUNT" -gt 0 ]]; then
  FORWARD_JSON="$TMPDIR/forward-result.json"
  info "Running: forward --epic $EPIC_ID --max-iterations $MAX_ITER --model $MODEL --json $FORWARD_JSON"

  FORWARD_LOG="$TMPDIR/forward-phase.log"
  FORWARD_CMD="$CLI forward --epic \"$EPIC_ID\" --max-iterations \"$MAX_ITER\" --model \"$MODEL\" --json \"$FORWARD_JSON\""
  run_with_watchdog "forward" "$PHASE_TIMEOUT_SECS" "$TMPDIR" "$FORWARD_LOG" "$FORWARD_CMD" || true
  FORWARD_OUTPUT="$(<"$FORWARD_LOG")"

  # --- Structured assertions ---

  if [[ ! -f "$FORWARD_JSON" ]]; then
    fail "Forward: no JSON result file produced"
  else
    pass "Forward: JSON result file produced"

    FORWARD_ITERS=$(jq '.iterations | length' "$FORWARD_JSON")
    FORWARD_COMPLETED=$(jq '.completed' "$FORWARD_JSON")
    FORWARD_FAILED_COUNT=$(jq '.failed' "$FORWARD_JSON")
    FORWARD_HAS_ERROR=$(jq '[.iterations[] | select(.status == "error")] | length' "$FORWARD_JSON")

    if [[ "$FORWARD_ITERS" -ge 1 ]]; then
      pass "Forward: ran $FORWARD_ITERS iteration(s)"
    else
      fail "Forward: no iterations ran"
    fi

    if [[ "$FORWARD_HAS_ERROR" -eq 0 ]]; then
      pass "Forward: no session errors"
    else
      fail "Forward: $FORWARD_HAS_ERROR iteration(s) had errors"
    fi

    if [[ "$FORWARD_COMPLETED" -ge 1 ]]; then
      pass "Forward: $FORWARD_COMPLETED iteration(s) completed"
    else
      fail "Forward: no iterations completed"
    fi

    # Check that at least some iterations provided reasons
    FORWARD_WITH_REASON=$(jq '[.iterations[] | select(.reason != null and .reason != "")] | length' "$FORWARD_JSON")
    if [[ "$FORWARD_WITH_REASON" -ge 1 ]]; then
      pass "Forward: $FORWARD_WITH_REASON/$FORWARD_ITERS iterations provided reasons"
    else
      fail "Forward: no iterations provided reasons"
    fi

    # Check that forward made progress (some beads should be closed)
    POST_FORWARD_EPIC_DETAIL=$(cd "$TMPDIR" && br show "$EPIC_ID" --json 2>/dev/null) || true
    CLOSED_COUNT=0
    if [[ -n "$POST_FORWARD_EPIC_DETAIL" ]]; then
      CLOSED_COUNT=$(echo "$POST_FORWARD_EPIC_DETAIL" | jq '[.[0].dependents[]? | select(.dependency_type == "parent-child") | .bead.status // .status | select(. == "closed")] | length' 2>/dev/null) || CLOSED_COUNT=0
    fi
    if [[ "$CLOSED_COUNT" -eq 0 ]]; then
      CLOSED_COUNT=$(cd "$TMPDIR" && br list --parent "$EPIC_ID" --status closed 2>/dev/null | wc -l | tr -d ' ') || CLOSED_COUNT=0
    fi
    if [[ "$CLOSED_COUNT" -gt 0 ]]; then
      pass "Forward: $CLOSED_COUNT beads closed during forward phase"
    else
      fail "Forward: no beads were closed"
    fi
  fi

  # --- Post-forward quality checks ---

  header "Post-Forward Quality Checks"

  # Run tests after forward to see if they improved
  POST_TEST_LOG="$TMPDIR/post-forward-tests.log"
  run_with_watchdog "post-forward-tests" 300 "$TMPDIR" "$POST_TEST_LOG" "bun test" || true
  POST_TEST_OUTPUT="$(<"$POST_TEST_LOG")"
  POST_TESTS=$(echo "$POST_TEST_OUTPUT" | grep -E '^[[:space:]]*[0-9]+ pass$' | tail -1 | awk '{print $1}')
  POST_FAILURES=$(echo "$POST_TEST_OUTPUT" | grep -E '^[[:space:]]*[0-9]+ fail$' | tail -1 | awk '{print $1}')
  POST_TESTS=${POST_TESTS:-0}
  POST_FAILURES=${POST_FAILURES:-0}

  if [[ -n "$POST_TESTS" && "$POST_TESTS" -gt "$BASELINE_TESTS" ]]; then
    pass "Quality: test count improved ($BASELINE_TESTS → $POST_TESTS)"
  elif [[ -n "$POST_TESTS" && "$POST_TESTS" -ge "$BASELINE_TESTS" ]]; then
    pass "Quality: tests maintained ($POST_TESTS pass, $POST_FAILURES fail)"
  else
    fail "Quality: tests regressed or broke (was $BASELINE_TESTS, now ${POST_TESTS:-0})"
  fi

  # Check if git has commits from the forward phase
  COMMIT_COUNT=$(cd "$TMPDIR" && git log --oneline | wc -l | tr -d ' ')
  if [[ "$COMMIT_COUNT" -gt 1 ]]; then
    pass "Quality: forward phase made $(($COMMIT_COUNT - 1)) commit(s)"
  else
    fail "Quality: forward phase made no commits"
  fi

else
  skip "Forward: skipped (no child beads from decompose)"
fi

# ============================================================
# Summary
# ============================================================

header "Complex Live Integration Test Summary"

TOTAL=$((PASSED + FAILED + SKIPPED))
echo -e "  ${GREEN}Passed${NC}: $PASSED"
echo -e "  ${RED}Failed${NC}: $FAILED"
echo -e "  ${YELLOW}Skipped${NC}: $SKIPPED"
echo -e "  Total: $TOTAL"
echo ""

# Print timing breakdown from JSON results
if [[ -f "$REVERSE_JSON" ]]; then
  REVERSE_TIME=$(jq '.totalTime / 1000 | floor' "$REVERSE_JSON")
  echo -e "  Reverse:   ${REVERSE_TIME}s ($REVERSE_ITERS iterations)"
fi
if [[ -f "$DECOMPOSE_JSON" ]]; then
  DECOMPOSE_TIME=$(jq '.totalTime / 1000 | floor' "$DECOMPOSE_JSON")
  echo -e "  Decompose: ${DECOMPOSE_TIME}s ($DECOMPOSE_ITERS iterations)"
fi
if [[ -f "$FORWARD_JSON" ]]; then
  FORWARD_TIME=$(jq '.totalTime / 1000 | floor' "$FORWARD_JSON")
  echo -e "  Forward:   ${FORWARD_TIME}s ($FORWARD_ITERS iterations)"
fi
echo ""

if [[ $FAILED -gt 0 ]]; then
  echo -e "${RED}${BOLD}COMPLEX LIVE: FAILED ($FAILED failures)${NC}"
  exit 1
else
  echo -e "${GREEN}${BOLD}COMPLEX LIVE: PASSED${NC}"
  exit 0
fi
