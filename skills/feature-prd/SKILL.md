---
name: feature-prd
description: "Self-contained Ralph TUI skill for the full feature pipeline: relentless intake, design document, PRD generation, bead creation, dependency wiring, and launch."
---

# Feature PRD — Ralph TUI Skill

> Self-contained skill for Ralph TUI that runs the full feature pipeline:
> relentless intake, design document, PRD generation, bead creation, and launch.

---

## The Job

1. Run the relentless intake protocol (business interrogation + technical deep-dive + learned questions)
2. Produce a design document with user approval
3. Convert the design into iteration-sized, phase-labeled user stories
4. Inject structural beads (REVIEW, BUGSCAN, AUDIT, LEARN)
5. Output the PRD wrapped in `[PRD]...[/PRD]` markers
6. Create beads via `br` CLI with full dependency graph
7. Offer to launch Phase 2 execution

**Important:** Do NOT implement anything. This skill produces the plan and beads only.

**Announce at start:** "I'm using the feature-prd skill for relentless intake, design, PRD generation, and bead creation."

---

## Step 0: Explore Project Context

Before asking any questions:

1. Read `AGENTS.md` and `README.md` if they exist
2. Read `.super-ralph/progress.md` if it exists (learnings from past epics)
3. Explore the codebase structure — what exists, what patterns are in use, what's the tech stack
4. Read `.super-ralph/intake-checklist.md` if it exists (needed for Phase C)

This grounds your questions in the reality of the project, not abstract possibilities.

---

## Step 1: Relentless Intake

Ask questions **one at a time**, using multiple choice when possible. After each answer, decide whether to dig deeper, move on, or generate the design. Do not mechanically ask all questions — adapt based on the feature's complexity.

A simple feature might resolve in 8 questions. A complex one might take 15+ rounds.

**Seed description:** If context was provided with the command, confirm it rather than asking from scratch: "You want to [description] — is that right, or should I adjust?"

### Phase A: Business Interrogation

1. **Why does this matter?** What's the business case? What happens if we don't do it? What's the cost of delay?

2. **Who is affected?** Which users? Which systems? Which teams? What are the downstream effects?

3. **What does success look like?** Not "it works" — measurably, what changes? What metrics improve? What behavior changes?

4. **What are the boundaries?** What is this explicitly NOT? What's adjacent that we're not touching? What's tempting scope creep?

5. **What has been tried before?** Is there prior art in this codebase? Has this been attempted and abandoned? Why?

6. **What are the risks?** What could go wrong? What are the failure modes? What's the blast radius if it breaks?

### Phase B: Technical Deep-Dive

After reading the codebase (Step 0), ask:

7. **What exists already?** Present what you found — related code, patterns, abstractions. Ask: should we extend these or build new?

8. **What's the data model?** If data is involved: what entities, relationships, storage, migrations?

9. **What are the integration points?** What systems does this touch? APIs, databases, queues, external services?

10. **What are the edge cases?** Walk through error states, race conditions, empty states, permission boundaries.

11. **What are the performance constraints?** Latency budgets, data volume expectations, concurrency requirements.

12. **What's the testing strategy?** What's testable automatically? What requires manual verification? What's the test infrastructure?

### Phase C: Learned Questions

Read `.super-ralph/intake-checklist.md` if it exists. For each category of learned questions, assess whether any are relevant to this feature. If so, ask them. These are questions the team discovered they should always ask — things learned from past epics.

Not every question applies to every piece of work. Use judgment. If the checklist has 20 questions but only 3 are relevant, ask those 3.

### Adaptive Depth

After each answer, decide:
- **Dig deeper** — the answer revealed complexity or ambiguity
- **Move on** — the answer is clear and sufficient
- **Generate the design** — enough context to proceed

Signal to the user when you believe you have enough context: "I think I have enough to draft the design. Any final thoughts before I proceed?"

---

## Step 2: Design Document

Once the intake is complete, produce a design document following the brainstorming pattern:

