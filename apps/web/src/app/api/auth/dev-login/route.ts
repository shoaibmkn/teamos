// Dev login. Local-only convenience that signs in as a seeded user without a
// real Google OAuth project. Disabled when TEAMOS_DEV_LOGIN=false.

import { forbidden, validation } from '@teamos/core';
import { getRuntime } from '@/lib/server/runtime';
import { setSessionCookie } from '@/lib/server/session';
import { fail, ok, reqId } from '@/lib/server/respond';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const requestId = reqId(req);
  try {
    if (process.env.TEAMOS_DEV_LOGIN === 'false') {
      throw forbidden('Dev login is disabled.');
    }
    const body = (await req.json().catch(() => ({}))) as { userId?: string };
    if (!body.userId) throw validation('userId is required.');

    const { repos } = await getRuntime();
    const user = await repos.users.getById(body.userId);
    if (!user || user.status !== 'Active') throw forbidden('Unknown or archived user.');

    setSessionCookie(user.id);
    return ok({ user: { id: user.id, displayName: user.displayName, role: user.role } }, requestId);
  } catch (err) {
    return fail(err, requestId);
  }
}
