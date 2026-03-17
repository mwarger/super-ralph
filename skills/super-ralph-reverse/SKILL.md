---
name: super-ralph-reverse
description: Stamp reverse process beads — any input → clean-room spec via bead graph with deep study, draft, fresh-eyes reviews, and consolidation
---

# Reverse Pack: Stamp Process Beads

You are a bead-stamping skill. The user describes what they want to reverse-engineer in natural language. You classify their input, create an epic, stamp process beads with fat descriptions via `br create`, wire dependencies, and report the epic ID so the user can run `ralph-tui run`.

## Input Classification

| Input Type | Example | How to Detect |
|---|---|---|
| Local source code | `src/auth/` | Path exists on disk |
| GitHub repo URL | `https://github.com/user/repo` | GitHub URL pattern |
| Live product URL | `https://app.example.com` | Non-GitHub, non-docs URL |
| Documentation URL | `https://docs.example.com/api` | URL with docs/api/reference in path |
| Description/brief | "A system that does X, Y, Z" | Plain text, no paths or URLs |
| Mixed | GitHub URL + "but ours should differ by..." | Multiple input types combined |

If the user's request is ambiguous, **ask** before proceeding.

## Deriving Parameters

| Parameter | How to Derive |
|---|---|
| Epic title | Inferred: "Reverse: Auth Module", "Reverse: Calendly Clone" |
| `analysisPath` | `docs/specs/<name>-analysis.md` |
| `specPath` | `docs/specs/<name>-spec.md` |
| Differentiators | Extracted from "but our version should..." phrasing |

## Stamping Procedure

1. **Create epic:** `br create --title "Reverse: <name>" --type epic` → save as `{{epicId}}`
2. **Create 6 beads** in order (use HEREDOC for descriptions), saving each ID:
   - Bead 1: "Deep study of source material" — see `references/bead-1-deep-study.md`
   - Bead 2: "Draft clean-room specification" — see `references/bead-2-draft-spec.md`
   - Bead 3: "Fresh eyes review pass 1" — see `references/bead-review-pass.md` (passNumber=1, isAdaptivePass=false)
   - Bead 4: "Fresh eyes review pass 2" — see `references/bead-review-pass.md` (passNumber=2, isAdaptivePass=false)
   - Bead 5: "Fresh eyes review pass 3" — see `references/bead-review-pass.md` (passNumber=3, isAdaptivePass=true)
   - Bead 6: "Clean-room verification and consolidation" — see `references/bead-consolidation.md`
3. **Wire dependencies:** bead2→bead1, bead3→bead2, bead4→bead3, bead5→bead4, bead6→bead5
4. **Report** the epic ID and bead list to the user

## Template Variables

| Variable | Source |
|---|---|
| `{{epicId}}` | Returned by `br create --type epic` |
| `{{analysisPath}}` | `docs/specs/<name>-analysis.md` |
| `{{specPath}}` | `docs/specs/<name>-spec.md` |
| `{{thisBeadId}}` | Returned by `br create` for each bead |
| `{{draftBeadId}}` | Bead 2's ID |
| `{{nextReviewBeadId}}` | Next review bead's ID |
| `{{consolidationBeadId}}` | Bead 6's ID |
| `{{passNumber}}` | 1, 2, or 3 for fixed passes |
| `{{isAdaptivePass}}` | `false` for passes 1-2, `true` for pass 3+ |

## Bead Description References

Read these files for the full fat description templates to embed in each bead:

- `references/bead-1-deep-study.md` — Bead 1 description template
- `references/bead-2-draft-spec.md` — Bead 2 description template
- `references/bead-review-pass.md` — Beads 3-5 description template (parameterized by pass number)
- `references/bead-consolidation.md` — Bead 6 description template
