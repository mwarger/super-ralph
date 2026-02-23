# Two-Phase Ralph TUI Pipeline — Design Document

> **Note (2026-02-23):** The ralph-tui dependency has been dropped. Phase 1 now uses direct skill injection
> (no external tool). Phase 2 uses the OpenCode SDK execution loop (`super-ralph run`).
> See `docs/plans/2026-02-23-opencode-sdk-loop-design.md` for the current architecture.

## Overview

Restructure the super-ralph SDLC framework from a skill-chaining architecture to a two-phase Ralph TUI CLI architecture. Skills become thin dispatchers that launch `ralph-tui run` with the appropriate skill. Superpowers principles are baked into ralph-tui skills at authoring time, not invoked at runtime.

## Problem

The current architecture has two orchestrators competing:

1. **Superpowers skills** — `superpowers-intake` (507 lines) chains into `super-ralph-create-beads` (585 lines), managing state transitions, invoking sub-skills, and controlling the workflow.
2. **Ralph TUI** — already an orchestrator that selects tasks, prompts agents, evaluates results, and manages iterations.

This creates friction: the skills try to control what Ralph TUI should own, making the pipeline fragile, hard to debug, and resistant to running headless.

## Goals

- Clean boundary between planning (Phase 1) and execution (Phase 2) at the CLI command level
- Slash commands are thin dispatchers, not orchestrators
- Each ralph-tui skill is self-contained — no runtime skill-chaining
- Superpowers principles (relentless intake, TDD, self-review) are baked in, not called out to
- Phase 2 runs completely headless with no coupling to Phase 1
- Preserve the valuable parts: intake question categories, structural beads, phase labeling, dependency graph wiring

## Architecture

```
/superralph:feature "description"
        |
        v
  ralph-tui doctor (preflight)
        |
        v
  ralph-tui run --skill feature-prd --tracker beads-bv
        |
        |  Phase 1: Single ralph-tui session
        |  |-- Explore project context
        |  |-- Intake questions (scaled to workflow type)
        |  |-- Write design doc (feature, refactor only)
        |  |-- Generate PRD with phase-labeled user stories
        |  |-- Inject structural beads (REVIEW, BUGSCAN, AUDIT, LEARN)
        |  |-- Create epic + beads via bd CLI
        |  |-- Wire dependency graph
        |  |-- Show summary + offer to launch Phase 2
        |
        v
  "Launch execution now?" [Y/n]
        |
        v
  ralph-tui run --tracker beads-bv --epic <id> [--headless]
        |
        |  Phase 2: Vanilla ralph-tui execution
        |  |-- BV PageRank selects next bead
        |  |-- prompt.hbs templates each iteration
        |  |-- Fresh agent per bead
        |  |-- REVIEW/BUGSCAN/AUDIT/LEARN beads run in phase order
        |
        v
  Done. Merge/PR/discard.
```

## What Changes

### Slash Commands (8 files in `commands/`)

Each command becomes a thin dispatcher (~10-15 lines) that:
1. Runs `ralph-tui doctor` for preflight
2. Launches `ralph-tui run --skill <type>-prd --tracker beads-bv`
3. Passes the seed description (if any) as context

| Command | Maps to |
|---------|---------|
| `/superralph:feature` | `ralph-tui run --skill feature-prd` |
| `/superralph:bug` | `ralph-tui run --skill bug-prd` |
| `/superralph:hotfix` | `ralph-tui run --skill hotfix-prd` |
| `/superralph:refactor` | `ralph-tui run --skill refactor-prd` |
| `/superralph:plan` | `ralph-tui run --skill plan-prd` |
| `/superralph:init` | Unchanged (invokes super-ralph-init skill) |
| `/superralph:resume` | Unchanged (runs ralph-tui resume) |
| `/superralph:status` | Unchanged (runs ralph-tui status) |

### New Ralph-TUI Skills (4 files in `skills/`)

Four self-contained skills replace `superpowers-intake` + `super-ralph-create-beads`:

**`feature-prd`** — Full intake (10-15 questions), design doc, PRD, beads, launch offer
**`bug-prd`** — Focused intake (5-8 questions), no design doc, PRD, beads, launch offer
**`hotfix-prd`** — Minimal intake (1-3 questions), no design doc, minimal PRD, beads, launch offer
**`refactor-prd`** — Architecture-focused intake (8-12 questions), design doc, PRD, beads, launch offer

A fifth skill variant handles the plan-only case:

**`plan-prd`** — Same as feature-prd but stops after design doc. No PRD, no beads, no launch.

### Retired Files

| File | Reason |
|------|--------|
| `skills/superpowers-intake/SKILL.md` | Absorbed into the 4 ralph-tui skills |
| `skills/super-ralph-create-beads/SKILL.md` | Bead creation logic absorbed into each skill |

### Unchanged Files