1. **Propose 2-3 approaches** with trade-offs and your recommendation. Lead with the recommended option. Explain why.

2. **Present the design in sections**, asking after each whether it looks right:
   - Overview (2-3 sentences)
   - Goals (bullet list, measurable)
   - Architecture (approach, patterns, key decisions)
   - Components (what's being built, what's being modified)
   - Data model changes (if any)
   - Error handling strategy
   - Testing approach
   - Non-goals (explicit scope boundaries)
   - Open questions (if any remain)

3. **Scale each section to its complexity.** A few sentences if straightforward, up to 200-300 words if nuanced.

4. **Get user approval** before proceeding. If the user disagrees with a section, revise it.

5. **Save the design** to `docs/plans/YYYY-MM-DD-<feature>-design.md`.

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

### Sizing Rule

Each user story must be completable in ONE Ralph TUI iteration (one agent context window). If it can't be described in 2-3 sentences, it's too big. Split it.

Right-sized: "Add investorType column with migration" / "Build filter dropdown component" / "Add input validation to auth endpoint"

Too big: "Build the entire dashboard" / "Add authentication" / "Refactor the API"

### Ordering Rule

Stories are ordered by dependency. Schema/data changes first, then backend logic, then UI, then integration/polish.

### Phase Labeling

Tag each story with a phase in square brackets. Supported phases:
- `[phase:schema]` — Database migrations, data model changes
- `[phase:backend]` — Server actions, API logic, business rules
- `[phase:ui]` — Components, pages, user interactions
- `[phase:integration]` — Cross-cutting concerns, polish, final wiring
- `[phase:test]` — Test infrastructure, test data, test utilities
- `[phase:docs]` — Documentation updates

### Structural Bead Injection

After the implementation stories in each phase, inject structural beads:

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

Wrap the final PRD in `[PRD]...[/PRD]` markers. Save to `tasks/prd-<feature-name>.md`.

```markdown
[PRD]
# PRD: <Feature Name>

## Overview
<2-3 sentences from the design document>

## Goals
- <measurable goal from design>
- <measurable goal from design>

## Quality Gates

These commands must pass for every user story:
- `<command>` - <description>
- `<command>` - <description>

For UI stories, also include:
- <UI-specific gate if applicable>

## User Stories

### US-001: <Title> [phase:schema]
**Description:** As a <user>, I want <feature> so that <benefit>.

**Acceptance Criteria:**
- [ ] <specific, verifiable criterion>
- [ ] <specific, verifiable criterion>

### US-002: <Title> [phase:schema]
**Description:** ...

### REVIEW-001: Schema phase review [phase:review]
**Description:** Review all work from the schema phase against the design document.

**Acceptance Criteria:**
- [ ] All schema changes match the approved design
- [ ] Migrations are reversible
- [ ] All quality gates pass
- [ ] No placeholder implementations
- [ ] Findings documented in progress.md
- [ ] Corrective beads created if issues found

### BUGSCAN-001: Schema fresh-eyes review [phase:review]
**Description:** Re-read all code from the schema phase with fresh eyes looking for bugs, errors, problems, silly mistakes. Fix anything uncovered.

**Acceptance Criteria:**
- [ ] All new code re-read carefully
- [ ] Any bugs or issues fixed
- [ ] Findings documented in progress.md

### US-003: <Title> [phase:backend]
**Description:** ...

...continue pattern for each phase...

### AUDIT-001: Full code review [phase:audit]
**Description:** Review the entire implementation against the design document with fresh eyes. Look for bugs, errors, architectural drift, security issues, and quality problems.

**Acceptance Criteria:**
- [ ] Complete diff reviewed against design document
- [ ] No architectural drift
- [ ] No security issues identified
- [ ] All quality gates pass
- [ ] Findings documented in progress.md

### AUDIT-002: Test coverage verification [phase:audit]
**Description:** Verify test coverage for all new and changed code. Create corrective beads for gaps.

**Acceptance Criteria:**
- [ ] Unit test coverage assessed
- [ ] Integration test coverage assessed
- [ ] All tests pass
- [ ] Corrective beads created for coverage gaps

### LEARN-001: Learning extraction [phase:learn]
**Description:** Extract and persist learnings from this epic.

**Acceptance Criteria:**
- [ ] progress.md reviewed for reusable patterns
- [ ] .super-ralph/intake-checklist.md updated with new questions
- [ ] Epic summary written to progress.md

## Non-Goals
- <what this is NOT, from the design>

## Design Reference
See: docs/plans/YYYY-MM-DD-<feature>-design.md
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
)" --external-ref="prd:./tasks/prd-feature.md"

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
- **UI gates:** Commands that apply only to UI stories (those with `[phase:ui]`)

### Create Epic

Create the epic bead with `--external-ref` linking back to both the PRD file and the design document:

```bash
br create --type=epic \
  --title="<Feature Name>" \
  --description="$(cat <<'EOF'
