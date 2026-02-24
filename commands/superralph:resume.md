---
description: "Resume an interrupted super-ralph three-phase loop engine"
---

## Resume Execution

This is an operational command — skip intake.

1. Read `cli_path` from `.super-ralph/config.toml` (the `[cli] path` field). If not set, error and tell the user to run `/superralph:init`.

2. Find active epics: run `br list --type epic --json` and filter for open epics.

3. If no open epics found, tell the user there's nothing to resume.

4. If multiple open epics, show them and ask which one to resume.

5. Show current progress for the selected epic:
   - Run `br show <epicId> --json` and get children from the `dependents` array (filter by `dependency_type === "parent-child"`)
   - Count beads by status (completed, open, in_progress)
   - Show the next ready bead (run `br ready --parent <epicId> --json --limit 1`)

6. Ask which phase to resume with:
   a. **Forward** (default): Execute beads in sequence — the main execution phase
   b. **Decompose**: Break down remaining beads into smaller sub-tasks
   c. **Reverse**: Verify and validate completed work against acceptance criteria

7. Offer three options:
   a. **Run now**: Execute the chosen phase command in a terminal
   b. **Copy to clipboard**: Copy the command for the user to run
   c. **Display command**: Show the full command with options

The recommended command formats:
```
bun run <cli_path> forward --epic <EPIC_ID> --max-iterations <remaining_beads * 2>
bun run <cli_path> decompose --epic <EPIC_ID> --max-iterations <remaining_beads * 2>
bun run <cli_path> reverse --epic <EPIC_ID> --max-iterations <remaining_beads * 2>
```
