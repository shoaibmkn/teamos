# Database Design

## Design Rules

- No hard deletes.
- Archive only.
- Activity logs are append-only.
- Evidence is immutable.
- Every record has createdAt, createdBy, updatedAt, and updatedBy where applicable.
- Every change is attributable to a user.
- Sheets are accessed only through the API layer.

## ID Strategy

Use string IDs with stable prefixes:

- `usr_` for users
- `wft_` for workflow templates
- `wfi_` for workflow instances
- `stg_` for workflow stages
- `tsk_` for tasks
- `act_` for activity entries
- `evd_` for evidence
- `sum_` for AI summaries

## Sheets

### Users

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | string | yes | `usr_` prefixed |
| email | string | yes | Workspace email |
| displayName | string | yes | Google profile name |
| role | enum | yes | Admin, Manager, Employee |
| managerUserId | string | no | Manager relationship |
| department | string | no | Reporting group |
| status | enum | yes | Active, Archived |
| createdAt | datetime | yes | ISO 8601 |
| createdBy | string | yes | User id |
| updatedAt | datetime | yes | ISO 8601 |
| updatedBy | string | yes | User id |

### WorkflowTemplates

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | string | yes | `wft_` prefixed |
| name | string | yes | Template name |
| description | string | no | Template purpose |
| ownerUserId | string | yes | Admin or manager |
| status | enum | yes | Active, Archived |
| version | number | yes | Increment on material change |
| slaHours | number | no | Default SLA |
| createdAt | datetime | yes | ISO 8601 |
| createdBy | string | yes | User id |
| updatedAt | datetime | yes | ISO 8601 |
| updatedBy | string | yes | User id |

### WorkflowStages

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | string | yes | `stg_` prefixed |
| workflowTemplateId | string | yes | Parent template |
| name | string | yes | Stage name |
| order | number | yes | Stage sequence |
| defaultAssigneeRole | enum | no | Admin, Manager, Employee |
| slaHours | number | no | Stage SLA |
| requiredEvidenceType | enum | no | Optional evidence rule |
| status | enum | yes | Active, Archived |

### WorkflowInstances

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | string | yes | `wfi_` prefixed |
| workflowTemplateId | string | yes | Source template |
| name | string | yes | Instance name |
| status | enum | yes | Active, Waiting, Completed, Cancelled, Archived |
| ownerUserId | string | yes | Responsible manager |
| currentStageId | string | no | Current stage |
| startedAt | datetime | yes | ISO 8601 |
| dueAt | datetime | no | SLA target |
| completedAt | datetime | no | ISO 8601 |
| createdAt | datetime | yes | ISO 8601 |
| createdBy | string | yes | User id |
| updatedAt | datetime | yes | ISO 8601 |
| updatedBy | string | yes | User id |

### Tasks

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | string | yes | `tsk_` prefixed |
| workflowInstanceId | string | no | Null for standalone task |
| stageId | string | no | Related stage |
| title | string | yes | Task title |
| description | string | no | Task details |
| assigneeUserId | string | yes | Assigned employee |
| managerUserId | string | yes | Responsible manager |
| status | enum | yes | Inbox, Assigned, In Progress, Waiting Internal, Waiting External, Review, Completed, Cancelled |
| waitingReason | enum | no | Required for waiting statuses |
| priority | enum | yes | Low, Normal, High, Critical |
| dueAt | datetime | no | SLA target |
| completedAt | datetime | no | Required when completed |
| completionComment | string | no | Required if no evidence |
| archivedAt | datetime | no | Archive marker |
| createdAt | datetime | yes | ISO 8601 |
| createdBy | string | yes | User id |
| updatedAt | datetime | yes | ISO 8601 |
| updatedBy | string | yes | User id |

### Evidence

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | string | yes | `evd_` prefixed |
| taskId | string | yes | Related task |
| type | enum | yes | Link, Screenshot, File, Drive Folder, Email Reference, Meeting Notes |
| title | string | yes | Evidence label |
| uri | string | no | Link or Drive URI |
| notes | string | no | User-entered notes |
| provider | enum | no | Drive, Gmail, Calendar, External |
| providerObjectId | string | no | External object id |
| createdAt | datetime | yes | ISO 8601 |
| createdBy | string | yes | User id |

Evidence has no updatedAt field because evidence is immutable.

### Activity

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | string | yes | `act_` prefixed |
| actorUserId | string | yes | User performing action |
| entityType | enum | yes | User, WorkflowTemplate, WorkflowInstance, Task, Evidence, Summary |
| entityId | string | yes | Target record id |
| action | string | yes | Domain action name |
| occurredAt | datetime | yes | ISO 8601 |
| metadataJson | string | no | Structured JSON payload |
| requestId | string | yes | API request correlation |

Activity entries are append-only and immutable.

### Summaries

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | string | yes | `sum_` prefixed |
| scopeType | enum | yes | Employee, Manager, Executive, Workflow |
| scopeId | string | no | User, team, or workflow id |
| periodStart | date | yes | Inclusive |
| periodEnd | date | yes | Inclusive |
| model | string | yes | AI model identifier |
| promptVersion | string | yes | Prompt template version |
| summaryText | string | yes | Advisory output |
| riskJson | string | no | Structured risk signals |
| createdAt | datetime | yes | ISO 8601 |
| createdBy | string | yes | System or user id |

## Validation Rules

- Email must belong to allowed Workspace domain.
- Role must be one of Admin, Manager, Employee.
- Waiting reason is required when status is Waiting Internal or Waiting External.
- Evidence or completionComment is required when status becomes Completed.
- completedAt is required when status is Completed.
- Archived records cannot be modified except restore workflows explicitly approved later.
- AI summaries cannot modify source records.

