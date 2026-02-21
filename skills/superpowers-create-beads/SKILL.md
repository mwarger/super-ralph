# Superpowers Create Beads — Custom Bead Conversion Skill for Ralph TUI

> Converts PRDs to beads (epic + child tasks) with phase labels, review beads, bug scan beads,
> audit beads, and learning beads — all wired into the correct dependency order.
> Extends the bundled `ralph-tui-create-beads` skill with the Superpowers + Ralph TUI SDLC Framework's
> structural bead injection pattern.

---

## The Job

Take a PRD (produced by `superpowers-intake`) and create beads in `.beads/beads.jsonl`:

1. **Extract Quality Gates** from the PRD's Quality Gates section
2. Create an **epic** bead for the feature (with `--external-ref` to PRD and design doc)
3. Create **child beads** for each user story (with quality gates appended)
4. **Parse phase labels** from `[phase:xxx]` in story titles and apply as bead labels
5. Set up **dependencies** between beads (respecting phase ordering)
6. **Wire review beads** at phase boundaries (depend on all implementation beads in their phase)
7. **Wire bug scan beads** after each review bead
8. **Wire audit beads** at the end (depend on all implementation and review beads)
9. **Wire learning bead** as the final bead (depends on audit beads)
10. Run a **self-check round** on all beads before finishing
11. Output ready for `ralph-tui run --tracker beads-bv`

**Announce at start:** "I'm using the superpowers-create-beads skill to convert the PRD to beads with review/audit structure."

---

## Command Reference

All bead operations use the `bd` CLI (Beads). Key commands:

```bash
# Create an epic
bd create --type=epic --title="..." --description="$(cat <<'EOF'
...
EOF
)" --external-ref="prd:./tasks/prd-feature.md"

# Create a child bead
bd create --parent=<EPIC_ID> --title="..." --description="$(cat <<'EOF'
...
EOF
)" --priority=<1-4>

# Add dependency (issue depends on blocker)
bd dep add <issue-id> <depends-on-id>

# Add label
bd label add <issue-id> <label>
```

> **CRITICAL:** Always use `<<'EOF'` (single-quoted) for HEREDOC delimiters. This prevents
> shell interpretation of backticks, `$variables`, and `()` in descriptions.

---

## Step 1: Extract Quality Gates

Look for the "Quality Gates" section in the PRD:

```markdown
## Quality Gates

These commands must pass for every user story:
- `pnpm typecheck` - Type checking
- `pnpm lint` - Linting

For UI stories, also include:
- Verify in browser using dev-browser skill
```

Extract:
- **Universal gates:** Commands that apply to ALL stories
- **UI gates:** Commands that apply only to UI stories (those with `[phase:ui]`)

**If no Quality Gates section exists:** Ask the user what commands should pass.

---

## Step 2: Create Epic

Create the epic bead with `--external-ref` linking back to both the PRD file and the design document:

```bash
bd create --type=epic \
  --title="<Feature Name>" \
  --description="$(cat <<'EOF'
<Feature description from PRD overview>

Design: docs/plans/YYYY-MM-DD-<feature>-design.md
PRD: tasks/prd-<feature>.md
EOF
)" \
  --external-ref="prd:./tasks/prd-<feature>.md"
```

Note the epic ID returned — all child beads reference it as `--parent`.

---

## Step 3: Create Implementation Beads

For each `### US-XXX:` story in the PRD:

1. Create the bead with acceptance criteria + quality gates appended
2. Parse the phase label from `[phase:xxx]` in the title
3. Add the phase label via `bd label add`
4. Add dependencies based on phase ordering and explicit story dependencies

### Sizing Check

Each story must be completable in ONE Ralph TUI iteration. If any story looks too large, split it before creating the bead. If you can't describe the change in 2-3 sentences, it's too big.

### Self-Documenting Beads

Each bead's description should be self-contained — include relevant background, reasoning, and context so that a fresh agent with no prior context can understand what to do and why. Follow Emanuel's principle: "totally self-contained and self-documenting (including relevant background, reasoning/justification, considerations, etc. — anything we'd want our future self to know)."

### Example Implementation Bead

```bash
bd create --parent=<EPIC_ID> \
  --title="US-001: Add investorType field to investor table" \
  --description="$(cat <<'EOF'
As a developer, I need to categorize investors as 'cold' or 'friend' to support
the upcoming friends outreach feature. This is the foundational schema change that
all subsequent backend and UI work depends on.

## Context
The investor table currently has no type distinction. All investors are treated
identically. The friends outreach feature requires distinguishing between cold
prospects and warm contacts (friends) who get different messaging.

## Acceptance Criteria
- [ ] Add investorType column: 'cold' | 'friend' (default 'cold')
- [ ] Generate and run migration successfully
- [ ] Existing investors default to 'cold'
- [ ] pnpm typecheck passes
- [ ] pnpm lint passes
EOF
)" \
  --priority=1

bd label add <BEAD_ID> phase:schema
```

