// Input validation primitives. Every write endpoint validates required fields,
// enum values, ID prefixes, dates, URIs, and the domain rules called out in
// security-model.md and database-design.md. All failures raise VALIDATION_ERROR.

import { validation } from '../domain/errors';
import { hasPrefix, type IdPrefix } from '../domain/ids';
import { isWaitingStatus, type TaskStatus, type WaitingReason } from '../domain/enums';

export function assertNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw validation(`Field "${field}" is required.`, { field });
  }
  return value.trim();
}

export function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw validation(`Field "${field}" must be a string.`, { field });
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function assertEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw validation(`Field "${field}" must be one of: ${allowed.join(', ')}.`, { field, allowed });
  }
  return value as T;
}

export function optionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return assertEnum(value, allowed, field);
}

export function assertIdPrefix(value: unknown, prefix: IdPrefix, field: string): string {
  if (!hasPrefix(value, prefix)) {
    throw validation(`Field "${field}" must be a valid ${prefix}_ id.`, { field });
  }
  return value;
}

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function assertIsoDateTime(value: unknown, field: string): string {
  if (typeof value !== 'string' || !ISO_DATETIME.test(value) || Number.isNaN(Date.parse(value))) {
    throw validation(`Field "${field}" must be an ISO 8601 datetime.`, { field });
  }
  return value;
}

export function optionalIsoDateTime(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return assertIsoDateTime(value, field);
}

export function assertIsoDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !ISO_DATE.test(value) || Number.isNaN(Date.parse(value))) {
    throw validation(`Field "${field}" must be an ISO date (YYYY-MM-DD).`, { field });
  }
  return value;
}

export function assertUri(value: unknown, field: string): string {
  if (typeof value !== 'string') throw validation(`Field "${field}" must be a URI.`, { field });
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('protocol');
    }
    return value;
  } catch {
    throw validation(`Field "${field}" must be a valid http(s) URI.`, { field });
  }
}

export function emailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  return at >= 0 ? email.slice(at + 1).toLowerCase() : '';
}

export function assertAllowedDomain(email: string, allowedDomains: readonly string[]): void {
  // Empty allow-list means "any domain" (single-tenant deployments configure it).
  if (allowedDomains.length === 0) return;
  const domain = emailDomain(email);
  const ok = allowedDomains.some((d) => d.trim().toLowerCase() === domain);
  if (!ok) {
    throw validation('Email does not belong to an allowed Workspace domain.', { domain });
  }
}

/** Waiting reason is required when status is a waiting status (and only then). */
export function requireWaitingReason(status: TaskStatus, waitingReason: WaitingReason | undefined): void {
  if (isWaitingStatus(status) && !waitingReason) {
    throw validation('A waiting reason is required for waiting statuses.', { status });
  }
}

/**
 * Completion rule: a task becoming Completed must carry evidence or a
 * completion comment (database-design.md, security-model.md).
 */
export function requireCompletionEvidence(params: {
  hasEvidence: boolean;
  completionComment: string | undefined;
}): void {
  const comment = params.completionComment?.trim();
  if (!params.hasEvidence && !comment) {
    throw validation('Completion requires evidence or completion comment.');
  }
}
