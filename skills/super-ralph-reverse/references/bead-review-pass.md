# Beads 3-5: Fresh Eyes Review Pass

Stamp this template for beads 3, 4, and 5. Set `passNumber` to 1, 2, 3 respectively.
Set `isAdaptivePass` to `false` for passes 1-2, `true` for pass 3+.

```markdown
## Objective
Carefully review this entire spec with completely fresh eyes. You have
NOT seen this spec before. You are reviewing it as a clean-room
specification — a document that must be complete enough to build from
without ever seeing the original source material.

## The Spec
Read ALL of `{{specPath}}`.

## Review Instructions
Carefully review this entire spec and come up with your best revisions
in terms of better architecture, new features, changed features, etc.

For each issue found:
- Give detailed analysis and rationale for why the change improves the spec
- Minor fixes: fix directly in the spec
- Significant gaps: create a fix-up bead (see Spawning Rules)

Apply the CLEAN-ROOM TEST: "Could an engineer who has never seen the
original source implement this correctly from what's written here?"

Specifically look for:
- Vague behaviors ("handles errors appropriately" → should be precise)
- Interfaces missing parameter types, error types, or edge case behavior
- Constraints without numbers ("should be fast" → "must respond within 50ms at p99")
- Design decisions without rationale
- Features mentioned but not fully specified
- Missing sections for things invisible without seeing the source
- Implicit dependencies or assumptions

DO NOT OVERSIMPLIFY! DO NOT LOSE FEATURES! The spec should get MORE
detailed with each review pass, not less.

## Spawning Rules
For each SIGNIFICANT gap:

  br create --parent {{epicId}} \
    --title "Fix spec: <concise description>" \
    --type task \
    --description "<self-contained instructions>"

  br dep add <new_bead_id> {{thisBeadId}}

## REQUIRED: Wire Dependencies After Spawning
For EACH fix-up bead, block the next review pass on it:

  br dep add {{nextReviewBeadId}} <fix_bead_id>

Verify: `br show {{nextReviewBeadId}}` should list your fix-up beads.

{{#if isAdaptivePass}}
## Adaptive Continuation
This is pass {{passNumber}}. If significant issues found, create next pass:

  br create --parent {{epicId}} \
    --title "Fresh eyes review pass {{nextPassNumber}}" \
    --type task \
    --description "<same review instructions with updated pass number>"

  Wire to fix-up beads and consolidation bead:
    br dep add {{consolidationBeadId}} <new_pass_id>

If NO significant issues — steady state reached. Close normally.
{{/if}}

## At the End
Report: which changes you agree with, somewhat agree with, rejected and why.

## Completion
br close {{thisBeadId}} --reason "Review pass {{passNumber}}: found N issues, created M fix-up beads"
```
