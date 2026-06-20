// Domain enumerations. Single source of truth for every controlled vocabulary
// referenced by the PRD, database design, and API specification.

export const Roles = ['Admin', 'Manager', 'Employee'] as const;
export type Role = (typeof Roles)[number];

export const UserStatuses = ['Active', 'Archived'] as const;
export type UserStatus = (typeof UserStatuses)[number];

export const TaskStatuses = [
  'Inbox',
  'Assigned',
  'In Progress',
  'Waiting Internal',
  'Waiting External',
  'Review',
  'Completed',
  'Cancelled',
] as const;
export type TaskStatus = (typeof TaskStatuses)[number];

// Statuses that require a waiting reason.
export const WaitingStatuses = ['Waiting Internal', 'Waiting External'] as const satisfies readonly TaskStatus[];

export const WaitingReasons = [
  'Country Response',
  'Manager Approval',
  'Data Required',
  'Vendor Response',
  'Customer Response',
  'Other',
] as const;
export type WaitingReason = (typeof WaitingReasons)[number];

export const Priorities = ['Low', 'Normal', 'High', 'Critical'] as const;
export type Priority = (typeof Priorities)[number];

export const EvidenceTypes = [
  'Link',
  'Screenshot',
  'File',
  'Drive Folder',
  'Email Reference',
  'Meeting Notes',
] as const;
export type EvidenceType = (typeof EvidenceTypes)[number];

export const EvidenceProviders = ['Drive', 'Gmail', 'Calendar', 'External'] as const;
export type EvidenceProvider = (typeof EvidenceProviders)[number];

export const InstanceStatuses = ['Active', 'Waiting', 'Completed', 'Cancelled', 'Archived'] as const;
export type InstanceStatus = (typeof InstanceStatuses)[number];

export const TemplateStatuses = ['Active', 'Archived'] as const;
export type TemplateStatus = (typeof TemplateStatuses)[number];

export const StageStatuses = ['Active', 'Archived'] as const;
export type StageStatus = (typeof StageStatuses)[number];

export const SummaryScopes = ['Employee', 'Manager', 'Executive', 'Workflow'] as const;
export type SummaryScope = (typeof SummaryScopes)[number];

export const EntityTypes = [
  'User',
  'WorkflowTemplate',
  'WorkflowStage',
  'WorkflowInstance',
  'Task',
  'Evidence',
  'Summary',
] as const;
export type EntityType = (typeof EntityTypes)[number];

export function isWaitingStatus(status: TaskStatus): boolean {
  return (WaitingStatuses as readonly TaskStatus[]).includes(status);
}
