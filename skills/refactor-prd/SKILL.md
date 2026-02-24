---
name: refactor-prd
description: "Self-contained Ralph TUI skill for refactoring workflows: relentless intake focused on code restructuring, design document with before/after architecture, PRD generation, bead creation, dependency wiring, and launch."
---

# Refactor PRD — Ralph TUI Skill

> Self-contained skill for Ralph TUI that runs the full refactoring pipeline:
> architecture-focused intake, before/after design document, PRD generation, bead creation, and launch.

---

## The Job

1. Run the relentless intake protocol (refactoring interrogation + technical deep-dive + learned questions)
2. Produce a design document with current state, target state, and migration path — with user approval
3. Convert the design into iteration-sized, phase-labeled user stories
4. Inject structural beads (REVIEW, BUGSCAN, AUDIT, LEARN) — full gates because refactors are HIGH-RISK for regressions
5. Output the PRD wrapped in `[PRD]...[/PRD]` markers
6. Create beads via `br` CLI with full dependency graph
7. Offer to launch Phase 2 execution

**Important:** Do NOT implement anything. This skill produces the plan and beads only.

**Announce at start:** "I'm using the refactor-prd skill for architecture-focused intake, before/after design, PRD generation, and bead creation."

---

## Step 0: Explore Project Context

Before asking any questions:

1. Read `AGENTS.md` and `README.md` if they exist
2. Read `.super-ralph/progress.md` if it exists (learnings from past epics)
3. Explore the codebase structure — what exists, what patterns are in use, what's the tech stack
4. Read `.super-ralph/intake-checklist.md` if it exists (needed for Phase C)
5. Pay special attention to the code targeted for refactoring — understand its current architecture, patterns, dependencies, and test coverage

This grounds your questions in the reality of the project, not abstract possibilities.

---

## Step 1: Relentless Intake

Ask questions **one at a time**, using multiple choice when possible. After each answer, decide whether to dig deeper, move on, or generate the design. Do not mechanically ask all questions — adapt based on the refactor's complexity.

A focused refactor might resolve in 8 questions. A large architectural restructuring might take 12+ rounds.

**Seed description:** If context was provided with the command, confirm it rather than asking from scratch: "You want to refactor [description] — is that right, or should I adjust?"

### Phase A: Refactoring Interrogation

1. **What's the pain?** What code smells, maintenance burden, performance issues, or architectural problems are driving this refactor? What makes the current code hard to work with?

2. **What's the desired end state?** What does the target architecture look like? What patterns should be in place when this is done? How should the code be structured?

3. **What must NOT change?** What behavior, APIs, contracts, and external interfaces must be preserved exactly? What do consumers depend on?

4. **What's the migration path?** Incremental refactoring with continuous deployment, or a big-bang rewrite behind a flag? Can we do this in stages that each leave the system working?

5. **What are the invariants?** What properties must remain true throughout every step of the refactor? What assertions, if broken at any intermediate state, mean we've gone wrong?

6. **What's the risk?** What are the regression hotspots? Which integration points are fragile? What areas have poor test coverage that makes refactoring dangerous?

### Phase B: Technical Deep-Dive

After reading the codebase (Step 0), ask 3-6 questions from:

7. **Current patterns vs target patterns?** Present what you found — what patterns and abstractions exist today, what the code looks like. Propose the target patterns. Ask: does this transformation capture what you want?

8. **What's the test coverage of affected areas?** How well tested is the code we're changing? What's covered by unit tests, integration tests, E2E tests? Where are the gaps that make refactoring risky?

9. **What are the coupling points?** What other modules, services, or components depend on the code being refactored? What's the blast radius of changing internal structure?

10. **What's the data migration story?** If the refactor changes data shapes, storage patterns, or schema: what's the migration plan? Can it be done online?

11. **What can be parallelized?** Which parts of the refactor are independent and can happen in parallel? Which are sequential and must happen in order?

12. **What's the rollback strategy?** If something goes wrong mid-refactor, how do we get back to a working state? Feature flags? Backward-compatible changes?

