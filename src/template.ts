import Handlebars from "handlebars";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

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
