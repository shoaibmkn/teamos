/**
 * TeamOS Apps Script backend — shared constants, enums, IDs, and errors.
 * Mirrors packages/core domain vocabulary so both backends stay contract-aligned
 * (architecture.md, database-design.md). This file owns no I/O.
 */

var ENUMS = {
  Role: ['Admin', 'Manager', 'Employee'],
  UserStatus: ['Active', 'Archived'],
  TaskStatus: [
    'Inbox', 'Assigned', 'In Progress', 'Waiting Internal',
    'Waiting External', 'Review', 'Completed', 'Cancelled'
  ],
  WaitingStatuses: ['Waiting Internal', 'Waiting External'],
  WaitingReason: [
    'Country Response', 'Manager Approval', 'Data Required',
    'Vendor Response', 'Customer Response', 'Other'
  ],
  Priority: ['Low', 'Normal', 'High', 'Critical'],
  EvidenceType: ['Link', 'Screenshot', 'File', 'Drive Folder', 'Email Reference', 'Meeting Notes'],
  EvidenceProvider: ['Drive', 'Gmail', 'Calendar', 'External'],
  InstanceStatus: ['Active', 'Waiting', 'Completed', 'Cancelled', 'Archived'],
  TemplateStatus: ['Active', 'Archived'],
  StageStatus: ['Active', 'Archived'],
  SummaryScope: ['Employee', 'Manager', 'Executive', 'Workflow'],
  EntityType: ['User', 'WorkflowTemplate', 'WorkflowStage', 'WorkflowInstance', 'Task', 'Evidence', 'Summary']
};

var ID_PREFIX = {
  user: 'usr', workflowTemplate: 'wft', workflowInstance: 'wfi',
  workflowStage: 'stg', task: 'tsk', activity: 'act', evidence: 'evd', summary: 'sum'
};

var ERROR_CODES = {
  UNAUTHENTICATED: 401, FORBIDDEN: 403, VALIDATION_ERROR: 400, NOT_FOUND: 404,
  CONFLICT: 409, RATE_LIMITED: 429, AI_UNAVAILABLE: 503, INTERNAL_ERROR: 500
};

/** Structured application error. Router maps .code to the response envelope. */
function AppError(code, message, details) {
  this.name = 'AppError';
  this.code = code;
  this.httpStatus = ERROR_CODES[code] || 500;
  this.message = message;
  this.details = details || null;
}

function fail(code, message, details) { throw new AppError(code, message, details); }

var _idSeq = 0;
function newId(kind) {
  var prefix = ID_PREFIX[kind];
  _idSeq = (_idSeq + 1) % 0xffffff;
  var time = Date.now().toString(36);
  var seq = ('0000' + _idSeq.toString(36)).slice(-4);
  var rand = Math.random().toString(36).slice(2, 8);
  return prefix + '_' + time + seq + rand;
}

function hasPrefix(id, kind) {
  var prefix = ID_PREFIX[kind];
  return typeof id === 'string' && id.indexOf(prefix + '_') === 0 && id.length > prefix.length + 1;
}

function nowIso() { return new Date().toISOString(); }

function isWaitingStatus(status) { return ENUMS.WaitingStatuses.indexOf(status) >= 0; }
