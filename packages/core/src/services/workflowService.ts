// Workflow engine. Templates define repeatable processes; instances are live
// executions. Managers/admins author templates and start instances. Instance
// detail assembles stages, tasks, evidence counts, SLA state, and recent
// activity (api-spec GET /workflow-instances/{id}).

import type {
  Activity,
  Task,
  WorkflowInstance,
  WorkflowStage,
  WorkflowTemplate,
} from '../domain/entities';
import { forbidden, notFound, validation } from '../domain/errors';
import { newId } from '../domain/ids';
import { Roles, type Role } from '../domain/enums';
import type {
  ActivityRepository,
  EvidenceRepository,
  TaskRepository,
  UserRepository,
  WorkflowInstanceRepository,
  WorkflowStageRepository,
  WorkflowTemplateRepository,
} from '../repositories/interfaces';
import { recordActivity } from './activity';
import { canCreateTemplate, canReadTeam, canStartInstance } from './rbac';
import { isOverdue } from './metrics';
import { nowIso, type Clock, type RequestContext } from './context';
import {
  assertIdPrefix,
  assertNonEmptyString,
  optionalEnum,
  optionalIsoDateTime,
  optionalString,
} from './validation';

export interface StageInput {
  name: unknown;
  order?: unknown;
  defaultAssigneeRole?: unknown;
  slaHours?: unknown;
  requiredEvidenceType?: unknown;
}

export interface CreateTemplateInput {
  name: unknown;
  description?: unknown;
  slaHours?: unknown;
  stages?: StageInput[];
}

export interface StartInstanceInput {
  workflowTemplateId: unknown;
  name: unknown;
  ownerUserId?: unknown;
  dueAt?: unknown;
}

export interface InstanceDetail {
  instance: WorkflowInstance;
  template: WorkflowTemplate | null;
  stages: WorkflowStage[];
  tasks: Task[];
  evidenceCounts: Record<string, number>;
  sla: { overdueTasks: number; dueAt?: string; overdueInstance: boolean };
  recentActivity: Activity[];
}

function toNumber(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw validation(`Field "${field}" must be a non-negative number.`, { field });
  return n;
}

export class WorkflowService {
  constructor(
    private readonly templates: WorkflowTemplateRepository,
    private readonly stages: WorkflowStageRepository,
    private readonly instances: WorkflowInstanceRepository,
    private readonly tasks: TaskRepository,
    private readonly evidence: EvidenceRepository,
    private readonly users: UserRepository,
    private readonly activity: ActivityRepository,
    private readonly clock: Clock,
  ) {}

  async listTemplates(ctx: RequestContext): Promise<WorkflowTemplate[]> {
    void ctx;
    return this.templates.list({ status: 'Active' });
  }

  async createTemplate(ctx: RequestContext, input: CreateTemplateInput): Promise<{ template: WorkflowTemplate; stages: WorkflowStage[] }> {
    if (!canCreateTemplate(ctx.actor.role)) throw forbidden('Only managers and admins can create templates.');

    const name = assertNonEmptyString(input.name, 'name');
    const description = optionalString(input.description, 'description');
    const slaHours = toNumber(input.slaHours, 'slaHours');
    const now = nowIso(this.clock);

    const template: WorkflowTemplate = {
      id: newId('workflowTemplate'),
      name,
      ownerUserId: ctx.actor.id,
      status: 'Active',
      version: 1,
      createdAt: now,
      createdBy: ctx.actor.id,
      updatedAt: now,
      updatedBy: ctx.actor.id,
    };
    if (description) template.description = description;
    if (slaHours !== undefined) template.slaHours = slaHours;
    await this.templates.create(template);

    const createdStages: WorkflowStage[] = [];
    const stageInputs = Array.isArray(input.stages) ? input.stages : [];
    let order = 1;
    for (const s of stageInputs) {
      const stage: WorkflowStage = {
        id: newId('workflowStage'),
        workflowTemplateId: template.id,
        name: assertNonEmptyString(s.name, 'stage.name'),
        order: toNumber(s.order, 'stage.order') ?? order,
        status: 'Active',
      };
      const role = optionalEnum(s.defaultAssigneeRole, Roles, 'stage.defaultAssigneeRole') as Role | undefined;
      if (role) stage.defaultAssigneeRole = role;
      const stageSla = toNumber(s.slaHours, 'stage.slaHours');
      if (stageSla !== undefined) stage.slaHours = stageSla;
      createdStages.push(await this.stages.create(stage));
      order += 1;
    }

    await recordActivity(
      this.activity,
      ctx,
      { entityType: 'WorkflowTemplate', entityId: template.id, action: 'WorkflowTemplateCreated', metadata: { stages: createdStages.length } },
      this.clock,
    );
    return { template, stages: createdStages };
  }

