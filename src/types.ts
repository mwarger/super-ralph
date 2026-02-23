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
    iteration_delay_ms: number;
    strategy: ErrorStrategy;
    max_retries: number;
  };
  opencode: {
    url: string;
  };
  models: {
    default: string;
    [key: string]: string; // alias -> provider/model
  };
  modelsAuto: {
    review: string;
    audit: string;
    bugscan: string;
    [key: string]: string;
  };
}

// Result of a single iteration
export interface IterationResult {
  beadId: string;
  beadTitle: string;
  status: "complete" | "blocked" | "failed" | "stalled" | "timeout" | "error";
  reason?: string;
  model: string;
  duration: number; // milliseconds
  cost?: number;
  tokens?: { input: number; output: number; reasoning: number };
  filesChanged?: string[];
}

// Completion result from OpenCode session
export interface CompletionResult {
  status: "complete" | "blocked" | "failed" | "stalled" | "timeout" | "error";
  reason?: string;
}

// Overall loop result
export interface LoopResult {
  completed: number;
  failed: number;
  skipped: number;
  totalTime: number; // milliseconds
}

// CLI flags for the engine
export interface EngineFlags {
  dryRun: boolean;
  headless: boolean;
  maxIterations?: number;
  modelOverride?: string;
}

export type ErrorStrategy = "retry" | "skip" | "abort";