### Phase C: Learned Questions

Read `.super-ralph/intake-checklist.md` if it exists. For each category of learned questions, assess whether any are relevant to this refactor. If so, ask them. These are questions the team discovered they should always ask — things learned from past epics.

Not every question applies to every piece of work. Use judgment. If the checklist has 20 questions but only 3 are relevant, ask those 3.

### Adaptive Depth

After each answer, decide:
- **Dig deeper** — the answer revealed complexity or ambiguity
- **Move on** — the answer is clear and sufficient
- **Generate the design** — enough context to proceed

Target 8-12 total questions across all phases.

Signal to the user when you believe you have enough context: "I think I have enough to draft the design. Any final thoughts before I proceed?"

---

## Step 2: Design Document

Once the intake is complete, produce a design document with explicit before/after architecture:

1. **Propose 2-3 approaches** with trade-offs and your recommendation. Lead with the recommended option. Explain why. For refactors, approaches typically differ in granularity (small incremental steps vs larger restructuring), migration strategy (strangler fig vs parallel implementation vs in-place), and risk profile.

2. **Present the design in sections**, asking after each whether it looks right:
   - Overview (2-3 sentences describing the refactoring objective)
   - Goals (bullet list, measurable — e.g., "reduce module coupling", "eliminate circular dependencies")
   - Current State (how the code is structured now — architecture, patterns, pain points)
   - Target State (how it should be after refactoring — architecture, patterns, improvements)
   - Migration Path (how to get from current to target incrementally, step by step)
   - Invariants (what must remain true at every intermediate step)
   - Risk Assessment (regression hotspots, fragile integration points, test coverage gaps)
   - Testing Strategy (how to verify behavior is preserved at each step)
   - Non-goals (explicit scope boundaries — what we're NOT restructuring)
   - Open questions (if any remain)

3. **Scale each section to its complexity.** A few sentences if straightforward, up to 200-300 words if nuanced.

4. **Get user approval** before proceeding. If the user disagrees with a section, revise it.

5. **Save the design** to `docs/plans/YYYY-MM-DD-<refactor>-design.md`.

---

## Step 3: Generate PRD

Convert the approved design into user stories sized for Ralph TUI iterations.

### Quality Gates (REQUIRED)

Ask the user what quality gate commands must pass:

```
What quality commands must pass for each user story?
   A. pnpm typecheck && pnpm lint
   B. npm run typecheck && npm run lint
   C. bun run typecheck && bun run lint
   D. Other: [specify your commands]
```

For refactors, also ask about regression testing:
```
What test commands should verify behavior is preserved?
   A. pnpm test
   B. npm test
   C. bun test
   D. Other: [specify your commands]
```

### Sizing Rule

Each user story must be completable in ONE Ralph TUI iteration (one agent context window). If it can't be described in 2-3 sentences, it's too big. Split it.

Right-sized: "Extract validation logic into dedicated validator class" / "Replace direct DB calls with repository pattern in UserService" / "Move shared types to common module"

Too big: "Refactor the entire data layer" / "Rewrite the API" / "Restructure all services"

### Ordering Rule

Stories are ordered by dependency and risk. Foundation/infrastructure changes first, then module-by-module restructuring, then cleanup/integration. Each story must leave the system in a working state.

### Phase Labeling

Tag each story with a phase in square brackets. Supported phases:
- `[phase:foundation]` — Shared abstractions, interfaces, base classes needed by later steps
- `[phase:schema]` — Database migrations, data model changes (if applicable)
- `[phase:restructure]` — The core refactoring work — moving, splitting, merging code
- `[phase:migrate]` — Updating consumers, call sites, imports to use new structure
- `[phase:cleanup]` — Removing old code, dead code, deprecated paths
- `[phase:test]` — Test infrastructure, test updates, test additions
- `[phase:docs]` — Documentation updates

### Structural Bead Injection

Refactors are HIGH-RISK for regressions. Inject full structural beads at every phase boundary and at epic end.

**At each phase boundary:**
```
REVIEW-NNN: <Phase> phase review [phase:review]
BUGSCAN-NNN: <Phase> fresh-eyes review [phase:review]
```

**At the end of the epic:**
```
AUDIT-001: Full code review [phase:audit]
AUDIT-002: Test coverage verification [phase:audit]
LEARN-001: Learning extraction [phase:learn]
```

### Output Format

Wrap the final PRD in `[PRD]...[/PRD]` markers. Save to `tasks/prd-<refactor-name>.md`.

```markdown
[PRD]
# PRD: <Refactor Name>

## Overview
<2-3 sentences from the design document describing the refactoring objective>

## Goals
- <measurable goal from design>
- <measurable goal from design>

## Invariants
These must remain true at every intermediate step:
- <invariant from design>
- <invariant from design>

## Quality Gates

These commands must pass for every user story:
- `<command>` - <description>
- `<command>` - <description>

These test commands must pass to verify behavior preservation:
- `<command>` - <description>

## User Stories

### US-001: <Title> [phase:foundation]
**Description:** As a developer, I want <restructuring step> so that <benefit>.

**Acceptance Criteria:**
- [ ] <specific, verifiable criterion>
- [ ] <specific, verifiable criterion>
- [ ] Behavior preserved: <specific behavioral invariant verified>

### US-002: <Title> [phase:foundation]
**Description:** ...

### REVIEW-001: Foundation phase review [phase:review]
**Description:** Review all work from the foundation phase against the design document. Verify behavior is preserved and invariants hold.

**Acceptance Criteria:**
- [ ] All foundation changes match the approved design
- [ ] Behavior preserved — all tests pass
- [ ] Invariants verified
- [ ] All quality gates pass
- [ ] No placeholder implementations
- [ ] Findings documented in progress.md
- [ ] Corrective beads created if issues found

### BUGSCAN-001: Foundation fresh-eyes review [phase:review]
**Description:** Re-read all code from the foundation phase with fresh eyes looking for bugs, regressions, and behavioral changes. Fix anything uncovered.

**Acceptance Criteria:**
- [ ] All new code re-read carefully
- [ ] No unintended behavioral changes
- [ ] Any bugs or issues fixed
- [ ] Findings documented in progress.md

### US-003: <Title> [phase:restructure]
**Description:** ...

...continue pattern for each phase...

### AUDIT-001: Full code review [phase:audit]
**Description:** Review the entire refactoring against the design document with fresh eyes. Verify no behavioral regressions, no architectural drift, and all invariants hold.

**Acceptance Criteria:**
- [ ] Complete diff reviewed against design document
- [ ] No architectural drift from target state
- [ ] No unintended behavioral changes
- [ ] All invariants verified
- [ ] No security issues identified
- [ ] All quality gates pass
- [ ] Findings documented in progress.md

### AUDIT-002: Test coverage verification [phase:audit]
**Description:** Verify test coverage for all refactored code. Ensure behavioral equivalence is tested.

**Acceptance Criteria:**
- [ ] Unit test coverage assessed for all changed code
- [ ] Integration test coverage assessed
- [ ] Behavioral equivalence verified by tests
- [ ] All tests pass
- [ ] Corrective beads created for coverage gaps

### LEARN-001: Learning extraction [phase:learn]
**Description:** Extract and persist learnings from this refactoring epic.

**Acceptance Criteria:**
- [ ] progress.md reviewed for reusable patterns
- [ ] .super-ralph/intake-checklist.md updated with new questions
- [ ] Epic summary written to progress.md

## Non-Goals
- <what this is NOT, from the design>

## Design Reference
See: docs/plans/YYYY-MM-DD-<refactor>-design.md
[/PRD]
```

---

## Step 4: Create Beads

Take the PRD and create beads in `.beads/issues.jsonl` using the `br` CLI.

### Command Reference

All bead operations use the `br` CLI (beads_rust). Key commands:

```bash
# Create an epic
br create --type=epic --title="..." --description="$(cat <<'EOF'
...
EOF
)" --external-ref="prd:./tasks/prd-refactor.md"

# Create a child bead
br create --parent=<EPIC_ID> --title="..." --description="$(cat <<'EOF'
...
EOF
)" --priority=<1-4>

# Add dependency (issue depends on blocker)
br dep add <issue-id> <depends-on-id>

# Add label
br label add <issue-id> <label>
```

> **CRITICAL:** Always use `<<'EOF'` (single-quoted) for HEREDOC delimiters. This prevents
> shell interpretation of backticks, `$variables`, and `()` in descriptions.

### Verify Git Repository

Before creating any beads, verify that the project has a git repository initialized. Beads requires a git repo.

1. Run `git status` to check.
2. **If no git repo exists:** Initialize one:
   ```bash
   git init
   git add -A
   git commit -m "chore: initial commit"
   ```
   Tell the user: "Initialized a git repo and created an initial commit — beads requires this."
3. **If a git repo exists:** Continue.

### Extract Quality Gates

Look for the "Quality Gates" section in the PRD:

- **Universal gates:** Commands that apply to ALL stories
- **Test gates:** Commands that verify behavior preservation (critical for refactors)

### Create Epic

Create the epic bead with `--external-ref` linking back to both the PRD file and the design document:

```bash
br create --type=epic \
  --title="<Refactor Name>" \
  --description="$(cat <<'EOF'
<Refactor description from PRD overview>

Invariants that must hold throughout:
- <invariant 1>
- <invariant 2>

Design: docs/plans/YYYY-MM-DD-<refactor>-design.md
PRD: tasks/prd-<refactor>.md
EOF
)" \
  --external-ref="prd:./tasks/prd-<refactor>.md"
```

Note the epic ID returned — all child beads reference it as `--parent`.

### Create Implementation Beads

For each `### US-XXX:` story in the PRD:

1. Create the bead with acceptance criteria + quality gates + test gates appended
2. Parse the phase label from `[phase:xxx]` in the title
3. Add the phase label via `br label add`
4. Add dependencies based on phase ordering and explicit story dependencies

**Sizing check:** Each story must be completable in ONE Ralph TUI iteration. If any story looks too large, split it before creating the bead. If you can't describe the change in 2-3 sentences, it's too big.

**Self-documenting beads:** Each bead's description must be self-contained — include relevant background, reasoning, and context so that a fresh agent with no prior context can understand what to do and why. For refactoring beads, always include: what the code looks like now, what it should look like after, and what behavior must be preserved.

**Example implementation bead:**

```bash
br create --parent=<EPIC_ID> \
  --title="US-001: Extract validation logic into ValidationService" \
  --description="$(cat <<'EOF'
As a developer, I need to extract inline validation logic from UserController
into a dedicated ValidationService to reduce controller complexity and enable
reuse across other controllers.

## Context
UserController currently contains ~200 lines of inline validation logic mixed
with request handling. This makes the controller hard to test and impossible
to reuse validation rules elsewhere. The target architecture has controllers
delegating to dedicated service classes.

## Current State
- Validation logic is inline in UserController.createUser() and .updateUser()
- Validation rules are duplicated between create and update paths
- No shared validation abstraction exists

## Target State
- ValidationService class with validate() method
- UserController delegates to ValidationService
- Validation rules defined once, reused across create/update

## Behavior Preservation
- All existing validation errors must produce identical error responses
- No change to API contract (request/response shapes)
- All existing tests must continue to pass

## Acceptance Criteria
- [ ] ValidationService created with extracted validation logic
- [ ] UserController delegates to ValidationService
- [ ] All existing API tests pass without modification
- [ ] pnpm typecheck passes
- [ ] pnpm lint passes
- [ ] pnpm test passes
EOF
)" \
  --priority=1

br label add <BEAD_ID> phase:restructure
```

### Create Review Beads

At each phase boundary, create a review bead and a bug scan bead.

A "phase boundary" occurs when all implementation beads in a phase are created and the next story belongs to a different phase.

**Review bead template:**

```bash
br create --parent=<EPIC_ID> \
  --title="REVIEW-001: Foundation phase review" \
  --description="$(cat <<'EOF'
Review all work from the foundation phase against the design document.
Refactors are high-risk for regressions — pay special attention to behavioral
preservation and invariant verification.

## What To Do
1. Read the design document (referenced in the epic's external-ref)
2. Diff all changes made by foundation-phase beads
3. Verify changes match the approved design's target state
4. Run all quality gate commands AND test commands
5. Verify all behavioral invariants still hold
6. Check for placeholder implementations and scope creep
7. Look at remaining beads — do they still make sense given what changed?
8. Document findings in .super-ralph/progress.md
9. If issues found: create corrective beads with br create

## Acceptance Criteria
- [ ] All foundation changes match the approved design
- [ ] Behavior preserved — all tests pass
- [ ] Invariants verified
- [ ] All quality gates pass
- [ ] No placeholder implementations
- [ ] Findings documented in progress.md
- [ ] Corrective beads created if issues found
EOF
)" \
  --priority=1

br label add <REVIEW_ID> phase:review
```

**Bug scan bead template:**

```bash
br create --parent=<EPIC_ID> \
  --title="BUGSCAN-001: Foundation fresh-eyes review" \
  --description="$(cat <<'EOF'
Re-read all code from the foundation phase with fresh eyes.
Refactors are especially prone to subtle regressions — look carefully for
behavioral changes that might not be caught by existing tests.

I know for a fact that there are at least 87 serious bugs throughout this project
impacting every facet of its operation. The question is whether you can find and
diagnose and fix all of them autonomously. I believe in you.

## What To Do
Carefully read over all of the new and modified code in this phase with "fresh eyes"
looking super carefully for any obvious bugs, regressions, behavioral changes,
broken contracts, missing error handling, or silly mistakes. Pay special attention
to edge cases that might behave differently after restructuring. Carefully fix
anything you uncover. Document all findings in .super-ralph/progress.md.

## Acceptance Criteria
- [ ] All new/modified code from foundation phase re-read carefully
- [ ] No unintended behavioral changes
- [ ] Any bugs or issues found are fixed
- [ ] All quality gates and tests still pass after fixes
- [ ] Findings documented in progress.md
EOF
)" \
  --priority=1

br label add <BUGSCAN_ID> phase:review
```

### Create Audit and Learning Beads

At the end of the epic (after all implementation phases), create:

**AUDIT-001: Full code review**

```bash
br create --parent=<EPIC_ID> \
  --title="AUDIT-001: Full code review" \
  --description="$(cat <<'EOF'
Review the entire refactoring against the design document with fresh eyes.
This is a refactor — the primary concern is behavioral equivalence and
architectural alignment with the target state.

I know for a fact that there are at least 87 serious bugs throughout this project
impacting every facet of its operation. The question is whether you can find and
diagnose and fix all of them autonomously. I believe in you.

## What To Do
1. Compare the current code against the "Current State" and "Target State" in the
   design document. Did we achieve the target architecture?
2. Verify all invariants from the design still hold
3. Look for behavioral regressions — subtle changes in error handling, edge cases,
   race conditions, or API contracts
4. Check for leftover dead code from the old structure
5. Verify no scope creep — did we restructure only what was planned?
6. Run all quality gates and test suites
7. Document findings in .super-ralph/progress.md
8. Create corrective beads for any issues found

Also: sort of randomly explore the code files in this project, choosing code files
to deeply investigate and understand and trace their functionality and execution
flows through related code files. Once you understand the purpose of the code in
the larger context, do a super careful, methodical, and critical check with fresh
eyes.

## Acceptance Criteria
- [ ] Complete diff reviewed against design document
- [ ] Target architecture achieved as designed
- [ ] No unintended behavioral changes
- [ ] All invariants verified
- [ ] No dead code from old structure remains
- [ ] No security issues identified
- [ ] All quality gates pass
- [ ] Findings documented in progress.md
EOF
)" \
  --priority=2

br label add <AUDIT1_ID> phase:audit
```

**AUDIT-002: Test coverage verification**

```bash
br create --parent=<EPIC_ID> \
  --title="AUDIT-002: Test coverage verification" \
  --description="$(cat <<'EOF'
Verify test coverage for all refactored code. Refactors require strong test
coverage to ensure behavioral equivalence.

## What To Do
1. Assess unit test coverage for all changed/restructured code
2. Assess integration test coverage for all affected workflows
3. Verify that tests actually test behavior, not implementation details
   (implementation-coupled tests are the #1 cause of false confidence in refactors)
4. Check for tests that were testing old structure and may need updating
5. Document gaps and create corrective beads

## Acceptance Criteria
- [ ] Unit test coverage assessed for all changed code
- [ ] Integration test coverage assessed for all affected workflows
- [ ] Tests verify behavior, not implementation details
- [ ] All existing tests still pass
- [ ] Corrective beads created for any coverage gaps
- [ ] Findings documented in progress.md
EOF
)" \
  --priority=2

br label add <AUDIT2_ID> phase:audit
```

**LEARN-001: Learning extraction**

```bash
br create --parent=<EPIC_ID> \
  --title="LEARN-001: Learning extraction" \
  --description="$(cat <<'EOF'
Extract and persist learnings from this refactoring epic.

## What To Do
1. Review all entries in .super-ralph/progress.md from this epic
2. Extract reusable refactoring patterns and add to project documentation
3. Identify intake questions that should have been asked — append them to
   .super-ralph/intake-checklist.md so future epics benefit
4. Document which refactoring strategies worked well and which caused issues
5. Note any invariants that were missed or should have been defined
6. Summarize what went well and what required corrective beads
7. If CASS is available: verify Ralph iteration sessions are searchable
8. If CASS Memory System is available: create memory entries for key lessons
9. Write a final epic summary to progress.md

## Acceptance Criteria
- [ ] progress.md reviewed for reusable patterns
- [ ] .super-ralph/intake-checklist.md updated with new questions discovered
- [ ] Refactoring strategies documented (what worked, what didn't)
- [ ] Epic summary written to progress.md
- [ ] CASS sessions indexed (if available)
- [ ] Memory entries created (if available)
EOF
)" \
  --priority=3

br label add <LEARN_ID> phase:learn
```

---

## Step 5: Wire Dependencies

This is the critical step. The dependency graph must enforce:

1. Implementation beads within a phase can run in parallel (or sequentially if they depend on each other)
2. Review beads depend on ALL implementation beads in their phase
3. Bug scan beads depend on their phase's review bead
4. Next-phase implementation beads depend on the previous phase's bug scan bead
5. Audit beads depend on the last phase's bug scan bead
6. AUDIT-002 depends on AUDIT-001
7. LEARN-001 depends on AUDIT-002

### Full Phase Gate Pattern

For a typical refactor with foundation, restructure, migrate, and cleanup phases:

```bash
# Foundation phase: US-001, US-002 (US-002 depends on US-001 if sequential)
br dep add <US-002> <US-001>

# Foundation review depends on ALL foundation implementation beads
br dep add <REVIEW-001> <US-001>
br dep add <REVIEW-001> <US-002>

# Foundation bug scan depends on foundation review
br dep add <BUGSCAN-001> <REVIEW-001>

# Restructure phase beads depend on foundation bug scan (phase gate)
br dep add <US-003> <BUGSCAN-001>
br dep add <US-004> <BUGSCAN-001>

# Restructure review depends on ALL restructure implementation beads
br dep add <REVIEW-002> <US-003>
br dep add <REVIEW-002> <US-004>

# Restructure bug scan depends on restructure review
br dep add <BUGSCAN-002> <REVIEW-002>

# Migrate phase beads depend on restructure bug scan (phase gate)
br dep add <US-005> <BUGSCAN-002>
br dep add <US-006> <BUGSCAN-002>

# Migrate review depends on ALL migrate implementation beads
br dep add <REVIEW-003> <US-005>
br dep add <REVIEW-003> <US-006>

# Migrate bug scan depends on migrate review
br dep add <BUGSCAN-003> <REVIEW-003>

# Cleanup phase beads depend on migrate bug scan (phase gate)
br dep add <US-007> <BUGSCAN-003>

# Cleanup review depends on ALL cleanup implementation beads
br dep add <REVIEW-004> <US-007>

# Cleanup bug scan depends on cleanup review
br dep add <BUGSCAN-004> <REVIEW-004>

# Audit beads depend on the last bug scan
br dep add <AUDIT-001> <BUGSCAN-004>
br dep add <AUDIT-002> <AUDIT-001>

# Learning bead depends on last audit bead
br dep add <LEARN-001> <AUDIT-002>
```

**Result:** Dependency ordering will naturally prioritize beads that unblock the most downstream work — foundation beads first (they unblock everything), then reviews at the right time, audits last.

---

## Step 6: Self-Check Round

After creating all beads and wiring dependencies, do a self-check:

> Check over each bead super carefully — are you sure it makes sense? Is it optimal?
> Could we change anything to make the system work better? If so, revise the beads.
> It's a lot easier and faster to operate in "plan space" before we start implementing.

Specifically verify:
- [ ] Every bead is self-contained and self-documenting
- [ ] Every bead includes current state, target state, and behavior preservation notes
- [ ] No bead is too large for one iteration
- [ ] Each bead leaves the system in a working state after completion
- [ ] Dependencies are wired correctly (no cycles, no missing edges)
- [ ] Phase labels are applied to every bead
- [ ] Quality gates AND test gates are appended to every implementation bead's criteria
- [ ] Review beads cover the right scope and emphasize behavioral preservation
- [ ] The dependency graph enforces the correct execution order
- [ ] Invariants from the design are referenced in relevant beads

If anything is wrong, fix it with `br update` or additional `br dep add` commands.

---

## Step 7: Summary Output + Launch Wizard

### Summary Output

After creating all beads, output a summary:

```
## Beads Created

Epic: <EPIC_ID> - <Refactor Name>
PRD: tasks/prd-<refactor>.md
Design: docs/plans/YYYY-MM-DD-<refactor>-design.md

### Implementation Beads
- <ID>: US-001 - <Title> [phase:foundation]
- <ID>: US-002 - <Title> [phase:foundation]
- <ID>: US-003 - <Title> [phase:restructure]
...

### Review Beads
- <ID>: REVIEW-001 - Foundation phase review [phase:review]
- <ID>: BUGSCAN-001 - Foundation fresh-eyes review [phase:review]
...

### Audit Beads
- <ID>: AUDIT-001 - Full code review [phase:audit]
- <ID>: AUDIT-002 - Test coverage verification [phase:audit]
- <ID>: LEARN-001 - Learning extraction [phase:learn]

### Dependency Summary
Foundation -> REVIEW-001 -> BUGSCAN-001 -> Restructure -> REVIEW-002 -> BUGSCAN-002 -> Migrate -> ...

### Run Command
bun run <cli_path> forward --epic <EPIC_ID> --max-iterations <RECOMMENDED>

> Setting --max-iterations to {N} ({total_beads} beads x 2 buffer for retries/corrective beads)
```

**Calculate recommended iterations:** Count the total beads created (implementation + review + audit + learn). Multiply by 2. This accounts for retries on failures and corrective beads that review beads may create. Example: 27 beads -> `--max-iterations 54`.

### Launch Options

Read `cli_path` from `.super-ralph/config.toml` (the `[cli] path` field). If not set, error and tell the user to run `/superralph:init`.

After creating beads, offer to launch execution immediately. Use `<ITERATIONS>` as the calculated value (total beads x 2).

> "Beads are ready. How would you like to start execution?
>
> 1. **Run now** — I'll run `bun run <cli_path> forward` right here. You can check status from another terminal with `bun run <cli_path> status --epic <EPIC_ID>`.
> 2. **Copy command to clipboard** — I'll copy the full `bun run <cli_path> forward` command to your clipboard so you can paste it in a new terminal tab.
> 3. **Show command** — I'll display the command for you to copy manually."

### Option 1: Run now

Before running, ask about model overrides:

> "The project config will be used by default. Would you like to override the model for this run?
>
> - **Use config defaults** *(recommended)* — whatever is in `.super-ralph/config.toml`
> - **Override model** — e.g., `anthropic/claude-opus-4-6`, `anthropic/claude-sonnet-4-6`"

Construct the command based on their choices. **All commands include `--max-iterations`:**

```bash
# Default (no overrides)
bun run <cli_path> forward --epic <EPIC_ID> --max-iterations <ITERATIONS>

# With model override
bun run <cli_path> forward --epic <EPIC_ID> --max-iterations <ITERATIONS> --model <model>
```

Tell the user why:

> "Setting --max-iterations to {N} ({total_beads} beads x 2 buffer for retries/corrective beads)"

Run the command via bash.

After execution completes (or if it's interrupted), inform the user:
- To check progress: `bun run <cli_path> status --epic <EPIC_ID>`
- To resume if interrupted: `/superralph:resume`

### Option 2: Copy command to clipboard

Construct the command for the user to run in their own terminal:

```bash
bun run <cli_path> forward --epic <EPIC_ID> --max-iterations <ITERATIONS>
```

Copy it to the clipboard using `pbcopy` (macOS). Tell the user:

> "Copied to clipboard. Open a new terminal tab and paste to start.
> Setting --max-iterations to {N} ({total_beads} beads x 2 buffer for retries/corrective beads)"

Always also display the command in the output as a fallback.

### Option 3: Show command

Display the full command:

```
bun run <cli_path> forward --epic <EPIC_ID> --max-iterations <ITERATIONS>
```

> "Setting --max-iterations to {N} ({total_beads} beads x 2 buffer for retries/corrective beads)"

No clipboard, no execution — the user copies it themselves.

---

## Checklist

Before finishing, verify:

- [ ] Project context explored (AGENTS.md, README.md, codebase, progress.md)
- [ ] Refactoring interrogation complete (pain, end state, invariants, migration path, risk)
- [ ] Technical deep-dive complete (current vs target patterns, test coverage, coupling)
- [ ] Learned questions from intake-checklist.md checked
- [ ] 2-3 approaches proposed with trade-offs
- [ ] Design includes Current State, Target State, and Migration Path sections
- [ ] Design presented in sections with user approval
- [ ] Design doc saved to docs/plans/
- [ ] Quality gates AND test gates asked and included
- [ ] User stories are iteration-sized (completable in one Ralph TUI iteration)
- [ ] Each story leaves the system in a working state
- [ ] Behavior preservation criteria included in each story
- [ ] Phase labels assigned to every story
- [ ] Review beads injected at phase boundaries (emphasizing behavioral preservation)
- [ ] Bug scan beads injected after each review bead
- [ ] Both AUDIT beads injected at end
- [ ] LEARN-001 bead included as final bead
- [ ] PRD wrapped in [PRD]...[/PRD] markers
- [ ] PRD saved to tasks/prd-<refactor-name>.md
- [ ] Git repository verified (or initialized)
- [ ] Epic created with --external-ref to PRD and design doc
- [ ] Epic description includes invariants
- [ ] Each user story converted to one bead (iteration-sized)
- [ ] Each bead includes current state, target state, and behavior preservation
- [ ] Phase labels applied to every bead via br label add
- [ ] Quality gates AND test gates appended to every implementation bead's criteria
- [ ] Review beads created at each phase boundary
- [ ] Bug scan beads created after each review bead
- [ ] Both audit beads created at epic end
- [ ] LEARN-001 created as final bead
- [ ] All dependencies wired correctly (phase gates enforced)
- [ ] Self-check round completed (including invariant and behavioral preservation verification)
- [ ] Summary output provided with run command and calculated --max-iterations
- [ ] Launch wizard presented (run now / clipboard / show command)
