---
name: bug-prd
description: "Self-contained Ralph TUI skill for bug fix workflows: focused intake, PRD generation, bead creation, dependency wiring, and launch."
---

# Bug PRD — Ralph TUI Skill

> Self-contained skill for Ralph TUI that runs the bug fix pipeline:
> focused intake, PRD generation, bead creation, and launch.

---

## The Job

1. Run the focused intake protocol (bug investigation + technical questions + learned questions)
2. Convert the intake into iteration-sized, phase-labeled fix stories
3. Inject structural beads (REVIEW, BUGSCAN after fix; AUDIT-001, LEARN-001 at end)
4. Output the PRD wrapped in `[PRD]...[/PRD]` markers
5. Create beads via `br` CLI with full dependency graph
6. Offer to launch execution

**Important:** Do NOT implement any fixes. This skill produces the plan and beads only.

**Announce at start:** "I'm using the bug-prd skill for focused bug intake, PRD generation, and bead creation."

---

## Step 0: Explore Project Context

Before asking any questions:

1. Read `AGENTS.md` and `README.md` if they exist
2. Read `.super-ralph/progress.md` if it exists (learnings from past epics)
3. Explore the codebase structure — what exists, what patterns are in use, what's the tech stack
4. Read `.super-ralph/intake-checklist.md` if it exists (needed for Phase C)

This grounds your questions in the reality of the project, not abstract possibilities.

---

## Step 1: Focused Intake

Ask questions **one at a time**, using multiple choice when possible. After each answer, decide whether to dig deeper, move on, or generate the PRD. Bug intakes are shorter than feature intakes — aim for 5-8 questions total.

**Seed description:** If context was provided with the command, confirm it rather than asking from scratch: "The bug is [description] — is that right, or should I adjust?"

### Phase A: Bug Investigation

1. **What's the bug?** Reproduction steps, expected vs actual behavior. Can you reproduce it reliably?
2. **When did it start?** Regression from a recent change? Always broken? What deploy/merge triggered it?
3. **What's the impact?** Who's affected — all users, subset, internal? How badly — data loss, broken workflow, cosmetic? Is this in production?
4. **Root cause hypothesis?** Present what you found from codebase exploration. Where does the bug live? What code paths are involved?
5. **What's the blast radius?** What other features or systems might be affected by the fix? What could break if we change the wrong thing?

### Phase B: Technical Deep-Dive

After the investigation, ask 2-3 technical questions as needed:

- **Edge cases around the fix:** What related inputs or states could also be broken? Similar patterns elsewhere with the same bug?
- **Data implications:** Has the bug corrupted data? Do we need a migration or cleanup alongside the fix?
- **Test gaps:** Why wasn't this caught? What test is missing?

Not every bug needs all three. Use judgment based on complexity.

### Phase C: Learned Questions

Read `.super-ralph/intake-checklist.md` if it exists. Ask any relevant learned questions — things the team discovered they should always ask from past epics. Use judgment; most won't apply to every bug.

### Adaptive Depth

After each answer, decide:
- **Dig deeper** — the answer revealed complexity or ambiguity
- **Move on** — the answer is clear and sufficient
- **Generate the PRD** — enough context to proceed

Signal when ready: "I think I have enough to draft the fix plan. Any final thoughts before I proceed?"

---

## Step 2: Generate PRD

Convert the intake findings into fix stories sized for Ralph TUI iterations. There is no design doc step for bugs — go straight from intake to PRD.

### Quality Gates (REQUIRED)

Ask the user what quality gate commands must pass:

```
What quality commands must pass for each fix story?
   A. pnpm typecheck && pnpm lint
   B. npm run typecheck && npm run lint
   C. bun run typecheck && bun run lint
   D. Other: [specify your commands]
```

### Sizing Rule

Each fix story must be completable in ONE Ralph TUI iteration (one agent context window). If it can't be described in 2-3 sentences, it's too big. Split it.

