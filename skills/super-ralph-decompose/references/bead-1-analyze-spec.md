# Bead 1: Analyze Spec and Create Phased Implementation Beads

Use this as the description for bead 1. Replace template variables at stamp time.

```markdown
## Objective
Read the entire clean-room specification and produce a comprehensive,
phased set of implementation beads. This is the most important bead in
the decompose process — every downstream agent will build from what you
create here.

## What "Clean-Room Carry-Through" Means
The spec was written clean-room: someone could build the system from it
alone. Your work beads must maintain this property. Each must be so
self-contained that:
- An implementing agent with ZERO context can execute it correctly
- The agent never needs to consult the spec document
- The agent never needs to read other beads to understand this one
- All relevant background, interfaces, constraints, and rationale are
  embedded directly into the bead description

Emanuel's standard: "The beads should be so detailed that we never need
to consult back to the original markdown plan document."

## The Spec
Read ALL of `{{specPath}}`.

For large specs (>500 lines): first pass for structure, create
decomposition plan BEFORE creating beads, then work area by area.

## Phase Structure
Phases are logical groups where Phase N+1 depends on Phase N being reviewed.

**How to identify phases:**
1. **Foundation layer** (Phase 1): data models, types, config, shared infra
2. **Core logic layer** (Phase 2): business logic, services, algorithms
3. **Integration layer** (Phase 3): API endpoints, webhooks, external services
4. **Presentation layer** (Phase 4): UI, dashboards, notifications
5. **Cross-cutting concerns**: auth, logging, error handling — may span phases

**Vertical Slice Methodology:**
Where possible, structure as vertical slices (data model → logic → API → UI).
First phase should be a **tracer bullet**: thinnest possible end-to-end slice.

**Priority assignment:**

| Bead Type | Priority | Rationale |
|---|---|---|
| Phase N impl beads | N × 10 | Groups phases |
| Phase N test beads | N × 10 + 1 | Tests after code |
| Phase N REVIEW gate | N × 10 + 5 | Review after phase |

## Work Bead Quality Standard
Each bead description MUST contain:
1. **Objective** — one sentence
2. **Context: Why This Bead Exists** — bigger picture, what was built before, what depends on it
3. **Instructions** — exact file paths, function signatures, types, algorithms
4. **Test Requirements** — specific test files, cases, edge cases, "detailed logging"
5. **Acceptance Criteria** — checkable, binary conditions
6. **Completion** — `br close <id> --reason "<what was done>"`

Embed EVERYTHING from the spec. Never refer back to the spec.

## Example: Good Work Bead

**Title:** Implement webhook delivery subsystem

**Description:**

> ## Objective
> Implement the webhook delivery subsystem that sends HTTP POST
> notifications to subscriber endpoints when events occur.
>
> ## Context: Why This Bead Exists
> The event notification spec (Section 4.2) defines a webhook delivery
> system. This is Phase 2. Phase 1 built the event bus (beads br-020-025).
> This bead can assume: EventBus at src/events/bus.ts, Subscriber model
> at src/models/subscriber.ts, event types at src/events/types.ts.
> Phase 3 depends on this — delivery logs feed the dashboard (bead br-040).
>
> ## Instructions
> Create src/webhooks/deliver.ts, retry.ts, types.ts, processor.ts with
> exact signatures, HMAC-SHA256 signing, exponential backoff (1s,5s,30s,
> 2min,10min), specific retry/no-retry conditions.
>
> ## Test Requirements
> 8 unit tests (deliver.test.ts) + 5 integration tests (processor.test.ts)
> with specific scenarios. Detailed logging in test output.
>
> ## Acceptance Criteria
> - [ ] deliverWebhook sends correctly signed POST request
> - [ ] deliverWithRetry retries transient failures with correct backoff
> - [ ] WebhookProcessor routes events to matching subscribers only
> - [ ] All 13 tests pass

## Area Labels
Set on work beads for model routing: `core`, `backend`, `frontend`,
`database`, `infra`, `test`, `docs`.

## Parallel Analysis via Sub-Agents
For large/multi-subsystem specs, launch sub-agents per area. Each
analyzes its spec sections and returns bead proposals. Synthesize,
resolve cross-area deps, then create all beads via `br create` yourself.

## Spawning Rules
Work beads go under {{workEpicId}}, NOT as children of this bead.
Create all beads from THIS bead to wire cross-area deps correctly.

## Creating REVIEW Gate Beads
Between phases, create REVIEW gates with thorough descriptions
(see structural bead reference for template). Wire: REVIEW-N depends
on all Phase N beads; Phase N+1 depends on REVIEW-N.

## Completion
br close {{thisBeadId}} --reason "Created N impl beads, M test beads, K REVIEW gates across P phases under {{workEpicId}}"
```
