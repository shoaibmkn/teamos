// AI advisory service. The ONLY write capability injected here is the summary
// repository (ADR-0003): the service can read scoped data and persist summary
// records, but has no path to mutate tasks, evidence, workflows, or users.
// Authorization restricts each scope to the least-privilege caller.

import type { Activity, Summary, Task } from '../domain/entities';
import { forbidden } from '../domain/errors';
import { newId } from '../domain/ids';
import { SummaryScopes, type SummaryScope } from '../domain/enums';
import type { AiProvider, AiSummaryInput, RiskSignal } from '../ai/provider';
import { deriveRiskMetrics } from '../ai/sanitize';
import type {
  ActivityRepository,
  EvidenceRepository,
  SummaryRepository,
  TaskRepository,
  UserRepository,
  WorkflowInstanceRepository,
} from '../repositories/interfaces';
import { recordActivity } from './activity';
import { canGenerateExecutiveSummary, canGenerateTeamSummary } from './rbac';
import { collectNotes, computeMetrics, toSnapshots } from './metrics';
import { nowIso, type Clock, type RequestContext } from './context';
import { assertEnum, assertIdPrefix, assertIsoDate } from './validation';

export interface GenerateSummaryInput {
  scopeType: unknown;
  scopeId?: unknown;
  periodStart: unknown;
  periodEnd: unknown;
}

export interface GeneratedSummary {
  summary: Summary;
  risk: RiskSignal[];
  activity: Activity;
}

export class AiService {
  constructor(
    private readonly ai: AiProvider,
    private readonly tasks: TaskRepository,
    private readonly evidence: EvidenceRepository,
    private readonly users: UserRepository,
    private readonly instances: WorkflowInstanceRepository,
    private readonly summaries: SummaryRepository,
    private readonly activity: ActivityRepository,
    private readonly clock: Clock,
  ) {}

  async generateSummary(ctx: RequestContext, input: GenerateSummaryInput): Promise<GeneratedSummary> {
    const scopeType = assertEnum(input.scopeType, SummaryScopes, 'scopeType') as SummaryScope;
    const periodStart = assertIsoDate(input.periodStart, 'periodStart');
    const periodEnd = assertIsoDate(input.periodEnd, 'periodEnd');

    const scopeId = await this.authorizeAndResolveScope(ctx, scopeType, input.scopeId);
    const { tasks, label } = await this.gatherScope(scopeType, scopeId, ctx);

    const now = this.clock();
    const counts = new Map<string, number>();
    for (const t of tasks) counts.set(t.id, await this.evidence.countByTask(t.id));
    const core = computeMetrics(tasks, counts, now);
    const riskMetrics = deriveRiskMetrics(
      tasks.map((t) => ({ overdue: false, status: t.status, hasEvidence: (counts.get(t.id) ?? 0) > 0 })),
    );

    const aiInput: AiSummaryInput = {
      scopeType,
      scopeLabel: label,
      periodStart,
      periodEnd,
      metrics: {
        total: core.total,
        completed: core.completed,
        overdue: core.overdue,
        waiting: core.waiting,
        inProgress: core.inProgress,
        review: core.review,
        evidenceGaps: riskMetrics.evidenceGaps,
        blocked: core.blocked,
      },
      notes: collectNotes(tasks),
      tasks: toSnapshots(tasks, counts, now),
    };

    const output = await this.ai.summarize(aiInput);

    const summaryRecord: Summary = {
      id: newId('summary'),
      scopeType,
      periodStart,
      periodEnd,
      model: output.model,
      promptVersion: output.promptVersion,
      summaryText: output.summaryText,
      createdAt: nowIso(this.clock),
      createdBy: ctx.actor.id,
    };
    if (scopeId) summaryRecord.scopeId = scopeId;
    if (output.risk.length > 0) summaryRecord.riskJson = JSON.stringify(output.risk);

    const summary = await this.summaries.create(summaryRecord);
    const activity = await recordActivity(
      this.activity,
      ctx,
      { entityType: 'Summary', entityId: summary.id, action: 'SummaryGenerated', metadata: { scopeType, model: output.model } },
      this.clock,
    );

    return { summary, risk: output.risk, activity };
  }

  private async authorizeAndResolveScope(
    ctx: RequestContext,
    scopeType: SummaryScope,
    rawScopeId: unknown,
  ): Promise<string | undefined> {
    const role = ctx.actor.role;

    if (scopeType === 'Executive') {
      if (!canGenerateExecutiveSummary(role)) throw forbidden('Only admins can generate executive summaries.');
      return undefined;
    }

    if (scopeType === 'Manager') {
      if (!canGenerateTeamSummary(role)) throw forbidden('Only managers and admins can generate team summaries.');
      const scopeId = assertIdPrefix(rawScopeId, 'usr', 'scopeId');
      if (role === 'Manager' && scopeId !== ctx.actor.id) {
        throw forbidden('Managers can only generate their own team summary.');
      }
      return scopeId;
    }

    if (scopeType === 'Employee') {
      const scopeId = assertIdPrefix(rawScopeId, 'usr', 'scopeId');
      if (role === 'Admin') return scopeId;
      if (scopeId === ctx.actor.id) return scopeId;
      if (role === 'Manager') {
        const target = await this.users.getById(scopeId);
        if (target && target.managerUserId === ctx.actor.id) return scopeId;
      }
      throw forbidden('You can only generate your own summary.');
    }

    // Workflow scope
    const scopeId = assertIdPrefix(rawScopeId, 'wfi', 'scopeId');
    const instance = await this.instances.getById(scopeId);
    if (!instance) throw forbidden('Workflow not found.');
    if (role === 'Admin' || instance.ownerUserId === ctx.actor.id) return scopeId;
    if (role === 'Manager' && canGenerateTeamSummary(role)) return scopeId;
    throw forbidden('Workflow summary not in your scope.');
  }

  private async gatherScope(
    scopeType: SummaryScope,
    scopeId: string | undefined,
    ctx: RequestContext,
  ): Promise<{ tasks: Task[]; label: string }> {
    if (scopeType === 'Executive') {
      const page = await this.tasks.list({});
      return { tasks: page.items, label: 'Organization' };
    }
    if (scopeType === 'Manager') {
      const page = await this.tasks.list({ managerUserId: scopeId! });
      return { tasks: page.items, label: `Team of ${scopeId}` };
    }
    if (scopeType === 'Employee') {
      const page = await this.tasks.list({ assigneeUserId: scopeId! });
      const user = await this.users.getById(scopeId!);
      return { tasks: page.items, label: user?.displayName ?? scopeId! };
    }
    // Workflow
    const page = await this.tasks.list({ workflowInstanceId: scopeId! });
    const instance = await this.instances.getById(scopeId!);
    void ctx;
    return { tasks: page.items, label: instance?.name ?? scopeId! };
  }
}
