#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${SUPER_RALPH_REPO_URL:-https://github.com/mwarger/super-ralph.git}"
INSTALL_DIR="${SUPER_RALPH_HOME:-$HOME/.super-ralph-cli}"
CLI_NAME="super-ralph"

log() {
  printf '[super-ralph install] %s\n' "$1"
}

fail() {
  printf '[super-ralph install] ERROR: %s\n' "$1" >&2
  exit 1
}

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

ensure_prereqs() {
  has_cmd git || fail "git is required but was not found"
  has_cmd curl || fail "curl is required but was not found"

  if ! has_cmd bun; then
    log "bun not found; installing bun"
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
  fi

  if ! has_cmd br; then
    log "br not found; installing beads_rust"
    curl -fsSL "https://raw.githubusercontent.com/Dicklesworthstone/beads_rust/main/install.sh?$(date +%s)" | bash
  fi

  has_cmd bun || fail "bun installation failed"
  has_cmd br || fail "br installation failed"
}

ensure_repo() {
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    log "updating existing install at $INSTALL_DIR"
    git -C "$INSTALL_DIR" pull --ff-only
  elif [[ -e "$INSTALL_DIR" ]]; then
    fail "$INSTALL_DIR exists but is not a git checkout"
  else
    log "cloning super-ralph into $INSTALL_DIR"
    git clone "$REPO_URL" "$INSTALL_DIR"
  fi
}

install_deps() {
  log "installing bun dependencies"
  (cd "$INSTALL_DIR" && bun install --silent)
}

pick_bin_dir() {
  local candidates=()

  if [[ -n "${SUPER_RALPH_BIN_DIR:-}" ]]; then
    candidates+=("$SUPER_RALPH_BIN_DIR")
  fi

  candidates+=("/usr/local/bin" "/opt/homebrew/bin" "$HOME/.local/bin" "$HOME/bin")

  local candidate
  for candidate in "${candidates[@]}"; do
    [[ -n "$candidate" ]] || continue

    if [[ ! -d "$candidate" ]]; then
      mkdir -p "$candidate" 2>/dev/null || continue
    fi

    if [[ -w "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  fail "could not find a writable bin directory"
}

install_wrapper() {
  local bin_dir="$1"
  local target="$bin_dir/$CLI_NAME"

  log "installing wrapper at $target"
  cat > "$target" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec bun run "$INSTALL_DIR/src/index.ts" "\$@"
EOF
  chmod +x "$target"

  if [[ ":$PATH:" != *":$bin_dir:"* ]]; then
    log "install complete, but $bin_dir is not on PATH"
    log "add this to your shell profile: export PATH=\"$bin_dir:\$PATH\""
  fi

  "$target" help >/dev/null
}

main() {
  log "starting install"
  ensure_prereqs
  ensure_repo
  install_deps

  local bin_dir
  bin_dir="$(pick_bin_dir)"
  install_wrapper "$bin_dir"

  log "done"
  log "run '$CLI_NAME init' in any project to get started"
}

main "$@"
