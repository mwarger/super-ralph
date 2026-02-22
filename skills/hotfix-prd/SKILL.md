---
name: hotfix-prd
description: "Self-contained Ralph TUI skill for urgent production hotfix workflows: fast intake, minimal PRD, bead creation, and launch."
---

# Hotfix PRD — Ralph TUI Skill

> Minimal hotfix pipeline: fast intake, PRD generation, bead creation, and launch.
> No design doc. No ceremony. Get the fix out.

---

## The Job

1. Run fast intake (3 questions max)
2. Generate a minimal PRD (1-3 stories)
3. Inject structural beads (REVIEW + LEARN only — no BUGSCAN, no AUDIT)
4. Output the PRD wrapped in `[PRD]...[/PRD]` markers
5. Create beads via `bd` CLI with a simple dependency chain
6. Offer to launch execution

**Important:** Do NOT implement anything. This skill produces the plan and beads only.

**Announce at start:** "I'm using the hotfix-prd skill for fast intake, minimal PRD generation, and bead creation."

---

## Step 0: Explore Project Context

Before asking questions, quickly ground yourself:

1. Read `AGENTS.md` and `README.md` if they exist
2. Read `.ralph-tui/progress.md` if it exists
3. Explore the broken area of the codebase — focus on what's relevant to the fix

Speed matters. Don't explore broadly — zoom into the problem area.

---

## Step 1: Fast Intake

Ask **1-3 questions only**, one at a time. Skip deep-dives. Skip learned questions.

**Seed description:** If context was provided, confirm it: "You want to fix [description] — is that right, or should I adjust?"

1. **What's broken?** Symptoms, error messages, stack traces. What does the user see?
2. **What's the impact?** Production down? Data loss? User-facing? How many users? Workaround?
3. **What's the fix?** If the user knows, confirm it. If not, investigate and propose.

After each answer: **ask the next question** or **generate the PRD** (you may not need all three).

Signal when ready: "I have enough to draft the fix plan. Any final thoughts?"

---

## Step 2: Generate PRD

Convert intake directly into a minimal PRD. No design document. No approach proposals.

### Quality Gates (REQUIRED)

```
What quality commands must pass?
   A. pnpm typecheck && pnpm lint    B. npm run typecheck && npm run lint
   C. bun run typecheck && bun run lint    D. Other: [specify]
```

### Sizing Rule

1-3 stories MAX, each completable in ONE Ralph TUI iteration. If the hotfix needs more than 3 stories, it's not a hotfix — use `feature-prd` or `bug-prd` instead.

### Structural Beads

After implementation stories, inject **REVIEW-001** (review the fix) and **LEARN-001** (learn from it). No BUGSCAN. No AUDIT.

### Output Format

Wrap in `[PRD]...[/PRD]` markers. Save to `tasks/prd-hotfix-<name>.md`.

```markdown
[PRD]
# PRD: Hotfix — <Problem Summary>

## Overview
<1-2 sentences: what's broken and what the fix does>

## Impact
<severity, affected users, workaround status>

## Quality Gates
- `<command>` - <description>

## User Stories

### US-001: <Title> [phase:<phase>]
**Description:** <What to fix and why>
**Acceptance Criteria:**
- [ ] <verifiable criterion>
- [ ] <quality gate criterion>

### REVIEW-001: Hotfix review [phase:review]
**Description:** Review the hotfix. Verify fix is correct, complete, no regressions.
**Acceptance Criteria:**
- [ ] Fix addresses reported problem; no regressions; all quality gates pass
- [ ] Findings documented in progress.md; corrective beads created if issues found

### LEARN-001: Learning extraction [phase:learn]
**Description:** What broke? Why? How do we prevent it next time?
**Acceptance Criteria:**
- [ ] Root cause + prevention strategy documented in progress.md

## Non-Goals
- <what this hotfix is NOT fixing>
[/PRD]
```

---

## Step 3: Create Beads

### Command Reference

```bash
bd create --type=epic --title="..." --description="$(cat <<'EOF'
...
EOF
)" --external-ref="prd:./tasks/prd-hotfix-<name>.md"

bd create --parent=<EPIC_ID> --title="..." --description="$(cat <<'EOF'
...
EOF
)" --priority=<1-4>

bd dep add <issue-id> <depends-on-id>
bd label add <issue-id> <label>
```

> **CRITICAL:** Always use `<<'EOF'` (single-quoted) for HEREDOC delimiters.

### Verify Git Repository

Run `git status`. If no repo exists, initialize: `git init && git add -A && git commit -m "chore: initial commit"`.

### Create Epic

```bash
bd create --type=epic \
  --title="Hotfix: <Problem Summary>" \
  --description="$(cat <<'EOF'
<What's broken and what the fix does>

PRD: tasks/prd-hotfix-<name>.md
EOF
)" \
  --external-ref="prd:./tasks/prd-hotfix-<name>.md"
```