  async startInstance(ctx: RequestContext, input: StartInstanceInput): Promise<WorkflowInstance> {
    if (!canStartInstance(ctx.actor.role)) throw forbidden('Only managers and admins can start workflows.');

    const workflowTemplateId = assertIdPrefix(input.workflowTemplateId, 'wft', 'workflowTemplateId');
    const name = assertNonEmptyString(input.name, 'name');
    const dueAt = optionalIsoDateTime(input.dueAt, 'dueAt');

    const template = await this.templates.getById(workflowTemplateId);
    if (!template || template.status !== 'Active') {
      throw validation('Workflow template must exist and be active.', { field: 'workflowTemplateId' });
    }

    let ownerUserId = ctx.actor.id;
    if (ctx.actor.role === 'Admin' && input.ownerUserId) {
      ownerUserId = assertIdPrefix(input.ownerUserId, 'usr', 'ownerUserId');
      const owner = await this.users.getById(ownerUserId);
      if (!owner || owner.status !== 'Active') {
        throw validation('Owner must be an active user.', { field: 'ownerUserId' });
      }
    }

    const stages = await this.stages.listByTemplate(workflowTemplateId);
    const now = nowIso(this.clock);
    const instance: WorkflowInstance = {
      id: newId('workflowInstance'),
      workflowTemplateId,
      name,
      status: 'Active',
      ownerUserId,
      startedAt: now,
      createdAt: now,
      createdBy: ctx.actor.id,
      updatedAt: now,
      updatedBy: ctx.actor.id,
    };
    const firstStage = stages[0];
    if (firstStage) instance.currentStageId = firstStage.id;
    if (dueAt) instance.dueAt = dueAt;

    const created = await this.instances.create(instance);
    await recordActivity(
      this.activity,
      ctx,
      { entityType: 'WorkflowInstance', entityId: created.id, action: 'WorkflowInstanceStarted', metadata: { workflowTemplateId } },
      this.clock,
    );
    return created;
  }

  async getInstance(ctx: RequestContext, instanceId: string): Promise<InstanceDetail> {
    const instance = await this.instances.getById(instanceId);
    if (!instance) throw notFound('Workflow instance not found.');

    const isOwner = instance.ownerUserId === ctx.actor.id;
    if (!isOwner && !canReadTeam(ctx.actor.role)) {
      throw forbidden('Workflow instance not in your scope.');
    }

    const template = await this.templates.getById(instance.workflowTemplateId);
    const stages = await this.stages.listByTemplate(instance.workflowTemplateId);
    const taskPage = await this.tasks.list({ workflowInstanceId: instanceId });
    const tasks = taskPage.items;

    const evidenceCounts: Record<string, number> = {};
    for (const t of tasks) evidenceCounts[t.id] = await this.evidence.countByTask(t.id);

    const now = this.clock();
    const overdueTasks = tasks.filter((t) => isOverdue(t, now)).length;
    const overdueInstance = Boolean(
      instance.dueAt && instance.status !== 'Completed' && Date.parse(instance.dueAt) < now.getTime(),
    );

    const recentActivity = (await this.activity.listByEntity('WorkflowInstance', instanceId, { limit: 25 }));

    const sla: InstanceDetail['sla'] = { overdueTasks, overdueInstance };
    if (instance.dueAt) sla.dueAt = instance.dueAt;

    return { instance, template, stages, tasks, evidenceCounts, sla, recentActivity };
  }
}
