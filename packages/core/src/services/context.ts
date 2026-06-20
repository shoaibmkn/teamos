// Request context and time abstraction shared by all services.

import type { User } from '../domain/entities';

/** Injectable clock so time-dependent logic stays testable. */
export type Clock = () => Date;

export const systemClock: Clock = () => new Date();

export function nowIso(clock: Clock = systemClock): string {
  return clock().toISOString();
}

/**
 * The authenticated caller plus request correlation. Built by the API layer
 * after it resolves the Google identity to an internal user record. Services
 * never trust raw client identity; they trust this context.
 */
export interface RequestContext {
  actor: User;
  requestId: string;
}

/** Identity used when the platform itself is the actor (e.g. AI summaries). */
export const SYSTEM_ACTOR_ID = 'system';
