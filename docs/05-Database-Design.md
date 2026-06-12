# TeamOS Database Design

## Database Strategy
MVP: Google Sheets
Growth: PostgreSQL

## Core Tables

### Users
UserID
Email
Name
Role
ManagerID
Department
Status
Timezone
LastLogin
CreatedDate

### WorkflowTemplates
TemplateID
Name
Description
Stages
SLA
Status
CreatedDate

### Workflows
WorkflowID
TemplateID
Title
Owner
Market
CurrentStage
Status
Progress
CreatedDate

### Tasks
TaskID
WorkflowID
ParentTaskID
Title
Description
Priority
Status
WaitingReason
AssignedTo
AssignedBy
DueDate
CreatedDate

### ActivityLog
ActivityID
TaskID
Timestamp
Action
OldValue
NewValue
Comment
CreatedBy

### Evidence
EvidenceID
TaskID
Type
URL
DriveFileID
Description
UploadedBy
Timestamp

### Comments
CommentID
TaskID
ParentCommentID
CreatedBy
Comment
Timestamp

## Design Principles
Append-only audit logs.
No hard deletes.
Immutable history.
Index by TaskID, WorkflowID, AssignedTo and Status.