---
description: "Plan a feature without executing — stops after the design doc"
---

## Pipeline: Plan Only

1. Run `ralph-tui doctor` to verify the project is ready. If it fails, tell the user to run `/superralph:init` first.

2. Run `ralph-tui run --skill plan-prd --tracker beads-bv`.

3. The skill handles the full intake and design doc process (same depth as `/superralph:feature`), but stops after saving the design doc. No PRD, no beads, no execution.

If the user provided a description after the command, pass it as context to the skill session.

When done, the skill tells the user to run `/superralph:feature` to execute the plan.
