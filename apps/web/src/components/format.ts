// Pure formatting and style-mapping helpers shared across server and client
// components. No side effects, no hooks.

import type { Priority, RiskSignal, TaskStatus } from '@teamos/core';

export function statusBadgeClass(status: TaskStatus): string {
  switch (status) {
    case 'Completed':
      return 'bg-emerald-500/15 text-emerald-400';
    case 'Cancelled':
      return 'bg-slate-500/15 text-slate-400';
    case 'In Progress':
      return 'bg-brand-500/15 text-brand-300';
    case 'Review':
      return 'bg-violet-500/15 text-violet-300';
    case 'Waiting Internal':
    case 'Waiting External':
      return 'bg-amber-500/15 text-amber-300';
    case 'Assigned':
      return 'bg-sky-500/15 text-sky-300';
    default:
      return 'bg-slate-500/15 text-slate-400';
  }
}

export function priorityClass(priority: Priority): string {
  switch (priority) {
    case 'Critical':
      return 'text-red-400';
    case 'High':
      return 'text-amber-400';
    case 'Normal':
      return 'text-sky-400';
    default:
      return 'text-slate-400';
  }
}

export function riskClass(severity: RiskSignal['severity']): string {
  switch (severity) {
    case 'high':
      return 'bg-red-500/15 text-red-300 border-red-500/30';
    case 'medium':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    default:
      return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
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
