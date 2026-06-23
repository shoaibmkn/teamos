import { redirect } from 'next/navigation';
import { optionalContext } from '@/lib/server/context';
import { UserManager, type UserRow } from '@/components/client/UserManager';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const sc = await optionalContext();
  if (!sc) redirect('/login');
  const { ctx, services, user } = sc;

  if (user.role === 'Employee') {
    return <div className="card p-6 text-sm">People management is for managers and admins.</div>;
  }

  const all = await services.users.listAll(ctx);
  const rows: UserRow[] = all.map((u) => {
    const r: UserRow = {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      status: u.status,
    };
    if (u.managerUserId) r.managerUserId = u.managerUserId;
    if (u.department) r.department = u.department;
    return r;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{user.role === 'Admin' ? 'People' : 'My team'}</h1>
        <p className="text-sm muted">
          {user.role === 'Admin'
            ? 'Add people, set roles and managers, archive when they leave.'
            : 'Add team members and archive them when they leave.'}
        </p>
      </div>
      <UserManager users={rows} selfId={user.id} isAdmin={user.role === 'Admin'} />
    </div>
  );
}
