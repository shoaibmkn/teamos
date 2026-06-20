/**
 * HTTP entry points for the TeamOS Apps Script API (architecture.md).
 * The frontend talks only to this web app; it never touches Sheets, Drive
 * writes, or Gemini directly. ContentService always returns HTTP 200, so the
 * machine-readable status is carried in the JSON envelope `ok`/`error.code`.
 *
 * Apps Script web apps receive GET and POST only. Status updates that the REST
 * contract models as PATCH are sent here as POST /tasks/{id}/status.
 */

function doGet(e) { return _handle('GET', e); }
function doPost(e) { return _handle('POST', e); }

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function _actorEmail(e) {
  var email = Session.getActiveUser().getEmail();
  if (!email && e && e.parameter && e.parameter.email) email = e.parameter.email; // test fallback
  return email;
}

function _segments(e) {
  var path = (e && e.pathInfo) ? e.pathInfo : '';
  return path.split('/').filter(function (s) { return s.length > 0; });
}

function _body(e) {
  if (e && e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); } catch (err) { fail('VALIDATION_ERROR', 'Invalid JSON body.'); }
  }
  return {};
}

function _handle(method, e) {
  var requestId = (e && e.parameter && e.parameter.requestId) || ('req_' + Utilities.getUuid());
  try {
    var email = _actorEmail(e);
    if (!email) fail('UNAUTHENTICATED', 'Authentication required.');
    var ctx = { actor: resolveActor(email), requestId: requestId };
    var seg = _segments(e);
    var data = _route(method, seg, ctx, e);
    return _json({ ok: true, data: data, requestId: requestId });
  } catch (err) {
    var code = (err && err.code) ? err.code : 'INTERNAL_ERROR';
    var message = (err && err.message) ? err.message : 'Unexpected error.';
    var body = { code: code, message: message };
    if (err && err.details) body.details = err.details;
    return _json({ ok: false, error: body, requestId: requestId });
  }
}

function _route(method, seg, ctx, e) {
  var head = seg[0];

  if (method === 'GET') {
    if (head === 'me' && seg.length === 1) return { user: ctx.actor, permissions: permissionsFor(ctx.actor.role) };
    if (head === 'tasks' && seg.length === 1) return svcListTasks(ctx, e.parameter || {});
    if (head === 'tasks' && seg.length === 3 && seg[2] === 'activity') return svcTaskActivity(ctx, seg[1]);
    if (head === 'tasks' && seg.length === 3 && seg[2] === 'evidence') return svcListEvidence(ctx, seg[1]);
    if (head === 'workflow-templates' && seg.length === 1) return svcListTemplates();
    if (head === 'workflow-instances' && seg.length === 2) return svcGetInstance(ctx, seg[1]);
    if (head === 'dashboards' && seg[1] === 'employee') return svcEmployeeDashboard(ctx);
    if (head === 'dashboards' && seg[1] === 'manager') return svcManagerDashboard(ctx);
    if (head === 'dashboards' && seg[1] === 'executive') return svcExecutiveDashboard(ctx);
  }

  if (method === 'POST') {
    var body = _body(e);
    if (head === 'tasks' && seg.length === 1) return svcCreateTask(ctx, body);
    if (head === 'tasks' && seg.length === 3 && seg[2] === 'status') return svcUpdateStatus(ctx, seg[1], body);
    if (head === 'tasks' && seg.length === 3 && seg[2] === 'evidence') return svcAddEvidence(ctx, seg[1], body);
    if (head === 'workflow-templates' && seg.length === 1) return svcCreateTemplate(ctx, body);
    if (head === 'workflow-instances' && seg.length === 1) return svcStartInstance(ctx, body);
    if (head === 'ai' && seg[1] === 'summaries') return svcGenerateSummary(ctx, body);
  }

  fail('NOT_FOUND', 'No route for ' + method + ' /' + seg.join('/'));
}

/**
 * Optional: seed a minimal demo org into the Sheets backend for manual testing.
 * Run after setup(). Creates an admin/manager/employee and a couple of tasks.
 */
function seedDemo() {
  setup();
  var now = nowIso();
  function u(email, name, role, mgr) {
    return { id: newId('user'), email: email, displayName: name, role: role, managerUserId: mgr || '', department: 'Operations', status: 'Active', createdAt: now, createdBy: 'system', updatedAt: now, updatedBy: 'system' };
  }
  var admin = u('admin@example.com', 'Avery Admin', 'Admin');
  var manager = u('manager@example.com', 'Morgan Manager', 'Manager');
  var emp = u('priya@example.com', 'Priya Patel', 'Employee', manager.id);
  [admin, manager, emp].forEach(function (x) { Repo.users.create(x); });

  ['Triage auditor email', 'Gather meter logs (overdue)'].forEach(function (title, i) {
    Repo.tasks.create({
      id: newId('task'), workflowInstanceId: '', stageId: '', title: title, description: '', assigneeUserId: emp.id,
      managerUserId: manager.id, status: i === 0 ? 'Inbox' : 'Waiting External', waitingReason: i === 0 ? '' : 'Country Response',
      priority: 'High', dueAt: i === 1 ? new Date(Date.now() - 86400000).toISOString() : '', completedAt: '', completionComment: '',
      archivedAt: '', createdAt: now, createdBy: manager.id, updatedAt: now, updatedBy: manager.id
    });
  });
  return 'seeded';
}
