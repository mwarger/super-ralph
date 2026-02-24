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
3. `.super-ralph/forward.hbs` — Prompt template for forward (execution) phase
4. `.super-ralph/decompose.hbs` — Prompt template for decompose (planning) phase
5. `.super-ralph/reverse.hbs` — Prompt template for reverse (verification) phase
6. `.super-ralph/intake-checklist.md` — Growing intake question checklist
7. `tasks/` — Directory for generated PRDs
8. `.opencode/plugins/super-ralph.js` — OpenCode plugin for super-ralph commands
9. Root `AGENTS.md` — Updated to reference `.super-ralph/AGENTS.md`

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

## Step 2: Validate Prerequisites

Check that required CLI tools are installed. Both are required for the super-ralph pipeline.

**Check `bun`:**

```bash
bun --version
```

- **If present:** Note the version and continue.
- **If missing:** Tell the user:

  > "`bun` is required but not found. Install it with:"
  > ```
  > curl -fsSL https://bun.sh/install | bash
  > ```
  > "Install now, or abort init?"

  If the user declines, **stop here**.
  If the user agrees, run the install command, then verify `bun --version` succeeds before continuing.

**Check `br` (beads-rust CLI):**

```bash
br --version
```

- **If present:** Note the version and continue.
- **If missing:** Tell the user:

  > "`br` (beads-rust) is required but not found. Install it with:"
  > ```
  > curl -fsSL "https://raw.githubusercontent.com/Dicklesworthstone/beads_rust/main/install.sh?$(date +%s)" | bash
  > ```
  > "Install now, or abort init?"

  If the user declines, **stop here**.
  If the user agrees, run the install command, then verify `br --version` succeeds before continuing.

**Both must be present to proceed.** If either is missing and the user declines to install, stop and report what's needed.

---

## Step 3: Locate Templates

Check that the global super-ralph install exists at `~/.agents/super-ralph/templates/`.

Verify these files are present:
- `~/.agents/super-ralph/templates/super-ralph-config.toml`
- `~/.agents/super-ralph/templates/agents.md`
- `~/.agents/super-ralph/templates/forward.hbs`
- `~/.agents/super-ralph/templates/decompose.hbs`
- `~/.agents/super-ralph/templates/reverse.hbs`
- `~/.agents/super-ralph/templates/intake-checklist.md`

**If the directory or any template is missing:** Stop and tell the user:

> "Super-ralph templates not found at `~/.agents/super-ralph/templates/`. Please install super-ralph first. See the super-ralph README for installation instructions."

Do NOT proceed without the templates.

---

## Step 4: Select Model

**Auto-detection:** Detect the current agent environment:

- If running inside OpenCode (check `OPENCODE` env var): pre-select **opencode** with model `anthropic/claude-sonnet-4-6`
- If running inside Claude Code (check `CLAUDE_CODE` env var or self-identify as Claude Code): pre-select **claude** with model `anthropic/claude-sonnet-4-6`
- If neither detected: default to **opencode** with model `anthropic/claude-sonnet-4-6`

Confirm with the user:

> "Detected **{agent}** environment. Default model: `{model}`. Use this, or specify a different model?"

Store the selected model for Step 5.

---

## Step 5: Create `.super-ralph/config.toml`

1. Create the `.super-ralph/` directory if it doesn't exist
2. Copy `~/.agents/super-ralph/templates/super-ralph-config.toml` to `.super-ralph/config.toml`
3. **Edit the copied file** to set the correct model value from Step 4:
   - Replace the `model = "..."` line under `[models]` with the selected model
4. **Detect and record `cli_path`:**
   - Resolve `~/.agents/super-ralph/src/index.ts` to an absolute path (e.g. `/Users/mat/.agents/super-ralph/src/index.ts`)
   - Verify the file exists at that path
   - Confirm with the user:
     > "Detected super-ralph CLI at `{resolved_path}`. Use this path, or specify a different one?"
   - If the user provides a different path, use that instead (verify it exists)
   - **Add a `[cli]` section** to the config file:
     ```toml
     [cli]
     path = "/Users/mat/.agents/super-ralph/src/index.ts"
     ```

If re-initializing (user said yes in Step 1), overwrite the existing file.

---

## Step 6: Create `.super-ralph/` Agent Files

Copy each template file, **but only if the target does not already exist** — don't overwrite customizations.

| Source template | Destination | Skip if exists? |
|---|---|---|
| `~/.agents/super-ralph/templates/agents.md` | `.super-ralph/AGENTS.md` | Yes |
| `~/.agents/super-ralph/templates/forward.hbs` | `.super-ralph/forward.hbs` | Yes |
| `~/.agents/super-ralph/templates/decompose.hbs` | `.super-ralph/decompose.hbs` | Yes |
| `~/.agents/super-ralph/templates/reverse.hbs` | `.super-ralph/reverse.hbs` | Yes |
| `~/.agents/super-ralph/templates/intake-checklist.md` | `.super-ralph/intake-checklist.md` | Yes |

For each file:
- If the destination already exists, **skip it** and note that it was skipped (preserving customizations)
- If the destination does not exist, copy the template into place

---

## Step 7: Create `tasks/` Directory