---

## Step 4: Create Review Beads

At each phase boundary, create a review bead and a bug scan bead.

A "phase boundary" occurs when:
- All implementation beads in a phase are created, AND
- The next story belongs to a different phase

### Review Bead

```bash
bd create --parent=<EPIC_ID> \
  --title="REVIEW-001: Schema phase review" \
  --description="$(cat <<'EOF'
Review all work from the schema phase against the design document.

## What To Do
1. Read the design document (referenced in the epic's external-ref)
2. Diff all changes made by schema-phase beads
3. Verify schema matches the approved design
4. Run all quality gate commands
5. Check for placeholder implementations and scope creep
6. Look at remaining beads — do they still make sense?
7. Document findings in .ralph-tui/progress.md
8. If issues found: create corrective beads with bd create

## Acceptance Criteria
- [ ] All schema changes match the approved design
- [ ] Migrations are reversible
- [ ] All quality gates pass
- [ ] No placeholder implementations
- [ ] Findings documented in progress.md
- [ ] Corrective beads created if issues found
EOF
)" \
  --priority=1

bd label add <REVIEW_ID> phase:review
```

### Bug Scan Bead

```bash
bd create --parent=<EPIC_ID> \
  --title="BUGSCAN-001: Schema fresh-eyes review" \
  --description="$(cat <<'EOF'
Re-read all code from the schema phase with fresh eyes.

## What To Do
Carefully read over all of the new code written in this phase with "fresh eyes"
looking super carefully for any obvious bugs, errors, problems, issues, silly
mistakes, etc. Carefully fix anything you uncover. Document all findings in
.ralph-tui/progress.md.

## Acceptance Criteria
- [ ] All new code from schema phase re-read carefully
- [ ] Any bugs or issues found are fixed
- [ ] All quality gates still pass after fixes
- [ ] Findings documented in progress.md
EOF
)" \
  --priority=1

bd label add <BUGSCAN_ID> phase:review
```

---

## Step 5: Create Audit and Learning Beads

At the end of the epic (after all implementation phases), create:

### AUDIT-001: Full Code Review

```bash
bd create --parent=<EPIC_ID> \
  --title="AUDIT-001: Full code review" \
  --description="$(cat <<'EOF'
Review the entire implementation against the design document with fresh eyes.

## What To Do
Carefully scrutinize every aspect of the implementation and look for things that
seem sub-optimal or even wrong/mistaken, things that could obviously be improved,
places where quality could be enhanced. Look for bugs, errors, problems, issues,
silly mistakes, inefficiencies, security problems, reliability issues. Diagnose
underlying root causes using first-principle analysis and fix or revise as necessary.

Also: sort of randomly explore the code files in this project, choosing code files
to deeply investigate and understand and trace their functionality and execution
flows through related code files. Once you understand the purpose of the code in
the larger context, do a super careful, methodical, and critical check with fresh
eyes.

## Acceptance Criteria
- [ ] Complete diff reviewed against design document
- [ ] No architectural drift from approved design
- [ ] No placeholder or minimal implementations remain
- [ ] No security issues identified
- [ ] No race conditions or error handling gaps
- [ ] All quality gates pass
- [ ] Findings documented in progress.md
EOF
)" \
  --priority=2

bd label add <AUDIT1_ID> phase:audit
```

### AUDIT-002: Test Coverage Verification

```bash
bd create --parent=<EPIC_ID> \
  --title="AUDIT-002: Test coverage verification" \
  --description="$(cat <<'EOF'
Verify test coverage for all new and changed code.

## What To Do
Do we have full unit test coverage without using mocks/fake stuff? What about
complete integration test coverage with detailed logging? If not, document the
gaps and create corrective beads.

## Acceptance Criteria
- [ ] Unit test coverage assessed for all new/changed code
- [ ] Integration test coverage assessed for all new workflows
- [ ] All existing tests still pass
- [ ] Corrective beads created for any coverage gaps
- [ ] Findings documented in progress.md
EOF
)" \
  --priority=2

bd label add <AUDIT2_ID> phase:audit
```

### LEARN-001: Learning Extraction

```bash
bd create --parent=<EPIC_ID> \
  --title="LEARN-001: Learning extraction" \
  --description="$(cat <<'EOF'
Extract and persist learnings from this epic.

## What To Do
1. Review all entries in .ralph-tui/progress.md from this epic
2. Extract reusable patterns and add to project documentation
3. Identify intake questions that should have been asked — append them to
   docs/intake-checklist.md so future epics benefit
4. Summarize what went well and what required corrective beads
5. If CASS is available: verify Ralph iteration sessions are searchable
6. If CASS Memory System is available: create memory entries for key lessons
7. Write a final epic summary to progress.md

## Acceptance Criteria
- [ ] progress.md reviewed for reusable patterns
- [ ] docs/intake-checklist.md updated with new questions discovered
- [ ] Epic summary written to progress.md
- [ ] CASS sessions indexed (if available)
- [ ] Memory entries created (if available)
EOF
)" \
  --priority=3

bd label add <LEARN_ID> phase:learn
```

