# Product Requirements Document

## Product

TeamOS is an AI-native team operating system for operational teams. It provides operational visibility, workflow execution, evidence-driven completion, audit history, and AI-assisted reporting.

TeamOS is not project management software, employee monitoring software, time tracking software, or ticketing software.

## Target Users

- Admins
- Managers
- Employees
- Operational teams
- QC teams
- Analysts
- Remote teams
- Project coordinators
- Operations managers
- Department heads
- Executives

## MVP Goals

- Employees can update work in less than 60 seconds.
- Managers can review team state in less than 5 minutes.
- No manual timesheets.
- Completion requires evidence or a completion comment.
- Every material action is logged in an immutable activity timeline.
- AI generates summaries and risk signals without modifying records.
- System can run on free-tier friendly infrastructure.

## Core Workflows

### Authentication

Users authenticate with Google OAuth. Manual registration is not part of MVP. Workspace email is the primary identity. Access is role-based.

Roles:

- Admin
- Manager
- Employee

### Employee Work Update

Employee opens inbox, selects assigned task, changes status, adds evidence or completion comment when completing, and submits. Target completion time is less than 60 seconds.

### Manager Review

Manager opens dashboard and sees delayed work, blocked work, waiting reasons, SLA risk, completion evidence, and AI summaries. Target review time is less than 5 minutes.

### Workflow Execution

Admins or managers create workflow instances from templates. Workflow stages produce tasks, dependencies, status changes, and activity history.

### Evidence Capture

Evidence can be a link, screenshot, file, Drive folder, email reference, or meeting notes. Evidence is immutable after submission.

### AI Reporting

AI generates daily, weekly, monthly, employee, manager, and executive summaries. AI detects risk, delay, and workflow bottlenecks.

AI output is advisory only. Users must make record changes explicitly through normal application actions.

## Functional Requirements

### Authentication

- Google OAuth sign-in.
- Workspace email identity.
- Role-based access control.
- No secrets exposed to frontend.

### Workflow Engine

- Workflow templates.
- Workflow instances.
- Workflow stages.
- Workflow history.
- Workflow progress.
- Workflow dependencies.
- Workflow SLA tracking.

### Task Engine

Task statuses:

- Inbox
- Assigned
- In Progress
- Waiting Internal
- Waiting External
- Review
- Completed
- Cancelled

Waiting reasons:

- Country Response
- Manager Approval
- Data Required
- Vendor Response
- Customer Response
- Other

### Activity Timeline

- Append-only.
- Immutable.
- Every action logged.
- Entries include actor, timestamp, entity type, entity id, action, and metadata.

### Evidence Engine

Supported evidence types:

- Link
- Screenshot
- File
- Drive Folder
- Email Reference
- Meeting Notes

Completion rule:

- Task completion requires evidence or completion comment.

### Dashboard Engine

Dashboards:

- Employee Dashboard
- Manager Dashboard
- Executive Dashboard
- Workflow Dashboard
- Market Dashboard

## Non-Functional Requirements

- Availability target: 99.5%.
- Page load target: less than 2 seconds.
- Dashboard load target: less than 5 seconds.
- Responsive UI required.
- Dark mode required.
- PWA support required.
- Full audit history required.

## Assumptions

- MVP tenant model is one Google Workspace organization per deployment.
- Google Sheets is acceptable as MVP database if accessed only through Apps Script API.
- Google Drive is the MVP storage layer for evidence files and folders.
- Firebase hosts the frontend.
- Apps Script is the API layer and owns all direct Sheet and Drive access.
- Gemini API is accessed only from server-side code.

## Out Of Scope For MVP

- Time tracking.
- Keystroke or screen monitoring.
- Public self-registration.
- Direct browser access to Google Sheets.
- AI-driven record mutation.
- Multi-database production deployment.

## Success Metrics

- Median employee update time below 60 seconds.
- Median manager dashboard review time below 5 minutes.
- 100% of completed tasks include evidence or completion comment.
- 100% of status changes produce activity entries.
- 0 frontend-exposed secrets.
- 0 hard deletes of business records.

