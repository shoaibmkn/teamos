import { redirect } from 'next/navigation';
import { optionalContext } from '@/lib/server/context';
import { MetricCard, SectionTitle } from '@/components/ui';
import { TaskList } from '@/components/TaskList';
import { AiSummaryPanel } from '@/components/client/AiSummaryPanel';
import { periodLastDays } from '@/components/format';

export const dynamic = 'force-dynamic';

export default async function EmployeePage() {
  const sc = await optionalContext();
  if (!sc) redirect('/login');
  const { ctx, services, aiMode, user } = sc;

  const dash = await services.dashboards.employee(ctx);
  const period = periodLastDays(14);
  const open = dash.metrics.total - dash.metrics.completed;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">My Work</h1>
        <p className="text-sm muted">Update your work in seconds. Completion needs evidence or a comment.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Open" value={open} hint={`${dash.metrics.total} total`} />
        <MetricCard label="Due soon" value={dash.dueSoon.length} tone={dash.dueSoon.length ? 'warn' : 'default'} />
        <MetricCard label="Overdue" value={dash.overdue.length} tone={dash.overdue.length ? 'danger' : 'good'} />
        <MetricCard label="Waiting" value={dash.waiting.length} tone={dash.waiting.length ? 'warn' : 'default'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-4">
            <SectionTitle>Inbox &amp; Assigned</SectionTitle>
            <TaskList tasks={[...dash.inbox, ...dash.assigned]} emptyLabel="Nothing waiting to start." />
          </section>
          <section className="card p-4">
            <SectionTitle>In Progress</SectionTitle>
            <TaskList tasks={dash.inProgress} emptyLabel="No work in progress." />
          </section>
          <section className="card p-4">
            <SectionTitle>Waiting &amp; Review</SectionTitle>
            <TaskList tasks={[...dash.waiting, ...dash.review]} emptyLabel="Nothing waiting or in review." />
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-4">
            <SectionTitle>Needs attention</SectionTitle>
            <TaskList tasks={[...dash.overdue, ...dash.dueSoon]} emptyLabel="All clear — nothing overdue or due soon." />
          </section>
          <AiSummaryPanel
            scopeType="Employee"
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
