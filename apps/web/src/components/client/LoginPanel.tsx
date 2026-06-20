'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getJson, postJson } from './api';

interface DemoUser {
  id: string;
  displayName: string;
  role: 'Admin' | 'Manager' | 'Employee';
  email: string;
}

const ROLE_HOME: Record<DemoUser['role'], string> = {
  Employee: '/employee',
  Manager: '/manager',
  Admin: '/executive',
};

export function LoginPanel() {
  const router = useRouter();
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<{ users: DemoUser[] }>('/api/auth/users').then((res) => {
      if (res.ok && res.data) setUsers(res.data.users);
      else setError(res.error?.message ?? 'Dev login is disabled.');
      setLoading(false);
    });
  }, []);

  async function signIn(user: DemoUser) {
    setPending(user.id);
    setError(null);
    const res = await postJson('/api/auth/dev-login', { userId: user.id });
    if (res.ok) {
      router.push(ROLE_HOME[user.role]);
      router.refresh();
    } else {
      setError(res.error?.message ?? 'Sign-in failed.');
      setPending(null);
    }
  }

  return (
    <div className="card w-full max-w-md p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold">Sign in to TeamOS</h1>
        <p className="mt-1 text-sm muted">
          Production uses Google Workspace sign-in. This demo build offers seeded accounts so you can
          explore each role.
        </p>
      </div>

      <button type="button" className="btn-ghost mb-4 w-full" disabled title="Configure GOOGLE_OAUTH_* to enable">
        <span aria-hidden>🔒</span> Continue with Google (configure OAuth to enable)
      </button>

      <div className="mb-2 text-xs font-semibold uppercase tracking-wide muted">Demo accounts</div>

      {loading ? (
        <div className="text-sm muted">Loading accounts…</div>
      ) : users.length === 0 ? (
        <div className="text-sm muted">{error ?? 'No demo accounts available.'}</div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => signIn(u)}
              disabled={pending !== null}
              className="flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition hover:bg-[rgb(var(--surface-2))]"
              style={{ borderColor: 'rgb(var(--border))' }}
            >
              <span>
                <span className="block text-sm font-medium">{u.displayName}</span>
                <span className="block text-xs muted">{u.email}</span>
              </span>
              <span className="badge bg-brand-500/15 text-brand-300">{u.role}</span>
            </button>
          ))}
        </div>
      )}

      {error && !loading ? <div className="mt-3 text-sm text-red-400">{error}</div> : null}
    </div>
  );
}
