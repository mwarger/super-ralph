---
name: hotfix-prd
description: "Minimal hotfix pipeline: fast intake, brief fix spec, handoff to decompose."
---

# Hotfix — Skill

> Minimal hotfix pipeline: fast intake, brief spec, handoff.
> No design doc. No ceremony. Get the fix out.

---

## The Job

1. Run fast intake (1-3 questions max)
2. Write a brief fix spec
3. Save the spec and print the decompose command

**Important:** Do NOT implement anything. This skill produces the spec only.

**Announce at start:** "I'm using the hotfix skill for fast intake and fix specification."

---

## Step 0: Explore Project Context

Before asking questions, quickly ground yourself:

1. Read `AGENTS.md` and `README.md` if they exist
2. Read `.super-ralph/progress.md` if it exists
3. Explore the broken area of the codebase — focus on what's relevant to the fix

Speed matters. Don't explore broadly — zoom into the problem area.

---

## Step 1: Fast Intake

Ask **1-3 questions only**, one at a time. Skip deep-dives. Skip learned questions.

**Seed description:** If context was provided, confirm it: "You want to fix [description] — is that right, or should I adjust?"

1. **What's broken?** Symptoms, error messages, stack traces. What does the user see?
2. **What's the impact?** Production down? Data loss? User-facing? How many users? Workaround?
3. **What's the fix?** If the user knows, confirm it. If not, investigate and propose.

After each answer: **ask the next question** or **write the spec** (you may not need all three).

Signal when ready: "I have enough to draft the fix spec. Any final thoughts?"

---

## Step 2: Fix Spec

Write a brief fix specification (a few paragraphs). Include:
- What's broken and the impact
- Root cause (brief)
- Proposed fix
- How to verify it works

Save to `tasks/hotfix-<name>-spec.md`.

---

## Step 3: Handoff

After saving the spec, output:

> Spec saved to `tasks/hotfix-<name>-spec.md`.
>
> To decompose and start execution, run in your terminal:
> ```
> super-ralph decompose --spec tasks/hotfix-<name>-spec.md
> ```
>
> After decompose completes:
> ```
> super-ralph forward
> ```

Then **STOP**. Do not implement fixes or create any work items.

---

## Checklist

- [ ] Problem area explored
- [ ] Fast intake complete (1-3 questions)
- [ ] Fix spec written and saved
- [ ] Decompose command displayed
- [ ] No fixes implemented
- [ ] No work items created
