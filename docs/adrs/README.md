# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for the Revenue Management Backend System.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that captures an important architectural decision made along with its context and consequences.

## ADR Format

Each ADR follows this structure:

```markdown
# [Number]. [Title]

**Date:** YYYY-MM-DD
**Status:** [Proposed | Accepted | Rejected | Deprecated | Superseded by ADR-XXX]
**Topic:** [Category: Framework, Database, Scalability, etc.]
**Scope:** [Which parts of the system this affects]
**Deciders:** [Who made or contributed to this decision]

## Context and Problem Statement

[Describe the context and problem that led to this decision]

## Decision

[The decision that was made]

## Consequences

### Positive
- [Benefit 1]
- [Benefit 2]

### Negative
- [Trade-off 1]
- [Trade-off 2]

### Neutral
- [Impact 1]

## Alternatives Considered

### Alternative 1: [Name]
- Pros: [...]
- Cons: [...]
- Reason for rejection: [...]

## References
- [Link or document reference]
```

## Index of ADRs

| # | Title | Date | Status | Topic |
|---|-------|------|--------|-------|
| [001](./001-nestjs-fastify-swc-framework.md) | Adopt NestJS + Fastify + SWC for Backend | 2026-01-13 | Accepted | Framework |
| [002](./002-backend-testing-framework.md) | Backend Testing Framework - Jest + Supertest (Not Playwright) | 2026-01-13 | Accepted | Testing Strategy |
| [003](./003-rest-api-response-structure.md) | REST API Response Structure & Query Parameters | 2026-01-14 | Accepted | API Standards |
| [004](./004-product-pricing-model-enhancement.md) | Product Pricing Model Enhancement — Charge Types, Categories & Setup Fees | 2026-02-18 | Accepted | Product/Billing |

## ADR Lifecycle

- **Proposed:** Decision is being considered
- **Accepted:** Decision has been approved and will be implemented
- **Rejected:** Decision was considered but not adopted
- **Deprecated:** Decision is no longer valid
- **Superseded:** Decision has been replaced by a newer ADR
