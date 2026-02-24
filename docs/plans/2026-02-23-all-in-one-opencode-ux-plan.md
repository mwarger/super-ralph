# All-in-One OpenCode UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make super-ralph runnable entirely from inside OpenCode — no second terminal, no npm package, no manual server management.

**Architecture:** Add `cli.path` to config, update all skills/commands to use `bun run <cli_path>` instead of `npx super-ralph`, make `doctor` print actionable fix commands, add prerequisite validation to init.

**Tech Stack:** TypeScript (Bun), TOML config, Markdown skills/commands

---

### Task 1: Add `cli` to types and config

**Files:**
- Modify: `src/types.ts` (add `cli` to LoopConfig)
- Modify: `src/config.ts` (add default, merge logic)
- Modify: `templates/super-ralph-config.toml` (add `[cli]` section)
- Modify: `.super-ralph/config.toml` (add `[cli]` section with real path)

**Step 1: Add `cli` property to LoopConfig in `src/types.ts`**

After the `opencode` property, add:
```typescript
  cli: {
    path: string;
  };
```

**Step 2: Add default and merge in `src/config.ts`**

In `DEFAULT_CONFIG`, add after `opencode`:
```typescript
  cli: {
    path: "",
  },
```

In the `loadConfig` return object, add after `opencode`:
```typescript
    cli: {
      ...DEFAULT_CONFIG.cli,
      ...(parsed.cli as Record<string, unknown> || {}),
    },
```

**Step 3: Add `[cli]` to template config**

Append to `templates/super-ralph-config.toml`:
```toml

[cli]
# Absolute path to the super-ralph CLI entry point (set by /superralph:init)
path = ""
```

**Step 4: Add `[cli]` to project config**

Append to `.super-ralph/config.toml`:
```toml

[cli]
path = "/Users/mat/dev/farsight/agent-framework/src/index.ts"
```

**Step 5: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add src/types.ts src/config.ts templates/super-ralph-config.toml .super-ralph/config.toml
git commit -m "feat: add cli.path to config for in-agent execution"
```

---

### Task 2: Make `doctor` print actionable fix commands

**Files:**
- Modify: `src/index.ts` (rewrite `cmdDoctor`)

**Step 1: Add bun check at the start of `cmdDoctor`**

Before the `br` check, add:
```typescript
  // Check bun (we're running in it, so this is informational)
  try {
    const proc = Bun.spawn(["bun", "--version"], { stdout: "pipe", stderr: "pipe" });
    const stdout = await new Response(proc.stdout).text();
    await proc.exited;
    console.log(`✓ bun: ${stdout.trim()}`);
  } catch {
    console.log("✗ bun: not found");
    console.log('  Fix: curl -fsSL https://bun.sh/install | bash');
    allGood = false;
  }
```

**Step 2: Add fix commands to existing failing checks**

For each existing check that fails, add a `console.log('  Fix: ...')` line:

- br CLI: `  Fix: curl -fsSL "https://raw.githubusercontent.com/Dicklesworthstone/beads_rust/main/install.sh?$(date +%s)" | bash`
- Project not initialized: `  Fix: /superralph:init`
- Prompt template missing: `  Fix: /superralph:init`
- Config not found: `  Fix: /superralph:init`
- OpenCode server not reachable: `  Fix: opencode serve --port 4096`
- Plugin missing: `  Fix: /superralph:init`

**Step 3: Add `.beads/` workspace check**

After the plugin check, add:
```typescript
  if (existsSync(join(projectDir, ".beads"))) {
    console.log("✓ Beads workspace (.beads/)");
  } else {
    console.log("✗ Beads workspace not initialized");
    console.log("  Fix: br init");
    allGood = false;
  }
```

**Step 4: Add `cli.path` validation**

After loading config, check that `cli.path` is set and the file exists:
```typescript
  if (config.cli.path && existsSync(config.cli.path)) {
    console.log(`✓ CLI path: ${config.cli.path}`);
  } else if (config.cli.path) {
    console.log(`✗ CLI path not found: ${config.cli.path}`);
    console.log("  Fix: /superralph:init to re-detect");
    allGood = false;
  } else {
    console.log("⚠ CLI path not set in config");
    console.log("  Fix: /superralph:init to set [cli] path");
  }
