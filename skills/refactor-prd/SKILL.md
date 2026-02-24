---
name: refactor-prd
description: "Self-contained skill for refactoring workflows: architecture-focused intake, before/after design document, and spec handoff to the decompose phase."
---

# Refactor Skill

> Self-contained skill for refactoring workflows: architecture-focused intake,
> before/after design document, and spec handoff to the decompose phase.

---

## The Job

1. Run the relentless intake protocol (refactoring interrogation + technical deep-dive + learned questions)
2. Produce a design document with current state, target state, and migration path — with user approval
3. Save the spec and print the decompose command

**Important:** Do NOT implement anything. This skill produces the spec only.

**Announce at start:** "I'm using the refactor skill for architecture-focused intake and before/after design document generation."

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

## Step 3: Handoff

After saving the design doc, also save a copy as the spec for decompose:

1. Save the design to `docs/plans/YYYY-MM-DD-<refactor>-design.md`
2. Copy it to `tasks/<refactor-name>-spec.md` (the decompose input)

Then output:

> Spec saved to `tasks/<refactor-name>-spec.md`.
>
> To create beads and start execution, run in your terminal:
> ```
> super-ralph decompose --spec tasks/<refactor-name>-spec.md
> ```
>
> After decompose creates beads:
> ```
> super-ralph forward --epic <EPIC_ID>
> ```

Then **STOP**. Do not generate a PRD, create beads, or launch execution.

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
- [ ] Design doc saved to `docs/plans/`
- [ ] Spec copied to `tasks/<refactor-name>-spec.md`
- [ ] Decompose command printed
