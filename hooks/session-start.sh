#!/usr/bin/env bash
set -euo pipefail

if [ -f ".ralph-tui/config.toml" ]; then
  cat <<'EOF'
{"additionalContext":"This project uses the super-ralph SDLC pipeline. Commands: /superralph:feature, /superralph:bug, /superralph:hotfix, /superralph:refactor, /superralph:plan, /superralph:resume, /superralph:status. Read .super-ralph/AGENTS.md for framework instructions."}
EOF
else
  cat <<'EOF'
{"additionalContext":"The super-ralph SDLC framework is available. Run /superralph:init or say \"initialize this project for super-ralph\" to set up this project."}
EOF
fi
