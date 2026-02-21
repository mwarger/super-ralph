---
description: "Restructure existing code through the super-ralph pipeline"
---

Invoke the super-ralph:superpowers-intake skill with work_type = "refactor".

The user's message after this command (if any) is the refactoring description. Use it as starting context.

Refactor intake focuses on:
1. Current pain points / code smells
2. Desired architecture / structure
3. What should NOT change (preserve behavior)
4. Risk areas and testing strategy

Produce a design doc (refactors benefit from explicit before/after architecture). Skip the refinement loop (refactors are typically well-understood by the person requesting them). Then PRD, beads, launch.

Pipeline: focused intake → design doc → PRD → beads → launch.
