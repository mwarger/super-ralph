---
name: super-ralph-init
description: Initialize the current project for the super-ralph SDLC framework. Use when setting up a new or existing project for the Superpowers + Ralph TUI pipeline.
---

# Super-Ralph Init

> Initialize the current project for the super-ralph SDLC framework by copying
> templates into place and wiring up the project's AGENTS.md.

**Announce at start:** "I'm using the super-ralph-init skill to initialize this project for the super-ralph SDLC framework."

---

## The Job

Set up the project directory with the super-ralph scaffolding:

1. `.ralph-tui/config.toml` — Ralph TUI configuration
2. `.super-ralph/AGENTS.md` — Agent instructions for the framework
3. `.super-ralph/prompt.hbs` — Custom prompt template for Ralph TUI iterations
4. `.super-ralph/intake-checklist.md` — Growing intake question checklist
5. `tasks/` — Directory for generated PRDs
6. Root `AGENTS.md` — Updated to reference `.super-ralph/AGENTS.md`

All templates come from `~/.agents/super-ralph/templates/`.

**Important:** Do NOT modify the templates during init. Copy them as-is. The user customizes after.

---

## Step 1: Check If Already Initialized

Check whether `.ralph-tui/config.toml` exists in the project root.

- **If it exists:** Ask the user:

  > "This project already has `.ralph-tui/config.toml`. Do you want to re-initialize (overwrite config and re-copy templates), or skip?"

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

## Step 3: Verify Ralph TUI Health

Run `ralph-tui doctor` and check the output.

- **If healthy:** Continue to Step 4.
- **If unhealthy:** Help the user resolve issues before proceeding. Common problems:
  - Agent CLI not installed or not in PATH
  - Authentication not configured for the agent's provider

Also run `ralph-tui template show` to verify the prompt template system works. If it fails with a template resolution error, this may be the known `beads-bv` template path bug. See the **Troubleshooting** section at the bottom of this skill for the workaround.

**Do not skip this step.** A broken ralph-tui install will silently fail during execution.

---

## Step 4: Select Agent

**Auto-detection:** Before asking, try to detect the current agent environment:

- If the `OPENCODE` environment variable is set, or you are running inside OpenCode: pre-select **opencode**
- If you are running inside Claude Code (check `CLAUDE_CODE` env var or self-identify as Claude Code): pre-select **claude**
- If the `CODEX_CLI` environment variable is set: pre-select **codex**
- If none detected: no pre-selection, ask the user

If auto-detected, confirm with the user:

> "Detected that you're running inside **{agent}**. Use this as the Ralph TUI agent? (yes / choose a different agent)"

If not detected (or user wants to choose), present the full menu:

> "Which agent will Ralph TUI use for iterations?
>
> 1. **claude** — Claude Code CLI
> 2. **opencode** — OpenCode CLI
> 3. **codex** — OpenAI Codex CLI
> 4. **gemini** — Google Gemini CLI
> 5. **droid** — Factory Droid CLI
> 6. **kiro** — AWS Kiro CLI"

Based on their selection, use these defaults:

| Agent | `agent` value | Default `model` value |
|-------|--------------|----------------------|
| claude | `claude` | `claude-sonnet-4-6` |
| opencode | `opencode` | `anthropic/claude-sonnet-4-6` |
| codex | `codex` | `5.3-codex` |
| gemini | `gemini` | `gemini-2.5-pro` |
| droid | `droid` | *(leave blank — user must configure)* |
| kiro | `kiro` | *(leave blank — user must configure)* |

After selecting the agent, ask if they want to override the default model:

> "The default model for **{agent}** is `{model}`. Use this, or specify a different model?"

If droid or kiro, this question becomes required since there's no default.

Store the selected agent and model for Step 5.

---

## Step 5: Create `.ralph-tui/config.toml`

1. Create the `.ralph-tui/` directory if it doesn't exist
2. Copy `~/.agents/super-ralph/templates/config.toml` to `.ralph-tui/config.toml`
3. **Edit the copied file** to set the correct `agent` and `model` values from Step 4:
   - Replace the `agent = "..."` line with the selected agent
   - Replace the `model = "..."` line under `[agentOptions]` with the selected model

