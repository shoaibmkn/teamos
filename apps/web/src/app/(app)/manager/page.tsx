import { redirect } from 'next/navigation';
import { optionalContext } from '@/lib/server/context';
import { MetricCard, SectionTitle, EmptyState } from '@/components/ui';
import { TaskList } from '@/components/TaskList';
import { AiSummaryPanel } from '@/components/client/AiSummaryPanel';
import { periodLastDays } from '@/components/format';

export const dynamic = 'force-dynamic';

export default async function ManagerPage() {
  const sc = await optionalContext();
  if (!sc) redirect('/login');
  const { ctx, services, aiMode, user } = sc;

  const dash = await services.dashboards.manager(ctx);
  const period = periodLastDays(14);
  const reasons = Object.entries(dash.waitingReasons);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Team</h1>
        <p className="text-sm muted">Review team state in minutes: delays, blockers, SLA risk, evidence gaps.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Team tasks" value={dash.metrics.total} hint={`${dash.team.length} people`} />
        <MetricCard label="Completion" value={`${dash.metrics.completionRate}%`} tone={dash.metrics.completionRate >= 60 ? 'good' : 'default'} />
        <MetricCard label="Overdue" value={dash.metrics.overdue} tone={dash.metrics.overdue ? 'danger' : 'good'} />
        <MetricCard label="Evidence gaps" value={dash.metrics.evidenceGaps} tone={dash.metrics.evidenceGaps ? 'warn' : 'good'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-4">
            <SectionTitle>Delayed work</SectionTitle>
            <TaskList tasks={dash.delayed} emptyLabel="No overdue work." />
          </section>

          <section className="card p-4">
            <SectionTitle>Waiting</SectionTitle>
            {reasons.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {reasons.map(([reason, count]) => (
                  <span key={reason} className="badge bg-amber-500/15 text-amber-300">
                    {reason}: {count}
                  </span>
                ))}
              </div>
            ) : null}
            <TaskList tasks={dash.waiting} emptyLabel="Nothing blocked." />
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="card p-4">
              <SectionTitle>SLA risk (due soon)</SectionTitle>
              <TaskList tasks={dash.slaRisk} emptyLabel="No imminent deadlines." />
            </section>
            <section className="card p-4">
              <SectionTitle>Evidence gaps</SectionTitle>
              <TaskList tasks={dash.evidenceGaps} emptyLabel="Every completion has evidence." />
            </section>
          </div>
        </div>

        <div className="space-y-6">
          <section className="card p-4">
            <SectionTitle>Workflow bottlenecks</SectionTitle>
            {dash.bottlenecks.length === 0 ? (
              <EmptyState>No bottlenecks detected.</EmptyState>
            ) : (
              <ul className="space-y-2">
                {dash.bottlenecks.map((b) => (
                  <li key={b.workflowInstanceId} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'rgb(var(--border))' }}>
                    <span className="truncate">{b.name}</span>
                    <span className="flex gap-2 text-xs">
                      {b.overdue > 0 ? <span className="text-red-400">{b.overdue} overdue</span> : null}
                      {b.waiting > 0 ? <span className="text-amber-400">{b.waiting} waiting</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <AiSummaryPanel
            scopeType="Manager"
            scopeId={user.id}
            periodStart={period.start}
            periodEnd={period.end}
            aiMode={aiMode}
            initialText={dash.summary?.summaryText}
          />
        </div>
      </div>
    </div>
  );
}
