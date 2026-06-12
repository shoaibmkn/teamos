# TeamOS Documentation

TeamOS is an AI-native team operating system for operational visibility, workflow execution, and evidence-driven reporting.

This documentation set is the source of truth before implementation.

## Documents

- [Product Requirements Document](./prd.md)
- [Architecture](../architecture/architecture.md)
- [Database Design](../architecture/database-design.md)
- [API Specification](../architecture/api-spec.md)
- [Security Model](../architecture/security-model.md)
- [ADR 0001: Target MVP Architecture](../architecture/adr/0001-target-mvp-architecture.md)
- [ADR 0002: Repository Pattern Over Sheets](../architecture/adr/0002-repository-pattern-over-sheets.md)
- [ADR 0003: AI Advisory Boundary](../architecture/adr/0003-ai-advisory-boundary.md)

## Product Principles

- Work generates reporting.
- Employee updates must take less than 60 seconds.
- Manager review must take less than 5 minutes.
- Evidence and immutable activity history are mandatory.
- AI can summarize, detect risk, and recommend action, but never mutates records.

## Implementation Gate

Before major code changes, update:

- PRD when product behavior changes.
- Architecture when system boundaries change.
- Database design when schema changes.
- API spec when contracts change.
- Security model when trust boundaries, permissions, or data exposure change.
- ADRs when a durable technical decision is made.

