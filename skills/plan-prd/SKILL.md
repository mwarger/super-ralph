---
name: plan-prd
description: "Self-contained Ralph TUI skill for planning only: relentless intake and design document generation, stopping before PRD or execution."
---

# Plan PRD — Ralph TUI Skill

> Self-contained skill for Ralph TUI that runs the full planning pipeline:
> relentless intake and design document generation — then stops.
> No PRD, no beads, no launch.

---

## The Job

1. Run the relentless intake protocol (business interrogation + technical deep-dive + learned questions)
2. Produce a design document with user approval
3. **Stop.** Do not generate a PRD, create beads, or launch execution.

**Important:** This skill produces the plan only. When you're ready to execute, run `/superralph:feature` to pick up from the design doc.

**Announce at start:** "I'm using the plan-prd skill for relentless intake and design document generation. I'll stop after the design doc is saved — no PRD or beads will be created."

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

## Stop Condition

After saving the design doc, output:

> Design doc saved to `docs/plans/YYYY-MM-DD-<feature>-design.md`. Run `/superralph:feature` when you're ready to execute this plan.

Then **STOP**. Do not generate a PRD, create beads, wire dependencies, or launch execution. The planning phase is complete.

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
- [ ] Stop condition message displayed
- [ ] No PRD generated
- [ ] No beads created
- [ ] No launch wizard presented
