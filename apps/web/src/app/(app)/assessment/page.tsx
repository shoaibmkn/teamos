import { redirect } from 'next/navigation';
import { optionalContext } from '@/lib/server/context';
import { AssessmentView } from '@/components/client/AssessmentView';

export const dynamic = 'force-dynamic';

export default async function AssessmentPage() {
  const sc = await optionalContext();
  if (!sc) redirect('/login');
  const { ctx, services, user } = sc;

  if (user.role === 'Employee') {
    return <div className="card p-6 text-sm">Assessments are for managers and admins.</div>;
  }

  const team = (await services.users.listTeam(ctx))
    .filter((u) => u.id !== user.id)
    .map((u) => ({ id: u.id, displayName: u.displayName }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Assessment</h1>
        <p className="text-sm muted">Per-person KPIs over time for reviews. Export to CSV in one click.</p>
      </div>
      {team.length === 0 ? (
        <div className="card p-6 text-sm muted">No team members to assess yet. Add people first.</div>
      ) : (
        <AssessmentView team={team} />
      )}
    </div>
  );
}
