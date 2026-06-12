# TeamOS System Architecture

## Architecture Principles
- Simplicity first
- Free-tier optimized
- Audit-first design
- AI-assisted, human-controlled
- Mobile-first

## High Level Architecture
User -> Next.js PWA -> Apps Script API Layer -> Google Sheets Data Store -> Google Drive Storage -> Gemini API

## Components
1. Authentication Service (Google OAuth)
2. Workflow Engine
3. Task Management Service
4. Activity Timeline Service
5. Evidence Service
6. Notification Engine
7. AI Reporting Engine
8. Dashboard Service

## Data Flow
User Action -> Activity Log -> Task Update -> Workflow Update -> Dashboard Refresh -> AI Summary Generation.

## Reliability
Daily backups, immutable audit logs, append-only history.

## Future Scale Path
Sheets -> PostgreSQL
Apps Script -> Cloud Run
Drive -> Cloud Storage.