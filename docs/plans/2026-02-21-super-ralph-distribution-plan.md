# Super-Ralph Distribution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the agent-framework repo into the super-ralph distribution layout with global install support, per-project init skill, platform-specific plugins, and slash command.

**Architecture:** Move existing skills and project-local files into the new repo structure (skills/ stays, project-local files move to templates/). Create new artifacts: init skill, slash command, platform plugins (Claude Code hooks, OpenCode JS plugin, Codex install doc), and universal INSTALL.md.

**Tech Stack:** Markdown (SKILL.md files), Handlebars (prompt template), TOML (config), Shell (hooks), JavaScript (OpenCode plugin)

---

### Task 1: Restructure — Move Project-Local Files to templates/

**Files:**
- Create: `templates/` directory
- Move: `.ralph-tui-prompt.hbs` → `templates/prompt.hbs`
- Move: `AGENTS.md` → `templates/agents.md`
- Move: `.ralph-tui/config.toml` → `templates/config.toml`
- Move: `docs/intake-checklist.md` → `templates/intake-checklist.md`
- Remove: `.ralph-tui/` directory (now empty)

**Step 1: Create templates directory and move files**

```bash
mkdir -p templates
mv .ralph-tui-prompt.hbs templates/prompt.hbs
mv AGENTS.md templates/agents.md
mv .ralph-tui/config.toml templates/config.toml
mv docs/intake-checklist.md templates/intake-checklist.md
rmdir .ralph-tui
```

**Step 2: Update templates/config.toml**

Change `skills_dir` to point to global install and `prompt_template` to `.super-ralph/`:

```toml
agent = "claude"
tracker = "beads-bv"
skills_dir = "~/.agents/super-ralph/skills"
prompt_template = "./.super-ralph/prompt.hbs"
autoCommit = false
subagentTracingDetail = "moderate"

[agentOptions]
model = "claude-sonnet-4-20250514"

[errorHandling]
strategy = "skip"
maxRetries = 3

[notifications]
enabled = true
sound = "off"
```

**Step 3: Verify structure**

```bash
ls templates/
# Expected: agents.md  config.toml  intake-checklist.md  prompt.hbs
ls skills/
# Expected: superpowers-create-beads/  superpowers-intake/
```

**Step 4: Commit**

```bash
git add -A && git commit -m "refactor: move project-local files to templates/"
```

---

### Task 2: Create the super-ralph-init Skill

**Files:**
- Create: `skills/super-ralph-init/SKILL.md`

**Step 1: Write the init skill**

The skill instructs the agent to:
1. Check if already initialized (`.ralph-tui/config.toml` exists)
2. Locate the global install at `~/.agents/super-ralph/templates/`
3. Create `.ralph-tui/config.toml` from template
4. Create `.super-ralph/` with AGENTS.md, prompt.hbs, intake-checklist.md from templates
5. Create `tasks/` directory
6. Append reference line to project AGENTS.md (or create minimal one)
7. Report what was created

The skill must be idempotent — safe to run twice.

See design doc Section 4 for full specification.

**Step 2: Verify file exists**

```bash
cat skills/super-ralph-init/SKILL.md | head -5
# Expected: frontmatter with name and description
```

**Step 3: Commit**

```bash
git add skills/super-ralph-init/SKILL.md && git commit -m "feat: add super-ralph-init skill"
```

---

### Task 3: Create the Slash Command

**Files:**
- Create: `commands/super-ralph-init.md`

**Step 1: Write the command file**

```markdown
---
description: "Initialize the current project for the super-ralph SDLC framework"
---

Invoke the super-ralph:super-ralph-init skill and follow it exactly as presented to you
```

**Step 2: Commit**

```bash
git add commands/super-ralph-init.md && git commit -m "feat: add /super-ralph-init slash command"
```

---

### Task 4: Create Claude Code Plugin Wiring

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `.claude-plugin/hooks/hooks.json`
- Create: `hooks/session-start.sh`

**Step 1: Write plugin.json**

```json
{
  "name": "super-ralph",
  "version": "0.1.0",
  "author": "mwarger",
  "description": "Superpowers + Ralph TUI SDLC Framework — relentless intake, autonomous execution, embedded review",
  "keywords": ["sdlc", "ralph-tui", "superpowers", "beads"],
  "license": "MIT"
}
```

**Step 2: Write hooks.json**

```json
[
  {
    "hook": "SessionStart",
    "script": "./hooks/session-start.sh",
    "matcher": {
      "event": "startup|resume|clear|compact"
    }
  }
]
```

