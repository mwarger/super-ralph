---
name: bug-prd
description: "Self-contained skill for bug fix planning: focused intake and fix specification, producing a spec for the decompose phase."
---

# Bug Fix — Skill

> Focused bug fix pipeline: investigation intake, fix specification, spec output.

---

## The Job

1. Run the focused intake protocol (bug investigation + technical questions + learned questions)
2. Produce a fix specification with user approval
3. Save the spec and print the decompose command

**Important:** Do NOT implement any fixes. This skill produces the spec only.

**Announce at start:** "I'm using the bug skill for focused bug intake and fix specification."

---

## Step 0: Explore Project Context

Before asking any questions:

1. Read `AGENTS.md` and `README.md` if they exist
2. Read `.super-ralph/progress.md` if it exists (learnings from past epics)
3. Explore the codebase structure — what exists, what patterns are in use, what's the tech stack
4. Read `.super-ralph/intake-checklist.md` if it exists (needed for Phase C)

This grounds your questions in the reality of the project, not abstract possibilities.

---

## Step 1: Focused Intake

Ask questions **one at a time**, using multiple choice when possible. After each answer, decide whether to dig deeper, move on, or generate the spec. Bug intakes are shorter than feature intakes — aim for 5-8 questions total.

**Seed description:** If context was provided with the command, confirm it rather than asking from scratch: "The bug is [description] — is that right, or should I adjust?"

### Phase A: Bug Investigation

1. **What's the bug?** Reproduction steps, expected vs actual behavior. Can you reproduce it reliably?
2. **When did it start?** Regression from a recent change? Always broken? What deploy/merge triggered it?
3. **What's the impact?** Who's affected — all users, subset, internal? How badly — data loss, broken workflow, cosmetic? Is this in production?
4. **Root cause hypothesis?** Present what you found from codebase exploration. Where does the bug live? What code paths are involved?
5. **What's the blast radius?** What other features or systems might be affected by the fix? What could break if we change the wrong thing?

### Phase B: Technical Deep-Dive

After the investigation, ask 2-3 technical questions as needed:

- **Edge cases around the fix:** What related inputs or states could also be broken? Similar patterns elsewhere with the same bug?
- **Data implications:** Has the bug corrupted data? Do we need a migration or cleanup alongside the fix?
- **Test gaps:** Why wasn't this caught? What test is missing?

Not every bug needs all three. Use judgment based on complexity.

### Phase C: Learned Questions

Read `.super-ralph/intake-checklist.md` if it exists. Ask any relevant learned questions — things the team discovered they should always ask from past epics. Use judgment; most won't apply to every bug.

### Adaptive Depth

After each answer, decide:
- **Dig deeper** — the answer revealed complexity or ambiguity
- **Move on** — the answer is clear and sufficient
- **Generate the spec** — enough context to proceed

Signal when ready: "I think I have enough to draft the fix plan. Any final thoughts before I proceed?"

---

## Step 2: Fix Specification

Once the intake is complete, produce a brief fix specification:

1. **Root cause analysis** — what's actually wrong and why
2. **Proposed fix approach** — what to change and why this approach
3. **Verification strategy** — how to verify the fix works and doesn't break anything
4. **Risk assessment** — what could go wrong with the fix

Present each section, asking after each whether it looks right. Scale to complexity — a one-line null check fix needs a paragraph, not a page.

Get user approval before saving.

### Quality Gates

Ask the user what quality gate commands must pass:

```
What quality commands must pass for fix verification?
   A. pnpm typecheck && pnpm lint
   B. npm run typecheck && npm run lint
   C. bun run typecheck && bun run lint
   D. Other: [specify your commands]
```

Include the chosen quality gates in the fix specification.

### Spec Format

```markdown
# Fix Spec: <Bug Name>

## Bug Summary
<2-3 sentences: the bug, its impact, and who's affected>

## Root Cause Analysis
<What's actually wrong and why. Code paths, conditions, triggering scenarios.>

## Proposed Fix Approach
<What to change and why this approach over alternatives.>

## Verification Strategy
<How to verify the fix works and doesn't break anything. Specific tests to add.>

## Risk Assessment
<What could go wrong with the fix. Blast radius. Rollback plan if needed.>

## Quality Gates
These commands must pass:
- `<command>` - <description>

## Non-Goals
- <what this fix is NOT touching>
```

Save to `docs/plans/YYYY-MM-DD-<bug>-fix-spec.md`.

---

## Step 3: Handoff

After saving the fix spec:

1. Save to `docs/plans/YYYY-MM-DD-<bug>-fix-spec.md`
2. Copy to `tasks/<bug-name>-spec.md`

Then output:

> Spec saved to `tasks/<bug-name>-spec.md`.
>
> To create beads and start execution, run in your terminal:
> ```
> super-ralph decompose --spec tasks/<bug-name>-spec.md
> ```
>
> After decompose creates beads:
> ```
> super-ralph forward --epic <EPIC_ID>
> ```

Then STOP.

---

## Checklist

- [ ] Project context explored
- [ ] Bug investigation complete
- [ ] Technical deep-dive complete (or adaptively shortened)
- [ ] Learned questions checked
- [ ] Fix specification presented with user approval
- [ ] Quality gates included in spec
- [ ] Spec saved to docs/plans/ and tasks/
- [ ] Decompose command displayed
- [ ] No fixes implemented
