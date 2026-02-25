# Refactor Question Bank

## Architecture Interrogation
1. What's the pain? Code smells, maintenance burden, performance issues, architectural problems.
2. What's the desired end state? Target architecture, patterns, structure.
3. What must NOT change? Behavior, APIs, contracts, external interfaces consumers depend on.
4. What's the migration path? Incremental refactoring vs big-bang rewrite? Stages that leave system working?
5. What are the invariants? Properties that must remain true throughout every step.
6. What's the risk? Regression hotspots, fragile integration points, poor test coverage.

## Technical Deep-Dive
7. Current patterns vs target patterns? What exists today, what should exist after.
8. Test coverage of affected areas? Unit, integration, E2E — where are the gaps?
9. Coupling points? What modules depend on the code being refactored?
10. Data migration story? If data shapes change — migration plan? Online migration?
11. What can be parallelized? Independent parts vs sequential dependencies.
12. Rollback strategy? Feature flags? Backward-compatible changes?

## Learned Questions
Check `.super-ralph/intake-checklist.md` if it exists for learned questions from past epics.
