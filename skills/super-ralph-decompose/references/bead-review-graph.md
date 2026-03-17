# Beads 2-4: Review Bead Graph Pass

Stamp this template for beads 2, 3, and 4. Set `passNumber` to 1, 2, 3 respectively.
Set `isAdaptivePass` to `false` for passes 1-2, `true` for pass 3+.

```markdown
## Objective
Check over each bead super carefully — are you sure it makes sense?
Is it optimal? Could we change anything to make the system work better?

This is review pass {{passNumber}} of the decompose bead graph. You are
reviewing the PLAN, not code. This is the cheapest place to find and
fix problems — easier in "plan space" than after implementation!

## The Spec
Read ALL of `{{specPath}}` — you'll check every work bead against it.

## Instructions
Examine every bead: `br list --parent {{workEpicId}}`
For EACH bead, `br show <id>` and evaluate against ALL criteria below.

For >15 beads, use sub-agents per phase for parallel review.

### Criterion 1: Spec Coverage
Every spec requirement must have a corresponding bead. Go section by
section: features, interfaces, constraints, edge cases, error conditions.

### Criterion 2: Self-Containment (Zero-Context Test)
"Could an agent with NO context implement this correctly?" Common failures:
- References "the spec" — embed info directly
- Says "implement X" without specifying files/signatures/types
- Says "handle errors appropriately" without specifics
- Assumes agent knows project structure or other beads' output

Fix with `br edit <id> --description "..."`. Get MORE detailed, not less.

### Criterion 3: Dependency Correctness
- Missing deps: X uses Y's output → X must depend on Y
- Circular deps: break by merging or restructuring
- Over-constraining: remove unnecessary deps for parallelism
- Phase gate wiring: Phase N → REVIEW-(N-1) → Phase N+1

### Criterion 4: Right-Sizing
Too large: >1000 words, >5 files, multiple concerns, impl+tests combined.
Too small: single 3-field type def, trivially adjacent to another bead.
Split or merge accordingly.

### Criterion 5: Phase Structure
Phase 1 truly independent? Could beads move earlier/later? Boundaries at
natural integration points? REVIEW gates positioned usefully?

### Criterion 6: Test Coverage
Every module has unit tests? Integration tests for interacting components?
Edge cases from spec reflected? Detailed logging included?

### Criterion 7: Area Labels
Correct domain labels? No missing labels?

## Revision Instructions
- **Minor fix**: `br edit <id> --description "..."`
- **Significant structural issue**: create/split/merge beads, adjust deps
- **Missing coverage**: create new bead meeting quality standard

DO NOT OVERSIMPLIFY! DO NOT LOSE FEATURES! Embed EVERYTHING from spec.

## Spawning Rules
New beads: wire into correct phase position with `br dep add`.
Block next review pass: `br dep add {{nextReviewBeadId}} <new_bead_id>`

{{#if isAdaptivePass}}
## Adaptive Continuation
If significant revisions made, spawn next pass:
  br create --parent {{epicId}} --title "Review bead graph pass {{nextPassNumber}}" ...
  br dep add <new_pass_id> <your new beads>
  br dep add {{structuralBeadId}} <new_pass_id>

If trivial/no issues — steady state. Close without spawning.
{{/if}}

## At the End
Report: total reviewed, revised (summaries), new created, merged/removed,
remaining concerns.

## Completion
br close {{thisBeadId}} --reason "Review pass {{passNumber}}: reviewed N beads, revised M, created K new, fixed J dep issues"
```