### Create Implementation Beads

For each `US-XXX` story: create bead with acceptance criteria + quality gates, parse phase label, add label via `bd label add`.

**Self-documenting beads:** Include problem context, symptoms, root cause (if known), and the specific fix so a fresh agent can execute without prior context.

### Create Review Bead

```bash
bd create --parent=<EPIC_ID> \
  --title="REVIEW-001: Hotfix review" \
  --description="$(cat <<'EOF'
Review the hotfix against the problem description.
1. Read the PRD (referenced in epic's external-ref)
2. Diff all changes made by implementation beads
3. Verify fix addresses the reported problem
4. Run all quality gate commands, check for regressions and edge cases
5. Document findings in .ralph-tui/progress.md
6. If issues found: create corrective beads with bd create

- [ ] Fix addresses reported problem
- [ ] No regressions introduced
- [ ] All quality gates pass
- [ ] Findings documented in progress.md
EOF
)" --priority=1
bd label add <REVIEW_ID> phase:review
```

### Create Learning Bead

```bash
bd create --parent=<EPIC_ID> \
  --title="LEARN-001: Learning extraction" \
  --description="$(cat <<'EOF'
Extract learnings from this hotfix. Hotfixes are the best teachers.
1. Document root cause in .ralph-tui/progress.md
2. Identify why this wasn't caught earlier (test gap? monitoring gap? design gap?)
3. Document prevention strategy
4. Update .super-ralph/intake-checklist.md with new questions if discovered
5. Write final epic summary to progress.md

- [ ] Root cause documented in progress.md
- [ ] Prevention strategy documented
- [ ] .super-ralph/intake-checklist.md updated if new questions discovered
EOF
)" --priority=3
bd label add <LEARN_ID> phase:learn
```

---

## Step 4: Wire Dependencies

Hotfix graphs are simple — mostly linear:

```bash
# Chain implementation beads if sequential
bd dep add <US-002> <US-001>          # if sequential
bd dep add <US-003> <US-002>          # if sequential

# REVIEW depends on ALL implementation beads
bd dep add <REVIEW-001> <US-001>
bd dep add <REVIEW-001> <US-002>      # if exists
bd dep add <REVIEW-001> <US-003>      # if exists

# LEARN depends on REVIEW
bd dep add <LEARN-001> <REVIEW-001>
```

**Result:** fix → verify → learn.

---

## Step 5: Self-Check Round

Quick verify:

- [ ] Every bead is self-contained and self-documenting
- [ ] No bead is too large for one iteration
- [ ] Dependencies wired correctly (no cycles)
- [ ] Phase labels on every bead
- [ ] Quality gates in every implementation bead
- [ ] Total is 3-5 beads (1-3 impl + REVIEW + LEARN)

Fix issues with `bd update` or `bd dep add`.

---

## Step 6: Summary Output + Launch Wizard

### Summary

```
Epic: <EPIC_ID> - Hotfix: <Problem Summary>  |  PRD: tasks/prd-hotfix-<name>.md
Beads: <ID> US-001, [US-002, US-003,] <ID> REVIEW-001, <ID> LEARN-001
Chain: US-001 -> [US-002 ->] REVIEW-001 -> LEARN-001
Run:   ralph-tui run --tracker beads-bv --epic <EPIC_ID> --iterations <N>
       (iterations = total beads x 2 buffer for retries/corrective beads)
```

### Preflight

Run `ralph-tui doctor` — verify healthy before offering launch.

### Launch Options

> "Beads are ready. How would you like to start?
> 1. **Run headless** — `ralph-tui run --headless --tracker beads-bv --epic <ID> --iterations <N>`
> 2. **Copy to clipboard** — I'll `pbcopy` the run command for a new terminal tab
> 3. **Show command** — display for manual copy"

For headless: ask about agent/model overrides first (use config defaults, override agent, model, or both).

---

## Checklist

- [ ] Project context explored (focused on broken area)
- [ ] Fast intake complete (1-3 questions)
- [ ] Quality gates asked and included
- [ ] 1-3 iteration-sized user stories
- [ ] Phase labels assigned to every story
- [ ] REVIEW-001 created (no BUGSCAN)
- [ ] LEARN-001 created (no AUDIT beads)
- [ ] PRD wrapped in [PRD]...[/PRD] markers and saved
- [ ] Git repository verified
- [ ] Epic created with --external-ref to PRD
- [ ] All beads self-contained and self-documenting
- [ ] Dependencies wired (simple chain)
- [ ] Self-check completed
- [ ] Summary output with calculated --iterations
- [ ] Preflight passed
- [ ] Launch wizard presented
