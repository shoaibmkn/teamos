// Lists seeded demo users for the dev-login picker. Only available when dev
// login is enabled. Returns no secrets — display name and role only.

import { forbidden } from '@teamos/core';
import { getRuntime } from '@/lib/server/runtime';
import { fail, ok, reqId } from '@/lib/server/respond';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const requestId = reqId(req);
  try {
    if (process.env.TEAMOS_DEV_LOGIN === 'false') throw forbidden('Dev login is disabled.');
    const { repos } = await getRuntime();
    const users = await repos.users.list({ status: 'Active' });
    return ok(
      {
        users: users.map((u) => ({ id: u.id, displayName: u.displayName, role: u.role, email: u.email })),
      },
      requestId,
    );
  } catch (err) {
    return fail(err, requestId);
  }
}
