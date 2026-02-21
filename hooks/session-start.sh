#!/usr/bin/env bash
set -euo pipefail

if [ -f ".ralph-tui/config.toml" ]; then
  cat <<'EOF'
{"additionalContext":"This project uses the super-ralph SDLC pipeline. Use the superpowers-intake skill for PRD generation and superpowers-create-beads for bead conversion. Read .super-ralph/AGENTS.md for framework instructions."}
EOF
else
  cat <<'EOF'
{"additionalContext":"The super-ralph SDLC framework is available. Run /super-ralph-init or say \"initialize this project for super-ralph\" to set up this project."}
EOF
fi