Right-sized: "Fix null check in investor lookup" / "Add missing validation for empty arrays"
Too big: "Fix all the auth bugs" / "Rewrite the data pipeline"

### Ordering Rule

Stories are ordered by dependency. Root cause fix first, then cascading fixes, then tests.

### Phase Labeling

Tag each story with a phase: `[phase:schema]`, `[phase:backend]`, `[phase:ui]`, `[phase:integration]`, `[phase:test]`, `[phase:docs]`.

### Structural Bead Injection

For bug fixes, use a lighter structure than features:

**After all fix stories (single review pass):**
```
REVIEW-001: Fix review [phase:review]
BUGSCAN-001: Fix fresh-eyes review [phase:review]
```

**At the end of the epic (no AUDIT-002 — test coverage is part of fix stories):**
```
AUDIT-001: Fix area code review [phase:audit]
LEARN-001: Learning extraction [phase:learn]
```

### Output Format

Wrap the final PRD in `[PRD]...[/PRD]` markers. Save to `tasks/prd-bugfix-<bug-name>.md`.

```markdown
[PRD]
# PRD: Bugfix — <Bug Name>

## Bug Summary
<2-3 sentences: the bug, its impact, and the root cause>

## Goals
- Fix the root cause of X
- Prevent regression with tests
- Verify no collateral damage

## Quality Gates
These commands must pass for every fix story:
- `<command>` - <description>

## Fix Stories

### US-001: <Title> [phase:backend]
**Description:** Fix <root cause> so that <expected behavior is restored>.
**Acceptance Criteria:**
- [ ] <specific, verifiable criterion>

### US-002: <Title> [phase:test]
...

### REVIEW-001: Fix review [phase:review]
**Description:** Review all fix work against the bug report and root cause analysis.
**Acceptance Criteria:**
- [ ] Root cause is actually addressed (not just symptoms)
- [ ] Fix doesn't introduce new issues
- [ ] All quality gates pass
- [ ] Findings documented in progress.md
- [ ] Corrective beads created if issues found

### BUGSCAN-001: Fix fresh-eyes review [phase:review]
**Description:** Re-read all code changes with fresh eyes. Fix anything uncovered.
**Acceptance Criteria:**
- [ ] All changed code re-read carefully
- [ ] Any bugs or issues fixed
- [ ] Findings documented in progress.md

### AUDIT-001: Fix area code review [phase:audit]
**Description:** Review the fix area for related bugs, architectural issues, and quality problems.
**Acceptance Criteria:**
- [ ] Fix area code reviewed thoroughly
- [ ] No related bugs found (or corrective beads created)
- [ ] All quality gates pass

### LEARN-001: Learning extraction [phase:learn]
**Description:** Extract and persist learnings from this bug fix.
**Acceptance Criteria:**
- [ ] Root cause documented in progress.md
- [ ] .super-ralph/intake-checklist.md updated with new questions
- [ ] Why this bug wasn't caught — what test/process gap?
- [ ] Epic summary written to progress.md

## Non-Goals
- <what this fix is NOT touching>
[/PRD]
```

---

## Step 3: Create Beads

Take the PRD and create beads in `.beads/beads.jsonl` using the `br` CLI.

### Command Reference

```bash
br create --type=epic --title="..." --description="$(cat <<'EOF'
...
EOF
)" --external-ref="prd:./tasks/prd-bugfix-<bug>.md"

br create --parent=<EPIC_ID> --title="..." --description="$(cat <<'EOF'
...
EOF
)" --priority=<1-4>

br dep add <issue-id> <depends-on-id>
br label add <issue-id> <label>
```

> **CRITICAL:** Always use `<<'EOF'` (single-quoted) for HEREDOC delimiters. This prevents
> shell interpretation of backticks, `$variables`, and `()` in descriptions.

### Verify Git Repository

Before creating any beads, run `git status`. If no git repo exists, initialize one (`git init && git add -A && git commit -m "chore: initial commit"`) and tell the user. Beads requires a git repo.

