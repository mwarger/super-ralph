---
description: "Fix a bug through the super-ralph pipeline with focused intake"
---

## Pipeline: Bug Fix

1. Run `ralph-tui doctor` to verify the project is ready. If it fails, tell the user to run `/superralph:init` first.

2. Run `ralph-tui run --skill bug-prd --tracker beads-bv`.

3. The skill handles everything: focused intake, PRD, beads, and launch offer. No design doc for bugs.

If the user provided a bug description after the command, pass it as context to the skill session.
