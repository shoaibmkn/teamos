import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Evidence, Task } from '@teamos/core';
import { isAppError } from '@teamos/core';
import { optionalContext } from '@/lib/server/context';
import { StatusBadge, PriorityTag, SectionTitle, EmptyState } from '@/components/ui';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { StatusUpdateForm } from '@/components/client/StatusUpdateForm';
import { AddEvidenceForm } from '@/components/client/AddEvidenceForm';
import { fmtDate, relTime } from '@/components/format';

export const dynamic = 'force-dynamic';

function EvidenceRow({ e }: { e: Evidence }) {
  return (
    <li className="rounded-lg border p-3" style={{ borderColor: 'rgb(var(--border))' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{e.title}</span>
        <span className="badge bg-brand-500/15 text-brand-300">{e.type}</span>
      </div>
      {e.uri ? (
        <a href={e.uri} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-brand-300 hover:underline">
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
  const { ctx, services, repos } = sc;

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

  const activity = await services.tasks.getActivity(ctx, task.id);
  const ids = new Set<string>([task.assigneeUserId, task.managerUserId, ...activity.map((a) => a.actorUserId)]);
  const nameMap = new Map<string, string>([['system', 'System'], ['seed', 'System']]);
  for (const id of ids) {
    if (nameMap.has(id)) continue;
    const u = await repos.users.getById(id);
    if (u) nameMap.set(id, u.displayName);
  }
  const nameOf = (id: string) => nameMap.get(id) ?? id;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm muted">
        <Link href="/employee" className="hover:underline">My Work</Link>
        <span>/</span>
        <span className="truncate">{task.title}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
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
              {task.waitingReason ? (
                <div>
                  <dt className="text-xs muted">Waiting reason</dt>
                  <dd className="mt-0.5">{task.waitingReason}</dd>
                </div>
              ) : null}
              {task.workflowInstanceId ? (
                <div>
                  <dt className="text-xs muted">Workflow</dt>
                  <dd className="mt-0.5">
                    <Link href={`/workflows/${task.workflowInstanceId}`} className="text-brand-300 hover:underline">
                      View workflow
                    </Link>
                  </dd>
                </div>
              ) : null}
            </dl>
            {task.completionComment ? (
              <p className="mt-3 rounded-lg border p-3 text-sm" style={{ borderColor: 'rgb(var(--border))' }}>
                <span className="text-xs muted">Completion comment: </span>
                {task.completionComment}
              </p>
            ) : null}
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
            <SectionTitle>Activity</SectionTitle>
            <ActivityTimeline activity={activity} nameOf={nameOf} />
          </section>
        </div>
      </div>
    </div>
  );
}
