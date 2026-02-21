# Superpowers + Ralph TUI SDLC Framework Design

> **For Claude:** This is a design document, not an implementation plan. Do not implement without explicit approval.

**Goal:** Create a unified software development lifecycle framework that combines Superpowers' rigorous intake/design/review methodology with Ralph TUI's autonomous execution loop, using Beads as the task tracking backbone and Emanuel's flywheel tools for cross-session intelligence.

**Architecture:** A pipeline where every piece of work — feature, bug, refactor, hotfix — enters through the same door and flows through four acts: relentless intake, autonomous execution, embedded review, and audited completion. Review checkpoints are not manual pauses — they are beads in the dependency tree, executed by Ralph like any other task. The pipeline uses Ralph TUI's existing extension points (custom PRD skills, custom prompt templates, beads tracker with BV) rather than building new plumbing.

**Key Principle:** Same pipeline, always. The intake phase determines the *depth* of treatment (a one-bead hotfix vs. a 20-bead feature), but the process is the same. No shortcuts, no special paths.

---

## 1. System Overview

### 1.1 The Three Systems

**Superpowers** (obra/superpowers) is a skills framework and SDLC methodology for AI coding agents. It provides mandatory, composable skills that govern how an agent thinks and works: brainstorming, planning, TDD, code review, debugging, and branch management. Skills trigger automatically and are not optional. The `brainstorming` and `writing-plans` skills are the core of the intake process. They are not replaced — they are invoked, extended, and their principles heavily reused.

**Ralph TUI** (subsy/ralph-tui) is a terminal UI that orchestrates AI coding agents through autonomous loops. It connects an agent to a task tracker and runs a SELECT -> PROMPT -> EXECUTE -> EVALUATE cycle, completing tasks one by one with session persistence, error handling, and real-time visibility. It implements Geoffrey Huntley's "Ralph Wiggum method" — a monolithic, single-process approach where each iteration gets a fresh context window and does one thing. Its key extension points: `--prd-skill` for custom intake, custom Handlebars prompt templates, and `skills_dir` for custom bead conversion.

**Emanuel's Flywheel** (jeffreyemanuel.com) is a collection of 14 interconnected tools for multi-agent development. The relevant pieces for this framework are: Beads Viewer (BV) for graph-theoretic task prioritization using PageRank, CASS for indexing and searching past agent sessions, the CASS Memory System for persistent cross-session learning, and Emanuel's iterative plan refinement methodology. Emanuel's workflow also provides battle-tested prompt patterns for code review, bug scanning, and UI/UX polish that become bead types in this framework.

### 1.2 The Integration Thesis

Superpowers excels at the *what* and *why* — interrogating requirements, producing designs, writing plans, reviewing work. Ralph TUI excels at the *how* — autonomous execution, session management, crash recovery, cross-iteration context. Emanuel's tools excel at the *memory* and *refinement* — making the system smarter over time and providing proven prompt patterns for review.

