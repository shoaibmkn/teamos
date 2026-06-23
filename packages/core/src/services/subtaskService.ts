// Subtask / checklist engine. Subtasks live under a task; anyone with task
// access (assignee, owning manager, admin) can add and check them off. Progress
// is simply done/total. Each change is audited.

import type { Subtask } from '../domain/entities';
import { conflict, forbidden, notFound, validation } from '../domain/errors';
import { newId } from '../domain/ids';
import type {
  ActivityRepository,
  SubtaskRepository,
  TaskRepository,
} from '../repositories/interfaces';
import { recordActivity } from './activity';
import { canAccessTask } from './taskService';
import { nowIso, type Clock, type RequestContext } from './context';
import { assertNonEmptyString } from './validation';

export class SubtaskService {
  constructor(
    private readonly subtasks: SubtaskRepository,
    private readonly tasks: TaskRepository,
    private readonly activity: ActivityRepository,
    private readonly clock: Clock,
  ) {}

  private async requireTaskAccess(ctx: RequestContext, taskId: string) {
    const task = await this.tasks.getById(taskId);
    if (!task) throw notFound('Task not found.');
    if (!canAccessTask(ctx.actor, task)) throw forbidden('Task not in your scope.');
    return task;
  }

  async list(ctx: RequestContext, taskId: string): Promise<Subtask[]> {
    await this.requireTaskAccess(ctx, taskId);
    return this.subtasks.listByTask(taskId);
  }

  async add(ctx: RequestContext, taskId: string, input: { title: unknown }): Promise<Subtask> {
    const task = await this.requireTaskAccess(ctx, taskId);
    if (task.archivedAt) throw conflict('Archived tasks cannot be modified.');
    const title = assertNonEmptyString(input.title, 'title');
    const existing = await this.subtasks.listByTask(taskId);
    const now = nowIso(this.clock);
    const subtask: Subtask = {
      id: newId('subtask'),
      taskId,
      title,
      done: false,
      order: existing.length + 1,
      createdAt: now,
      createdBy: ctx.actor.id,
      updatedAt: now,
      updatedBy: ctx.actor.id,
    };
    const created = await this.subtasks.create(subtask);
    await recordActivity(
      this.activity,
      ctx,
      { entityType: 'Subtask', entityId: created.id, action: 'SubtaskAdded', metadata: { taskId } },
      this.clock,
    );
    return created;
  }

  async setDone(ctx: RequestContext, taskId: string, subtaskId: string, done: unknown): Promise<Subtask> {
    const task = await this.requireTaskAccess(ctx, taskId);
    if (task.archivedAt) throw conflict('Archived tasks cannot be modified.');
    const subtask = await this.subtasks.getById(subtaskId);
    if (!subtask || subtask.taskId !== taskId) throw notFound('Subtask not found.');
    if (typeof done !== 'boolean') throw validation('Field "done" must be a boolean.', { field: 'done' });

    const updated = await this.subtasks.update(subtaskId, {
      done,
      updatedAt: nowIso(this.clock),
      updatedBy: ctx.actor.id,
    });
    await recordActivity(
      this.activity,
      ctx,
      { entityType: 'Subtask', entityId: subtaskId, action: 'SubtaskToggled', metadata: { taskId, done } },
      this.clock,
    );
    return updated;
  }
}
