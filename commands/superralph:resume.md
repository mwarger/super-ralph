---
description: "Resume an interrupted super-ralph epic"
---

This is an operational command — do NOT invoke the intake skill.

Steps:
1. Run `ralph-tui status --json` to check the current epic's progress.
2. Display a summary: how many beads total, how many completed, how many remaining, which bead is next.
3. If there's an active/interrupted session, offer to resume:

> "Epic **{epic_id}** has {completed}/{total} beads completed. {remaining} remaining. How would you like to resume?
>
> 1. **Resume headless** — I'll run `ralph-tui resume --headless` right here.
> 2. **Copy resume command to clipboard** — `ralph-tui resume` for TUI mode.
> 3. **Show command** — Display the resume command."

4. If no active session is found, tell the user and suggest checking `ralph-tui status` manually.
