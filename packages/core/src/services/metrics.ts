// Shared task bucketing and metric computation used by both the dashboard
// service and the AI service. Keeps the two in lock-step so advisory summaries
// describe exactly what dashboards show.

import type { Task } from '../domain/entities';
import type { TaskStatus, WaitingReason } from '../domain/enums';
import { TaskStatuses } from '../domain/enums';
import type { AiTaskSnapshot } from '../ai/provider';
import { sanitizeText } from '../ai/sanitize';

const TERMINAL: readonly TaskStatus[] = ['Completed', 'Cancelled'];
const DUE_SOON_MS = 48 * 60 * 60 * 1000;

export function isOverdue(task: Task, now: Date): boolean {
  if (!task.dueAt || TERMINAL.includes(task.status)) return false;
  return Date.parse(task.dueAt) < now.getTime();
}

export function isDueSoon(task: Task, now: Date): boolean {
  if (!task.dueAt || TERMINAL.includes(task.status)) return false;
  const due = Date.parse(task.dueAt);
  return due >= now.getTime() && due <= now.getTime() + DUE_SOON_MS;
}

export interface TaskBuckets {
  inbox: Task[];
  assigned: Task[];
  inProgress: Task[];
  waiting: Task[];
  review: Task[];
  completed: Task[];
  dueSoon: Task[];
  overdue: Task[];
}

export function bucketTasks(tasks: Task[], now: Date): TaskBuckets {
  return {
    inbox: tasks.filter((t) => t.status === 'Inbox'),
    assigned: tasks.filter((t) => t.status === 'Assigned'),
    inProgress: tasks.filter((t) => t.status === 'In Progress'),
    waiting: tasks.filter((t) => t.status === 'Waiting Internal' || t.status === 'Waiting External'),
    review: tasks.filter((t) => t.status === 'Review'),
    completed: tasks.filter((t) => t.status === 'Completed'),
    dueSoon: tasks.filter((t) => isDueSoon(t, now)),
    overdue: tasks.filter((t) => isOverdue(t, now)),
  };
}

export function statusCounts(tasks: Task[]): Record<TaskStatus, number> {
  const counts = Object.fromEntries(TaskStatuses.map((s) => [s, 0])) as Record<TaskStatus, number>;
  for (const t of tasks) counts[t.status] += 1;
  return counts;
}

export function waitingReasonCounts(tasks: Task[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of tasks) {
    if ((t.status === 'Waiting Internal' || t.status === 'Waiting External') && t.waitingReason) {
      const key: WaitingReason = t.waitingReason;
      out[key] = (out[key] ?? 0) + 1;
    }
  }
  return out;
}

export interface CoreMetrics {
  total: number;
  completed: number;
  completionRate: number;
  overdue: number;
  waiting: number;
  inProgress: number;
  review: number;
  evidenceGaps: number;
  blocked: number;
}

export function computeMetrics(tasks: Task[], evidenceCount: Map<string, number>, now: Date): CoreMetrics {
  const completed = tasks.filter((t) => t.status === 'Completed');
  const waiting = tasks.filter((t) => t.status === 'Waiting Internal' || t.status === 'Waiting External');
  const evidenceGaps = completed.filter((t) => (evidenceCount.get(t.id) ?? 0) === 0).length;
  const total = tasks.length;
  return {
    total,
    completed: completed.length,
    completionRate: total > 0 ? Math.round((completed.length / total) * 100) : 0,
    overdue: tasks.filter((t) => isOverdue(t, now)).length,
    waiting: waiting.length,
    inProgress: tasks.filter((t) => t.status === 'In Progress').length,
    review: tasks.filter((t) => t.status === 'Review').length,
    evidenceGaps,
    blocked: waiting.length,
  };
}

export function toSnapshots(
  tasks: Task[],
  evidenceCount: Map<string, number>,
  now: Date,
): AiTaskSnapshot[] {
  return tasks.map((t) => {
    const snap: AiTaskSnapshot = {
      title: sanitizeText(t.title, 120),
      status: t.status,
      priority: t.priority,
      overdue: isOverdue(t, now),
      hasEvidence: (evidenceCount.get(t.id) ?? 0) > 0,
    };
    if (t.waitingReason) snap.waitingReason = t.waitingReason;
    return snap;
  });
}

/** Collect sanitized untrusted note text (completion comments) for AI input. */
export function collectNotes(tasks: Task[]): string[] {
  const notes: string[] = [];
  for (const t of tasks) {
    if (t.completionComment) {
      const s = sanitizeText(t.completionComment, 200);
      if (s) notes.push(s);
    }
  }
  return notes;
}