Create the `tasks/` directory if it doesn't exist. This is where generated PRDs will be saved.

```bash
mkdir -p tasks
```

This is inherently idempotent — if it already exists, nothing happens.

---

## Step 8: Copy Plugin File

The `doctor` command checks for `.opencode/plugins/super-ralph.js`. Copy it from the super-ralph installation.

1. Create `.opencode/plugins/` if it doesn't exist:

   ```bash
   mkdir -p .opencode/plugins
   ```

2. Copy the plugin file:

   ```bash
   cp ~/.agents/super-ralph/.opencode/plugins/super-ralph.js .opencode/plugins/super-ralph.js
   ```

- **If the destination already exists:** Skip it and note that it was preserved.
- **If the source does not exist:** Warn the user that the plugin file was not found at `~/.agents/super-ralph/.opencode/plugins/super-ralph.js` and they may need to copy it manually.

---

## Step 9: Initialize Beads Workspace

Check whether `.beads/` exists in the project root.

- **If `.beads/` already exists:** Skip this step. Note that the beads workspace was already initialized.
- **If `.beads/` does not exist:** Run:

  ```bash
  br init
  ```

  This creates the `.beads/` directory with the beads-rust workspace structure. Verify the command succeeds and `.beads/` exists afterward.

  If `br init` fails, report the error but continue with the rest of init — the user can run `br init` manually later.

---

## Step 10: Update Project Root `AGENTS.md`

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

## Step 11: Report Results

Output a summary of everything that was done. Use this format:

```
## Super-Ralph Init Complete

### Prerequisites
- bun: {bun_version}
- br: {br_version}

### Model Configuration
- Model: {model}
- CLI path: {cli_path}

### Files Created
- .super-ralph/config.toml ← copied from template, configured with model and cli_path
- .super-ralph/AGENTS.md ← copied from template
- .super-ralph/forward.hbs ← copied from template
- .super-ralph/decompose.hbs ← copied from template
- .super-ralph/reverse.hbs ← copied from template
- .super-ralph/intake-checklist.md ← copied from template
- tasks/ ← directory created
- .opencode/plugins/super-ralph.js ← copied from super-ralph install

### Beads Workspace
- .beads/ ← {initialized | already existed | failed (run `br init` manually)}

### Files Modified
- AGENTS.md ← appended super-ralph reference

### Files Skipped (already existed)
- (list any files that were skipped)

### Next Steps
1. Run `/super-ralph:feature` (or `:bug`, `:hotfix`, `:refactor`) to start the pipeline
2. The skill handles intake, PRD, beads, and launch in one session
3. Or run `/super-ralph:plan` to plan without executing
```

Adjust the lists based on what actually happened — only show sections that have entries.

---

## Idempotency Summary

| Resource | Behavior |
|---|---|
| `bun` | Check version; offer install if missing (Step 2) |
| `br` | Check version; offer install if missing (Step 2) |
| `.super-ralph/config.toml` | Ask before overwriting (Step 1 gate) |
| `.super-ralph/config.toml` `[cli] path` | Detect, confirm with user, write to config (Step 5) |
| `.super-ralph/AGENTS.md` | Skip if exists (preserve customizations) |
| `.super-ralph/forward.hbs` | Skip if exists (preserve customizations) |
| `.super-ralph/decompose.hbs` | Skip if exists (preserve customizations) |
| `.super-ralph/reverse.hbs` | Skip if exists (preserve customizations) |
| `.super-ralph/intake-checklist.md` | Skip if exists (preserve customizations) |
| `tasks/` | `mkdir -p` (inherently idempotent) |
| `.opencode/plugins/super-ralph.js` | Skip if exists (preserve customizations) (Step 8) |
| `.beads/` | Run `br init` only if missing (Step 9) |
| Root `AGENTS.md` reference line | Check before appending (don't duplicate) |

---

## Checklist

Before reporting completion:

- [ ] Checked for existing `.super-ralph/AGENTS.md` and asked user if re-initializing
- [ ] Validated `bun` is installed (or installed it)
- [ ] Validated `br` is installed (or installed it)
- [ ] Verified templates exist at `~/.agents/super-ralph/templates/`
- [ ] Detected environment and confirmed model selection with user
- [ ] `cli_path` detected and confirmed with user
- [ ] `.super-ralph/config.toml` created with correct model value and `[cli] path` (or confirmed overwrite)
- [ ] `.super-ralph/AGENTS.md` created or skipped (already exists)
- [ ] `.super-ralph/forward.hbs` created or skipped (already exists)
- [ ] `.super-ralph/decompose.hbs` created or skipped (already exists)
- [ ] `.super-ralph/reverse.hbs` created or skipped (already exists)
- [ ] `.super-ralph/intake-checklist.md` created or skipped (already exists)
- [ ] `tasks/` directory exists
- [ ] `.opencode/plugins/super-ralph.js` created or skipped (already exists)
- [ ] `.beads/` workspace initialized (or already existed)
- [ ] Root `AGENTS.md` has reference to `.super-ralph/AGENTS.md` (not duplicated)
- [ ] Summary report output with prerequisites, model configuration, cli_path, beads status, and all created/modified/skipped files listed
