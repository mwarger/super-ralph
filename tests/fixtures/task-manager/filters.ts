// Filtering and sorting utilities for tasks

import type { Task, FilterOptions, SortOptions, Priority } from "./types";

const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function filterTasks(tasks: Task[], options: FilterOptions): Task[] {
  let result = [...tasks];

  if (options.status) {
    result = result.filter(t => t.status === options.status);
  }

  if (options.priority) {
    result = result.filter(t => t.priority === options.priority);
  }

  if (options.tags && options.tags.length > 0) {
    // BUG: uses AND logic but should use OR — checks if task has ALL tags
    // instead of ANY tag. README says "tag-based filtering" without specifying,
    // but OR is the standard expectation for tag filters.
    result = result.filter(t =>
      options.tags!.every(tag => t.tags.includes(tag))
    );
  }

  if (options.overdue) {
    const now = new Date();
    result = result.filter(t =>
      t.dueDate && t.dueDate < now && t.status !== "done"
    );
  }

  return result;
}

export function sortTasks(tasks: Task[], options: SortOptions): Task[] {
  const sorted = [...tasks];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (options.field) {
      case "priority":
        comparison = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        break;
      case "dueDate":
        // BUG: tasks without dueDate crash with TypeError when comparing
        // because undefined - undefined = NaN, and the sort becomes unstable
        comparison = (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0);
        break;
      case "createdAt":
        comparison = a.createdAt.getTime() - b.createdAt.getTime();
        break;
      case "title":
        comparison = a.title.localeCompare(b.title);
        break;
    }

    return options.direction === "desc" ? -comparison : comparison;
  });

  return sorted;
}

// TODO: Add groupBy function for grouping tasks by a field
// TODO: Add search function for full-text search across title and description
