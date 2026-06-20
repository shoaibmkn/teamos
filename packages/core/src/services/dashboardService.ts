// Dashboard engine. Computes the employee, manager, and executive views.
// Read-only: dashboards never mutate records and tolerate a missing AI summary
// (architecture.md — AI failures never block source-of-truth reads).

import type { Summary, Task, User } from '../domain/entities';
import { forbidden } from '../domain/errors';
import type {
  EvidenceRepository,
  SummaryRepository,
  TaskRepository,
  UserRepository,
  WorkflowInstanceRepository,
} from '../repositories/interfaces';
import { canReadTeam } from './rbac';
import {
  bucketTasks,
  computeMetrics,
  isOverdue,
  statusCounts,
  waitingReasonCounts,
  type CoreMetrics,
} from './metrics';
import type { Clock, RequestContext } from './context';

export interface Bottleneck {
  workflowInstanceId: string;
  name: string;
  waiting: number;
  overdue: number;
}

export interface EmployeeDashboard {
  scope: 'Employee';
  metrics: CoreMetrics;
  inbox: Task[];
  assigned: Task[];
  inProgress: Task[];
  waiting: Task[];
  review: Task[];
  dueSoon: Task[];
  overdue: Task[];
  summary: Summary | null;
}

export interface ManagerDashboard {
  scope: 'Manager';
  metrics: CoreMetrics;
  team: Pick<User, 'id' | 'displayName' | 'role'>[];
  delayed: Task[];
  waiting: Task[];
  waitingReasons: Record<string, number>;
  slaRisk: Task[];
  evidenceGaps: Task[];
  bottlenecks: Bottleneck[];
  summary: Summary | null;
}

export interface ExecutiveDashboard {
  scope: 'Executive';
  metrics: CoreMetrics;
  statusCounts: Record<string, number>;
  completionTrend: { date: string; completed: number }[];
  bottlenecks: Bottleneck[];
  summary: Summary | null;
}

export class DashboardService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly evidence: EvidenceRepository,
    private readonly users: UserRepository,
    private readonly instances: WorkflowInstanceRepository,
    private readonly summaries: SummaryRepository,
    private readonly clock: Clock,
  ) {}

  private async evidenceCountMap(tasks: Task[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    for (const t of tasks) map.set(t.id, await this.evidence.countByTask(t.id));
    return map;
  }

  private async latestSummary(scopeType: Summary['scopeType'], scopeId?: string): Promise<Summary | null> {
    const filter = scopeId ? { scopeType, scopeId } : { scopeType };
    const list = await this.summaries.list(filter);
    return list[0] ?? null;
  }

  private async bottlenecks(tasks: Task[], now: Date): Promise<Bottleneck[]> {
    const byInstance = new Map<string, { waiting: number; overdue: number }>();
    for (const t of tasks) {
      if (!t.workflowInstanceId) continue;
      const agg = byInstance.get(t.workflowInstanceId) ?? { waiting: 0, overdue: 0 };
      if (t.status === 'Waiting Internal' || t.status === 'Waiting External') agg.waiting += 1;
      if (isOverdue(t, now)) agg.overdue += 1;
      byInstance.set(t.workflowInstanceId, agg);
    }
    const out: Bottleneck[] = [];
    for (const [id, agg] of byInstance) {
      if (agg.waiting === 0 && agg.overdue === 0) continue;
      const instance = await this.instances.getById(id);
      out.push({ workflowInstanceId: id, name: instance?.name ?? id, waiting: agg.waiting, overdue: agg.overdue });
    }
    return out.sort((a, b) => b.overdue + b.waiting - (a.overdue + a.waiting)).slice(0, 5);
  }

  async employee(ctx: RequestContext): Promise<EmployeeDashboard> {
    const now = this.clock();
    const page = await this.tasks.list({ assigneeUserId: ctx.actor.id });
    const tasks = page.items;
    const counts = await this.evidenceCountMap(tasks);
    const buckets = bucketTasks(tasks, now);
    return {
      scope: 'Employee',
      metrics: computeMetrics(tasks, counts, now),
      inbox: buckets.inbox,
      assigned: buckets.assigned,
      inProgress: buckets.inProgress,
      waiting: buckets.waiting,
      review: buckets.review,
      dueSoon: buckets.dueSoon,
      overdue: buckets.overdue,
      summary: await this.latestSummary('Employee', ctx.actor.id),
    };
  }

  async manager(ctx: RequestContext): Promise<ManagerDashboard> {
    if (!canReadTeam(ctx.actor.role)) throw forbidden('Manager dashboard requires manager or admin role.');
    const now = this.clock();

    const page =
      ctx.actor.role === 'Admin'
        ? await this.tasks.list({})
        : await this.tasks.list({ managerUserId: ctx.actor.id });
    const tasks = page.items;
    const counts = await this.evidenceCountMap(tasks);
    const buckets = bucketTasks(tasks, now);

    const teamUsers =
      ctx.actor.role === 'Admin'
        ? await this.users.list({ status: 'Active' })
        : await this.users.list({ managerUserId: ctx.actor.id, status: 'Active' });

    return {
      scope: 'Manager',
      metrics: computeMetrics(tasks, counts, now),
      team: teamUsers.map((u) => ({ id: u.id, displayName: u.displayName, role: u.role })),
      delayed: buckets.overdue,
      waiting: buckets.waiting,
      waitingReasons: waitingReasonCounts(tasks),
      slaRisk: buckets.dueSoon,
      evidenceGaps: buckets.completed.filter((t) => (counts.get(t.id) ?? 0) === 0),
      bottlenecks: await this.bottlenecks(tasks, now),
      summary: await this.latestSummary('Manager', ctx.actor.id),
    };
  }

  async executive(ctx: RequestContext): Promise<ExecutiveDashboard> {
    if (ctx.actor.role !== 'Admin') throw forbidden('Executive dashboard requires admin role.');
    const now = this.clock();

    const page = await this.tasks.list({});
    const tasks = page.items;
    const counts = await this.evidenceCountMap(tasks);

    return {
      scope: 'Executive',
      metrics: computeMetrics(tasks, counts, now),
      statusCounts: statusCounts(tasks),
      completionTrend: completionTrend(tasks, now, 7),
      bottlenecks: await this.bottlenecks(tasks, now),
      summary: await this.latestSummary('Executive'),
    };
  }
}

function completionTrend(tasks: Task[], now: Date, days: number): { date: string; completed: number }[] {
  const out: { date: string; completed: number }[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = day.toISOString().slice(0, 10);
    const completed = tasks.filter((t) => t.completedAt && t.completedAt.slice(0, 10) === key).length;
    out.push({ date: key, completed });
  }
  return out;
}
