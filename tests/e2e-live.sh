#!/usr/bin/env bash
set -euo pipefail

# Live integration test — runs the full reverse → decompose → forward pipeline
# against a tiny fixture project using anthropic/claude-haiku-3-5.
#
# Usage:
#   ./tests/e2e-live.sh              # run the full pipeline
#   ./tests/e2e-all.sh --live        # run as part of the full suite
#
# Requires: bun, br CLI, ANTHROPIC_API_KEY set in environment

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CLI="bun run $PROJECT_ROOT/src/index.ts"
FIXTURE_DIR="$PROJECT_ROOT/tests/fixtures/tiny-project"

MODEL="anthropic/claude-haiku-4-5"
MAX_ITER=10  # Set high to verify agents exit the loop early via phase_done
PHASE_TIMEOUT_SECS=1800

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
    # On failure, tell the user where to look
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

header "Live Integration Test"

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
  fail "jq not found (needed for structured result assertions)"
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
(cd "$TMPDIR" && git init -q && git add -A && git commit -q -m "initial") || true
pass "Initialized git repo"

# Initialize beads workspace
(cd "$TMPDIR" && br init) || true
pass "Initialized beads workspace"

# Create .super-ralph config
mkdir -p "$TMPDIR/.super-ralph"

cat > "$TMPDIR/.super-ralph/config.toml" <<TOML
[engine]
timeout_minutes = 2
inactivity_timeout_seconds = 90
iteration_delay_ms = 0
strategy = "abort"
max_retries = 0

[models]
default = "$MODEL"

[models.areas]

[reverse]
output_dir = "docs/specs"

[decompose]
include_review = false
include_bugscan = false
include_audit = false
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
pass "Installed .opencode/ plugin (task_complete tool)"

# Minimal AGENTS.md
cat > "$TMPDIR/.super-ralph/AGENTS.md" <<'MD'
# Test Project Agent Instructions
This is a tiny calculator project for integration testing.
MD

cat > "$TMPDIR/AGENTS.md" <<'MD'
# Tiny Calculator
A minimal calculator module. See calc.ts for the implementation.
MD

# Create output dir for specs
mkdir -p "$TMPDIR/docs/specs"

pass "Created .super-ralph/ config with model: $MODEL"

# ============================================================
# Phase 1: Reverse (calc.ts → spec)
# ============================================================

header "Phase 1: Reverse (input → spec)"

REVERSE_JSON="$TMPDIR/reverse-result.json"
info "Running: reverse calc.ts --output docs/specs --max-iterations $MAX_ITER --model $MODEL --json $REVERSE_JSON"

REVERSE_LOG="$TMPDIR/reverse-phase.log"
REVERSE_CMD="$CLI reverse calc.ts --output docs/specs --max-iterations \"$MAX_ITER\" --model \"$MODEL\" --json \"$REVERSE_JSON\""
run_with_watchdog "reverse" "$PHASE_TIMEOUT_SECS" "$TMPDIR" "$REVERSE_LOG" "$REVERSE_CMD" || true
REVERSE_OUTPUT="$(<"$REVERSE_LOG")"

# --- Structured assertions from JSON result ---

if [[ ! -f "$REVERSE_JSON" ]]; then
  fail "Reverse: no JSON result file produced"
  echo -e "\n${RED}${BOLD}Cannot continue pipeline — reverse phase crashed.${NC}"
  echo -e "Output:\n$REVERSE_OUTPUT"
  exit 1
fi
pass "Reverse: JSON result file produced"

REVERSE_ITERS=$(jq '.iterations | length' "$REVERSE_JSON")
REVERSE_MAX=$(jq '.maxIterations' "$REVERSE_JSON")
REVERSE_COMPLETED=$(jq '.completed' "$REVERSE_JSON")
REVERSE_FAILED=$(jq '.failed' "$REVERSE_JSON")
REVERSE_LAST_STATUS=$(jq -r '.iterations[-1].status // "none"' "$REVERSE_JSON")
REVERSE_HAS_ERROR=$(jq '[.iterations[] | select(.status == "error")] | length' "$REVERSE_JSON")

