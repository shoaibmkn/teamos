// Liveness/health probe for uptime monitoring and the container HEALTHCHECK.
// No auth, no secrets — just confirms the runtime is up and which backend.

import { getRuntime } from '@/lib/server/runtime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const r = await getRuntime();
    return Response.json({ ok: true, backend: r.backend, time: new Date().toISOString() });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
