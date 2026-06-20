// Builds the RequestContext the core services expect. Used by both API route
// handlers (with the incoming Request for X-Request-Id correlation) and server
// components (which generate a fresh request id).

import 'server-only';
import { randomUUID } from 'node:crypto';
import { unauthenticated, type RequestContext, type Services, type User } from '@teamos/core';
import { getRuntime, type TeamOsRuntime } from './runtime';
import { getSessionUser } from './session';

export interface ServerContext extends TeamOsRuntime {
  ctx: RequestContext;
  user: User;
}

function requestId(req?: Request): string {
  const fromHeader = req?.headers.get('x-request-id');
  return fromHeader && fromHeader.trim() ? fromHeader.trim() : `req_${randomUUID()}`;
}

/** Throws UNAUTHENTICATED when there is no valid session. */
export async function requireContext(req?: Request): Promise<ServerContext> {
  const user = await getSessionUser();
  if (!user) throw unauthenticated();
  const runtime = await getRuntime();
  return { ...runtime, user, ctx: { actor: user, requestId: requestId(req) } };
}

/** Returns null instead of throwing when unauthenticated (for page guards). */
export async function optionalContext(): Promise<ServerContext | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const runtime = await getRuntime();
  return { ...runtime, user, ctx: { actor: user, requestId: `req_${randomUUID()}` } };
}

export type { Services };