---

## Step 6: Wire Dependencies

This is the critical step. The dependency graph must enforce:
1. Implementation beads within a phase can run in parallel (or sequentially if they depend on each other)
2. Review beads depend on ALL implementation beads in their phase
3. Bug scan beads depend on their phase's review bead
4. Next-phase implementation beads depend on the previous phase's bug scan bead
5. Audit beads depend on the last phase's bug scan bead
6. AUDIT-002 depends on AUDIT-001
7. LEARN-001 depends on AUDIT-002

### Dependency Wiring Pattern

For a typical feature with schema, backend, and UI phases:

```bash
# Schema phase: US-001, US-002 (US-002 depends on US-001 if sequential)
bd dep add <US-002> <US-001>

# Schema review depends on ALL schema implementation beads
bd dep add <REVIEW-001> <US-001>
bd dep add <REVIEW-001> <US-002>

# Schema bug scan depends on schema review
bd dep add <BUGSCAN-001> <REVIEW-001>

# Backend phase beads depend on schema bug scan (phase gate)
bd dep add <US-003> <BUGSCAN-001>
bd dep add <US-004> <BUGSCAN-001>

# Backend review depends on ALL backend implementation beads
bd dep add <REVIEW-002> <US-003>
bd dep add <REVIEW-002> <US-004>

# Backend bug scan depends on backend review
bd dep add <BUGSCAN-002> <REVIEW-002>

# UI phase beads depend on backend bug scan (phase gate)
bd dep add <US-005> <BUGSCAN-002>
bd dep add <US-006> <BUGSCAN-002>

# UI review depends on ALL UI implementation beads
bd dep add <REVIEW-003> <US-005>
bd dep add <REVIEW-003> <US-006>

# UI bug scan depends on UI review
bd dep add <BUGSCAN-003> <REVIEW-003>

# Audit beads depend on the last bug scan
bd dep add <AUDIT-001> <BUGSCAN-003>
bd dep add <AUDIT-002> <AUDIT-001>

# Learning bead depends on last audit bead
bd dep add <LEARN-001> <AUDIT-002>
```

**Result:** BV's PageRank will naturally prioritize beads that unblock the most downstream work — schema beads first (they unblock everything), then reviews at the right time, audits last.

---

## Step 7: Self-Check Round

After creating all beads and wiring dependencies, do a self-check:

> Check over each bead super carefully — are you sure it makes sense? Is it optimal?
> Could we change anything to make the system work better? If so, revise the beads.
> It's a lot easier and faster to operate in "plan space" before we start implementing.

Specifically verify:
- [ ] Every bead is self-contained and self-documenting
- [ ] No bead is too large for one iteration
- [ ] Dependencies are wired correctly (no cycles, no missing edges)
- [ ] Phase labels are applied to every bead
- [ ] Quality gates are appended to every implementation bead's criteria
- [ ] UI beads have UI-specific gates (if applicable)
- [ ] Review beads cover the right scope
- [ ] The dependency graph enforces the correct execution order

If anything is wrong, fix it with `bd update` or additional `bd dep add` commands.

---

## Step 8: Summary Output

After creating all beads, output a summary:

```
## Beads Created

Epic: <EPIC_ID> - <Feature Name>
PRD: tasks/prd-<feature>.md
Design: docs/plans/YYYY-MM-DD-<feature>-design.md

### Implementation Beads
- <ID>: US-001 - <Title> [phase:schema]
- <ID>: US-002 - <Title> [phase:schema]
- <ID>: US-003 - <Title> [phase:backend]
...

### Review Beads
- <ID>: REVIEW-001 - Schema phase review [phase:review]
- <ID>: BUGSCAN-001 - Schema fresh-eyes review [phase:review]
...

### Audit Beads
- <ID>: AUDIT-001 - Full code review [phase:audit]
- <ID>: AUDIT-002 - Test coverage verification [phase:audit]
- <ID>: LEARN-001 - Learning extraction [phase:learn]

### Dependency Summary
Schema → REVIEW-001 → BUGSCAN-001 → Backend → REVIEW-002 → BUGSCAN-002 → UI → ...

### Run Command
ralph-tui run --tracker beads-bv --epic <EPIC_ID> --iterations <RECOMMENDED>

> Setting --iterations to {N} ({total_beads} beads x 2 buffer for retries/corrective beads)
```

