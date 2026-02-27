#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${SUPER_RALPH_HOME:-$HOME/.super-ralph-cli}"
CLI_NAME="super-ralph"

log() {
  printf '[super-ralph uninstall] %s\n' "$1"
}

fail() {
  printf '[super-ralph uninstall] ERROR: %s\n' "$1" >&2
  exit 1
}

pick_candidates() {
  local candidates=()

  if [[ -n "${SUPER_RALPH_BIN_DIR:-}" ]]; then
    candidates+=("$SUPER_RALPH_BIN_DIR")
  fi

  candidates+=("/usr/local/bin" "/opt/homebrew/bin" "$HOME/.local/bin" "$HOME/bin")
  printf '%s\n' "${candidates[@]}"
}

remove_wrapper() {
  local removed=0
  local candidate

  while IFS= read -r candidate; do
    [[ -n "$candidate" ]] || continue
    local target="$candidate/$CLI_NAME"
    if [[ ! -f "$target" ]]; then
      continue
    fi

    if grep -q "$INSTALL_DIR/src/index.ts" "$target" 2>/dev/null; then
      rm -f "$target"
      log "removed wrapper: $target"
      removed=1
    fi
  done < <(pick_candidates)

  if [[ "$removed" -eq 0 ]]; then
    log "no managed wrapper found in common bin directories"
  fi
}

remove_install_dir() {
  case "$INSTALL_DIR" in
    ""|"/"|"$HOME")
      fail "refusing to remove unsafe path: $INSTALL_DIR"
      ;;
  esac

  if [[ -d "$INSTALL_DIR" ]]; then
    rm -rf "$INSTALL_DIR"
    log "removed install directory: $INSTALL_DIR"
  else
    log "install directory not found: $INSTALL_DIR"
  fi
}

main() {
  log "starting uninstall"
  remove_wrapper
  remove_install_dir
  log "done"
  log "if you added a manual shell alias, remove it from your shell profile"
}

main "$@"
