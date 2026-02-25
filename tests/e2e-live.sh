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

MODEL="anthropic/claude-haiku-3-5"
MAX_ITER=1

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

info "Running: reverse calc.ts --output docs/specs --max-iterations $MAX_ITER --model $MODEL"

REVERSE_OUTPUT=$(cd "$TMPDIR" && $CLI reverse calc.ts \
  --output docs/specs \
  --max-iterations "$MAX_ITER" \
  --model "$MODEL" 2>&1) || true

echo "$REVERSE_OUTPUT" | tail -20

# Check that the reverse loop ran
if echo "$REVERSE_OUTPUT" | grep -q "Iteration 1\|--- Iteration 1 ---"; then
  pass "Reverse: iteration 1 ran"
else
  fail "Reverse: iteration 1 did not run" "$(echo "$REVERSE_OUTPUT" | tail -5)"
fi

# Check that phase completed (not errored)
if echo "$REVERSE_OUTPUT" | grep -q "Phase Complete"; then
  pass "Reverse: phase completed"
else
  fail "Reverse: phase did not complete" "$(echo "$REVERSE_OUTPUT" | tail -5)"
fi

# Check that a spec file was created
SPEC_FILES=($(find "$TMPDIR/docs/specs" -name "*.md" 2>/dev/null))
SPEC_COUNT=${#SPEC_FILES[@]}

if [[ $SPEC_COUNT -gt 0 ]]; then
  pass "Reverse: spec file created ($SPEC_COUNT found)"
  SPEC_PATH="${SPEC_FILES[0]}"
  SPEC_SIZE=$(wc -c < "$SPEC_PATH" | tr -d ' ')
  if [[ $SPEC_SIZE -gt 50 ]]; then
    pass "Reverse: spec file is non-trivial ($SPEC_SIZE bytes)"
  else
    fail "Reverse: spec file too small ($SPEC_SIZE bytes)" "$(cat "$SPEC_PATH")"
  fi
else
  fail "Reverse: no spec file created in docs/specs/"
  # Can't continue without a spec
  echo -e "\n${RED}${BOLD}Cannot continue pipeline — reverse phase produced no spec.${NC}"
  echo -e "Reverse output:\n$REVERSE_OUTPUT"
  exit 1
fi

info "Spec file: $SPEC_PATH"
info "Spec preview: $(head -3 "$SPEC_PATH")"

# ============================================================
# Phase 2: Decompose (spec → beads)
# ============================================================

header "Phase 2: Decompose (spec → beads)"

info "Running: decompose --spec $SPEC_PATH --epic-title 'E2E Live Test' --max-iterations $MAX_ITER --model $MODEL"

DECOMPOSE_OUTPUT=$(cd "$TMPDIR" && $CLI decompose \
  --spec "$SPEC_PATH" \
  --epic-title "E2E Live Test" \
  --max-iterations "$MAX_ITER" \
  --model "$MODEL" 2>&1) || true

echo "$DECOMPOSE_OUTPUT" | tail -20

# Extract epic ID from output (format: "Created epic: bd-xxx")
EPIC_ID=$(echo "$DECOMPOSE_OUTPUT" | grep -o 'Created epic: [^ ]*' | head -1 | awk '{print $3}') || true

if [[ -n "$EPIC_ID" ]]; then
  pass "Decompose: epic created ($EPIC_ID)"
else
  fail "Decompose: no epic ID found in output"
  echo -e "\n${RED}${BOLD}Cannot continue pipeline — decompose phase produced no epic.${NC}"
  echo -e "Decompose output:\n$DECOMPOSE_OUTPUT"
  exit 1
fi

# Check that the decompose loop ran
if echo "$DECOMPOSE_OUTPUT" | grep -q "Iteration 1\|--- Iteration 1 ---"; then
  pass "Decompose: iteration 1 ran"
else
  fail "Decompose: iteration 1 did not run" "$(echo "$DECOMPOSE_OUTPUT" | tail -5)"
fi

# Check for child beads
CHILD_BEADS=$(cd "$TMPDIR" && br list --parent "$EPIC_ID" --json 2>/dev/null) || true
CHILD_COUNT=0
if [[ -n "$CHILD_BEADS" ]]; then
  CHILD_COUNT=$(echo "$CHILD_BEADS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null) || true
fi

if [[ "$CHILD_COUNT" -gt 0 ]]; then
  pass "Decompose: created $CHILD_COUNT child bead(s)"
else
  # Even with 1 iteration, the agent might not create beads. That's a soft failure.
  fail "Decompose: no child beads found under $EPIC_ID"
fi

# ============================================================
# Phase 3: Forward (beads → code)
# ============================================================

header "Phase 3: Forward (beads → code)"

# Only run forward if we have child beads
if [[ "$CHILD_COUNT" -gt 0 ]]; then
  info "Running: forward --epic $EPIC_ID --max-iterations $MAX_ITER --model $MODEL"

  FORWARD_OUTPUT=$(cd "$TMPDIR" && $CLI forward \
    --epic "$EPIC_ID" \
    --max-iterations "$MAX_ITER" \
    --model "$MODEL" 2>&1) || true

  echo "$FORWARD_OUTPUT" | tail -20

  # Check that forward started
  if echo "$FORWARD_OUTPUT" | grep -q "Iteration 1\|--- Iteration 1 ---\|Selected bead"; then
    pass "Forward: iteration 1 ran"
  else
    fail "Forward: iteration 1 did not run" "$(echo "$FORWARD_OUTPUT" | tail -5)"
  fi

  # Check that phase completed (not crashed)
  if echo "$FORWARD_OUTPUT" | grep -q "Phase Complete"; then
    pass "Forward: phase completed"
  else
    fail "Forward: phase did not complete" "$(echo "$FORWARD_OUTPUT" | tail -5)"
  fi

  # Check for a non-error completion
  if echo "$FORWARD_OUTPUT" | grep -qE "(complete|phase_done|blocked)"; then
    pass "Forward: got valid completion status"
  else
    fail "Forward: no valid completion status found"
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
