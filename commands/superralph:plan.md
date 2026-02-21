---
description: "Plan a feature without executing — stops after the design doc"
---

Invoke the super-ralph:superpowers-intake skill with work_type = "plan".

The user's message after this command (if any) is the seed description. Use it as starting context.

Run the full intake and design doc process (same depth as /superralph:feature), but STOP after the design doc is saved. Do NOT proceed to PRD generation, bead creation, or launch.

Tell the user when done:
> "Design doc saved to docs/plans/YYYY-MM-DD-<feature>-design.md. Run `/superralph:feature` when you're ready to execute this plan."

Pipeline: full intake → design doc → STOP.
