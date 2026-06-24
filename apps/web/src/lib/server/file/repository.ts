// File-backed implementation of the core Repositories interface. Persists the
// whole dataset to a JSON file (Docker volume) after every write. Enforces the
// same invariants as the other backends: append-only activity, immutable
// evidence, no hard deletes.

import 'server-only';
import type {
  Activity,
  DayLog,
  Evidence,
  Notification,
  Subtask,
  Summary,
  Task,
  TaskMessage,
  User,
  WorkflowInstance,
  WorkflowStage,
  WorkflowTemplate,
} from '@teamos/core';
import type {
  ActivityRepository,
  DayLogRepository,
  EvidenceRepository,
  ListOptions,
  NotificationRepository,
  Page,
  Repositories,
  SubtaskRepository,
  SummaryRepository,
  TaskFilter,
  TaskMessageRepository,
  TaskRepository,
  UserRepository,
  WorkflowInstanceRepository,
  WorkflowStageRepository,
  WorkflowTemplateRepository,
} from '@teamos/core';
import { type Snapshot, createSaver, loadSnapshot } from './store';

const clone = <T>(v: T): T => structuredClone(v);

function encodeCursor(i: number): string {
  return Buffer.from(`o:${i}`, 'utf8').toString('base64url');
}
function decodeCursor(c?: string): number {
  if (!c) return 0;
  try {
    const n = Number.parseInt(Buffer.from(c, 'base64url').toString('utf8').replace(/^o:/, ''), 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export async function createFileRepositories(path: string): Promise<Repositories> {
  const snap = await loadSnapshot(path);
  const save = createSaver(path, snap);

  function replace<T extends { id: string }>(arr: T[], id: string, patch: Partial<T>, label: string): T {
    const idx = arr.findIndex((x) => x.id === id);
    if (idx < 0) throw new Error(`${label} not found: ${id}`);
    const next = { ...arr[idx], ...patch, id } as T;
    arr[idx] = next;
    return next;
  }

  const users: UserRepository = {
    async getById(id) {
      return clone(snap.users.find((u) => u.id === id) ?? null);
    },
    async getByEmail(email) {
      const t = email.trim().toLowerCase();
      return clone(snap.users.find((u) => u.email.toLowerCase() === t) ?? null);
    },
    async list(filter) {
      return snap.users
        .filter((u) => (filter?.role ? u.role === filter.role : true))
        .filter((u) => (filter?.managerUserId ? u.managerUserId === filter.managerUserId : true))
        .filter((u) => (filter?.status ? u.status === filter.status : true))
        .map(clone);
    },
    async create(u) {
      snap.users.push(clone(u));
      await save();
      return clone(u);
    },
    async update(id, patch) {
      const next = replace(snap.users, id, patch, 'User');
      await save();
      return clone(next);
    },
  };

  const workflowTemplates: WorkflowTemplateRepository = {
    async getById(id) {
      return clone(snap.workflowTemplates.find((x) => x.id === id) ?? null);
    },
    async list(filter) {
      return snap.workflowTemplates
        .filter((x) => (filter?.status ? x.status === filter.status : true))
        .filter((x) => (filter?.ownerUserId ? x.ownerUserId === filter.ownerUserId : true))
        .map(clone);
    },
    async create(x) {
      snap.workflowTemplates.push(clone(x));
      await save();
      return clone(x);
    },
    async update(id, patch) {
      const next = replace(snap.workflowTemplates, id, patch, 'Template');
      await save();
      return clone(next);
    },
  };

  const workflowStages: WorkflowStageRepository = {
    async getById(id) {
      return clone(snap.workflowStages.find((x) => x.id === id) ?? null);
    },
    async listByTemplate(templateId) {
      return snap.workflowStages
        .filter((s) => s.workflowTemplateId === templateId)
        .sort((a, b) => a.order - b.order)
        .map(clone);
    },
    async create(x) {
      snap.workflowStages.push(clone(x));
      await save();
      return clone(x);
    },
    async update(id, patch) {
      const next = replace(snap.workflowStages, id, patch, 'Stage');
      await save();
      return clone(next);
    },
  };

  const workflowInstances: WorkflowInstanceRepository = {
    async getById(id) {
      return clone(snap.workflowInstances.find((x) => x.id === id) ?? null);
    },
    async list(filter) {
      return snap.workflowInstances
        .filter((i) => (filter?.status ? i.status === filter.status : true))
        .filter((i) => (filter?.ownerUserId ? i.ownerUserId === filter.ownerUserId : true))
        .filter((i) => (filter?.workflowTemplateId ? i.workflowTemplateId === filter.workflowTemplateId : true))
        .map(clone);
    },
    async create(x) {
      snap.workflowInstances.push(clone(x));
      await save();
      return clone(x);
    },
    async update(id, patch) {
      const next = replace(snap.workflowInstances, id, patch, 'Instance');
      await save();
      return clone(next);
    },
  };

  const tasks: TaskRepository = {
    async getById(id) {
      return clone(snap.tasks.find((x) => x.id === id) ?? null);
    },
    async list(filter?: TaskFilter, options?: ListOptions): Promise<Page<Task>> {
      const matched = snap.tasks
        .filter((t) => (filter?.includeArchived ? true : !t.archivedAt))
        .filter((t) => (filter?.status ? t.status === filter.status : true))
        .filter((t) => (filter?.assigneeUserId ? t.assigneeUserId === filter.assigneeUserId : true))
        .filter((t) => (filter?.managerUserId ? t.managerUserId === filter.managerUserId : true))
        .filter((t) => (filter?.workflowInstanceId ? t.workflowInstanceId === filter.workflowInstanceId : true))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      const start = decodeCursor(options?.cursor);
      const limit = options?.limit && options.limit > 0 ? options.limit : matched.length;
      const items = matched.slice(start, start + limit).map(clone);
      const nextIndex = start + limit;
      return nextIndex < matched.length ? { items, nextCursor: encodeCursor(nextIndex) } : { items };
    },
    async create(x) {
      snap.tasks.push(clone(x));
      await save();
      return clone(x);
    },
    async update(id, patch) {
      const next = replace(snap.tasks, id, patch, 'Task');
      await save();
      return clone(next);
    },
  };

  const evidence: EvidenceRepository = {
    async getById(id) {
      return clone(snap.evidence.find((e) => e.id === id) ?? null);
    },
    async listByTask(taskId) {
      return snap.evidence
        .filter((e) => e.taskId === taskId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .map(clone);
    },
    async countByTask(taskId) {
      return snap.evidence.filter((e) => e.taskId === taskId).length;
    },
    async create(e) {
      if (snap.evidence.some((x) => x.id === e.id)) throw new Error(`Evidence already exists: ${e.id}`);
      snap.evidence.push(clone(e));
      await save();
      return clone(e);
    },
  };

  const activity: ActivityRepository = {
    async append(a) {
      snap.activity.push(clone(a));
      await save();
      return clone(a);
    },
    async listByEntity(entityType, entityId, options) {
      const matched = snap.activity
        .filter((a) => a.entityType === entityType && a.entityId === entityId)
        .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
      const limit = options?.limit && options.limit > 0 ? options.limit : matched.length;
      return matched.slice(0, limit).map(clone);
    },
    async listRecent(limit = 50) {
      return [...snap.activity]
        .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
        .slice(0, limit)
        .map(clone);
    },
  };

  const summaries: SummaryRepository = {
    async getById(id) {
      return clone(snap.summaries.find((s) => s.id === id) ?? null);
    },
    async list(filter) {
      return snap.summaries
        .filter((s) => (filter?.scopeType ? s.scopeType === filter.scopeType : true))
        .filter((s) => (filter?.scopeId ? s.scopeId === filter.scopeId : true))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .map(clone);
    },
    async create(s) {
      snap.summaries.push(clone(s));
      await save();
      return clone(s);
    },
  };

  const subtasks: SubtaskRepository = {
    async getById(id) {
      return clone(snap.subtasks.find((s) => s.id === id) ?? null);
    },
    async listByTask(taskId) {
      return snap.subtasks
        .filter((s) => s.taskId === taskId)
        .sort((a, b) => a.order - b.order)
        .map(clone);
    },
    async create(s) {
      snap.subtasks.push(clone(s));
      await save();
      return clone(s);
    },
    async update(id, patch) {
      const next = replace(snap.subtasks, id, patch, 'Subtask');
      await save();
      return clone(next);
    },
  };

  const taskMessages: TaskMessageRepository = {
    async listByTask(taskId) {
      return snap.taskMessages
        .filter((m) => m.taskId === taskId)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
        .map(clone);
    },
    async create(m) {
      snap.taskMessages.push(clone(m));
      await save();
      return clone(m);
    },
  };

  const dayLogs: DayLogRepository = {
    async getByUserAndDate(userId, date) {
      return clone(snap.dayLogs.find((l) => l.userId === userId && l.date === date) ?? null);
    },
    async listByDate(date) {
      return snap.dayLogs.filter((l) => l.date === date).map(clone);
    },
    async listByUser(userId, limit) {
      const matched = snap.dayLogs
        .filter((l) => l.userId === userId)
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      return (limit && limit > 0 ? matched.slice(0, limit) : matched).map(clone);
    },
    async create(l) {
      snap.dayLogs.push(clone(l));
      await save();
      return clone(l);
    },
    async update(id, patch) {
      const next = replace(snap.dayLogs, id, patch, 'DayLog');
      await save();
      return clone(next);
    },
  };

  const notifications: NotificationRepository = {
    async getById(id) {
      return clone(snap.notifications.find((n) => n.id === id) ?? null);
    },
    async listByUser(userId, limit) {
      const matched = snap.notifications
        .filter((n) => n.userId === userId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return (limit && limit > 0 ? matched.slice(0, limit) : matched).map(clone);
    },
    async create(n) {
      snap.notifications.push(clone(n));
      await save();
      return clone(n);
    },
    async update(id, patch) {
      const next = replace(snap.notifications, id, patch, 'Notification');
      await save();
      return clone(next);
    },
  };

  return {
    users,
    workflowTemplates,
    workflowStages,
    workflowInstances,
    tasks,
    evidence,
    activity,
    summaries,
    subtasks,
    taskMessages,
    dayLogs,
    notifications,
  };
}