The integration uses existing extension points in Ralph TUI:
- **`--prd-skill`** for custom intake (extends Superpowers' brainstorming + writing-plans into the PRD format Ralph TUI expects)
- **Custom Handlebars prompt templates** for per-iteration self-review and learning
- **Beads with BV tracker** for graph-aware task selection
- **Bead labels and dependency ordering** for phase-based review checkpoints (review beads, not manual pauses)
- **`progress.md`** for compound cross-iteration learning
- **Custom `skills_dir` bead conversion skill** for injecting review/audit/learning beads into the dependency tree

No new plumbing is required. The framework is assembled from existing parts.

---

## 2. Pipeline: The Four Acts

### Act 1: Intake + Design + Plan

**Trigger:** Any work item — feature request, bug report, refactor idea, customer complaint, technical debt, shower thought.

**Mechanism:** `ralph-tui create-prd --prd-skill superpowers-intake`

**What happens:**

A custom PRD skill (`superpowers-intake`) drives a relentless interrogation process. It invokes and extends the principles from Superpowers' `brainstorming` and `writing-plans` skills. Unlike the default `ralph-tui-prd` skill (which asks 3-5 questions), this skill refuses to move forward until every ambiguity is resolved. It covers both business context and technical depth, then runs an iterative plan refinement loop before producing the final PRD.

#### 2.1 The Relentless Intake Protocol

The intake follows Superpowers' `brainstorming` skill flow (explore context -> ask questions -> propose approaches -> present design) but extends it with deeper, more relentless questioning. It has two phases that always run in sequence.

**Phase A: Business Interrogation**

The skill asks (one question at a time, multiple choice when possible, following Superpowers' one-question-per-message principle):

1. **What is this?** Classify: feature / bug / refactor / hotfix / technical debt / exploration.
2. **Why does this matter?** What's the business case? What happens if we don't do it? What's the cost of delay?
3. **Who is affected?** Which users? Which systems? Which teams? What are the downstream effects?
4. **What does success look like?** Not "it works" — measurably, in 6 months. What metrics change? What behavior changes?
5. **What are the boundaries?** What is this explicitly NOT? What's adjacent that we're not touching? What's tempting scope creep?
6. **What has been tried before?** Is there prior art in this codebase? Has this been attempted and abandoned? Why?
7. **What are the risks?** What could go wrong? What are the failure modes? What's the blast radius if it breaks?

**Phase B: Technical Deep-Dive**

The skill reads the codebase (using agent file search), then asks:

8. **What exists already?** Show the user what related code, patterns, and abstractions exist. Ask: should we extend these or build new?
9. **What's the data model?** If data is involved: what entities, what relationships, what storage, what migrations?
10. **What are the integration points?** What systems does this touch? APIs, databases, queues, external services?
11. **What are the edge cases?** Walk through error states, race conditions, empty states, permission boundaries.
12. **What are the performance constraints?** Latency budgets, data volume expectations, concurrency requirements.
13. **What's the testing strategy?** What's testable automatically? What requires manual verification? What's the test infrastructure?

**Phase C: Learned Questions (from `docs/intake-checklist.md`)**

The skill reads `docs/intake-checklist.md` (if it exists) for additional questions that have been learned from past projects. These are questions the team has discovered they should always ask — things like "did we consider soft deletes?", "what about rate limiting?", "does this need audit logging?" The checklist grows over time as the learning extraction step (Act 4) appends new entries.

**Adaptive depth:** The skill doesn't mechanically ask all questions. After each answer, it decides whether to dig deeper, move on, or generate the design. A one-bead hotfix might resolve in 4 questions. A major feature might take 15+ rounds.

#### 2.2 Design Document

Once the intake is complete, the skill produces a design document following the Superpowers `brainstorming` pattern: present the design in sections, get user approval chunk by chunk (not all at once). Propose 2-3 approaches with trade-offs and a recommendation before settling. Sections:

1. Overview (2-3 sentences)
2. Goals (bullet list, measurable)
3. Architecture (approach, patterns, key decisions)
4. Components (what's being built, what's being modified)
5. Data model changes (if any)
6. Error handling strategy
7. Testing approach
8. Non-goals (explicit scope boundaries)
9. Open questions (if any remain)

The design is saved to `docs/plans/YYYY-MM-DD-<feature>-design.md`.

#### 2.3 Iterative Plan Refinement (Emanuel Method)

After the design document is approved, the skill produces an initial implementation plan (user stories sized for Ralph iterations). Then comes a refinement loop borrowed from Emanuel's workflow.

**When to use this loop:** For features and substantial work. Skip for hotfixes and small bugs where the plan is obvious.

**The reviewer prompt** (used by all modes):

> Carefully review this entire plan for me and come up with your best revisions in terms of better architecture, new features, changed features, etc. to make it better, more robust/reliable, more performant, more compelling/useful, etc. For each proposed change, give me your detailed analysis and rationale/justification for why it would make the project better along with the git-diff style changes relative to the original markdown plan.

**Refinement modes:** The skill presents four options for how to run the review, plus a skip option:

1. **Auto-review (one round)** — The skill executes `opencode run` with the design doc and reviewer prompt, captures the output, presents it to the user, and integrates feedback upon approval. The user decides after each round whether to continue.

2. **Auto-review (full loop, 4-5 rounds unattended)** — The skill runs the complete Emanuel loop automatically: send for review, integrate feedback, repeat until steady-state. Stops when the reviewer signals STEADY_STATE or after 5 rounds. Presents a round-by-round summary at the end for user review.

3. **Copy to clipboard** — Copies the reviewer prompt + design doc content to the system clipboard via `pbcopy`. The user pastes into their tool of choice and brings the feedback back.

4. **Manual** — Current behavior. The skill provides the reviewer prompt and design doc path; the user handles the review process entirely.

5. **Skip** — Proceed directly to PRD generation.

**Automation via OpenCode CLI:** Modes 1 and 2 use [OpenCode](https://opencode.ai)'s non-interactive `run` subcommand to call a reviewer model directly from the terminal. The default reviewer model is `openai/gpt-5.2`. The CLI command shape:

```bash
opencode run -m openai/gpt-5.2 --variant <thinking_level> \
  -f <design_doc_path> \
  "<reviewer_prompt>"
```

**Thinking/reasoning level:** Before running the CLI (modes 1 and 2), the skill asks the user to select a reasoning effort level: `max` (deepest, slowest), `high` (recommended default), or `minimal` (fast, lighter). This maps to OpenCode's `--variant` flag, which controls provider-specific reasoning effort.

**Steady-state detection (mode 2 only):** Starting from round 2, the reviewer prompt is prefixed with an instruction asking the reviewer to respond with `STEADY_STATE` on the first line if remaining suggestions are only incremental or cosmetic. This allows the automated loop to terminate early when further refinement has diminishing returns.

**Round-by-round summary (mode 2 only):** After the loop completes, the skill presents how many rounds were run and the key changes made in each round (1-2 bullet points per round), then asks the user to review the final design doc before proceeding.

This keeps the refinement loop within terminal-based tools, eliminating manual copy-paste friction while preserving user control over the process.

#### 2.4 Plan -> User Stories -> PRD Output

After plan refinement, the skill converts the design into user stories. This follows Superpowers' `writing-plans` principles (bite-sized tasks, exact file paths, TDD, YAGNI) but shapes the output for Ralph TUI consumption.

**Sizing rule:** Each user story must be completable in ONE Ralph TUI iteration (one agent context window). If it can't be described in 2-3 sentences, it's too big. Split it.

**Ordering rule:** Stories are ordered by dependency. Schema/data changes first, then backend logic, then UI, then integration/polish.

**Phase labeling:** Each story is tagged with a phase: `schema`, `backend`, `ui`, `integration`, `test`, `docs`. These become bead labels.

**Quality gates:** Defined once in the PRD's Quality Gates section, automatically appended to each story's acceptance criteria during bead conversion.

**Review beads:** The PRD includes explicit review user stories at phase boundaries. These are not implementation tasks — they are review/checkpoint tasks that Ralph executes like any other bead. See Section 2.5.

**Output format:** The skill wraps the PRD in `[PRD]...[/PRD]` markers with `### US-XXX: Title` user stories, matching Ralph TUI's expected format exactly.

#### 2.5 Review Beads and Structural Beads

The key architectural insight: **phase checkpoints are beads, not pauses.** The bead creation step automatically injects structural beads into the dependency tree at the right positions:

**Review beads** (injected at phase boundaries):
```
US-001: Add user table schema           [phase:schema]
US-002: Add migration for indexes        [phase:schema]
REVIEW-001: Schema phase review          [phase:review]    ← depends on US-001, US-002
US-003: Build auth API endpoint          [phase:backend]   ← depends on REVIEW-001
US-004: Add input validation             [phase:backend]   ← depends on REVIEW-001
REVIEW-002: Backend phase review         [phase:review]    ← depends on US-003, US-004
US-005: Build login form component       [phase:ui]        ← depends on REVIEW-002
US-006: Add error handling UI            [phase:ui]        ← depends on REVIEW-002
REVIEW-003: UI phase review              [phase:review]    ← depends on US-005, US-006
```

Review beads have specific acceptance criteria baked in:
- Review all changes from this phase against the design document
- Run all quality gates and verify they pass
- Check for architectural drift, placeholder implementations, and scope creep
- Verify the remaining beads in subsequent phases still make sense
- Document findings in `progress.md`
- If issues found: create corrective beads as children of the current epic
- If fundamental issues found: document need for re-plan in `progress.md`

**Fresh-eyes bug review beads** (injected after each phase, borrowing Emanuel's prompt pattern):
```
BUGSCAN-001: Schema fresh-eyes review   [phase:review]    ← depends on REVIEW-001
```

These use Emanuel's "fresh eyes" prompt pattern:
> Carefully read over all of the new code written in this phase with "fresh eyes" looking super carefully for any obvious bugs, errors, problems, issues, silly mistakes, etc. Carefully fix anything you uncover. Document all findings in progress.md.

**Post-completion beads** (injected at the end of the epic):
```
AUDIT-001: Full code review              [phase:audit]     ← depends on all implementation beads
AUDIT-002: Test coverage verification    [phase:audit]     ← depends on AUDIT-001
AUDIT-003: Learning extraction           [phase:audit]     ← depends on AUDIT-002
```

**CASS/Memory bead** (final bead in the epic):
```
LEARN-001: Index sessions & extract lessons [phase:learn]  ← depends on AUDIT-003
```

This bead instructs the agent to:
- Summarize all learnings from `progress.md`
- Update `docs/intake-checklist.md` with new questions discovered during this epic
- If CASS is available, verify sessions are indexed
- If Memory System is available, create memory entries for key lessons

Ralph TUI executes all of these as regular beads — no special handling required. BV's dependency graph ensures they run in the right order. The review beads block downstream implementation beads, so nothing proceeds until the review passes.

#### 2.6 Bead Conversion

After the PRD is generated, Ralph TUI's built-in flow asks: "Create tasks as JSON or Beads?" The user chooses Beads.

A custom bead conversion skill (`superpowers-create-beads`, placed in `skills_dir`) converts the PRD to beads. It extends the bundled `ralph-tui-create-beads` skill's approach with:

- PRD -> Epic bead (with `--external-ref` linking back to the PRD file and the design doc)
- Each user story -> Child bead (with acceptance criteria + quality gates)
- Phase labels parsed from `[phase:xxx]` in story titles -> `bd label add` commands
- Dependencies -> `bd dep add` commands
- **Review beads automatically injected** at each phase boundary with correct dependencies
- **Fresh-eyes bug scan beads** injected after each review bead
- **Post-completion audit beads** injected at the end
- **Learning extraction bead** as the final bead in the epic

The conversion skill uses Emanuel's prompt for creating comprehensive beads:

> Take ALL of the PRD and create a comprehensive and granular set of beads for all this with tasks, subtasks, and dependency structure overlaid, with detailed comments so that the whole thing is totally self-contained and self-documenting (including relevant background, reasoning/justification, considerations, etc. — anything we'd want our "future self" to know about the goals and intentions and thought process). Use only the `bd` tool to create and modify the beads and add the dependencies.

After initial creation, the skill does a self-check round (also from Emanuel):

> Check over each bead super carefully — are you sure it makes sense? Is it optimal? Could we change anything to make the system work better? If so, revise the beads. It's a lot easier and faster to operate in "plan space" before we start implementing these things!

Result: `.beads/beads.jsonl` with a fully structured epic containing implementation beads, review beads, audit beads, and learning beads, all wired into the correct dependency order.

**Launch wizard:** After outputting the bead summary, the skill offers to launch execution immediately:

1. **Run headless** — Executes `ralph-tui run --headless --tracker beads-bv --epic <id>` directly in the current session. Streams structured logs to stdout. Before running, offers optional agent/model overrides (default: use project config). Progress can be checked from another terminal via `ralph-tui status --json`, and interrupted runs can be resumed with `ralph-tui resume`.
2. **Copy command to clipboard** — Copies the `ralph-tui run` command (without `--headless`, for TUI mode) to the system clipboard via `pbcopy`. The user pastes it in a new terminal tab.
3. **Show command** — Displays the command for manual copying.

The command is always displayed in the output regardless of which option is chosen.

---

### Act 2: Execution

**Trigger:** `ralph-tui run --tracker beads-bv --epic <id>` (or launched automatically by the bead creation skill's launch wizard)

**What happens:**

Ralph TUI takes over. It runs the autonomous loop:

1. **SELECT** — BV's PageRank algorithm identifies which unblocked bead has the highest graph-theoretic impact (i.e., unblocks the most downstream work). This is smarter than simple priority ordering.
2. **PROMPT** — A custom Handlebars template (`.ralph-tui-prompt.hbs`) builds the prompt. See Section 3 for template design. The template varies behavior based on bead type (implementation vs. review vs. audit).
3. **EXECUTE** — The agent (Claude Code, OpenCode, etc.) runs in a fresh context window. No memory of previous iterations. Back-pressure (tests, typecheck, lint) catches mechanical failures within the iteration.
4. **EVALUATE** — Ralph TUI detects the `<promise>COMPLETE</promise>` signal, marks the bead closed, syncs, and loops.

**How review beads flow through the loop:** When Ralph selects a review bead (because all its dependencies are met), the prompt template detects it's a review bead (from title prefix or label) and renders a review-specific prompt instead of an implementation prompt. The agent does the review, documents findings, optionally creates corrective beads, and signals completion. The downstream implementation beads then unblock.

**Cross-iteration learning:** Each iteration reads `progress.md` (via the `{{recentProgress}}` template variable) to understand what previous iterations accomplished. Each iteration appends its own learnings to `progress.md` before signaling completion. This is Huntley's "leave notes for future Ralphs" principle, already implemented by Ralph TUI.

**Error handling:** Configurable per project. Default: `skip` (move to next bead on failure). For critical work: `retry` with fallback agents. For CI: `abort`.

**Emanuel's "reread AGENTS.md" pattern:** If the agent does a context compaction mid-iteration, the prompt template includes instructions to re-read key files. This is handled by including file references in the template rather than relying on compaction-surviving context.

---

### Act 3: Phase Checkpoints (via Review Beads)

**Mechanism:** Review beads in the dependency tree. No manual pausing required.

Phase checkpoints are not a separate act that interrupts execution — they are beads that Ralph executes as part of the normal loop. They are placed in the dependency graph such that:

1. All implementation beads in phase N must complete before the phase N review bead unblocks.
2. All implementation beads in phase N+1 depend on the phase N review bead.
3. Ralph cannot skip or bypass review beads — they are dependencies.

**What a review bead does when Ralph executes it:**

1. **Diff review:** Read all changes made by beads in this phase (using git diff or file inspection).
2. **Design compliance:** Compare the implementation against the design document (referenced via `--external-ref` on the epic).
3. **Quality verification:** Run all quality gate commands. Verify they pass.
4. **Fresh-eyes scan:** Look for bugs, placeholder implementations, and scope creep (Emanuel's "fresh eyes" pattern).
5. **Plan validity check:** Look at the remaining beads. Do they still make sense? Document any concerns in `progress.md`.
6. **Decision output:** The review bead's completion signals that the phase is acceptable. If it finds issues that need fixing, it creates corrective beads as children of the epic with the appropriate dependencies (the corrective beads block the next phase's review bead, not the implementation beads).

**If a review bead determines things have gone fundamentally wrong:** It documents the need for a re-plan in `progress.md` and signals completion with a note. The operator can then pause Ralph, re-run the intake process for the remaining work, cancel obsolete beads, and inject new ones. This is the escape hatch — it rarely fires, but it exists.

**Phase boundary schedule (typical):**

| Phase | Contains | Review bead focus |
|---|---|---|
| `schema` | Migrations, data model changes | Data model correct? Relationships right? Migrations reversible? |
| `backend` | Server actions, API logic, business rules | Logic correct? Error handling complete? Tests covering edge cases? |
| `ui` | Components, pages, user interactions | Matches design? Accessible? Responsive? No broken interactions? |
| `integration` | Cross-cutting, polish, final wiring | Everything works together? Edge cases handled? Performance acceptable? |

---

### Act 4: Audit + Finish

**Trigger:** All implementation and review beads are closed. The audit beads unblock.

**Mechanism:** Audit beads in the dependency tree — these are regular beads that Ralph executes.

**AUDIT-001: Full code review**

The agent reviews the entire diff from the epic's branch against the design document. This uses a combination of Superpowers' `requesting-code-review` principles and Emanuel's deep review prompts:

> Carefully scrutinize every aspect of the implementation and look for things that seem sub-optimal or even wrong/mistaken, things that could obviously be improved, places where quality could be enhanced. Look for bugs, errors, problems, issues, silly mistakes, inefficiencies, security problems, reliability issues. Diagnose underlying root causes using first-principle analysis and fix or revise as necessary.

Acceptance criteria:
- [ ] All code changes reviewed against the design document
- [ ] No architectural drift from the approved design
- [ ] No placeholder or minimal implementations remain
- [ ] All quality gates pass
- [ ] No obvious security issues, race conditions, or error handling gaps
- [ ] Findings documented in `progress.md`

**AUDIT-002: Test coverage verification**

> Do we have full unit test coverage without using mocks/fake stuff? What about complete integration test coverage with detailed logging? If gaps exist, create corrective beads to fill them.

Acceptance criteria:
- [ ] Unit test coverage assessed for all new/changed code
- [ ] Integration test coverage assessed for all new workflows
- [ ] Gaps documented; corrective beads created if needed
- [ ] All existing tests still pass

**AUDIT-003: Learning extraction**

This bead extracts and persists learnings from the entire epic:
- [ ] Review all entries in `progress.md` from this epic
- [ ] Extract reusable patterns and add to project documentation
- [ ] Identify intake questions that should have been asked — append to `docs/intake-checklist.md`
- [ ] Summarize what went well and what required corrective beads
- [ ] If CASS is available: verify Ralph iteration sessions are searchable
- [ ] If CASS Memory System is available: create memory entries for key lessons

**Branch decision (after all audit beads complete):**

The operator reviews the audit bead outputs and makes the final call:
- Merge to main (if quality is high and tests pass)
- Open a PR for human review (if the work warrants a second pair of eyes)
- Keep the branch for more work (if the audits found issues needing more beads)
- Discard (if the approach was wrong)

This step remains manual and human-driven. The audits provide the evidence; the human makes the decision.

---

## 3. Custom Prompt Template Design

The custom `.ralph-tui-prompt.hbs` template governs what each Ralph iteration sees and does. It must handle three bead types: implementation, review, and audit.

### 3.1 Template Structure

```handlebars
{{!-- PRD Context --}}
{{#if prdContent}}
## Project Context

We are implementing the following PRD:

{{prdContent}}

---
{{/if}}

{{!-- BV selection reasoning --}}
{{#if selectionReason}}
## Why This Task Was Selected
{{selectionReason}}
{{/if}}

## Your Task: {{taskId}} - {{taskTitle}}

{{#if taskDescription}}
### Description
{{taskDescription}}
{{/if}}

{{#if acceptanceCriteria}}
### Acceptance Criteria
{{acceptanceCriteria}}
{{/if}}

{{#if dependsOn}}
**Prerequisites completed:** {{dependsOn}}
{{/if}}

{{#if blocks}}
**Your work unblocks:** {{blocks}}
{{/if}}

{{#if recentProgress}}
## What Previous Iterations Accomplished
{{recentProgress}}
{{/if}}

## Workflow

1. Read the AGENTS.md and README.md files carefully if they exist.
2. Study the PRD context to understand the bigger picture.
3. Read `.ralph-tui/progress.md` for learnings, patterns, and gotchas from previous iterations.
4. Search the codebase before implementing. Do not assume something doesn't exist. Do not assume something is not implemented. Use subagents for search.
5. Implement this task following the acceptance criteria exactly.
6. Run all quality gate commands. Fix any failures before proceeding.
7. Self-review (see below).
8. Commit with message: `feat: {{taskId}} - {{taskTitle}}`
9. Document learnings in progress.md (see below).
10. Signal completion.

## Self-Review (REQUIRED before committing)

Before committing your work, verify:
- [ ] Every acceptance criterion is met (check each one explicitly).
- [ ] All quality gate commands pass (typecheck, lint, test, build as applicable).
- [ ] No placeholder or minimal implementations. Full implementations only.
- [ ] No code was written that goes beyond this task's scope.
- [ ] If you found a bug unrelated to this task, document it in progress.md but do not fix it unless it blocks your work.

If any criterion is NOT met, fix it before committing. If it cannot be fixed within this task's scope, document the gap in progress.md and signal completion with a note about what remains.

## Before Completing

APPEND to `.ralph-tui/progress.md`:

### [Date] - {{taskId}}: {{taskTitle}}
- **What was implemented:** [summary]
- **Files changed:** [list]
- **Learnings:**
  - [Patterns discovered]
  - [Gotchas encountered]
  - [Things the next iteration should know]

If you discovered a reusable pattern, also add it to the `## Codebase Patterns` section at the TOP of progress.md.

## Stop Condition

If the work described in this task is already complete (implemented in a previous iteration or already exists in the codebase), verify it meets the acceptance criteria and signal completion immediately. Do not re-implement.

When finished (or if already complete), signal completion with:
<promise>COMPLETE</promise>
```

### 3.2 Template Rationale

**PRD context first:** The agent reads the big picture before the specific task. This grounds the iteration in the overall design.

**AGENTS.md and README.md:** Following Emanuel's pattern of ensuring the agent reads project-level instructions on every iteration, especially important after context compaction.

**Selection reasoning (from BV):** When using `beads-bv`, the agent sees *why* this task was chosen — e.g., "This task unblocks 4 downstream tasks." This helps the agent understand the importance and avoid cutting corners.

**Codebase search before implementing:** Huntley's "don't assume it's not implemented" principle. A common failure in Ralph loops is the agent re-implementing something that already exists.

**Previous progress:** The `{{recentProgress}}` variable gives the agent a summary of what came before. This is the compound learning mechanism — each iteration is smarter than the last because it knows what was built and what was learned.

**Self-review before commit:** This is the "free" review layer. It catches mechanical issues: tests not passing, acceptance criteria not met, placeholder implementations. It doesn't catch architectural drift (that's what review beads are for), but it prevents the most common Ralph failures.

**Learning documentation:** Every iteration leaves a note for future iterations. This is Huntley's "capture the importance of tests in the moment" principle generalized. When the next iteration reads progress.md, it knows about gotchas, patterns, and decisions.

**Note on review/audit beads:** Review and audit beads use the same template, but their acceptance criteria (embedded in the bead description) are review-oriented rather than implementation-oriented. The template doesn't need conditional logic for different bead types — the bead's own description drives the agent's behavior.

---

## 4. Custom PRD Skill Design: `superpowers-intake`

### 4.1 Skill Location

```
<skills_dir>/superpowers-intake/SKILL.md
```

Configured in `.ralph-tui/config.toml`:
```toml
skills_dir = "./skills"
```

Invoked via:
```bash
ralph-tui create-prd --prd-skill superpowers-intake
```

### 4.2 Skill Relationship to Superpowers

This skill **invokes and extends** Superpowers' brainstorming and writing-plans skills rather than replacing them. Specifically:

- It follows the `brainstorming` skill's process flow: explore project context -> ask clarifying questions -> propose 2-3 approaches -> present design in sections -> get user approval -> write design doc
- It follows the `writing-plans` skill's task granularity principles: bite-sized tasks (completable in one Ralph iteration), exact file paths, TDD emphasis, DRY, YAGNI, frequent commits
- It extends both with: the relentless intake protocol (13+ questions across business and technical dimensions), the learned questions from `docs/intake-checklist.md`, the iterative plan refinement loop (Emanuel method), phase labeling, and review bead injection
- It shapes the output for Ralph TUI's PRD format rather than Superpowers' plan format

### 4.3 Skill Responsibilities

1. Run the relentless intake protocol (Section 2.1) including learned questions
2. Produce a design document and save it, following Superpowers' brainstorming pattern (Section 2.2)
3. Guide the user through the iterative plan refinement loop (Section 2.3)
4. Convert the refined plan into iteration-sized user stories with phase labels (Section 2.4)
5. Include review beads at phase boundaries in the PRD (Section 2.5)
6. Include audit and learning beads at the end of the PRD (Section 2.5)
7. Output the PRD in `[PRD]...[/PRD]` format with `### US-XXX:` story headings
8. Include a Quality Gates section

### 4.4 Output Format Requirements

The output must comply with Ralph TUI's PRD parsing expectations. Phase labels in square brackets are parsed by the custom bead conversion skill:

```markdown
[PRD]
# PRD: <Feature Name>

## Overview
<2-3 sentences>

## Goals
- <measurable goal>
- <measurable goal>

## Quality Gates

These commands must pass for every user story:
- `<command>` - <description>
- `<command>` - <description>

For UI stories, also include:
- <UI-specific gate>

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

### US-003: <Title> [phase:backend]
**Description:** ...

### REVIEW-002: Backend phase review [phase:review]
**Description:** ...

### US-005: <Title> [phase:ui]
**Description:** ...

### REVIEW-003: UI phase review [phase:review]
**Description:** ...

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
- [ ] docs/intake-checklist.md updated with new questions
- [ ] Epic summary written to progress.md

## Non-Goals
- <what this is NOT>

## Design Reference
See: docs/plans/YYYY-MM-DD-<feature>-design.md
[/PRD]
```

### 4.5 Phase Label Convention

Phase labels are included in the story title in square brackets. The custom bead conversion skill parses these and applies them as bead labels via `bd label add`.

Supported phases:
- `[phase:schema]` — Database migrations, data model changes
- `[phase:backend]` — Server actions, API logic, business rules
- `[phase:ui]` — Components, pages, user interactions
- `[phase:integration]` — Cross-cutting concerns, polish, final wiring
- `[phase:test]` — Test infrastructure, test data, test utilities
- `[phase:docs]` — Documentation updates
- `[phase:review]` — Phase checkpoint review beads
- `[phase:audit]` — Post-completion audit beads
- `[phase:learn]` — Learning extraction beads

---

## 5. Custom Bead Conversion Skill: `superpowers-create-beads`

### 5.1 Skill Location

```
<skills_dir>/superpowers-create-beads/SKILL.md
```

This is a custom version of the bundled `ralph-tui-create-beads` skill, placed in `skills_dir`. It follows the same pattern (using `bd create`, `bd dep add`, `bd label add`) but adds:

### 5.2 Additional Responsibilities (beyond bundled skill)

1. **Parse phase labels** from `[phase:xxx]` in story titles and apply as bead labels
2. **Wire review bead dependencies:** Review beads depend on all implementation beads in their phase. Next-phase implementation beads depend on the review bead.
3. **Wire fresh-eyes bug scan beads** after each review bead
4. **Wire audit beads** at the end, depending on all implementation and review beads
5. **Wire learning bead** as the final bead, depending on audit beads
6. **Self-documentation:** Each bead's description includes relevant background, reasoning, and context so that the bead is self-contained (following Emanuel's pattern of making beads "totally self-contained and self-documenting")
7. **Self-check round:** After creating all beads, review them for optimality (Emanuel's "check over each bead super carefully" pattern)

### 5.3 Dependency Graph Structure

For a typical feature with schema, backend, and UI phases:

```
Epic: "Feature X"
├── US-001: Schema task 1          [phase:schema]
├── US-002: Schema task 2          [phase:schema]      depends on US-001
├── REVIEW-001: Schema review      [phase:review]      depends on US-001, US-002
├── BUGSCAN-001: Schema bug scan   [phase:review]      depends on REVIEW-001
├── US-003: Backend task 1         [phase:backend]      depends on BUGSCAN-001
├── US-004: Backend task 2         [phase:backend]      depends on BUGSCAN-001
├── REVIEW-002: Backend review     [phase:review]      depends on US-003, US-004
├── BUGSCAN-002: Backend bug scan  [phase:review]      depends on REVIEW-002
├── US-005: UI task 1              [phase:ui]           depends on BUGSCAN-002
├── US-006: UI task 2              [phase:ui]           depends on BUGSCAN-002
├── REVIEW-003: UI review          [phase:review]      depends on US-005, US-006
├── BUGSCAN-003: UI bug scan       [phase:review]      depends on REVIEW-003
├── AUDIT-001: Full code review    [phase:audit]        depends on BUGSCAN-003
├── AUDIT-002: Test coverage       [phase:audit]        depends on AUDIT-001
└── LEARN-001: Learning extraction [phase:learn]        depends on AUDIT-002
```

BV's PageRank will naturally prioritize beads that unblock the most downstream work, ensuring schema work happens first, reviews happen at the right time, and audits happen last.

---

## 6. Emanuel's Prompt Patterns (Reference)

These prompts are embedded in the appropriate bead descriptions and template sections. Documented here as a reference library.

### 6.1 Fresh-Eyes Bug Review (used in BUGSCAN beads)

> Carefully read over all of the new code just written in this phase with "fresh eyes" looking super carefully for any obvious bugs, errors, problems, issues, silly mistakes, etc. Carefully fix anything you uncover.

### 6.2 Deep Code Exploration (used in AUDIT beads)

> Sort of randomly explore the code files in this project, choosing code files to deeply investigate and understand and trace their functionality and execution flows through the related code files which they import or which they are imported by. Once you understand the purpose of the code in the larger context of the workflows, do a super careful, methodical, and critical check with "fresh eyes" to find any obvious bugs, problems, errors, issues, silly mistakes, etc. and then systematically and meticulously and intelligently correct them.

### 6.3 Cross-Agent Code Review (used in multi-agent setups)

> Turn your attention to reviewing the code written by your fellow agents and checking for any issues, bugs, errors, problems, inefficiencies, security problems, reliability issues, etc. and carefully diagnose their underlying root causes using first-principle analysis and then fix or revise them if necessary. Don't restrict yourself to the latest commits, cast a wider net and go super deep.

### 6.4 Test Coverage Assessment (used in AUDIT-002 beads)

> Do we have full unit test coverage without using mocks/fake stuff? What about complete e2e integration test scripts with great, detailed logging? If not, document the gaps and create corrective beads.

### 6.5 UI/UX Polish (optional, used when applicable)

> Carefully consider desktop UI/UX and mobile UI/UX separately and hyper-optimize for both separately. Look for true world-class visual appeal, polish, slickness that follows UI/UX best practices like those used by Stripe.

### 6.6 Structured Commit (used in template workflow step)

> Based on your knowledge of the project, commit all changed files in a series of logically connected groupings with super detailed commit messages for each. Take your time to do it right. Don't edit the code at all. Don't commit obviously ephemeral files.

### 6.7 Bead Quality Check (used in bead conversion skill)

> Check over each bead super carefully — are you sure it makes sense? Is it optimal? Could we change anything to make the system work better? If so, revise the beads. It's a lot easier and faster to operate in "plan space" before we start implementing.

---

## 7. Configuration

### 7.1 Ralph TUI Config (`.ralph-tui/config.toml`)

During `super-ralph-init`, the user selects which agent Ralph TUI should use for iterations. The init skill sets the `agent` and `model` values accordingly:

| Agent | `agent` value | Default `model` |
|-------|--------------|----------------|
| Claude Code | `claude` | `claude-sonnet-4-6` |
| OpenCode | `opencode` | `anthropic/claude-sonnet-4-6` |
| Codex | `codex` | `5.3-codex` |
| Gemini | `gemini` | `gemini-2.5-pro` |
| Droid | `droid` | *(user must configure)* |
| Kiro | `kiro` | *(user must configure)* |

The user can override the default model during init. Example config for Claude (the recommended default):

```toml
agent = "claude"
tracker = "beads-bv"
skills_dir = "./skills"
prompt_template = "./.ralph-tui-prompt.hbs"
autoCommit = false
subagentTracingDetail = "moderate"

[agentOptions]
model = "claude-sonnet-4-6"

[errorHandling]
strategy = "skip"
maxRetries = 3

[notifications]
enabled = true
sound = "off"
```

### 7.3 Tracker Choice: `beads-bv` vs `beads-rust`

This framework uses `beads-bv` as the default tracker because its PageRank-based task selection is particularly valuable for the dependency-heavy graphs this framework creates (review beads blocking entire phases, audit beads depending on everything).

**Alternative: `beads-rust`** (`br` CLI) is a high-performance Rust rewrite of the original `bd` with SQLite + JSONL storage and automatic PRD context injection into prompts. Trade-offs:

| | `beads-bv` | `beads-rust` |
|---|---|---|
| Task selection | Graph-optimized (PageRank, betweenness, blocker ratio) | Simple (priority + dependency order) |
| CLI | `bd` + `bv` | `br` |
| Storage | JSONL | SQLite + JSONL |
| PRD injection | Manual (via template) | Automatic (via `--external-ref`) |
| Best for | Complex dependency graphs with review/audit beads | Simpler epics, faster storage |

If you switch to `beads-rust`, replace `bd` with `br` in the bead conversion skill and set `tracker = "beads-rust"` in config. The bead conversion skill commands are identical — `br create`, `br dep add`, `br label add` mirror `bd` exactly.

### 7.2 Project Structure

```
project/
├── .ralph-tui/
│   ├── config.toml              # Ralph TUI configuration
│   ├── progress.md              # Cross-iteration learning (auto-managed)
│   └── iterations/              # Iteration logs (auto-managed)
├── .ralph-tui-prompt.hbs        # Custom prompt template (Section 3)
├── .beads/
│   └── beads.jsonl              # Bead tracker data
├── skills/
│   ├── superpowers-intake/
│   │   └── SKILL.md             # Custom PRD skill (Section 4)
│   └── superpowers-create-beads/
│       └── SKILL.md             # Custom bead conversion skill (Section 5)
├── docs/
│   ├── plans/
│   │   └── YYYY-MM-DD-*.md      # Design documents
│   └── intake-checklist.md      # Growing intake question checklist
├── tasks/
│   └── prd-*.md                 # Generated PRDs
├── AGENTS.md                    # Project-level agent instructions
└── README.md                    # Project documentation
```

---

## 8. Workflow Summary (Operator Perspective)

### Starting new work:

```bash
# 1. Create PRD with relentless intake
ralph-tui create-prd --prd-skill superpowers-intake

# 2. (Optional) Run Emanuel's plan refinement loop:
#    Paste plan into GPT Pro with extended reasoning
#    Get revisions, paste back into Claude Code to revise plan
#    Repeat 4-5 rounds until steady-state

# 3. Choose "Beads" when prompted for task format
#    -> Uses superpowers-create-beads skill
#    -> Implementation beads + review beads + audit beads + learning bead
#    -> All wired into dependency tree

# 4. Launch (skill offers: run headless, copy to clipboard, or show command)
ralph-tui run --tracker beads-bv --epic <epic-id>

# 5. Ralph runs autonomously through:
#    - Implementation beads (fresh context each iteration)
#    - Review beads at phase boundaries (automatic, no manual pause)
#    - Bug scan beads after each phase
#    - Audit beads at the end
#    - Learning extraction as the final bead

# 6. When all beads are done, review audit outputs and make branch decision
```

### If a review bead finds problems:

Ralph's review bead documents findings and creates corrective beads. These corrective beads are wired as dependencies of the next phase's review bead. Ralph automatically picks them up in the next iteration. No manual intervention required unless the review bead flags a fundamental re-plan need.

### If a fundamental re-plan is needed:

```bash
# 1. Pause Ralph TUI (press 'p')
# 2. Cancel remaining obsolete beads
# 3. Re-run intake for remaining work:
ralph-tui create-prd --prd-skill superpowers-intake
# 4. New beads created under the same or new epic
# 5. Resume Ralph TUI
```

### Post-completion (after all beads including LEARN-001 are done):

```bash
# Review audit bead outputs in progress.md
# Make branch decision: merge / PR / keep / discard
# The learning extraction bead has already updated docs/intake-checklist.md
```

---

## 9. What This Framework Does NOT Do

- **No multi-agent orchestration by default.** Ralph TUI runs one agent at a time (though parallel mode exists for independent beads). This is intentional — Huntley's monolithic approach avoids the complexity of non-deterministic multi-agent coordination. However, Emanuel's multi-agent swarm approach can be used alongside this framework for projects that benefit from it.
- **No automatic re-planning.** When a review bead determines things have gone fundamentally wrong, it documents the finding but doesn't re-plan. The operator must intervene. Self-healing would be a future enhancement.
- **No approval workflows.** There's no built-in "manager approves the design" step. The operator is the approver.
- **No integration with external project management.** Beads is the tracker. There's no sync with Jira, Linear, GitHub Issues, etc. (though Ralph TUI has plugin architecture for future trackers).

---

## 10. Success Criteria

The framework is successful when:

1. Every piece of work (feature, bug, hotfix, refactor) follows the same pipeline without manual deviation.
2. The intake phase catches requirements ambiguity that would otherwise surface as mid-implementation rework.
3. Ralph TUI runs autonomously through the entire epic — including review beads and audit beads — without human intervention (except for the final branch decision and rare re-plan scenarios).
4. Review beads catch architectural drift before it compounds into downstream phases.
5. Audit beads rarely find issues that review beads should have caught earlier.
6. The system gets measurably better over time — the `docs/intake-checklist.md` grows, fewer corrective beads are needed per epic, fewer re-plans, faster completion.
7. CASS session search provides useful context for future work on similar features.

---

## 11. Resolved Questions

### From v1

1. **Phase label parsing:** Resolved by writing a custom `superpowers-create-beads` skill in `skills_dir`. The bundled skill is not extended — a custom skill is written that follows the same pattern but adds phase labels, review beads, and audit beads.

2. **Automated phase pause:** Resolved by making phase checkpoints into beads. No pausing needed — Ralph executes review beads like any other bead. The dependency tree ensures they run at the right time.

3. **CASS and Memory System integration:** These are wired in as the final `LEARN-001` bead in the dependency tree. The bead instructs the agent to index sessions and extract lessons. This keeps the integration lightweight — it's a bead, not a system-level integration.

4. **Superpowers skill compatibility:** The `superpowers-intake` skill invokes and extends Superpowers' `brainstorming` and `writing-plans` skills. It follows their principles, reuses their process flows, and extends them with deeper questioning and PRD-formatted output.

5. **Intake question evolution:** The intake checklist lives in `docs/intake-checklist.md`. The `LEARN-001` bead at the end of each epic appends new questions discovered during implementation. The `superpowers-intake` skill reads this file during Phase C of the intake protocol.

6. **Parallel execution interaction:** Review beads depend on ALL implementation beads in their phase. In parallel mode, all parallel workers in a phase must complete before the review bead unblocks. This is handled naturally by the dependency graph — no special parallel logic needed.

### From v2

7. **Review bead prompt specificity (v2 #1):** Bead description is sufficient — no template branching needed. The template is type-agnostic; the bead's `{{taskTitle}}` and `{{taskDescription}}` drive behavior.

8. **Multi-agent swarm integration (v2 #3):** Deferred. Not part of the current design scope. Ralph TUI's single-agent loop is sufficient for the initial framework.

9. **Plan refinement loop automation (v2 #4):** Use OpenCode configured with the OpenAI provider (ChatGPT Plus/Pro) for the reviewer role. See Section 2.3.

---

## 12. Open Questions (v2)

### Resolved

1. **Review bead prompt specificity:** ~~Should review beads have a completely different prompt template section (detected by bead label), or is embedding review instructions in the bead description sufficient?~~ **Resolved: bead description is sufficient.** The Handlebars template doesn't need conditional branching for different bead types. Review beads use the same template as implementation beads — their `{{taskTitle}}` (e.g., "REVIEW-001: Schema phase review") and `{{taskDescription}}` (containing review instructions and acceptance criteria) drive the agent's behavior. The template is type-agnostic; the bead's own content determines what the agent does. If review quality proves insufficient in practice, template branching can be added later as an optimization.

2. **Corrective bead creation from review beads:** When a review bead creates corrective beads, how does it wire the dependencies? The agent needs to use `bd create` and `bd dep add` within the review iteration. This requires the agent to have access to `bd` CLI. Need to verify Ralph TUI's sandbox settings allow this.

3. **Emanuel's multi-agent swarm integration:** ~~For large epics, should we document how to use Emanuel's NTM + Agent Mail approach alongside Ralph TUI?~~ **Deferred.** Multi-agent swarm integration is noted for future follow-up but is not part of the current design scope. Ralph TUI's single-agent loop (with optional parallel mode for independent beads) is sufficient for the initial framework. If project scale demands multi-agent orchestration, this can be revisited as a separate design extension.

4. **Plan refinement loop automation:** ~~The GPT Pro refinement loop is currently manual (paste back and forth). Could this be automated?~~ **Resolved: use OpenCode.** OpenCode supports 75+ providers including OpenAI (ChatGPT Plus/Pro via `/connect`), OpenRouter, Anthropic, and Google. The refinement loop runs in terminal: OpenCode configured with GPT Pro for review, Claude Code for plan revision. See Section 2.3 for the updated workflow. Full scripted automation (calling multiple model APIs in sequence) remains a future enhancement but the manual friction is already reduced to terminal copy-paste between two tool windows.

### Still Open

5. **Corrective bead dependency wiring (from #2):** Need to verify that Ralph TUI's agent sandbox allows the agent to run `bd create` and `bd dep add` during a review bead iteration. If sandboxed, the review bead would need to document corrective work in `progress.md` for the operator to create manually.
