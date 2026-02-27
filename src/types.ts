// Bead information from br CLI
export interface BeadInfo {
  id: string;
  title: string;
  description?: string;
  status: "open" | "in_progress" | "closed";
  labels: string[];
  priority: number; // 0-4 (0 = critical)
  dependsOn: string[];
  blocks: string[];
  type?: string; // epic, task, etc.
  parentId?: string;
}

// Loop configuration from .super-ralph/config.toml
export interface LoopConfig {
  engine: {
    timeout_minutes: number;
    inactivity_timeout_seconds: number;
    iteration_delay_ms: number;
    strategy: ErrorStrategy;
    max_retries: number;
  };
  opencode: {
    url: string;
  };
  cli: {
    path: string;
  };
  models: {
    default: string;
    [key: string]: string; // alias -> provider/model
  };
  modelsAreas: {
    [key: string]: string; // area name -> provider/model
  };
  reverse: {
    output_dir: string;
  };
  decompose: {
    include_review: boolean;
    include_bugscan: boolean;
    include_audit: boolean;
  };
}

// Result of a single iteration
export interface IterationResult {
  iteration: number;
  beadId: string;
  beadTitle: string;
  status: "complete" | "phase_done" | "blocked" | "failed" | "stalled" | "timeout" | "error";
  reason?: string;
  model: string;
  duration: number; // milliseconds
  cost?: number;
  tokens?: { input: number; output: number; reasoning: number };
  filesChanged?: string[];
  transcriptPath?: string;
}

// Completion result from OpenCode session
export interface CompletionResult {
  status: "complete" | "phase_done" | "blocked" | "failed" | "stalled" | "timeout" | "error";
  reason?: string;
}

// Overall loop result
export interface LoopResult {
  completed: number;
  failed: number;
  skipped: number;
  totalTime: number; // milliseconds
  maxIterations: number;
  iterations: IterationResult[];
}

// Common flags shared by all three phases
export interface PhaseFlags {
  dryRun: boolean;
  maxIterations?: number;
  modelOverride?: string;
  attach?: string; // URL to attach to existing OpenCode server instead of spawning one
}

export interface ForwardFlags extends PhaseFlags {
  epicId: string;
}

export interface DecomposeFlags extends PhaseFlags {
  specPath: string;
  epicTitle?: string;
}

export interface ReverseFlags extends PhaseFlags {
  inputs: string[];         // paths, URLs, descriptions — anything (positional args)
  outputDir?: string;
  skill?: string;           // --skill <name-or-path> — question bank
  interactive?: boolean;    // --interactive — force interactive mode (default when no inputs)
  answersFile?: string;     // --answers <path> — JSON file with pre-recorded answers for non-interactive testing
}

export type ErrorStrategy = "retry" | "skip" | "abort";
