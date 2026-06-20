import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isAppError } from '@teamos/core';
import type { InstanceDetail } from '@teamos/core';
import { optionalContext } from '@/lib/server/context';
import { SectionTitle, Pill, MetricCard } from '@/components/ui';
import { TaskList } from '@/components/TaskList';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { AiSummaryPanel } from '@/components/client/AiSummaryPanel';
import { fmtDate, periodLastDays } from '@/components/format';

export const dynamic = 'force-dynamic';

export default async function WorkflowInstancePage({ params }: { params: { id: string } }) {
  const sc = await optionalContext();
  if (!sc) redirect('/login');
  const { ctx, services, repos, aiMode } = sc;

  let detail: InstanceDetail;
  try {
    detail = await services.workflows.getInstance(ctx, params.id);
  } catch (err) {
    if (isAppError(err) && err.code === 'FORBIDDEN') {
      return <div className="card p-6 text-sm">You do not have access to this workflow.</div>;
    }
    notFound();
  }

  const { instance, template, stages, tasks, sla, recentActivity } = detail;
  const period = periodLastDays(30);

  const nameMap = new Map<string, string>([['system', 'System'], ['seed', 'System']]);
  for (const a of recentActivity) {
    if (nameMap.has(a.actorUserId)) continue;
    const u = await repos.users.getById(a.actorUserId);
    if (u) nameMap.set(a.actorUserId, u.displayName);
  }
  const nameOf = (id: string) => nameMap.get(id) ?? id;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm muted">
        <Link href="/workflows" className="hover:underline">Workflows</Link>
        <span>/</span>
        <span className="truncate">{instance.name}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{instance.name}</h1>
          <p className="text-sm muted">{template?.name ?? 'Workflow'} · started {fmtDate(instance.startedAt)}</p>
        </div>
        <Pill className="bg-brand-500/15 text-brand-300">{instance.status}</Pill>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Tasks" value={tasks.length} />
        <MetricCard label="Overdue tasks" value={sla.overdueTasks} tone={sla.overdueTasks ? 'danger' : 'good'} />
        <MetricCard label="Due" value={sla.dueAt ? fmtDate(sla.dueAt) : '—'} tone={sla.overdueInstance ? 'danger' : 'default'} />
        <MetricCard label="Stages" value={stages.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-4">
            <SectionTitle>Stages</SectionTitle>
            <ol className="space-y-2">
              {stages.map((s) => {
                const current = s.id === instance.currentStageId;
                return (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2"
                    style={{ borderColor: current ? 'rgb(33 90 224)' : 'rgb(var(--border))' }}
                  >
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${current ? 'bg-brand-600 text-white' : 'bg-[rgb(var(--surface-2))] muted'}`}>
                      {s.order}
                    </span>
                    <span className="text-sm">{s.name}</span>
                    {current ? <span className="badge ml-auto bg-brand-500/15 text-brand-300">Current</span> : null}
                    {s.defaultAssigneeRole ? <span className="ml-auto text-xs muted">{s.defaultAssigneeRole}</span> : null}
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="card p-4">
            <SectionTitle>Tasks</SectionTitle>
            <TaskList tasks={tasks} emptyLabel="No tasks linked to this workflow." />
          </section>

          <AiSummaryPanel scopeType="Workflow" scopeId={instance.id} periodStart={period.start} periodEnd={period.end} aiMode={aiMode} />
        </div>

        <section className="card p-4">
          <SectionTitle>Recent activity</SectionTitle>
          <ActivityTimeline activity={recentActivity} nameOf={nameOf} />
        </section>
      </div>
    </div>
  );
}
