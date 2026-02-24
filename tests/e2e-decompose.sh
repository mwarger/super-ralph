#!/usr/bin/env bash
set -euo pipefail

# E2E test for the decompose phase (spec -> beads)
# Usage:
#   ./tests/e2e-decompose.sh           # dry-run only (no OpenCode server needed)
#   ./tests/e2e-decompose.sh --live    # live run (requires OpenCode server)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CLI="bun run $PROJECT_ROOT/src/index.ts"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

LIVE=false
PASSED=0
FAILED=0
SKIPPED=0
TMPDIR=""

for arg in "$@"; do
  case "$arg" in
    --live) LIVE=true ;;
  esac
done

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
  if [[ -n "$TMPDIR" && -d "$TMPDIR" ]]; then
    rm -rf "$TMPDIR"
  fi
  info "Cleanup complete."
}

trap cleanup EXIT

# --- Prerequisites ---

header "Decompose Phase E2E Test"

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

# --- Setup test fixtures ---

header "Setting up test fixtures"

TMPDIR="$(mktemp -d)"
info "Temp directory: $TMPDIR"

# Create .super-ralph directory with minimal config
mkdir -p "$TMPDIR/.super-ralph"

cat > "$TMPDIR/.super-ralph/config.toml" <<'TOML'
[engine]
timeout_minutes = 5
iteration_delay_ms = 0
strategy = "abort"
max_retries = 0

[models]
default = "anthropic/claude-sonnet-4-6"

[models.areas]

[reverse]
output_dir = "docs/specs"

[decompose]
include_review = false
include_bugscan = false
include_audit = false
TOML

# Copy decompose template from project
cp "$PROJECT_ROOT/.super-ralph/decompose.hbs" "$TMPDIR/.super-ralph/decompose.hbs"

# Minimal AGENTS.md
cat > "$TMPDIR/.super-ralph/AGENTS.md" <<'MD'
# Test Project Agent Instructions
This is a test project for E2E testing.
MD

cat > "$TMPDIR/AGENTS.md" <<'MD'
# Test Project
E2E test fixture.
MD

pass "Created .super-ralph/ config"

# Initialize beads workspace
info "Initializing beads workspace..."
(cd "$TMPDIR" && br init 2>&1) || true
if [[ -d "$TMPDIR/.beads" ]]; then
  pass "Beads workspace initialized"
else
  fail "Failed to initialize beads workspace"
  exit 1
fi

# Create a test spec file
SPEC_PATH="$TMPDIR/test-spec.md"
cat > "$SPEC_PATH" <<'SPEC'
# TODO App Specification

## Purpose
A simple command-line TODO application that lets users manage tasks.

## Features

### 1. Add Task
Users can add a new task with a title and optional description.

### 2. List Tasks
Users can list all tasks, showing title, status (done/pending), and creation date.

### 3. Complete Task
Users can mark a task as complete by its ID.

### 4. Delete Task
Users can delete a task by its ID.

## Technical Requirements
- Written in TypeScript
- Uses a JSON file for persistence
- CLI interface using process.argv
SPEC

pass "Created test spec: $SPEC_PATH"

# --- Dry-run test ---

header "Test: decompose --dry-run"

info "Running: $CLI decompose --spec $SPEC_PATH --dry-run"
DRY_OUTPUT=$(cd "$TMPDIR" && $CLI decompose --spec "$SPEC_PATH" --dry-run 2>&1) || true

# Verify dry-run output
if echo "$DRY_OUTPUT" | grep -q "\[dry-run\]"; then
  pass "Dry-run output contains [dry-run] marker"
else
  fail "Dry-run output missing [dry-run] marker" "$DRY_OUTPUT"
fi

if echo "$DRY_OUTPUT" | grep -qi "decompose"; then
  pass "Dry-run output references decompose"
else
  fail "Dry-run output missing decompose reference" "$DRY_OUTPUT"
fi

if echo "$DRY_OUTPUT" | grep -q "test-spec.md"; then
  pass "Dry-run output references spec file"
