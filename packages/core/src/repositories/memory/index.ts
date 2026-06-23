// In-memory repository implementations. Used for local development, the
// runnable web demo, and unit tests. They enforce the same invariants the
// Sheets implementation must honor: append-only activity, immutable evidence,
// no hard deletes. Business rules live in services, not here.

import type {
  Activity,
  Evidence,
  Subtask,
  Summary,
  Task,
  TaskMessage,
  User,
  WorkflowInstance,
  WorkflowStage,
  WorkflowTemplate,
} from '../../domain/entities';
import type { EntityType, InstanceStatus, SummaryScope, TaskStatus } from '../../domain/enums';
import type {
  ActivityRepository,
  EvidenceRepository,
  ListOptions,
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
} from '../interfaces';

function clone<T>(value: T): T {
  return structuredClone(value);
}

function encodeCursor(index: number): string {
  return Buffer.from(`o:${index}`, 'utf8').toString('base64url');
}

function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const n = Number.parseInt(raw.replace(/^o:/, ''), 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

class MemoryUserRepository implements UserRepository {
  private readonly store = new Map<string, User>();

  async getById(id: string): Promise<User | null> {
    const u = this.store.get(id);
    return u ? clone(u) : null;
  }

  async getByEmail(email: string): Promise<User | null> {
    const target = email.trim().toLowerCase();
    for (const u of this.store.values()) {
      if (u.email.toLowerCase() === target) return clone(u);
    }
    return null;
  }

  async list(filter?: { role?: User['role']; managerUserId?: string; status?: User['status'] }): Promise<User[]> {
    return [...this.store.values()]
      .filter((u) => (filter?.role ? u.role === filter.role : true))
      .filter((u) => (filter?.managerUserId ? u.managerUserId === filter.managerUserId : true))
      .filter((u) => (filter?.status ? u.status === filter.status : true))
      .map(clone);
  }

  async create(user: User): Promise<User> {
    this.store.set(user.id, clone(user));
    return clone(user);
  }

  async update(id: string, patch: Partial<User>): Promise<User> {
    const existing = this.store.get(id);
    if (!existing) throw new Error(`User not found: ${id}`);
    const next = { ...existing, ...patch, id: existing.id };
    this.store.set(id, next);
    return clone(next);
  }
}

class MemoryTemplateRepository implements WorkflowTemplateRepository {
  private readonly store = new Map<string, WorkflowTemplate>();

  async getById(id: string): Promise<WorkflowTemplate | null> {
    const t = this.store.get(id);
    return t ? clone(t) : null;
  }

  async list(filter?: { status?: WorkflowTemplate['status']; ownerUserId?: string }): Promise<WorkflowTemplate[]> {
    return [...this.store.values()]
      .filter((t) => (filter?.status ? t.status === filter.status : true))
      .filter((t) => (filter?.ownerUserId ? t.ownerUserId === filter.ownerUserId : true))
      .map(clone);
  }

  async create(template: WorkflowTemplate): Promise<WorkflowTemplate> {
    this.store.set(template.id, clone(template));
    return clone(template);
  }

  async update(id: string, patch: Partial<WorkflowTemplate>): Promise<WorkflowTemplate> {
    const existing = this.store.get(id);
    if (!existing) throw new Error(`Template not found: ${id}`);
    const next = { ...existing, ...patch, id: existing.id };
    this.store.set(id, next);
    return clone(next);
  }
}

class MemoryStageRepository implements WorkflowStageRepository {
  private readonly store = new Map<string, WorkflowStage>();

  async getById(id: string): Promise<WorkflowStage | null> {
    const s = this.store.get(id);
    return s ? clone(s) : null;
  }

  async listByTemplate(workflowTemplateId: string): Promise<WorkflowStage[]> {
    return [...this.store.values()]
      .filter((s) => s.workflowTemplateId === workflowTemplateId)
      .sort((a, b) => a.order - b.order)
      .map(clone);
  }

  async create(stage: WorkflowStage): Promise<WorkflowStage> {
    this.store.set(stage.id, clone(stage));
    return clone(stage);
  }

  async update(id: string, patch: Partial<WorkflowStage>): Promise<WorkflowStage> {
    const existing = this.store.get(id);
    if (!existing) throw new Error(`Stage not found: ${id}`);
    const next = { ...existing, ...patch, id: existing.id };
    this.store.set(id, next);
    return clone(next);
  }
}

class MemoryInstanceRepository implements WorkflowInstanceRepository {
  private readonly store = new Map<string, WorkflowInstance>();

  async getById(id: string): Promise<WorkflowInstance | null> {
    const i = this.store.get(id);
    return i ? clone(i) : null;
  }

  async list(filter?: {
    status?: InstanceStatus;
    ownerUserId?: string;
    workflowTemplateId?: string;
  }): Promise<WorkflowInstance[]> {
    return [...this.store.values()]
      .filter((i) => (filter?.status ? i.status === filter.status : true))
      .filter((i) => (filter?.ownerUserId ? i.ownerUserId === filter.ownerUserId : true))
      .filter((i) => (filter?.workflowTemplateId ? i.workflowTemplateId === filter.workflowTemplateId : true))
      .map(clone);
  }

  async create(instance: WorkflowInstance): Promise<WorkflowInstance> {
    this.store.set(instance.id, clone(instance));
    return clone(instance);
  }

  async update(id: string, patch: Partial<WorkflowInstance>): Promise<WorkflowInstance> {
    const existing = this.store.get(id);
    if (!existing) throw new Error(`Instance not found: ${id}`);
    const next = { ...existing, ...patch, id: existing.id };
    this.store.set(id, next);
    return clone(next);
  }
}

class MemoryTaskRepository implements TaskRepository {
  private readonly store = new Map<string, Task>();

  async getById(id: string): Promise<Task | null> {
    const t = this.store.get(id);
    return t ? clone(t) : null;
  }

  async list(filter?: TaskFilter, options?: ListOptions): Promise<Page<Task>> {
    const matched = [...this.store.values()]
      .filter((t) => (filter?.includeArchived ? true : !t.archivedAt))
      .filter((t) => (filter?.status ? t.status === filter.status : true))
      .filter((t) => (filter?.assigneeUserId ? t.assigneeUserId === filter.assigneeUserId : true))
      .filter((t) => (filter?.managerUserId ? t.managerUserId === filter.managerUserId : true))
      .filter((t) => (filter?.workflowInstanceId ? t.workflowInstanceId === filter.workflowInstanceId : true))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    const start = decodeCursor(options?.cursor);
    const limit = options?.limit && options.limit > 0 ? options.limit : matched.length;
    const slice = matched.slice(start, start + limit).map(clone);
    const nextIndex = start + limit;
    const page: Page<Task> = { items: slice };
    if (nextIndex < matched.length) page.nextCursor = encodeCursor(nextIndex);
    return page;
  }

  async create(task: Task): Promise<Task> {
    this.store.set(task.id, clone(task));
    return clone(task);
  }

  async update(id: string, patch: Partial<Task>): Promise<Task> {
    const existing = this.store.get(id);
    if (!existing) throw new Error(`Task not found: ${id}`);
    const next = { ...existing, ...patch, id: existing.id };
    this.store.set(id, next);
    return clone(next);
  }
}

class MemoryEvidenceRepository implements EvidenceRepository {
  private readonly store = new Map<string, Evidence>();

  async getById(id: string): Promise<Evidence | null> {
    const e = this.store.get(id);
    return e ? clone(e) : null;
  }

  async listByTask(taskId: string): Promise<Evidence[]> {
    return [...this.store.values()]
      .filter((e) => e.taskId === taskId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map(clone);
  }

  async countByTask(taskId: string): Promise<number> {
    let n = 0;
    for (const e of this.store.values()) if (e.taskId === taskId) n += 1;
    return n;
  }

  async create(evidence: Evidence): Promise<Evidence> {
    // Immutable: reject overwrite of an existing id.
    if (this.store.has(evidence.id)) throw new Error(`Evidence already exists: ${evidence.id}`);
    this.store.set(evidence.id, clone(evidence));
    return clone(evidence);
  }
}

class MemoryActivityRepository implements ActivityRepository {
  private readonly log: Activity[] = [];

  async append(activity: Activity): Promise<Activity> {
    this.log.push(clone(activity));
    return clone(activity);
  }

  async listByEntity(entityType: EntityType, entityId: string, options?: ListOptions): Promise<Activity[]> {
    const matched = this.log
      .filter((a) => a.entityType === entityType && a.entityId === entityId)
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
    const limit = options?.limit && options.limit > 0 ? options.limit : matched.length;
    return matched.slice(0, limit).map(clone);
  }

  async listRecent(limit = 50): Promise<Activity[]> {
    return [...this.log]
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
      .slice(0, limit)
      .map(clone);
  }
}

class MemorySummaryRepository implements SummaryRepository {
  private readonly store = new Map<string, Summary>();

  async getById(id: string): Promise<Summary | null> {
    const s = this.store.get(id);
    return s ? clone(s) : null;
  }

  async list(filter?: { scopeType?: SummaryScope; scopeId?: string }): Promise<Summary[]> {
    return [...this.store.values()]
      .filter((s) => (filter?.scopeType ? s.scopeType === filter.scopeType : true))
      .filter((s) => (filter?.scopeId ? s.scopeId === filter.scopeId : true))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map(clone);
  }

  async create(summary: Summary): Promise<Summary> {
    this.store.set(summary.id, clone(summary));
    return clone(summary);
  }
}

class MemorySubtaskRepository implements SubtaskRepository {
  private readonly store = new Map<string, Subtask>();

  async getById(id: string): Promise<Subtask | null> {
    const s = this.store.get(id);
    return s ? clone(s) : null;
  }

  async listByTask(taskId: string): Promise<Subtask[]> {
    return [...this.store.values()]
      .filter((s) => s.taskId === taskId)
      .sort((a, b) => a.order - b.order)
      .map(clone);
  }

  async create(subtask: Subtask): Promise<Subtask> {
    this.store.set(subtask.id, clone(subtask));
    return clone(subtask);
  }

  async update(id: string, patch: Partial<Subtask>): Promise<Subtask> {
    const existing = this.store.get(id);
    if (!existing) throw new Error(`Subtask not found: ${id}`);
    const next = { ...existing, ...patch, id: existing.id };
    this.store.set(id, next);
    return clone(next);
  }
}

class MemoryTaskMessageRepository implements TaskMessageRepository {
  private readonly log: TaskMessage[] = [];

  async listByTask(taskId: string): Promise<TaskMessage[]> {
    return this.log
      .filter((m) => m.taskId === taskId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
      .map(clone);
  }

  async create(message: TaskMessage): Promise<TaskMessage> {
    this.log.push(clone(message));
    return clone(message);
  }
}

export function createInMemoryRepositories(): Repositories {
  return {
    users: new MemoryUserRepository(),
    workflowTemplates: new MemoryTemplateRepository(),
    workflowStages: new MemoryStageRepository(),
    workflowInstances: new MemoryInstanceRepository(),
    tasks: new MemoryTaskRepository(),
    evidence: new MemoryEvidenceRepository(),
    activity: new MemoryActivityRepository(),
    summaries: new MemorySummaryRepository(),
    subtasks: new MemorySubtaskRepository(),
    taskMessages: new MemoryTaskMessageRepository(),
  };
}

// Re-export status types kept here for convenience in seed/demo code.
export type { TaskStatus };