**Calculate recommended iterations:** Count the total beads created (implementation + review + audit + learn). Multiply by 2. This accounts for retries on failures and corrective beads that review beads may create. Example: 27 beads → `--iterations 54`.

Then proceed to **Step 9: Launch**.

---

## Step 9: Launch

### Preflight check

Before offering launch options, run `ralph-tui doctor` and verify the output is healthy. If unhealthy, stop and help the user resolve issues before launching. Common problems:

- Agent CLI not in PATH
- Agent not authenticated
- Template resolution errors (see beads-bv workaround in `super-ralph-init` troubleshooting section)

### Launch options

After the preflight passes, offer to launch execution immediately. Use `<ITERATIONS>` as the calculated value from Step 8 (total beads x 2).

> "Beads are ready. How would you like to start execution?
>
> 1. **Run headless** — I'll run `ralph-tui run --headless` right here. Output streams to this session. You can check status from another terminal with `ralph-tui status --json`.
> 2. **Copy command to clipboard** — I'll copy the full `ralph-tui run` command to your clipboard so you can paste it in a new terminal tab (TUI mode).
> 3. **Show command** — I'll display the command for you to copy manually."

### Option 1: Run headless

Before running, ask about agent/model overrides:

> "The project config will be used by default. Would you like to override agent or model for this run?
>
> - **Use config defaults** *(recommended)* — whatever is in `.ralph-tui/config.toml`
> - **Override agent** — e.g., `claude`, `opencode`
> - **Override model** — e.g., `opus`, `sonnet`
> - **Override both**"

Construct the command based on their choices. **All commands include `--iterations`:**

```bash
# Default (no overrides)
ralph-tui run --headless --tracker beads-bv --epic <EPIC_ID> --iterations <ITERATIONS>

# With agent override
ralph-tui run --headless --tracker beads-bv --epic <EPIC_ID> --iterations <ITERATIONS> --agent <agent>

# With model override
ralph-tui run --headless --tracker beads-bv --epic <EPIC_ID> --iterations <ITERATIONS> --model <model>

# With both
ralph-tui run --headless --tracker beads-bv --epic <EPIC_ID> --iterations <ITERATIONS> --agent <agent> --model <model>
```

Tell the user why:

> "Setting --iterations to {N} ({total_beads} beads x 2 buffer for retries/corrective beads)"

Run the command via bash. The `--headless` flag streams structured logs to stdout instead of launching the TUI.

After execution completes (or if it's interrupted), inform the user:
- To check progress: `ralph-tui status --json`
- To resume if interrupted: `ralph-tui resume --headless` (or `ralph-tui resume` for TUI mode)

### Option 2: Copy command to clipboard

Construct the command **without** `--headless` (the user will want the TUI in their own terminal):

```bash
ralph-tui run --tracker beads-bv --epic <EPIC_ID> --iterations <ITERATIONS>
```

Copy it to the clipboard using `pbcopy` (macOS). Tell the user:

> "Copied to clipboard. Open a new terminal tab and paste to start the TUI.
> Setting --iterations to {N} ({total_beads} beads x 2 buffer for retries/corrective beads)"

Always also display the command in the output as a fallback.

### Option 3: Show command

Display the full command:

```
ralph-tui run --tracker beads-bv --epic <EPIC_ID> --iterations <ITERATIONS>
```

> "Setting --iterations to {N} ({total_beads} beads x 2 buffer for retries/corrective beads)"

No clipboard, no execution — the user copies it themselves.

---

## Differences from Bundled `ralph-tui-create-beads`

This skill extends the bundled skill with:

1. **Phase label parsing and application** — `[phase:xxx]` in story titles → `bd label add`
2. **Review bead injection** — at each phase boundary with correct dependencies
3. **Bug scan bead injection** — after each review bead
4. **Audit bead injection** — at the end of the epic
5. **Learning bead injection** — as the final bead
6. **Self-documenting beads** — each bead includes background and reasoning (Emanuel pattern)
7. **Self-check round** — review all beads for optimality before finishing
8. **External-ref linking** — epic links back to both PRD and design doc

---

## Checklist

Before finishing:

- [ ] Quality gates extracted from PRD
- [ ] Epic created with --external-ref to PRD and design doc
- [ ] Each user story → one bead (iteration-sized)
- [ ] Phase labels applied to every bead via bd label add
- [ ] Quality gates appended to every implementation bead's criteria
- [ ] UI beads have UI-specific gates (if applicable)
- [ ] Review beads created at each phase boundary
- [ ] Bug scan beads created after each review bead
- [ ] Audit beads created at epic end
- [ ] LEARN-001 created as final bead
- [ ] All dependencies wired correctly
- [ ] Self-check round completed
- [ ] Summary output provided with run command and calculated --iterations
- [ ] Preflight check (`ralph-tui doctor`) passed
- [ ] Launch wizard presented (headless / clipboard / show command)