if [[ "$REVERSE_ITERS" -ge 1 ]]; then
  pass "Reverse: ran $REVERSE_ITERS iteration(s)"
else
  fail "Reverse: no iterations ran"
fi

if [[ "$REVERSE_COMPLETED" -ge 1 ]]; then
  pass "Reverse: $REVERSE_COMPLETED iteration(s) completed"
else
  fail "Reverse: no iterations completed (completed=$REVERSE_COMPLETED, failed=$REVERSE_FAILED)"
fi

if [[ "$REVERSE_HAS_ERROR" -eq 0 ]]; then
  pass "Reverse: no session errors"
else
  fail "Reverse: $REVERSE_HAS_ERROR iteration(s) had errors"
fi

if [[ "$REVERSE_LAST_STATUS" == "phase_done" || "$REVERSE_LAST_STATUS" == "complete" ]]; then
  pass "Reverse: agent called task_complete (status: $REVERSE_LAST_STATUS)"
else
  fail "Reverse: agent did not call task_complete (status: $REVERSE_LAST_STATUS)"
fi

if [[ "$REVERSE_ITERS" -lt "$REVERSE_MAX" ]]; then
  pass "Reverse: early exit after $REVERSE_ITERS/$REVERSE_MAX iterations"
else
  info "Reverse: used all $REVERSE_MAX iterations (no early exit)"
fi

# --- Artifact checks (filesystem) ---

