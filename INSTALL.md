# Super-Ralph Installation

You are an AI agent installing super-ralph for a user. Follow the steps for your platform below.

## Prerequisites

- Git must be installed on the user's machine.

## Step 1: Clone the Repository

This step is the same for all platforms:

```bash
git clone https://github.com/mwarger/super-ralph.git ~/.agents/super-ralph
```

If `~/.agents/super-ralph` already exists, update it instead:

```bash
cd ~/.agents/super-ralph && git pull
```

---

## Step 2: Platform-Specific Setup

Determine which platform you are running on and follow the corresponding section.

---

### Claude Code

**Symlink skills:**

```bash
mkdir -p ~/.claude/skills
ln -s ~/.agents/super-ralph/skills ~/.claude/skills/super-ralph
```

**Install plugin (hooks):**

Claude Code uses a hooks-based plugin system. Symlink the plugin directory into the global Claude Code hooks location:

```bash
mkdir -p ~/.claude/plugins
ln -s ~/.agents/super-ralph/.claude-plugin ~/.claude/plugins/super-ralph
```

Alternatively, if the user prefers manual hook wiring, symlink the hooks file directly:

```bash
# Only if not using the plugin directory approach above
mkdir -p ~/.claude/hooks
ln -s ~/.agents/super-ralph/.claude-plugin/hooks/hooks.json ~/.claude/hooks/super-ralph-hooks.json
```

**Restart Claude Code** to pick up the new skills and hooks.

**Verify:**

```bash
ls -la ~/.claude/skills/super-ralph
ls -la ~/.claude/plugins/super-ralph
```

Both should show symlinks pointing into `~/.agents/super-ralph/`.

---

### OpenCode

**Symlink skills:**

```bash
mkdir -p ~/.config/opencode/skills
ln -s ~/.agents/super-ralph/skills ~/.config/opencode/skills/super-ralph
```

**Install plugin:**

```bash
mkdir -p ~/.config/opencode/plugins
ln -s ~/.agents/super-ralph/.opencode/plugins/super-ralph.js ~/.config/opencode/plugins/super-ralph.js
```

**Restart OpenCode** to pick up the new skills and plugin.

**Verify:**

```bash
ls -la ~/.config/opencode/skills/super-ralph
ls -la ~/.config/opencode/plugins/super-ralph.js
```

Both should show symlinks pointing into `~/.agents/super-ralph/`.

---

### Codex

Codex has no plugin system. Only skills are needed.

**Symlink skills:**

```bash
mkdir -p ~/.agents/skills
ln -s ~/.agents/super-ralph/skills ~/.agents/skills/super-ralph
```

**Restart Codex** to discover the skills.

**Verify:**

```bash
ls -la ~/.agents/skills/super-ralph
```

Should show a symlink pointing to `~/.agents/super-ralph/skills`.

---

## Step 3: Per-Project Setup

After installation, initialize any project by running the `/super-ralph-init` slash command (Claude Code / OpenCode) or by saying:

> "Initialize this project for super-ralph"

This creates the project-local `.ralph-tui/config.toml`, `.super-ralph/` directory with AGENTS.md and templates, and a `tasks/` directory.

---

## Updating

To update super-ralph to the latest version:

```bash
cd ~/.agents/super-ralph && git pull
```

Because skills and plugins are symlinked, the update takes effect immediately. Restart your agent to pick up any new hooks or plugin changes.

---

## Uninstalling

1. **Remove symlinks** (run the commands for your platform):

   Claude Code:
   ```bash
   rm ~/.claude/skills/super-ralph
   rm ~/.claude/plugins/super-ralph
   ```

   OpenCode:
   ```bash
   rm ~/.config/opencode/skills/super-ralph
   rm ~/.config/opencode/plugins/super-ralph.js
   ```

   Codex:
   ```bash
   rm ~/.agents/skills/super-ralph
   ```

2. **Remove the cloned repo:**
   ```bash
   rm -rf ~/.agents/super-ralph
   ```

3. **Restart your agent.**
