// Partial test suite — only covers basic CRUD, not filtering/sorting/stats

import { describe, it, expect, beforeEach } from "bun:test";
import { TaskManager } from "./task-manager";

describe("TaskManager", () => {
  let tm: TaskManager;

  beforeEach(() => {
    tm = new TaskManager();
  });

  describe("addTask", () => {
    it("creates a task with defaults", () => {
      const task = tm.addTask({ title: "Test task" });
      expect(task.title).toBe("Test task");
      expect(task.status).toBe("pending");
      expect(task.priority).toBe("medium");
      expect(task.tags).toEqual([]);
    });

    it("creates a task with all fields", () => {
      const due = new Date("2026-12-31");
      const task = tm.addTask({
        title: "Full task",
        description: "A complete task",
        priority: "high",
        tags: ["urgent", "dev"],
        dueDate: due,
      });
      expect(task.priority).toBe("high");
      expect(task.tags).toEqual(["urgent", "dev"]);
      expect(task.dueDate).toBe(due);
    });
  });

  describe("getTask", () => {
    it("returns the task by id", () => {
      const created = tm.addTask({ title: "Find me" });
      const found = tm.getTask(created.id);
      expect(found).toBeDefined();
      expect(found!.title).toBe("Find me");
    });

    it("returns undefined for unknown id", () => {
      expect(tm.getTask("nonexistent")).toBeUndefined();
    });
  });

  describe("updateTask", () => {
    it("updates title and priority", () => {
      const task = tm.addTask({ title: "Original" });
      const updated = tm.updateTask(task.id, { title: "Updated", priority: "critical" });
      expect(updated.title).toBe("Updated");
      expect(updated.priority).toBe("critical");
    });

    // NOTE: no test for completedAt being set when status -> done (this is a known bug)
    // NOTE: no test for error type when updating nonexistent task (also a bug)
  });

  describe("deleteTask", () => {
    it("removes the task", () => {
      const task = tm.addTask({ title: "Delete me" });
      expect(tm.deleteTask(task.id)).toBe(true);
      expect(tm.getTask(task.id)).toBeUndefined();
    });

    it("returns false for unknown id", () => {
      expect(tm.deleteTask("nonexistent")).toBe(false);
    });
  });

  describe("getTasksByStatus", () => {
    it("filters by status", () => {
      tm.addTask({ title: "A" });
      const b = tm.addTask({ title: "B" });
      tm.updateTask(b.id, { status: "done" });

      const pending = tm.getTasksByStatus("pending");
      expect(pending.length).toBe(1);
      expect(pending[0].title).toBe("A");
    });
  });
});