SPEC_FILES=($(find "$TMPDIR/docs/specs" -name "*.md" 2>/dev/null))
SPEC_COUNT=${#SPEC_FILES[@]}

if [[ $SPEC_COUNT -gt 0 ]]; then
  pass "Reverse: spec file created ($SPEC_COUNT found)"
  SPEC_PATH="${SPEC_FILES[0]}"
  SPEC_SIZE=$(wc -c < "$SPEC_PATH" | tr -d ' ')
  if [[ $SPEC_SIZE -gt 50 ]]; then
    pass "Reverse: spec file is non-trivial ($SPEC_SIZE bytes)"
  else
    fail "Reverse: spec file too small ($SPEC_SIZE bytes)"
  fi
else
  fail "Reverse: no spec file created in docs/specs/"
  echo -e "\n${RED}${BOLD}Cannot continue pipeline — reverse phase produced no spec.${NC}"
  exit 1
fi

info "Spec file: $SPEC_PATH"

# ============================================================
# Phase 2: Decompose (spec → beads)
# ============================================================

header "Phase 2: Decompose (spec → beads)"

DECOMPOSE_JSON="$TMPDIR/decompose-result.json"
info "Running: decompose --spec $SPEC_PATH --epic-title 'E2E Live Test' --max-iterations $MAX_ITER --model $MODEL --json $DECOMPOSE_JSON"

DECOMPOSE_LOG="$TMPDIR/decompose-phase.log"
DECOMPOSE_CMD="$CLI decompose --spec \"$SPEC_PATH\" --epic-title \"E2E Live Test\" --max-iterations \"$MAX_ITER\" --model \"$MODEL\" --json \"$DECOMPOSE_JSON\""
run_with_watchdog "decompose" "$PHASE_TIMEOUT_SECS" "$TMPDIR" "$DECOMPOSE_LOG" "$DECOMPOSE_CMD" || true
DECOMPOSE_OUTPUT="$(<"$DECOMPOSE_LOG")"

# Extract epic ID from output (still needed for artifact checks — the epic ID is a side effect, not in LoopResult)
EPIC_ID=$(echo "$DECOMPOSE_OUTPUT" | grep -o 'Created epic: [^ ]*' | head -1 | awk '{print $3}') || true

if [[ -n "$EPIC_ID" ]]; then
  pass "Decompose: epic created ($EPIC_ID)"
else
  fail "Decompose: no epic ID found in output"
  echo -e "\n${RED}${BOLD}Cannot continue pipeline — decompose phase produced no epic.${NC}"
  exit 1
fi

# --- Structured assertions from JSON result ---

if [[ ! -f "$DECOMPOSE_JSON" ]]; then
  fail "Decompose: no JSON result file produced"
  exit 1
fi
pass "Decompose: JSON result file produced"

DECOMPOSE_ITERS=$(jq '.iterations | length' "$DECOMPOSE_JSON")
DECOMPOSE_MAX=$(jq '.maxIterations' "$DECOMPOSE_JSON")
DECOMPOSE_COMPLETED=$(jq '.completed' "$DECOMPOSE_JSON")
DECOMPOSE_HAS_ERROR=$(jq '[.iterations[] | select(.status == "error")] | length' "$DECOMPOSE_JSON")
DECOMPOSE_LAST_STATUS=$(jq -r '.iterations[-1].status // "none"' "$DECOMPOSE_JSON")

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

if [[ "$DECOMPOSE_ITERS" -lt "$DECOMPOSE_MAX" ]]; then
  pass "Decompose: early exit after $DECOMPOSE_ITERS/$DECOMPOSE_MAX iterations"
else
  info "Decompose: used all $DECOMPOSE_MAX iterations (no early exit)"
fi

# --- Artifact checks (beads) ---

EPIC_DETAIL=$(cd "$TMPDIR" && br show "$EPIC_ID" --json 2>/dev/null) || true
CHILD_COUNT=0
if [[ -n "$EPIC_DETAIL" ]]; then
  CHILD_COUNT=$(echo "$EPIC_DETAIL" | jq '[.[0].dependents[]? | select(.dependency_type == "parent-child")] | length' 2>/dev/null) || true
fi

if [[ "$CHILD_COUNT" -gt 0 ]]; then
  pass "Decompose: created $CHILD_COUNT child bead(s)"
else
  fail "Decompose: no child beads found under $EPIC_ID"
fi

# ============================================================
# Phase 3: Forward (beads → code)
# ============================================================

header "Phase 3: Forward (beads → code)"

# Only run forward if we have child beads
if [[ "$CHILD_COUNT" -gt 0 ]]; then
  FORWARD_JSON="$TMPDIR/forward-result.json"
  info "Running: forward --epic $EPIC_ID --max-iterations $MAX_ITER --model $MODEL --json $FORWARD_JSON"

  FORWARD_LOG="$TMPDIR/forward-phase.log"
  FORWARD_CMD="$CLI forward --epic \"$EPIC_ID\" --max-iterations \"$MAX_ITER\" --model \"$MODEL\" --json \"$FORWARD_JSON\""
  run_with_watchdog "forward" "$PHASE_TIMEOUT_SECS" "$TMPDIR" "$FORWARD_LOG" "$FORWARD_CMD" || true
  FORWARD_OUTPUT="$(<"$FORWARD_LOG")"

  # --- Structured assertions from JSON result ---

  if [[ ! -f "$FORWARD_JSON" ]]; then
    fail "Forward: no JSON result file produced"
  else
    pass "Forward: JSON result file produced"

    FORWARD_ITERS=$(jq '.iterations | length' "$FORWARD_JSON")
    FORWARD_COMPLETED=$(jq '.completed' "$FORWARD_JSON")
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
  fi
else
  skip "Forward: skipped (no child beads from decompose)"
fi

# ============================================================
# Summary
# ============================================================

header "Live Integration Test Summary"

TOTAL=$((PASSED + FAILED + SKIPPED))
echo -e "  ${GREEN}Passed${NC}: $PASSED"
echo -e "  ${RED}Failed${NC}: $FAILED"
echo -e "  ${YELLOW}Skipped${NC}: $SKIPPED"
echo -e "  Total: $TOTAL"
echo ""

if [[ $FAILED -gt 0 ]]; then
  echo -e "${RED}${BOLD}LIVE INTEGRATION: FAILED${NC}"
  exit 1
else
  echo -e "${GREEN}${BOLD}LIVE INTEGRATION: PASSED${NC}"
  exit 0
fi