### Create Epic

```bash
br create --type=epic \
  --title="Bugfix: <Bug Name>" \
  --description="$(cat <<'EOF'
<Bug summary from PRD>

PRD: tasks/prd-bugfix-<bug>.md
EOF
)" \
  --external-ref="prd:./tasks/prd-bugfix-<bug>.md"
```

Note the epic ID returned — all child beads reference it as `--parent`.

### Create Fix Beads

For each `### US-XXX:` story in the PRD:

1. Create the bead with acceptance criteria + quality gates appended
2. Parse the phase label from `[phase:xxx]` and add via `br label add`
3. Add dependencies based on story ordering

**Sizing check:** Each story must be completable in ONE Ralph TUI iteration. If you can't describe it in 2-3 sentences, split it.

**Self-documenting beads:** Each bead's description must be self-contained — include relevant background, reasoning, and context so a fresh agent with no prior context can understand what to do and why.

**Example:**

```bash
br create --parent=<EPIC_ID> \
  --title="US-001: Fix null check in investor lookup" \
  --description="$(cat <<'EOF'
Fix the null reference error in the investor lookup flow that crashes when an
investor has no associated fund. This is the root cause — all other fixes depend
on this being resolved first.

## Context
The investor lookup in src/services/investors.ts:142 assumes every investor has
at least one fund. When a new investor is created without a fund (valid since
PR #347), the lookup throws a null reference error.

## Acceptance Criteria
- [ ] Null check added for investor.funds before access
- [ ] Graceful handling when no funds exist (empty array, not null)
- [ ] pnpm typecheck passes
- [ ] pnpm lint passes
EOF
)" \
  --priority=1

br label add <BEAD_ID> phase:backend
```

### Create Review Beads

Create a single review pass after all fix stories (not at each phase boundary).

**REVIEW-001:** Review all fix work against the bug report. Verify root cause is addressed (not just symptoms), run quality gates, check for side effects. Document findings in progress.md, create corrective beads if needed. Label: `phase:review`, priority 1.

**BUGSCAN-001:** Re-read all changed code with fresh eyes. Include the "87 serious bugs" motivation prompt. Focus on whether the fix solves the root cause and could introduce new bugs. Label: `phase:review`, priority 1.

### Create Audit and Learning Beads

At the end of the epic, create AUDIT-001 and LEARN-001 only (no AUDIT-002).

**AUDIT-001: Fix area code review** — Focus on the code area around the fix. Include "87 serious bugs" prompt. Look for related bugs sharing the same root cause pattern, similar mistakes elsewhere, edge cases. Label: `phase:audit`, priority 2.

**LEARN-001: Learning extraction** — Review progress.md, document root cause and why it wasn't caught, identify test/process gaps, update intake-checklist.md, write epic summary. If CASS available: index sessions and create memory entries. Label: `phase:learn`, priority 3.

---

## Step 4: Wire Dependencies

The dependency graph for bug fixes is simpler than features:

1. Fix stories can depend on each other (root cause fix first, then cascading fixes)
2. REVIEW-001 depends on ALL fix stories
3. BUGSCAN-001 depends on REVIEW-001
4. AUDIT-001 depends on BUGSCAN-001
5. LEARN-001 depends on AUDIT-001

### Dependency Pattern

```bash
# Fix stories — root cause first, cascading fixes depend on it
br dep add <US-002> <US-001>
br dep add <US-003> <US-001>

# Review depends on ALL fix stories
br dep add <REVIEW-001> <US-001>
br dep add <REVIEW-001> <US-002>
br dep add <REVIEW-001> <US-003>

# Bug scan depends on review
br dep add <BUGSCAN-001> <REVIEW-001>

# Audit depends on bug scan
br dep add <AUDIT-001> <BUGSCAN-001>

# Learning depends on audit
br dep add <LEARN-001> <AUDIT-001>
```

**Result:** BV's PageRank will prioritize the root cause fix first (it unblocks everything), then cascading fixes, then review/audit/learn in order.

