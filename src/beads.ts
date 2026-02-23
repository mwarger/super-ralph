import type { BeadInfo } from "./types.js";

// Run a br CLI command and return parsed JSON
async function runBr(args: string[], cwd?: string): Promise<unknown> {
  const proc = Bun.spawn(["br", ...args], {
    cwd: cwd || process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`br ${args.join(" ")} failed (exit ${exitCode}): ${stderr}`);
  }

  // Filter out log lines (br outputs INFO/WARN lines to stdout before JSON in some cases)
  // JSON output may be pretty-printed across multiple lines, so find the first line
  // that starts a JSON array or object, then take everything from there onwards.
  const lines = stdout.trim().split("\n");
  const jsonStartIdx = lines.findIndex((line) => line.startsWith("[") || line.startsWith("{"));
  if (jsonStartIdx === -1) {
    // Empty result is valid (e.g., no ready beads)
    return [];
  }

  const jsonStr = lines.slice(jsonStartIdx).join("\n");
  return JSON.parse(jsonStr);
}

// Map br's snake_case JSON to our BeadInfo type
function mapBead(raw: Record<string, unknown>): BeadInfo {
  return {
    id: raw.id as string,
    title: raw.title as string,
    description: (raw.description as string) || undefined,
    status: mapStatus(raw.status as string),
    labels: (raw.labels as string[]) || [],
    priority: (raw.priority as number) || 3,
    dependsOn: (raw.depends_on as string[]) || (raw.dependsOn as string[]) || [],
    blocks: (raw.blocks as string[]) || [],
    type: (raw.type as string) || undefined,
    parentId: (raw.parent_id as string) || (raw.parentId as string) || undefined,
  };
}

function mapStatus(status: string): BeadInfo["status"] {
  switch (status) {
    case "open":
      return "open";
    case "in_progress":
    case "in-progress":
      return "in_progress";
    case "closed":
    case "done":
    case "completed":
      return "closed";
    default:
      return "open";
  }
}

// Get the next ready (unblocked) bead in an epic
export async function getNextReady(epicId: string): Promise<BeadInfo | null> {
  const result = await runBr(["ready", "--parent", epicId, "--json", "--limit", "1", "--sort", "hybrid"]);
  const beads = result as Record<string, unknown>[];
  if (!beads || beads.length === 0) return null;
  return mapBead(beads[0]);
}

// Get full details for a specific bead
export async function getBeadDetails(beadId: string): Promise<BeadInfo> {
  const result = await runBr(["show", beadId, "--json"]);
  // br show returns a single object (or array with one element)
  const raw = Array.isArray(result) ? result[0] : result;
  return mapBead(raw as Record<string, unknown>);
}

// Close a bead and get newly unblocked beads
export async function closeBead(beadId: string, reason?: string): Promise<{ suggestNext: BeadInfo[] }> {
  const args = ["close", beadId, "--suggest-next", "--json"];
  if (reason) {
    args.push("--reason", reason);
  }
  const result = await runBr(args);
  // The suggest-next output format may vary — handle both array and object
  const raw = result as Record<string, unknown> | Record<string, unknown>[];
  if (Array.isArray(raw)) {
    return { suggestNext: raw.map(mapBead) };
  }
  // If it returns an object with a suggestions/next field
  const suggestions = (raw.suggest_next || raw.suggestNext || raw.suggestions || []) as Record<string, unknown>[];
  return { suggestNext: Array.isArray(suggestions) ? suggestions.map(mapBead) : [] };
}

// Get all beads in an epic
// Uses `br show` to get child IDs from the dependents array, then `br list --id` to get full details
export async function getAllBeads(epicId: string): Promise<BeadInfo[]> {
  // First, get the epic to extract child IDs from its dependents
  const epicResult = await runBr(["show", epicId, "--json"]);
  const epicRaw = Array.isArray(epicResult) ? epicResult[0] : epicResult;
  const epic = epicRaw as Record<string, unknown>;

  const dependents = (epic.dependents || []) as Record<string, unknown>[];
  const childIds = dependents
    .filter((d) => d.dependency_type === "parent-child")
    .map((d) => d.id as string);

  if (childIds.length === 0) return [];

  // Fetch full details for all children using --id filters
  const args = ["list", "--all", "--json"];
  for (const id of childIds) {
    args.push("--id", id);
  }
  const result = await runBr(args);
  const beads = result as Record<string, unknown>[];
  return beads.map(mapBead);
}

// Get epic progress summary
export async function getEpicProgress(epicId: string): Promise<{ total: number; completed: number; remaining: number }> {
  const beads = await getAllBeads(epicId);
  const completed = beads.filter((b) => b.status === "closed").length;
  return {
    total: beads.length,
    completed,
    remaining: beads.length - completed,
  };
}
