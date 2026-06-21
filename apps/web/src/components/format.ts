// Pure formatting, sorting, and style-mapping helpers shared across server and
// client components. No side effects, no hooks. Colors use Tailwind shades that
// read in both light and dark themes.

import type { Priority, RiskSignal, Task, TaskStatus } from '@teamos/core';

export function statusBadgeClass(status: TaskStatus): string {
  switch (status) {
    case 'Completed':
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
    case 'Cancelled':
      return 'bg-slate-500/15 text-slate-500 dark:text-slate-400';
    case 'In Progress':
      return 'bg-blue-500/15 text-blue-600 dark:text-blue-400';
    case 'Review':
      return 'bg-violet-500/15 text-violet-600 dark:text-violet-400';
    case 'Waiting Internal':
    case 'Waiting External':
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
    case 'Assigned':
      return 'bg-sky-500/15 text-sky-600 dark:text-sky-400';
    default:
      return 'bg-slate-500/15 text-slate-500 dark:text-slate-400';
  }
}

/** Solid color for a status dot / accent. */
export function statusDot(status: TaskStatus): string {
  switch (status) {
    case 'Completed':
      return '#10b981';
    case 'In Progress':
      return '#3b82f6';
    case 'Review':
      return '#8b5cf6';
    case 'Waiting Internal':
    case 'Waiting External':
      return '#f59e0b';
    case 'Assigned':
      return '#0ea5e9';
    default:
      return '#94a3b8';
  }
}

export function priorityClass(priority: Priority): string {
  switch (priority) {
    case 'Critical':
      return 'text-red-600 dark:text-red-400';
    case 'High':
      return 'text-amber-600 dark:text-amber-400';
    case 'Normal':
      return 'text-brand-600 dark:text-brand-400';
    default:
      return 'text-slate-500 dark:text-slate-400';
  }
}

/** Solid color for the priority accent bar. */
export function priorityColor(priority: Priority): string {
  switch (priority) {
    case 'Critical':
      return '#e5484d';
    case 'High':
      return '#ef8b1b';
    case 'Normal':
      return '#6366f1';
    default:
      return '#94a3b8';
  }
}

const PRIORITY_RANK: Record<Priority, number> = { Critical: 3, High: 2, Normal: 1, Low: 0 };

export function priorityRank(priority: Priority): number {
  return PRIORITY_RANK[priority];
}

/** Sort highest priority first; tie-break by soonest due date (undefined last). */
export function sortByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const byPriority = priorityRank(b.priority) - priorityRank(a.priority);
    if (byPriority !== 0) return byPriority;
    const da = a.dueAt ? Date.parse(a.dueAt) : Number.POSITIVE_INFINITY;
    const db = b.dueAt ? Date.parse(b.dueAt) : Number.POSITIVE_INFINITY;
    return da - db;
  });
}

export function riskClass(severity: RiskSignal['severity']): string {
  switch (severity) {
    case 'high':
      return 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30';
    case 'medium':
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30';
    default:
      return 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30';
  }
}

export function fmtDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function relTime(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = then - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  let label: string;
  if (mins < 60) label = `${mins}m`;
  else if (hours < 24) label = `${hours}h`;
  else label = `${days}d`;
  return diff >= 0 ? `in ${label}` : `${label} ago`;
}

export function isOverdueIso(iso: string | undefined, terminal: boolean): boolean {
  if (!iso || terminal) return false;
  return new Date(iso).getTime() < Date.now();
}

export function periodLastDays(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
