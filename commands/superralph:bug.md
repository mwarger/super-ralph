---
description: "Fix a bug through the super-ralph pipeline with focused intake"
---

Invoke the super-ralph:superpowers-intake skill with work_type = "bug".

The user's message after this command (if any) is the bug description. Use it as starting context for the intake.

Bug intake is shorter than feature intake. Focus on:
1. Reproduction steps (what triggers the bug?)
2. Expected vs actual behavior
3. Root cause hypothesis
4. Affected code areas

Skip the design doc. Go straight from intake to PRD generation. Still offer the refinement loop.

Pipeline: focused intake → PRD → beads → launch.
