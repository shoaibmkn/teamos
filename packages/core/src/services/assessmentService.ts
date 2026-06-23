// Assessment engine. Computes per-employee operational KPIs over a trailing
// window (e.g. last 6 months) for performance reviews. Read-only; reuses task
// and evidence data. Manager sees their reports; admin sees anyone; an employee
// can see only their own.

import type { Task, User } from '../domain/entities';
import { forbidden, notFound } from '../domain/errors';
import type { EvidenceRepository, TaskRepository, UserRepository } from '../repositories/interfaces';
import { managesUser } from './rbac';
import type { Clock, RequestContext } from './context';

export interface MonthlyPoint {
  month: string; // YYYY-MM
  completed: number;
  onTime: number;
  rate: number; // on-time % of completed-with-due
}

export interface EmployeeAssessment {
  user: { id: string; displayName: string; email: string; department?: string };
  periodStart: string;
  periodEnd: string;
  months: number;
  assigned: number;
  completed: number;
  completionRate: number;
  onTimeRate: number;
  overdue: number;
  evidenceRate: number;
  avgCycleDays: number;
  waitingReasons: Record<string, number>;
  monthly: MonthlyPoint[];
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function lastMonths(now: Date, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

export class AssessmentService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly evidence: EvidenceRepository,
    private readonly users: UserRepository,
    private readonly clock: Clock,
  ) {}

  private async authorize(ctx: RequestContext, employeeId: string): Promise<User> {
    const target = await this.users.getById(employeeId);
    if (!target) throw notFound('User not found.');
    if (ctx.actor.role === 'Admin') return target;
    if (ctx.actor.id === employeeId) return target;
    if (ctx.actor.role === 'Manager' && managesUser(ctx.actor, target)) return target;
    throw forbidden('This assessment is not in your scope.');
  }

  async forEmployee(ctx: RequestContext, employeeId: string, months = 6): Promise<EmployeeAssessment> {
    const window = Math.min(Math.max(Math.trunc(months) || 6, 1), 24);
    const target = await this.authorize(ctx, employeeId);
    const now = this.clock();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (window - 1), 1));
    const startIso = start.toISOString();

    const all = (await this.tasks.list({ assigneeUserId: employeeId, includeArchived: true })).items;
    const inPeriod = all.filter((t) => t.createdAt >= startIso || (t.completedAt ?? '') >= startIso);

    const completedTasks = inPeriod.filter((t) => t.status === 'Completed' && t.completedAt);
    const assigned = inPeriod.length;
    const completed = completedTasks.length;

    const withDue = completedTasks.filter((t) => t.dueAt);
    const onTime = withDue.filter((t) => (t.completedAt ?? '') <= (t.dueAt ?? '')).length;

    let evidenceOk = 0;
    for (const t of completedTasks) if ((await this.evidence.countByTask(t.id)) > 0) evidenceOk += 1;

    const cycles = completedTasks.map((t) => (Date.parse(t.completedAt!) - Date.parse(t.createdAt)) / 86400000);
    const avgCycleDays = cycles.length ? round1(cycles.reduce((a, b) => a + b, 0) / cycles.length) : 0;

    const overdue = all.filter(
      (t) => t.dueAt && t.status !== 'Completed' && t.status !== 'Cancelled' && Date.parse(t.dueAt) < now.getTime(),
    ).length;

    const waitingReasons: Record<string, number> = {};
    for (const t of inPeriod) {
      if ((t.status === 'Waiting Internal' || t.status === 'Waiting External') && t.waitingReason) {
        waitingReasons[t.waitingReason] = (waitingReasons[t.waitingReason] ?? 0) + 1;
      }
    }

    const monthly: MonthlyPoint[] = lastMonths(now, window).map((m) => {
      const monthCompleted = completedTasks.filter((t) => monthKey(t.completedAt!) === m);
      const monthDue = monthCompleted.filter((t) => t.dueAt);
      const monthOnTime = monthDue.filter((t) => (t.completedAt ?? '') <= (t.dueAt ?? '')).length;
      return {
        month: m,
        completed: monthCompleted.length,
        onTime: monthOnTime,
        rate: monthDue.length ? Math.round((monthOnTime / monthDue.length) * 100) : 0,
      };
    });

    const user: EmployeeAssessment['user'] = { id: target.id, displayName: target.displayName, email: target.email };
    if (target.department) user.department = target.department;

    return {
      user,
      periodStart: startIso.slice(0, 10),
      periodEnd: now.toISOString().slice(0, 10),
      months: window,
      assigned,
      completed,
      completionRate: assigned ? Math.round((completed / assigned) * 100) : 0,
      onTimeRate: withDue.length ? Math.round((onTime / withDue.length) * 100) : 0,
      overdue,
      evidenceRate: completed ? Math.round((evidenceOk / completed) * 100) : 0,
      avgCycleDays,
      waitingReasons,
      monthly,
    };
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Flatten an assessment to CSV (one metric per row) for download/Sheets. */
export function assessmentToCsv(a: EmployeeAssessment): string {
  const rows: [string, string | number][] = [
    ['Employee', a.user.displayName],
    ['Email', a.user.email],
    ['Department', a.user.department ?? ''],
    ['Period start', a.periodStart],
    ['Period end', a.periodEnd],
    ['Months', a.months],
    ['Tasks assigned', a.assigned],
    ['Tasks completed', a.completed],
    ['Completion rate %', a.completionRate],
    ['On-time rate %', a.onTimeRate],
    ['Currently overdue', a.overdue],
    ['Evidence rate %', a.evidenceRate],
    ['Avg cycle days', a.avgCycleDays],
  ];
  for (const m of a.monthly) rows.push([`On-time ${m.month} %`, m.rate]);
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return ['Metric,Value', ...rows.map(([k, v]) => `${esc(k)},${esc(v)}`)].join('\n');
}
