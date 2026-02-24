# Installing Super-Ralph for Claude Code

## Prerequisites

- Git installed
- `br` (beads-rust CLI) installed — see [beads-rust](https://github.com/jeffreyemanuel/beads-rust)

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
/super-ralph:init
```

Or say: "Initialize this project for super-ralph"

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

Because skills and plugins are symlinked, the update takes effect immediately. Restart Claude Code to pick up any hook changes.

## Uninstalling

```bash
rm ~/.claude/skills/super-ralph
rm ~/.claude/plugins/super-ralph
rm -rf ~/.agents/super-ralph
```

Restart Claude Code.
