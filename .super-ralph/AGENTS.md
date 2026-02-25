# Super-Ralph SDLC Framework

CLI commands:
  super-ralph init                              Scaffold .super-ralph/ in current project
  super-ralph reverse [inputs...] [--skill ...] Input -> spec (interactive or autonomous)
  super-ralph decompose --spec <path>           Spec -> beads
  super-ralph forward --epic <ID>               Beads -> code
  super-ralph status --epic <ID>                Show progress
  super-ralph doctor                            Preflight checks
  super-ralph help                              Show all options

Quality gates:
  bun run typecheck

Config: .super-ralph/config.toml
Templates: .super-ralph/forward.hbs, decompose.hbs, reverse.hbs
Progress log: .super-ralph/progress.md
