// Cookie-backed session. For the runnable demo this stores the resolved user
// id after dev-login or Google sign-in. The cookie is httpOnly; the frontend
// never sees identity tokens or secrets (security-model.md).

import 'server-only';
import { cookies } from 'next/headers';
import type { User } from '@teamos/core';
import { getRuntime } from './runtime';

export const SESSION_COOKIE = 'teamos_uid';

export async function getSessionUser(): Promise<User | null> {
  const uid = cookies().get(SESSION_COOKIE)?.value;
  if (!uid) return null;
  const { repos } = await getRuntime();
  const user = await repos.users.getById(uid);
  if (!user || user.status !== 'Active') return null;
  return user;
}

export function setSessionCookie(userId: string): void {
  cookies().set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
}

export function clearSessionCookie(): void {
  cookies().delete(SESSION_COOKIE);
}
