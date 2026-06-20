import type { ReactNode } from 'react';
import type { Priority, TaskStatus } from '@teamos/core';
import { priorityClass, statusBadgeClass } from './format';

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`badge ${statusBadgeClass(status)}`}>{status}</span>;
}

export function PriorityTag({ priority }: { priority: Priority }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${priorityClass(priority)}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {priority}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'default' | 'warn' | 'danger' | 'good';
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-red-400'
      : tone === 'warn'
        ? 'text-amber-400'
        : tone === 'good'
          ? 'text-emerald-400'
          : '';
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</div>
      {hint ? <div className="mt-0.5 text-xs muted">{hint}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wide muted">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm muted" style={{ borderColor: 'rgb(var(--border))' }}>{children}</div>;
}

export function Pill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`badge ${className}`} style={{ backgroundColor: 'rgb(var(--surface-2))' }}>{children}</span>;
}
