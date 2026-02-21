# Installing Super-Ralph for OpenCode

## Prerequisites

- Git installed

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
ls -la ~/.config/opencode/commands/superralph:*.md
ls -la ~/.config/opencode/plugins/super-ralph.js
```

All should show symlinks pointing into `~/.agents/super-ralph/`.

## Per-Project Setup

After installation, initialize any project by typing `/superralph:init` or saying:

> "Initialize this project for super-ralph"

This creates the project-local `.ralph-tui/config.toml`, `.super-ralph/` directory with AGENTS.md and templates, and a `tasks/` directory.

### Available commands

| Command | Purpose |
|---------|---------|
| `/superralph:init` | Initialize project |
| `/superralph:feature [desc]` | New feature (full pipeline) |
| `/superralph:bug [desc]` | Fix a bug (focused intake) |
| `/superralph:hotfix [desc]` | Urgent fix (minimal intake) |
| `/superralph:refactor [desc]` | Restructure code |
| `/superralph:plan [desc]` | Plan only (stops after design doc) |
| `/superralph:resume` | Resume interrupted epic |
| `/superralph:status` | Check epic progress |

## Updating

```bash
cd ~/.agents/super-ralph && git pull
```

Because skills and plugins are symlinked, the update takes effect immediately. Restart OpenCode to pick up any plugin changes.

## Uninstalling

```bash
rm ~/.config/opencode/skills/super-ralph
rm ~/.config/opencode/commands/superralph:*.md
rm ~/.config/opencode/plugins/super-ralph.js
rm -rf ~/.agents/super-ralph
```

Restart OpenCode.
