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
  modelsAreas: {},
  reverse: {
    output_dir: "docs/specs",
  },
  decompose: {
    include_review: true,
    include_bugscan: true,
    include_audit: true,
  },
};

export function loadConfig(projectDir: string): LoopConfig {
  const configPath = join(projectDir, ".super-ralph", "config.toml");
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  
  const raw = readFileSync(configPath, "utf-8");
  const parsed = parseTOML(raw);
  
  // Extract models, separating the nested areas sub-object from flat model strings
  const parsedModels = (parsed.models || {}) as Record<string, unknown>;
  const parsedAreas = (parsedModels.areas || {}) as Record<string, string>;

  // Build models without the areas sub-object (only flat string values)
  const flatModels: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsedModels)) {
    if (key !== "areas" && typeof value === "string") {
      flatModels[key] = value;
    }
  }

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
      ...flatModels,
    },
    modelsAreas: {
      ...parsedAreas,
    },
    reverse: {
      ...DEFAULT_CONFIG.reverse,
      ...((parsed.reverse as Record<string, unknown>) || {}),
    },
    decompose: {
      ...DEFAULT_CONFIG.decompose,
      ...((parsed.decompose as Record<string, unknown>) || {}),
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
    // Priority 2: Bead area label -> models.areas mapping
    const areaLabel = beadLabels.find((l) => l.startsWith("area:"));
    if (areaLabel) {
      const area = areaLabel.slice(5); // strip "area:"
      const areaModel = config.modelsAreas[area];
      if (areaModel) {
        modelString = areaModel;
      } else {
        // Fall through to default
        modelString = config.models.default;
      }
    } else {
      // Priority 3: Default
      modelString = config.models.default;
    }
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