If re-initializing (user said yes in Step 1), overwrite the existing file.

---

## Step 6: Create `.super-ralph/` Directory and Files

Create the `.super-ralph/` directory if it doesn't exist. Then copy each template file, **but only if the target does not already exist** — don't overwrite customizations.

| Source template | Destination | Skip if exists? |
|---|---|---|
| `~/.agents/super-ralph/templates/agents.md` | `.super-ralph/AGENTS.md` | Yes |
| `~/.agents/super-ralph/templates/prompt.hbs` | `.super-ralph/prompt.hbs` | Yes |
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

## Step 8: Update Project Root `AGENTS.md`

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

## Step 9: Report Results

Output a summary of everything that was done. Use this format:

```
## Super-Ralph Init Complete

### Agent Configuration
- Agent: {agent} | Model: {model}

### Files Created
- .ralph-tui/config.toml ← copied from template, configured for {agent}
- .super-ralph/AGENTS.md ← copied from template
- .super-ralph/prompt.hbs ← copied from template
- .super-ralph/intake-checklist.md ← copied from template
- tasks/ ← directory created

### Files Modified
- AGENTS.md ← appended super-ralph reference

### Files Skipped (already existed)
- (list any files that were skipped)

### Next Steps
1. Run the **superpowers-intake** skill to create your first PRD
2. Run the **super-ralph-create-beads** skill to convert the PRD to beads
3. Run `ralph-tui run --tracker beads-bv` to start autonomous execution
```

Adjust the lists based on what actually happened — only show sections that have entries.

---

## Idempotency Summary

| Resource | Behavior |
|---|---|
| `.ralph-tui/config.toml` | Ask before overwriting (Step 1 gate) |
| `.super-ralph/AGENTS.md` | Skip if exists (preserve customizations) |
| `.super-ralph/prompt.hbs` | Skip if exists (preserve customizations) |
| `.super-ralph/intake-checklist.md` | Skip if exists (preserve customizations) |
| `tasks/` | `mkdir -p` (inherently idempotent) |
| Root `AGENTS.md` reference line | Check before appending (don't duplicate) |

---

## Checklist

Before reporting completion:

- [ ] Checked for existing `.ralph-tui/config.toml` and asked user if re-initializing
- [ ] Verified templates exist at `~/.agents/super-ralph/templates/`
- [ ] Ran `ralph-tui doctor` and confirmed healthy (or resolved issues)
- [ ] Auto-detected or asked user which agent to use; confirmed default model (or accepted override)
- [ ] `.ralph-tui/config.toml` created with correct agent and model values (or confirmed overwrite)
- [ ] `.super-ralph/AGENTS.md` created or skipped (already exists)
- [ ] `.super-ralph/prompt.hbs` created or skipped (already exists)
- [ ] `.super-ralph/intake-checklist.md` created or skipped (already exists)
- [ ] `tasks/` directory exists
- [ ] Root `AGENTS.md` has reference to `.super-ralph/AGENTS.md` (not duplicated)
- [ ] Summary report output with agent configuration and all created/modified/skipped files listed

---

## Troubleshooting

### beads-bv template.hbs path resolution bug

**Symptom:** `ralph-tui template show` fails, or ralph-tui crashes during execution with a template not found error when using `--tracker beads-bv`.

**Root cause:** This is an upstream ralph-tui bug. The beads-bv tracker plugin resolves its built-in `template.hbs` from `__dirname`, which in bun's bundled output points to the dist root (`/dist/template.hbs`) instead of the plugin directory (`/dist/plugins/trackers/builtin/beads-bv/template.hbs`).

**Workaround:**

```bash
# Copy the template to where the path resolution expects it
cp "$(dirname $(which ralph-tui))/../lib/node_modules/ralph-tui/dist/plugins/trackers/builtin/beads-bv/template.hbs" \
   "$(dirname $(which ralph-tui))/../lib/node_modules/ralph-tui/dist/template.hbs" 2>/dev/null || true
```

If this workaround doesn't apply (e.g., different install method), check where ralph-tui is installed and manually copy `template.hbs` from the beads-bv plugin directory to the dist root.

This bug should be reported upstream to the ralph-tui project.
