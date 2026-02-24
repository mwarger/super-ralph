---
description: "Resume an interrupted super-ralph execution loop"
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

6. Offer three options:
   a. **Run now**: Execute `bun run <cli_path> run --epic <epicId>` in a terminal
   b. **Copy to clipboard**: Copy the command for the user to run
   c. **Display command**: Show the full command with options

The recommended command format:
```
bun run <cli_path> run --epic <EPIC_ID> --max-iterations <remaining_beads * 2>
```
