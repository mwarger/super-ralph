import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { parse as parseTOML } from "@iarna/toml";
import type { LoopConfig, ErrorStrategy } from "./types.js";

const DEFAULT_CONFIG: LoopConfig = {
  engine: {
    timeout_minutes: 30,
    iteration_delay_ms: 2000,
    strategy: "retry",
    max_retries: 3,
  },
  opencode: {
    url: "http://localhost:4096",
  },
  cli: {
    path: "",
  },
  models: {
    default: "anthropic/claude-sonnet-4-6",
  },
  modelsAuto: {
    review: "default",
    audit: "default",
    bugscan: "default",
  },
};

export function loadConfig(projectDir: string): LoopConfig {
  const configPath = join(projectDir, ".super-ralph", "config.toml");
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  
  const raw = readFileSync(configPath, "utf-8");
  const parsed = parseTOML(raw);
  
  // Deep merge with defaults
  return {
    engine: {
      ...DEFAULT_CONFIG.engine,
      ...(parsed.engine as Record<string, unknown> || {}),
      strategy: ((parsed.engine as Record<string, unknown>)?.strategy as ErrorStrategy) || DEFAULT_CONFIG.engine.strategy,
    },
    opencode: {
      ...DEFAULT_CONFIG.opencode,
      ...(parsed.opencode as Record<string, unknown> || {}),
    },
    cli: {
      ...DEFAULT_CONFIG.cli,
      ...(parsed.cli as Record<string, unknown> || {}),
    },
    models: {
      ...DEFAULT_CONFIG.models,
      ...(parsed.models as Record<string, string> || {}),
    },
    modelsAuto: {
      ...DEFAULT_CONFIG.modelsAuto,
      ...((parsed.models as Record<string, unknown>)?.auto as Record<string, string> || {}),
    },
  };
}

export function resolveModel(
  beadLabels: string[],
  beadTitle: string,
  config: LoopConfig,
  cliOverride?: string
): { providerID: string; modelID: string } {
  let modelString: string;
  
  // Priority 1: CLI override
  if (cliOverride) {
    modelString = cliOverride;
  } else {
    // Priority 2: Bead label (model:alias or model:provider/model)
    const modelLabel = beadLabels.find((l) => l.startsWith("model:"));
    if (modelLabel) {
      const alias = modelLabel.slice(6); // strip "model:"
      modelString = config.models[alias] || alias;
    } else {
      // Priority 3: Auto-assignment by bead type
      const titleLower = beadTitle.toLowerCase();
      if (titleLower.startsWith("review")) {
        modelString = config.models[config.modelsAuto.review] || config.modelsAuto.review;
      } else if (titleLower.startsWith("audit")) {
        modelString = config.models[config.modelsAuto.audit] || config.modelsAuto.audit;
      } else if (titleLower.startsWith("bugscan")) {
        modelString = config.models[config.modelsAuto.bugscan] || config.modelsAuto.bugscan;
      } else {
        // Priority 4: Default
        modelString = config.models.default;
      }
    }
  }
  
  // Resolve "default" alias
  if (modelString === "default") {
    modelString = config.models.default;
  }
  
  // Also resolve other aliases (e.g., "opus" -> "anthropic/claude-opus-4-6")
  if (config.models[modelString]) {
    modelString = config.models[modelString];
  }
  
  // Parse provider/model format
  const slashIndex = modelString.indexOf("/");
  if (slashIndex === -1) {
    throw new Error(`Invalid model format "${modelString}" — expected "provider/model" (e.g., "anthropic/claude-sonnet-4-6")`);
  }
  
  return {
    providerID: modelString.slice(0, slashIndex),
    modelID: modelString.slice(slashIndex + 1),
  };
}

export function mergeCliFlags(
  config: LoopConfig,
  flags: Record<string, unknown>
): LoopConfig {
  return {
    ...config,
    engine: {
      ...config.engine,
      ...(flags.timeout !== undefined && { timeout_minutes: flags.timeout as number }),
      ...(flags.strategy !== undefined && { strategy: flags.strategy as ErrorStrategy }),
      ...(flags.maxRetries !== undefined && { max_retries: flags.maxRetries as number }),
    },
  };
}
