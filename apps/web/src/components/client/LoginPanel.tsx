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

const ERROR_TEXT: Record<string, string> = {
  google_not_configured: 'Google sign-in is not configured yet.',
  oauth_state: 'Sign-in expired. Please try again.',
  oauth_failed: 'Google sign-in failed. Please try again.',
  UNAUTHENTICATED: 'No TeamOS account exists for that Google email. Ask an admin to add you.',
  FORBIDDEN: 'Your account is archived.',
  VALIDATION_ERROR: 'That email domain is not allowed.',
};

export function LoginPanel() {
  const router = useRouter();
  const [google, setGoogle] = useState(false);
  const [devLogin, setDevLogin] = useState(false);
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) setError(ERROR_TEXT[err] ?? 'Sign-in failed.');

    getJson<{ google: boolean; devLogin: boolean }>('/api/auth/config').then(async (cfg) => {
      const g = cfg.data?.google ?? false;
      const d = cfg.data?.devLogin ?? false;
      setGoogle(g);
      setDevLogin(d);
      if (d) {
        const res = await getJson<{ users: DemoUser[] }>('/api/auth/users');
        if (res.ok && res.data) setUsers(res.data.users);
      }
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
        <p className="mt-1 text-sm muted">Use your Google Workspace account.</p>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <a
        href="/api/auth/google/start"
        aria-disabled={!google}
        className={`btn-ghost mb-4 w-full ${google ? '' : 'pointer-events-none opacity-50'}`}
      >
        <span aria-hidden>G</span> Continue with Google
        {google ? '' : ' (configure OAuth to enable)'}
      </a>

      {devLogin ? (
        <>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide muted">Demo accounts</div>
          {loading ? (
            <div className="text-sm muted">Loading…</div>
          ) : users.length === 0 ? (
            <div className="text-sm muted">No demo accounts available.</div>
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
                  <span className="badge bg-brand-500/15 text-brand-600 dark:text-brand-300">{u.role}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
