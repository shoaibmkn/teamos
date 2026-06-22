// Public auth config so the login page knows which sign-in methods to show.
// Exposes booleans only — no secrets.

import { googleConfigFromEnv } from '@/lib/server/google-oauth';
import { ok, reqId } from '@/lib/server/respond';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  return ok(
    { google: Boolean(googleConfigFromEnv()), devLogin: process.env.TEAMOS_DEV_LOGIN !== 'false' },
    reqId(req),
  );
}