| File | Why |
|------|-----|
| `.super-ralph/AGENTS.md` | Runtime agent instructions, not part of skill chain |
| `.super-ralph/prompt.hbs` | Phase 2 prompt template, used as-is |
| `.super-ralph/intake-checklist.md` | Read by Phase 1 skills during intake |
| `templates/config.toml` | Project config template |
| `skills/super-ralph-init/SKILL.md` | Init skill, unrelated to the pipeline change |
| `commands/superralph:init.md` | Unchanged |
| `commands/superralph:resume.md` | Unchanged |
| `commands/superralph:status.md` | Unchanged |

## Ralph-TUI Skill Design

Each skill is a single self-contained markdown file that ralph-tui loads as agent instructions for a one-shot session. The skill contains everything the agent needs to:

1. Run the intake appropriate for the workflow type
2. Produce the PRD
3. Create beads
4. Offer to launch execution

### Common Structure (all 4 skills share this skeleton)

```
# <Type> PRD — Ralph TUI Skill

## The Job
<1-3 sentences describing what this skill produces>

## Step 0: Explore Project Context
- Read AGENTS.md, README.md, progress.md
- Explore codebase structure
- Read intake-checklist.md (for Phase C questions)

## Step 1: Intake
- Phase A: Business questions (scaled to type)
- Phase B: Technical questions (scaled to type)
- Phase C: Learned questions from intake-checklist.md
- Adaptive depth: dig deeper, move on, or generate

## Step 2: Design Document (feature, refactor, plan only)
- Propose 2-3 approaches
- Present in sections, get approval
- Save to docs/plans/

## Step 3: Generate PRD
- Convert intake into phase-labeled user stories
- Inject structural beads (REVIEW, BUGSCAN, AUDIT, LEARN)
- Ask about quality gates
- Wrap in [PRD]...[/PRD] markers
- Save to tasks/prd-<name>.md

## Step 4: Create Beads
- Create epic with bd create --type=epic
- Create child beads for each story
- Apply phase labels with bd label add
- Wire dependencies (phase gates)
- Self-check round

## Step 5: Launch
- Show summary table
- Offer: launch headless / copy command / show command
- If launch: ralph-tui run --tracker beads-bv --epic <id> --iterations <N>
```

### Type-Specific Variations

| Aspect | feature-prd | bug-prd | hotfix-prd | refactor-prd | plan-prd |
|--------|-------------|---------|------------|--------------|----------|
| Intake depth | 10-15 questions | 5-8 questions | 1-3 questions | 8-12 questions | 10-15 questions |
| Design doc | Yes | No | No | Yes | Yes |
| Structural beads | Full set | Lighter | Minimal | Full set | N/A |
| Phase 2 offer | Yes | Yes | Yes | Yes | No (stops) |

### Structural Bead Injection by Type

**feature-prd / refactor-prd (full set):**
- REVIEW + BUGSCAN at each phase boundary
- AUDIT-001 (full code review), AUDIT-002 (test coverage)
- LEARN-001 (learning extraction)

**bug-prd (lighter):**
- REVIEW + BUGSCAN after the fix phase
- AUDIT-001 (focused on the fix area)
- LEARN-001

**hotfix-prd (minimal):**
- REVIEW after the fix
- LEARN-001

## What Gets Preserved from Current Skills

### From superpowers-intake (507 lines):
- Intake question categories (business, technical, learned)
- Adaptive depth (dig deeper / move on / generate)
- One question at a time, multiple choice preferred
- Phase labeling for user stories
- Quality gates question (required)
- Sizing rule (one iteration per story)
- PRD output format with `[PRD]...[/PRD]` markers

### From super-ralph-create-beads (585 lines):
- bd CLI command patterns (HEREDOC syntax)
- Phase label application via `bd label add`
- Dependency wiring pattern (phase gates)
- Review/bugscan/audit/learn bead templates
- Self-documenting beads (Emanuel pattern)
- Self-check round
- Launch wizard (headless / clipboard / show)
- Iterations calculation (total_beads x 2)
- ralph-tui doctor preflight

### Dropped:
- Emanuel iterative refinement loop (optional enhancement, not core)
- Runtime invocation of brainstorming/writing-plans skills
- Skill-chaining logic and state transitions
- Work type detection (now determined by which slash command was invoked)

## Tracker

Standardized on `beads-bv` with `bd` CLI. No tracker abstraction needed.

## Phase Chaining

Phase 1 ends with an offer to chain into Phase 2:
- If yes: launches `ralph-tui run --tracker beads-bv --epic <id> [--headless]`
- If no: displays the command for manual invocation later

## Non-Goals

- Abstracting across multiple trackers (beads-rust, json, etc.)
- Emanuel iterative refinement (can be added back as optional step later)
- Changing the prompt.hbs template or AGENTS.md
- Changing the super-ralph-init skill
- Changing the resume/status commands

## Open Questions

None — all questions resolved during brainstorming.
