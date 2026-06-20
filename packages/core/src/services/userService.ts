// User-facing identity service. Resolves the authenticated caller and exposes
// the /me contract. Archived users are denied access (security-model.md).

import type { User } from '../domain/entities';
import { forbidden, unauthenticated } from '../domain/errors';
import type { UserRepository } from '../repositories/interfaces';
import { assertAllowedDomain } from './validation';
import { permissionsFor, managesUser } from './rbac';
import type { RequestContext } from './context';

export interface MeResponse {
  user: Pick<User, 'id' | 'email' | 'displayName' | 'role' | 'department'>;
  permissions: string[];
}

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly allowedDomains: string[],
  ) {}

  /**
   * Resolve a Workspace email to an internal active user. Called by the API
   * layer on every request to build the request context. Enforces domain
   * allow-list and archived-user denial.
   */
  async resolveActiveByEmail(email: string): Promise<User> {
    assertAllowedDomain(email, this.allowedDomains);
    const user = await this.users.getByEmail(email);
    if (!user) throw unauthenticated('No TeamOS account for this identity.');
    if (user.status !== 'Active') throw forbidden('User account is archived.');
    return user;
  }

  me(ctx: RequestContext): MeResponse {
    const u = ctx.actor;
    const view: MeResponse['user'] = {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
    };
    if (u.department) view.department = u.department;
    return { user: view, permissions: permissionsFor(u.role) };
  }

  /** Team members visible to the caller. */
  async listTeam(ctx: RequestContext): Promise<User[]> {
    if (ctx.actor.role === 'Admin') {
      return (await this.users.list({ status: 'Active' }));
    }
    if (ctx.actor.role === 'Manager') {
      const reports = await this.users.list({ managerUserId: ctx.actor.id, status: 'Active' });
      return [ctx.actor, ...reports.filter((r) => r.id !== ctx.actor.id)];
    }
    return [ctx.actor];
  }

  async getByIdScoped(ctx: RequestContext, userId: string): Promise<User> {
    const target = await this.users.getById(userId);
    if (!target) throw forbidden('User not visible.');
    if (!managesUser(ctx.actor, target)) throw forbidden('User not in your scope.');
    return target;
  }
}
