---
name: super-ralph-bug
description: Stamp reverse process beads with bug investigation question bank for root-cause analysis and fix planning
---

# Reverse Pack (Bug Domain)

This skill composes with `/super-ralph-reverse`. It stamps the **same bead graph** (deep study → draft → 3 review passes → consolidation), but injects the bug-specific question bank into bead 1's study instructions.

## How to Use

Follow `/super-ralph-reverse` exactly, but when stamping **Bead 1 (Deep Study of Source Material)**, replace the `## Question Bank` section with the bug question bank below.

Everything else — the bead graph structure, dependency wiring, description templates, stamping procedure — is identical to `/super-ralph-reverse`.

## Bug Question Bank

Include this in bead 1's description under `## Question Bank`:

```markdown
## Question Bank

Use these bug-investigation questions to guide your study — they ensure
you don't miss important dimensions of the problem:

### Investigation
1. What's the bug? Reproduction steps, expected vs actual behavior.
2. When did it start? Regression? Always broken? What deploy triggered it?
3. What's the impact? Who's affected, how badly, is this in production?
4. Root cause hypothesis? Code paths involved.
5. What's the blast radius? What else might be affected by the fix?

### Technical
- Edge cases around the fix: related inputs or states that could also be broken.
- Data implications: corrupted data? Need migration or cleanup?
- Test gaps: why wasn't this caught? What test is missing?
- Existing test coverage: read test files for the buggy code path. What's tested? What's missing? Note file:line locations.

### Learned Questions
Check `.super-ralph/intake-checklist.md` if it exists for learned questions from past epics.
```