<Feature description from PRD overview>

Design: docs/plans/YYYY-MM-DD-<feature>-design.md
PRD: tasks/prd-<feature>.md
EOF
)" \
  --external-ref="prd:./tasks/prd-<feature>.md"
```

Note the epic ID returned — all child beads reference it as `--parent`.

### Create Implementation Beads

For each `### US-XXX:` story in the PRD:

1. Create the bead with acceptance criteria + quality gates appended
2. Parse the phase label from `[phase:xxx]` in the title
3. Add the phase label via `br label add`
4. Add dependencies based on phase ordering and explicit story dependencies

**Sizing check:** Each story must be completable in ONE Ralph TUI iteration. If any story looks too large, split it before creating the bead. If you can't describe the change in 2-3 sentences, it's too big.

**Self-documenting beads:** Each bead's description must be self-contained — include relevant background, reasoning, and context so that a fresh agent with no prior context can understand what to do and why. Follow Emanuel's principle: "totally self-contained and self-documenting (including relevant background, reasoning/justification, considerations, etc. — anything we'd want our future self to know)."

**Example implementation bead:**

```bash
br create --parent=<EPIC_ID> \
  --title="US-001: Add investorType field to investor table" \
  --description="$(cat <<'EOF'
As a developer, I need to categorize investors as 'cold' or 'friend' to support
the upcoming friends outreach feature. This is the foundational schema change that
all subsequent backend and UI work depends on.

## Context
The investor table currently has no type distinction. All investors are treated
identically. The friends outreach feature requires distinguishing between cold
prospects and warm contacts (friends) who get different messaging.

## Acceptance Criteria
- [ ] Add investorType column: 'cold' | 'friend' (default 'cold')
- [ ] Generate and run migration successfully
- [ ] Existing investors default to 'cold'
- [ ] pnpm typecheck passes
- [ ] pnpm lint passes
EOF
)" \
  --priority=1

br label add <BEAD_ID> phase:schema
```

### Create Review Beads

At each phase boundary, create a review bead and a bug scan bead.

A "phase boundary" occurs when all implementation beads in a phase are created and the next story belongs to a different phase.

**Review bead template:**

