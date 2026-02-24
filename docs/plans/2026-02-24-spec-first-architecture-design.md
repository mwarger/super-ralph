# Spec-First Architecture Design

## Problem

The current pipeline conflates planning and execution. Slash commands (run inside OpenCode) do intake, produce a PRD, create beads, AND offer to launch the forward loop — all in one agent session. This causes problems:

- The forward loop runs as a subprocess of the agent session, which is fragile for long runs (bash tool timeouts, dropped connections).
- Skills are complex (400-800 lines each) because they carry bead-creation logic, dependency wiring, review/audit bead insertion, and launch wizards.
- The decompose phase is underutilized — it exists as a CLI command but the skills bypass it by creating beads directly.
- The human-reviewed spec is tightly coupled to a rigid PRD format (user stories, acceptance criteria, area labels) instead of letting the autonomous system discover the right breakdown.

## Design

### Core Change

Move the boundary between "human interactive planning" and "autonomous execution" earlier. Slash commands produce a reviewed spec file. Everything after that is autonomous CLI work.

**Before:**
```
OpenCode: /superralph:feature -> intake -> design -> PRD -> beads -> launch wizard -> forward
```

**After:**
```
OpenCode: /super-ralph:feature -> intake -> design doc -> spec file in tasks/
Terminal: super-ralph decompose --spec tasks/spec.md -> autonomous bead creation
Terminal: super-ralph forward --epic bd-xxx -> implementation
```

### What the Skills Become

Each skill simplifies to three responsibilities:

1. **Intake** — work-type-specific questions, scaled by depth:
   - Feature/refactor: 10-15 questions (architecture, constraints, edge cases, testing)
   - Bug: 5-8 questions (reproduction, expected vs actual, blast radius)
   - Hotfix: 1-3 questions (what's broken, urgency, rollback plan)

2. **Design doc** — synthesize intake into a spec. Requirements, constraints, success criteria, architecture decisions. No user stories, no bead-level breakdown.

3. **Handoff** — save to `tasks/<name>-spec.md`, print the decompose command.

Everything else is removed: bead creation logic, epic creation, dependency wiring, review/bugscan/audit bead insertion, launch wizard, model override questions.

### What Decompose Becomes

Decompose carries the planning intelligence that currently lives in the skills. It becomes a true autonomous discovery loop.

**Per iteration, the decompose agent:**
- Reads the spec and all beads created so far
- Assesses what's missing — implementation tasks, review checkpoints, audit steps
- Creates the next bead with: title, description, acceptance criteria, area labels, dependencies
- Aims for small tasks that can be implemented and verified in a single forward iteration
- Signals `complete` to continue, `phase_done` when the spec is fully covered

**Guidance in the decompose template (judgment calls, not rigid rules):**
- Tasks should be small enough to implement, test, and commit in one shot
- Add review beads at natural phase boundaries (after core feature, before edge cases)
- Add a bugscan bead after implementation beads
- Add an audit bead at the end if the spec is complex
- Wire dependencies so beads unblock in a sensible order
- Use `area:` labels for model routing (frontend-design, backend, review, etc.)

**Key property:** The agent decides how many beads based on spec complexity. A simple hotfix spec might produce 2-3 beads. A complex feature spec might produce 30+ across multiple phases with review checkpoints. The loop naturally ends when the agent judges the spec is fully decomposed.

**Config flags** (`include_review`, `include_bugscan`, `include_audit`) shift from boolean on/off to guidance — they tell the agent whether the project wants these kinds of beads, but the agent decides if/where they're needed.

### Slash Command Renaming

All commands get hyphenated for consistency with the `super-ralph` CLI name:

- `superralph:*` -> `super-ralph:*`

### Final Command Set

**Slash commands (inside OpenCode):**
- `super-ralph:init` — project setup
- `super-ralph:feature [desc]` — deep intake -> spec
- `super-ralph:bug [desc]` — focused intake -> spec
- `super-ralph:hotfix [desc]` — minimal intake -> spec
- `super-ralph:refactor [desc]` — architecture intake -> spec
- `super-ralph:plan [desc]` — explicit "just design, no work type bias"
- `super-ralph:status` — quick progress check

**Dropped:** `super-ralph:resume` (redundant — re-run the CLI command directly)

**CLI commands (terminal):**
- `super-ralph decompose --spec <path>` — spec -> beads (autonomous discovery)
- `super-ralph forward --epic <ID>` — beads -> code
- `super-ralph reverse --input <path>` — input -> spec (unchanged)
- `super-ralph status --epic <ID>` — progress
- `super-ralph doctor` — preflight checks

### Spec Format

The spec is a loose design document — requirements, constraints, success criteria, architecture decisions. It is NOT a structured PRD with user stories. The decompose agent reads whatever document it receives and uses judgment to discover the right task breakdown.

This means decompose can consume:
- A spec from a slash command
- A design doc from brainstorming
- An implementation plan from writing-plans
- A GitHub issue export
- Any document that describes what needs to be built

### Typical Flows

**Standard feature:**
1. OpenCode: `super-ralph:feature add dark mode` -> intake -> spec at `tasks/dark-mode-spec.md`
2. Terminal: `super-ralph decompose --spec tasks/dark-mode-spec.md`
3. Terminal: `super-ralph forward --epic bd-xxx`

**From existing document:**
1. Terminal: `super-ralph decompose --spec docs/plans/my-design.md`
2. Terminal: `super-ralph forward --epic bd-xxx`

**Full three-phase from scratch:**
1. Terminal: `super-ralph reverse --input ./src --output docs/specs/`
2. Terminal: `super-ralph decompose --spec docs/specs/spec.md`
3. Terminal: `super-ralph forward --epic bd-xxx`

## Risks

- **Decompose template quality** — The decompose template needs enough guidance to produce small, verifiable tasks with sensible dependency graphs without being so prescriptive it can't adapt. This is the key thing to get right.
- **Loss of story-level human review** — The human reviews the spec, not the bead breakdown. Mitigation: inspect beads after decompose with `br show <epic> --json` or `super-ralph status --epic <ID>` before running forward.
- **Spec quality variance** — Decompose quality depends on spec quality. A vague spec produces vague beads. The slash command intake process is the quality gate.
