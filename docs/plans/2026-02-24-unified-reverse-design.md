# Unified Reverse Phase Design

## Problem

The framework has accumulated layers: slash commands, skills, a plugin, symlinks, INSTALL docs — all to support interactive planning inside agent sessions. But the spec-first architecture already moved execution to the terminal. The slash commands now just produce specs and print "run decompose in your terminal." They're a thin wrapper around what the reverse phase could do directly.

Meanwhile, the reverse phase is underutilized — it only handles file/URL inputs autonomously. It can't do interactive interviews, doesn't leverage domain-specific question banks, and doesn't produce superpowers-quality output.

## Design

### Core Change

Collapse the planning phase into reverse. The reverse phase becomes the universal entry point that handles any input — including no input at all (interactive interview). Slash commands, skills, and the plugin are deleted entirely.

### The Three-Command Framework

```
super-ralph init                          # scaffold .super-ralph/
super-ralph reverse [inputs...] [flags]   # any input -> spec
super-ralph decompose --spec <path>       # spec -> beads
super-ralph forward --epic <ID>           # beads -> code
super-ralph status --epic <ID>            # progress check
super-ralph doctor                        # verify prerequisites
```

Everything else is deleted. No slash commands, no skill ecosystem, no plugin, no global symlinks.

### Reverse CLI Interface

```
super-ralph reverse [inputs...] [--skill <name-or-path>] [--interactive] [--output <dir>] [--model ...] [--max-iterations N] [--dry-run]
```

Inputs are positional — everything after `reverse` that isn't a flag is an input. Inputs can be file paths, URLs, plain text descriptions, images, or anything else. The agent figures out what each input is.

**Mode detection:**
- No inputs and no `--interactive` -> interactive mode (implied)
- Inputs without `--interactive` -> autonomous mode
- Inputs with `--interactive` -> mixed mode (start with inputs, ask follow-up questions)
- `--interactive` without inputs -> interactive mode, no seed context

**Skill flag:** `--skill feature` resolves to built-in question bank. `--skill /path/to/file.md` loads custom. No flag means the agent infers from context.

**Examples:**
```
super-ralph reverse                                          # pure interview
super-ralph reverse --skill feature                          # interview with feature questions
super-ralph reverse "build a calendly clone"                 # autonomous from description
super-ralph reverse ./src/ "refactor auth to use JWT"        # autonomous from code + description
super-ralph reverse mockup.png --interactive --skill feature # mixed: screenshot + interview
super-ralph reverse https://github.com/calcom/cal.com "clone this"  # autonomous from repo
```

### Interactive Mode — Superpowers Quality

Interactive mode replicates the superpowers brainstorming experience. Quality comes from structural constraints encoded in the reverse template, informed by studying the superpowers skill corpus.

**Key patterns from superpowers applied to the reverse template:**
- **Hard gate:** No spec content until context explored AND interrogation complete AND approach approved
- **Iron law:** "Every project goes through this process. 'Too simple' is where the most wasted work comes from."
- **Anti-rationalization:** Red flags list for when the agent wants to skip interrogation
- **Incremental validation:** Present design section by section with approval at each step
- **One question at a time:** Prevent assumption-stacking and shallow answers
- **Multiple choice preferred:** Reduce cognitive load on the human
- **Adaptive depth:** Scale to complexity — dig deeper on ambiguity, move on when clear

**Interactive process (two internal phases):**

Phase A — Interrogation:
1. Explore project context (codebase, README, existing docs, any provided inputs)
2. If a skill file is loaded, use its question bank to guide interrogation
3. Ask one question at a time using OpenCode's `question` tool
4. Adapt depth: dig deeper on ambiguity, skip when clear
5. Signal readiness to synthesize

Phase B — Synthesis:
1. Propose 2-3 approaches with trade-offs and a recommendation
2. Present design section by section with approval checkpoints
3. Write the spec and save to output directory

### Interactive Mechanics — OpenCode Question Tool + @clack/prompts

The agent uses OpenCode's `question` tool for all structured interaction. This provides:
- Arrow-key selection for multiple choice
- Labeled options with descriptions
- Always-on "Type your own answer" custom input
- Multi-select support
- Number key shortcuts (1-9) for quick selection

The CLI intercepts `question.asked` events from the OpenCode SDK and renders them using `@clack/prompts`:
- Single-select -> `select()` with custom input option appended
- Multi-select -> `multiselect()` with custom input option
- Custom input selected -> follows up with `text()` prompt
- Answers returned as `string[]` (array of selected labels)