```bash
br create --parent=<EPIC_ID> \
  --title="REVIEW-001: Schema phase review" \
  --description="$(cat <<'EOF'
Review all work from the schema phase against the design document.

## What To Do
1. Read the design document (referenced in the epic's external-ref)
2. Diff all changes made by schema-phase beads
3. Verify schema matches the approved design
4. Run all quality gate commands
5. Check for placeholder implementations and scope creep
6. Look at remaining beads — do they still make sense?
7. Document findings in .super-ralph/progress.md
8. If issues found: create corrective beads with br create

## Acceptance Criteria
- [ ] All schema changes match the approved design
- [ ] Migrations are reversible
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
  --title="BUGSCAN-001: Schema fresh-eyes review" \
  --description="$(cat <<'EOF'
Re-read all code from the schema phase with fresh eyes.

I know for a fact that there are at least 87 serious bugs throughout this project
impacting every facet of its operation. The question is whether you can find and
diagnose and fix all of them autonomously. I believe in you.

## What To Do
Carefully read over all of the new code written in this phase with "fresh eyes"
looking super carefully for any obvious bugs, errors, problems, issues, silly
mistakes, etc. Carefully fix anything you uncover. Document all findings in
.super-ralph/progress.md.

## Acceptance Criteria
- [ ] All new code from schema phase re-read carefully
- [ ] Any bugs or issues found are fixed
- [ ] All quality gates still pass after fixes
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
Review the entire implementation against the design document with fresh eyes.

I know for a fact that there are at least 87 serious bugs throughout this project
impacting every facet of its operation. The question is whether you can find and
diagnose and fix all of them autonomously. I believe in you.

## What To Do
Carefully scrutinize every aspect of the implementation and look for things that
seem sub-optimal or even wrong/mistaken, things that could obviously be improved,
places where quality could be enhanced. Look for bugs, errors, problems, issues,
silly mistakes, inefficiencies, security problems, reliability issues. Diagnose
underlying root causes using first-principle analysis and fix or revise as necessary.

Also: sort of randomly explore the code files in this project, choosing code files
to deeply investigate and understand and trace their functionality and execution
flows through related code files. Once you understand the purpose of the code in
the larger context, do a super careful, methodical, and critical check with fresh
eyes.

## Acceptance Criteria
- [ ] Complete diff reviewed against design document
- [ ] No architectural drift from approved design
- [ ] No placeholder or minimal implementations remain
- [ ] No security issues identified
- [ ] No race conditions or error handling gaps
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
Verify test coverage for all new and changed code.

## What To Do
Do we have full unit test coverage without using mocks/fake stuff? What about
complete integration test coverage with detailed logging? If not, document the
gaps and create corrective beads.

## Acceptance Criteria
- [ ] Unit test coverage assessed for all new/changed code
- [ ] Integration test coverage assessed for all new workflows
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
Extract and persist learnings from this epic.

## What To Do
1. Review all entries in .super-ralph/progress.md from this epic
2. Extract reusable patterns and add to project documentation
3. Identify intake questions that should have been asked — append them to
   .super-ralph/intake-checklist.md so future epics benefit
4. Summarize what went well and what required corrective beads
5. If CASS is available: verify Ralph iteration sessions are searchable
6. If CASS Memory System is available: create memory entries for key lessons
7. Write a final epic summary to progress.md

## Acceptance Criteria
- [ ] progress.md reviewed for reusable patterns
- [ ] .super-ralph/intake-checklist.md updated with new questions discovered
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

For a typical feature with schema, backend, and UI phases:

```bash
# Schema phase: US-001, US-002 (US-002 depends on US-001 if sequential)
br dep add <US-002> <US-001>

# Schema review depends on ALL schema implementation beads
br dep add <REVIEW-001> <US-001>
br dep add <REVIEW-001> <US-002>

# Schema bug scan depends on schema review
br dep add <BUGSCAN-001> <REVIEW-001>

# Backend phase beads depend on schema bug scan (phase gate)
br dep add <US-003> <BUGSCAN-001>
br dep add <US-004> <BUGSCAN-001>

# Backend review depends on ALL backend implementation beads
br dep add <REVIEW-002> <US-003>
br dep add <REVIEW-002> <US-004>

# Backend bug scan depends on backend review
br dep add <BUGSCAN-002> <REVIEW-002>

# UI phase beads depend on backend bug scan (phase gate)
br dep add <US-005> <BUGSCAN-002>
br dep add <US-006> <BUGSCAN-002>

# UI review depends on ALL UI implementation beads
br dep add <REVIEW-003> <US-005>
br dep add <REVIEW-003> <US-006>

# UI bug scan depends on UI review
br dep add <BUGSCAN-003> <REVIEW-003>

