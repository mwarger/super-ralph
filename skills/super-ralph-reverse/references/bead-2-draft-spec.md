# Bead 2: Draft Clean-Room Specification

Use this as the description for bead 2. Replace template variables at stamp time.

```markdown
## Objective
Produce a clean-room specification from the analysis document. This is
the most important bead in the entire reverse process. Think deeply and
be extremely thorough.

## What "Clean-Room Specification" Means
You are writing a spec that someone could use to BUILD an equivalent
system from scratch, without ever seeing the original source material.

This means:
- Describe WHAT the system does, not HOW the source code is structured
- Every behavior must be specified precisely enough to implement
- Every interface must be defined completely (exact signatures, data
  formats, error types, status codes)
- Every constraint must be stated explicitly
- Every edge case must be documented with expected behavior
- Every design decision must include rationale

DO NOT simply reorganize or paraphrase the analysis. TRANSFORM it into
a specification. The analysis says "the system does X" — the spec must
say "the system MUST do X, because Y, and when Z happens it MUST
respond with W."

## The Analysis
Read ALL of `{{analysisPath}}`.

## Instructions
Create the clean-room specification at `{{specPath}}`.

Structure the spec to cover:

### 1. Purpose and Scope
### 2. Behavior Specification
For every feature: observable behavior, trigger conditions, inputs/outputs,
state changes, error conditions, edge cases. Be EXHAUSTIVE.

### 3. Interfaces
For every interface: exact signature/schema, all parameters with types,
return values, error types, examples.

### 4. Data Model
All data structures, fields, relationships, constraints.

### 5. Constraints
Performance, security, compatibility, reliability requirements.

### 6. Dependencies
External systems, libraries, services — what for, what version, what if unavailable.

### 7. Edge Cases and Error Handling
Every edge case with condition, expected behavior, recovery path.

### 8. Design Rationale
Key decisions and WHY. Critical for clean-room property.

{{#if differentiators}}
### 9. Differentiators from Reference
What the reference does, what we do instead, why the change improves things.
{{/if}}

## Quality Standard
- An engineer who has never seen the source could build from this alone
- No vague or hand-wavy sections
- Every "should" is actually a "must"
- Could survive legal scrutiny as clean-room work

## Completion
br close {{thisBeadId}} --reason "Clean-room spec created at {{specPath}}"
```
