# Super-Ralph

A unified SDLC framework for AI-assisted software development. Combines [Superpowers](https://github.com/obra/superpowers) (rigorous intake, design, review), [Ralph TUI](https://github.com/subsy/ralph-tui) (autonomous execution loops), and [Beads](https://jeffreyemanuel.com) (dependency-aware task tracking with PageRank prioritization).

Every piece of work — feature, bug, refactor, hotfix — flows through the same pipeline: relentless intake, autonomous execution, embedded review, audited completion.

## Installation

### Claude Code

Tell Claude Code:

```
Fetch and follow instructions from https://raw.githubusercontent.com/mwarger/super-ralph/main/.claude/INSTALL.md
```

### OpenCode

Tell OpenCode:

```
Fetch and follow instructions from https://raw.githubusercontent.com/mwarger/super-ralph/main/.opencode/INSTALL.md
```

### Codex

Tell Codex:

```
Fetch and follow instructions from https://raw.githubusercontent.com/mwarger/super-ralph/main/.codex/INSTALL.md
```

## Per-Project Setup

After installing globally, initialize any project:

```
/superralph:init
```

Or say: "Initialize this project for super-ralph"

This creates:
- `.ralph-tui/config.toml` — Ralph TUI configuration (agent-specific)
- `.super-ralph/AGENTS.md` — Framework agent instructions
- `.super-ralph/prompt.hbs` — Custom prompt template
- `.super-ralph/intake-checklist.md` — Growing intake checklist
- `tasks/` — Directory for generated PRDs

## Commands

| Command | Purpose |
|---------|---------|
| `/superralph:init` | Initialize project for the framework |
| `/superralph:feature [desc]` | New feature — full pipeline (intake → design → refinement → PRD → beads → launch) |
| `/superralph:bug [desc]` | Fix a bug — focused intake, skip design doc |
| `/superralph:hotfix [desc]` | Urgent fix — minimal intake, 1-3 beads |
| `/superralph:refactor [desc]` | Restructure code — design doc, skip refinement |
| `/superralph:plan [desc]` | Plan only — stops after design doc |
| `/superralph:resume` | Resume an interrupted epic |
| `/superralph:status` | Check progress on current epic |

All pipeline commands accept an optional inline description (e.g., `/superralph:feature add dark mode toggle`).

## The Pipeline

### 1. Intake + Design + Plan

Type `/superralph:feature` (or `/superralph:bug`, `/superralph:hotfix`, `/superralph:refactor`). The intake skill runs a relentless interrogation — business context, technical deep-dive, learned questions from past projects. Depth adjusts automatically based on work type. For features and refactors, it produces a design document and runs an optional iterative refinement loop (automated via `opencode run` or manual). Then generates a PRD with user stories sized for single Ralph TUI iterations.

### 2. Bead Conversion

The `superpowers-create-beads` skill converts the PRD to beads with:
- Implementation beads with phase labels
- Review beads at phase boundaries
- Fresh-eyes bug scan beads
- Post-completion audit beads
- Learning extraction bead

All wired into a dependency graph that enforces correct execution order.

### 3. Autonomous Execution

The launch wizard offers to run Ralph TUI headless, copy the command to clipboard, or display it:

```bash
ralph-tui run --tracker beads-bv --epic <epic-id> --iterations <beads x 2>
```

Ralph TUI runs the loop: select (PageRank-optimized) → prompt → execute → evaluate. Review beads execute automatically at phase boundaries — no manual pausing.

### 4. Audit + Finish

Audit beads review the entire implementation. The learning bead extracts lessons and updates the intake checklist for next time. The system gets better with every epic.

## Skills

| Skill | Purpose |
|---|---|
| `super-ralph-init` | Initialize a project for the framework |
| `superpowers-intake` | Relentless intake protocol + PRD generation (work-type aware) |
| `superpowers-create-beads` | Convert PRDs to beads with review/audit structure + launch wizard |

## Updating

```bash
cd ~/.agents/super-ralph && git pull
```

Skills update instantly through symlinks.

## Design Documentation

- [SDLC Framework Design](docs/plans/2026-02-21-superpowers-ralph-sdlc-design.md) — The complete framework design
- [Distribution Design](docs/plans/2026-02-21-super-ralph-distribution-design.md) — How global install works

## License

MIT
