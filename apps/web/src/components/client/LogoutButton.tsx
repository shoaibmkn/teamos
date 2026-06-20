'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { postJson } from './api';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await postJson('/api/auth/logout', {});
    router.push('/login');
    router.refresh();
  }

  return (
    <button type="button" onClick={logout} disabled={pending} className="nav-link w-full">
      <span aria-hidden>⎋</span>
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
