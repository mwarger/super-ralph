# Super-Ralph

A unified SDLC framework for AI-assisted software development. Combines [Superpowers](https://github.com/obra/superpowers) (rigorous intake, design, review), the [OpenCode SDK](https://opencode.ai) (autonomous execution loops), and [Beads](https://jeffreyemanuel.com) (dependency-aware task tracking with PageRank prioritization via `br` CLI).

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
- `.super-ralph/AGENTS.md` — Framework agent instructions
- `.super-ralph/prompt.hbs` — Custom prompt template
- `.super-ralph/intake-checklist.md` — Growing intake checklist
- `tasks/` — Directory for generated PRDs

## Commands

| Command | Purpose |
|---------|---------|
| `/superralph:init` | Initialize project for the framework |
| `/superralph:feature [desc]` | New feature — full intake → design doc → PRD → beads → launch |
| `/superralph:bug [desc]` | Fix a bug — focused intake → PRD → beads → launch |
| `/superralph:hotfix [desc]` | Urgent fix — minimal intake, 1-3 beads → launch |
| `/superralph:refactor [desc]` | Restructure code — architecture intake → design doc → PRD → beads → launch |
| `/superralph:plan [desc]` | Plan only — full intake → design doc → STOP |
| `/superralph:resume` | Resume an interrupted epic |
| `/superralph:status` | Check progress on current epic |

All pipeline commands accept an optional inline description (e.g., `/superralph:feature add dark mode toggle`).

## The Pipeline

### Phase 1: Planning (slash commands invoke skills directly)

Type `/superralph:feature` (or `:bug`, `:hotfix`, `:refactor`). This invokes the corresponding skill directly in your current agent session — no external tool required:

1. **Intake** — Relentless interrogation: business context, technical deep-dive, learned questions. Depth scales to work type (feature: 10-15 questions, hotfix: 1-3).
2. **Design doc** — For features and refactors, produces a design document with user approval.
3. **PRD** — Generates phase-labeled user stories sized for single execution iterations.
4. **Beads** — Creates an epic with implementation beads, review beads at phase boundaries, bug scan beads, audit beads, and a learning extraction bead — all wired into a dependency graph (using `br` CLI).
5. **Launch offer** — Asks whether to start Phase 2 now or later.

### Phase 2: Execution (OpenCode SDK loop)

```bash
npx super-ralph run --epic <epic-id>
```

The `super-ralph` CLI uses the OpenCode SDK to run the execution loop: select (PageRank-optimized) → prompt → execute → evaluate. Review beads execute automatically at phase boundaries. Audit beads review the entire implementation at the end. The learning bead extracts lessons and updates the intake checklist for next time.

## Skills

| Skill | Purpose |
|---|---|
| `super-ralph-init` | Initialize a project for the framework |
| `feature-prd` | Full feature pipeline: intake → design doc → PRD → beads → launch |
| `bug-prd` | Bug fix pipeline: focused intake → PRD → beads → launch |
| `hotfix-prd` | Urgent fix pipeline: minimal intake → PRD (1-3 stories) → beads → launch |
| `refactor-prd` | Refactoring pipeline: architecture intake → design doc → PRD → beads → launch |
| `plan-prd` | Planning only: full intake → design doc → STOP |

## Updating

```bash
cd ~/.agents/super-ralph && git pull
```

Skills update instantly through symlinks.

## Design Documentation

- [Two-Phase Pipeline Design](docs/plans/2026-02-22-two-phase-pipeline-design.md) — Current architecture (planning via skills, execution via OpenCode SDK)
- [Distribution Design](docs/plans/2026-02-21-super-ralph-distribution-design.md) — How global install works
- [Original SDLC Design](docs/plans/2026-02-21-superpowers-ralph-sdlc-design.md) — Historical (superseded by two-phase pipeline)

## License

MIT
