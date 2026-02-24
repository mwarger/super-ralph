---
description: "Fix a bug through the super-ralph pipeline"
---

## Pipeline: Bug Fix

1. Verify the project is initialized: check that `.super-ralph/AGENTS.md` exists.
   If not, tell the user to run `/super-ralph:init` first.

2. Load and follow the skill at `skills/bug-prd/SKILL.md` exactly.

3. If the user provided a description after the command, use it as the initial context
   for the intake phase.
