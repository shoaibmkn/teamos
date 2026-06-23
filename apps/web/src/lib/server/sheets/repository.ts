// Google Sheets implementation of the core Repositories interface (ADR-0002).
// Reads a tab and filters in memory (fine at team scale); writes append or
// update single rows. Enforces the same invariants as the in-memory backend:
// append-only Activity, immutable Evidence, no hard deletes.

import 'server-only';
import type {
  Activity,
  DayLog,
  Evidence,
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
import { SHEET_COLUMNS, NUMERIC_FIELDS, BOOLEAN_FIELDS, type SheetName } from './schema';
import type { SheetsClient } from './client';

type Row = (string | number)[];

function rowToObj<T>(tab: SheetName, row: string[]): T {
  const headers = SHEET_COLUMNS[tab];
  const obj: Record<string, unknown> = {};
  headers.forEach((h, c) => {
    const raw = row[c];
    if (raw === undefined || raw === '') return;
    if (NUMERIC_FIELDS.has(h)) obj[h] = Number(raw);
    else if (BOOLEAN_FIELDS.has(h)) obj[h] = raw === 'true' || raw === 'TRUE';
    else obj[h] = raw;
  });
  return obj as T;
}

function objToRow(tab: SheetName, obj: Record<string, unknown>): Row {
  return SHEET_COLUMNS[tab].map((h) => {
    const v = obj[h];
    if (v === undefined || v === null) return '';
    return typeof v === 'number' ? v : String(v);
  });
}

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

class Table<T extends { id: string }> {
  constructor(
    private readonly client: SheetsClient,
    private readonly tab: SheetName,
  ) {}

  async all(): Promise<T[]> {
    const rows = await this.client.getRows(this.tab);
    return rows.filter((r) => r[0]).map((r) => rowToObj<T>(this.tab, r));
  }

  async getById(id: string): Promise<T | null> {
    const all = await this.all();
    return all.find((x) => x.id === id) ?? null;
  }

  async create(obj: T): Promise<T> {
    await this.client.appendRow(this.tab, objToRow(this.tab, obj as Record<string, unknown>));
    return obj;
  }

  async update(id: string, patch: Partial<T>): Promise<T> {
    const rows = await this.client.getRows(this.tab);
    const idx = rows.findIndex((r) => r[0] === id);
    if (idx < 0) throw new Error(`${this.tab} not found: ${id}`);
    const current = rowToObj<Record<string, unknown>>(this.tab, rows[idx] ?? []);
    const next = { ...current, ...patch, id } as T;
    await this.client.updateRow(this.tab, idx + 1, objToRow(this.tab, next as Record<string, unknown>));
    return next;
  }
}

class SheetsUserRepository implements UserRepository {
  private t: Table<User>;
  constructor(c: SheetsClient) {
    this.t = new Table(c, 'Users');
  }
  getById(id: string) {
    return this.t.getById(id);
  }
  async getByEmail(email: string) {
    const all = await this.t.all();
    const target = email.trim().toLowerCase();
    return all.find((u) => u.email.toLowerCase() === target) ?? null;
  }
  async list(filter?: { role?: User['role']; managerUserId?: string; status?: User['status'] }) {
    return (await this.t.all())
      .filter((u) => (filter?.role ? u.role === filter.role : true))
      .filter((u) => (filter?.managerUserId ? u.managerUserId === filter.managerUserId : true))
      .filter((u) => (filter?.status ? u.status === filter.status : true));
  }
  create(u: User) {
    return this.t.create(u);
  }
  update(id: string, p: Partial<User>) {
    return this.t.update(id, p);
  }
}

class SheetsTemplateRepository implements WorkflowTemplateRepository {
  private t: Table<WorkflowTemplate>;
  constructor(c: SheetsClient) {
    this.t = new Table(c, 'WorkflowTemplates');
  }
  getById(id: string) {
    return this.t.getById(id);
  }
  async list(filter?: { status?: WorkflowTemplate['status']; ownerUserId?: string }) {
    return (await this.t.all())
      .filter((x) => (filter?.status ? x.status === filter.status : true))
      .filter((x) => (filter?.ownerUserId ? x.ownerUserId === filter.ownerUserId : true));
  }
  create(x: WorkflowTemplate) {
    return this.t.create(x);
  }
  update(id: string, p: Partial<WorkflowTemplate>) {
    return this.t.update(id, p);
  }
}

class SheetsStageRepository implements WorkflowStageRepository {
  private t: Table<WorkflowStage>;
  constructor(c: SheetsClient) {
    this.t = new Table(c, 'WorkflowStages');
  }
  getById(id: string) {
    return this.t.getById(id);
  }
  async listByTemplate(workflowTemplateId: string) {
    return (await this.t.all())
      .filter((s) => s.workflowTemplateId === workflowTemplateId)
      .sort((a, b) => a.order - b.order);
  }
  create(x: WorkflowStage) {
    return this.t.create(x);
  }
  update(id: string, p: Partial<WorkflowStage>) {
    return this.t.update(id, p);
  }
}

class SheetsInstanceRepository implements WorkflowInstanceRepository {
  private t: Table<WorkflowInstance>;
  constructor(c: SheetsClient) {
    this.t = new Table(c, 'WorkflowInstances');
  }
  getById(id: string) {
    return this.t.getById(id);
  }
  async list(filter?: { status?: WorkflowInstance['status']; ownerUserId?: string; workflowTemplateId?: string }) {
    return (await this.t.all())
      .filter((i) => (filter?.status ? i.status === filter.status : true))
      .filter((i) => (filter?.ownerUserId ? i.ownerUserId === filter.ownerUserId : true))
      .filter((i) => (filter?.workflowTemplateId ? i.workflowTemplateId === filter.workflowTemplateId : true));
  }
  create(x: WorkflowInstance) {
    return this.t.create(x);
  }
  update(id: string, p: Partial<WorkflowInstance>) {
    return this.t.update(id, p);
  }
}

class SheetsTaskRepository implements TaskRepository {
  private t: Table<Task>;
  constructor(c: SheetsClient) {
    this.t = new Table(c, 'Tasks');
  }
  getById(id: string) {
    return this.t.getById(id);
  }
  async list(filter?: TaskFilter, options?: ListOptions): Promise<Page<Task>> {
    const matched = (await this.t.all())
      .filter((x) => (filter?.includeArchived ? true : !x.archivedAt))
      .filter((x) => (filter?.status ? x.status === filter.status : true))
      .filter((x) => (filter?.assigneeUserId ? x.assigneeUserId === filter.assigneeUserId : true))
      .filter((x) => (filter?.managerUserId ? x.managerUserId === filter.managerUserId : true))
      .filter((x) => (filter?.workflowInstanceId ? x.workflowInstanceId === filter.workflowInstanceId : true))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const start = decodeCursor(options?.cursor);
    const limit = options?.limit && options.limit > 0 ? options.limit : matched.length;
    const items = matched.slice(start, start + limit);
    const nextIndex = start + limit;
    return nextIndex < matched.length ? { items, nextCursor: encodeCursor(nextIndex) } : { items };
  }
  create(x: Task) {
    return this.t.create(x);
  }
  update(id: string, p: Partial<Task>) {
    return this.t.update(id, p);
  }
}

class SheetsEvidenceRepository implements EvidenceRepository {
  private t: Table<Evidence>;
  constructor(c: SheetsClient) {
    this.t = new Table(c, 'Evidence');
  }
  getById(id: string) {
    return this.t.getById(id);
  }
  async listByTask(taskId: string) {
    return (await this.t.all())
      .filter((e) => e.taskId === taskId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  async countByTask(taskId: string) {
    return (await this.t.all()).filter((e) => e.taskId === taskId).length;
  }
  create(x: Evidence) {
    return this.t.create(x);
  }
}

class SheetsActivityRepository implements ActivityRepository {
  private t: Table<Activity>;
  constructor(c: SheetsClient) {
    this.t = new Table(c, 'Activity');
  }
  async append(a: Activity) {
    return this.t.create(a);
  }
  async listByEntity(entityType: Activity['entityType'], entityId: string, options?: ListOptions) {
    const matched = (await this.t.all())
      .filter((a) => a.entityType === entityType && a.entityId === entityId)
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
    const limit = options?.limit && options.limit > 0 ? options.limit : matched.length;
    return matched.slice(0, limit);
  }
  async listRecent(limit = 50) {
    return (await this.t.all()).sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1)).slice(0, limit);
  }
}

class SheetsSummaryRepository implements SummaryRepository {
  private t: Table<Summary>;
  constructor(c: SheetsClient) {
    this.t = new Table(c, 'Summaries');
  }
  getById(id: string) {
    return this.t.getById(id);
  }
  async list(filter?: { scopeType?: Summary['scopeType']; scopeId?: string }) {
    return (await this.t.all())
      .filter((s) => (filter?.scopeType ? s.scopeType === filter.scopeType : true))
      .filter((s) => (filter?.scopeId ? s.scopeId === filter.scopeId : true))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  create(x: Summary) {
    return this.t.create(x);
  }
}

class SheetsSubtaskRepository implements SubtaskRepository {
  private t: Table<Subtask>;
  constructor(c: SheetsClient) {
    this.t = new Table(c, 'Subtasks');
  }
  getById(id: string) {
    return this.t.getById(id);
  }
  async listByTask(taskId: string) {
    return (await this.t.all()).filter((s) => s.taskId === taskId).sort((a, b) => a.order - b.order);
  }
  create(x: Subtask) {
    return this.t.create(x);
  }
  update(id: string, p: Partial<Subtask>) {
    return this.t.update(id, p);
  }
}

class SheetsTaskMessageRepository implements TaskMessageRepository {
  private t: Table<TaskMessage>;
  constructor(c: SheetsClient) {
    this.t = new Table(c, 'TaskMessages');
  }
  async listByTask(taskId: string) {
    return (await this.t.all())
      .filter((m) => m.taskId === taskId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }
  create(x: TaskMessage) {
    return this.t.create(x);
  }
}

class SheetsDayLogRepository implements DayLogRepository {
  private t: Table<DayLog>;
  constructor(c: SheetsClient) {
    this.t = new Table(c, 'DayLogs');
  }
  async getByUserAndDate(userId: string, date: string) {
    return (await this.t.all()).find((l) => l.userId === userId && l.date === date) ?? null;
  }
  async listByDate(date: string) {
    return (await this.t.all()).filter((l) => l.date === date);
  }
  async listByUser(userId: string, limit?: number) {
    const matched = (await this.t.all())
      .filter((l) => l.userId === userId)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    return limit && limit > 0 ? matched.slice(0, limit) : matched;
  }
  create(x: DayLog) {
    return this.t.create(x);
  }
  update(id: string, p: Partial<DayLog>) {
    return this.t.update(id, p);
  }
}

export function createSheetsRepositories(client: SheetsClient): Repositories {
  return {
    users: new SheetsUserRepository(client),
    workflowTemplates: new SheetsTemplateRepository(client),
    workflowStages: new SheetsStageRepository(client),
    workflowInstances: new SheetsInstanceRepository(client),
    tasks: new SheetsTaskRepository(client),
    evidence: new SheetsEvidenceRepository(client),
    activity: new SheetsActivityRepository(client),
    summaries: new SheetsSummaryRepository(client),
    subtasks: new SheetsSubtaskRepository(client),
    taskMessages: new SheetsTaskMessageRepository(client),
    dayLogs: new SheetsDayLogRepository(client),
  };
}
