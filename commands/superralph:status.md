---
description: "Check the status of the current super-ralph execution"
---

## Epic Status

This is an operational command — skip intake.

1. Find all epics: run `br list --type epic --json`.

2. If no epics found, tell the user no work has been created yet.

3. For each open epic:
   - Run `br list --parent <epicId> --json`
   - Count beads by status: completed, open, in_progress, blocked
   - Identify the current phase by checking labels on in-progress/open beads
   - Show the next ready bead

4. Format a summary:
   - Epic: [title] (ID)
   - Progress: X/Y beads complete
   - Current phase: [phase label]
   - Next bead: [title] (ID)
   - Blocked beads: [list with IDs, suggest `br reopen <id>` for stuck beads]

5. If all beads are complete, congratulate the user and suggest reviewing the work.
