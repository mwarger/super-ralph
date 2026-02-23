---
name: super-ralph-init
description: Initialize the current project for the super-ralph SDLC framework. Use when setting up a new or existing project for the super-ralph pipeline.
---

# Super-Ralph Init

> Initialize the current project for the super-ralph SDLC framework by copying
> templates into place and wiring up the project's AGENTS.md.

**Announce at start:** "I'm using the super-ralph-init skill to initialize this project for the super-ralph SDLC framework."

---

## The Job

Set up the project directory with the super-ralph scaffolding:

1. `.super-ralph/config.toml` — Super-ralph configuration
2. `.super-ralph/AGENTS.md` — Agent instructions for the framework
3. `.super-ralph/prompt.hbs` — Custom prompt template for super-ralph iterations
4. `.super-ralph/intake-checklist.md` — Growing intake question checklist
5. `tasks/` — Directory for generated PRDs
6. Root `AGENTS.md` — Updated to reference `.super-ralph/AGENTS.md`

All templates come from `~/.agents/super-ralph/templates/`.

**Important:** Do NOT modify the templates during init. Copy them as-is. The user customizes after.

---

## Step 1: Check If Already Initialized

Check whether `.super-ralph/AGENTS.md` exists in the project root.

- **If it exists:** Ask the user:

  > "This project already has `.super-ralph/AGENTS.md`. Do you want to re-initialize (overwrite config and re-copy templates), or skip?"

  If they say skip, **stop here**. Report that the project is already initialized and exit.

  If they say re-initialize, continue — but still respect the per-file idempotency rules in subsequent steps.

- **If it does not exist:** Continue to Step 2.

---

## Step 2: Locate Templates

Check that the global super-ralph install exists at `~/.agents/super-ralph/templates/`.

Verify these files are present:
- `~/.agents/super-ralph/templates/config.toml`
- `~/.agents/super-ralph/templates/agents.md`
- `~/.agents/super-ralph/templates/prompt.hbs`
- `~/.agents/super-ralph/templates/intake-checklist.md`

**If the directory or any template is missing:** Stop and tell the user:

> "Super-ralph templates not found at `~/.agents/super-ralph/templates/`. Please install super-ralph first. See the super-ralph README for installation instructions."

Do NOT proceed without the templates.

---

## Step 3: Select Model

**Auto-detection:** Detect the current agent environment:

- If running inside OpenCode (check `OPENCODE` env var): pre-select **opencode** with model `anthropic/claude-sonnet-4-6`
- If running inside Claude Code (check `CLAUDE_CODE` env var or self-identify as Claude Code): pre-select **claude** with model `claude-sonnet-4-6`
- If neither detected: default to **opencode** with model `anthropic/claude-sonnet-4-6`

Confirm with the user:

> "Detected **{agent}** environment. Default model: `{model}`. Use this, or specify a different model?"

Store the selected model for Step 4.

---

## Step 4: Create `.super-ralph/config.toml`

1. Create the `.super-ralph/` directory if it doesn't exist
2. Copy `~/.agents/super-ralph/templates/config.toml` to `.super-ralph/config.toml`
3. **Edit the copied file** to set the correct model value from Step 3:
   - Replace the `model = "..."` line under `[agentOptions]` with the selected model

If re-initializing (user said yes in Step 1), overwrite the existing file.

---

## Step 5: Create `.super-ralph/` Agent Files

Copy each template file, **but only if the target does not already exist** — don't overwrite customizations.

| Source template | Destination | Skip if exists? |
|---|---|---|
| `~/.agents/super-ralph/templates/agents.md` | `.super-ralph/AGENTS.md` | Yes |
| `~/.agents/super-ralph/templates/prompt.hbs` | `.super-ralph/prompt.hbs` | Yes |
| `~/.agents/super-ralph/templates/intake-checklist.md` | `.super-ralph/intake-checklist.md` | Yes |

For each file:
- If the destination already exists, **skip it** and note that it was skipped (preserving customizations)
- If the destination does not exist, copy the template into place

---

## Step 6: Create `tasks/` Directory

Create the `tasks/` directory if it doesn't exist. This is where generated PRDs will be saved.

```bash
mkdir -p tasks
```

This is inherently idempotent — if it already exists, nothing happens.

---

## Step 7: Update Project Root `AGENTS.md`

The reference line to add is:

```
Also read .super-ralph/AGENTS.md for SDLC framework instructions.
```

**Case A — `AGENTS.md` exists in the project root:**

1. Read the file
2. Check if it already contains the reference line (search for `.super-ralph/AGENTS.md`)
3. If the reference is already present, **skip** — don't duplicate it
4. If the reference is NOT present, **append** this to the end of the file:

```

Also read .super-ralph/AGENTS.md for SDLC framework instructions.
```

(Note the leading blank line for separation.)

**Case B — No `AGENTS.md` in the project root:**

Create a minimal `AGENTS.md` with this content:

```markdown
# Agent Instructions

Also read .super-ralph/AGENTS.md for SDLC framework instructions.
```

---

## Step 8: Report Results

Output a summary of everything that was done. Use this format:

```
## Super-Ralph Init Complete

### Model Configuration
- Model: {model}

### Files Created
- .super-ralph/config.toml ← copied from template, configured with model
- .super-ralph/AGENTS.md ← copied from template
- .super-ralph/prompt.hbs ← copied from template
- .super-ralph/intake-checklist.md ← copied from template
- tasks/ ← directory created

### Files Modified
- AGENTS.md ← appended super-ralph reference

### Files Skipped (already existed)
- (list any files that were skipped)

### Next Steps
1. Run `/superralph:feature` (or `:bug`, `:hotfix`, `:refactor`) to start the pipeline
2. The skill handles intake, PRD, beads, and launch in one session
3. Or run `/superralph:plan` to plan without executing
```

Adjust the lists based on what actually happened — only show sections that have entries.

---

## Idempotency Summary

| Resource | Behavior |
|---|---|
| `.super-ralph/config.toml` | Ask before overwriting (Step 1 gate) |
| `.super-ralph/AGENTS.md` | Skip if exists (preserve customizations) |
| `.super-ralph/prompt.hbs` | Skip if exists (preserve customizations) |
| `.super-ralph/intake-checklist.md` | Skip if exists (preserve customizations) |
| `tasks/` | `mkdir -p` (inherently idempotent) |
| Root `AGENTS.md` reference line | Check before appending (don't duplicate) |

---

## Checklist

Before reporting completion:

- [ ] Checked for existing `.super-ralph/AGENTS.md` and asked user if re-initializing
- [ ] Verified templates exist at `~/.agents/super-ralph/templates/`
- [ ] Detected environment and confirmed model selection with user
- [ ] `.super-ralph/config.toml` created with correct model value (or confirmed overwrite)
- [ ] `.super-ralph/AGENTS.md` created or skipped (already exists)
- [ ] `.super-ralph/prompt.hbs` created or skipped (already exists)
- [ ] `.super-ralph/intake-checklist.md` created or skipped (already exists)
- [ ] `tasks/` directory exists
- [ ] Root `AGENTS.md` has reference to `.super-ralph/AGENTS.md` (not duplicated)
- [ ] Summary report output with model configuration and all created/modified/skipped files listed
