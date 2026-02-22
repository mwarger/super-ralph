# Two-Phase Ralph TUI Pipeline — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure super-ralph from skill-chaining to two sequential ralph-tui CLI invocations.

**Architecture:** Slash commands become thin dispatchers that launch `ralph-tui run --skill <type>-prd`. Four self-contained ralph-tui skills replace the two chained skills (superpowers-intake + super-ralph-create-beads). Phase 2 execution is a vanilla `ralph-tui run --tracker beads-bv --epic <id>`.

**Tech Stack:** Markdown skill files, ralph-tui CLI, bd CLI (beads-bv)

---

### Task 1: Create the feature-prd skill

This is the largest and most important skill — the other three are variations of it.

**Files:**
- Create: `skills/feature-prd/SKILL.md`

**Step 1: Write the feature-prd skill**

Create `skills/feature-prd/SKILL.md` with the following structure. This skill must be completely self-contained — no references to other skills, no "invoke X skill" instructions. All logic from `superpowers-intake` (intake protocol, design doc, PRD generation) and `super-ralph-create-beads` (bead creation, dependency wiring, launch) is merged into this single file.

The skill should contain these sections in order:

```markdown
# Feature PRD — Ralph TUI Skill

> Self-contained skill for Ralph TUI that runs the full feature pipeline:
> relentless intake, design document, PRD generation, bead creation, and launch.

## The Job
1. Run the relentless intake protocol (business + technical + learned questions)
2. Produce a design document with user approval
3. Convert the design into phase-labeled user stories
4. Inject structural beads (REVIEW, BUGSCAN, AUDIT, LEARN)
5. Create beads via bd CLI with full dependency graph
6. Offer to launch Phase 2 execution

**Important:** Do NOT implement anything. This skill produces the plan and beads.

---

## Step 0: Explore Project Context

Before asking any questions:

1. Read `AGENTS.md` and `README.md` if they exist
2. Read `.ralph-tui/progress.md` if it exists (learnings from past epics)
3. Explore the codebase structure — patterns, tech stack, conventions
4. Read `.super-ralph/intake-checklist.md` if it exists (for Phase C questions)

---

## Step 1: Relentless Intake

Ask questions **one at a time**, using multiple choice when possible. After each answer, decide whether to dig deeper, move on, or generate the design. Adapt based on complexity — a simple feature might resolve in 8 questions, a complex one might take 15+.

**Seed description:** If context was provided with the command, confirm it rather than asking from scratch.

### Phase A: Business Interrogation

1. **Why does this matter?** Business case, cost of delay
2. **Who is affected?** Users, systems, teams, downstream effects
3. **What does success look like?** Measurable outcomes, not "it works"
4. **What are the boundaries?** Explicit non-goals, adjacent scope we're not touching
5. **What has been tried before?** Prior art, abandoned attempts
6. **What are the risks?** Failure modes, blast radius

### Phase B: Technical Deep-Dive

7. **What exists already?** Present findings from Step 0, ask: extend or build new?
8. **What's the data model?** Entities, relationships, storage, migrations
9. **What are the integration points?** APIs, databases, queues, external services
10. **What are the edge cases?** Error states, race conditions, empty states, permissions
11. **What are the performance constraints?** Latency, data volume, concurrency
12. **What's the testing strategy?** Automatic vs manual, test infrastructure

### Phase C: Learned Questions

Read `.super-ralph/intake-checklist.md`. For each category, assess relevance to this work. Ask only the relevant ones. If the checklist has 20 questions but 3 apply, ask those 3.

### Adaptive Depth

After each answer:
- **Dig deeper** — answer revealed complexity or ambiguity
- **Move on** — answer is clear and sufficient
- **Generate** — enough context to proceed

Signal when ready: "I think I have enough to draft the design. Any final thoughts?"

---

## Step 2: Design Document

1. **Propose 2-3 approaches** with trade-offs. Lead with recommendation.
2. **Present in sections**, asking after each whether it looks right:
   - Overview (2-3 sentences)
   - Goals (bullet list, measurable)
   - Architecture (approach, patterns, key decisions)
   - Components (what's built, what's modified)
   - Data model changes (if any)
   - Error handling strategy
   - Testing approach
   - Non-goals (explicit scope boundaries)
   - Open questions (if any remain)
3. **Scale each section to its complexity.** Few sentences if simple, 200-300 words if nuanced.
4. **Get user approval** before proceeding.
5. **Save** to `docs/plans/YYYY-MM-DD-<feature>-design.md`.

---

## Step 3: Generate PRD

### Quality Gates (REQUIRED)

Ask the user what commands must pass:

```
What quality commands must pass for each user story?
   A. pnpm typecheck && pnpm lint
   B. npm run typecheck && npm run lint
   C. bun run typecheck && bun run lint
   D. Other: [specify your commands]
