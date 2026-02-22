# Superpowers Intake — Custom PRD Skill for Ralph TUI

> A relentless intake protocol that extends Superpowers' brainstorming and writing-plans methodology,
> producing PRDs optimized for Ralph TUI autonomous execution with embedded review/audit beads.

---

## The Job

1. Run the relentless intake protocol (business interrogation + technical deep-dive + learned questions)
2. Produce a design document with user approval (following Superpowers' brainstorming pattern)
3. Guide the user through the iterative plan refinement loop (Emanuel method)
4. Convert the refined plan into iteration-sized user stories with phase labels
5. Inject review, bug scan, audit, and learning beads at the right positions
6. Output the PRD wrapped in `[PRD]...[/PRD]` markers for Ralph TUI parsing

**Important:** Do NOT implement anything. Just create the PRD.

**Announce at start:** "I'm using the superpowers-intake skill for relentless intake and PRD generation."

---

## Work Types

The intake depth and pipeline steps vary based on the work type. This is typically set by the slash command that invoked this skill (e.g., `/superralph:feature` sets `work_type = "feature"`). If no work type is set, determine it during Phase A of intake.

| Work Type | Intake Depth | Design Doc | Refinement | PRD | Beads + Launch |
|-----------|-------------|------------|------------|-----|----------------|
| **feature** | Full (all phases, 10-15+ questions) | Yes | Yes (offer all modes) | Yes | Yes |
| **bug** | Medium (reproduce, root cause, 4-8 questions) | No — skip Step 2 | Yes (still offer) | Yes | Yes |
| **hotfix** | Minimal (what's broken + what's the fix, 1-2 questions) | No — skip Step 2 | No — skip Step 3 | Yes (1-3 stories) | Yes |
| **refactor** | Medium (pain points, desired state, risks, 5-10 questions) | Yes | No — skip Step 3 | Yes | Yes |
| **plan** | Full (same as feature) | Yes | Yes | **No** — stop after design doc | **No** |

When a step is skipped for a given work type, proceed directly to the next applicable step.

**Seed description:** If the user provided a description with the command (e.g., `/superralph:feature add dark mode toggle`), use it as starting context. Begin Phase A by confirming the description rather than asking "what is this?" from scratch.

---

## Process Flow

```
Explore project context
        ↓
Phase A: Business Interrogation (one question at a time)
        ↓
Phase B: Technical Deep-Dive (one question at a time)
        ↓
Phase C: Learned Questions (from docs/intake-checklist.md)
        ↓
[feature, refactor, plan] Present design in sections → get user approval
        ↓
[feature, refactor, plan] Save design doc to docs/plans/
        ↓
[plan stops here]
        ↓
Generate initial user stories
        ↓
[feature, bug] (Optional) Iterative plan refinement loop
        ↓
Generate final PRD with review/audit/learning beads
        ↓
Output wrapped in [PRD]...[/PRD]
        ↓
Invoke super-ralph-create-beads skill automatically
```

---

## Step 0: Explore Project Context

Before asking any questions:

1. Read `AGENTS.md` and `README.md` if they exist
2. Read `.ralph-tui/progress.md` if it exists (for learnings from past epics)
3. Explore the codebase structure — what exists, what patterns are in use, what's the tech stack
4. Read `docs/intake-checklist.md` if it exists (needed for Phase C)

This grounds your questions in the reality of the project, not abstract possibilities.

---

## Step 1: Relentless Intake Protocol

Ask questions **one at a time**, using multiple choice when possible. After each answer, decide whether to dig deeper, move on, or generate the design. Do not mechanically ask all questions — adapt based on the work item's complexity.

A one-bead hotfix might resolve in 4 questions. A major feature might take 15+ rounds.

### Phase A: Business Interrogation

1. **What is this?** If `work_type` was set by a slash command, skip this question — the type is already known. If a seed description was provided, confirm it: "You want to [description] — is that right, or should I adjust?" Otherwise, classify the work:
   - A. New feature
   - B. Bug fix
   - C. Refactor / technical debt
   - D. Hotfix (urgent production issue)
   - E. Exploration / spike

2. **Why does this matter?** What's the business case? What happens if we don't do it? What's the cost of delay?

3. **Who is affected?** Which users? Which systems? Which teams? What are the downstream effects?

4. **What does success look like?** Not "it works" — measurably, what changes? What metrics improve? What behavior changes?

5. **What are the boundaries?** What is this explicitly NOT? What's adjacent that we're not touching? What's tempting scope creep?

6. **What has been tried before?** Is there prior art in this codebase? Has this been attempted and abandoned? Why?

7. **What are the risks?** What could go wrong? What are the failure modes? What's the blast radius if it breaks?

### Phase B: Technical Deep-Dive

After reading the codebase (Step 0), ask:

8. **What exists already?** Present what you found — related code, patterns, abstractions. Ask: should we extend these or build new?

9. **What's the data model?** If data is involved: what entities, relationships, storage, migrations?

10. **What are the integration points?** What systems does this touch? APIs, databases, queues, external services?

11. **What are the edge cases?** Walk through error states, race conditions, empty states, permission boundaries.

12. **What are the performance constraints?** Latency budgets, data volume expectations, concurrency requirements.

13. **What's the testing strategy?** What's testable automatically? What requires manual verification? What's the test infrastructure?

### Phase C: Learned Questions

Read `docs/intake-checklist.md` if it exists. For each category of learned questions, assess whether any are relevant to this work item. If so, ask them. These are questions the team discovered they should always ask — things learned from past epics.

Not every question applies to every piece of work. Use judgment. If the checklist has 20 questions but only 3 are relevant, ask those 3.

### Adaptive Depth

After each answer, decide:
- **Dig deeper** — the answer revealed complexity or ambiguity
- **Move on** — the answer is clear and sufficient
- **Generate the design** — enough context to proceed

Signal to the user when you believe you have enough context: "I think I have enough to draft the design. Any final thoughts before I proceed?"

---

## Step 2: Design Document

Once the intake is complete, produce a design document following the Superpowers brainstorming pattern:

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

**If work_type = "plan":** STOP HERE. Tell the user:

> "Design doc saved to `docs/plans/YYYY-MM-DD-<feature>-design.md`. Run `/superralph:feature` when you're ready to execute this plan."

Do NOT proceed to Step 3 or beyond.

**If work_type = "bug" or "hotfix":** Skip this step entirely — proceed directly to Step 3 (or Step 4 for hotfix).

---

## Step 3: Iterative Plan Refinement (Emanuel Method)

After the design is approved, generate an initial set of user stories (iteration-sized, see sizing rules below). Then offer the plan refinement loop.

**When to offer this:** For feature and bug work types. Skip for hotfix and refactor.

**The reviewer prompt** (used by all modes below):

> Carefully review this entire plan for me and come up with your best revisions in terms of better architecture, new features, changed features, etc. to make it better, more robust/reliable, more performant, more compelling/useful, etc. For each proposed change, give me your detailed analysis and rationale/justification for why it would make the project better along with the git-diff style changes relative to the original markdown plan.

### Offering the refinement loop

Present the user with these options:

> "The initial plan is ready. For substantial features, Emanuel's iterative refinement loop improves the plan significantly. How would you like to run the review?
>
> 1. **Auto-review (one round)** — I'll run `opencode run` with the design doc and reviewer prompt using `openai/gpt-5.2`. You review the output and decide whether to integrate.
> 2. **Auto-review (full loop, 4-5 rounds unattended)** — I'll run the full Emanuel loop automatically — send for review, integrate feedback, repeat until suggestions become incremental. You review the final result.
> 3. **Copy to clipboard** — I'll copy the design doc content and reviewer prompt to your clipboard for your tool of choice.
> 4. **Manual** — You handle sending the plan to a reviewer yourself and bring back the feedback.
> 5. **Skip** — Proceed directly to PRD generation."

### Thinking level (options 1 and 2 only)

Before running the OpenCode CLI, ask the user what reasoning effort level to use:

> "What thinking/reasoning level for the reviewer?
>
> - **max** — Deepest reasoning, slowest, most expensive
> - **high** — Strong reasoning, good balance *(recommended)*
> - **minimal** — Fast, lighter reasoning"

This maps to the `--variant` flag on the CLI call.

### Option 1: Auto-review (one round)

1. Construct and execute the CLI command:

```bash
opencode run -m openai/gpt-5.2 --variant <thinking_level> \
  -f <design_doc_path> \
  "<reviewer_prompt>"
```

Where `<design_doc_path>` is the path to the saved design doc (e.g., `docs/plans/YYYY-MM-DD-<feature>-design.md`).

2. Capture and present the reviewer's output to the user.
3. Ask: "Integrate this feedback into the design? (yes / skip / revise manually)"
4. If yes, revise the design doc in-place using the feedback.
5. After integration, ask: "Run another round, switch modes, or proceed to PRD generation?"

### Option 2: Auto-review (full loop, unattended)

1. Run up to 5 rounds automatically. Each round:
   a. Send the design doc + reviewer prompt via `opencode run` (same CLI shape as option 1).
   b. Capture the reviewer output.
   c. Revise the design doc in-place using the feedback.
   d. Save the updated design doc.

2. **Steady-state detection:** Starting from round 2, prepend this to the reviewer prompt:

> Note: This is round N of iterative refinement on this plan. Previous rounds have already incorporated reviewer feedback. If the plan is now solid and your remaining suggestions are only incremental or cosmetic, respond with STEADY_STATE on the first line followed by any minor notes.

3. **Stop conditions:** The loop stops when the reviewer responds with STEADY_STATE at the top of their response, OR 5 rounds are completed, whichever comes first.

4. After the loop completes, present a summary:
   - How many rounds were run
   - Key changes made in each round (1-2 bullet points per round)
   - Ask the user to review the final design doc before proceeding to PRD generation

### Option 3: Copy to clipboard

1. Construct the full text: reviewer prompt + a blank line + the complete design doc content.
2. Copy it to the clipboard using `pbcopy` (macOS).
3. Tell the user: "Copied the reviewer prompt and design doc to your clipboard. Paste it into your reviewer tool, then bring the feedback back here."
4. Wait for the user to return with the review output.
5. Revise the design doc in-place using the feedback.
6. Ask: "Run another round (same mode or different), or proceed to PRD generation?"

### Option 4: Manual

1. Display the reviewer prompt for the user to copy.
2. Tell them the design doc path so they can reference it.
3. Wait for the user to return with the review output.
4. Revise the design doc in-place using the feedback.
5. Ask: "Run another round, or proceed to PRD generation?"

**Wait for the refinement loop to complete (or be skipped) before proceeding to Step 4.**

---

## Step 4: User Stories + PRD Output

Convert the refined plan into user stories sized for Ralph TUI iterations.

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

### Quality Gates

Ask the user what quality gate commands must pass (REQUIRED):

```
What quality commands must pass for each user story?
   A. pnpm typecheck && pnpm lint
   B. npm run typecheck && npm run lint
   C. bun run typecheck && bun run lint
   D. Other: [specify your commands]
```

### Injecting Review, Bug Scan, Audit, and Learning Beads

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

Review bead acceptance criteria:
- [ ] All changes from this phase reviewed against the design document
- [ ] All quality gates pass
- [ ] No placeholder implementations remain
- [ ] No architectural drift from approved design
- [ ] No scope creep beyond this phase's stories
- [ ] Findings documented in progress.md
- [ ] Corrective beads created if issues found

Bug scan bead acceptance criteria:
- [ ] All new code from this phase re-read with fresh eyes
- [ ] Look carefully for bugs, errors, problems, silly mistakes
- [ ] Fix anything uncovered
- [ ] Document all findings in progress.md

Audit-001 (Full code review) acceptance criteria:
- [ ] Complete diff reviewed against design document
- [ ] No architectural drift
- [ ] No security issues identified
- [ ] No placeholder or minimal implementations remain
- [ ] All quality gates pass
- [ ] Findings documented in progress.md

Audit-002 (Test coverage) acceptance criteria:
- [ ] Unit test coverage assessed for all new/changed code
- [ ] Integration test coverage assessed for all new workflows
- [ ] All existing tests still pass
- [ ] Corrective beads created for coverage gaps

LEARN-001 (Learning extraction) acceptance criteria:
- [ ] progress.md reviewed for reusable patterns
- [ ] docs/intake-checklist.md updated with new questions discovered during this epic
- [ ] Epic summary written to progress.md

---

## Step 5: Output Format

Wrap the final PRD in `[PRD]...[/PRD]` markers.

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
- [ ] docs/intake-checklist.md updated with new questions
- [ ] Epic summary written to progress.md

## Non-Goals
- <what this is NOT, from the design>

## Design Reference
See: docs/plans/YYYY-MM-DD-<feature>-design.md
[/PRD]
```

**File naming:** The PRD is saved to `./tasks/prd-<feature-name>.md`

---

## Step 6: Proceed to Bead Creation

After the PRD is saved, **immediately invoke the `super-ralph-create-beads` skill** to convert the PRD to beads. Do not wait for the user to ask — this is the next step in the pipeline.

Pass the PRD path (`./tasks/prd-<feature-name>.md`) and the design doc path (`docs/plans/YYYY-MM-DD-<feature>-design.md`) to the bead creation skill.

**If work_type = "plan":** This step does not apply — the pipeline already stopped at Step 2.

---

## Relationship to Superpowers Skills

This skill **invokes and extends** two Superpowers skills:

- **brainstorming:** The intake protocol (Steps 1-2) follows brainstorming's process flow — explore context, ask one question at a time, propose 2-3 approaches, present design in sections, get approval. This skill extends it with deeper, more relentless questioning (13+ questions across business and technical dimensions) and the learned questions mechanism.

- **writing-plans:** The user story sizing (Step 4) follows writing-plans' granularity principles — bite-sized tasks, exact file paths, TDD emphasis, DRY, YAGNI. This skill shapes the output for Ralph TUI's PRD format rather than Superpowers' plan format.

The key extensions beyond standard Superpowers:
1. The relentless intake protocol (Phases A, B, C)
2. The learned questions from `docs/intake-checklist.md`
3. The iterative plan refinement loop (Emanuel method)
4. Phase labeling for beads
5. Review/audit/learning bead injection in the PRD
6. Output format shaped for Ralph TUI consumption

---

## Checklist

Before outputting the PRD:

- [ ] Project context explored (AGENTS.md, README.md, codebase, progress.md)
- [ ] Business interrogation complete (or adaptively shortened for simple work)
- [ ] Technical deep-dive complete (or adaptively shortened)
- [ ] Learned questions from intake-checklist.md checked
- [ ] 2-3 approaches proposed with trade-offs
- [ ] Design presented in sections with user approval
- [ ] Design doc saved to docs/plans/
- [ ] Plan refinement loop offered (for substantial work)
- [ ] Quality gates asked and included
- [ ] User stories are iteration-sized (completable in one Ralph TUI iteration)
- [ ] Phase labels assigned to every story
- [ ] Review beads injected at phase boundaries
- [ ] Bug scan beads injected after each review bead
- [ ] Audit beads injected at end
- [ ] LEARN-001 bead included as final bead
- [ ] PRD wrapped in [PRD]...[/PRD] markers
- [ ] PRD saved to tasks/prd-<feature-name>.md
- [ ] Bead creation skill invoked automatically (unless work_type = "plan")
