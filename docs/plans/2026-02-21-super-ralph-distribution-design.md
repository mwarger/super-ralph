# Super-Ralph: Global Distribution Design

> **Note (2026-02-22):** The skill names in this document have changed. `superpowers-intake` and `super-ralph-create-beads`
> have been replaced with type-specific skills: `feature-prd`, `bug-prd`, `hotfix-prd`, `refactor-prd`, `plan-prd`.
> See `docs/plans/2026-02-22-two-phase-pipeline-design.md` for the current architecture.
>
> **Note (2026-02-23):** The ralph-tui dependency has been dropped entirely. Super-ralph now uses the OpenCode SDK
> for execution. See `docs/plans/2026-02-23-opencode-sdk-loop-design.md` for the current architecture.

> **For Claude:** This is a design document, not an implementation plan. Do not implement without explicit approval.

**Goal:** Make the Superpowers + Ralph TUI SDLC framework installable globally and usable in any project, following the same distribution pattern as Superpowers (obra/superpowers).

**Repo:** `github.com/mwarger/super-ralph`

**Architecture:** Skills are installed globally (clone + symlink) and available in every session. A per-project init skill copies project-local files (config, prompt template, AGENTS.md, intake checklist) into the correct locations. Platform-specific plugins (Claude Code, OpenCode) inject awareness into every session's system prompt. Codex relies on native skill discovery.

---

## 1. Distribution Model

### Two-Layer Architecture

**Global layer** (installed once, auto-updates via `git pull`):
- Skills: `superpowers-intake`, `super-ralph-create-beads`, `super-ralph-init`
- Commands: `/super-ralph-init` slash command
- Plugins: platform-specific bootstrap injection
- Templates: source files for project init

**Project layer** (created per-project by the init skill):
- `.ralph-tui/config.toml` — required at this path by Ralph TUI
- `.super-ralph/AGENTS.md` — framework-specific agent instructions
- `.super-ralph/prompt.hbs` — custom prompt template
- `.super-ralph/intake-checklist.md` — growing intake checklist
- `tasks/` — directory for generated PRDs
- One line appended to existing `AGENTS.md` (or minimal one created)

### Why This Split

- Skills are the same everywhere — global install means updates propagate instantly
- Project-local files need to exist at specific paths (Ralph TUI requires `.ralph-tui/config.toml`)
- The intake checklist grows per-project as LEARN-001 beads add new questions
- `AGENTS.md` is project-owned — the framework references from it, doesn't replace it

---

## 2. Repo Structure

```
super-ralph/
├── INSTALL.md                              # Universal "fetch and follow" instructions
├── README.md                               # Project README
│
├── skills/                                 # Shared across all platforms
│   ├── super-ralph-init/SKILL.md           # Init skill — scaffolds project-local files
│   ├── superpowers-intake/SKILL.md         # Custom PRD skill (relentless intake)
│   └── super-ralph-create-beads/SKILL.md   # Custom bead conversion skill
│
├── commands/                               # Slash commands (Claude Code discovers these)
│   └── super-ralph-init.md                 # /super-ralph-init → invokes init skill
│
├── templates/                              # Source files copied into projects by init skill
│   ├── prompt.hbs                          # Custom prompt template
│   ├── agents.md                           # Framework AGENTS.md
│   ├── config.toml                         # Ralph TUI config
│   └── intake-checklist.md                 # Seed intake checklist
│
├── docs/
│   └── plans/
│       ├── 2026-02-21-superpowers-ralph-sdlc-design.md
│       └── 2026-02-21-super-ralph-distribution-design.md
│
├── .claude-plugin/                         # Claude Code platform wiring
│   ├── plugin.json                         # Plugin metadata
│   └── hooks/
│       └── hooks.json                      # SessionStart hook registration
│
├── hooks/                                  # Shared hooks (Claude Code + Cursor)
│   └── session-start.sh                    # Injects super-ralph awareness
│
├── .opencode/                              # OpenCode platform wiring
│   └── plugins/
│       └── super-ralph.js                  # System prompt transform plugin
│
└── .codex/                                 # Codex platform wiring
    └── INSTALL.md                          # Clone + symlink instructions (no plugin)
```

---

## 3. Install Flow

### One-Time Global Install

The user pastes one sentence into their agent:

**OpenCode / Codex:**
```
Fetch and follow instructions from https://raw.githubusercontent.com/mwarger/super-ralph/main/INSTALL.md
```

**Claude Code:**
```
/plugin marketplace add mwarger/super-ralph-marketplace
/plugin install super-ralph@super-ralph-marketplace
```
(Or manual: fetch and follow INSTALL.md)

### What INSTALL.md Tells the Agent To Do

1. Clone the repo: `git clone https://github.com/mwarger/super-ralph.git ~/.agents/super-ralph`
2. Symlink skills into discovery path (platform-specific):
   - Claude Code: `~/.claude/skills/super-ralph` → `~/.agents/super-ralph/skills/`
   - OpenCode: `~/.config/opencode/skills/super-ralph` → `~/.agents/super-ralph/skills/`
   - Codex: `~/.agents/skills/super-ralph` → `~/.agents/super-ralph/skills/`