```

### Sizing Rule

Each user story must be completable in ONE Ralph TUI iteration (one agent context window). If it can't be described in 2-3 sentences, split it.

### Phase Labeling

Tag each story: `[phase:schema]`, `[phase:backend]`, `[phase:ui]`, `[phase:integration]`, `[phase:test]`, `[phase:docs]`

### Structural Bead Injection

At each phase boundary:
- `REVIEW-NNN: <Phase> phase review [phase:review]`
- `BUGSCAN-NNN: <Phase> fresh-eyes review [phase:review]`

At the end:
- `AUDIT-001: Full code review [phase:audit]`
- `AUDIT-002: Test coverage verification [phase:audit]`
- `LEARN-001: Learning extraction [phase:learn]`

### Output Format

Wrap in `[PRD]...[/PRD]` markers. Save to `tasks/prd-<feature-name>.md`.
```

Then include the full PRD template (from current superpowers-intake Step 5), the structural bead acceptance criteria templates (from current super-ralph-create-beads Steps 4-5), the bead creation commands section (from current super-ralph-create-beads Steps 2-3 including HEREDOC patterns), the dependency wiring section (from current super-ralph-create-beads Step 6), the self-check round (Step 7), summary output (Step 8), and the launch wizard (Step 9 including preflight, headless/clipboard/show options, iterations calculation).

The complete file should be roughly 600-700 lines — it's merging two 500+ line skills but eliminating all the skill-chaining overhead, work-type branching (this skill is only for features), and Emanuel refinement loop.

**Step 2: Verify the skill is self-contained**

Read through the completed skill and verify:
- No references to "invoke X skill" or "chain to X"
- No work_type branching (this is feature-only)
- All bd CLI commands are complete with HEREDOC patterns
- All structural bead templates are included inline
- Launch wizard is complete with preflight, options, iterations calculation
- Intake checklist reference points to `.super-ralph/intake-checklist.md`

**Step 3: Commit**

```bash
git add skills/feature-prd/SKILL.md
git commit -m "feat: create self-contained feature-prd ralph-tui skill"
```

---

### Task 2: Create the bug-prd skill

Derive from feature-prd with focused intake and lighter structural beads.

**Files:**
- Create: `skills/bug-prd/SKILL.md`

**Step 1: Write the bug-prd skill**

Copy the skeleton from feature-prd but modify:

- **Step 1 (Intake):** Replace business interrogation with bug-focused questions:
  1. What's the bug? (reproduce steps, expected vs actual)
  2. When did it start? (recent change, always broken?)
  3. What's the impact? (who's affected, how badly)
  4. Root cause hypothesis? (present what you found in codebase exploration)
  5. What's the blast radius? (other features affected by the fix)
  6-8. Technical deep-dive questions as needed (edge cases, data implications)
  - Phase C (learned questions) still applies

- **Step 2 (Design Doc):** SKIP entirely. Bugs don't need architecture docs. Go straight from intake to PRD.

- **Step 3 (PRD):** Generate with fix + test stories. Structural beads are lighter:
  - REVIEW + BUGSCAN after the fix phase only (not at every phase boundary)
  - AUDIT-001 (focused on the fix area, not full codebase)
  - No AUDIT-002 (test coverage is part of the fix stories)
  - LEARN-001

- **Steps 4-5 (Beads + Launch):** Same as feature-prd.

Target: ~400-450 lines.

**Step 2: Commit**

```bash
git add skills/bug-prd/SKILL.md
git commit -m "feat: create self-contained bug-prd ralph-tui skill"
```

---

### Task 3: Create the hotfix-prd skill

Minimal intake, minimal beads.

**Files:**
- Create: `skills/hotfix-prd/SKILL.md`

**Step 1: Write the hotfix-prd skill**

The leanest skill. Modify from feature-prd:

- **Step 0 (Context):** Same but faster — focus on the broken area.

- **Step 1 (Intake):** 1-3 questions only:
  1. What's broken? (symptoms, error messages)
  2. What's the impact? (production down? data loss?)
  3. What's the fix? (if the user already knows)
  - Skip Phase C (no time for learned questions in a hotfix)

- **Step 2 (Design Doc):** SKIP.

