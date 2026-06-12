# ADR 0002: Repository Pattern Over Sheets

## Status

Accepted

## Context

Google Sheets is the MVP database, but future scale path requires PostgreSQL. Direct use of Sheets APIs throughout business logic would make migration expensive and risky.

## Decision

All persistence access goes through repository interfaces:

- UserRepository
- WorkflowTemplateRepository
- WorkflowInstanceRepository
- TaskRepository
- EvidenceRepository
- ActivityRepository
- SummaryRepository

MVP implementations can use Sheets and Drive. Application services depend only on interfaces.

## Consequences

Positive:

- Business rules stay portable.
- Tests can use in-memory repositories.
- PostgreSQL migration can happen behind stable service APIs.

Negative:

- Slightly more upfront structure.
- Repository contracts need discipline as features grow.

## Enforcement

- No direct Sheets calls in frontend.
- No direct Sheets calls in UI components.
- No business rules embedded in Sheets-specific repository code.
- Repository interfaces must be documented before implementation changes.

