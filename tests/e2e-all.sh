#!/usr/bin/env bash
set -euo pipefail

# E2E test runner — runs all three phase tests
# Usage:
#   ./tests/e2e-all.sh           # dry-run only (no OpenCode server needed)
#   ./tests/e2e-all.sh --live    # live run (requires OpenCode server)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Forward args to individual scripts
ARGS=("$@")
LIVE=false

for arg in "$@"; do
  case "$arg" in
    --live) LIVE=true ;;
  esac
done

echo -e "${BOLD}╔════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   super-ralph E2E Test Suite               ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════════╝${NC}"
echo ""

if $LIVE; then
  echo -e "${YELLOW}Mode: LIVE (requires OpenCode server)${NC}"
else
  echo -e "${CYAN}Mode: DRY-RUN (no server needed)${NC}"
fi
echo ""

SUITE_PASSED=0
SUITE_FAILED=0
SUITE_START=$(date +%s)

run_test() {
  local name="$1"
  local script="$2"

  echo -e "${BOLD}────────────────────────────────────────────${NC}"
  echo -e "${BOLD}Running: $name${NC}"
  echo -e "${BOLD}────────────────────────────────────────────${NC}"

  if bash "$script" "${ARGS[@]}"; then
    SUITE_PASSED=$((SUITE_PASSED + 1))
    echo ""
  else
    SUITE_FAILED=$((SUITE_FAILED + 1))
    echo ""
  fi
}

# Run each test suite
run_test "Doctor / Preflight" "$SCRIPT_DIR/e2e-doctor.sh"
run_test "Forward Phase"      "$SCRIPT_DIR/e2e-forward.sh"
run_test "Decompose Phase"    "$SCRIPT_DIR/e2e-decompose.sh"
run_test "Reverse Phase"      "$SCRIPT_DIR/e2e-reverse.sh"

# Live integration test (only when --live is passed)
if $LIVE; then
  run_test "Live Integration Pipeline" "$SCRIPT_DIR/e2e-live.sh"
fi

# --- Suite Summary ---

SUITE_END=$(date +%s)
SUITE_DURATION=$((SUITE_END - SUITE_START))
SUITE_TOTAL=$((SUITE_PASSED + SUITE_FAILED))

echo ""
echo -e "${BOLD}╔════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   E2E Suite Summary                        ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Phase suites run: $SUITE_TOTAL"
echo -e "  ${GREEN}Passed${NC}: $SUITE_PASSED"
echo -e "  ${RED}Failed${NC}: $SUITE_FAILED"
echo -e "  Duration: ${SUITE_DURATION}s"
echo ""

if [[ $SUITE_FAILED -gt 0 ]]; then
  echo -e "${RED}${BOLD}E2E SUITE: FAILED ($SUITE_FAILED/$SUITE_TOTAL suites failed)${NC}"
  exit 1
else
  echo -e "${GREEN}${BOLD}E2E SUITE: ALL PASSED ($SUITE_PASSED/$SUITE_TOTAL suites)${NC}"
  exit 0
fi
