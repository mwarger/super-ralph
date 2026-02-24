# Spec-First Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the pipeline so slash commands produce specs (stop before beads), decompose autonomously discovers and creates beads, and execution runs from the terminal.

**Architecture:** Slash commands simplify to intake + design doc. Decompose template gets planning intelligence (task sizing, review/audit beads, dependency wiring). Commands rename from `superralph:*` to `super-ralph:*`. Resume command dropped.

**Tech Stack:** Handlebars templates, TypeScript (Bun), OpenCode plugin JS, Markdown skills

**Design doc:** `docs/plans/2026-02-24-spec-first-architecture-design.md`

---

### Task 1: Rename Command Files

Rename all 8 command files from `superralph:` to `super-ralph:` prefix. Drop the resume command entirely.

**Files:**
- Rename: `commands/superralph:feature.md` -> `commands/super-ralph:feature.md`
- Rename: `commands/superralph:bug.md` -> `commands/super-ralph:bug.md`
- Rename: `commands/superralph:hotfix.md` -> `commands/super-ralph:hotfix.md`
- Rename: `commands/superralph:refactor.md` -> `commands/super-ralph:refactor.md`
- Rename: `commands/superralph:plan.md` -> `commands/super-ralph:plan.md`
- Rename: `commands/superralph:status.md` -> `commands/super-ralph:status.md`
- Rename: `commands/superralph:init.md` -> `commands/super-ralph:init.md`
- Delete: `commands/superralph:resume.md`

**Step 1: Rename all command files**

```bash
cd commands
for old in superralph:*.md; do
  new="super-ralph:${old#superralph:}"
  git mv "$old" "$new"
done
```

**Step 2: Delete the resume command**

```bash
git rm commands/super-ralph:resume.md
```

**Step 3: Update internal references in command files**

Each pipeline command (feature, bug, hotfix, refactor, plan) has a line referencing `/superralph:init` at line 8. Update to `/super-ralph:init`.

Files to edit:
- `commands/super-ralph:feature.md:8` — `/superralph:init` -> `/super-ralph:init`
- `commands/super-ralph:bug.md:8` — same
- `commands/super-ralph:hotfix.md:8` — same
- `commands/super-ralph:refactor.md:8` — same
- `commands/super-ralph:plan.md:8` — same

The `super-ralph:resume.md:9` reference is gone (file deleted).

**Step 4: Verify**

```bash
grep -r "superralph" commands/
```
Expected: no matches.

**Step 5: Commit**

```bash
git add -A commands/
git commit -m "refactor: rename superralph:* commands to super-ralph:*, drop resume"
```

---

### Task 2: Update Plugin

Update `.opencode/plugins/super-ralph.js` lines 12-13 to use new command names and remove resume.

**Files:**
- Modify: `.opencode/plugins/super-ralph.js:12-13`

**Step 1: Edit plugin**

Line 12 currently lists all commands including resume. Update to:
```
'This project uses super-ralph. Commands: /super-ralph:feature, /super-ralph:bug, /super-ralph:hotfix, /super-ralph:refactor, /super-ralph:plan, /super-ralph:status.'
```

Line 13 currently says `/superralph:init`. Update to:
```
'The super-ralph framework is available. Run /super-ralph:init to set up.'
```

**Step 2: Verify**

```bash
grep "superralph" .opencode/plugins/super-ralph.js
```
Expected: no matches.

**Step 3: Commit**

```bash
git add .opencode/plugins/super-ralph.js
git commit -m "fix: update plugin to use super-ralph:* command names, remove resume"
```

---

### Task 3: Update CLI Doctor References

Update `src/index.ts` where `cmdDoctor()` references `/superralph:init`.

**Files:**
- Modify: `src/index.ts:213,224,233,242,261,265`

**Step 1: Replace all `/superralph:init` with `/super-ralph:init` in src/index.ts**

6 occurrences, all in the `cmdDoctor()` function. Use replaceAll.

**Step 2: Run typecheck**

```bash
bun run typecheck
```
Expected: clean.

**Step 3: Verify**

