// One-time Sheets provisioning, guarded by a setup token (there is no admin
// session yet on a fresh deployment). Creates tabs + headers and seeds the
// first admin from TEAMOS_ADMIN_EMAIL. Safe to re-run (idempotent).

import { NextResponse } from 'next/server';
import { SheetsClient, sheetsConfigFromEnv } from '@/lib/server/sheets/client';
import { ensureSheetsStructure } from '@/lib/server/sheets/setup';
import { reqId } from '@/lib/server/respond';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const requestId = reqId(req);
  const token = new URL(req.url).searchParams.get('token');
  const expected = process.env.TEAMOS_SETUP_TOKEN;

  if (process.env.TEAMOS_DATA_BACKEND !== 'sheets') {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Backend is not sheets.' }, requestId },
      { status: 400 },
    );
  }
  if (!expected || token !== expected) {
    return NextResponse.json(
      { ok: false, error: { code: 'FORBIDDEN', message: 'Invalid setup token.' }, requestId },
      { status: 403 },
    );
  }

  const cfg = sheetsConfigFromEnv();
  if (!cfg) {
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Sheets env not configured.' }, requestId },
      { status: 500 },
    );
  }

  try {
    const result = await ensureSheetsStructure(new SheetsClient(cfg), process.env.TEAMOS_ADMIN_EMAIL);
    return NextResponse.json({ ok: true, data: result, requestId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Setup failed.';
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message }, requestId }, { status: 500 });
  }
}