- **Step 3 (PRD):** 1-3 stories max. Minimal structural beads:
  - REVIEW after the fix (no BUGSCAN — speed matters)
  - LEARN-001 (still learn from hotfixes)
  - No AUDIT beads

- **Steps 4-5 (Beads + Launch):** Same as feature-prd but with fewer beads.

Target: ~250-300 lines.

**Step 2: Commit**

```bash
git add skills/hotfix-prd/SKILL.md
git commit -m "feat: create self-contained hotfix-prd ralph-tui skill"
```

---

### Task 4: Create the refactor-prd skill

Architecture-focused intake, full structural beads.

**Files:**
- Create: `skills/refactor-prd/SKILL.md`

**Step 1: Write the refactor-prd skill**

Derive from feature-prd but with refactoring-specific intake:

- **Step 1 (Intake):** Architecture-focused questions:
  1. What's the pain? (code smells, maintenance burden, performance)
  2. What's the desired end state? (architecture, patterns)
  3. What must NOT change? (behavior, APIs, contracts)
  4. What's the migration path? (incremental vs big-bang)
  5. What are the invariants? (what must remain true throughout)
  6. What's the risk? (regression areas, integration points)
  7-12. Technical deep-dive as needed
  - Phase C (learned questions) applies

- **Step 2 (Design Doc):** YES — refactors benefit from explicit before/after architecture. Include a "Current State" and "Target State" section.

- **Step 3 (PRD):** Full structural beads (same as feature-prd). Refactors are high-risk for regressions.

- **Steps 4-5 (Beads + Launch):** Same as feature-prd.

Target: ~550-600 lines.

**Step 2: Commit**

```bash
git add skills/refactor-prd/SKILL.md
git commit -m "feat: create self-contained refactor-prd ralph-tui skill"
```

---

### Task 5: Create the plan-prd skill

Same as feature-prd but stops after design doc.

**Files:**
- Create: `skills/plan-prd/SKILL.md`

**Step 1: Write the plan-prd skill**

Copy feature-prd Steps 0-2 (context, intake, design doc). Then STOP.

After saving the design doc, output:

> "Design doc saved to `docs/plans/YYYY-MM-DD-<feature>-design.md`. Run `/superralph:feature` when you're ready to execute this plan."

No Step 3 (PRD), no Step 4 (beads), no Step 5 (launch).

Target: ~300-350 lines.

**Step 2: Commit**

```bash
git add skills/plan-prd/SKILL.md
git commit -m "feat: create self-contained plan-prd ralph-tui skill"
```

---

### Task 6: Rewrite slash commands as thin dispatchers

Update the 5 pipeline commands to be thin dispatchers. Leave init/resume/status unchanged.

**Files:**
- Modify: `commands/superralph:feature.md`
- Modify: `commands/superralph:bug.md`
- Modify: `commands/superralph:hotfix.md`
- Modify: `commands/superralph:refactor.md`
- Modify: `commands/superralph:plan.md`

**Step 1: Rewrite superralph:feature.md**

```markdown
---
description: "Start building a new feature through the super-ralph pipeline"
---

## Pipeline: Feature

1. Run `ralph-tui doctor` to verify the project is ready. If it fails, tell the user to run `/superralph:init` first.

2. Run `ralph-tui run --skill feature-prd --tracker beads-bv`.

3. The skill handles everything: intake, design doc, PRD, beads, and launch offer.

If the user provided a description after the command, pass it as context to the skill session.
```

**Step 2: Rewrite superralph:bug.md**

Same pattern but `--skill bug-prd`.

**Step 3: Rewrite superralph:hotfix.md**

Same pattern but `--skill hotfix-prd`.

**Step 4: Rewrite superralph:refactor.md**

Same pattern but `--skill refactor-prd`.

**Step 5: Rewrite superralph:plan.md**

Same pattern but `--skill plan-prd`. Add note: "This stops after the design doc. No PRD, beads, or execution."

**Step 6: Commit**

```bash
git add commands/superralph:feature.md commands/superralph:bug.md commands/superralph:hotfix.md commands/superralph:refactor.md commands/superralph:plan.md
git commit -m "refactor: rewrite slash commands as thin dispatchers to ralph-tui"
```

---

### Task 7: Retire old skills

Move the old skills to an archive directory so they're available for reference but not active.

**Files:**
- Move: `skills/superpowers-intake/SKILL.md` → `skills/_archived/superpowers-intake/SKILL.md`
- Move: `skills/super-ralph-create-beads/SKILL.md` → `skills/_archived/super-ralph-create-beads/SKILL.md`

**Step 1: Create archive directory and move files**