---

## Step 5: Self-Check Round

After creating all beads and wiring dependencies, do a self-check:

> Check over each bead super carefully — are you sure it makes sense? Is it optimal?
> Could we change anything to make the system work better? If so, revise the beads.
> It's a lot easier and faster to operate in "plan space" before we start implementing.

Specifically verify:
- [ ] Every bead is self-contained and self-documenting
- [ ] No bead is too large for one iteration
- [ ] Dependencies are wired correctly (no cycles, no missing edges)
- [ ] Phase labels are applied to every bead
- [ ] Quality gates are appended to every fix bead's criteria
- [ ] The root cause fix is the first thing that runs
- [ ] The dependency graph enforces the correct execution order

If anything is wrong, fix it with `br update` or additional `br dep add` commands.

---

## Step 6: Summary Output + Launch Wizard

### Summary Output

After creating all beads, output:

```
## Beads Created

Epic: <EPIC_ID> - Bugfix: <Bug Name>
PRD: tasks/prd-bugfix-<bug>.md

### Fix Beads
- <ID>: US-001 - <Title> [phase:backend]
- <ID>: US-002 - <Title> [phase:test]

### Structural Beads
- <ID>: REVIEW-001 - Fix review [phase:review]
- <ID>: BUGSCAN-001 - Fix fresh-eyes review [phase:review]
- <ID>: AUDIT-001 - Fix area code review [phase:audit]
- <ID>: LEARN-001 - Learning extraction [phase:learn]

### Dependency Summary
Fix stories -> REVIEW-001 -> BUGSCAN-001 -> AUDIT-001 -> LEARN-001

### Run Command
bun run <cli_path> forward --epic <EPIC_ID> --max-iterations <N>
> Setting --max-iterations to {N} ({total_beads} beads x 2 buffer for retries/corrective beads)
```

**Calculate recommended iterations:** total beads x 2 (accounts for retries and corrective beads).

### Launch Options

Read `cli_path` from `.super-ralph/config.toml` (the `[cli] path` field). If not set, error and tell the user to run `/superralph:init`.

Offer three options:

1. **Run now** — Ask about model overrides, then run:
   ```bash
   bun run <cli_path> forward --epic <EPIC_ID> --max-iterations <N> --headless [--model <model>]
   ```
   After completion: remind about `bun run <cli_path> status --epic <EPIC_ID>` and `/superralph:resume` to resume.

2. **Copy to clipboard** — Copy forward command (without `--headless`) via `pbcopy`. Also display as fallback.

3. **Show command** — Display the full command for manual copy.

Always explain: "Setting --max-iterations to {N} ({total_beads} beads x 2 buffer for retries/corrective beads)"

---

## Checklist

Before finishing, verify:

- [ ] Project context explored (AGENTS.md, README.md, codebase, progress.md)
- [ ] Bug investigation complete (reproduction, impact, root cause hypothesis)
- [ ] Technical questions asked as needed (edge cases, data implications)
- [ ] Learned questions from intake-checklist.md checked
- [ ] Quality gates asked and included
- [ ] Fix stories are iteration-sized (completable in one Ralph TUI iteration)
- [ ] Phase labels assigned to every story
- [ ] REVIEW-001 and BUGSCAN-001 injected after fix stories
- [ ] AUDIT-001 injected at end (focused on fix area, no AUDIT-002)
- [ ] LEARN-001 included as final bead
- [ ] PRD wrapped in [PRD]...[/PRD] markers and saved to tasks/
- [ ] Git repository verified (or initialized)
- [ ] Epic created with --external-ref to PRD
- [ ] Each fix story converted to one self-documenting bead
- [ ] Phase labels applied via br label add
- [ ] Quality gates appended to every fix bead's criteria
- [ ] All dependencies wired correctly
- [ ] Self-check round completed
- [ ] Summary output provided with calculated --max-iterations
- [ ] Launch wizard presented
