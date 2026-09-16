# CLAUDE.md

## Session Bootstrap

Load `.claude/memory/MEMORY.md` at session start for project state and prior context.

## SDLC Workflow

```
/plan → /tdd → implement → /code-review → /checkpoint → PR
```

ECC skills in `.claude/skills/`: `nestjs-patterns`, `backend-patterns`, `api-design`,
`database-migrations`, `prisma-patterns`, `tdd-workflow`, `e2e-testing`, `phase-audit`

## Stack (ADR-001, ADR-002)

Backend: NestJS + **Fastify** (not Express) + **SWC** build (not tsc) + Prisma.
Backend tests: **Jest** (unit) + **Supertest** (integration) only — Playwright is
frontend-only E2E, never use it for backend testing.

## Quality Gate

Pre-commit hook (`.git/hooks/pre-commit`) runs: typecheck → lint → unit tests.
Never skip with `--no-verify` unless user explicitly asks.

## Git Workflow

**Never commit directly to master.** All work on `<type>/<scope>-<description>` branches
(`feature/`, `fix/`, `refactor/`, `test/`, `docs/`, `chore/`). Squash-merge to master,
delete branch after. Full guide: `.claude/git-workflow.md`.

## Model Routing

Plan cap: 200k tokens. **Opus is off-limits** — Sonnet handles this codebase fine at
1/3 the burn rate. Haiku for mechanical work (boilerplate, DTOs, migrations,
`/checkpoint` summaries); Sonnet for anything needing reasoning (`/plan`, `/tdd`,
`/code-review`, architecture, debugging). Default session model: Sonnet.

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

## Product Model Rules (ADR-004)

Every product has `chargeType` (`recurring` | `one_time` | `usage_based` — usage_based
stored but billing logic deferred to Phase 6) and `category` (`platform` | `seats` |
`addon` | `support` | `professional_services` | `storage` | `api`). `billingInterval`
is **required** when `chargeType=recurring`, **ignored** otherwise. Optional:
`setupFee` (charged once, first invoice only), `trialPeriodDays`, `minCommitmentMonths`.

## Key Constraints

1. Hierarchy depth cap: 5 levels (recursive CTE guard — never remove)
2. DB pool: max 5 connections/process (90 total across PM2 cluster)
3. All financial mutations in DB transactions (ACID)
4. Never store card numbers — Stripe tokenization only (PCI)
5. Audit trail required on all financial mutations (SOC2/GDPR)
6. Job retry: 3 attempts, exponential backoff
7. Query timeout: 30s max on hierarchical queries

## Project Status Reports

Single source of truth: `README.md` → "Development Phases" (phase status, open gaps, backlog).
Per-feature detail: the one-line `**Status:**` header in `docs/features/<feature>.md`.
`docs/feature-spec.md` is a frozen historical plan — never a status source.
Verify against code before reporting anything as built. Do NOT mark tasks complete without explicit user confirmation.
Never use bulk sed/regex across phase boundaries — use Edit tool per change.

## Agent Configuration

Agent definitions: `.claude/agents/` — one file per agent. Never use `agents.md`.

## Documentation Conventions

- **Record progress in ONE place** — README "Development Phases". Never copy phase status into
  MEMORY.md, agent files, `feature-spec.md`, package READMEs, or task-tracker tables in feature docs
- Feature docs carry a single `**Status:**` line — no checkbox/task-tracker tables
- Use Edit tool for each status change individually
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
| Full endpoint listing (machine-generated) | `docs/reference/openapi.json` or `http://localhost:5177/api/docs` |
| Environment variables | `docs/reference/env-vars.md` |
| Feature doc template | `docs/reference/feature-doc-template.md` |
| Original plan (frozen, historical — not a status source) | `docs/feature-spec.md` |
| Feature docs (one-line `**Status:**` each) | `docs/features/` |
| Full git branch/commit workflow | `.claude/git-workflow.md` |
| Full SDLC/memory/token-optimization guide | `docs/WORKFLOW.md` |
| Architecture decision records | `docs/adrs/` |
