---
description: "Check progress on the current super-ralph epic"
---

This is an operational command — do NOT invoke the intake skill.

Steps:
1. Run `ralph-tui status --json` to get the current state.
2. Format the output as a readable summary:
   - Epic name and ID
   - Total beads / completed / in-progress / remaining
   - Current phase (schema, backend, ui, integration, review, audit, learn)
   - Next bead to be executed
   - Any failed beads
3. If there are failed beads, suggest running `bd reopen <id>` for each one.
4. If all beads are completed, congratulate the user and suggest running the audit review.