```

**Step 5: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 6: Test doctor**

Run: `bun run src/index.ts doctor`
Expected: All checks pass with the new additions shown.

**Step 7: Commit**

```bash
git add src/index.ts
git commit -m "feat: make doctor print actionable fix commands for each failing check"
```

---

### Task 3: Update init skill

**Files:**
- Modify: `skills/super-ralph-init/SKILL.md`

**Step 1: Add prerequisite validation step**

After the existing Step 1 (check for existing .super-ralph), insert a new step that validates `bun` and `br` are installed. If either is missing, print the install command and offer to run it. Stop if the user declines.

**Step 2: Update config creation step**

In the config creation step (Step 4), add logic to detect cli_path:
- Resolve `~/.agents/super-ralph/src/index.ts` to an absolute path
- Write it to the `[cli]` section of the config
- Confirm with the user

**Step 3: Add beads workspace initialization**

After creating the .super-ralph directory, add a step to run `br init` if `.beads/` doesn't exist.

**Step 4: Update checklist and report**

Add new checklist items for prerequisite validation, cli_path, and .beads/.
Update the completion report to show cli_path and beads workspace status.

**Step 5: Commit**

```bash
git add skills/super-ralph-init/SKILL.md
git commit -m "feat: add prereq validation, cli_path detection, beads init to init skill"
```

---

### Task 4: Update all PRD skill launch wizards

**Files:**
- Modify: `skills/feature-prd/SKILL.md`
- Modify: `skills/bug-prd/SKILL.md`
- Modify: `skills/hotfix-prd/SKILL.md`
- Modify: `skills/refactor-prd/SKILL.md`

**Step 1: For each file, make these replacements:**

1. Replace all occurrences of `npx super-ralph run` with `bun run <cli_path> run`
2. Replace all occurrences of `npx super-ralph status` with `bun run <cli_path> status`
3. Add a preamble before the launch wizard options: "Read `cli_path` from `.super-ralph/config.toml` (the `[cli] path` field). If not set, error and tell the user to run `/superralph:init`."
4. Change "Run headless" option name to "Run now"
5. Change post-completion reminders from `npx super-ralph run --epic <ID>` to `/superralph:resume`

Note: `skills/plan-prd/SKILL.md` has no launch wizard — skip it.

**Step 2: Commit**

```bash
git add skills/feature-prd/SKILL.md skills/bug-prd/SKILL.md skills/hotfix-prd/SKILL.md skills/refactor-prd/SKILL.md
git commit -m "feat: update launch wizards to use bun run cli_path instead of npx"
```

---

### Task 5: Update resume command

**Files:**
- Modify: `commands/superralph:resume.md`

**Step 1: Add config read step**

Before the "offer three options" step, add: "Read `cli_path` from `.super-ralph/config.toml` (the `[cli] path` field). If not set, error and tell the user to run `/superralph:init`."

**Step 2: Replace npx references**

Replace `npx super-ralph run` with `bun run <cli_path> run` in all three options and the recommended command format.

**Step 3: Fix the `br list --parent` bug**

The resume command currently uses `br list --parent <epicId> --json` which doesn't exist. Update to use `br ready --parent <epicId> --json` for finding the next ready bead, and `br show <epicId> --json` + counting dependents for progress.

**Step 4: Commit**

```bash
git add commands/superralph:resume.md
git commit -m "feat: update resume command to use bun run cli_path, fix br list --parent"
```

---

### Task 6: Update README

**Files:**
- Modify: `README.md`

**Step 1: Add Prerequisites section**

After the intro, add:
```markdown
## Prerequisites

- [OpenCode](https://opencode.ai) — AI coding agent
- [bun](https://bun.sh) — JavaScript runtime
- [br](https://github.com/Dicklesworthstone/beads_rust) — beads CLI for task tracking
```

**Step 2: Update Per-Project Setup**

Add bullet points for prerequisite validation, cli_path auto-detection, and .beads/ initialization.

**Step 3: Update Phase 2 section**

Replace `npx super-ralph run` with the explanation that execution happens from inside OpenCode via the launch wizard. Show the manual CLI command as an advanced option.

**Step 4: Commit**

```bash
git add README.md
git commit -m "docs: update README with prerequisites, in-agent execution flow"
```

---

### Task 7: Verify and push

**Step 1: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 2: Run doctor**

Run: `bun run src/index.ts doctor`
Expected: All checks pass

**Step 3: Run dry-run**

Run: `bun run src/index.ts run --epic bd-3fk --dry-run`
Expected: Shows epic info without connecting to server

**Step 4: Push**

```bash
git push
```
