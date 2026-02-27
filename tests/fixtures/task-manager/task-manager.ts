// Main TaskManager class — core CRUD operations

import type { Task, CreateTaskInput, UpdateTaskInput, Status } from "./types";
import { filterTasks, sortTasks } from "./filters";
import type { FilterOptions, SortOptions } from "./types";

let nextId = 1;

function generateId(): string {
  return `task-${nextId++}`;
}

export class TaskManager {
  private tasks: Map<string, Task> = new Map();

  addTask(input: CreateTaskInput): Task {
    const now = new Date();
    const task: Task = {
      id: generateId(),
      title: input.title,
      description: input.description,
      status: "pending",
      priority: input.priority || "medium",
      tags: input.tags || [],
      createdAt: now,
      updatedAt: now,
      dueDate: input.dueDate,
    };
    this.tasks.set(task.id, task);
    return task;
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  updateTask(id: string, input: UpdateTaskInput): Task {
    const task = this.tasks.get(id);
    if (!task) {
      // BUG: wrong error type — should be a proper Error, not a string throw
      throw `Task not found: ${id}`;
    }

    if (input.title !== undefined) task.title = input.title;
    if (input.description !== undefined) task.description = input.description;
    if (input.priority !== undefined) task.priority = input.priority;
    if (input.tags !== undefined) task.tags = input.tags;
    if (input.dueDate !== undefined) task.dueDate = input.dueDate;

    if (input.status !== undefined) {
      task.status = input.status;
      // BUG: completedAt is never set when status changes to "done"
    }

    task.updatedAt = new Date();
    return task;
  }

  deleteTask(id: string): boolean {
    return this.tasks.delete(id);
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  getTasksByStatus(status: Status): Task[] {
    return this.getAllTasks().filter(t => t.status === status);
  }

  // Uses the filter module
  filter(options: FilterOptions): Task[] {
    return filterTasks(this.getAllTasks(), options);
  }

  // Uses the filter module
  sort(options: SortOptions): Task[] {
    return sortTasks(this.getAllTasks(), options);
  }

  getOverdueTasks(): Task[] {
    const now = new Date();
    return this.getAllTasks().filter(t =>
      t.dueDate && t.dueDate < now && t.status !== "done"
    );
  }

  // Clears all tasks — useful for testing
  clear(): void {
    this.tasks.clear();
  }
}
