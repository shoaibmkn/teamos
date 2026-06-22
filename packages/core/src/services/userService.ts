// User-facing identity service plus admin user management. Resolves the
// authenticated caller and exposes the /me contract. Archived users are denied
// access (security-model.md). User create/update/archive is Admin-only and
// every change is audited.

import type { User } from '../domain/entities';
import { conflict, forbidden, notFound, unauthenticated } from '../domain/errors';
import { newId } from '../domain/ids';
import { Roles, UserStatuses, type Role } from '../domain/enums';
import type { ActivityRepository, UserRepository } from '../repositories/interfaces';
import { recordActivity } from './activity';
import {
  assertAllowedDomain,
  assertEnum,
  assertNonEmptyString,
  optionalEnum,
  optionalString,
} from './validation';
import { canManageUsers, permissionsFor, managesUser } from './rbac';
import { nowIso, type Clock, type RequestContext } from './context';

export interface MeResponse {
  user: Pick<User, 'id' | 'email' | 'displayName' | 'role' | 'department'>;
  permissions: string[];
}

export interface CreateUserInput {
  email: unknown;
  displayName: unknown;
  role: unknown;
  managerUserId?: unknown;
  department?: unknown;
}

export interface UpdateUserInput {
  displayName?: unknown;
  role?: unknown;
  managerUserId?: unknown;
  department?: unknown;
}

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly allowedDomains: string[],
    private readonly activity: ActivityRepository,
    private readonly clock: Clock,
  ) {}

  async resolveActiveByEmail(email: string): Promise<User> {
    assertAllowedDomain(email, this.allowedDomains);
    const user = await this.users.getByEmail(email);
    if (!user) throw unauthenticated('No TeamOS account for this identity.');
    if (user.status !== 'Active') throw forbidden('User account is archived.');
    return user;
  }

  me(ctx: RequestContext): MeResponse {
    const u = ctx.actor;
    const view: MeResponse['user'] = { id: u.id, email: u.email, displayName: u.displayName, role: u.role };
    if (u.department) view.department = u.department;
    return { user: view, permissions: permissionsFor(u.role) };
  }

  async listTeam(ctx: RequestContext): Promise<User[]> {
    if (ctx.actor.role === 'Admin') return this.users.list({ status: 'Active' });
    if (ctx.actor.role === 'Manager') {
      const reports = await this.users.list({ managerUserId: ctx.actor.id, status: 'Active' });
      return [ctx.actor, ...reports.filter((r) => r.id !== ctx.actor.id)];
    }
    return [ctx.actor];
  }

  /** All users (Admin only) — for the user-management screen. */
  async listAll(ctx: RequestContext): Promise<User[]> {
    if (!canManageUsers(ctx.actor.role)) throw forbidden('Only admins can manage users.');
    return this.users.list();
  }

  async getByIdScoped(ctx: RequestContext, userId: string): Promise<User> {
    const target = await this.users.getById(userId);
    if (!target) throw forbidden('User not visible.');
    if (!managesUser(ctx.actor, target)) throw forbidden('User not in your scope.');
    return target;
  }

  async createUser(ctx: RequestContext, input: CreateUserInput): Promise<User> {
    if (!canManageUsers(ctx.actor.role)) throw forbidden('Only admins can create users.');

    const email = assertNonEmptyString(input.email, 'email').toLowerCase();
    assertAllowedDomain(email, this.allowedDomains);
    const displayName = assertNonEmptyString(input.displayName, 'displayName');
    const role = assertEnum(input.role, Roles, 'role') as Role;
    const managerUserId = optionalString(input.managerUserId, 'managerUserId');
    const department = optionalString(input.department, 'department');

    if (await this.users.getByEmail(email)) throw conflict('A user with this email already exists.');
    if (managerUserId) {
      const mgr = await this.users.getById(managerUserId);
      if (!mgr) throw notFound('Manager not found.');
    }

    const now = nowIso(this.clock);
    const user: User = {
      id: newId('user'),
      email,
      displayName,
      role,
      status: 'Active',
      createdAt: now,
      createdBy: ctx.actor.id,
      updatedAt: now,
      updatedBy: ctx.actor.id,
    };
    if (managerUserId) user.managerUserId = managerUserId;
    if (department) user.department = department;

    const created = await this.users.create(user);
    await recordActivity(
      this.activity,
      ctx,
      { entityType: 'User', entityId: created.id, action: 'UserCreated', metadata: { role, email } },
      this.clock,
    );
    return created;
  }

  async updateUser(ctx: RequestContext, userId: string, input: UpdateUserInput): Promise<User> {
    if (!canManageUsers(ctx.actor.role)) throw forbidden('Only admins can update users.');
    const existing = await this.users.getById(userId);
    if (!existing) throw notFound('User not found.');

    const patch: Partial<User> = { updatedAt: nowIso(this.clock), updatedBy: ctx.actor.id };
    const displayName = optionalString(input.displayName, 'displayName');
    if (displayName) patch.displayName = displayName;
    const role = optionalEnum(input.role, Roles, 'role') as Role | undefined;
    if (role) patch.role = role;
    const managerUserId = optionalString(input.managerUserId, 'managerUserId');
    if (managerUserId !== undefined) patch.managerUserId = managerUserId;
    const department = optionalString(input.department, 'department');
    if (department !== undefined) patch.department = department;

    const updated = await this.users.update(userId, patch);
    await recordActivity(
      this.activity,
      ctx,
      { entityType: 'User', entityId: userId, action: 'UserUpdated' },
      this.clock,
    );
    return updated;
  }

  /** Archive (soft-remove) a user. Admin only; cannot archive self. */
  async archiveUser(ctx: RequestContext, userId: string): Promise<User> {
    if (!canManageUsers(ctx.actor.role)) throw forbidden('Only admins can archive users.');
    if (userId === ctx.actor.id) throw conflict('You cannot archive your own account.');
    const existing = await this.users.getById(userId);
    if (!existing) throw notFound('User not found.');

    const updated = await this.users.update(userId, {
      status: assertEnum('Archived', UserStatuses, 'status'),
      updatedAt: nowIso(this.clock),
      updatedBy: ctx.actor.id,
    });
    await recordActivity(
      this.activity,
      ctx,
      { entityType: 'User', entityId: userId, action: 'UserArchived' },
      this.clock,
    );
    return updated;
  }
}
