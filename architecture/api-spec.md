# API Specification

## Overview

The frontend talks only to the Apps Script API. Direct browser access to Google Sheets, Google Drive write operations, or Gemini API is prohibited.

All responses use JSON.

## Common Request Headers

| Header | Required | Notes |
| --- | --- | --- |
| Authorization | yes | Google OAuth bearer token or Apps Script identity context |
| X-Request-Id | yes | Client-generated request id |
| Content-Type | yes | `application/json` for write requests |

## Common Response Shape

```json
{
  "ok": true,
  "data": {},
  "requestId": "req_123"
}
```

Error response:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Completion requires evidence or completion comment.",
    "details": {}
  },
  "requestId": "req_123"
}
```

## Error Codes

- `UNAUTHENTICATED`
- `FORBIDDEN`
- `VALIDATION_ERROR`
- `NOT_FOUND`
- `CONFLICT`
- `RATE_LIMITED`
- `AI_UNAVAILABLE`
- `INTERNAL_ERROR`

## Authentication

### GET /me

Returns current user and permissions.

Response:

```json
{
  "ok": true,
  "data": {
    "user": {
      "id": "usr_123",
      "email": "employee@example.com",
      "displayName": "Employee",
      "role": "Employee"
    },
    "permissions": ["task:read:self", "task:update:self"]
  },
  "requestId": "req_123"
}
```

## Tasks

### GET /tasks

Lists tasks visible to caller.

Query:

- `status`
- `assigneeUserId`
- `managerUserId`
- `workflowInstanceId`
- `limit`
- `cursor`

### POST /tasks

Creates task. Managers and admins only.

Request:

```json
{
  "title": "Collect evidence",
  "description": "Upload completion file.",
  "assigneeUserId": "usr_employee",
  "managerUserId": "usr_manager",
  "workflowInstanceId": "wfi_123",
  "stageId": "stg_123",
  "priority": "Normal",
  "dueAt": "2026-06-13T10:00:00.000Z"
}
```

### PATCH /tasks/{taskId}/status

Updates task status.

Request:

```json
{
  "status": "Completed",
  "waitingReason": null,
  "completionComment": "Completed with attached evidence.",
  "evidenceIds": ["evd_123"]
}
```

Rules:

- Assignee can update own task.
- Manager can update tasks in team scope.
- Completion requires existing evidence or completionComment.
- Waiting statuses require waitingReason.

### GET /tasks/{taskId}/activity

Returns activity timeline for task.

## Evidence

### POST /tasks/{taskId}/evidence

Adds immutable evidence to task.

Request:

```json
{
  "type": "Link",
  "title": "Client confirmation",
  "uri": "https://example.com/confirmation",
  "notes": "Client approved completion."
}
```

Rules:

- Evidence cannot be edited after creation.
- Evidence can be archived only through admin-governed process defined later.

### GET /tasks/{taskId}/evidence

Lists evidence for task.

## Workflows

### GET /workflow-templates

Lists active workflow templates visible to caller.

### POST /workflow-templates

Creates workflow template. Admins and managers only.

### POST /workflow-instances

Starts workflow instance from template.

Request:

```json
{
  "workflowTemplateId": "wft_123",
  "name": "June onboarding workflow",
  "ownerUserId": "usr_manager",
  "dueAt": "2026-06-30T18:00:00.000Z"
}
```

### GET /workflow-instances/{workflowInstanceId}

Returns workflow instance, stages, tasks, evidence counts, SLA state, and recent activity.

## Dashboards

### GET /dashboards/employee

Returns employee inbox, assigned tasks, waiting tasks, review tasks, due soon, overdue, and AI advisory summary if available.

### GET /dashboards/manager

Returns team task state, delayed work, waiting reasons, SLA risk, workflow bottlenecks, evidence gaps, and AI advisory summary.

### GET /dashboards/executive

Returns aggregate operational health, completion trends, SLA risk, top bottlenecks, and AI advisory summary.

## AI

### POST /ai/summaries

Generates advisory summary. Managers and admins can request team and executive summaries. Employees can request own summary.

Request:

```json
{
  "scopeType": "Manager",
  "scopeId": "usr_manager",
  "periodStart": "2026-06-01",
  "periodEnd": "2026-06-12"
}
```

Rules:

- AI receives sanitized, least-privilege data.
- Prompt injection text from user content is treated as untrusted data.
- AI output is persisted as summary only.
- AI cannot call mutation endpoints.

## RBAC Summary

| Action | Admin | Manager | Employee |
| --- | --- | --- | --- |
| Read own tasks | yes | yes | yes |
| Update own assigned task | yes | yes | yes |
| Read team tasks | yes | yes | no |
| Create tasks | yes | yes | no |
| Manage users | yes | no | no |
| Create workflow templates | yes | yes | no |
| Start workflow instances | yes | yes | no |
| Generate own summary | yes | yes | yes |
| Generate team summary | yes | yes | no |
| Generate executive summary | yes | no | no |