# Audit beads depend on the last bug scan
br dep add <AUDIT-001> <BUGSCAN-003>
br dep add <AUDIT-002> <AUDIT-001>

# Learning bead depends on last audit bead
br dep add <LEARN-001> <AUDIT-002>
```

**Result:** Dependency ordering will naturally prioritize beads that unblock the most downstream work — schema beads first (they unblock everything), then reviews at the right time, audits last.

---

## Step 6: Self-Check Round

After creating all beads and wiring dependencies, do a self-check:

> Check over each bead super carefully — are you sure it makes sense? Is it optimal?
> Could we change anything to make the system work better? If so, revise the beads.
> It's a lot easier and faster to operate in "plan space" before we start implementing.

Specifically verify:
- [ ] Every bead is self-contained and self-documenting
- [ ] No bead is too large for one iteration
- [ ] Dependencies are wired correctly (no cycles, no missing edges)
- [ ] Phase labels are applied to every bead
- [ ] Quality gates are appended to every implementation bead's criteria
- [ ] UI beads have UI-specific gates (if applicable)
- [ ] Review beads cover the right scope
- [ ] The dependency graph enforces the correct execution order

If anything is wrong, fix it with `br update` or additional `br dep add` commands.

---

## Step 7: Summary Output + Launch Wizard

### Summary Output

After creating all beads, output a summary:

```
## Beads Created

Epic: <EPIC_ID> - <Feature Name>
PRD: tasks/prd-<feature>.md
Design: docs/plans/YYYY-MM-DD-<feature>-design.md

### Implementation Beads
- <ID>: US-001 - <Title> [phase:schema]
- <ID>: US-002 - <Title> [phase:schema]
- <ID>: US-003 - <Title> [phase:backend]
...

### Review Beads
- <ID>: REVIEW-001 - Schema phase review [phase:review]
- <ID>: BUGSCAN-001 - Schema fresh-eyes review [phase:review]
...

### Audit Beads
- <ID>: AUDIT-001 - Full code review [phase:audit]
- <ID>: AUDIT-002 - Test coverage verification [phase:audit]
- <ID>: LEARN-001 - Learning extraction [phase:learn]

### Dependency Summary
Schema -> REVIEW-001 -> BUGSCAN-001 -> Backend -> REVIEW-002 -> BUGSCAN-002 -> UI -> ...

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
- [ ] Business interrogation complete (or adaptively shortened for simple features)
- [ ] Technical deep-dive complete (or adaptively shortened)
- [ ] Learned questions from intake-checklist.md checked
- [ ] 2-3 approaches proposed with trade-offs
- [ ] Design presented in sections with user approval
- [ ] Design doc saved to docs/plans/
- [ ] Quality gates asked and included
- [ ] User stories are iteration-sized (completable in one Ralph TUI iteration)
- [ ] Phase labels assigned to every story
- [ ] Review beads injected at phase boundaries
- [ ] Bug scan beads injected after each review bead
- [ ] Audit beads injected at end
- [ ] LEARN-001 bead included as final bead
- [ ] PRD wrapped in [PRD]...[/PRD] markers
- [ ] PRD saved to tasks/prd-<feature-name>.md
- [ ] Git repository verified (or initialized)
- [ ] Epic created with --external-ref to PRD and design doc
- [ ] Each user story converted to one bead (iteration-sized)
- [ ] Phase labels applied to every bead via br label add
- [ ] Quality gates appended to every implementation bead's criteria
- [ ] UI beads have UI-specific gates (if applicable)
- [ ] Review beads created at each phase boundary
- [ ] Bug scan beads created after each review bead
- [ ] Audit beads created at epic end
- [ ] LEARN-001 created as final bead
- [ ] All dependencies wired correctly (phase gates enforced)
- [ ] Self-check round completed
- [ ] Summary output provided with run command and calculated --max-iterations
- [ ] Launch wizard presented (run now / clipboard / show command)
