import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Activity, Evidence, Task } from '@teamos/core';
import { isAppError } from '@teamos/core';
import { optionalContext } from '@/lib/server/context';
import { StatusBadge, PriorityTag, SectionTitle, EmptyState } from '@/components/ui';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { StatusUpdateForm } from '@/components/client/StatusUpdateForm';
import { AddEvidenceForm } from '@/components/client/AddEvidenceForm';
import { Checklist } from '@/components/client/Checklist';
import { TaskChat } from '@/components/client/TaskChat';
import { fmtDate, relTime } from '@/components/format';

export const dynamic = 'force-dynamic';

function startedAtFrom(activity: Activity[]): string | undefined {
  // Earliest transition into "In Progress".
  for (const a of [...activity].reverse()) {
    if (a.action !== 'TaskStatusChanged' || !a.metadataJson) continue;
    try {
      const meta = JSON.parse(a.metadataJson) as { to?: string };
      if (meta.to === 'In Progress') return a.occurredAt;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

function Lifecycle({
  assignedAt,
  startedAt,
  status,
  completedAt,
}: {
  assignedAt: string;
  startedAt?: string;
  status: Task['status'];
  completedAt?: string;
}) {
  const isDone = status === 'Completed';
  const steps = [
    { label: 'Assigned', at: assignedAt, state: 'done' as const },
    { label: 'Started', at: startedAt, state: startedAt ? ('done' as const) : ('todo' as const) },
    { label: status, at: undefined as string | undefined, state: isDone ? ('done' as const) : ('cur' as const) },
    { label: 'Completed', at: completedAt, state: completedAt ? ('done' as const) : ('todo' as const) },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className="flex min-w-[80px] flex-col items-center gap-1">
            <span
              className={`grid h-7 w-7 place-items-center rounded-full text-xs ${
                s.state === 'done'
                  ? 'bg-emerald-500 text-white'
                  : s.state === 'cur'
                    ? 'border-2 border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'border-2 text-[rgb(var(--text-muted))]'
              }`}
              style={s.state === 'todo' ? { borderColor: 'rgb(var(--border))' } : undefined}
            >
              {s.state === 'done' ? '✓' : i + 1}
            </span>
            <span className="text-[11px] muted">{s.label}</span>
            <span className="text-[11px] muted">{s.at ? fmtDate(s.at) : '—'}</span>
          </div>
          {i < steps.length - 1 ? <span className="h-px w-6" style={{ backgroundColor: 'rgb(var(--border))' }} /> : null}
        </div>
      ))}
    </div>
  );
}

function EvidenceRow({ e }: { e: Evidence }) {
  return (
    <li className="rounded-lg border p-3" style={{ borderColor: 'rgb(var(--border))' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{e.title}</span>
        <span className="badge bg-brand-500/15 text-brand-600 dark:text-brand-300">{e.type}</span>
      </div>
      {e.uri ? (
        <a href={e.uri} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-brand-500 hover:underline">
          {e.uri}
        </a>
      ) : null}
      {e.notes ? <p className="mt-1 text-xs muted">{e.notes}</p> : null}
      <p className="mt-1 text-[11px] muted">Added {relTime(e.createdAt)}</p>
    </li>
  );
}

export default async function TaskDetailPage({ params }: { params: { taskId: string } }) {
  const sc = await optionalContext();
  if (!sc) redirect('/login');
  const { ctx, services, repos, user } = sc;

  let task: Task;
  let evidence: Evidence[];
  try {
    task = await services.tasks.getScoped(ctx, params.taskId);
    evidence = await services.evidence.list(ctx, params.taskId);
  } catch (err) {
    if (isAppError(err) && err.code === 'FORBIDDEN') {
      return <div className="card p-6 text-sm">You do not have access to this task.</div>;
    }
    notFound();
  }

  const [activity, subtasks, messages] = await Promise.all([
    services.tasks.getActivity(ctx, task.id),
    services.subtasks.list(ctx, task.id),
    services.messages.list(ctx, task.id),
  ]);

  const ids = new Set<string>([
    task.assigneeUserId,
    task.managerUserId,
    ...activity.map((a) => a.actorUserId),
    ...messages.map((m) => m.authorUserId),
  ]);
  const names: Record<string, string> = { system: 'System', seed: 'System' };
  for (const id of ids) {
    if (names[id]) continue;
    const u = await repos.users.getById(id);
    if (u) names[id] = u.displayName;
  }
  const nameOf = (id: string) => names[id] ?? id;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm muted">
        <Link href="/employee" className="hover:underline">My Work</Link>
        <span>/</span>
        <span className="truncate">{task.title}</span>
      </div>

      <div className="card p-4">
        <Lifecycle assignedAt={task.createdAt} startedAt={startedAtFrom(activity)} status={task.status} completedAt={task.completedAt} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-lg font-semibold">{task.title}</h1>
              <StatusBadge status={task.status} />
            </div>
            {task.description ? <p className="mt-2 text-sm muted">{task.description}</p> : null}
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs muted">Priority</dt>
                <dd className="mt-0.5"><PriorityTag priority={task.priority} /></dd>
              </div>
              <div>
                <dt className="text-xs muted">Assignee</dt>
                <dd className="mt-0.5">{nameOf(task.assigneeUserId)}</dd>
              </div>
              <div>
                <dt className="text-xs muted">Manager</dt>
                <dd className="mt-0.5">{nameOf(task.managerUserId)}</dd>
              </div>
              <div>
                <dt className="text-xs muted">Due</dt>
                <dd className="mt-0.5">{task.dueAt ? `${fmtDate(task.dueAt)} (${relTime(task.dueAt)})` : '—'}</dd>
              </div>
              {task.workflowInstanceId ? (
                <div>
                  <dt className="text-xs muted">Workflow</dt>
                  <dd className="mt-0.5">
                    <Link href={`/workflows/${task.workflowInstanceId}`} className="text-brand-500 hover:underline">
                      View workflow
                    </Link>
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="card p-5">
            <Checklist taskId={task.id} initial={subtasks.map((s) => ({ id: s.id, title: s.title, done: s.done, order: s.order }))} />
          </section>

          <section className="card p-5">
            <SectionTitle>Evidence</SectionTitle>
            {evidence.length === 0 ? (
              <EmptyState>No evidence yet. Add evidence before completing.</EmptyState>
            ) : (
              <ul className="mb-3 space-y-2">
                {evidence.map((e) => (
                  <EvidenceRow key={e.id} e={e} />
                ))}
              </ul>
            )}
            <AddEvidenceForm taskId={task.id} />
          </section>
        </div>

        <div className="space-y-5">
          <section className="card p-5">
            <SectionTitle>Update status</SectionTitle>
            <StatusUpdateForm
              taskId={task.id}
              currentStatus={task.status}
              currentWaitingReason={task.waitingReason}
              hasEvidence={evidence.length > 0}
            />
          </section>

          <section className="card p-5">
            <SectionTitle>Task chat</SectionTitle>
            <TaskChat
              taskId={task.id}
              selfId={user.id}
              names={names}
              initial={messages.map((m) => ({ id: m.id, authorUserId: m.authorUserId, text: m.text, createdAt: m.createdAt }))}
            />
          </section>

          <section className="card p-5">
            <SectionTitle>Activity</SectionTitle>
            <ActivityTimeline activity={activity} nameOf={nameOf} />
          </section>
        </div>
      </div>
    </div>
  );
}
