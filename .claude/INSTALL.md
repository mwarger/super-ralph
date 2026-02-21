# Installing Super-Ralph for Claude Code

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
mkdir -p ~/.claude/skills
ln -s ~/.agents/super-ralph/skills ~/.claude/skills/super-ralph
```

### 3. Install plugin (hooks)

```bash
mkdir -p ~/.claude/plugins
ln -s ~/.agents/super-ralph/.claude-plugin ~/.claude/plugins/super-ralph
```

### 4. Restart Claude Code

Restart Claude Code to pick up the new skills and hooks.

## Verify

```bash
ls -la ~/.claude/skills/super-ralph
ls -la ~/.claude/plugins/super-ralph
```

Both should show symlinks pointing into `~/.agents/super-ralph/`.

## Per-Project Setup

After installation, initialize any project by running:

```
/superralph:init
```

Or say: "Initialize this project for super-ralph"

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

Because skills and plugins are symlinked, the update takes effect immediately. Restart Claude Code to pick up any hook changes.

## Uninstalling

```bash
rm ~/.claude/skills/super-ralph
rm ~/.claude/plugins/super-ralph
rm -rf ~/.agents/super-ralph
```

Restart Claude Code.
