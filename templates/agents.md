# Super-Ralph SDLC Framework

CLI commands:
  super-ralph forward --epic <ID>     Beads -> code
  super-ralph decompose --spec <path> Spec -> beads
  super-ralph reverse --input <path>  Input -> spec
  super-ralph status --epic <ID>      Show progress
  super-ralph doctor                  Preflight checks
  super-ralph help                    Show all options

Quality gates:
  bun run typecheck

Config: .super-ralph/config.toml
Templates: .super-ralph/forward.hbs, decompose.hbs, reverse.hbs
Progress log: .super-ralph/progress.md
