#!/usr/bin/env bash
set -euo pipefail

# E2E test for the doctor command and preflight checks
# Tests broken symlink detection and --fix flag

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CLI="bun run $PROJECT_ROOT/src/index.ts"

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
BACKUP_DIR=""

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
  # Remove any test symlinks we created
  rm -f ~/.config/opencode/plugins/__test_broken_symlink__.js 2>/dev/null
  rm -f ~/.config/opencode/commands/__test_broken_symlink__.md 2>/dev/null
  info "Cleanup complete."
}

trap cleanup EXIT

# --- Prerequisites ---

header "Doctor E2E Test"

info "Checking prerequisites..."

if ! command -v bun &>/dev/null; then
  fail "bun not found"
  exit 1
fi
pass "bun found: $(bun --version)"

# --- Setup test fixtures ---

header "Setting up test fixtures"

# We need a project dir with .super-ralph for doctor to run
TMPDIR="$(mktemp -d)"
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

cp "$PROJECT_ROOT/.super-ralph/AGENTS.md" "$TMPDIR/.super-ralph/AGENTS.md" 2>/dev/null || \
  echo "# Test" > "$TMPDIR/.super-ralph/AGENTS.md"
cp "$PROJECT_ROOT/.super-ralph/forward.hbs" "$TMPDIR/.super-ralph/forward.hbs" 2>/dev/null || \
  echo "test" > "$TMPDIR/.super-ralph/forward.hbs"
cp "$PROJECT_ROOT/.super-ralph/decompose.hbs" "$TMPDIR/.super-ralph/decompose.hbs" 2>/dev/null || \
  echo "test" > "$TMPDIR/.super-ralph/decompose.hbs"
cp "$PROJECT_ROOT/.super-ralph/reverse.hbs" "$TMPDIR/.super-ralph/reverse.hbs" 2>/dev/null || \
  echo "test" > "$TMPDIR/.super-ralph/reverse.hbs"

# Initialize beads workspace
(cd "$TMPDIR" && br init 2>/dev/null) || true

pass "Created test project in $TMPDIR"

# --- Test: doctor detects broken plugin symlink ---

header "Test: doctor detects broken plugin symlinks"

# Create a broken symlink in the global plugins dir
mkdir -p ~/.config/opencode/plugins
ln -sf /nonexistent/path/__test_broken_symlink__.js ~/.config/opencode/plugins/__test_broken_symlink__.js

info "Created broken symlink: ~/.config/opencode/plugins/__test_broken_symlink__.js"

DOCTOR_OUTPUT=$(cd "$TMPDIR" && $CLI doctor 2>&1) || true

if echo "$DOCTOR_OUTPUT" | grep -qi "broken symlink"; then
  pass "Doctor detects broken symlinks"
else
  fail "Doctor did not detect broken symlink" "$DOCTOR_OUTPUT"
fi

if echo "$DOCTOR_OUTPUT" | grep -q "__test_broken_symlink__"; then
  pass "Doctor shows the broken symlink path"
else
  fail "Doctor did not show broken symlink path" "$DOCTOR_OUTPUT"
fi

# --- Test: doctor --fix removes broken symlinks ---

header "Test: doctor --fix removes broken symlinks"

# The broken symlink should still exist
if [[ -L ~/.config/opencode/plugins/__test_broken_symlink__.js ]]; then
  pass "Broken symlink still exists before --fix"
else
  fail "Broken symlink was already removed"
fi

FIX_OUTPUT=$(cd "$TMPDIR" && $CLI doctor --fix 2>&1) || true

if echo "$FIX_OUTPUT" | grep -qi "fixed\|removed"; then
  pass "Doctor --fix reports fixing symlinks"
else
  fail "Doctor --fix did not report fixing" "$FIX_OUTPUT"
fi

# Verify the symlink was actually removed
if [[ ! -L ~/.config/opencode/plugins/__test_broken_symlink__.js ]]; then
  pass "Broken symlink was removed by --fix"
else
  fail "Broken symlink still exists after --fix"
  rm -f ~/.config/opencode/plugins/__test_broken_symlink__.js
fi

# --- Test: doctor --fix with broken command symlink ---

header "Test: doctor --fix with broken command symlink"

mkdir -p ~/.config/opencode/commands
ln -sf /nonexistent/path/__test_broken_symlink__.md ~/.config/opencode/commands/__test_broken_symlink__.md

CMD_FIX_OUTPUT=$(cd "$TMPDIR" && $CLI doctor --fix 2>&1) || true

if [[ ! -L ~/.config/opencode/commands/__test_broken_symlink__.md ]]; then
  pass "Broken command symlink was removed by --fix"
else
  fail "Broken command symlink still exists after --fix"
  rm -f ~/.config/opencode/commands/__test_broken_symlink__.md
fi

# --- Test: doctor clean state ---

header "Test: doctor with no broken symlinks"

CLEAN_OUTPUT=$(cd "$TMPDIR" && $CLI doctor 2>&1) || true

if echo "$CLEAN_OUTPUT" | grep -qi "no broken symlinks"; then
  pass "Doctor reports no broken symlinks when clean"
else
  fail "Doctor did not report clean state" "$CLEAN_OUTPUT"
fi

# --- Cleanup temp dir ---

rm -rf "$TMPDIR"

# --- Summary ---

header "Doctor E2E Summary"

TOTAL=$((PASSED + FAILED + SKIPPED))
echo -e "  ${GREEN}Passed${NC}: $PASSED"
echo -e "  ${RED}Failed${NC}: $FAILED"
echo -e "  ${YELLOW}Skipped${NC}: $SKIPPED"
echo -e "  Total: $TOTAL"
echo ""

if [[ $FAILED -gt 0 ]]; then
  echo -e "${RED}${BOLD}DOCTOR E2E: FAILED${NC}"
  exit 1
else
  echo -e "${GREEN}${BOLD}DOCTOR E2E: PASSED${NC}"
  exit 0
fi
