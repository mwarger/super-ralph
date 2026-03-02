# Beads as Engine: Bead Strategy Packs for Ralph-TUI

> The three SDLC phases (reverse, decompose, forward) are expressed as
> pre-defined bead graphs with self-contained descriptions. Ralph-TUI runs
> them. Beads can spawn child beads during execution, allowing the process
> to grow organically. Super-ralph's custom engine becomes unnecessary —
> the value is in the bead packs and prompt templates, not the runner.

**Ref:** [mwarger/super-ralph#1](https://github.com/mwarger/super-ralph/issues/1)

## 1. Problem

Super-ralph currently reimplements orchestration machinery that ralph-tui
already provides: bead-driven loops, fresh context per iteration, progress
tracking, session persistence, and multi-agent support. Meanwhile, only the
forward phase is truly bead-driven. Reverse uses an ad-hoc file accumulator
and decompose uses a bead-creation loop — neither expresses its *process*
as beads.

The insight from [mwarger/super-ralph#1](https://github.com/mwarger/super-ralph/issues/1):
if all three phases are bead-driven, the engine collapses to "work ready
beads until none remain" — which is exactly what ralph-tui already does.

What's missing from ralph-tui is not the engine but the **strategy layer**:
pre-built bead graphs that encode proven methodologies for reverse-engineering
specs, decomposing specs into work beads, and reviewing/polishing code.

## 2. Core Insight

Beads solve every problem the three phases need:

- **Sequencing**: dependency chains enforce ordering
- **Fresh context**: one bead = one session = fresh context window
- **Progress tracking**: open/in_progress/closed is built in
- **Termination**: "no more ready beads" = phase complete
- **Parallelism**: ralph-tui already supports parallel bead execution
- **Dynamic expansion**: agents can `br create` during any session, and
  ralph-tui re-queries ready beads each iteration

The value proposition shifts from "build a custom engine" to **"build the
right bead packs and templates that ralph-tui can run."**

## 3. Architecture

### 3.1 What Ralph-TUI Already Provides

| Capability | Ralph-TUI Support |
|---|---|
| Bead-driven loop | beads-rust tracker, re-queries `br` each iteration |
| Fresh context per iteration | New agent session per task |
| Progress tracking | `progress.md`, `recentProgress` template var |
| Prompt templates (Handlebars) | Hierarchical: project > global > built-in |
| Parallel execution | Git worktrees, N workers |
| Multi-agent | Claude, OpenCode, Codex, Cursor, Gemini, etc. |
| PRD context injection | `--external-ref prd:./path` on epics |
| Session persistence/resume | `session.json`, `ralph-tui resume` |
| Dynamic bead discovery | Tracker re-queries each iteration |

### 3.2 What This Design Adds

| New Capability | Delivered As |
|---|---|
| Process bead packs | Ralph-TUI skill that stamps beads via `br create` |
| Fat bead descriptions | Descriptions carry full instructions + spawn rules |
| Bead spawning protocol | Conventions in descriptions, not engine changes |
| Steady-state detection | Hybrid: fixed minimum passes + adaptive tail |
| Phase-specific strategies | Separate bead packs per phase (reverse, decompose, polish) |

### 3.3 Two-Layer Model

```
┌─────────────────────────────────────────────────┐
│  Strategy Layer (bead packs + prompt template)   │
│                                                   │
│  Skills that stamp process beads into an epic.    │
│  Fat descriptions carry all instructions.         │
│  Agents spawn child beads during execution.       │
├─────────────────────────────────────────────────┤
│  Execution Layer (ralph-tui)                      │
│                                                   │
│  Picks next ready bead. Renders prompt template.  │
│  Spawns agent session. Detects completion.         │
│  Marks done. Repeats until no ready beads.         │
└─────────────────────────────────────────────────┘
```

The strategy layer is **bead packs + one prompt template**. The execution
layer is **ralph-tui, unmodified**.

## 4. Design Details

### 4.1 Fat Descriptions (The Key Design Decision)

All process intelligence lives in the bead descriptions, not in the prompt
template. The template is a thin wrapper — it renders the bead's own
description, injects progress context, and includes the completion signal.

This works because ralph-tui already provides `taskDescription`,
`acceptanceCriteria`, `epicId`, `recentProgress`, and other variables.
The bead description itself contains:

- What the agent should do
- What files/paths to examine
- When and how to spawn child beads
- How to signal completion

Example bead description (reverse phase, "analyze" bead):

```markdown
## Objective
Examine the source code at `src/auth/` and create an initial spec outline
at `docs/specs/auth-spec.md`.

## Key Files
- src/auth/login.ts — JWT session management
- src/auth/session.ts — Session storage
- src/auth/middleware.ts — Route protection middleware

## Instructions
1. Read each file listed above thoroughly
2. Identify the public API surface (exported functions, types)
3. Identify external dependencies and consumers
4. Create `docs/specs/auth-spec.md` with sections:
   - Purpose
   - Behavior (observable functionality)
   - Interfaces (public API, inputs/outputs)
   - Constraints (performance, security)
   - Dependencies

## Spawning Rules
If the module is complex enough to warrant separate specs per component:
- Create one child bead per component under this epic using:
  `br create --parent <EPIC_ID> --title "Draft spec: <component>" --type task`
- Add a dependency from each child to this bead:
  `br dep add <child_id> <this_bead_id>`
- Give each child a description following this same template structure

## Completion
When the outline is created, close this bead:
`br close <THIS_BEAD_ID> --reason "Spec outline created at docs/specs/auth-spec.md"`

Signal: <promise>COMPLETE</promise>
```

The variable slots (`src/auth/`, file list, output path) are filled in by
the skill at stamp time. The spawning rules and completion protocol are
part of the template and carried through to every stamped bead.

### 4.2 Prompt Template (Thin Wrapper)

A single ralph-tui-compatible Handlebars template that works for all beads:

```handlebars
{{#if prdContent}}
## Project Context
{{prdContent}}

---
{{/if}}

## Task: {{taskId}} - {{taskTitle}}

{{taskDescription}}

{{#if acceptanceCriteria}}
## Acceptance Criteria
{{acceptanceCriteria}}
{{/if}}

{{#if dependsOn}}
**Prerequisites completed**: {{dependsOn}}
{{/if}}

{{#if blocks}}
**Completing this unblocks**: {{blocks}}
{{/if}}

{{#if recentProgress}}
## Recent Progress
{{recentProgress}}
{{/if}}

## Epic Context
- **Epic**: {{epicId}}{{#if epicTitle}} - {{epicTitle}}{{/if}}

## Completion Protocol
When finished, close this bead and signal completion.
If your task description includes spawning rules, follow them before closing.

<promise>COMPLETE</promise>
```

That's it. The template doesn't need to know about phases, process beads,
or spawning — the bead descriptions carry all of that.

### 4.3 Bead Packs (Process Definitions)

Each bead pack is a strategy expressed as a set of beads. Packs are
delivered as **ralph-tui skills** — they run inside an agent (Claude Code)
and create beads via `br create`.

A skill is chosen over a static YAML file because:
- Skills can scan the actual input (list files, count LOC, check structure)
- Skills fill in variable slots with real paths and context
- Skills can adapt the number of beads based on input complexity
- Skills already have a distribution mechanism (ralph-tui skill system)

#### Skill Invocation: Conversational, Not Rigid CLI

Pack skills are invoked conversationally. The user doesn't need to
remember flags or construct precise CLI invocations. They say:

> "Reverse-engineer Calendly and produce a spec"

> "I want to study the auth module at src/auth/ and write a clean-room spec"

> "Reverse https://github.com/linear/linear — but our version should
> use REST instead of GraphQL and have built-in time tracking"

> "Decompose docs/specs/auth-spec.md into work beads"

The skill running inside the agent interprets the natural language
request and derives everything it needs:

| Parameter | How the Skill Derives It |
|---|---|
| Input type(s) | Classifies each input: local path, GitHub URL, product URL, doc URL, description/brief |
| Input paths/URLs | Extracted from the user's message |
| Differentiators | Extracted from "but our version should..." / "differs by..." phrasing |
| Output paths | Convention-based: `docs/specs/<project>-analysis.md` and `docs/specs/<project>-spec.md` for reverse; work epic under a new epic for decompose |
| Epic title | Inferred from input: "Reverse: Auth Module", "Reverse: Calendly Clone", "Decompose: Auth Module" |

If the skill can't infer something critical (e.g., the user says
"reverse-engineer this" without specifying what "this" is), it asks.
Otherwise it stamps the beads and reports what it created.

The `/stamp-reverse-pack --input ... --output ...` syntax shown in
the workflow section (Section 5) is the underlying skill invocation
format — what the skill resolves to internally. Users never need to
write it directly.

#### Reverse Pack: `any input -> clean-room spec`

The reverse pack produces a **clean-room specification**: a document so
thorough and self-contained that someone could reproduce the described
system from the spec alone, without ever seeing the original source
material. This is the foundational constraint that drives every bead.

**Input types the skill must handle:**

| Input Type | Example | How the Agent Studies It |
|---|---|---|
| Local source code | `src/auth/` | Read files, trace execution, examine types |
| GitHub repo URL | `https://github.com/user/repo` | Clone/browse repo, read code + README + docs |
| Live product URL | `https://app.example.com` | Observe UI, read API docs, examine behavior |
| Documentation URL | `https://docs.example.com/api` | Read docs, identify gaps, infer behavior |
| Description/brief | "A system that does X, Y, Z" | Work from requirements, research approaches |
| Mixed | GitHub URL + "but ours should differ by..." | Study reference, then adapt per instructions |

The skill classifies each input at stamp time and generates an
appropriate `## Source Material` section in the analyze bead's
description. The clean-room constraint, review prompts, and spawning
mechanics are the same regardless of input type.

The reverse skill creates these beads:

| # | Bead | Depends On | Purpose |
|---|---|---|---|
| 1 | Deep study of source material | — | Exhaustive analysis of all inputs |
| 2 | Draft clean-room specification | 1 | Produce the spec from understanding, not from copying |
| 3 | Fresh eyes review pass 1 | 2 | Cross-review, spawn fix-up beads |
| 4 | Fresh eyes review pass 2 | 3 | Second review (minimum baseline) |
| 5 | Fresh eyes review pass 3 | 4 | Third review (adaptive tail starts) |
| 6+ | (Adaptive) | 5 | Spawned if pass 3 still finds issues |
| Last | Clean-room verification and consolidation | last review | Final check: could you build this from the spec alone? |

**Bead 1 description** (deep study):

```markdown
## Objective
Exhaustively study and understand the source material described below.
Your goal is to build a deep mental model of WHAT the system does and
WHY — not to copy or paraphrase the source. You are preparing to write
a clean-room specification.

## What "Clean-Room Specification" Means
A clean-room spec describes a system's observable behavior, interfaces,
constraints, and design rationale in enough detail that a competent
engineer could reproduce an equivalent system from the spec alone,
without ever seeing the original source material. The spec must:
- Describe BEHAVIOR, not implementation (what it does, not how the code is structured)
- Be complete enough to build from (no "see the source for details")
- Capture the WHY behind design decisions (so the implementer makes good choices)
- Include edge cases, error handling, and failure modes
- Specify interfaces precisely (exact function signatures, data formats, protocols)
- Define constraints (performance, security, compatibility requirements)

## Source Material
{{#each inputs}}
### {{this.label}}
{{#if this.isLocalPath}}
**Type**: Local source code at `{{this.path}}`
Read ALL files under this path. For each file:
- Understand its role in the system
- Identify the public API (exported functions, classes, types)
- Trace how it connects to other files
- Note any implicit behavior (side effects, state mutations, event emissions)
{{/if}}
{{#if this.isGitHubUrl}}
**Type**: GitHub repository at {{this.url}}
Clone or browse this repository. Study:
- The README for stated purpose and architecture
- The source code for actual behavior
- Any docs/ directory for additional specification
- Issues and PRs for context on design decisions
- Package dependencies for understanding the technology choices
{{/if}}
{{#if this.isProductUrl}}
**Type**: Live product at {{this.url}}

This is a live product — you cannot see its source code. Your spec will
be based entirely on observable behavior and public documentation. This
is inherently clean-room, but you must be EXHAUSTIVE in finding every
public source of information about this product.

**Step 1: Discover all documentation and information sources.**
Starting from {{this.url}}, search for and catalog:
- The product's marketing/features pages (what does it claim to do?)
- Help center / knowledge base / support docs (how does it actually work?)
- API documentation (developer docs, reference, SDKs)
- Changelog / release notes / "what's new" pages
- Status page (what infrastructure does it reveal?)
- Pricing page (what features exist at each tier? this reveals the
  full feature matrix including things you can't see on the free plan)
- Blog / technical blog (architecture insights, design rationale)
- Public integrations page (what systems does it connect to?)
- Terms of service / privacy policy (data handling, retention, limits)
- Any public GitHub repos (SDKs, open-source components, API examples)
- Community forums or discussions

List every URL you find. You WILL be reading all of them.

**Step 2: Systematically study each source.**
For each documentation source found:
- Read it thoroughly
- Extract every feature, behavior, constraint, and interface described
- Note any inconsistencies between what marketing says and what docs say
- Note version/date information (is this current?)

**Step 3: Explore the product itself.**
- Sign up / use the free tier if possible
- Walk through every user-facing workflow end to end
- Note the exact UI flow, form fields, validation messages, error states
- Test edge cases (empty inputs, long strings, special characters)
- Observe what happens with notifications, emails, webhooks
- Check the network tab for API calls if accessible via browser
- Note what features are gated behind paid plans (visible but locked)

**Step 4: Identify what you CAN'T observe.**
Explicitly list things that a live product has but you cannot see from
the outside. These are KNOWN GAPS that the spec must acknowledge:
- Background jobs and scheduled tasks
- Admin/internal tools
- Data retention and cleanup policies
- Rate limiting and abuse prevention (unless you hit limits)
- Internal monitoring and alerting
- Database schema and storage decisions
- Authentication internals (hashing, token management)

For each known gap, the spec should say: "This behavior must be
specified during implementation. The reference product likely handles
this, but the exact approach is not observable."
{{/if}}
{{#if this.isDocUrl}}
**Type**: Documentation at {{this.url}}
Read ALL documentation at this URL. Be exhaustive — follow every link,
read every page, expand every section:
- API references (every endpoint, every parameter, every response type)
- Guides and tutorials (these reveal intended workflows and use cases)
- Conceptual docs (these explain the WHY behind the design)
- Glossary or terminology pages (these define the domain model)
- Migration guides (these reveal what changed and why — design history)
- Version history or changelogs (feature evolution, breaking changes)
- FAQ pages (these reveal common edge cases and misunderstandings)
- Note what's well-specified vs. vague or missing
- Note any implicit assumptions the docs make about the reader's context
{{/if}}
{{#if this.isDescription}}
**Type**: Requirements description
{{this.content}}
{{/if}}
{{/each}}

{{#if differentiators}}
## How Our System Should Differ
The source material is a REFERENCE, not a target. Our system should
differ in the following ways:
{{differentiators}}

Study the reference to understand the baseline, then design our spec
around these differentiators.
{{/if}}

## Instructions
1. Study ALL source material listed above — be exhaustive
2. For source code: read every file, trace execution flows, understand
   the full behavior surface
3. For URLs: explore thoroughly, take notes on everything you observe
4. For references with differentiators: understand the reference deeply
   enough to know what to keep, what to change, and what to add
5. Create a structured analysis document at `{{analysisPath}}` containing:
   - Summary of what the system does (behavioral, not structural)
   - All identified features and capabilities
   - All interfaces (APIs, data formats, protocols, UI surfaces)
   - All dependencies and external integrations
   - All constraints you can identify or infer
   - All edge cases and error handling behavior
   - Design decisions and their apparent rationale
   {{#if differentiators}}
   - How each differentiator affects the design
   {{/if}}

Think VERY hard about this. Be thorough. The quality of the final spec
depends entirely on how deeply you understand the source material now.
Miss something here and it will be missing from the spec, which means
it will be missing from the implementation.

## Parallel Research via Sub-Agents
If the source material is large, use **sub-agents** to research distinct
areas in parallel within this bead's session. This is ESPECIALLY
important for live products, which have many information surfaces to
explore.

The key insight: you do NOT need to spawn separate beads for parallel
research. You are an agent with access to sub-agents (e.g., the Task
tool in Claude Code). Launch multiple sub-agents concurrently, each
researching a different area. They all run in parallel within YOUR
session. When they return, you have all the research results and can
write the complete analysis document yourself.

**For a live product** (e.g., reverse-engineering Calendly), launch
sub-agents in parallel for:
- Scheduling and booking flow — the core product workflow
- API and integrations — developer docs, webhooks, SDKs
- User management and team features — accounts, roles, orgs
- Notifications and reminders — emails, SMS, in-app
- Pricing and feature matrix — what exists at each tier

**For a large codebase**, launch sub-agents in parallel per-subsystem:
- Authentication module — read and analyze src/auth/
- Data access layer — read and analyze src/database/
- API routes — read and analyze src/routes/

Give each sub-agent:
- Its specific scope (which files, URLs, or doc sections to examine)
- What to look for (features, behaviors, interfaces, constraints)
- The clean-room context: we are building a behavioral spec, not
  copying structure
- Instruction to return a structured research summary (not just raw
  notes — organized findings with sections for features, interfaces,
  constraints, edge cases)

When all sub-agents return, synthesize their findings into the analysis
document at `{{analysisPath}}`. You have the full picture now — you can
identify cross-cutting concerns, resolve inconsistencies between areas,
and organize the analysis coherently.

## Spawning Rules
After completing the analysis (either directly or via sub-agents),
decide whether the source material warrants child beads for the DRAFT
phase. In most cases it does NOT — the draft bead (bead 2) reads the
analysis document and writes the spec. Child study beads are only
needed if the source material is so large that even with sub-agent
research, important areas weren't covered in enough depth.

If you DO need to spawn additional study beads:

  br create --parent {{epicId}} \
    --title "Deep study: <area name>" \
    --type task \
    --description "<focused study instructions for this area, including:
      - Which specific files, URLs, or doc sections to examine
      - What to look for (features, behaviors, interfaces, constraints)
      - Instruction to append findings to {{analysisPath}} under the
        section heading '## <area name>'
      - The clean-room context: we are building a behavioral spec, not
        copying structure>"

  br dep add <new_bead_id> {{thisBeadId}}
  br dep add {{draftBeadId}} <new_bead_id>

The draft bead ({{draftBeadId}}) will wait for ALL study beads to
complete before starting the spec. But prefer doing the research in
this bead via sub-agents — it's faster and produces a more coherent
analysis.

## Completion
br close {{thisBeadId}} --reason "Analysis complete at {{analysisPath}}"
```

**Bead 2 description** (draft clean-room spec):

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
- Every constraint must be stated explicitly (performance targets,
  security requirements, compatibility needs)
- Every edge case must be documented with expected behavior
- Every design decision must include rationale (so the implementer
  understands WHY and can make good judgment calls on details the spec
  doesn't cover)

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
What does this system do? What problem does it solve? What is in scope
and what is explicitly out of scope?

### 2. Behavior Specification
For every feature and capability identified in the analysis, specify:
- The observable behavior (what happens from the outside)
- Trigger conditions (what causes the behavior)
- Inputs and expected outputs
- State changes
- Error conditions and how they are handled
- Edge cases

Be EXHAUSTIVE. If you found it in the analysis, it must be in the spec.
If the analysis is vague on something, think hard about what the
correct behavior should be and specify it explicitly.

### 3. Interfaces
For every interface (API endpoints, function signatures, data formats,
protocols, UI contracts):
- Exact signature/schema
- All parameters with types and constraints
- Return values with types
- Error types and when they occur
- Examples

### 4. Data Model
All data structures, their fields, relationships, and constraints.
If the system persists data, specify the conceptual model (not the
database schema — that's implementation).

### 5. Constraints
- Performance requirements (latency, throughput, resource limits)
- Security requirements (authentication, authorization, encryption)
- Compatibility requirements (platforms, versions, protocols)
- Reliability requirements (uptime, failure handling, recovery)

### 6. Dependencies
External systems, libraries, services that the system depends on.
For each: what it's used for, what version/capability is required,
and what happens if it's unavailable.

### 7. Edge Cases and Error Handling
Every edge case identified in the analysis, plus any you discover
while writing the spec. For each:
- The condition
- Expected behavior
- Recovery path (if applicable)

### 8. Design Rationale
Key design decisions and WHY they were made. This section is critical
for the clean-room property — it lets the implementer understand the
INTENT behind the spec so they can make good decisions on details
the spec doesn't explicitly cover.

{{#if differentiators}}
### 9. Differentiators from Reference
How and why this system differs from the reference implementation.
For each differentiator:
- What the reference does
- What we do instead
- Why the change improves the system
{{/if}}

## Quality Standard
The spec MUST be detailed enough that:
- An engineer who has never seen the original source could build an
  equivalent system from this spec alone
- No section is vague, hand-wavy, or says "implementation-defined"
  without specifying the constraints the implementation must satisfy
- Every "should" is actually a "must" — be prescriptive, not suggestive
- The spec could survive legal scrutiny as a clean-room document
  (no copied code, no structural mimicry of the source)

Think VERY hard. This document is the foundation for everything that
follows. If the spec is shallow, every downstream bead will produce
shallow work. If the spec is thorough, implementation becomes mechanical.

## Completion
br close {{thisBeadId}} --reason "Clean-room spec created at {{specPath}}"
```

**Beads 3-5 description** (fresh-eyes review passes — adapted from
Emanuel's cross-model review prompt):

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
to make it better, more robust/reliable, more performant, more
compelling/useful, etc.

For each issue found:
- Give your detailed analysis and rationale/justification for why the
  change would make the spec better
- If it's a minor fix (typo, formatting, small clarification), fix it
  directly in the spec
- If it's a significant gap or revision, create a fix-up bead (see
  Spawning Rules below)

Apply the CLEAN-ROOM TEST to every section: "Could an engineer who has
never seen the original source implement this correctly from what's
written here?" If the answer is no — if any behavior is ambiguous, any
interface is underspecified, any edge case is missing, any constraint
is vague — that's a gap.

Specifically look for:
- Behaviors described vaguely ("handles errors appropriately") instead
  of precisely ("returns HTTP 429 with Retry-After header")
- Interfaces missing parameter types, error types, or edge case behavior
- Constraints stated without numbers ("should be fast" vs "must respond
  within 50ms at p99")
- Design decisions stated without rationale (WHY is missing)
- Features mentioned in one section but not fully specified in another
- Missing sections for things that would be obvious to someone who saw
  the source but invisible to someone reading only the spec
- Implicit dependencies or assumptions that aren't stated

DO NOT OVERSIMPLIFY THINGS! DO NOT LOSE ANY FEATURES OR FUNCTIONALITY!
It's critical that EVERYTHING in the spec is preserved and improved,
not reduced. The spec should be getting MORE detailed with each review
pass, not less.

## Spawning Rules
For each SIGNIFICANT gap or needed revision:

  br create --parent {{epicId}} \
    --title "Fix spec: <concise description of the issue>" \
    --type task \
    --description "<self-contained instructions: what the problem is,
      where in the spec it is, exactly what to add/change, and why.
      Include the clean-room test: what would an implementer get wrong
      or miss if this gap isn't filled?>"

  br dep add <new_bead_id> {{thisBeadId}}

## REQUIRED: Wire Dependencies After Spawning
For EACH fix-up bead you created, block the next review pass on it:

  br dep add {{nextReviewBeadId}} <fix_bead_id>

Verify: `br show {{nextReviewBeadId}}` should list your fix-up beads.

{{#if isAdaptivePass}}
## Adaptive Continuation
This is pass {{passNumber}}. If you found significant issues and created
fix-up beads, also create the next review pass:

  br create --parent {{epicId}} \
    --title "Fresh eyes review pass {{nextPassNumber}}" \
    --type task \
    --description "<same review instructions with updated pass number>"

  Wire the new pass to depend on your fix-up beads.
  Wire the consolidation bead ({{consolidationBeadId}}) to depend on it:
    br dep add {{consolidationBeadId}} <new_pass_id>

If you found NO significant issues — the spec has reached steady state.
Close this bead normally. Do not spawn another pass.
{{/if}}

## At the End
After integrating all revisions, report:
- Which changes you wholeheartedly agree improve the spec
- Which you somewhat agree with
- Which you considered but rejected, and why

## Completion
br close {{thisBeadId}} --reason "Review pass {{passNumber}}: found N issues, created M fix-up beads"
```

**Consolidation bead description** (clean-room verification + final polish):

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
6. Is the spec free of references to "the source" or "the original" —
   it should be entirely self-standing?
7. Could this document survive legal scrutiny as clean-room work?

If ANY section fails the clean-room test, fix it now. This is the last
chance before the spec moves to decompose.

## Formatting and Consistency
1. Check heading levels are consistent throughout
2. Check list styles are uniform
3. Check code blocks have language tags
4. Check for contradictions between sections (especially after multiple
   review rounds added content independently)
5. Check that every "TBD", "TODO", or placeholder has been resolved
6. Check that section numbering is sequential and correct

## Final Assessment
At the end, write a brief assessment at the bottom of the spec:
- Confidence level that this spec is complete (high/medium/low)
- Any areas where the spec is weaker (fewer details, more assumptions)
- Recommendations for the decompose phase (what to pay extra attention to)

## Completion
br close {{thisBeadId}} --reason "Spec finalized — clean-room verified and ready for decompose"
```

The hybrid review strategy: **3 fixed passes (guaranteed minimum)**, then
adaptive spawning. Pass 3 carries `isAdaptivePass: true` and can spawn
pass 4 if still finding significant issues. Each adaptive pass carries
the same instruction. When a pass finds nothing significant, it closes
without spawning — the consolidation bead becomes ready and the phase
ends.

#### Decompose Pack: `spec → work beads`

The decompose pack consumes a clean-room specification and produces
**work beads**: self-contained implementation tasks that the forward
phase (`ralph-tui run`) will execute. The pack's primary constraint is
the **clean-room carry-through**: just as the reverse pack produced a
spec so thorough that you could build from it without seeing the source,
the decompose pack must produce work beads so detailed that an
implementing agent never needs to consult back to the spec. Emanuel's
words: "The beads should be so detailed that we never need to consult
back to the original markdown plan document."

The decompose pack's output is the most critical artifact in the entire
pipeline — it's what agents actually build from. A shallow work bead
produces shallow implementation. A thorough work bead makes
implementation mechanical.

**Input types the skill must handle:**

| Input Scenario | Challenge | How Bead 1 Handles It |
|---|---|---|
| Small spec (<300 lines) | May be a single subsystem | Single analysis pass, fewer phases |
| Large spec (1000+ lines) | Won't fit in one context window | Spawn per-area child beads to analyze sections in parallel |
| Multi-subsystem spec | Natural phase boundaries between subsystems | Each subsystem becomes a phase; shared infrastructure is phase 1 |
| Spec with differentiators from reference | Must capture delta reasoning in beads | Each work bead notes what differs from reference and why |
| Spec with known gaps (from reverse) | Gaps flagged in consolidation assessment | Create investigation beads for gaps before impl beads that depend on them |

The skill classifies the spec's size and structure at stamp time and
adjusts the number of process beads accordingly. For large specs, bead 1
spawns per-area child beads dynamically — the pack cannot know at stamp
time how many areas the spec covers.

The decompose skill creates these beads:

| # | Bead | Depends On | Purpose |
|---|---|---|---|
| 1 | Analyze spec and create phased implementation beads | — | Read entire spec, identify phases, create all work beads with phased structure |
| 2 | Review bead graph pass 1 | 1 | Cross-review every bead against the spec |
| 3 | Review bead graph pass 2 | 2 | Second review (minimum baseline) |
| 4 | Review bead graph pass 3 | 3 | Third review (adaptive tail starts) |
| 5+ | (Adaptive) | 4 | Spawned if pass 3 still finds issues |
| Last | Add structural beads (REVIEW, BUGSCAN, AUDIT) | last review | Wire quality gates into the work bead graph |

##### What a "Good" Work Bead Looks Like

The decompose pack's PRIMARY output is work beads. Every work bead
description must meet this quality standard — self-contained enough
that an implementing agent with ZERO prior context can execute it
correctly. Here is an example of a well-written work bead:

```markdown
## Objective
Implement the webhook delivery subsystem that sends HTTP POST
notifications to subscriber endpoints when events occur.

## Context: Why This Bead Exists
The event notification spec (Section 4.2) defines a webhook delivery
system that POST's JSON payloads to subscriber-registered URLs when
matching events fire. This is the core delivery mechanism — without it,
external integrations cannot receive real-time updates. The retry logic
here is critical: failed deliveries must retry with exponential backoff
so transient failures don't cause permanent data loss.

This bead is part of Phase 2 (Event Processing). Phase 1 built the
event bus and subscriber registration (beads br-020 through br-025).
This bead can assume:
- The EventBus class exists at src/events/bus.ts with a subscribe()
  method that accepts (eventType, handler) pairs
- The Subscriber model exists at src/models/subscriber.ts with fields:
  id, url, secret, eventTypes[], active, createdAt
- The event schema types exist at src/events/types.ts

Phase 3 (Dashboard UI) depends on this bead — the webhook delivery
logs feed the delivery status dashboard (bead br-040).

## Instructions
Create the following files:

### src/webhooks/deliver.ts
- Export an async function `deliverWebhook(subscriber: Subscriber,
  event: WebhookEvent): Promise<DeliveryResult>`
- Construct the payload: `{ id: uuid(), event: event.type,
  timestamp: ISO-8601, data: event.payload }`
- Sign the payload using HMAC-SHA256 with the subscriber's secret key
- Set headers: Content-Type: application/json, X-Webhook-Signature:
  sha256=<hex-digest>, X-Webhook-ID: <payload.id>
- POST to subscriber.url with a 10-second timeout
- Return DeliveryResult: { success: boolean, statusCode: number,
  responseTime: number, error?: string }

### src/webhooks/retry.ts
- Export an async function `deliverWithRetry(subscriber: Subscriber,
  event: WebhookEvent, maxAttempts: number = 5): Promise<DeliveryLog>`
- Retry on: network errors, HTTP 429, HTTP 5xx
- Do NOT retry on: HTTP 4xx (except 429), invalid URL
- Backoff schedule: 1s, 5s, 30s, 2min, 10min (exponential with jitter)
- After all retries exhausted, mark the delivery as permanently failed
- Log every attempt with timestamp, status, and response time

### src/webhooks/types.ts
- DeliveryResult type (see above)
- DeliveryLog type: { id, subscriberId, eventId, attempts: Attempt[],
  finalStatus: 'delivered' | 'failed', createdAt, completedAt }
- Attempt type: { attemptNumber, timestamp, statusCode, responseTime,
  error?: string }

### src/webhooks/processor.ts
- Export a class `WebhookProcessor` that:
  - Registers with EventBus to receive events
  - For each event, queries active subscribers matching the event type
  - Calls deliverWithRetry for each subscriber
  - Stores DeliveryLog results (use the repository pattern from Phase 1)
  - Emits a 'webhook.delivered' or 'webhook.failed' event for the
    dashboard to consume

## Test Requirements
Create `tests/webhooks/deliver.test.ts`:
- Test successful delivery (mock HTTP 200 response)
- Test signature verification (compute expected signature, compare)
- Test timeout handling (mock slow response > 10s)
- Test retry on 503 (mock 503 then 200, verify 2 attempts)
- Test no retry on 400 (mock 400, verify 1 attempt only)
- Test retry on 429 with Retry-After header (verify backoff respects it)
- Test max retries exhausted (mock 5 failures, verify permanently failed)
- Test jitter in backoff (verify consecutive retries aren't identical intervals)

Create `tests/webhooks/processor.test.ts`:
- Test event routing to correct subscribers only
- Test inactive subscribers are skipped
- Test delivery log is persisted after completion
- Test 'webhook.delivered' event is emitted on success
- Test 'webhook.failed' event is emitted after all retries exhausted

Use detailed logging in test output: log each retry attempt, each
subscriber matched, each delivery result. This makes test failures
diagnosable without re-running with debugger.

## Acceptance Criteria
- [ ] deliverWebhook sends correctly signed POST request
- [ ] deliverWithRetry retries transient failures with correct backoff
- [ ] deliverWithRetry does NOT retry client errors (except 429)
- [ ] WebhookProcessor routes events to matching subscribers only
- [ ] All delivery attempts are logged with full detail
- [ ] 8 unit tests pass for deliver.ts
- [ ] 5 integration tests pass for processor.ts
- [ ] No TypeScript errors in src/webhooks/

## Completion
br close <this_bead_id> --reason "Webhook delivery subsystem implemented with retry logic and 13 tests"
```

This example demonstrates every quality dimension:
- **Self-contained context**: explains why the bead exists, what was
  built before it, what depends on it — the implementing agent never
  needs to read the spec
- **Precise instructions**: exact file paths, function signatures,
  types, algorithms, error handling behavior
- **Test requirements**: specific test cases with expected behavior,
  not just "write tests"
- **Acceptance criteria**: checkable, binary conditions
- **Dependencies context**: what Phase 1 built that this bead builds on,
  what Phase 3 will build on this bead's output

Every work bead the decompose pack creates must meet this standard.

**Bead 1 description** (analyze spec and create phased implementation beads):

```markdown
## Objective
Read the entire clean-room specification and produce a comprehensive,
phased set of implementation beads. This is the most important bead in
the decompose process — every downstream agent will build from what you
create here.

## What "Clean-Room Carry-Through" Means
The spec you are reading was written clean-room: someone could build the
system from the spec alone. Your work beads must maintain this property.
Each work bead description must be so self-contained that:
- An implementing agent with ZERO context can execute it correctly
- The agent never needs to consult the spec document
- The agent never needs to read other beads to understand this one
- All relevant background, interfaces, constraints, and rationale from
  the spec are embedded directly into the bead description

Emanuel's standard: "The beads should be so detailed that we never need
to consult back to the original markdown plan document."

## The Spec
Read ALL of `{{specPath}}`.

If the spec is longer than approximately 500 lines, do NOT attempt to
hold it all in working memory at once. Instead:

1. First pass: read the entire spec to identify the high-level structure
   — what are the major subsystems, features, and components?
2. Create a decomposition plan (see Phase Structure below) BEFORE
   creating any beads
3. Then work through each area systematically, creating beads for that
   area with the spec section open for reference

If the spec is very large (1000+ lines) or covers multiple distinct
subsystems, spawn per-area child beads to create implementation beads
for each area in parallel (see Spawning Rules below).

## Phase Structure
Before creating ANY beads, analyze the spec and design the phase
structure. Phases represent logical groups of work where:
- Phase 1 beads have no dependencies on other phases (foundation)
- Phase N+1 beads depend on Phase N having been reviewed
- Each phase is a coherent unit that can be reviewed as a group

**How to identify phases:**

1. **Find the foundation layer.** What must exist before anything else
   can be built? This is Phase 1. Typical candidates:
   - Data models and types
   - Configuration and environment setup
   - Core utilities and shared infrastructure
   - Database schema and migrations

2. **Find the core logic layer.** What uses the foundation to implement
   the primary behavior? This is Phase 2. Typical candidates:
   - Business logic modules
   - Service classes
   - Core algorithms
   - Event processing

3. **Find the integration layer.** What connects the core logic to the
   outside world? This is Phase 3. Typical candidates:
   - API endpoints and routes
   - Webhook handlers
   - External service integrations
   - CLI commands

4. **Find the presentation layer.** What do users directly interact
   with? This is Phase 4. Typical candidates:
   - UI components
   - Dashboard pages
   - Notification systems
   - Documentation

5. **Find the cross-cutting concerns.** These may span phases or form
   their own phase:
   - Authentication and authorization
   - Logging and monitoring
   - Error handling infrastructure
   - Performance optimization

Not every spec has 4-5 phases. A focused spec may have 2. A large
spec may have 6+. Use the natural structure of the spec, not a rigid
template. The goal is that each phase produces something testable and
reviewable before the next phase builds on it.

**Priority assignment for beads-rust sorting:**

Within each phase, assign priorities so beads-rust processes them in
the correct order:

| Bead Type | Priority | Rationale |
|---|---|---|
| Phase N impl beads | N × 10 | Groups phases; leaves room for insertion |
| Phase N test beads | N × 10 + 1 | Tests run after the code they test |
| Phase N REVIEW gate | N × 10 + 5 | Review after all impl + tests in phase |

Example for a 3-phase decomposition:
- Phase 1 impl beads: priority 10
- Phase 1 test beads: priority 11
- REVIEW-1: priority 15 (depends on all Phase 1 beads)
- Phase 2 impl beads: priority 20 (depend on REVIEW-1)
- Phase 2 test beads: priority 21
- REVIEW-2: priority 25 (depends on all Phase 2 beads)
- Phase 3 impl beads: priority 30 (depend on REVIEW-2)
- Phase 3 test beads: priority 31
- REVIEW-3: priority 35

This ensures beads-rust's simple priority sort produces the correct
structural ordering even without analyzing the dependency graph.

## Work Bead Quality Standard
For EACH implementation bead you create, the description MUST contain:

1. **Objective** — one sentence: what does this bead produce?
2. **Context: Why This Bead Exists** — how it fits the bigger picture,
   what spec section it implements, what was built before it (by which
   beads), what depends on it
3. **Instructions** — exact file paths to create/modify, exact function
   signatures, exact types, exact algorithms. NOT "implement the webhook
   system" but "create src/webhooks/deliver.ts exporting async function
   deliverWebhook(subscriber: Subscriber, event: WebhookEvent):
   Promise<DeliveryResult>"
4. **Test Requirements** — specific test file paths, specific test cases
   with expected inputs/outputs, specific edge cases to cover. Include:
   "Use detailed logging in test output so we can be sure that everything
   is working perfectly."
5. **Acceptance Criteria** — checkable, binary conditions: "[ ] webhook
   POST includes HMAC-SHA256 signature" not "webhooks work correctly"
6. **Completion** — `br close <this_bead_id> --reason "<what was done>"`

Each bead description should include relevant background,
reasoning/justification, considerations, etc. — anything we'd want our
"future self" to know about the goals and intentions and thought process
and how it serves the over-arching goals of the project.

It's critical that EVERYTHING from the spec be embedded into the beads
so that we never need to refer back to the spec and we don't lose any
important context or ideas or insights.

Also make sure that as part of the beads we include comprehensive unit
tests and e2e test scripts with great, detailed logging so we can be
sure that everything is working perfectly after implementation.

## Area Labels for Model Routing
Set area labels on work beads to enable per-bead model routing:

  br create --parent {{workEpicId}} \
    --title "<concise title>" \
    --type task \
    --priority <priority> \
    --area "<area label>" \
    --description "<self-contained, detailed instructions>"

Area labels should reflect the domain of the bead:
- `core` — data models, types, shared utilities
- `backend` — API routes, services, business logic
- `frontend` — UI components, pages, client-side logic
- `database` — schema, migrations, queries
- `infra` — deployment, CI/CD, configuration
- `test` — dedicated test beads (test-only, not impl+test)
- `docs` — documentation beads

## Parallel Analysis via Sub-Agents
If the spec covers multiple distinct subsystems or is too large to
process in a single pass (roughly >500 lines), use **sub-agents** to
analyze spec areas in parallel within this bead's session.

The key insight: you do NOT need to spawn separate beads for the
analysis and bead-creation work. You are an agent with access to
sub-agents (e.g., the Task tool in Claude Code). Launch multiple
sub-agents concurrently, each analyzing a different area of the spec.
They all run in parallel within YOUR session. When they return, you
have all the analysis results and can create all the work beads
yourself with the analysis already baked into the descriptions.

**For a multi-subsystem spec**, launch sub-agents in parallel for:
- Each major subsystem (e.g., "analyze the authentication section",
  "analyze the event processing section", "analyze the API section")
- Give each sub-agent its specific spec sections to focus on
- Ask each to return: identified beads with titles, descriptions,
  dependencies, phase assignment, and test requirements

**For a very large spec (1000+ lines)**, launch sub-agents to:
- Read and summarize different sections of the spec
- Identify the natural phase boundaries within their sections
- Propose bead breakdowns with draft descriptions

When all sub-agents return, synthesize their proposals:
- Resolve cross-area dependencies (sub-agent A's beads may depend
  on sub-agent B's beads)
- Ensure consistent phase assignment across areas
- Verify no spec coverage gaps between areas
- Create all work beads via `br create` with the full, self-contained
  descriptions that embed the sub-agents' analysis

This approach is faster than spawning separate beads AND produces
better results — you have the full picture when creating beads, so
you can wire cross-area dependencies correctly and ensure consistent
quality across all descriptions.

## Spawning Rules
After creating all work beads (either directly or with sub-agent
assistance), this bead closes. The work beads are created directly
under {{workEpicId}} — they are NOT child beads of this bead, they
are the actual implementation beads that the forward phase will run.

All work beads should be created by THIS bead. Do not spawn child
process beads to create work beads — that fragments the bead graph
and makes cross-area dependency wiring unreliable. Use sub-agents
for the analysis, but do the `br create` calls yourself so you can
wire everything correctly.

## Creating REVIEW Gate Beads Between Phases
After identifying the phase structure, create the REVIEW gate beads
that sit between phases:

For each phase boundary:

  br create --parent {{workEpicId}} \
    --title "REVIEW-<N>: Phase <N> implementation review" \
    --type task \
    --priority <N × 10 + 5> \
    --area "review" \
    --description "## Objective
  Review all Phase <N> implementation beads. Verify they produce
  correct, tested, integrated code before Phase <N+1> begins.

  ## Instructions
  1. List all Phase <N> beads: br list --parent {{workEpicId}}
     (filter by priority range <N×10> to <N×10+4>)
  2. For each closed bead, examine what it produced:
     - Read the files it created/modified
     - Run its tests
     - Check it meets its acceptance criteria
  3. If a bead's implementation has issues, create a fix-up bead:

     br create --parent {{workEpicId}} \
       --title 'Fix: <what is wrong>' \
       --type task \
       --priority <N × 10 + 3> \
       --description '<self-contained fix instructions>'

     br dep add <fix_id> {{thisBeadId}}
     br dep add <next_phase_first_bead_or_next_review> <fix_id>

  4. Run the full test suite: verify no regressions from Phase <N>

  ## Acceptance Criteria
  - [ ] Every Phase <N> bead's acceptance criteria verified
  - [ ] All tests pass (unit + integration for Phase <N>)
  - [ ] No obvious bugs or missing error handling
  - [ ] Code follows project conventions

  ## Completion
  br close <this_bead_id> --reason 'Phase <N> review: M beads verified, K fix-up beads created'"

Wire dependencies: REVIEW-N depends on ALL Phase N impl and test beads.
Phase N+1's first impl beads depend on REVIEW-N.

## Completion
After creating all work beads, REVIEW gates, and wiring all
dependencies, report what you created:

br close {{thisBeadId}} --reason "Created N impl beads, M test beads, K REVIEW gates across P phases under {{workEpicId}}"
```

**Beads 2-4 description** (bead graph review — adapted from Emanuel's
bead refinement prompt):

```markdown
## Objective
Check over each bead super carefully — are you sure it makes sense?
Is it optimal? Could we change anything to make the system work better
for users?

This is review pass {{passNumber}} of the decompose bead graph. You are
reviewing the PLAN, not code. This is the cheapest place to find and
fix problems — it's a lot easier and faster to operate in "plan space"
before we start implementing these things!

## The Spec
Read ALL of `{{specPath}}` so it's fresh in your mind. You will be
checking every work bead against this spec.

## Instructions
Examine every bead under the work epic:

  br list --parent {{workEpicId}}

For EACH bead, run `br show <bead_id>` and read its full description.
Then evaluate it against EVERY criterion below. Do not skim. Do not
skip beads. Check. Every. One.

**If there are many beads (>15)**, use sub-agents to review groups
of beads in parallel. For example, launch one sub-agent per phase —
each reads the spec sections relevant to its phase and reviews the
beads in that phase against all criteria below. When sub-agents
return their findings, synthesize: resolve conflicts, check cross-phase
issues they couldn't see individually, then apply the revisions.

### Criterion 1: Spec Coverage
Does every requirement in the spec have a corresponding bead? Go
section by section through the spec and verify:
- Every feature described in the spec has at least one impl bead
- Every interface defined in the spec (API endpoint, function
  signature, data format) has a bead that creates it
- Every constraint in the spec (performance, security, compatibility)
  is addressed by a bead
- Every edge case documented in the spec has a bead that handles it
- Every error condition in the spec has a bead that implements its
  handling

If you find a spec requirement with no corresponding bead, create one.

### Criterion 2: Self-Containment (The Zero-Context Test)
For each bead, ask: "If I gave this description to an agent who has
never seen the spec, never seen the codebase, and has no memory of
this project — could they implement it correctly?"

If the answer is no, the description is incomplete. Common failures:
- References "the spec" or "as described in the spec" — the agent
  won't have the spec. Embed the relevant information directly.
- Says "implement the webhook system" without specifying WHICH
  functions, WHICH files, WHICH signatures
- Says "handle errors appropriately" without specifying WHICH errors
  and WHAT the handling should be
- Assumes the agent knows the project structure — specify file paths
- Assumes the agent knows what other beads built — describe the
  interfaces the agent can rely on

Fix every failure. Use `br edit <bead_id> --description "..."` to
update descriptions. The description should get MORE detailed, not less.

### Criterion 3: Dependency Correctness
Check the dependency graph for:
- **Missing dependencies**: Does bead X use something that bead Y
  creates? Then X must depend on Y (or on the REVIEW gate after Y's
  phase)
- **Circular dependencies**: Follow the dependency chain — does it
  loop? If so, break the cycle by merging beads or restructuring
- **Over-constraining**: Does bead X depend on bead Y when they could
  run in parallel? Remove unnecessary dependencies to maximize
  parallelism
- **Phase gate wiring**: Does every impl bead in Phase N depend on
  REVIEW-(N-1)? Does REVIEW-N depend on all impl beads in Phase N?

Use `br dep add` / `br dep remove` to fix dependency issues.

### Criterion 4: Right-Sizing
Each bead must be completable in one agent session. Signs a bead is
too large:
- Description is >1000 words (agent may lose focus)
- Creates more than 5 files
- Covers multiple unrelated concerns
- Has both "build the module" AND "write all the tests" (split these)

Signs a bead is too small:
- Creates a single type definition with 3 fields
- Could be done as part of an adjacent bead without overloading it

Split large beads. Merge trivial beads. Each bead should represent
roughly one "unit of work" — a coherent piece that an agent can
complete in a focused session.

### Criterion 5: Phase Structure
Is the phasing logical?
- Does Phase 1 truly have no dependencies on later phases?
- Could any Phase 2 bead actually start earlier (move to Phase 1)?
- Could any Phase 1 bead actually be deferred (move to Phase 2)?
- Are phase boundaries aligned with natural integration points?
- Are REVIEW gates positioned where they can catch real issues?

### Criterion 6: Test Coverage
Every impl bead should have corresponding test coverage. This can be
test cases within the impl bead itself, or a separate test bead. Check:
- Does every module have unit tests specified?
- Are integration test beads present for components that interact?
- Are edge cases from the spec reflected in test cases?
- Do test descriptions include "detailed logging so we can be sure
  that everything is working perfectly"?

If test coverage is missing, create test beads or add test requirements
to existing impl beads.

### Criterion 7: Area Labels
Are area labels set correctly for model routing?
- `core` beads are genuinely shared infrastructure
- `backend` / `frontend` / `database` labels match the bead's domain
- `test` beads are test-only (not impl beads that happen to include tests)
- No beads are missing area labels

## Revision Instructions
For each issue found:

- **Minor fix** (typo, small clarification, add a missing test case):
  Fix it directly: `br edit <bead_id> --description "..."`

- **Significant structural issue** (missing bead, wrong phasing, bead
  too large): Create new beads with `br create`, split/merge existing
  beads, adjust dependencies with `br dep add` / `br dep remove`

- **Missing spec coverage**: Create a new bead with a full description
  meeting the quality standard

For EVERY revision, note what you changed and why. You will report
this at the end.

DO NOT OVERSIMPLIFY THINGS! DO NOT LOSE ANY FEATURES OR FUNCTIONALITY!
The bead graph should be getting MORE detailed and MORE thorough with
each review pass, not less.

It's critical that EVERYTHING from the spec be embedded into the beads
so that we never need to refer back to the spec and we don't lose any
important context or ideas or insights into the new features planned
and why we are making them.

## Spawning Rules
If you create new beads during review:

For each new bead created:

  br create --parent {{workEpicId}} \
    --title "<concise title>" \
    --type task \
    --priority <appropriate for its phase> \
    --area "<area label>" \
    --description "<self-contained, detailed instructions meeting
      the quality standard>"

Wire it into the correct position:
  br dep add <new_bead_id> <its upstream dependency>
  br dep add <its downstream dependent> <new_bead_id>

## REQUIRED: Wire Dependencies After Spawning
For EACH new bead you created, ensure it is wired into the phase
structure correctly:

1. It depends on the appropriate upstream beads or REVIEW gate
2. Downstream beads or REVIEW gates depend on it

If you created beads that should complete before the next review pass:

  br dep add {{nextReviewBeadId}} <new_bead_id>

## Verify Dependencies
Run: br show {{nextReviewBeadId}}
Confirm it lists your new beads in its dependencies.

## Stop Condition
If you find that issues from a previous pass are already being addressed
by other open beads, do not duplicate that work. Focus only on NEW issues
not covered by existing beads.

{{#if isAdaptivePass}}
## Adaptive Continuation
This is review pass {{passNumber}}. If you made significant revisions
(created new beads, restructured phases, or rewrote >5 bead
descriptions), spawn the next review pass:

  br create --parent {{epicId}} \
    --title "Review bead graph pass {{nextPassNumber}}" \
    --type task \
    --description "<same review instructions with passNumber={{nextPassNumber}},
      isAdaptivePass=true, and updated bead IDs>"

  Wire the new pass:
    br dep add <new_pass_id> <your fix-up/new beads>
    br dep add {{structuralBeadId}} <new_pass_id>

  The existing dep from {{structuralBeadId}} on this bead will be
  satisfied when you close. The new dep on the next pass keeps the
  structural bead blocked until the adaptive chain completes.

If you found only trivial issues (or no issues) — the bead graph has
reached steady state. Close without spawning. The structural bead
becomes ready and the decompose phase completes.
{{/if}}

## At the End
After all revisions, report:
1. Total beads reviewed
2. Beads revised (with one-line summary of each revision)
3. New beads created (with titles and IDs)
4. Beads merged or removed (with rationale)
5. Remaining concerns (things you noticed but didn't fix, if any)

## Completion
br close {{thisBeadId}} --reason "Review pass {{passNumber}}: reviewed N beads, revised M descriptions, created K new beads, fixed J dependency issues"
```

**Adaptive pass description** (spawned by pass 3 or a subsequent adaptive pass):

When pass 3 (or a later adaptive pass) spawns the next review pass,
the spawned bead carries the SAME review instructions above with these
differences:
- `passNumber` is incremented
- `isAdaptivePass` is `true`
- `nextReviewBeadId` is not pre-stamped (the adaptive pass must itself
  decide whether to spawn another pass)
- The `structuralBeadId` (the "add structural beads" bead) is carried
  through so the adaptive pass can wire it if it spawns further passes

The adaptive pass description is identical in review criteria and rigor.
The only difference is the spawning logic: it can spawn another adaptive
pass if it found significant issues, or close without spawning if the
bead graph has reached steady state.

**Last bead description** (add structural beads — REVIEW, BUGSCAN, AUDIT):

```markdown
## Objective
Add quality-gate beads to the work bead graph: REVIEW beads for
phase-boundary code review, a BUGSCAN bead for dedicated bug hunting,
and an AUDIT bead for final verification. These are the beads that
catch implementation problems before the work is considered done.

This bead runs after all decompose review passes have completed, so
the work bead graph is finalized. You are adding quality gates to a
finished plan.

## Instructions

### Step 1: Understand the Current Bead Graph
Read the full bead graph:

  br list --parent {{workEpicId}}

Identify:
- How many phases exist (look at priority groupings)
- What the last impl bead in each phase is
- What the last REVIEW gate in each phase is
- What the overall last bead is

### Step 2: Create Phase-Boundary REVIEW Beads
The decompose pack may have already created REVIEW gate beads between
phases. Examine each one. If they exist, verify their descriptions
are thorough (see template below). If they are thin or missing, create
or replace them.

For each phase, the REVIEW bead should have this description:

  br create --parent {{workEpicId}} \
    --title "REVIEW: Phase <N> code review" \
    --type task \
    --priority <N × 10 + 5> \
    --area "review" \
    --description "## Objective
  Carefully read over all the code implemented in Phase <N> with
  completely fresh eyes. You have NOT seen this code before. You are
  reviewing it as a fresh-eyes reviewer who must understand, verify,
  and approve the implementation.

  ## Context
  Phase <N> implemented: <list what Phase N covers — embed from the
  spec, do NOT say 'see the spec'>

  The following beads were implemented in Phase <N>:
  <list bead titles and IDs so the reviewer knows what to look for>

  ## Review Instructions
  For each bead's implementation:
  1. Read every file that was created or modified
  2. Trace execution flows from entry point to completion
  3. Verify the implementation matches the bead's acceptance criteria
  4. Look for:
     - Off-by-one errors
     - Missing error handling (especially for edge cases in the spec)
     - Race conditions in async code
     - Incorrect assumptions about data formats
     - Missing null/undefined checks
     - Logic errors in conditionals
     - Resource leaks (unclosed connections, files, streams)
     - Security issues (injection, XSS, auth bypass, unvalidated input)
     - Missing or incomplete test coverage
  5. Run the tests for this phase and verify they pass

  For each issue found, create a fix-up bead:

    br create --parent {{workEpicId}} \
      --title 'Fix: <concise description>' \
      --type task \
      --priority <N × 10 + 3> \
      --area '<matching area>' \
      --description '## Bug
    <describe what is wrong, in which file, at which line/function>

    ## Expected Behavior
    <what should happen instead, with specific detail>

    ## Fix
    <specific instructions for the fix — not vague, tell the agent
    exactly what to change>

    ## Verification
    <how to verify the fix: specific test to run, specific behavior
    to check>

    ## Completion
    br close <this_id> --reason \"Fixed: <what was fixed>\"'

  ## REQUIRED: Wire Fix-Up Dependencies
  For EACH fix-up bead you created:

    br dep add <fix_bead_id> {{thisBeadId}}
    br dep add <next_phase_review_or_bugscan_id> <fix_bead_id>

  Verify: br show <next_phase_review_or_bugscan_id> should list
  your fix-up beads.

  ## Completion
  br close <this_bead_id> --reason 'Phase <N> review: M files reviewed, K issues found, J fix-up beads created'"

Wire REVIEW-N to depend on all Phase N impl/test beads.
Wire Phase N+1's first beads to depend on REVIEW-N.

### Step 3: Create the BUGSCAN Bead
The BUGSCAN bead is a dedicated bug-hunting pass that runs after all
phases are complete. It has no knowledge of what was "supposed" to be
built — it looks at the code as-is with completely fresh eyes.

  br create --parent {{workEpicId}} \
    --title "BUGSCAN: Full codebase bug scan" \
    --type task \
    --priority 90 \
    --area "review" \
    --description "## Objective
  Randomly explore code files in the project. Deeply investigate.
  Trace execution flows. Find bugs with completely fresh eyes.

  You are NOT reviewing against a spec or plan. You are looking at
  code as a skeptical, experienced engineer who has never seen this
  codebase before. Your only goal is to find bugs.

  ## Instructions
  1. Get an overview of the project structure
  2. Pick a file at random. Read it carefully.
  3. Trace every execution path through the code:
     - What happens with valid input?
     - What happens with invalid input?
     - What happens with empty/null/undefined input?
     - What happens under concurrent access?
     - What happens when an external dependency fails?
  4. Look specifically for:
     - Off-by-one errors
     - Missing error handling
     - Race conditions
     - Incorrect type assumptions
     - Missing validation
     - Resource leaks
     - Security vulnerabilities
     - Logic errors that would produce wrong results silently
     - Inconsistencies between related code paths
  5. Move to another file. Repeat. Cover as much of the codebase as
     you can in one session.

  For each bug found:

    br create --parent {{workEpicId}} \
      --title 'Bug: <concise description>' \
      --type task \
      --priority 91 \
      --area '<matching area>' \
      --description '## Bug
    File: <exact file path>
    Function/Line: <exact location>
    <describe the bug: what is wrong, what input triggers it, what
    the incorrect behavior is>

    ## Expected Behavior
    <what should happen instead>

    ## Fix
    <specific fix instructions>

    ## Verification
    <specific test or check to verify the fix>

    ## Completion
    br close <this_id> --reason \"Fixed bug: <summary>\"'

    br dep add <bug_bead_id> {{thisBeadId}}
    br dep add {{auditBeadId}} <bug_bead_id>

  ## REQUIRED: Wire Bug Beads to AUDIT
  For EACH bug bead you created, block the AUDIT bead on it:

    br dep add {{auditBeadId}} <bug_bead_id>

  Verify: br show {{auditBeadId}} should list your bug beads.

  ## Completion
  br close <this_bead_id> --reason 'BUGSCAN: scanned N files, found M bugs, created M fix beads'"

Wire BUGSCAN to depend on the last phase's REVIEW bead.

### Step 4: Create the AUDIT Bead
The AUDIT bead is the final quality gate. It runs after all bug fixes
are complete and performs a holistic verification.

  br create --parent {{workEpicId}} \
    --title "AUDIT: Final verification and integration test" \
    --type task \
    --priority 95 \
    --area "review" \
    --description "## Objective
  Final verification that the implementation is complete, correct,
  and ready for use. This is the last bead — after this, the work
  epic is done.

  ## Instructions
  ### 1. Test Suite Verification
  Run the FULL test suite. Every test must pass.
  If any test fails:
  - Diagnose the failure
  - Fix it directly (this is the final bead — no more spawning fix
    beads, fix issues in-place)
  - Re-run to verify the fix

  ### 2. Integration Verification
  Test the system end-to-end:
  - Start the application/service
  - Exercise the primary workflows described in the beads
  - Verify outputs match expected behavior
  - Test at least one error/edge case path end-to-end

  ### 3. Completeness Check
  List all beads in the epic:
    br list --parent {{workEpicId}}

  For each closed impl bead, verify its acceptance criteria were met
  by examining the actual code/tests that were produced.

  ### 4. Code Quality Scan
  Look for:
  - TODO/FIXME comments that indicate unfinished work
  - Commented-out code that should be removed
  - Console.log / debug statements that should be removed
  - Hardcoded values that should be configuration
  - Missing TypeScript types (any usage of 'any')
  - Inconsistent naming or coding conventions

  Fix any issues found directly.

  ### 5. Final Report
  Write a summary to the bead close reason:
  - Total tests passing
  - Any tests skipped (and why)
  - Code quality issues found and fixed
  - Overall assessment: is this implementation ready?

  ## Completion
  br close <this_bead_id> --reason 'AUDIT: N tests passing, M issues fixed, implementation is [ready/not ready]'"

Wire AUDIT to depend on BUGSCAN (and any bug-fix beads BUGSCAN creates
will also be wired as AUDIT dependencies by the BUGSCAN bead).

### Step 5: Verify the Complete Structure
After creating all structural beads, verify the full graph:

  br list --parent {{workEpicId}}

The structure should be:
```
Phase 1 impl beads (priority 10)     deps: none
Phase 1 test beads (priority 11)     deps: related impl beads
  └─→ REVIEW-1 (priority 15)        deps: all Phase 1 beads
        └─→ Phase 2 impl (priority 20)  deps: REVIEW-1
        └─→ Phase 2 test (priority 21)  deps: related Phase 2 impl
              └─→ REVIEW-2 (priority 25) deps: all Phase 2 beads
                    └─→ ... more phases ...
                          └─→ REVIEW-N (priority N×10+5)
                                └─→ BUGSCAN (priority 90) deps: REVIEW-N
                                      └─→ AUDIT (priority 95) deps: BUGSCAN
```

Verify:
1. Every impl/test bead belongs to exactly one phase
2. Every REVIEW bead depends on all beads in its phase
3. Every phase's first beads depend on the previous REVIEW
4. BUGSCAN depends on the last REVIEW
5. AUDIT depends on BUGSCAN
6. No circular dependencies exist
7. No orphan beads (beads with no dependents AND no dependencies,
   unless they are Phase 1 beads)

## Completion
br close {{thisBeadId}} --reason "Added structural beads: K REVIEW gates, 1 BUGSCAN, 1 AUDIT under {{workEpicId}}"
```

The hybrid review strategy for decompose mirrors the reverse pack:
**3 fixed passes (guaranteed minimum)**, then adaptive spawning. Pass 3
carries `isAdaptivePass: true` and can spawn pass 4 if still finding
significant issues. Each adaptive pass carries the same review criteria
and rigor. When a pass finds only trivial issues, it closes without
spawning — the structural bead becomes ready and the decompose phase
completes.

The decompose pack produces **work beads** as its output — these are the
beads that the forward phase (a plain `ralph-tui run`) will execute.

#### Polish Pack: `post-forward review`

This is a bonus pack for after forward execution:

| # | Bead | Depends On | Purpose |
|---|---|---|---|
| 1 | Fresh eyes code review pass 1 | — | Explore code, find bugs, spawn fix beads |
| 2 | Fresh eyes code review pass 2 | 1 | Second pass |
| 3 | Fresh eyes code review pass 3 | 2 | Third pass (adaptive tail starts here) |
| 4 | Test coverage review | last review | Identify test gaps, spawn test-writing beads |
| 5 | Final integration verification | 4 | Run full test suite, verify everything works |

**Beads 1-3 description** (post-implementation fresh-eyes — adapted from
Emanuel's polish-phase prompts):

```markdown
## Objective
Carefully read over all the code that was implemented with completely
fresh eyes, looking for obvious bugs.

## Instructions
Randomly explore code files in the project. Deeply investigate. Trace
execution flows. Find bugs with fresh eyes.

For each area you examine:
1. Read the code as if seeing it for the first time
2. Trace the execution flow from entry point through to completion
3. Look for:
   - Off-by-one errors
   - Missing error handling
   - Race conditions
   - Incorrect assumptions about data formats
   - Missing null/undefined checks
   - Logic errors in conditionals
   - Resource leaks (unclosed connections, files, etc.)
   - Security issues (injection, XSS, auth bypass)
4. For each bug found, create a fix bead:

  br create --parent {{epicId}} \
    --title "Fix bug: <concise description>" \
    --type task \
    --priority 1 \
    --description "## Bug
  <describe what's wrong and where>

  ## Expected behavior
  <what should happen>

  ## Fix
  <specific instructions for the fix>

  ## Verification
  <how to verify the fix works — specific test to run or behavior to check>"

  br dep add <fix_bead_id> {{thisBeadId}}
  br dep add {{nextReviewBeadId}} <fix_bead_id>

Also look for code written by previous agent sessions that may have
introduced inconsistencies, incomplete implementations, or patterns
that don't match the rest of the codebase.

{{#if isAdaptivePass}}
## Adaptive Continuation
If you found significant bugs, spawn another review pass after your
fix beads. If no significant issues — the code has reached steady state.
{{/if}}

## Completion
br close {{thisBeadId}} --reason "Found N bugs, created M fix beads"
```

**Test coverage review bead description:**

```markdown
## Objective
Review test coverage and create beads for missing tests.

## Instructions
Examine all test files in the project. Compare against the implementation:

1. Identify functions/modules with no test coverage
2. Identify edge cases not covered by existing tests
3. Identify integration test gaps (components that interact but aren't
   tested together)
4. For each gap, create a bead:

  br create --parent {{epicId}} \
    --title "Add tests: <what to test>" \
    --type task \
    --description "## What to test
  <specific functions, modules, or integration points>

  ## Test cases needed
  <specific scenarios, including edge cases>

  ## Expected behavior
  <what the tests should verify>

  Include great, detailed logging in test output so we can be sure
  everything is working perfectly."

Make sure tests are comprehensive with detailed logging so we can be
sure that everything is working perfectly after implementation.

## Completion
br close {{thisBeadId}} --reason "Created N test beads"
```

### 4.4 Bead Spawning Protocol

When a bead's description includes spawning rules, the agent creates child
beads using `br create`. Since ralph-tui re-queries the tracker each
iteration, spawned beads are automatically picked up.

**Spawn conventions** (encoded in descriptions):

1. Use `--parent <epicId>` for all spawned beads
2. Add `br dep add <new> <this>` so spawned beads run after the current one
3. Write self-contained descriptions (the next agent has no memory)
4. Label spawned beads: `process:<phase>` for process beads,
   `area:<domain>` for work beads
5. Keep each bead right-sized for one agent session

**Safety bounds**:
- Ralph-tui's `--iterations` flag acts as a hard cap
- Descriptions can include "maximum spawn" instructions: "Create at most
  5 child beads per pass"
- The hybrid review strategy (fixed minimum + adaptive) prevents both
  premature termination and runaway spawning

#### Sub-Agents Within Beads: Parallel Work Without Spawning

Every agent running a bead has access to **sub-agents** — lightweight
parallel workers that execute within the agent's own session (e.g.,
the Task tool in Claude Code, or equivalent in other agent frameworks).
This is a distinct mechanism from bead spawning and serves a different
purpose:

| Mechanism | What It Does | When to Use |
|---|---|---|
| **Sub-agents** | Parallel work within a single bead session | Research, analysis, reading multiple files/URLs, reviewing multiple beads — any work that can be parallelized and synthesized before creating beads |
| **Bead spawning** (`br create`) | Creates new beads for future execution | Work that requires its own fresh context, its own session, or needs to be tracked/reviewed independently |

**The key principle:** Use sub-agents to parallelize the *thinking*,
then use bead spawning to create the *work units* that result from
that thinking. Sub-agents gather and analyze; beads execute and
produce artifacts.

**This pattern is recursive.** When a spawned bead later executes,
its agent also has access to sub-agents. And if that agent spawns
further beads via `br create`, those beads' agents will have sub-agents
too. The graph grows at any depth:

```
Bead 1 executes
  ├─ sub-agent A researches area X (parallel)
  ├─ sub-agent B researches area Y (parallel)
  ├─ sub-agent C researches area Z (parallel)
  └─ agent synthesizes → creates beads br-010, br-011, br-012
       │
       ├─ br-010 executes later
       │    ├─ sub-agent D explores subsystem detail (parallel)
       │    ├─ sub-agent E explores subsystem detail (parallel)
       │    └─ agent discovers more work → creates br-020, br-021
       │
       ├─ br-011 executes later
       │    └─ (work is straightforward, no sub-agents needed)
       │
       └─ br-012 executes later
            ├─ sub-agent F reviews related code (parallel)
            └─ agent finds edge case → creates br-022
```

Every bead's description should assume the executing agent has sub-agent
capabilities. Bead descriptions can (and should) suggest using sub-agents
for parallelizable work: "Use sub-agents to read the following 5 spec
sections in parallel, then synthesize their findings before creating
beads."

#### 4.4.1 The Dependency Wiring Problem

When a review bead spawns fix-up beads, the *next* review pass is already
stamped with dependencies on the *current* review pass only. Once the
current pass closes, the next pass becomes ready immediately — before
the fix-up beads have run. This means the next review could run against
unfixed content, rediscovering the same gaps and wasting tokens.

**Example failure mode:**
```
br-003 (review 1) closes → spawned br-007, br-008 (fixes)
br-004 (review 2) deps: [br-003] — already satisfied!
Ralph-TUI picks br-004 before br-007 or br-008 have run
→ Review 2 finds the same gaps, duplicates work
```

**Solution: Agent wires fix-up beads as dependencies of the next review.**

The spawning bead's description explicitly tells the agent to block the
next review pass on each fix-up bead:

```markdown
## After Creating Fix-Up Beads (REQUIRED)
For EACH fix-up bead you created, add it as a dependency of the next
review pass so the review waits for all fixes:

  br dep add br-004 <fix_bead_id>

## Verify Dependencies
Run: br show br-004
Confirm it now lists your fix-up beads in its dependencies.
```

The skill stamps the literal bead ID of the next review pass (`br-004`)
into the current review's description at creation time. The agent doesn't
need to figure out which bead is "the next review pass" — it's explicit.

**Why this works:**
- The existing dependency on `br-003` is harmless (already satisfied)
- New dependencies on `br-007`, `br-008` keep `br-004` blocked until
  the fixes complete
- `br dep add` is idempotent — adding the same dep twice is safe
- Ralph-TUI re-queries each iteration, so it sees the updated deps

**What can go wrong and mitigations:**

| Failure | Mitigation |
|---|---|
| Agent forgets to wire deps | Make it a numbered REQUIRED step, not optional |
| Agent wires the wrong ID | Description uses literal ID, not a reference |
| `br dep add` fails | Agent checks exit code; description includes verify step |
| Agent doesn't close itself | Ralph-TUI timeout/stall detection handles this |

**Graceful fallback:** Review bead descriptions also include:

```markdown
## Stop Condition
If you find that issues from a previous pass are already being addressed
by other open beads, do not duplicate that work. Focus only on NEW issues
not covered by existing beads.
```

This means even if dependency wiring fails and the review runs too early,
it handles the situation gracefully instead of creating duplicate work.

#### 4.4.2 Spawning and the Consolidation Bead

The consolidation bead (`br-006`) is stamped with a dependency on the
last pre-created review pass (`br-005`). If pass 3 spawns an adaptive
pass 4, the consolidation bead needs to wait for pass 4, not pass 3.

**Approach**: Pass 3's description says:

```markdown
IF you found significant issues and are spawning pass 4:
  1. Create fix-up beads (deps on this bead)
  2. Create "Fresh eyes review pass 4" (deps on fix-up beads)
  3. Update consolidation to wait for pass 4:
     br dep add br-006 <pass4_id>

The existing dep from br-006 on br-005 (this bead) will be satisfied
when you close. The new dep on pass 4 keeps consolidation blocked
until the adaptive chain completes.
```

Each subsequent adaptive pass carries the same pattern: if it spawns
another pass, wire the consolidation bead to depend on the new one.
Dependencies only accumulate (never removed), and satisfied deps are
harmless. The consolidation bead waits for ALL of them.

#### 4.4.3 Full Spawn Sequence Example

Review pass 1 (`br-003`) finds 2 gaps:

```bash
# 1. Create fix-up beads
FIX1=$(br create --parent br-epic-001 \
  --title "Fix spec gap: token revocation behavior" \
  --type task \
  --description "## Problem
The spec mentions token revocation but never defines the behavior...
## Fix
Add a Token Revocation subsection...
## Completion
br close <this_id> --reason 'Added token revocation spec'")

FIX2=$(br create --parent br-epic-001 \
  --title "Fix spec gap: Redis failure fallback" \
  --type task \
  --description "## Problem
Redis dependency has no fallback behavior specified...
## Fix
Add a Degraded Mode subsection...
## Completion
br close <this_id> --reason 'Added Redis fallback spec'")

# 2. Wire fix-ups to run after this bead
br dep add $FIX1 br-003
br dep add $FIX2 br-003

# 3. REQUIRED: Block next review on fix-ups
br dep add br-004 $FIX1
br dep add br-004 $FIX2

# 4. Verify
br show br-004  # Should show deps: [br-003, $FIX1, $FIX2]

# 5. Close this bead
br close br-003 --reason "Found 2 gaps, created $FIX1 and $FIX2"
```

**Resulting bead state:**
```
br-003  [closed]   Fresh eyes review 1
br-004  [open]     Fresh eyes review 2    deps: [br-003✓, br-007, br-008]
br-007  [open]     Fix: token revocation   deps: [br-003✓]  ← READY
br-008  [open]     Fix: Redis fallback     deps: [br-003✓]  ← READY
br-005  [open]     Fresh eyes review 3    deps: [br-004]
br-006  [open]     Final consolidation    deps: [br-005]
```

Ralph-TUI queries ready → gets `br-007` and `br-008`. Runs them.
After both close → `br-004` becomes ready. Review pass 2 runs against
the fixed spec.

### 4.5 Steady-State Detection

The hybrid approach: **fixed minimum passes + adaptive tail**.

- Passes 1-3 always run (guaranteed minimum baseline)
- Pass 3's description says: "If you find significant issues, create
  fix-up beads AND a 'Fresh eyes review pass 4' bead. If no significant
  issues, close without spawning."
- If pass 3 spawns pass 4, pass 4 has the same adaptive instruction
- When a review pass closes without spawning more work, the chain drains
- Ralph-tui sees no more ready beads and exits

This mirrors Emanuel's observation: "After four or five rounds of this,
you tend to reach a steady-state where the suggestions become very
incremental." The 3-pass minimum ensures thoroughness; the adaptive tail
handles both simple cases (steady at pass 3) and complex ones (extends
to pass 7 or 8).

### 4.6 Tracker Selection and Task Ordering

#### The Spectrum of Task Selection

Ralph-TUI supports three tracker approaches for beads:

| Tracker | Selection Method | Who Picks |
|---|---|---|
| **beads-rust** | Priority sort + dependency filtering | Orchestrator (deterministic) |
| **beads-bv** | PageRank + critical path + blocker analysis | Orchestrator (graph-optimized) |
| **Pure Ralph** (Huntley's original) | Present all ready beads, agent picks | Agent (judgment-based) |

Ralph-TUI does not natively support Pure Ralph mode — all its trackers
select a single task and hand it to the agent. Pure Ralph would require
a custom prompt template that lists all ready beads and asks the agent
to choose, which is possible but not how the current system works.

#### Decision: beads-rust for Everything

**beads-rust** (simple priority + dependency filtering) is the recommended
tracker for all phases. Rationale:

1. **Process beads don't need smart selection.** The reverse, decompose,
   and polish packs have mostly linear dependency chains. At any given
   moment, only 1-2 beads are ready. There's no meaningful choice to
   optimize — the dependency graph already encodes the ordering.

2. **Work beads get their intelligence at decompose time.** The decompose
   pack sets priorities and wires dependencies. This is where the "85%
   planning" investment pays off. If the bead graph is well-constructed,
   simple priority sort produces the right ordering. No runtime graph
   analysis needed.

3. **No extra tooling required.** beads-bv requires installing `bv`.
   beads-rust only requires `br`. Lower barrier to entry, fewer moving
   parts, simpler to debug.

4. **Predictable and reproducible.** Given the same bead graph, beads-rust
   always picks the same next bead. This makes debugging and iteration
   straightforward. Pure Ralph's non-determinism makes runs harder to
   reproduce.

5. **Compatible with parallel execution.** Ralph-TUI's parallel mode uses
   the TaskGraphAnalyzer to group beads by dependency depth. This works
   natively with beads-rust's dependency data. No special tracker needed.

#### Where beads-bv Might Still Add Value

For very large forward runs (50+ work beads with complex dependency
graphs), beads-bv's critical path analysis could optimize throughput.
The bead packs don't prevent using beads-bv — they work with any tracker.
The user can switch:

```bash
# Default: simple priority
ralph-tui run --tracker beads-rust --epic <id>

# Opt-in: graph-optimized for large epics
ralph-tui run --tracker beads-bv --epic <id>
```

This is a user choice, not a pack design decision.

#### Review Ordering: Structural, Not Instructed

Reviews are ordered by **dependencies, not by prompt instructions**. The
decompose pack creates a phased structure:

```
Phase 1 impl beads (no cross-deps)    priority: 1
  └─→ REVIEW-1 (deps: all phase 1)    priority: 2
        └─→ Phase 2 impl beads        priority: 1
              └─→ REVIEW-2            priority: 2
                    └─→ Phase 3 impl  priority: 1
                          └─→ REVIEW-3  priority: 2
                                └─→ BUGSCAN  priority: 3
```

With this structure:
- REVIEW-1 **cannot run** until all phase 1 impl beads are closed
- Phase 2 impl beads **cannot start** until REVIEW-1 passes
- REVIEW-3 is guaranteed to be the last review before BUGSCAN

The agent never has to decide "should I review now?" The bead graph
answers that question structurally. This is more reliable than prompt
instructions like "spread reviews out" because:

- Dependencies are enforced by `br` — the agent can't skip them
- No tokens wasted on meta-decisions about ordering
- Reproducible — same graph always produces same ordering
- Works with any tracker and any agent

The alternative — flat beads with prompt-instructed review interleaving —
is fragile. The agent might ignore the instruction, lose count, or
interpret "spread out" differently than intended. Structural enforcement
eliminates this class of failure.

#### The Decompose Pack's Responsibility

This design puts significant weight on the decompose pack to produce a
well-structured bead graph. It must:

1. **Phase the work correctly** — group impl beads into logical phases
2. **Set priorities** — phase 1 beads get priority 1, reviews get 2, etc.
3. **Wire review dependencies** — REVIEW-N depends on all impl beads
   in phase N
4. **Wire phase dependencies** — phase N+1 impl beads depend on REVIEW-N
5. **Right-size beads** — each impl bead completable in one session
6. **Add structural beads** — REVIEW, BUGSCAN, AUDIT at correct positions

This is exactly what the decompose pack's process beads are designed to
do. The "analyze spec and plan decomposition" bead identifies the phases.
The per-area spawned beads create impl beads with correct dependencies.
The "review bead graph" passes verify the structure is correct.

The investment in decompose quality directly reduces forward execution
risk — a well-structured bead graph makes the forward phase mechanical.

## 5. Workflow: End-to-End Pipeline

### How the User Interacts

The user talks to an agent (Claude Code, OpenCode, etc.) and describes
what they want. The agent invokes the appropriate pack skill, which
stamps beads and reports what it created. Then `ralph-tui run` executes
the beads.

```
User: "Reverse-engineer the auth module at src/auth/ and produce a spec"

  → Agent invokes reverse pack skill
  → Skill scans src/auth/, classifies as local source code
  → Skill derives: analysisPath = docs/specs/auth-analysis.md
                    specPath = docs/specs/auth-spec.md
                    epicTitle = "Reverse: Auth Module"
  → Skill stamps 6 beads under a new epic (br-epic-001)
  → Agent reports: "Created epic br-epic-001 with 6 reverse process beads.
     Run: ralph-tui run --tracker beads-rust --epic br-epic-001"

User: ralph-tui run --tracker beads-rust --epic br-epic-001
  → Agents analyze, draft, review, consolidate → spec file produced

User: "Now decompose that spec into work beads"

  → Agent invokes decompose pack skill
  → Skill reads docs/specs/auth-spec.md (the output of the reverse run)
  → Skill stamps 6 decompose process beads under br-epic-002
  → Agent reports: "Created epic br-epic-002 with 6 decompose process
     beads targeting work epic br-epic-003."

User: ralph-tui run --tracker beads-rust --epic br-epic-002
  → Agents analyze spec, create work beads, review graph → work beads produced

User: ralph-tui run --tracker beads-rust --epic br-epic-003
  → Agents implement, test, commit → code produced

User: "Run a polish pass on the implementation"

  → Agent invokes polish pack skill
  → Skill stamps polish beads under br-epic-003
  → ralph-tui run picks them up
```

### Underlying Skill Invocations

The conversational flow above resolves to these skill invocations
internally. Users never need to write these directly:

```bash
# Step 1: Stamp reverse process beads
/stamp-reverse-pack --input src/auth/ --output docs/specs/ --epic-title "Reverse: Auth Module"

# Step 2: Run reverse
ralph-tui run --tracker beads-rust --epic <reverse-epic-id>

# Step 3: Stamp decompose process beads
/stamp-decompose-pack --spec docs/specs/auth-spec.md --epic-title "Decompose: Auth Module"

# Step 4: Run decompose
ralph-tui run --tracker beads-rust --epic <decompose-epic-id>

# Step 5: Run forward (work beads — no special pack needed)
ralph-tui run --tracker beads-rust --epic <work-epic-id>

# Step 6 (optional): Stamp and run polish
/stamp-polish-pack --epic <work-epic-id>
ralph-tui run --tracker beads-rust --epic <work-epic-id>
```

Each step is a separate `ralph-tui run`. No custom engine needed.

## 6. What Happens to Super-Ralph

### Value that migrates to bead packs + skills

| Super-Ralph Feature | Becomes |
|---|---|
| Reverse phase logic | Reverse bead pack (skill) |
| Decompose phase logic | Decompose bead pack (skill) |
| Forward phase logic | Already native ralph-tui |
| Prompt templates | One thin ralph-tui template |
| Progress tracking | Ralph-tui `recentProgress` |
| Fresh context per iteration | Ralph-tui default behavior |

### Value that remains unique to super-ralph (potential)

| Feature | Status |
|---|---|
| Per-bead model routing via area labels | Gap in ralph-tui — could be proposed as a feature |
| Interactive reverse (terminal Q&A) | Specialized mode, could become a separate skill |
| OpenCode-specific SSE streaming | Unnecessary if using ralph-tui's OpenCode plugin |

### The decision

Super-ralph's engine (`engine.ts`, `opencode.ts`, `interactive.ts`, etc.)
can be **retired** if the bead packs and prompt template achieve the same
outcomes via ralph-tui. The project's focus shifts from "build an engine"
to "build the best strategy packs."

This is a significant simplification: ~19 source modules → a handful of
skills + one prompt template + bead pack definitions.

## 7. Relationship to Jeffrey Emanuel's Workflow

> Ref: [@doodlestein Jan 7, 2026](https://x.com/doodlestein/status/2008813776687030781)

Emanuel's full workflow is a manual multi-phase pipeline that maps almost
exactly to what bead packs would automate:

### Emanuel's Manual Pipeline

**Phase 1 — Plan creation**: Agent studies reference code, produces initial
plan document (~3,500 lines of markdown).

**Phase 2 — Plan refinement**: Paste plan into GPT for review → paste
suggestions back into Claude for integration → repeat 4-5 times → steady
state. Each round is a fresh-eyes pass with a different model.

**Phase 3 — Plan to beads**: Prompt agent to create beads from plan → then
8-9 rounds of "check over each bead super carefully" → steady state. Final
cross-model pass with Codex/GPT.

**Phase 4 — Implementation**: Swarm of agents picks beads, implements,
fresh-eyes reviews until clean, moves to next bead.

**Phase 5 — Polish**: "Randomly explore code with fresh eyes" until clean.
Create new beads for test coverage, UI/UX. Implement those.

### How Bead Packs Automate This

| Emanuel's Manual Step | Bead Pack Equivalent |
|---|---|
| Study reference code, create plan | Reverse pack: `analyze` + `draft` beads |
| Paste into GPT for review (4-5 rounds) | Reverse pack: 3 fixed + adaptive fresh-eyes beads |
| Create beads from plan (8-9 rounds) | Decompose pack: `analyze-spec` + spawned area beads + review beads |
| Start swarm, implement beads | `ralph-tui run --parallel` on work beads |
| Fresh eyes code review until clean | Polish pack: adaptive review beads |
| Create test/UX improvement beads | Polish pack: review beads spawn work beads |

Emanuel currently drives each transition manually — he's the orchestrator.
Bead packs encode his methodology so ralph-tui can run it autonomously.

### Key Insight

Emanuel's thread confirms the central thesis: **the planning process has
a repeatable structure that can be decomposed into discrete steps, each
benefiting from fresh context.** His workflow is implicitly bead-shaped.
Bead packs make it explicitly so.

## 8. Open Questions

1. **Consolidation bead timing**: Should the final consolidation bead be
   pre-created (with dependency on pass 3) or spawned by the last clean
   review pass? Pre-creating is simpler but may get stale dependencies
   if adaptive passes extend beyond 3.

2. **Cross-phase epic linking**: Should the decompose pack create its work
   beads under the same epic as the process beads, or under a new epic?
   Separate epics keep process and work beads cleanly separated.

3. **Model routing**: Ralph-tui currently takes `--model` at the run level.
   For cross-model fresh-eyes reviews (Emanuel's pattern), we'd need
   per-bead model routing. This could be proposed as a ralph-tui feature
   (label-based template/model routing) or handled by running separate
   `ralph-tui run` invocations with different `--model` flags.

4. **Skill distribution**: How should bead pack skills be distributed?
   As ralph-tui skills in `~/.agents/skills/`? As a standalone package?
   As part of a "super-ralph skill collection"?

5. **Pack composition**: Can packs be composed? E.g., "reverse + decompose"
   as a single pipeline that chains two packs. Or is sequential
   `ralph-tui run` invocations the right granularity?

6. **Spawn observability**: When beads spawn child beads, how does the
   user track what's happening? Ralph-tui's TUI shows task progress,
   but dynamically-growing bead graphs may need special visualization.

## 9. Migration Path

### Phase 1: Build the reverse bead pack skill
- Create the skill that stamps reverse process beads
- Create the thin prompt template
- Validate: run via `ralph-tui run` and produce a spec

### Phase 2: Build the decompose bead pack skill
- Create the skill that stamps decompose process beads
- Validate: run via `ralph-tui run` and produce work beads
- Validate: work beads are runnable by `ralph-tui run` in forward mode

### Phase 3: Build the polish bead pack skill
- Create the skill for post-implementation review beads
- Validate: spawned fix-up beads are picked up by ralph-tui

### Phase 4: End-to-end pipeline validation
- Run full reverse → decompose → forward → polish pipeline
- Compare output quality to super-ralph's current engine
- Document the workflow

### Phase 5: Evaluate super-ralph engine retirement
- If bead packs achieve equivalent or better outcomes, deprecate engine
- Retain super-ralph as the "skill collection" project name
- Propose per-bead model routing to ralph-tui if needed
