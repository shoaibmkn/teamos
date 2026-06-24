// Daily check-in / check-out. One DayLog per user per day. Lets the team mark
// the start and end of their working day; managers see who is on the clock.
// "On the clock" = checked in today and not yet checked out — this is the
// reliable green-light signal (real Google-presence is not exposed by any
// free API).

import type { DayLog, User } from '../domain/entities';
import { forbidden, validation } from '../domain/errors';
import { newId } from '../domain/ids';
import type { DayLogRepository, UserRepository } from '../repositories/interfaces';
import { canReadTeam } from './rbac';
import { nowIso, type Clock, type RequestContext } from './context';
import { optionalString } from './validation';

export interface AttendanceEntry {
  user: { id: string; displayName: string; role: User['role'] };
  log: DayLog | null;
  onClock: boolean;
}

export class AttendanceService {
  constructor(
    private readonly dayLogs: DayLogRepository,
    private readonly users: UserRepository,
    private readonly clock: Clock,
    private readonly timezone?: string,
  ) {}

  /** Local calendar date (YYYY-MM-DD) in the configured timezone. */
  private today(): string {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: this.timezone || 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(this.clock());
    } catch {
      return this.clock().toISOString().slice(0, 10);
    }
  }

  async myToday(ctx: RequestContext): Promise<DayLog | null> {
    return this.dayLogs.getByUserAndDate(ctx.actor.id, this.today());
  }

  /** Idempotent: returns the existing record if already checked in today. */
  async checkIn(ctx: RequestContext, input: { note?: unknown } = {}): Promise<DayLog> {
    const existing = await this.dayLogs.getByUserAndDate(ctx.actor.id, this.today());
    if (existing) return existing;
    const note = optionalString(input.note, 'note');
    const now = nowIso(this.clock);
    const log: DayLog = {
      id: newId('dayLog'),
      userId: ctx.actor.id,
      date: this.today(),
      checkInAt: now,
      createdAt: now,
    };
    if (note) log.checkInNote = note;
    return this.dayLogs.create(log);
  }

  async checkOut(ctx: RequestContext, input: { note?: unknown } = {}): Promise<DayLog> {
    const existing = await this.dayLogs.getByUserAndDate(ctx.actor.id, this.today());
    if (!existing) throw validation('Check in before checking out.');
    if (existing.checkOutAt) return existing;
    const note = optionalString(input.note, 'note');
    const patch: Partial<DayLog> = { checkOutAt: nowIso(this.clock) };
    if (note) patch.checkOutNote = note;
    return this.dayLogs.update(existing.id, patch);
  }

  /** Today's attendance for the caller's scope. Managers and admins only. */
  async teamToday(ctx: RequestContext): Promise<AttendanceEntry[]> {
    if (!canReadTeam(ctx.actor.role)) throw forbidden('Team attendance requires manager or admin.');
    const scope =
      ctx.actor.role === 'Admin'
        ? await this.users.list({ status: 'Active' })
        : [ctx.actor, ...(await this.users.list({ managerUserId: ctx.actor.id, status: 'Active' }))].filter(
            (u, i, arr) => arr.findIndex((x) => x.id === u.id) === i,
          );

    const logs = await this.dayLogs.listByDate(this.today());
    const byUser = new Map(logs.map((l) => [l.userId, l]));

    return scope.map((u) => {
      const log = byUser.get(u.id) ?? null;
      return {
        user: { id: u.id, displayName: u.displayName, role: u.role },
        log,
        onClock: Boolean(log && log.checkInAt && !log.checkOutAt),
      };
    });
  }
}
