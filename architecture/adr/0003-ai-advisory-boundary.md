# ADR 0003: AI Advisory Boundary

## Status

Accepted

## Context

TeamOS uses AI for summaries, risk detection, delay detection, and bottleneck detection. Source records must remain auditable and user-controlled. Prompt injection risk exists because task comments, evidence notes, and external references can contain untrusted text.

## Decision

AI is advisory only.

AI may:

- Generate summaries.
- Detect risk.
- Detect delays.
- Detect workflow bottlenecks.
- Produce recommendations.

AI may not:

- Modify records.
- Call mutation endpoints.
- Delete, archive, or complete tasks.
- Change workflow state.
- Override RBAC.

AI output is stored as summary records and linked to prompt version, model, period, and scope.

## Consequences

Positive:

- Preserves auditability.
- Reduces prompt injection blast radius.
- Keeps humans accountable for state changes.

Negative:

- Users must apply AI recommendations manually.
- Some automation opportunities are deferred.

## Enforcement

- AI service receives sanitized data.
- AI service has no repository write access except SummaryRepository.
- Mutation endpoints do not accept AI identity as actor.
- Security tests verify AI routes cannot mutate source records.

