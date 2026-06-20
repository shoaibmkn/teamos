/**
 * Sheets + Drive repository (ADR-0002 MVP implementation). Owns ALL direct
 * spreadsheet access. Enforces storage invariants: append-only Activity,
 * immutable Evidence, no hard deletes (archive only). Business rules live in
 * Services.gs, never here.
 *
 * The target spreadsheet id is read from script property TEAMOS_SPREADSHEET_ID.
 * Run setup() once to provision the spreadsheet and tabs.
 */

var SHEET_COLUMNS = {
  Users: ['id', 'email', 'displayName', 'role', 'managerUserId', 'department', 'status', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy'],
  WorkflowTemplates: ['id', 'name', 'description', 'ownerUserId', 'status', 'version', 'slaHours', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy'],
  WorkflowStages: ['id', 'workflowTemplateId', 'name', 'order', 'defaultAssigneeRole', 'slaHours', 'requiredEvidenceType', 'status'],
  WorkflowInstances: ['id', 'workflowTemplateId', 'name', 'status', 'ownerUserId', 'currentStageId', 'startedAt', 'dueAt', 'completedAt', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy'],
  Tasks: ['id', 'workflowInstanceId', 'stageId', 'title', 'description', 'assigneeUserId', 'managerUserId', 'status', 'waitingReason', 'priority', 'dueAt', 'completedAt', 'completionComment', 'archivedAt', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy'],
  Evidence: ['id', 'taskId', 'type', 'title', 'uri', 'notes', 'provider', 'providerObjectId', 'createdAt', 'createdBy'],
  Activity: ['id', 'actorUserId', 'entityType', 'entityId', 'action', 'occurredAt', 'metadataJson', 'requestId'],
  Summaries: ['id', 'scopeType', 'scopeId', 'periodStart', 'periodEnd', 'model', 'promptVersion', 'summaryText', 'riskJson', 'createdAt', 'createdBy']
};

function _spreadsheet() {
  var id = PropertiesService.getScriptProperties().getProperty('TEAMOS_SPREADSHEET_ID');
  if (!id) fail('INTERNAL_ERROR', 'TEAMOS_SPREADSHEET_ID is not configured. Run setup().');
  return SpreadsheetApp.openById(id);
}

function _sheet(name) {
  var ss = _spreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) fail('INTERNAL_ERROR', 'Missing sheet: ' + name);
  return sheet;
}

function _rowsToObjects(name) {
  var sheet = _sheet(name);
  var range = sheet.getDataRange().getValues();
  if (range.length < 2) return [];
  var headers = range[0];
  var out = [];
  for (var r = 1; r < range.length; r++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      var v = range[r][c];
      obj[headers[c]] = (v === '' ? undefined : v);
    }
    out.push(obj);
  }
  return out;
}

function _appendObject(name, obj) {
  var sheet = _sheet(name);
  var cols = SHEET_COLUMNS[name];
  var row = cols.map(function (c) { return obj[c] === undefined || obj[c] === null ? '' : obj[c]; });
  sheet.appendRow(row);
  return obj;
}

function _updateById(name, id, patch) {
  var sheet = _sheet(name);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idCol = headers.indexOf('id');
  for (var r = 1; r < values.length; r++) {
    if (values[r][idCol] === id) {
      var current = {};
      for (var c = 0; c < headers.length; c++) current[headers[c]] = values[r][c];
      for (var k in patch) if (patch.hasOwnProperty(k)) current[k] = patch[k];
      var rowOut = headers.map(function (h) { return current[h] === undefined || current[h] === null ? '' : current[h]; });
      sheet.getRange(r + 1, 1, 1, headers.length).setValues([rowOut]);
      return current;
    }
  }
  fail('NOT_FOUND', name + ' not found: ' + id);
}

function _findById(name, id) {
  var rows = _rowsToObjects(name);
  for (var i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i];
  return null;
}

/* ----- Typed repository wrappers used by Services.gs ----- */

var Repo = {
  users: {
    getById: function (id) { return _findById('Users', id); },
    getByEmail: function (email) {
      var t = String(email).toLowerCase();
      var rows = _rowsToObjects('Users');
      for (var i = 0; i < rows.length; i++) if (String(rows[i].email).toLowerCase() === t) return rows[i];
      return null;
    },
    list: function () { return _rowsToObjects('Users'); },
    create: function (u) { return _appendObject('Users', u); },
    update: function (id, p) { return _updateById('Users', id, p); }
  },
  tasks: {
    getById: function (id) { return _findById('Tasks', id); },
    list: function () { return _rowsToObjects('Tasks'); },
    create: function (t) { return _appendObject('Tasks', t); },
    update: function (id, p) { return _updateById('Tasks', id, p); }
  },
  evidence: {
    getById: function (id) { return _findById('Evidence', id); },
    listByTask: function (taskId) {
      return _rowsToObjects('Evidence').filter(function (e) { return e.taskId === taskId; });
    },
    countByTask: function (taskId) { return Repo.evidence.listByTask(taskId).length; },
    create: function (e) {
      if (_findById('Evidence', e.id)) fail('CONFLICT', 'Evidence already exists.');
      return _appendObject('Evidence', e);
    }
  },
  activity: {
    append: function (a) { return _appendObject('Activity', a); },
    listByEntity: function (entityType, entityId) {
      return _rowsToObjects('Activity')
        .filter(function (a) { return a.entityType === entityType && a.entityId === entityId; })
        .sort(function (x, y) { return x.occurredAt < y.occurredAt ? 1 : -1; });
    }
  },
  templates: {
    getById: function (id) { return _findById('WorkflowTemplates', id); },
    list: function () { return _rowsToObjects('WorkflowTemplates'); },
    create: function (t) { return _appendObject('WorkflowTemplates', t); }
  },
  stages: {
    listByTemplate: function (tid) {
      return _rowsToObjects('WorkflowStages')
        .filter(function (s) { return s.workflowTemplateId === tid; })
        .sort(function (a, b) { return Number(a.order) - Number(b.order); });
    },
    create: function (s) { return _appendObject('WorkflowStages', s); }
  },
  instances: {
    getById: function (id) { return _findById('WorkflowInstances', id); },
    list: function () { return _rowsToObjects('WorkflowInstances'); },
    create: function (i) { return _appendObject('WorkflowInstances', i); }
  },
  summaries: {
    list: function () { return _rowsToObjects('Summaries'); },
    create: function (s) { return _appendObject('Summaries', s); }
  }
};

/** One-time provisioning: creates the spreadsheet (if needed) and all tabs. */
function setup() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('TEAMOS_SPREADSHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create('TeamOS Database');
  if (!id) props.setProperty('TEAMOS_SPREADSHEET_ID', ss.getId());

  Object.keys(SHEET_COLUMNS).forEach(function (name) {
    var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sheet.getLastRow() === 0) sheet.appendRow(SHEET_COLUMNS[name]);
  });
  var def = ss.getSheetByName('Sheet1');
  if (def && Object.keys(SHEET_COLUMNS).indexOf('Sheet1') < 0) ss.deleteSheet(def);
  return ss.getId();
}
