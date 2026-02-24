import Handlebars from "handlebars";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { BeadInfo } from "./types.js";

export interface TemplateVars {
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  acceptanceCriteria: string;
  dependsOn: string;
  blocks: string;
  recentProgress: string;
  prdContent: string;
  selectionReason: string;
}

export function loadTemplate(projectDir: string, filename: string = "forward.hbs"): HandlebarsTemplateDelegate {
  const templatePath = join(projectDir, ".super-ralph", filename);
  if (!existsSync(templatePath)) {
    throw new Error(`Prompt template not found at ${templatePath}. Run 'super-ralph init' first.`);
  }
  const source = readFileSync(templatePath, "utf-8");
  return Handlebars.compile(source);
}

export function renderPrompt(template: HandlebarsTemplateDelegate, vars: Record<string, unknown>): string {
  return template(vars);
}

export function buildTemplateVars(
  bead: BeadInfo,
  recentProgress: string,
  prdContent?: string
): TemplateVars {
  // Extract acceptance criteria from description if present
  // Convention: description contains AC after "## Acceptance Criteria" or "### AC"
  const description = bead.description || "";
  let mainDescription = description;
  let acceptanceCriteria = "";
  
  const acMarkers = ["## Acceptance Criteria", "### Acceptance Criteria", "### AC", "## AC"];
  for (const marker of acMarkers) {
    const idx = description.indexOf(marker);
    if (idx !== -1) {
      mainDescription = description.slice(0, idx).trim();
      acceptanceCriteria = description.slice(idx).trim();
      break;
    }
  }
  
  return {
    taskId: bead.id,
    taskTitle: bead.title,
    taskDescription: mainDescription,
    acceptanceCriteria,
    dependsOn: bead.dependsOn.length > 0 ? bead.dependsOn.join(", ") : "none",
    blocks: bead.blocks.length > 0 ? bead.blocks.join(", ") : "none",
    recentProgress,
    prdContent: prdContent || "",
    selectionReason: `Next ready bead (priority ${bead.priority}, ${bead.dependsOn.length} deps satisfied)`,
  };
}
