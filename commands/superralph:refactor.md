---
description: "Restructure existing code through the super-ralph pipeline"
---

## Pipeline: Refactor

1. Run `ralph-tui doctor` to verify the project is ready. If it fails, tell the user to run `/superralph:init` first.

2. Run `ralph-tui run --skill refactor-prd --tracker beads-bv`.

3. The skill handles everything: architecture-focused intake, design doc (with current/target state), PRD, beads, and launch offer.

If the user provided a refactoring description after the command, pass it as context to the skill session.
