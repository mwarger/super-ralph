# Bug Fix Question Bank

## Investigation
1. What's the bug? Reproduction steps, expected vs actual behavior.
2. When did it start? Regression? Always broken? What deploy triggered it?
3. What's the impact? Who's affected, how badly, is this in production?
4. Root cause hypothesis? Code paths involved.
5. What's the blast radius? What else might be affected by the fix?

## Technical
- Edge cases around the fix: related inputs or states that could also be broken.
- Data implications: corrupted data? Need migration or cleanup?
- Test gaps: why wasn't this caught? What test is missing?

## Learned Questions
Check `.super-ralph/intake-checklist.md` if it exists for learned questions from past epics.
