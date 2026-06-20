/**
 * Dashboard computation and the AI summary use case for the Apps Script
 * backend. Read-only over repositories; the summary path writes only to the
 * Summaries sheet (AI advisory boundary, ADR-0003).
 */

function _isTerminal(s) { return s === 'Completed' || s === 'Cancelled'; }
function _isOverdue(t) { return t.dueAt && !_isTerminal(t.status) && new Date(t.dueAt).getTime() < Date.now(); }
function _isDueSoon(t) {
  if (!t.dueAt || _isTerminal(t.status)) return false;
  var d = new Date(t.dueAt).getTime();
  return d >= Date.now() && d <= Date.now() + 48 * 3600 * 1000;
}

function _metrics(tasks) {
  var completed = tasks.filter(function (t) { return t.status === 'Completed'; });
  var waiting = tasks.filter(function (t) { return isWaitingStatus(t.status); });
  var gaps = completed.filter(function (t) { return Repo.evidence.countByTask(t.id) === 0; });
  var total = tasks.length;
  return {
    total: total, completed: completed.length, completionRate: total ? Math.round(completed.length / total * 100) : 0,
    overdue: tasks.filter(_isOverdue).length, waiting: waiting.length, evidenceGaps: gaps.length,
    blocked: waiting.length, inProgress: tasks.filter(function (t) { return t.status === 'In Progress'; }).length,
    review: tasks.filter(function (t) { return t.status === 'Review'; }).length
  };
}

function svcEmployeeDashboard(ctx) {
  var tasks = Repo.tasks.list().filter(function (t) { return t.assigneeUserId === ctx.actor.id && !t.archivedAt; });
  var by = function (s) { return tasks.filter(function (t) { return t.status === s; }); };
  return {
    scope: 'Employee', metrics: _metrics(tasks),
    inbox: by('Inbox'), assigned: by('Assigned'), inProgress: by('In Progress'),
    waiting: tasks.filter(function (t) { return isWaitingStatus(t.status); }), review: by('Review'),
    dueSoon: tasks.filter(_isDueSoon), overdue: tasks.filter(_isOverdue),
    summary: _latestSummary('Employee', ctx.actor.id)
  };
}

function svcManagerDashboard(ctx) {
  if (!canReadTeam(ctx.actor.role)) fail('FORBIDDEN', 'Manager dashboard requires manager or admin role.');
  var tasks = Repo.tasks.list().filter(function (t) {
    return !t.archivedAt && (ctx.actor.role === 'Admin' || t.managerUserId === ctx.actor.id);
  });
  var reasons = {};
  tasks.forEach(function (t) { if (isWaitingStatus(t.status) && t.waitingReason) reasons[t.waitingReason] = (reasons[t.waitingReason] || 0) + 1; });
  return {
    scope: 'Manager', metrics: _metrics(tasks),
    delayed: tasks.filter(_isOverdue), waiting: tasks.filter(function (t) { return isWaitingStatus(t.status); }),
    waitingReasons: reasons, slaRisk: tasks.filter(_isDueSoon),
    evidenceGaps: tasks.filter(function (t) { return t.status === 'Completed' && Repo.evidence.countByTask(t.id) === 0; }),
    bottlenecks: _bottlenecks(tasks), summary: _latestSummary('Manager', ctx.actor.id)
  };
}

function svcExecutiveDashboard(ctx) {
  if (!canExecutive(ctx.actor.role)) fail('FORBIDDEN', 'Executive dashboard requires admin role.');
  var tasks = Repo.tasks.list().filter(function (t) { return !t.archivedAt; });
  var counts = {};
  ENUMS.TaskStatus.forEach(function (s) { counts[s] = 0; });
  tasks.forEach(function (t) { counts[t.status] = (counts[t.status] || 0) + 1; });
  return { scope: 'Executive', metrics: _metrics(tasks), statusCounts: counts, bottlenecks: _bottlenecks(tasks), summary: _latestSummary('Executive', null) };
}

