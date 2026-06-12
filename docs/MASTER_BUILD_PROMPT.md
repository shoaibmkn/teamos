# TeamOS — AI Native Team Operating System

## Mission
Build a production-grade operational visibility platform where work automatically creates reporting.

### Success Metrics
- Employee update time < 60 seconds
- Manager review < 5 minutes/day
- Full audit history
- AI-generated reporting
- Free-tier friendly architecture

## MVP Modules
1. Authentication & Roles
2. Workflows & Tasks
3. Activity Timeline & Evidence
4. Manager Dashboard
5. AI Summaries

## Stack
Frontend: Next.js, React, Tailwind, PWA
Backend: Google Apps Script
Database: Google Sheets
Storage: Google Drive
Auth: Google OAuth
AI: Gemini API
Hosting: Firebase

## Core Entities
Users, WorkflowTemplates, Workflows, Tasks, ActivityLog, Evidence, Comments, Notifications.

## Business Rules
- No hard deletes.
- Activity logs append-only.
- Evidence immutable.
- AI cannot modify records.
- Tasks support Inbox, In Progress, Waiting, Review, Completed.
- Waiting reasons required.
- Completion requires evidence or comment.

## Architecture
Next.js UI -> Apps Script API -> Google Sheets -> Gemini API -> Drive Storage.

## Security
RBAC, Google OAuth, audit trail, least privilege, immutable history.

## AI Features
Daily, weekly, monthly, employee, manager and executive summaries.
Risk detection and workflow bottleneck identification.

## Delivery Phases
Phase 1: Auth and RBAC
Phase 2: Data Model and APIs
Phase 3: Workflow Engine
Phase 4: Dashboards
Phase 5: AI Reporting
Phase 6: Testing and Deployment

## Acceptance Criteria
Production-ready, mobile-first, responsive, dark mode, audit compliant, minimal clicks, operational visibility first.