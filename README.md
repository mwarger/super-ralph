# Super-Ralph

A unified SDLC framework for AI-assisted software development. Combines [Superpowers](https://github.com/obra/superpowers) (rigorous intake, design, review), [Ralph TUI](https://github.com/subsy/ralph-tui) (autonomous execution loops), and [Beads](https://jeffreyemanuel.com) (dependency-aware task tracking with PageRank prioritization).

Every piece of work — feature, bug, refactor, hotfix — flows through the same pipeline: relentless intake, autonomous execution, embedded review, audited completion.

## Installation

### Claude Code

```
/plugin marketplace add mwarger/super-ralph-marketplace
/plugin install super-ralph@super-ralph-marketplace
```

### OpenCode

```
Fetch and follow instructions from https://raw.githubusercontent.com/mwarger/super-ralph/main/INSTALL.md
```

### Codex

```
Fetch and follow instructions from https://raw.githubusercontent.com/mwarger/super-ralph/main/INSTALL.md
```

See [INSTALL.md](INSTALL.md) for detailed platform-specific instructions.

## Per-Project Setup

After installing globally, initialize any project:

```
/super-ralph-init
```

Or say: "Initialize this project for super-ralph"

This creates:
- `.ralph-tui/config.toml` — Ralph TUI configuration
- `.super-ralph/AGENTS.md` — Framework agent instructions
- `.super-ralph/prompt.hbs` — Custom prompt template
- `.super-ralph/intake-checklist.md` — Growing intake checklist
- `tasks/` — Directory for generated PRDs

## The Pipeline

### 1. Intake + Design + Plan

```bash
ralph-tui create-prd --prd-skill superpowers-intake
```

The `superpowers-intake` skill runs a relentless interrogation — business context, technical deep-dive, learned questions from past projects. It produces a design document, runs an optional iterative refinement loop, then generates a PRD with user stories sized for single Ralph TUI iterations.

### 2. Bead Conversion

The `superpowers-create-beads` skill converts the PRD to beads with:
- Implementation beads with phase labels
- Review beads at phase boundaries
- Fresh-eyes bug scan beads
- Post-completion audit beads
- Learning extraction bead

All wired into a dependency graph that enforces correct execution order.

### 3. Autonomous Execution

```bash
ralph-tui run --tracker beads-bv --epic <epic-id>
```

Ralph TUI runs the loop: select (PageRank-optimized) → prompt → execute → evaluate. Review beads execute automatically at phase boundaries — no manual pausing.

### 4. Audit + Finish

Audit beads review the entire implementation. The learning bead extracts lessons and updates the intake checklist for next time. The system gets better with every epic.

## Skills

| Skill | Purpose |
|---|---|
| `super-ralph-init` | Initialize a project for the framework |
| `superpowers-intake` | Relentless intake protocol + PRD generation |
| `superpowers-create-beads` | Convert PRDs to beads with review/audit structure |

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