3. For OpenCode: install plugin symlink
   - `~/.config/opencode/plugins/super-ralph.js` → `~/.agents/super-ralph/.opencode/plugins/super-ralph.js`
4. Restart the agent

### Updating

```bash
cd ~/.agents/super-ralph && git pull
```

Skills, templates, and plugins update instantly through symlinks.

---

## 4. Per-Project Init Flow

### Trigger

User says "initialize this project for super-ralph" or types `/super-ralph-init`.

### What the Init Skill Does

1. **Check if already initialized** — if `.ralph-tui/config.toml` exists, ask whether to re-initialize or skip
2. **Locate templates** — find `~/.agents/super-ralph/templates/` (the global install location)
3. **Create `.ralph-tui/config.toml`** — copied from `templates/config.toml`
   - `prompt_template` points to `.super-ralph/prompt.hbs`
   - `skills_dir` points to the global install (`~/.agents/super-ralph/skills/`)
4. **Create `.super-ralph/` directory** with:
   - `AGENTS.md` — copied from `templates/agents.md`
   - `prompt.hbs` — copied from `templates/prompt.hbs`
   - `intake-checklist.md` — copied from `templates/intake-checklist.md`
5. **Create `tasks/` directory**
6. **Update project `AGENTS.md`**:
   - If exists: append `\nAlso read .super-ralph/AGENTS.md for SDLC framework instructions.\n`
   - If not exists: create minimal one with that reference
7. **Report what was created**

### Idempotency

- If `.ralph-tui/config.toml` already exists → ask before overwriting
- If `.super-ralph/` files already exist → skip (don't overwrite customizations)
- If `AGENTS.md` already has the reference line → don't duplicate it
- Always create `tasks/` (mkdir -p is inherently idempotent)

---

## 5. Platform-Specific Plugins

### Claude Code (`.claude-plugin/` + `hooks/`)

**`plugin.json`:** Metadata — name, version, author, description, keywords.

**`hooks/hooks.json`:** Registers a `SessionStart` hook that fires on startup, resume, clear, and compact events.

**`hooks/session-start.sh`:** Shell script that:
1. Detects if current project has `.ralph-tui/config.toml`
2. Outputs JSON with `additionalContext` containing the appropriate awareness message
3. If initialized: "This project uses super-ralph. Read `.super-ralph/AGENTS.md`..."
4. If not: "Super-ralph is available. Run `/super-ralph-init` to set up."

### OpenCode (`.opencode/plugins/super-ralph.js`)

JS plugin that:
1. Exports a function receiving `{ client, directory }`
2. Returns `experimental.chat.system.transform` handler
3. Checks if `<directory>/.ralph-tui/config.toml` exists
4. Appends awareness message to system prompt array
5. Same two messages as Claude Code (initialized vs not)

### Codex (`.codex/INSTALL.md`)

No plugin possible. Just clone + symlink instructions. The `super-ralph-init` skill is discovered via native `~/.agents/skills/` scanning. The skill's frontmatter description triggers when the user mentions initializing or setting up the SDLC framework.

---

## 6. Slash Command

**`commands/super-ralph-init.md`:**

```markdown
---
description: "Initialize the current project for the super-ralph SDLC framework"
---

Invoke the super-ralph:super-ralph-init skill and follow it exactly as presented to you
```

Thin wrapper — the command just invokes the init skill.

---

## 7. Config Template

The `templates/config.toml` that gets copied into projects:

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

Note: `skills_dir` points to the global install so skills auto-update. `prompt_template` points to the project-local copy so it can be customized per-project.

---

## 8. Migration from Current agent-framework

The current `agent-framework/` directory becomes the `super-ralph` repo:

| Current location | New location |
|---|---|
| `skills/superpowers-intake/SKILL.md` | `skills/superpowers-intake/SKILL.md` (same) |
| `skills/super-ralph-create-beads/SKILL.md` | `skills/super-ralph-create-beads/SKILL.md` (same) |
| `.ralph-tui-prompt.hbs` | `templates/prompt.hbs` |
| `AGENTS.md` | `templates/agents.md` |
| `.ralph-tui/config.toml` | `templates/config.toml` |
| `docs/intake-checklist.md` | `templates/intake-checklist.md` |
| `docs/plans/*.md` | `docs/plans/*.md` (same) |

New files to create:
- `skills/super-ralph-init/SKILL.md` — the init skill
- `commands/super-ralph-init.md` — the slash command
- `.claude-plugin/plugin.json` — Claude Code plugin metadata
- `.claude-plugin/hooks/hooks.json` — hook registration
- `hooks/session-start.sh` — session start hook script
- `.opencode/plugins/super-ralph.js` — OpenCode plugin
- `.codex/INSTALL.md` — Codex install instructions
- `INSTALL.md` — universal install instructions
- `README.md` — project README

---

## 9. Success Criteria

1. A user on any of the three platforms can install super-ralph by pasting one sentence
2. After install, `/super-ralph-init` (or natural language) scaffolds a project in seconds
3. Skills auto-update when the user runs `git pull` on the global clone
4. Project-local customizations (intake checklist, prompt template) are preserved across updates
5. The plugin injects appropriate context in every session without being noisy
6. Re-running init on an already-initialized project is safe (idempotent)