For non-question output (design sections, analysis, progress):
- Agent sends regular text responses
- CLI renders markdown in the terminal (bold, colors, lists)
- For design sections needing approval, agent uses `question` tool with "Looks right" / "Needs revision" options

Lifecycle:
- CLI starts OpenCode server, creates session with system prompt + reverse template
- Runs interactive loop: agent responds -> CLI renders -> user answers -> loop
- On `task_complete(phase_done)`: prints spec location, prints decompose command, exits 0
- On Ctrl+C: graceful shutdown

### Autonomous Mode — Research-Driven Synthesis

For autonomous mode (inputs provided, no `--interactive`), the agent runs the existing iterative loop but with enhanced research behavior.

**Template guidance for autonomous mode:**
- Before synthesizing, deeply understand the subject
- If an input is a URL, fetch and analyze it
- If it references a product or service, research it
- If there's a local codebase, explore patterns, tech stack, architecture
- Don't guess — investigate
- Each iteration should meaningfully improve the spec
- Self-check: is every requirement specific enough for decompose? Are architecture decisions made?

### Skill Files (Question Banks)

Built-in skills become lightweight question bank files (~10-35 lines each). They provide domain-specific guidance, not workflow control. The reverse template handles the process.

**Resolution:** `--skill feature` resolves to `skills/feature.md`. `--skill /path/to/custom.md` loads a custom file. No flag means the agent infers.

**Built-in skills:**
- `skills/feature.md` (~35 lines) — business interrogation (why, who, success criteria, boundaries, risks) + technical deep-dive (existing code, data model, integration points, edge cases, performance, testing)
- `skills/bug.md` (~20 lines) — investigation (what's the bug, when, impact, root cause, blast radius) + technical (edge cases, data implications, test gaps)
- `skills/hotfix.md` (~10 lines) — minimal (what's broken, impact, what's the fix)
- `skills/refactor.md` (~35 lines) — architecture (pain, desired state, invariants, migration path, coupling, rollback) + technical (patterns, test coverage, parallelization)

All skills include: "Check `.super-ralph/intake-checklist.md` if it exists for learned questions from past epics."

### Init as a CLI Command

`super-ralph init` becomes a non-interactive CLI command:
1. Creates `.super-ralph/` directory
2. Copies templates (forward.hbs, decompose.hbs, reverse.hbs)
3. Creates config.toml with defaults
4. Creates AGENTS.md and progress.md
5. Initializes beads workspace (`br init`)
6. Reports what it did

No interactive questions. User edits config.toml directly for customization.

### What Gets Deleted

- `commands/` — all 7 slash command files
- `skills/feature-prd/`, `skills/bug-prd/`, `skills/hotfix-prd/`, `skills/refactor-prd/`, `skills/plan-prd/` — replaced by question bank files
- `skills/super-ralph-init/` — replaced by `cmdInit()` in index.ts
- `.opencode/plugins/super-ralph.js` — no plugin needed
- `.opencode/INSTALL.md`, `.claude/INSTALL.md`, `.codex/INSTALL.md` — no global install
- Global symlinks in `~/.config/opencode/` — skills, commands, plugin all removed
- The concept of "install super-ralph with symlinks" — just clone and run

### What Ships

- TypeScript CLI (`src/`)
- Phase templates (`templates/reverse.hbs`, `decompose.hbs`, `forward.hbs`)
- Question bank skills (`skills/feature.md`, `bug.md`, `hotfix.md`, `refactor.md`)
- Per-project config template (`templates/config.toml`, `agents.md`)
- E2E tests (`tests/`)

### Installation

```
git clone https://github.com/mwarger/super-ralph.git ~/.agents/super-ralph
cd ~/.agents/super-ralph && bun install
```

Then in any project: `super-ralph init` to scaffold, `super-ralph reverse` to start.

## Risks

- **Interactive mode complexity** — building the SDK relay + @clack/prompts rendering is new engineering. The question tool interception needs to work reliably.
- **Template quality** — the reverse template carries all the process intelligence that used to live in 2,300+ lines of skills. Getting it right is critical.
- **Loss of discoverability** — slash commands showed users what was available. CLI-only means users need to know `super-ralph reverse --skill feature` exists. Mitigation: `super-ralph help` and `super-ralph reverse --help` with good examples.
- **Agent inference without --skill** — when no skill is provided, the agent needs to infer the right interrogation depth from context alone. This may produce inconsistent quality. Mitigation: the template should include a baseline question set that always applies.
