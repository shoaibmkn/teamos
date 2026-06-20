// Task engine. Owns task creation, status transitions, and per-task activity.
// Enforces RBAC scope, the completion-evidence rule, and the waiting-reason
// rule. Every mutation appends an immutable activity entry.

import type { Activity, Task, User } from '../domain/entities';
import { conflict, forbidden, notFound, validation } from '../domain/errors';
import { newId } from '../domain/ids';
import {
  Priorities,
  TaskStatuses,
  WaitingReasons,
  isWaitingStatus,
  type Priority,
  type TaskStatus,
  type WaitingReason,
} from '../domain/enums';
import type {
  ActivityRepository,
  EvidenceRepository,
  Page,
  TaskFilter,
  TaskRepository,
  UserRepository,
} from '../repositories/interfaces';
import { recordActivity } from './activity';
import { canCreateTask } from './rbac';
import { nowIso, type Clock, type RequestContext } from './context';
import {
  assertEnum,
  assertIdPrefix,
  assertNonEmptyString,
  optionalEnum,
  optionalIsoDateTime,
  optionalString,
  requireCompletionEvidence,
  requireWaitingReason,
} from './validation';

/** True when the actor may read/write the given task. */
export function canAccessTask(actor: User, task: Task): boolean {
  if (task.assigneeUserId === actor.id) return true;
  if (actor.role === 'Admin') return true;
  if (actor.role === 'Manager') return task.managerUserId === actor.id;
  return false;
}

export interface CreateTaskInput {
  title: unknown;
  description?: unknown;
  assigneeUserId: unknown;
  managerUserId?: unknown;
  workflowInstanceId?: unknown;
  stageId?: unknown;
  priority?: unknown;
  dueAt?: unknown;
}

export interface UpdateStatusInput {
  status: unknown;
  waitingReason?: unknown;
  completionComment?: unknown;
  evidenceIds?: unknown;
}

export interface StatusUpdateResult {
  task: Task;
  activity: Activity;
}

