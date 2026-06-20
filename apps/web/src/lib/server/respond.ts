// API response helpers enforcing the common response shape (api-spec.md).

import { NextResponse } from 'next/server';
import { isAppError } from '@teamos/core';

export function reqId(req: Request): string {
  const id = req.headers.get('x-request-id');
  return id && id.trim() ? id.trim() : 'req_unknown';
}

export function ok(data: unknown, requestId: string, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data, requestId }, { status });
}

export function fail(error: unknown, requestId: string): NextResponse {
  if (isAppError(error)) {
    const body = error.details
      ? { code: error.code, message: error.message, details: error.details }
      : { code: error.code, message: error.message };
    return NextResponse.json({ ok: false, error: body, requestId }, { status: error.httpStatus });
  }
  // Never leak internals; log server-side only.
  console.error('[teamos] unhandled error', error);
  return NextResponse.json(
    { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Unexpected error.' }, requestId },
    { status: 500 },
  );
}