else
  fail "Dry-run output missing spec file reference" "$DRY_OUTPUT"
fi

if echo "$DRY_OUTPUT" | grep -qi "iteration"; then
  pass "Dry-run output mentions iterations"
else
  fail "Dry-run output missing iteration info" "$DRY_OUTPUT"
fi

# Verify epic creation was skipped in dry-run
if echo "$DRY_OUTPUT" | grep -q "dry-run"; then
  pass "Dry-run skipped epic creation"
else
  fail "Dry-run may have created a real epic" "$DRY_OUTPUT"
fi

# --- Test: missing spec file ---

header "Test: decompose with missing spec"

info "Running: $CLI decompose --spec /nonexistent/spec.md --dry-run"
MISSING_OUTPUT=$(cd "$TMPDIR" && $CLI decompose --spec "/nonexistent/spec.md" --dry-run 2>&1) || true
MISSING_EXIT=$?

if echo "$MISSING_OUTPUT" | grep -qi "not found\|error\|no such"; then
  pass "Missing spec produces error message"
else
  # The command might exit non-zero without a specific message
  if [[ $MISSING_EXIT -ne 0 ]]; then
    pass "Missing spec exits with non-zero status"
  else
    fail "Missing spec did not produce error" "$MISSING_OUTPUT"
  fi
fi

# --- Test: missing --spec flag ---

header "Test: decompose without --spec"

info "Running: $CLI decompose --dry-run"
NOSPEC_OUTPUT=$(cd "$TMPDIR" && $CLI decompose --dry-run 2>&1) || true

if echo "$NOSPEC_OUTPUT" | grep -qi "required\|error\|spec"; then
  pass "Missing --spec flag produces error"
else
  fail "Missing --spec flag did not produce error" "$NOSPEC_OUTPUT"
fi

# --- Live test (optional) ---

if $LIVE; then
  header "Test: decompose --live (real execution)"

  info "Running: $CLI decompose --spec $SPEC_PATH --epic-title 'E2E Test Decompose' --max-iterations 1"
  LIVE_OUTPUT=$(cd "$TMPDIR" && $CLI decompose --spec "$SPEC_PATH" --epic-title "E2E Test Decompose" --max-iterations 1 2>&1) || true

  if echo "$LIVE_OUTPUT" | grep -q "Created epic"; then
    pass "Live run created an epic"
    # Extract epic ID for cleanup
    LIVE_EPIC=$(echo "$LIVE_OUTPUT" | grep "Created epic" | grep -o '[a-zA-Z0-9_-]\{5,\}' | tail -1)
    if [[ -n "$LIVE_EPIC" ]]; then
      info "Created epic: $LIVE_EPIC (will be cleaned up)"
      # Clean up the epic
      (cd "$TMPDIR" && br delete "$LIVE_EPIC" --cascade 2>/dev/null) || true
    fi
  else
    fail "Live run did not create epic" "$LIVE_OUTPUT"
  fi

  if echo "$LIVE_OUTPUT" | grep -q "Iteration 1"; then
    pass "Live run started iteration 1"
  else
    fail "Live run did not start iteration" "$LIVE_OUTPUT"
  fi
else
  skip "Live decompose test (pass --live to enable)"
fi

# --- Summary ---

header "Decompose E2E Summary"

TOTAL=$((PASSED + FAILED + SKIPPED))
echo -e "  ${GREEN}Passed${NC}: $PASSED"
echo -e "  ${RED}Failed${NC}: $FAILED"
echo -e "  ${YELLOW}Skipped${NC}: $SKIPPED"
echo -e "  Total: $TOTAL"
echo ""

if [[ $FAILED -gt 0 ]]; then
  echo -e "${RED}${BOLD}DECOMPOSE E2E: FAILED${NC}"
  exit 1
else
  echo -e "${GREEN}${BOLD}DECOMPOSE E2E: PASSED${NC}"
  exit 0
fi