export class TaskService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly users: UserRepository,
    private readonly evidence: EvidenceRepository,
    private readonly activity: ActivityRepository,
    private readonly clock: Clock,
  ) {}

  /** List tasks visible to the caller, intersected with the requested filter. */
  async list(ctx: RequestContext, filter: TaskFilter = {}, options?: { limit?: number; cursor?: string }): Promise<Page<Task>> {
    const scoped: TaskFilter = { ...filter };
    if (ctx.actor.role === 'Employee') {
      // Employees only ever see their own assigned tasks.
      scoped.assigneeUserId = ctx.actor.id;
      delete scoped.managerUserId;
    } else if (ctx.actor.role === 'Manager') {
      // Managers see their team scope unless narrowing to a specific assignee
      // who is still within scope (checked post-hoc below).
      if (!scoped.assigneeUserId) scoped.managerUserId = ctx.actor.id;
    }
    // Admin: no implicit scope (organization-wide).
    const page = await this.tasks.list(scoped, options);
    const visible = page.items.filter((t) => canAccessTask(ctx.actor, t));
    return page.nextCursor ? { items: visible, nextCursor: page.nextCursor } : { items: visible };
  }

  async getScoped(ctx: RequestContext, taskId: string): Promise<Task> {
    const task = await this.tasks.getById(taskId);
    if (!task) throw notFound('Task not found.');
    if (!canAccessTask(ctx.actor, task)) throw forbidden('Task not in your scope.');
    return task;
  }

  async create(ctx: RequestContext, input: CreateTaskInput): Promise<Task> {
    if (!canCreateTask(ctx.actor.role)) throw forbidden('Only managers and admins can create tasks.');

    const title = assertNonEmptyString(input.title, 'title');
    const description = optionalString(input.description, 'description');
    const assigneeUserId = assertIdPrefix(input.assigneeUserId, 'usr', 'assigneeUserId');
    const priority = (optionalEnum(input.priority, Priorities, 'priority') ?? 'Normal') as Priority;
    const dueAt = optionalIsoDateTime(input.dueAt, 'dueAt');
    const workflowInstanceId = optionalString(input.workflowInstanceId, 'workflowInstanceId');
    const stageId = optionalString(input.stageId, 'stageId');

    const assignee = await this.users.getById(assigneeUserId);
    if (!assignee || assignee.status !== 'Active') {
      throw validation('Assignee must be an active user.', { field: 'assigneeUserId' });
    }

    // Managers can only create tasks within their own scope.
    let managerUserId: string;
    if (ctx.actor.role === 'Manager') {
      managerUserId = ctx.actor.id;
    } else {
      managerUserId = input.managerUserId
        ? assertIdPrefix(input.managerUserId, 'usr', 'managerUserId')
        : assignee.managerUserId ?? ctx.actor.id;
      const manager = await this.users.getById(managerUserId);
      if (!manager || manager.status !== 'Active') {
        throw validation('Manager must be an active user.', { field: 'managerUserId' });
      }
    }

    const now = nowIso(this.clock);
    const task: Task = {
      id: newId('task'),
      title,
      assigneeUserId,
      managerUserId,
      status: 'Assigned',
      priority,
      createdAt: now,
      createdBy: ctx.actor.id,
      updatedAt: now,
      updatedBy: ctx.actor.id,
    };
    if (description) task.description = description;
    if (dueAt) task.dueAt = dueAt;
    if (workflowInstanceId) task.workflowInstanceId = workflowInstanceId;
    if (stageId) task.stageId = stageId;

    const created = await this.tasks.create(task);
    await recordActivity(
      this.activity,
      ctx,
      { entityType: 'Task', entityId: created.id, action: 'TaskCreated', metadata: { assigneeUserId, priority } },
      this.clock,
    );
    return created;
  }

  async updateStatus(ctx: RequestContext, taskId: string, input: UpdateStatusInput): Promise<StatusUpdateResult> {
    const task = await this.tasks.getById(taskId);
    if (!task) throw notFound('Task not found.');
    if (!canAccessTask(ctx.actor, task)) throw forbidden('You cannot update this task.');
    if (task.archivedAt) throw conflict('Archived tasks cannot be modified.');

    const nextStatus = assertEnum(input.status, TaskStatuses, 'status') as TaskStatus;
    const waitingReason = optionalEnum(input.waitingReason, WaitingReasons, 'waitingReason') as
      | WaitingReason
      | undefined;
    const completionComment = optionalString(input.completionComment, 'completionComment');

    requireWaitingReason(nextStatus, waitingReason);

    const patch: Partial<Task> = {
      status: nextStatus,
      updatedAt: nowIso(this.clock),
      updatedBy: ctx.actor.id,
    };

    // Waiting reason is set only for waiting statuses; cleared otherwise.
    patch.waitingReason = isWaitingStatus(nextStatus) ? waitingReason : undefined;

    if (nextStatus === 'Completed') {
      const evidenceCount = await this.evidence.countByTask(taskId);
      requireCompletionEvidence({ hasEvidence: evidenceCount > 0, completionComment });
      patch.completedAt = nowIso(this.clock);
      if (completionComment) patch.completionComment = completionComment;
    } else if (completionComment) {
      patch.completionComment = completionComment;
    }

    const updated = await this.tasks.update(taskId, patch);
    const activity = await recordActivity(
      this.activity,
      ctx,
      {
        entityType: 'Task',
        entityId: taskId,
        action: 'TaskStatusChanged',
        metadata: { from: task.status, to: nextStatus, waitingReason: patch.waitingReason ?? null },
      },
      this.clock,
    );
    return { task: updated, activity };
  }

  async getActivity(ctx: RequestContext, taskId: string): Promise<Activity[]> {
    await this.getScoped(ctx, taskId);
    return this.activity.listByEntity('Task', taskId);
  }
}
