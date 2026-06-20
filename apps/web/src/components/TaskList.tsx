import Link from 'next/link';
import type { Task } from '@teamos/core';
import { StatusBadge, PriorityTag, EmptyState } from './ui';
import { fmtDate, isOverdueIso, relTime } from './format';

const TERMINAL = ['Completed', 'Cancelled'];

export function TaskList({ tasks, emptyLabel = 'No tasks.' }: { tasks: Task[]; emptyLabel?: string }) {
  if (tasks.length === 0) return <EmptyState>{emptyLabel}</EmptyState>;

  return (
    <ul className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
      {tasks.map((t) => {
        const overdue = isOverdueIso(t.dueAt, TERMINAL.includes(t.status));
        return (
          <li key={t.id}>
            <Link
              href={`/task/${t.id}`}
              className="flex items-center justify-between gap-3 px-1 py-3 transition hover:bg-[rgb(var(--surface-2))]"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{t.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <PriorityTag priority={t.priority} />
                  {t.waitingReason ? <span className="text-xs muted">· {t.waitingReason}</span> : null}
                  {t.dueAt ? (
                    <span className={`text-xs ${overdue ? 'text-red-400' : 'muted'}`}>
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
