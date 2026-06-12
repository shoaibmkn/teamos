# ADR 0001: Target MVP Architecture

## Status

Accepted

## Context

TeamOS needs free-tier friendly infrastructure for MVP while keeping future migration path open. Required stack is Next.js, React, Tailwind, TypeScript, PWA, Google Apps Script, Google Sheets, Google Drive, Google OAuth, Gemini API, and Firebase Hosting.

## Decision

Use:

- Next.js PWA hosted on Firebase.
- Google Apps Script as API layer.
- Google Sheets as structured datastore.
- Google Drive as evidence storage.
- Google OAuth for authentication.
- Gemini API behind API-side AI service.

All business logic must sit behind application services and repository interfaces. Frontend cannot access Sheets, Drive write APIs, or Gemini directly.

## Consequences

Positive:

- Low operating cost for MVP.
- Fast deployment path.
- Native fit with Google Workspace users.
- Clear upgrade path to Cloud Run, PostgreSQL, and Cloud Storage.

Negative:

- Sheets has scalability limits.
- Apps Script runtime has quotas and latency constraints.
- Strong repository boundaries are required from day one.

## Follow-Up

- Track Apps Script quota-sensitive paths.
- Keep API contracts stable for future Cloud Run migration.
- Avoid spreadsheet-specific assumptions in domain logic.

