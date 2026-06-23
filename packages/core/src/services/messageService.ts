// Per-task chat. Messages are scoped to a single task and visible to anyone
// with task access. Append-only — messages cannot be edited or deleted.

import type { TaskMessage } from '../domain/entities';
import { forbidden, notFound } from '../domain/errors';
import { newId } from '../domain/ids';
import type { TaskMessageRepository, TaskRepository } from '../repositories/interfaces';
import { canAccessTask } from './taskService';
import type { NotificationService } from './notificationService';
import { nowIso, type Clock, type RequestContext } from './context';
import { assertNonEmptyString } from './validation';

export class MessageService {
  constructor(
    private readonly messages: TaskMessageRepository,
    private readonly tasks: TaskRepository,
    private readonly notifications: NotificationService,
    private readonly clock: Clock,
  ) {}

  private async requireTaskAccess(ctx: RequestContext, taskId: string) {
    const task = await this.tasks.getById(taskId);
    if (!task) throw notFound('Task not found.');
    if (!canAccessTask(ctx.actor, task)) throw forbidden('Task not in your scope.');
    return task;
  }

  async list(ctx: RequestContext, taskId: string): Promise<TaskMessage[]> {
    await this.requireTaskAccess(ctx, taskId);
    return this.messages.listByTask(taskId);
  }

  async post(ctx: RequestContext, taskId: string, input: { text: unknown }): Promise<TaskMessage> {
    const task = await this.requireTaskAccess(ctx, taskId);
    const text = assertNonEmptyString(input.text, 'text');
    const message: TaskMessage = {
      id: newId('taskMessage'),
      taskId,
      authorUserId: ctx.actor.id,
      text,
      createdAt: nowIso(this.clock),
    };
    const created = await this.messages.create(message);

    // Alert the other task participants (assignee + owning manager).
    await this.notifications.notifyMany([task.assigneeUserId, task.managerUserId], {
      type: 'task_message',
      title: `${ctx.actor.displayName} messaged on "${task.title}"`,
      taskId,
      actorUserId: ctx.actor.id,
    });
    return created;
  }
}
