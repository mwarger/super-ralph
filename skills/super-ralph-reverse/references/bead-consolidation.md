# Bead 6: Clean-Room Verification and Consolidation

Use this as the description for the final bead.

```markdown
## Objective
Final verification that this is a true clean-room specification, plus
formatting and consistency polish.

## The Clean-Room Test
Read ALL of `{{specPath}}`.

For every section, ask: "Could an engineer who has NEVER seen the
original source material build this correctly from what's written here?"

Go section by section:
1. Are all behaviors precisely specified with exact expected outcomes?
2. Are all interfaces fully defined (signatures, types, errors, examples)?
3. Are all constraints stated with concrete numbers or criteria?
4. Are all edge cases documented with expected behavior?
5. Are all design decisions accompanied by rationale?
6. Is the spec free of references to "the source" or "the original"?
7. Could this document survive legal scrutiny as clean-room work?

If ANY section fails, fix it now. Last chance before decompose.

## Formatting and Consistency
1. Heading levels consistent
2. List styles uniform
3. Code blocks have language tags
4. No contradictions between sections
5. Every "TBD"/"TODO" resolved
6. Section numbering correct

## Final Assessment
Write at the bottom of the spec:
- Confidence level (high/medium/low)
- Weaker areas
- Recommendations for decompose phase

## Completion
br close {{thisBeadId}} --reason "Spec finalized — clean-room verified and ready for decompose"
```
