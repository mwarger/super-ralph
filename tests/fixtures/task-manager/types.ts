// Task Manager type definitions

export type Priority = "critical" | "high" | "medium" | "low";
export type Status = "pending" | "in_progress" | "done";

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: Status;
  priority: Priority;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
  completedAt?: Date;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: Priority;
  tags?: string[];
  dueDate?: Date;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: Status;
  priority?: Priority;
  tags?: string[];
  dueDate?: Date;
}

export interface TaskStats {
  total: number;
  byStatus: Record<Status, number>;
  byPriority: Record<Priority, number>;
  overdue: number;
  completedThisWeek: number;
  avgCompletionTimeMs: number;
}

export interface FilterOptions {
  status?: Status;
  priority?: Priority;
  tags?: string[];
  overdue?: boolean;
}

export interface SortOptions {
  field: "priority" | "dueDate" | "createdAt" | "title";
  direction: "asc" | "desc";
}
