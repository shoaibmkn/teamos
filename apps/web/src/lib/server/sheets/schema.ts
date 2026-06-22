// Column order for each Google Sheets tab. The Sheets repository maps rows to
// entity objects by these headers. Order matches the Apps Script backend so a
// single spreadsheet works with either implementation (database-design.md).

export const SHEET_COLUMNS = {
  Users: ['id', 'email', 'displayName', 'role', 'managerUserId', 'department', 'status', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy'],
  WorkflowTemplates: ['id', 'name', 'description', 'ownerUserId', 'status', 'version', 'slaHours', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy'],
  WorkflowStages: ['id', 'workflowTemplateId', 'name', 'order', 'defaultAssigneeRole', 'slaHours', 'requiredEvidenceType', 'status'],
  WorkflowInstances: ['id', 'workflowTemplateId', 'name', 'status', 'ownerUserId', 'currentStageId', 'startedAt', 'dueAt', 'completedAt', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy'],
  Tasks: ['id', 'workflowInstanceId', 'stageId', 'title', 'description', 'assigneeUserId', 'managerUserId', 'status', 'waitingReason', 'priority', 'dueAt', 'completedAt', 'completionComment', 'archivedAt', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy'],
  Evidence: ['id', 'taskId', 'type', 'title', 'uri', 'notes', 'provider', 'providerObjectId', 'createdAt', 'createdBy'],
  Activity: ['id', 'actorUserId', 'entityType', 'entityId', 'action', 'occurredAt', 'metadataJson', 'requestId'],
  Summaries: ['id', 'scopeType', 'scopeId', 'periodStart', 'periodEnd', 'model', 'promptVersion', 'summaryText', 'riskJson', 'createdAt', 'createdBy'],
} as const;

export type SheetName = keyof typeof SHEET_COLUMNS;

export const SHEET_NAMES = Object.keys(SHEET_COLUMNS) as SheetName[];

/** Numeric fields that must be parsed back from sheet strings. */
export const NUMERIC_FIELDS = new Set(['version', 'order', 'slaHours']);
