# Installing Super-Ralph for Codex

## Prerequisites
- Git installed
- `br` (beads-rust CLI) installed — see [beads-rust](https://github.com/jeffreyemanuel/beads-rust)

## Installation

1. **Clone super-ralph:**
   ```bash
   git clone https://github.com/mwarger/super-ralph.git ~/.agents/super-ralph
   ```

2. **Symlink skills:**
   ```bash
   mkdir -p ~/.agents/skills
   ln -s ~/.agents/super-ralph/skills ~/.agents/skills/super-ralph
   ```

3. **Restart Codex** to discover the skills.

## Verify
```bash
ls -la ~/.agents/skills/super-ralph
```

You should see entries for `feature-prd`, `bug-prd`, `hotfix-prd`, `refactor-prd`, `plan-prd`, and `super-ralph-init`.

## Updating
```bash
cd ~/.agents/super-ralph && git pull
```

## Per-Project Setup
Say "initialize this project for super-ralph" in any project to set it up.
