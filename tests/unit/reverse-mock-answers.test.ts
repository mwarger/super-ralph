import { describe, it, expect } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { runReverse } from "../../src/reverse";
import { clearMockAnswers, hasMockAnswersLoaded, loadMockAnswers } from "../../src/interactive";

function withTempProject(run: (projectDir: string) => Promise<void> | void): Promise<void> {
  const projectDir = mkdtempSync(join(tmpdir(), "super-ralph-reverse-"));
  mkdirSync(join(projectDir, ".super-ralph"), { recursive: true });
  writeFileSync(join(projectDir, ".super-ralph", "reverse.hbs"), "Reverse dry-run template");

  return Promise.resolve()
    .then(() => run(projectDir))
    .finally(() => {
      rmSync(projectDir, { recursive: true, force: true });
      clearMockAnswers();
    });
}

describe("reverse interactive mock answer state", () => {
  it("clears previously loaded mock answers when --answers is not provided", async () => {
    await withTempProject(async (projectDir) => {
      const answersPath = join(projectDir, "answers.json");
      writeFileSync(answersPath, JSON.stringify([{ match: "scope", answer: "small" }]) + "\n");

      loadMockAnswers(answersPath);
      expect(hasMockAnswersLoaded()).toBe(true);

      await runReverse(projectDir, {
        inputs: [],
        interactive: true,
        dryRun: true,
      });

      expect(hasMockAnswersLoaded()).toBe(false);
    });
  });
});
