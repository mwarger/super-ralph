# Task Manager

A simple in-memory task manager library for managing TODO items.

## Features

- Create, update, and delete tasks
- Filter tasks by status (pending, in_progress, done)
- Priority-based sorting (critical, high, medium, low)
- Due date tracking with overdue detection
- Tag-based categorization and filtering
- Task statistics and summary reports

## Usage

```typescript
import { TaskManager } from "./task-manager";

const tm = new TaskManager();
tm.addTask({ title: "Write tests", priority: "high", tags: ["dev"] });
tm.addTask({ title: "Deploy", priority: "critical", dueDate: new Date("2026-03-01") });

const urgent = tm.getOverdueTasks();
const stats = tm.getStats();
```

## Architecture

- `types.ts` — shared type definitions
- `task-manager.ts` — main TaskManager class
- `filters.ts` — filtering and sorting utilities
- `stats.ts` — statistics and reporting
- `validators.ts` — input validation

## Status

Core CRUD operations work. Filtering is partially implemented. Stats module is stubbed out.
Validation is missing entirely.
