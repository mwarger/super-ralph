---
name: super-ralph-decompose
description: Stamp decompose process beads — spec → phased work beads with review passes, structural quality gates, and clean-room carry-through
---

# Decompose Pack: Stamp Process Beads

You are a bead-stamping skill. The user provides a clean-room specification (typically produced by `/super-ralph-reverse`). You create an epic, stamp process beads that will analyze the spec and produce phased work beads, then wire dependencies and report the epic ID so the user can run `ralph-tui run`.

## Input

The user provides a spec path, e.g.:
- "Decompose docs/specs/auth-spec.md into work beads"
- "Break down this spec: docs/specs/calendly-spec.md"

If no spec path given, **ask** for it.

## Deriving Parameters

| Parameter | How to Derive |
|---|---|
| Epic title | "Decompose: <spec name>" (from spec filename) |
| `specPath` | The spec file path from user input |
| Work epic | Separate epic to hold actual work beads |

## Stamping Procedure

1. **Create process epic:** `br create --title "Decompose: <name>" --type epic` → `{{epicId}}`
2. **Create work epic:** `br create --title "<name>: Implementation" --type epic` → `{{workEpicId}}`
3. **Create 5 beads** in order under `{{epicId}}`, saving each ID:
   - Bead 1: "Analyze spec and create phased implementation beads" — see `references/bead-1-analyze-spec.md`
   - Bead 2: "Review bead graph pass 1" — see `references/bead-review-graph.md` (passNumber=1, isAdaptivePass=false)
   - Bead 3: "Review bead graph pass 2" — see `references/bead-review-graph.md` (passNumber=2, isAdaptivePass=false)
   - Bead 4: "Review bead graph pass 3" — see `references/bead-review-graph.md` (passNumber=3, isAdaptivePass=true)
   - Bead 5: "Add structural beads (REVIEW, BUGSCAN, AUDIT)" — see `references/bead-structural.md`
4. **Wire dependencies:** bead2→bead1, bead3→bead2, bead4→bead3, bead5→bead4
5. **Report** both epic IDs and bead list to the user

## Template Variables

| Variable | Source |
|---|---|
| `{{epicId}}` | Process epic ID |
| `{{workEpicId}}` | Work epic ID |
| `{{specPath}}` | Spec file path from user input |
| `{{thisBeadId}}` | Returned by `br create` for each bead |
| `{{nextReviewBeadId}}` | Next review bead's ID |
| `{{structuralBeadId}}` | Bead 5's ID |
| `{{passNumber}}` | 1, 2, or 3 for fixed passes |
| `{{isAdaptivePass}}` | `false` for passes 1-2, `true` for pass 3+ |
| `{{auditBeadId}}` | AUDIT bead's ID (created by bead 5) |

## Bead Description References

Read these files for the full fat description templates:

- `references/bead-1-analyze-spec.md` — Bead 1 (includes phase structure, quality standard, work bead example)
- `references/bead-review-graph.md` — Beads 2-4 (parameterized by pass number)
- `references/bead-structural.md` — Bead 5 (REVIEW gates, BUGSCAN, AUDIT)
