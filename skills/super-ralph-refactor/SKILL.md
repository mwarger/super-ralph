---
name: super-ralph-refactor
description: Stamp reverse process beads with refactor question bank for architecture migration and behavioral preservation
---

# Reverse Pack (Refactor Domain)

This skill composes with `/super-ralph-reverse`. It stamps the **same bead graph** (deep study → draft → 3 review passes → consolidation), but injects the refactor-specific question bank into bead 1's study instructions.

## How to Use

Follow `/super-ralph-reverse` exactly, but when stamping **Bead 1 (Deep Study of Source Material)**, replace the `## Question Bank` section with the refactor question bank below.

Everything else — the bead graph structure, dependency wiring, description templates, stamping procedure — is identical to `/super-ralph-reverse`.

## Refactor Question Bank

Include this in bead 1's description under `## Question Bank`:

```markdown
## Question Bank

Use these refactor-specific questions to guide your study — they ensure
you don't miss important dimensions of the migration:

### Architecture Interrogation
1. What's the pain? Code smells, maintenance burden, performance issues, architectural problems.
2. What's the desired end state? Target architecture, patterns, structure.
3. What must NOT change? Behavior, APIs, contracts, external interfaces consumers depend on.
4. What's the migration path? Incremental refactoring vs big-bang rewrite? Stages that leave system working?
5. What are the invariants? Properties that must remain true throughout every step.
6. What's the risk? Regression hotspots, fragile integration points, poor test coverage.

### Technical Deep-Dive
7. Current patterns vs target patterns? What exists today, what should exist after.
8. Test coverage of affected areas? Unit, integration, E2E — where are the gaps?
9. Coupling points? What modules depend on the code being refactored?
10. Data migration story? If data shapes change — migration plan? Online migration?
11. What can be parallelized? Independent parts vs sequential dependencies.
12. Rollback strategy? Feature flags? Backward-compatible changes?
13. What do the tests tell you? Read the actual test files for code being refactored — they define the behavioral contract that must be preserved. Note file:line locations.

### Learned Questions
Check `.super-ralph/intake-checklist.md` if it exists for learned questions from past epics.
```