```bash
mkdir -p skills/_archived/superpowers-intake
mkdir -p skills/_archived/super-ralph-create-beads
git mv skills/superpowers-intake/SKILL.md skills/_archived/superpowers-intake/SKILL.md
git mv skills/super-ralph-create-beads/SKILL.md skills/_archived/super-ralph-create-beads/SKILL.md
```

**Step 2: Remove empty directories if git mv left them**

```bash
rmdir skills/superpowers-intake 2>/dev/null || true
rmdir skills/super-ralph-create-beads 2>/dev/null || true
```

**Step 3: Commit**

```bash
git add -A skills/
git commit -m "refactor: archive retired skill-chaining skills"
```

---

### Task 8: Update symlinks for OpenCode

The OpenCode install has symlinks pointing to the old skill locations. Update them.

**Files:**
- Check/update: `~/.config/opencode/skills/super-ralph/` symlinks

**Step 1: Check current symlinks**

```bash
ls -la ~/.config/opencode/skills/super-ralph/
```

**Step 2: Remove old symlinks**

```bash
rm -f ~/.config/opencode/skills/super-ralph/superpowers-intake
rm -f ~/.config/opencode/skills/super-ralph/super-ralph-create-beads
```

**Step 3: Create new symlinks for the new skills**

```bash
ln -sf /Users/mat/dev/farsight/agent-framework/skills/feature-prd ~/.config/opencode/skills/super-ralph/feature-prd
ln -sf /Users/mat/dev/farsight/agent-framework/skills/bug-prd ~/.config/opencode/skills/super-ralph/bug-prd
ln -sf /Users/mat/dev/farsight/agent-framework/skills/hotfix-prd ~/.config/opencode/skills/super-ralph/hotfix-prd
ln -sf /Users/mat/dev/farsight/agent-framework/skills/refactor-prd ~/.config/opencode/skills/super-ralph/refactor-prd
ln -sf /Users/mat/dev/farsight/agent-framework/skills/plan-prd ~/.config/opencode/skills/super-ralph/plan-prd
```

**Step 4: Verify symlinks resolve**

```bash
ls -la ~/.config/opencode/skills/super-ralph/
```

**Step 5: Commit** (no git changes — symlinks are outside repo)

No commit needed for this task.

---

### Task 9: Update design doc references

The master design doc (`2026-02-21-superpowers-ralph-sdlc-design.md`) references the old skill names. Add a note pointing to the new architecture.

**Files:**
- Modify: `docs/plans/2026-02-21-superpowers-ralph-sdlc-design.md` (add deprecation note at top)

**Step 1: Add deprecation header**

Add to the top of the file, after the title:

```markdown
> **Note (2026-02-22):** This design has been superseded by the two-phase pipeline architecture.
> See `docs/plans/2026-02-22-two-phase-pipeline-design.md` for the current design.
> The skill-chaining approach described below has been replaced with self-contained ralph-tui skills.
```

**Step 2: Commit**

```bash
git add docs/plans/2026-02-21-superpowers-ralph-sdlc-design.md
git commit -m "docs: mark original SDLC design as superseded by two-phase pipeline"
```

---

### Task 10: Verify end-to-end

Verify the new architecture works by checking all pieces are in place.

**Step 1: Verify skill files exist**

```bash
ls -la skills/feature-prd/SKILL.md
ls -la skills/bug-prd/SKILL.md
ls -la skills/hotfix-prd/SKILL.md
ls -la skills/refactor-prd/SKILL.md
ls -la skills/plan-prd/SKILL.md
```

**Step 2: Verify old skills are archived**

```bash
ls -la skills/_archived/superpowers-intake/SKILL.md
ls -la skills/_archived/super-ralph-create-beads/SKILL.md
```

**Step 3: Verify slash commands reference new skills**

```bash
grep "ralph-tui run --skill" commands/superralph:*.md
```

Expected: Each command references the appropriate `--skill <type>-prd`.

**Step 4: Verify no dangling references to old skills**

```bash
grep -r "superpowers-intake" commands/ skills/ .super-ralph/ --include="*.md" | grep -v "_archived"
grep -r "super-ralph-create-beads" commands/ skills/ .super-ralph/ --include="*.md" | grep -v "_archived"
```

Expected: No matches outside of `_archived/`.

**Step 5: Run ralph-tui doctor**

```bash
ralph-tui doctor
```

Expected: Healthy output.

**Step 6: Verify ralph-tui can find the new skills**

```bash
ralph-tui skills list
```

Verify the new skills appear.

**Step 7: Commit any fixes**

If any issues found, fix and commit.