```bash
grep "superralph" src/index.ts
```
Expected: no matches.

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "fix: update doctor command to reference /super-ralph:init"
```

---

### Task 4: Update Init Skill

Update `skills/super-ralph-init/SKILL.md` command references.

**Files:**
- Modify: `skills/super-ralph-init/SKILL.md:290,292`

**Step 1: Edit init skill**

Line 290: `/superralph:feature` -> `/super-ralph:feature`
Line 292: `/superralph:plan` -> `/super-ralph:plan`

**Step 2: Verify**

```bash
grep "superralph" skills/super-ralph-init/SKILL.md
```
Expected: no matches.

**Step 3: Commit**

```bash
git add skills/super-ralph-init/SKILL.md
git commit -m "fix: update init skill to use super-ralph:* command names"
```

---

### Task 5: Simplify Feature Skill

Strip bead creation, launch wizard, and PRD format from `skills/feature-prd/SKILL.md`. Keep intake + design doc + handoff.

**Files:**
- Modify: `skills/feature-prd/SKILL.md` (783 lines -> ~200-250 lines)

**Step 1: Read the full skill to understand structure**

Read `skills/feature-prd/SKILL.md` completely. Identify:
- Steps to KEEP: Step 0 (explore context), Step 1 (intake), Step 2 (design doc)
- Steps to REMOVE: Step 3 (PRD generation), Step 4 (user approval of PRD), Step 5 (bead creation), Step 6 (dependency wiring), Step 7 (launch wizard)

**Step 2: Rewrite the skill**

Keep the first ~300 lines (explore, intake, design doc). Replace everything after with a simple handoff:

The "Job" section changes from 7 steps to 3:
1. Explore project context
2. Relentless intake (feature-depth: 10-15 questions)
3. Write design doc, save to `tasks/<name>-spec.md`, print decompose command

The handoff section should:
- Save the design doc to `tasks/<name>-spec.md`
- Print: `Ready for decompose. Run in your terminal:`
- Print: `super-ralph decompose --spec tasks/<name>-spec.md`

**Step 3: Update `/superralph:init` reference to `/super-ralph:init`**

Line 682 (or wherever it lands after rewrite).

**Step 4: Verify**

```bash
grep "superralph" skills/feature-prd/SKILL.md
grep -c "bead\|launch\|wizard\|epic" skills/feature-prd/SKILL.md
```
Expected: no "superralph" matches. Minimal/zero bead/launch/wizard/epic references.

**Step 5: Commit**

```bash
git add skills/feature-prd/SKILL.md
git commit -m "refactor: simplify feature skill to intake + design doc, remove bead creation"
```

---

### Task 6: Simplify Bug Skill

Same treatment as feature skill but for `skills/bug-prd/SKILL.md` (428 lines -> ~150 lines).

**Files:**
- Modify: `skills/bug-prd/SKILL.md`

**Step 1: Read full skill, identify keep/remove sections**

Keep: Step 0 (explore), Step 1 (focused intake, 5-8 questions), Step 2 (design doc).
Remove: Steps for PRD, beads, launch.

**Step 2: Rewrite with same handoff pattern as Task 5**

**Step 3: Update any `/superralph:*` references to `/super-ralph:*`**

**Step 4: Verify and commit**

```bash
git add skills/bug-prd/SKILL.md
git commit -m "refactor: simplify bug skill to intake + design doc, remove bead creation"
```

---

### Task 7: Simplify Hotfix Skill

Same treatment for `skills/hotfix-prd/SKILL.md` (290 lines -> ~100 lines).

**Files:**
- Modify: `skills/hotfix-prd/SKILL.md`

**Step 1: Read full skill, identify keep/remove**

Keep: Step 0 (explore), Step 1 (fast intake, 1-3 questions), Step 2 (design doc).
Remove: PRD, beads, launch.

**Step 2: Rewrite with handoff pattern**

**Step 3: Update `/superralph:*` references**

**Step 4: Verify and commit**

```bash
git add skills/hotfix-prd/SKILL.md
git commit -m "refactor: simplify hotfix skill to intake + design doc, remove bead creation"
```

---

### Task 8: Simplify Refactor Skill

Same treatment for `skills/refactor-prd/SKILL.md` (868 lines -> ~250 lines).

**Files:**
- Modify: `skills/refactor-prd/SKILL.md`

**Step 1: Read full skill, identify keep/remove**

Keep: Step 0 (explore with refactor-specific items), Step 1 (architecture intake), Step 2 (design doc).
Remove: PRD, beads, launch.

**Step 2: Rewrite with handoff pattern**

**Step 3: Update `/superralph:*` references**

**Step 4: Verify and commit**

```bash
git add skills/refactor-prd/SKILL.md
git commit -m "refactor: simplify refactor skill to intake + design doc, remove bead creation"
```

---

### Task 9: Update Plan Skill

`skills/plan-prd/SKILL.md` (143 lines) already stops at design doc. Just update command references.

**Files:**
- Modify: `skills/plan-prd/SKILL.md:20,123`

**Step 1: Update `/superralph:feature` references to `/super-ralph:feature`**

2 occurrences at lines 20 and 123.

**Step 2: Verify and commit**

```bash
grep "superralph" skills/plan-prd/SKILL.md
git add skills/plan-prd/SKILL.md
git commit -m "fix: update plan skill to use super-ralph:* command names"
```

---

### Task 10: Enrich Decompose Template

Replace the current decompose template with planning intelligence. The template currently tells the agent to read the spec and create beads one at a time. The new version guides autonomous discovery with task sizing, review/audit beads, and dependency wiring.

**Files:**
- Modify: `.super-ralph/decompose.hbs` (68 lines -> ~100-120 lines)
- Modify: `templates/decompose.hbs` (must mirror `.super-ralph/decompose.hbs`)

**Step 1: Read the current decompose template fully**

Read `.super-ralph/decompose.hbs` to understand current structure.

**Step 2: Rewrite the template**

The new template should include:

Section: Your Mission
- You are a decompose loop iteration. Read the spec, assess what beads are needed, create the next one.

Section: The Spec
- `{{{specContent}}}` (unchanged)

Section: Epic and Existing Beads
- `{{epicId}}`, `{{#each existingBeads}}` (unchanged)

Section: Task Sizing Guidance (NEW)
- Each bead should be implementable, testable, and committable in a single forward iteration
- Aim for tasks that take 5-15 minutes of agent work
- If a task feels too large, split it
- Each bead needs clear acceptance criteria that can be mechanically verified

Section: Planning Intelligence (NEW)
- Create implementation beads in dependency order (foundations first)
- Group related work into phases (core functionality, edge cases, polish)
- {{#if includeReview}} Add review beads at natural phase boundaries — after core implementation, after edge cases
- {{#if includeBugscan}} Add a bugscan bead after all implementation beads
- {{#if includeAudit}} Add an audit bead as the final bead
- Wire `depends_on` so beads unblock in a sensible order
- Use `area:` labels for model routing (area:frontend-design, area:backend, area:review, etc.)

Section: Creating a Bead (unchanged but ensure br commands are correct)
- `br create --parent {{epicId}} --title "..." --description "..." --label "area:..." --depends-on "..."`

Section: When to Stop
- Signal `phase_done` when the spec is fully decomposed — every requirement has at least one bead covering it
- Don't over-decompose — if the spec is simple, 3-5 beads may be enough
- A complex feature spec might need 20-30+ beads

**Step 3: Copy to templates/decompose.hbs**

Ensure `templates/decompose.hbs` is identical to `.super-ralph/decompose.hbs`.

**Step 4: Commit**

```bash
git add .super-ralph/decompose.hbs templates/decompose.hbs
git commit -m "feat: enrich decompose template with planning intelligence and task sizing"
```

---

### Task 11: Update Decompose System Prompt

Update `src/decompose.ts` system prompt to match the new decompose role.

**Files:**
- Modify: `src/decompose.ts:54-63`

**Step 1: Update the system prompt**

The current system prompt (lines 54-63) says "read the spec, create beads." Update to emphasize autonomous discovery:

```typescript
const systemPrompt = [
  "You are an autonomous planning agent in a super-ralph decompose loop iteration.",
  "Your job: read the spec, assess what work remains, and create the next bead.",
  "Create small, verifiable tasks. Each bead should be implementable in one forward iteration.",
  "Add review/audit beads at natural boundaries based on spec complexity.",
  "Use `br create` to make beads. Use `br show` to inspect existing ones.",
  "Signal completion via the task_complete tool:",
  '- status: "complete" — you created a bead, loop continues',
  '- status: "phase_done" — the spec is fully decomposed, loop ends',
  '- status: "blocked" — you can\'t proceed, explain why',
  '- status: "failed" — something went wrong, explain what',
].join("\n");
```

**Step 2: Run typecheck**

```bash
bun run typecheck
```

**Step 3: Commit**

```bash
git add src/decompose.ts
git commit -m "feat: update decompose system prompt for autonomous planning role"
```

---

### Task 12: Update README

Update README to reflect the new pipeline, new command names, and removed resume command.

**Files:**
- Modify: `README.md`

**Step 1: Update command references**

Replace all `superralph:*` with `super-ralph:*` (approximately 12 occurrences).
Remove `/superralph:resume` from all command lists.

**Step 2: Update the pipeline description**

The "Pipeline (End-to-End)" section (lines 169-195) describes the old flow where skills create beads and offer to launch. Rewrite to describe:
1. Slash commands do intake + design doc
2. User runs decompose in terminal
3. User runs forward in terminal

**Step 3: Update slash command list**

Remove resume from the commands list. Update all command names.

**Step 4: Verify**

```bash
grep "superralph" README.md
```
Expected: no matches (only `super-ralph` with hyphen).

**Step 5: Commit**

```bash
git add README.md
git commit -m "docs: update README for spec-first architecture and super-ralph:* command names"
```

---

### Task 13: Update INSTALL Files

Update `.opencode/INSTALL.md` and `.claude/INSTALL.md` with new command names and remove resume.

**Files:**
- Modify: `.opencode/INSTALL.md` (~11 occurrences of `superralph`)
- Modify: `.claude/INSTALL.md` (~9 occurrences of `superralph`)

**Step 1: Replace all `superralph:*` with `super-ralph:*` in both files**

**Step 2: Remove resume from command tables/lists**

**Step 3: Update symlink instructions**

The command symlink loop `for cmd in ~/.agents/super-ralph/commands/*.md` doesn't need changing (it uses a glob). But the verify section that lists `superralph:*.md` needs updating to `super-ralph:*.md`.

**Step 4: Verify**

```bash
grep "superralph" .opencode/INSTALL.md .claude/INSTALL.md
```
Expected: no matches.

**Step 5: Commit**

```bash
git add .opencode/INSTALL.md .claude/INSTALL.md
git commit -m "docs: update INSTALL files for super-ralph:* command names"
```

---

### Task 14: Re-create OpenCode Command Symlinks

After renaming command files, the symlinks in `~/.config/opencode/commands/` point to the old filenames.

**Step 1: Remove old symlinks**

```bash
rm ~/.config/opencode/commands/superralph:*.md
```

**Step 2: Create new symlinks**

```bash
for cmd in ~/.agents/super-ralph/commands/*.md; do
  ln -sf "$cmd" ~/.config/opencode/commands/"$(basename "$cmd")"
done
```

**Step 3: Verify**

```bash
ls -la ~/.config/opencode/commands/super-ralph:*.md
```
Expected: 7 symlinks (feature, bug, hotfix, refactor, plan, status, init) all pointing to `~/.agents/super-ralph/commands/super-ralph:*.md`.

No commit needed (local machine config, not in repo).

---

### Task 15: Run Full Verification

**Step 1: Run typecheck**

```bash
bun run typecheck
```
Expected: clean.

**Step 2: Run E2E tests**

```bash
bash tests/e2e-all.sh
```
Expected: all 3 suites pass.

**Step 3: Grep for any remaining `superralph` references (excluding historical docs/plans and .beads/)**

```bash
grep -r "superralph" --include="*.ts" --include="*.js" --include="*.md" --include="*.hbs" --include="*.toml" . | grep -v "docs/plans/" | grep -v ".beads/" | grep -v "node_modules/"
```
Expected: no matches.

**Step 4: Verify symlinks work**

```bash
ls ~/.config/opencode/skills/super-ralph/
ls ~/.config/opencode/commands/super-ralph:*.md
file ~/.config/opencode/plugins/super-ralph.js
```

**Step 5: Final commit if any stragglers, then push**

```bash
git push
```
