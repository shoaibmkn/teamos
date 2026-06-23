// Entity record shapes. Field names and optionality mirror database-design.md
// exactly. These types are the contract the repository layer persists.

import type {
  EvidenceProvider,
  EvidenceType,
  InstanceStatus,
  Priority,
  Role,
  StageStatus,
  SummaryScope,
  TaskStatus,
  TemplateStatus,
  UserStatus,
  WaitingReason,
} from './enums';

/** ISO 8601 datetime string. */
export type IsoDateTime = string;
/** ISO date (YYYY-MM-DD). */
export type IsoDate = string;

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  managerUserId?: string;
  department?: string;
  status: UserStatus;
  createdAt: IsoDateTime;
  createdBy: string;
  updatedAt: IsoDateTime;
  updatedBy: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  ownerUserId: string;
  status: TemplateStatus;
  version: number;
  slaHours?: number;
  createdAt: IsoDateTime;
  createdBy: string;
  updatedAt: IsoDateTime;
  updatedBy: string;
}

export interface WorkflowStage {
  id: string;
  workflowTemplateId: string;
  name: string;
  order: number;
  defaultAssigneeRole?: Role;
  slaHours?: number;
  requiredEvidenceType?: EvidenceType;
  status: StageStatus;
}

export interface WorkflowInstance {
  id: string;
  workflowTemplateId: string;
  name: string;
  status: InstanceStatus;
  ownerUserId: string;
  currentStageId?: string;
  startedAt: IsoDateTime;
  dueAt?: IsoDateTime;
  completedAt?: IsoDateTime;
  createdAt: IsoDateTime;
  createdBy: string;
  updatedAt: IsoDateTime;
  updatedBy: string;
}

export interface Task {
  id: string;
  workflowInstanceId?: string;
  stageId?: string;
  title: string;
  description?: string;
  assigneeUserId: string;
  managerUserId: string;
  status: TaskStatus;
  waitingReason?: WaitingReason;
  priority: Priority;
  dueAt?: IsoDateTime;
  completedAt?: IsoDateTime;
  completionComment?: string;
  archivedAt?: IsoDateTime;
  createdAt: IsoDateTime;
  createdBy: string;
  updatedAt: IsoDateTime;
  updatedBy: string;
}

/** Evidence is immutable: no updatedAt / updatedBy by design. */
export interface Evidence {
  id: string;
  taskId: string;
  type: EvidenceType;
  title: string;
  uri?: string;
  notes?: string;
  provider?: EvidenceProvider;
  providerObjectId?: string;
  createdAt: IsoDateTime;
  createdBy: string;
}

/** Activity entries are append-only and immutable. */
export interface Activity {
  id: string;
  actorUserId: string;
  entityType: import('./enums').EntityType;
  entityId: string;
  action: string;
  occurredAt: IsoDateTime;
  metadataJson?: string;
  requestId: string;
}

/** A checklist item under a task. */
export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  order: number;
  createdAt: IsoDateTime;
  createdBy: string;
  updatedAt: IsoDateTime;
  updatedBy: string;
}

/** A message in a task's chat thread. Append-only. */
export interface TaskMessage {
  id: string;
  taskId: string;
  authorUserId: string;
  text: string;
  createdAt: IsoDateTime;
}

/** A daily check-in / check-out record. One per user per day. */
export interface DayLog {
  id: string;
  userId: string;
  date: IsoDate;
  checkInAt: IsoDateTime;
  checkOutAt?: IsoDateTime;
  checkInNote?: string;
  checkOutNote?: string;
  createdAt: IsoDateTime;
}

export interface Summary {
  id: string;
  scopeType: SummaryScope;
  scopeId?: string;
  periodStart: IsoDate;
  periodEnd: IsoDate;
  model: string;
  promptVersion: string;
  summaryText: string;
  riskJson?: string;
  createdAt: IsoDateTime;
  createdBy: string;
}
