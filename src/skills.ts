import { existsSync, readFileSync } from "fs";
import { join, isAbsolute, resolve } from "path";

const BUILT_IN_SKILLS = ["feature", "bug", "hotfix", "refactor"];

/**
 * Resolve a skill name or path to its content.
 *
 * - "feature" -> reads skills/feature.md from the super-ralph install
 * - "/path/to/custom.md" -> reads the file at that path  
 * - undefined -> returns null (agent infers from context)
 */
export function loadSkill(skillNameOrPath: string | undefined, cliDir: string): string | null {
  if (!skillNameOrPath) return null;

  // Check if it's a built-in skill name
  if (BUILT_IN_SKILLS.includes(skillNameOrPath)) {
    const skillPath = join(cliDir, "skills", `${skillNameOrPath}.md`);
    if (!existsSync(skillPath)) {
      throw new Error(`Built-in skill '${skillNameOrPath}' not found at ${skillPath}`);
    }
    return readFileSync(skillPath, "utf-8");
  }

  // Treat as a file path
  const resolvedPath = isAbsolute(skillNameOrPath) ? skillNameOrPath : resolve(skillNameOrPath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`Skill file not found: ${resolvedPath}`);
  }
  return readFileSync(resolvedPath, "utf-8");
}

/**
 * Get the directory where the super-ralph CLI lives.
 * This is needed to resolve built-in skill files.
 */
export function getCliDir(): string {
  const url = new URL(".", import.meta.url);
  // Go up from src/ to the project root
  return resolve(url.pathname, "..");
}