function _bottlenecks(tasks) {
  var byInstance = {};
  tasks.forEach(function (t) {
    if (!t.workflowInstanceId) return;
    var agg = byInstance[t.workflowInstanceId] || { waiting: 0, overdue: 0 };
    if (isWaitingStatus(t.status)) agg.waiting++;
    if (_isOverdue(t)) agg.overdue++;
    byInstance[t.workflowInstanceId] = agg;
  });
  var out = [];
  Object.keys(byInstance).forEach(function (id) {
    var a = byInstance[id];
    if (a.waiting === 0 && a.overdue === 0) return;
    var inst = Repo.instances.getById(id);
    out.push({ workflowInstanceId: id, name: inst ? inst.name : id, waiting: a.waiting, overdue: a.overdue });
  });
  return out.sort(function (x, y) { return (y.overdue + y.waiting) - (x.overdue + x.waiting); }).slice(0, 5);
}

function _latestSummary(scopeType, scopeId) {
  var list = Repo.summaries.list().filter(function (s) {
    return s.scopeType === scopeType && (scopeId ? s.scopeId === scopeId : true);
  }).sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
  return list.length ? list[0] : null;
}

/* ----- AI advisory summary ----- */
function svcGenerateSummary(ctx, body) {
  var scopeType = vEnum(body.scopeType, ENUMS.SummaryScope, 'scopeType');
  var periodStart = vString(body.periodStart, 'periodStart');
  var periodEnd = vString(body.periodEnd, 'periodEnd');
  var role = ctx.actor.role;
  var scopeId = null;
  var tasks, label;

  if (scopeType === 'Executive') {
    if (!canExecutive(role)) fail('FORBIDDEN', 'Only admins can generate executive summaries.');
    tasks = Repo.tasks.list(); label = 'Organization';
  } else if (scopeType === 'Manager') {
    if (!canReadTeam(role)) fail('FORBIDDEN', 'Only managers and admins can generate team summaries.');
    scopeId = vId(body.scopeId, 'user', 'scopeId');
    if (role === 'Manager' && scopeId !== ctx.actor.id) fail('FORBIDDEN', 'Managers can only generate their own team summary.');
    tasks = Repo.tasks.list().filter(function (t) { return t.managerUserId === scopeId; }); label = 'Team of ' + scopeId;
  } else if (scopeType === 'Employee') {
    scopeId = vId(body.scopeId, 'user', 'scopeId');
    var ok = role === 'Admin' || scopeId === ctx.actor.id;
    if (!ok && role === 'Manager') { var tgt = Repo.users.getById(scopeId); ok = tgt && tgt.managerUserId === ctx.actor.id; }
    if (!ok) fail('FORBIDDEN', 'You can only generate your own summary.');
    tasks = Repo.tasks.list().filter(function (t) { return t.assigneeUserId === scopeId; });
    var u = Repo.users.getById(scopeId); label = u ? u.displayName : scopeId;
  } else {
    scopeId = vId(body.scopeId, 'workflowInstance', 'scopeId');
    var inst = Repo.instances.getById(scopeId);
    if (!inst) fail('FORBIDDEN', 'Workflow not found.');
    if (role !== 'Admin' && inst.ownerUserId !== ctx.actor.id && !canReadTeam(role)) fail('FORBIDDEN', 'Workflow summary not in your scope.');
    tasks = Repo.tasks.list().filter(function (t) { return t.workflowInstanceId === scopeId; }); label = inst.name;
  }

  var m = _metrics(tasks);
  var ai = aiSummarize({ scopeType: scopeType, scopeLabel: label, periodStart: periodStart, periodEnd: periodEnd, metrics: m, tasks: tasks });

  var summary = {
    id: newId('summary'), scopeType: scopeType, scopeId: scopeId || '', periodStart: periodStart, periodEnd: periodEnd,
    model: ai.model, promptVersion: ai.promptVersion, summaryText: ai.summaryText, riskJson: ai.risk.length ? JSON.stringify(ai.risk) : '',
    createdAt: nowIso(), createdBy: ctx.actor.id
  };
  Repo.summaries.create(summary);
  var activity = recordActivity(ctx, 'Summary', summary.id, 'SummaryGenerated', { scopeType: scopeType, model: ai.model });
  return { summary: summary, risk: ai.risk, activity: activity };
}
