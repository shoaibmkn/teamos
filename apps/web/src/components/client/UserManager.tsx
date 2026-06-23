'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Roles, type Role } from '@teamos/core';
import { postJson } from './api';

export interface UserRow {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  status: 'Active' | 'Archived';
  managerUserId?: string;
  department?: string;
}

export function UserManager({ users, selfId, isAdmin }: { users: UserRow[]; selfId: string; isAdmin: boolean }) {
  const router = useRouter();
  const managers = users.filter((u) => u.status === 'Active' && (u.role === 'Manager' || u.role === 'Admin'));

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<Role>('Employee');
  const [managerUserId, setManagerUserId] = useState('');
  const [department, setDepartment] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const body: Record<string, unknown> = { email, displayName };
    if (isAdmin) {
      body.role = role;
      if (managerUserId) body.managerUserId = managerUserId;
    }
    if (department.trim()) body.department = department.trim();
    const res = await postJson('/api/users', body);
    if (res.ok) {
      setEmail('');
      setDisplayName('');
      setRole('Employee');
      setManagerUserId('');
      setDepartment('');
      setOpen(false);
      router.refresh();
    } else {
      setError(res.error?.message ?? 'Could not add user.');
    }
    setPending(false);
  }

  async function archive(id: string) {
    setError(null);
    const res = await postJson(`/api/users/${id}/archive`, {});
    if (res.ok) router.refresh();
    else setError(res.error?.message ?? 'Could not archive.');
  }

  const nameOf = (id?: string) => users.find((u) => u.id === id)?.displayName ?? '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide muted">People</h2>
        <button type="button" className="btn-primary" onClick={() => setOpen((v) => !v)}>
          {open ? 'Close' : '+ Add person'}
        </button>
      </div>

      {open ? (
        <form onSubmit={addUser} className="card space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide muted">Work email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" autoFocus />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide muted">Name</label>
              <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            {isAdmin ? (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide muted">Role</label>
                  <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                    {Roles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide muted">Manager (optional)</label>
                  <select className="input" value={managerUserId} onChange={(e) => setManagerUserId(e.target.value)}>
                    <option value="">None</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide muted">Department (optional)</label>
            <input className="input" value={department} onChange={(e) => setDepartment(e.target.value)} />
          </div>
          {error ? <div className="text-sm text-red-500">{error}</div> : null}
          <button type="submit" className="btn-primary w-full" disabled={pending || !email.trim() || !displayName.trim()}>
            {pending ? 'Adding…' : 'Add person'}
          </button>
        </form>
      ) : null}

      {error && !open ? <div className="text-sm text-red-500">{error}</div> : null}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide muted" style={{ borderColor: 'rgb(var(--border))' }}>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Manager</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b last:border-0" style={{ borderColor: 'rgb(var(--border))' }}>
                <td className="px-4 py-2.5">
                  <div className="font-medium">{u.displayName}</div>
                  <div className="text-xs muted">{u.email}</div>
                </td>
                <td className="px-4 py-2.5">
                  <span className="badge bg-brand-500/15 text-brand-600 dark:text-brand-300">{u.role}</span>
                </td>
                <td className="px-4 py-2.5 muted">{u.role === 'Employee' ? nameOf(u.managerUserId) : '—'}</td>
                <td className="px-4 py-2.5">
                  {u.status === 'Active' ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Active</span>
                  ) : (
                    <span className="muted">Archived</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {u.status === 'Active' && u.id !== selfId ? (
                    <button type="button" className="text-xs text-red-500 hover:underline" onClick={() => archive(u.id)}>
                      Archive
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