**Step 3: Write session-start.sh**

Shell script that:
- Checks if `.ralph-tui/config.toml` exists in the current directory
- Outputs JSON with `additionalContext` — initialized message or "available" message
- Uses proper JSON escaping

**Step 4: Make session-start.sh executable**

```bash
chmod +x hooks/session-start.sh
```

**Step 5: Verify**

```bash
ls .claude-plugin/
# Expected: plugin.json  hooks/
ls .claude-plugin/hooks/
# Expected: hooks.json
bash hooks/session-start.sh
# Expected: JSON output with additionalContext
```

**Step 6: Commit**

```bash
git add .claude-plugin/ hooks/ && git commit -m "feat: add Claude Code plugin with session-start hook"
```

---

### Task 5: Create OpenCode Plugin

**Files:**
- Create: `.opencode/plugins/super-ralph.js`

**Step 1: Write the plugin**

JS module that:
- Exports a function receiving `{ client, directory }`
- Returns `experimental.chat.system.transform` handler
- Checks if `<directory>/.ralph-tui/config.toml` exists
- Appends awareness message to system prompt
- Two messages: initialized vs not initialized

Follow the pattern from Superpowers' `.opencode/plugins/superpowers.js` but much simpler — no skill content injection, just a short awareness message.

**Step 2: Verify syntax**

```bash
node -c .opencode/plugins/super-ralph.js
# Expected: no syntax errors
```

**Step 3: Commit**

```bash
git add .opencode/ && git commit -m "feat: add OpenCode plugin for session awareness"
```

---

### Task 6: Create Codex Install Instructions

**Files:**
- Create: `.codex/INSTALL.md`

**Step 1: Write Codex-specific install instructions**

Clone + symlink pattern only (no plugin). Instructions for:
1. `git clone https://github.com/mwarger/super-ralph.git ~/.agents/super-ralph`
2. `ln -s ~/.agents/super-ralph/skills ~/.agents/skills/super-ralph`
3. Restart Codex

**Step 2: Commit**

```bash
git add .codex/ && git commit -m "feat: add Codex install instructions"
```

---

### Task 7: Create Universal INSTALL.md

**Files:**
- Create: `INSTALL.md`

**Step 1: Write universal install instructions**

Platform-detection logic:
- Detect which agent environment is running
- Provide platform-specific steps (clone location, symlink targets, plugin install)
- Cover: Claude Code, OpenCode, Codex
- Include update and uninstall instructions

**Step 2: Commit**

```bash
git add INSTALL.md && git commit -m "feat: add universal INSTALL.md"
```

---

### Task 8: Create README.md

**Files:**
- Create: `README.md`

**Step 1: Write the README**

Cover:
- What super-ralph is (one paragraph)
- Install instructions for each platform (brief, link to INSTALL.md)
- Per-project init (`/super-ralph-init`)
- What the pipeline does (brief overview with link to design doc)
- Updating and uninstalling

**Step 2: Commit**

```bash
git add README.md && git commit -m "docs: add README"
```

---

### Task 9: Initialize Git Repo and Verify Structure

**Step 1: Initialize git**

```bash
git init
```

(If not already a git repo)

**Step 2: Verify final structure**

```bash
find . -type f | sort
```

Expected:
```
./.claude-plugin/hooks/hooks.json
./.claude-plugin/plugin.json
./.codex/INSTALL.md
./.opencode/plugins/super-ralph.js
./commands/super-ralph-init.md
./docs/plans/2026-02-21-super-ralph-distribution-design.md
./docs/plans/2026-02-21-super-ralph-distribution-plan.md
./docs/plans/2026-02-21-superpowers-ralph-sdlc-design.md
./hooks/session-start.sh
./INSTALL.md
./README.md
./skills/super-ralph-init/SKILL.md
./skills/superpowers-create-beads/SKILL.md
./skills/superpowers-intake/SKILL.md
./templates/agents.md
./templates/config.toml
./templates/intake-checklist.md
./templates/prompt.hbs
```

**Step 3: Create GitHub repo and push**

```bash
gh repo create mwarger/super-ralph --public --description "Superpowers + Ralph TUI SDLC Framework" --source . --push
```

---

## Execution Order

Tasks 1-8 are mostly sequential (Task 1 must go first since it restructures). Tasks 2-7 can be parallelized since they create independent files. Task 8 (README) should go last since it references everything. Task 9 is the final verification.

```
Task 1 (restructure) → Tasks 2-7 (parallel) → Task 8 (README) → Task 9 (verify + push)
```
