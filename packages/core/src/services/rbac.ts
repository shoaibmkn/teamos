// Role-based access control. Mirrors the RBAC summary table in api-spec.md.
// Authorization is enforced here in services, never solely in the UI
// (security-model.md). Scope checks that need record data live in the
// individual services; this module owns role-level capability checks.

import type { Role } from '../domain/enums';
import type { User } from '../domain/entities';

const TEAM_ROLES: readonly Role[] = ['Admin', 'Manager'];

export function canReadTeam(role: Role): boolean {
  return TEAM_ROLES.includes(role);
}

export function canCreateTask(role: Role): boolean {
  return TEAM_ROLES.includes(role);
}

export function canManageUsers(role: Role): boolean {
  return role === 'Admin';
}

export function canCreateTemplate(role: Role): boolean {
  return TEAM_ROLES.includes(role);
}

export function canStartInstance(role: Role): boolean {
  return TEAM_ROLES.includes(role);
}

export function canGenerateTeamSummary(role: Role): boolean {
  return TEAM_ROLES.includes(role);
}

export function canGenerateExecutiveSummary(role: Role): boolean {
  return role === 'Admin';
}

/**
 * Flat permission strings returned by GET /me so the frontend can render
 * affordances. These are convenience hints only; the server re-checks every
 * write.
 */
export function permissionsFor(role: Role): string[] {
  const base = ['task:read:self', 'task:update:self', 'summary:generate:self'];
  if (role === 'Employee') return base;

  const team = [
    ...base,
    'task:read:team',
    'task:create',
    'workflow:template:create',
    'workflow:instance:start',
    'summary:generate:team',
  ];
  if (role === 'Manager') return team;

  // Admin
  return [
    ...team,
    'user:manage',
    'task:read:org',
    'summary:generate:executive',
  ];
}

/**
 * True when the actor manages the given user (direct report) or is an Admin.
 * Used by services for team-scope reads and writes.
 */
export function managesUser(actor: User, target: Pick<User, 'id' | 'managerUserId'>): boolean {
  if (actor.role === 'Admin') return true;
  if (actor.role === 'Manager') return target.managerUserId === actor.id || target.id === actor.id;
  return target.id === actor.id;
}
