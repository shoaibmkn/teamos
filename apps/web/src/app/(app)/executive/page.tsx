import { redirect } from 'next/navigation';
import { optionalContext } from '@/lib/server/context';
import { MetricCard, SectionTitle, EmptyState } from '@/components/ui';
import { AiSummaryPanel } from '@/components/client/AiSummaryPanel';
import { periodLastDays } from '@/components/format';

export const dynamic = 'force-dynamic';

export default async function ExecutivePage() {
  const sc = await optionalContext();
  if (!sc) redirect('/login');
  const { ctx, services, aiMode } = sc;

  const dash = await services.dashboards.executive(ctx);
  const period = periodLastDays(14);

  const statusEntries = Object.entries(dash.statusCounts).filter(([, n]) => n > 0);
  const statusMax = Math.max(1, ...statusEntries.map(([, n]) => n));
  const trendMax = Math.max(1, ...dash.completionTrend.map((d) => d.completed));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Executive</h1>
        <p className="text-sm muted">Organization-wide operational health, completion trends, and risk.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Total tasks" value={dash.metrics.total} />
        <MetricCard label="Completion" value={`${dash.metrics.completionRate}%`} tone={dash.metrics.completionRate >= 60 ? 'good' : 'default'} />
        <MetricCard label="Overdue" value={dash.metrics.overdue} tone={dash.metrics.overdue ? 'danger' : 'good'} />
        <MetricCard label="Evidence gaps" value={dash.metrics.evidenceGaps} tone={dash.metrics.evidenceGaps ? 'warn' : 'good'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-2">
          <SectionTitle>Status distribution</SectionTitle>
          {statusEntries.length === 0 ? (
            <EmptyState>No tasks yet.</EmptyState>
          ) : (
            <div className="space-y-2">
              {statusEntries.map(([status, n]) => (
                <div key={status} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-xs muted">{status}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'rgb(var(--surface-2))' }}>
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(n / statusMax) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right text-xs font-medium">{n}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card p-4">
          <SectionTitle>Completions · last 7 days</SectionTitle>
          <div className="flex h-32 items-end gap-1.5">
            {dash.completionTrend.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-brand-500/80"
                  style={{ height: `${(d.completed / trendMax) * 100}%`, minHeight: d.completed > 0 ? '6px' : '2px' }}
                  title={`${d.date}: ${d.completed}`}
                />
                <span className="text-[10px] muted">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-1">
          <SectionTitle>Top bottlenecks</SectionTitle>
          {dash.bottlenecks.length === 0 ? (
            <EmptyState>No bottlenecks detected.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {dash.bottlenecks.map((b) => (
                <li key={b.workflowInstanceId} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'rgb(var(--border))' }}>
                  <span className="truncate">{b.name}</span>
                  <span className="flex gap-2 text-xs">
                    {b.overdue > 0 ? <span className="text-red-400">{b.overdue}</span> : null}
                    {b.waiting > 0 ? <span className="text-amber-400">{b.waiting}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="lg:col-span-2">
          <AiSummaryPanel
            scopeType="Executive"
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
