// Repository interfaces (ADR-0002). Application services depend ONLY on these.
// MVP implementation is Google Sheets + Drive; the in-memory implementation in
// ./memory backs local development and tests. No interface exposes a hard
// delete: removal is modeled as archive state on the entity.

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
} from '../domain/entities';
import type {
  EntityType,
  InstanceStatus,
  SummaryScope,
  TaskStatus,
} from '../domain/enums';

export interface Page<T> {
  items: T[];
  nextCursor?: string;
}

export interface ListOptions {
  limit?: number;
  cursor?: string;
}

export interface UserRepository {
  getById(id: string): Promise<User | null>;
  getByEmail(email: string): Promise<User | null>;
  list(filter?: { role?: User['role']; managerUserId?: string; status?: User['status'] }): Promise<User[]>;
  create(user: User): Promise<User>;
  update(id: string, patch: Partial<User>): Promise<User>;
}

export interface WorkflowTemplateRepository {
  getById(id: string): Promise<WorkflowTemplate | null>;
  list(filter?: { status?: WorkflowTemplate['status']; ownerUserId?: string }): Promise<WorkflowTemplate[]>;
  create(template: WorkflowTemplate): Promise<WorkflowTemplate>;
  update(id: string, patch: Partial<WorkflowTemplate>): Promise<WorkflowTemplate>;
}

export interface WorkflowStageRepository {
  getById(id: string): Promise<WorkflowStage | null>;
  listByTemplate(workflowTemplateId: string): Promise<WorkflowStage[]>;
  create(stage: WorkflowStage): Promise<WorkflowStage>;
  update(id: string, patch: Partial<WorkflowStage>): Promise<WorkflowStage>;
}

export interface WorkflowInstanceRepository {
  getById(id: string): Promise<WorkflowInstance | null>;
  list(filter?: { status?: InstanceStatus; ownerUserId?: string; workflowTemplateId?: string }): Promise<WorkflowInstance[]>;
  create(instance: WorkflowInstance): Promise<WorkflowInstance>;
  update(id: string, patch: Partial<WorkflowInstance>): Promise<WorkflowInstance>;
}

export interface TaskFilter {
  status?: TaskStatus;
  assigneeUserId?: string;
  managerUserId?: string;
  workflowInstanceId?: string;
  includeArchived?: boolean;
}

export interface TaskRepository {
  getById(id: string): Promise<Task | null>;
  list(filter?: TaskFilter, options?: ListOptions): Promise<Page<Task>>;
  create(task: Task): Promise<Task>;
  update(id: string, patch: Partial<Task>): Promise<Task>;
}

/** Evidence is immutable: create + read only, never update or delete. */
export interface EvidenceRepository {
  getById(id: string): Promise<Evidence | null>;
  listByTask(taskId: string): Promise<Evidence[]>;
  countByTask(taskId: string): Promise<number>;
  create(evidence: Evidence): Promise<Evidence>;
}

/** Activity is append-only: append + read only. */
export interface ActivityRepository {
  append(activity: Activity): Promise<Activity>;
  listByEntity(entityType: EntityType, entityId: string, options?: ListOptions): Promise<Activity[]>;
  listRecent(limit?: number): Promise<Activity[]>;
}

export interface SummaryRepository {
  getById(id: string): Promise<Summary | null>;
  list(filter?: { scopeType?: SummaryScope; scopeId?: string }): Promise<Summary[]>;
  create(summary: Summary): Promise<Summary>;
}

export interface SubtaskRepository {
  getById(id: string): Promise<Subtask | null>;
  listByTask(taskId: string): Promise<Subtask[]>;
  create(subtask: Subtask): Promise<Subtask>;
  update(id: string, patch: Partial<Subtask>): Promise<Subtask>;
}

/** Task chat is append-only: create + read only. */
export interface TaskMessageRepository {
  listByTask(taskId: string): Promise<TaskMessage[]>;
  create(message: TaskMessage): Promise<TaskMessage>;
}

export interface DayLogRepository {
  getByUserAndDate(userId: string, date: string): Promise<DayLog | null>;
  listByDate(date: string): Promise<DayLog[]>;
  listByUser(userId: string, limit?: number): Promise<DayLog[]>;
  create(log: DayLog): Promise<DayLog>;
  update(id: string, patch: Partial<DayLog>): Promise<DayLog>;
}

export interface Repositories {
  users: UserRepository;
  workflowTemplates: WorkflowTemplateRepository;
  workflowStages: WorkflowStageRepository;
  workflowInstances: WorkflowInstanceRepository;
  tasks: TaskRepository;
  evidence: EvidenceRepository;
  activity: ActivityRepository;
  summaries: SummaryRepository;
  subtasks: SubtaskRepository;
  taskMessages: TaskMessageRepository;
  dayLogs: DayLogRepository;
}
