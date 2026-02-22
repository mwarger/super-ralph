---
description: "Apply an urgent minimal fix through the super-ralph pipeline"
---

## Pipeline: Hotfix

1. Run `ralph-tui doctor` to verify the project is ready. If it fails, tell the user to run `/superralph:init` first.

2. Run `ralph-tui run --skill hotfix-prd --tracker beads-bv`.

3. The skill handles everything: minimal intake (1-3 questions), PRD (1-3 stories), beads, and launch offer. No design doc, no ceremony.

If the user provided a hotfix description after the command, pass it as context to the skill session.
