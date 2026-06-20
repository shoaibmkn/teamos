import Link from 'next/link';
import { redirect } from 'next/navigation';
import { rbac } from '@teamos/core';
import { optionalContext } from '@/lib/server/context';
import { SectionTitle, EmptyState, Pill } from '@/components/ui';
import { fmtDate } from '@/components/format';

export const dynamic = 'force-dynamic';

export default async function WorkflowsPage() {
  const sc = await optionalContext();
  if (!sc) redirect('/login');
  const { ctx, services, repos, user } = sc;

  const templates = await services.workflows.listTemplates(ctx);
  const allInstances = await repos.workflowInstances.list({});
  const instances = allInstances.filter(
    (i) => i.ownerUserId === user.id || rbac.canReadTeam(user.role),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Workflows</h1>
        <p className="text-sm muted">Repeatable processes and their live executions.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-4">
          <SectionTitle>Templates</SectionTitle>
          {templates.length === 0 ? (
            <EmptyState>No templates yet.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {templates.map((t) => (
                <li key={t.id} className="rounded-lg border p-3" style={{ borderColor: 'rgb(var(--border))' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{t.name}</span>
                    <Pill>v{t.version}</Pill>
                  </div>
                  {t.description ? <p className="mt-1 text-xs muted">{t.description}</p> : null}
                  {t.slaHours ? <p className="mt-1 text-xs muted">Default SLA: {t.slaHours}h</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-4">
          <SectionTitle>Active instances</SectionTitle>
          {instances.length === 0 ? (
            <EmptyState>No workflow instances visible to you.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {instances.map((i) => (
                <li key={i.id}>
                  <Link
                    href={`/workflows/${i.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border p-3 transition hover:bg-[rgb(var(--surface-2))]"
                    style={{ borderColor: 'rgb(var(--border))' }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{i.name}</span>
                      <span className="block text-xs muted">
                        Started {fmtDate(i.startedAt)}{i.dueAt ? ` · due ${fmtDate(i.dueAt)}` : ''}
                      </span>
                    </span>
                    <Pill className="bg-brand-500/15 text-brand-300">{i.status}</Pill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
