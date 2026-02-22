---
description: "Start building a new feature through the super-ralph pipeline"
---

## Pipeline: Feature

1. Run `ralph-tui doctor` to verify the project is ready. If it fails, tell the user to run `/superralph:init` first.

2. Run `ralph-tui run --skill feature-prd --tracker beads-bv`.

3. The skill handles everything: intake, design doc, PRD, beads, and launch offer.

If the user provided a description after the command, pass it as context to the skill session.
