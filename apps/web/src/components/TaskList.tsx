import Link from 'next/link';
import type { Task } from '@teamos/core';
import { StatusBadge, EmptyState } from './ui';
import { fmtDate, isOverdueIso, priorityColor, relTime, sortByPriority } from './format';

const TERMINAL = ['Completed', 'Cancelled'];

export function TaskList({ tasks, emptyLabel = 'No tasks.' }: { tasks: Task[]; emptyLabel?: string }) {
  if (tasks.length === 0) return <EmptyState>{emptyLabel}</EmptyState>;
  const sorted = sortByPriority(tasks);

  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((t) => {
        const overdue = isOverdueIso(t.dueAt, TERMINAL.includes(t.status));
        return (
          <li key={t.id}>
            <Link
              href={`/task/${t.id}`}
              className="flex items-center gap-3 rounded-xl border px-3 py-2.5 transition hover:bg-[rgb(var(--surface-2))]"
              style={{ borderColor: 'rgb(var(--border))' }}
            >
              <span
                className="h-9 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: priorityColor(t.priority) }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{t.title}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2.5 text-xs muted">
                  <span style={{ color: priorityColor(t.priority) }}>{t.priority}</span>
                  {t.waitingReason ? <span>· {t.waitingReason}</span> : null}
                  {t.dueAt ? (
                    <span className={overdue ? 'text-red-500' : ''}>
                      {overdue ? 'Overdue' : 'Due'} {fmtDate(t.dueAt)} ({relTime(t.dueAt)})
                    </span>
                  ) : null}
                </div>
              </div>
              <StatusBadge status={t.status} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
