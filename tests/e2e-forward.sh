#!/usr/bin/env bash
set -euo pipefail

# E2E test for the forward phase (beads -> code)
# Usage:
#   ./tests/e2e-forward.sh           # dry-run only (no OpenCode server needed)
#   ./tests/e2e-forward.sh --live    # live run (requires OpenCode server)

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
EPIC_ID=""

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
  if [[ -n "$EPIC_ID" && "$EPIC_ID" != "dry-run-epic" ]]; then
    # Delete the test epic and its children
    br delete "$EPIC_ID" --cascade 2>/dev/null || true
  fi
  if [[ -n "$TMPDIR" && -d "$TMPDIR" ]]; then
    rm -rf "$TMPDIR"
  fi
  info "Cleanup complete."
}

trap cleanup EXIT

# --- Prerequisites ---

header "Forward Phase E2E Test"

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

# Copy template from project (forward needs forward.hbs)
cp "$PROJECT_ROOT/.super-ralph/forward.hbs" "$TMPDIR/.super-ralph/forward.hbs"

# Minimal AGENTS.md
cat > "$TMPDIR/.super-ralph/AGENTS.md" <<'MD'
# Test Project Agent Instructions
This is a test project for E2E testing.
MD

# Also create a minimal AGENTS.md at root (the forward template tells agents to read it)
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

# Create test epic with child beads
info "Creating test epic and beads..."
EPIC_JSON=$(cd "$TMPDIR" && br create --type epic --title "E2E Test Epic: Forward" --json 2>&1)
EPIC_ID=$(echo "$EPIC_JSON" | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

if [[ -z "$EPIC_ID" ]]; then
  fail "Failed to create test epic" "$EPIC_JSON"
  exit 1
fi
pass "Created epic: $EPIC_ID"

# Create two simple child beads
BEAD1_JSON=$(cd "$TMPDIR" && br create --parent "$EPIC_ID" --title "US-001: Create hello.txt" --description "Create a file called hello.txt with the contents 'Hello, world!'" --json 2>&1)
BEAD1_ID=$(echo "$BEAD1_JSON" | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

BEAD2_JSON=$(cd "$TMPDIR" && br create --parent "$EPIC_ID" --title "US-002: Create goodbye.txt" --description "Create a file called goodbye.txt with the contents 'Goodbye, world!'" --json 2>&1)
BEAD2_ID=$(echo "$BEAD2_JSON" | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

if [[ -n "$BEAD1_ID" && -n "$BEAD2_ID" ]]; then
  pass "Created child beads: $BEAD1_ID, $BEAD2_ID"
else
  fail "Failed to create child beads" "bead1=$BEAD1_ID bead2=$BEAD2_ID"
  exit 1
fi

# --- Dry-run test ---

header "Test: forward --dry-run"

info "Running: $CLI forward --epic $EPIC_ID --dry-run"
DRY_OUTPUT=$(cd "$TMPDIR" && $CLI forward --epic "$EPIC_ID" --dry-run 2>&1) || true

# Verify dry-run output mentions the epic and iterations
if echo "$DRY_OUTPUT" | grep -q "\[dry-run\]"; then
  pass "Dry-run output contains [dry-run] marker"
else
  fail "Dry-run output missing [dry-run] marker" "$DRY_OUTPUT"
fi

if echo "$DRY_OUTPUT" | grep -qi "forward"; then
  pass "Dry-run output references forward loop"
else
  fail "Dry-run output missing forward reference" "$DRY_OUTPUT"
fi

if echo "$DRY_OUTPUT" | grep -q "$EPIC_ID"; then
  pass "Dry-run output references epic ID"
else
  fail "Dry-run output missing epic ID" "$DRY_OUTPUT"
fi

if echo "$DRY_OUTPUT" | grep -qi "iteration"; then
  pass "Dry-run output mentions iterations"
else
  fail "Dry-run output missing iteration info" "$DRY_OUTPUT"
fi

# --- Live test (optional) ---

if $LIVE; then
  header "Test: forward --live (real execution)"

  info "Running: $CLI forward --epic $EPIC_ID --max-iterations 1"
  LIVE_OUTPUT=$(cd "$TMPDIR" && $CLI forward --epic "$EPIC_ID" --max-iterations 1 2>&1) || true

  if echo "$LIVE_OUTPUT" | grep -q "Iteration 1"; then
    pass "Live run started iteration 1"
  else
    fail "Live run did not start iteration" "$LIVE_OUTPUT"
  fi

  if echo "$LIVE_OUTPUT" | grep -q "Phase Complete"; then
    pass "Live run completed phase"
  else
    fail "Live run did not complete phase" "$LIVE_OUTPUT"
  fi
else
  skip "Live forward test (pass --live to enable)"
fi

# --- Summary ---

header "Forward E2E Summary"

TOTAL=$((PASSED + FAILED + SKIPPED))
echo -e "  ${GREEN}Passed${NC}: $PASSED"
echo -e "  ${RED}Failed${NC}: $FAILED"
echo -e "  ${YELLOW}Skipped${NC}: $SKIPPED"
echo -e "  Total: $TOTAL"
echo ""

if [[ $FAILED -gt 0 ]]; then
  echo -e "${RED}${BOLD}FORWARD E2E: FAILED${NC}"
  exit 1
else
  echo -e "${GREEN}${BOLD}FORWARD E2E: PASSED${NC}"
  exit 0
fi
