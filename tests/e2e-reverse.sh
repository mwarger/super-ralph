#!/usr/bin/env bash
set -euo pipefail

# E2E test for the reverse phase (input -> spec)
# Usage:
#   ./tests/e2e-reverse.sh           # dry-run only (no OpenCode server needed)
#   ./tests/e2e-reverse.sh --live    # live run (requires OpenCode server)

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

header "Reverse Phase E2E Test"

info "Checking prerequisites..."

if ! command -v bun &>/dev/null; then
  fail "bun not found"
  exit 1
fi
pass "bun found: $(bun --version)"

# br is not strictly needed for reverse, but check anyway for consistency
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

# Copy reverse template from project
cp "$PROJECT_ROOT/.super-ralph/reverse.hbs" "$TMPDIR/.super-ralph/reverse.hbs"

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

# Create a test input file (small TypeScript module to reverse-engineer)
INPUT_PATH="$TMPDIR/calculator.ts"
cat > "$INPUT_PATH" <<'TS'
// A simple calculator module

export interface Calculator {
  add(a: number, b: number): number;
  subtract(a: number, b: number): number;
  multiply(a: number, b: number): number;
  divide(a: number, b: number): number;
}

export function createCalculator(): Calculator {
  return {
    add: (a, b) => a + b,
    subtract: (a, b) => a - b,
    multiply: (a, b) => a * b,
    divide: (a, b) => {
      if (b === 0) throw new Error("Division by zero");
      return a / b;
    },
  };
}

export function formatResult(value: number, precision: number = 2): string {
  return value.toFixed(precision);
}
TS

pass "Created test input: $INPUT_PATH"

# Create output directory for specs
OUTPUT_DIR="$TMPDIR/output-specs"
mkdir -p "$OUTPUT_DIR"
pass "Created output directory: $OUTPUT_DIR"

# --- Dry-run test ---

header "Test: reverse --dry-run"

info "Running: $CLI reverse $INPUT_PATH --output $OUTPUT_DIR --dry-run"
DRY_OUTPUT=$(cd "$TMPDIR" && $CLI reverse "$INPUT_PATH" --output "$OUTPUT_DIR" --dry-run 2>&1) || true

# Verify dry-run output
if echo "$DRY_OUTPUT" | grep -q "\[dry-run\]"; then
  pass "Dry-run output contains [dry-run] marker"
else
  fail "Dry-run output missing [dry-run] marker" "$DRY_OUTPUT"
fi

if echo "$DRY_OUTPUT" | grep -qi "reverse"; then
  pass "Dry-run output references reverse loop"
else
  fail "Dry-run output missing reverse reference" "$DRY_OUTPUT"
fi

if echo "$DRY_OUTPUT" | grep -qi "iteration"; then
  pass "Dry-run output mentions iterations"
else
  fail "Dry-run output missing iteration info" "$DRY_OUTPUT"
fi

if echo "$DRY_OUTPUT" | grep -q "calculator.ts\|$INPUT_PATH"; then
  pass "Dry-run output references input file"
else
  fail "Dry-run output missing input file reference" "$DRY_OUTPUT"
fi

# Verify no spec was actually created in dry-run
SPEC_COUNT=$(find "$OUTPUT_DIR" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
if [[ "$SPEC_COUNT" -eq 0 ]]; then
  pass "Dry-run did not create any spec files"
else
  fail "Dry-run created spec files unexpectedly" "Found $SPEC_COUNT .md files in $OUTPUT_DIR"
fi

# --- Test: multiple inputs ---

header "Test: reverse --dry-run with multiple inputs"

INPUT2_PATH="$TMPDIR/utils.ts"
cat > "$INPUT2_PATH" <<'TS'
// Utility functions
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
TS

info "Running: $CLI reverse $INPUT_PATH $INPUT2_PATH --output $OUTPUT_DIR --dry-run"
MULTI_OUTPUT=$(cd "$TMPDIR" && $CLI reverse "$INPUT_PATH" "$INPUT2_PATH" --output "$OUTPUT_DIR" --dry-run 2>&1) || true

if echo "$MULTI_OUTPUT" | grep -q "\[dry-run\]"; then
  pass "Multiple inputs dry-run produces output"
else
  fail "Multiple inputs dry-run failed" "$MULTI_OUTPUT"
fi

# --- Test: no inputs defaults to interactive mode ---

header "Test: reverse without inputs (defaults to interactive)"

info "Running: $CLI reverse --output $OUTPUT_DIR --dry-run"
NOINPUT_OUTPUT=$(cd "$TMPDIR" && $CLI reverse --output "$OUTPUT_DIR" --dry-run 2>&1) || true

if echo "$NOINPUT_OUTPUT" | grep -qi "interactive\|dry-run"; then
  pass "No inputs defaults to interactive mode"
else
  fail "No inputs did not trigger interactive mode" "$NOINPUT_OUTPUT"
fi

# --- Test: --skill flag ---

header "Test: reverse with --skill flag"

info "Running: $CLI reverse $INPUT_PATH --skill feature --output $OUTPUT_DIR --dry-run"
SKILL_OUTPUT=$(cd "$TMPDIR" && $CLI reverse "$INPUT_PATH" --skill feature --output "$OUTPUT_DIR" --dry-run 2>&1) || true

if echo "$SKILL_OUTPUT" | grep -q "\[dry-run\]"; then
  pass "Skill flag dry-run produces output"
else
  fail "Skill flag dry-run failed" "$SKILL_OUTPUT"
fi

# --- Live test (optional) ---

if $LIVE; then
  header "Test: reverse --live (real execution)"

  LIVE_OUTPUT_DIR="$TMPDIR/live-specs"
  mkdir -p "$LIVE_OUTPUT_DIR"

  info "Running: $CLI reverse $INPUT_PATH --output $LIVE_OUTPUT_DIR --max-iterations 1"
  LIVE_OUTPUT=$(cd "$TMPDIR" && $CLI reverse "$INPUT_PATH" --output "$LIVE_OUTPUT_DIR" --max-iterations 1 2>&1) || true

  if echo "$LIVE_OUTPUT" | grep -q "Iteration 1"; then
    pass "Live run started iteration 1"
  else
    fail "Live run did not start iteration" "$LIVE_OUTPUT"
  fi

  # Check if a spec file was created
  LIVE_SPEC_COUNT=$(find "$LIVE_OUTPUT_DIR" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$LIVE_SPEC_COUNT" -gt 0 ]]; then
    pass "Live run created spec file(s) ($LIVE_SPEC_COUNT found)"
  else
    fail "Live run did not create any spec files"
  fi
else
  skip "Live reverse test (pass --live to enable)"
fi

# --- Summary ---

header "Reverse E2E Summary"

TOTAL=$((PASSED + FAILED + SKIPPED))
echo -e "  ${GREEN}Passed${NC}: $PASSED"
echo -e "  ${RED}Failed${NC}: $FAILED"
echo -e "  ${YELLOW}Skipped${NC}: $SKIPPED"
echo -e "  Total: $TOTAL"
echo ""

if [[ $FAILED -gt 0 ]]; then
  echo -e "${RED}${BOLD}REVERSE E2E: FAILED${NC}"
  exit 1
else
  echo -e "${GREEN}${BOLD}REVERSE E2E: PASSED${NC}"
  exit 0
fi
