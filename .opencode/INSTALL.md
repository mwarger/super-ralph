# Installing Super-Ralph for OpenCode

## Prerequisites

- Git installed
- `br` (beads-rust CLI) installed — see [beads-rust](https://github.com/jeffreyemanuel/beads-rust)
- Node.js (for `npx super-ralph` CLI) — run `bun install` at the repo root after cloning

## Installation

### 1. Clone super-ralph

```bash
git clone https://github.com/mwarger/super-ralph.git ~/.agents/super-ralph
```

If `~/.agents/super-ralph` already exists, update it instead:

```bash
cd ~/.agents/super-ralph && git pull
```

### 2. Symlink skills

```bash
mkdir -p ~/.config/opencode/skills
ln -s ~/.agents/super-ralph/skills ~/.config/opencode/skills/super-ralph
```

### 3. Symlink commands

```bash
mkdir -p ~/.config/opencode/commands
for cmd in ~/.agents/super-ralph/commands/*.md; do
  ln -sf "$cmd" ~/.config/opencode/commands/"$(basename "$cmd")"
done
```

### 4. Install plugin

```bash
mkdir -p ~/.config/opencode/plugins
ln -s ~/.agents/super-ralph/.opencode/plugins/super-ralph.js ~/.config/opencode/plugins/super-ralph.js
```

### 5. Restart OpenCode

Restart OpenCode to pick up the new skills and plugin.

## Verify

```bash
ls -la ~/.config/opencode/skills/super-ralph
ls -la ~/.config/opencode/commands/super-ralph:*.md
ls -la ~/.config/opencode/plugins/super-ralph.js
```

All should show symlinks pointing into `~/.agents/super-ralph/`.

## Per-Project Setup

After installation, initialize any project by typing `/super-ralph:init` or saying:

> "Initialize this project for super-ralph"

This creates the project-local `.super-ralph/` directory with AGENTS.md and templates, and a `tasks/` directory.

### Available commands

| Command | Purpose |
|---------|---------|
| `/super-ralph:init` | Initialize project |
| `/super-ralph:feature [desc]` | New feature (deep intake -> spec) |
| `/super-ralph:bug [desc]` | Fix a bug (intake -> fix spec) |
| `/super-ralph:hotfix [desc]` | Urgent fix (fast intake -> spec) |
| `/super-ralph:refactor [desc]` | Restructure code (intake -> design doc -> spec) |
| `/super-ralph:plan [desc]` | Plan only (stops after design doc) |
| `/super-ralph:status` | Check epic progress |

## Updating

```bash
cd ~/.agents/super-ralph && git pull
```

Because skills and plugins are symlinked, the update takes effect immediately. Restart OpenCode to pick up any plugin changes.

## Uninstalling

```bash
rm ~/.config/opencode/skills/super-ralph
rm ~/.config/opencode/commands/super-ralph:*.md
rm ~/.config/opencode/plugins/super-ralph.js
rm -rf ~/.agents/super-ralph
```

Restart OpenCode.
