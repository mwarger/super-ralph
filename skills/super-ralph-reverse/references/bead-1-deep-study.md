# Bead 1: Deep Study of Source Material

Use this as the description for bead 1. Replace template variables at stamp time.

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
- Marketing/features pages, help center, API docs
- Changelog, status page, pricing page (reveals feature matrix)
- Blog/technical blog, integrations page
- Terms of service, public GitHub repos, community forums

**Step 2: Systematically study each source.**
Read thoroughly, extract features/behaviors/constraints/interfaces,
note inconsistencies, note version/date info.

**Step 3: Explore the product itself.**
Sign up, walk through every workflow, note UI flows/validation/errors,
test edge cases, observe notifications, check network tab.

**Step 4: Identify what you CAN'T observe.**
List known gaps (background jobs, admin tools, rate limiting, DB schema,
auth internals). For each: "This behavior must be specified during
implementation."
{{/if}}
{{#if this.isDocUrl}}
**Type**: Documentation at {{this.url}}
Read ALL documentation. Be exhaustive — follow every link:
- API references, guides/tutorials, conceptual docs
- Glossary, migration guides, changelogs, FAQ pages
- Note what's well-specified vs. vague or missing
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

Think VERY hard about this. Be thorough. Miss something here and it
will be missing from the spec and the implementation.

## Question Bank

1. **What are we building?** High-level description, purpose, who benefits.
2. **Why now?** What's driving this? Business need, user complaint, technical debt?
3. **What does success look like?** Measurable outcomes, not vague goals.
4. **What are the boundaries?** What is this explicitly NOT? Tempting scope creep?
5. **What exists already?** Present what you found. Extend or build new?
6. **What are the risks?** What could go wrong? Failure modes?
7. **What are the constraints?** Performance, security, compatibility, timeline.

## Parallel Research via Sub-Agents
If the source material is large, use sub-agents to research distinct
areas in parallel. Launch multiple concurrently, each researching a
different area. When they return, synthesize into the analysis document.

## Spawning Rules
In most cases, do NOT spawn child study beads. If you DO need to:

  br create --parent {{epicId}} --title "Deep study: <area>" --type task \
    --description "<focused study instructions>"
  br dep add <new_bead_id> {{thisBeadId}}
  br dep add {{draftBeadId}} <new_bead_id>

Prefer sub-agents — faster and more coherent.

## Completion
br close {{thisBeadId}} --reason "Analysis complete at {{analysisPath}}"
```
