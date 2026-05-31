# CLAUDE.md

## Session Bootstrap

Load `.claude/memory/MEMORY.md` at session start for project state and prior context.

## SDLC Workflow

```
/plan → /tdd → implement → /code-review → /checkpoint → PR
```

ECC skills in `.claude/skills/`: `nestjs-patterns`, `backend-patterns`, `api-design`,
`database-migrations`, `prisma-patterns`, `tdd-workflow`, `e2e-testing`

## Quality Gate

Pre-commit hook (`.git/hooks/pre-commit`) runs: typecheck → lint → unit tests.
Never skip with `--no-verify` unless user explicitly asks.

## Mandatory API Rules (ADR-003)

**Response shape — all endpoints:**
```typescript
{ data: T | T[], paging: { offset, limit, total, totalPages, hasNext, hasPrev } }
// Single resource: all paging fields null
// Paginated list: all paging fields filled
// Non-paginated list: only total filled
// Errors: { error: { code, message, statusCode, timestamp, path, details? } }
```

**Query parameter operators — all list endpoints:**
```
?status[eq]=active   ?createdAt[gte]=2024-01-01   ?status[in]=pending,overdue
?name[like]=acme     ?parentId[null]=true
```
Operators: `[eq]` `[ne]` `[lt]` `[lte]` `[gt]` `[gte]` `[in]` `[nin]` `[like]` `[null]`

**Pagination:** offset-based, default offset=0/limit=20, max limit=100.

**HTTP status codes:** 200 GET/PUT/PATCH, 201 POST, 204 DELETE, 400 validation,
404 not found, 409 conflict, 500 server error.

**Utilities:**
- Query parser: `src/common/utils/query-parser.ts`
- Response builder: `src/common/utils/response-builder.ts`
- Pagination DTO: `src/common/dto/pagination.dto.ts`
- API response interface: `src/common/interfaces/api-response.interface.ts`

## Key Constraints

1. Hierarchy depth cap: 5 levels (recursive CTE guard — never remove)
2. DB pool: max 5 connections/process (90 total across PM2 cluster)
3. All financial mutations in DB transactions (ACID)
4. Never store card numbers — Stripe tokenization only (PCI)
5. Audit trail required on all financial mutations (SOC2/GDPR)
6. Job retry: 3 attempts, exponential backoff
7. Query timeout: 30s max on hierarchical queries

## Project Status Reports

Read in order: `README.md` → `docs/features/` → `docs/feature-spec.md`.
Report by Phase with completion state. Do NOT mark tasks complete without explicit user confirmation.
Never use bulk sed/regex across phase boundaries — use Edit tool per change.

## Agent Configuration

Agent definitions: `.claude/agents/` — one file per agent. Never use `agents.md`.

## Documentation Conventions

- Use Edit tool for each checkbox/status change individually
- Confirm before making >3 changes at once
- Never modify tasks outside the requested phase/scope
- Create `docs/features/<feature>.md` after every new feature (see `docs/reference/feature-doc-template.md`)

## Testing Strategy

- Phase 1: unit tests, CRUD, contract validation, payment terms
- Phase 2: integration tests, billing engine, job scheduler, email/PDF
- Phase 3: hierarchical query testing, consolidated billing accuracy
- Phase 4+: PO workflows, credit enforcement, payment reconciliation, tax

## Reference Docs (load on demand)

| Topic | File |
|-------|------|
| Architecture, stack, DB schema, perf targets | `docs/reference/architecture.md` |
| Full endpoint listing | `docs/reference/api-endpoints.md` |
| Environment variables | `docs/reference/env-vars.md` |
| Feature doc template | `docs/reference/feature-doc-template.md` |
| Full task specification | `docs/feature-spec.md` |
| Completed feature docs | `docs/features/` |
