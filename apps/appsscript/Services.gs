/**
 * Application services for the Apps Script backend. Authentication resolution,
 * RBAC, validation, and the use cases the API exposes. Mirrors the rules in
 * packages/core (security-model.md). Every mutation appends Activity.
 */

/* ----- validation ----- */
function vString(v, field) {
  if (typeof v !== 'string' || v.trim() === '') fail('VALIDATION_ERROR', 'Field "' + field + '" is required.', { field: field });
  return v.trim();
}
function vOptString(v) { return (typeof v === 'string' && v.trim() !== '') ? v.trim() : undefined; }
function vEnum(v, allowed, field) {
  if (allowed.indexOf(v) < 0) fail('VALIDATION_ERROR', 'Field "' + field + '" must be one of: ' + allowed.join(', ') + '.', { field: field });
  return v;
}
function vOptEnum(v, allowed, field) { return (v === undefined || v === null || v === '') ? undefined : vEnum(v, allowed, field); }
function vId(v, kind, field) { if (!hasPrefix(v, kind)) fail('VALIDATION_ERROR', 'Field "' + field + '" must be a valid ' + ID_PREFIX[kind] + '_ id.', { field: field }); return v; }
function vUri(v, field) {
  if (typeof v !== 'string' || !/^https?:\/\//.test(v)) fail('VALIDATION_ERROR', 'Field "' + field + '" must be a valid http(s) URI.', { field: field });
  return v;
}

/* ----- RBAC ----- */
function canReadTeam(role) { return role === 'Admin' || role === 'Manager'; }
function canCreateTask(role) { return role === 'Admin' || role === 'Manager'; }
function canCreateTemplate(role) { return role === 'Admin' || role === 'Manager'; }
function canStartInstance(role) { return role === 'Admin' || role === 'Manager'; }
function canExecutive(role) { return role === 'Admin'; }
function canAccessTask(actor, task) {
  if (task.assigneeUserId === actor.id) return true;
  if (actor.role === 'Admin') return true;
  if (actor.role === 'Manager') return task.managerUserId === actor.id;
  return false;
}
function permissionsFor(role) {
  var base = ['task:read:self', 'task:update:self', 'summary:generate:self'];
  if (role === 'Employee') return base;
  var team = base.concat(['task:read:team', 'task:create', 'workflow:template:create', 'workflow:instance:start', 'summary:generate:team']);
  if (role === 'Manager') return team;
  return team.concat(['user:manage', 'task:read:org', 'summary:generate:executive']);
}

/* ----- identity ----- */
function resolveActor(email) {
  var allowed = (PropertiesService.getScriptProperties().getProperty('TEAMOS_ALLOWED_DOMAINS') || '').split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(String);
  if (allowed.length > 0) {
    var domain = String(email).split('@')[1] || '';
    if (allowed.indexOf(domain.toLowerCase()) < 0) fail('FORBIDDEN', 'Email domain not allowed.');
  }
  var user = Repo.users.getByEmail(email);
  if (!user) fail('UNAUTHENTICATED', 'No TeamOS account for this identity.');
  if (user.status !== 'Active') fail('FORBIDDEN', 'User account is archived.');
  return user;
}

function recordActivity(ctx, entityType, entityId, action, metadata) {
  return Repo.activity.append({
    id: newId('activity'), actorUserId: ctx.actor.id, entityType: entityType, entityId: entityId,
    action: action, occurredAt: nowIso(), metadataJson: metadata ? JSON.stringify(metadata) : '', requestId: ctx.requestId
  });
}

/* ----- tasks ----- */
function svcListTasks(ctx, query) {
  var all = Repo.tasks.list().filter(function (t) { return !t.archivedAt; });
  if (query.status) all = all.filter(function (t) { return t.status === query.status; });
  if (query.workflowInstanceId) all = all.filter(function (t) { return t.workflowInstanceId === query.workflowInstanceId; });
  if (ctx.actor.role === 'Employee') all = all.filter(function (t) { return t.assigneeUserId === ctx.actor.id; });
  else if (ctx.actor.role === 'Manager') all = all.filter(function (t) { return t.managerUserId === ctx.actor.id || t.assigneeUserId === ctx.actor.id; });
  return { items: all.filter(function (t) { return canAccessTask(ctx.actor, t); }) };
}

function svcCreateTask(ctx, body) {
  if (!canCreateTask(ctx.actor.role)) fail('FORBIDDEN', 'Only managers and admins can create tasks.');
  var title = vString(body.title, 'title');
  var assigneeUserId = vId(body.assigneeUserId, 'user', 'assigneeUserId');
  var assignee = Repo.users.getById(assigneeUserId);
  if (!assignee || assignee.status !== 'Active') fail('VALIDATION_ERROR', 'Assignee must be an active user.', { field: 'assigneeUserId' });
  var managerUserId = ctx.actor.role === 'Manager' ? ctx.actor.id : (vOptString(body.managerUserId) || assignee.managerUserId || ctx.actor.id);
  var now = nowIso();
  var task = {
    id: newId('task'), workflowInstanceId: vOptString(body.workflowInstanceId), stageId: vOptString(body.stageId),
    title: title, description: vOptString(body.description), assigneeUserId: assigneeUserId, managerUserId: managerUserId,
    status: 'Assigned', waitingReason: undefined, priority: vOptEnum(body.priority, ENUMS.Priority, 'priority') || 'Normal',
    dueAt: vOptString(body.dueAt), completedAt: undefined, completionComment: undefined, archivedAt: undefined,
    createdAt: now, createdBy: ctx.actor.id, updatedAt: now, updatedBy: ctx.actor.id
  };
  Repo.tasks.create(task);
  recordActivity(ctx, 'Task', task.id, 'TaskCreated', { assigneeUserId: assigneeUserId });
  return { task: task };
}

function svcUpdateStatus(ctx, taskId, body) {
  var task = Repo.tasks.getById(taskId);
  if (!task) fail('NOT_FOUND', 'Task not found.');
  if (!canAccessTask(ctx.actor, task)) fail('FORBIDDEN', 'You cannot update this task.');
  if (task.archivedAt) fail('CONFLICT', 'Archived tasks cannot be modified.');
  var status = vEnum(body.status, ENUMS.TaskStatus, 'status');
  var waitingReason = vOptEnum(body.waitingReason, ENUMS.WaitingReason, 'waitingReason');
  var completionComment = vOptString(body.completionComment);
  if (isWaitingStatus(status) && !waitingReason) fail('VALIDATION_ERROR', 'A waiting reason is required for waiting statuses.', { status: status });

  var patch = { status: status, updatedAt: nowIso(), updatedBy: ctx.actor.id, waitingReason: isWaitingStatus(status) ? waitingReason : '' };
  if (status === 'Completed') {
    var hasEvidence = Repo.evidence.countByTask(taskId) > 0;
    if (!hasEvidence && !completionComment) fail('VALIDATION_ERROR', 'Completion requires evidence or completion comment.');
    patch.completedAt = nowIso();
    if (completionComment) patch.completionComment = completionComment;
  } else if (completionComment) { patch.completionComment = completionComment; }

  var updated = _updateById('Tasks', taskId, patch);
  var activity = recordActivity(ctx, 'Task', taskId, 'TaskStatusChanged', { from: task.status, to: status });
  return { task: updated, activity: activity };
}

function svcTaskActivity(ctx, taskId) {
  var task = Repo.tasks.getById(taskId);
  if (!task) fail('NOT_FOUND', 'Task not found.');
  if (!canAccessTask(ctx.actor, task)) fail('FORBIDDEN', 'Task not in your scope.');
  return { activity: Repo.activity.listByEntity('Task', taskId) };
}

/* ----- evidence ----- */
function svcAddEvidence(ctx, taskId, body) {
  var task = Repo.tasks.getById(taskId);
  if (!task) fail('NOT_FOUND', 'Task not found.');
  if (!canAccessTask(ctx.actor, task)) fail('FORBIDDEN', 'You cannot add evidence to this task.');
  if (task.archivedAt) fail('CONFLICT', 'Archived tasks cannot accept new evidence.');
  var type = vEnum(body.type, ENUMS.EvidenceType, 'type');
  var title = vString(body.title, 'title');
  var uri = vOptString(body.uri);
  if (type === 'Link') uri = vUri(body.uri, 'uri');
  else if (uri) uri = vUri(uri, 'uri');
  var ev = {
    id: newId('evidence'), taskId: taskId, type: type, title: title, uri: uri, notes: vOptString(body.notes),
    provider: vOptEnum(body.provider, ENUMS.EvidenceProvider, 'provider'), providerObjectId: vOptString(body.providerObjectId),
    createdAt: nowIso(), createdBy: ctx.actor.id
  };
  Repo.evidence.create(ev);
  recordActivity(ctx, 'Evidence', ev.id, 'EvidenceAdded', { taskId: taskId, type: type });
  return { evidence: ev };
}

function svcListEvidence(ctx, taskId) {
  var task = Repo.tasks.getById(taskId);
  if (!task) fail('NOT_FOUND', 'Task not found.');
  if (!canAccessTask(ctx.actor, task)) fail('FORBIDDEN', 'Evidence not in your scope.');
  return { evidence: Repo.evidence.listByTask(taskId) };
}

/* ----- workflows ----- */
function svcListTemplates() { return { templates: Repo.templates.list().filter(function (t) { return t.status === 'Active'; }) }; }

function svcCreateTemplate(ctx, body) {
  if (!canCreateTemplate(ctx.actor.role)) fail('FORBIDDEN', 'Only managers and admins can create templates.');
  var now = nowIso();
  var template = {
    id: newId('workflowTemplate'), name: vString(body.name, 'name'), description: vOptString(body.description),
    ownerUserId: ctx.actor.id, status: 'Active', version: 1, slaHours: body.slaHours || '',
    createdAt: now, createdBy: ctx.actor.id, updatedAt: now, updatedBy: ctx.actor.id
  };
  Repo.templates.create(template);
  var stages = [];
  (body.stages || []).forEach(function (s, i) {
    var stage = {
      id: newId('workflowStage'), workflowTemplateId: template.id, name: vString(s.name, 'stage.name'),
      order: s.order || (i + 1), defaultAssigneeRole: vOptEnum(s.defaultAssigneeRole, ENUMS.Role, 'stage.defaultAssigneeRole'),
      slaHours: s.slaHours || '', requiredEvidenceType: vOptEnum(s.requiredEvidenceType, ENUMS.EvidenceType, 'stage.requiredEvidenceType'), status: 'Active'
    };
    Repo.stages.create(stage); stages.push(stage);
  });
  recordActivity(ctx, 'WorkflowTemplate', template.id, 'WorkflowTemplateCreated', { stages: stages.length });
  return { template: template, stages: stages };
}

function svcStartInstance(ctx, body) {
  if (!canStartInstance(ctx.actor.role)) fail('FORBIDDEN', 'Only managers and admins can start workflows.');
  var tid = vId(body.workflowTemplateId, 'workflowTemplate', 'workflowTemplateId');
  var template = Repo.templates.getById(tid);
  if (!template || template.status !== 'Active') fail('VALIDATION_ERROR', 'Workflow template must exist and be active.', { field: 'workflowTemplateId' });
  var stages = Repo.stages.listByTemplate(tid);
  var now = nowIso();
  var instance = {
    id: newId('workflowInstance'), workflowTemplateId: tid, name: vString(body.name, 'name'), status: 'Active',
    ownerUserId: ctx.actor.id, currentStageId: stages.length ? stages[0].id : '', startedAt: now, dueAt: vOptString(body.dueAt),
    completedAt: '', createdAt: now, createdBy: ctx.actor.id, updatedAt: now, updatedBy: ctx.actor.id
  };
  Repo.instances.create(instance);
  recordActivity(ctx, 'WorkflowInstance', instance.id, 'WorkflowInstanceStarted', { workflowTemplateId: tid });
  return { instance: instance };
}

function svcGetInstance(ctx, id) {
  var instance = Repo.instances.getById(id);
  if (!instance) fail('NOT_FOUND', 'Workflow instance not found.');
  if (instance.ownerUserId !== ctx.actor.id && !canReadTeam(ctx.actor.role)) fail('FORBIDDEN', 'Workflow instance not in your scope.');
  var tasks = Repo.tasks.list().filter(function (t) { return t.workflowInstanceId === id; });
  var counts = {};
  tasks.forEach(function (t) { counts[t.id] = Repo.evidence.countByTask(t.id); });
  return {
    instance: instance, template: Repo.templates.getById(instance.workflowTemplateId),
    stages: Repo.stages.listByTemplate(instance.workflowTemplateId), tasks: tasks, evidenceCounts: counts,
    recentActivity: Repo.activity.listByEntity('WorkflowInstance', id)
  };
}
