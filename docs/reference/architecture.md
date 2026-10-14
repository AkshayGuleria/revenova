# Architecture Reference

Two sections, deliberately separated:

- **[As Built](#as-built)** — what the code does today. Every claim cites a file. If it is not in the code, it does not belong here.
- **[Designed, Not Built](#designed-not-built)** — the original scalability design, none of which exists yet. Kept because Phase 6 planning needs it, labelled so nobody mistakes it for reality.

Phase status and the backlog live in [README → Development Phases](../../README.md#development-phases), never here.
Verified against code on 2026-09-26.

---

## As Built

### Stack

| Layer | Actual | Source |
|-------|--------|--------|
| Framework | NestJS 11 + Fastify adapter | `package.json` (`@nestjs/core ^11.1.19`, `@nestjs/platform-fastify`) |
| Build | SWC (ADR-001) | `.swcrc`, `nest-cli.json` |
| ORM / DB | Prisma 5 + PostgreSQL | `prisma/schema.prisma` |
| Queue | BullMQ 5 + Redis | `src/common/queues/queue.config.ts` |
| Frontend | React Router v7 + shadcn/ui | `packages/revenue-frontend` |
| Monorepo | npm workspaces | root `package.json` |

### Process model

**One Node process.** `src/main.ts:72` starts a single Fastify listener; there is no cluster, no PM2, no worker entrypoint anywhere in the repo.

The two BullMQ processors are ordinary Nest providers registered in `BillingModule` (`src/modules/billing/billing.module.ts`), which `AppModule` imports alongside the HTTP controllers. **Job handlers and request handling share one event loop** — a slow job blocks API responses.

```
┌──────────────────────────────────────────────────────────┐
│  Single Node process  (src/main.ts — app.listen, :5177)  │
│                                                          │
│   Fastify HTTP  ──  19 modules, ~94 endpoints            │
│   ValidationPipe: whitelist + forbidNonWhitelisted       │
│   Swagger UI at /api/docs  (ungated — see backlog)       │
│                          │                               │
│                          │  same event loop              │
│                          ▼                               │
│   BullMQ processors (in-process)                         │
│     • contract-billing      concurrency 5                │
│     • consolidated-billing  concurrency 2                │
│   retry: 3 attempts, exponential backoff                 │
└───────────┬──────────────────────────┬───────────────────┘
            │                          │
            ▼                          ▼
      PostgreSQL                     Redis
   (Prisma, default pool)          (BullMQ only)
```

### Queues

Six names are declared in `src/common/queues/queue.constants.ts`; **two are registered and consumed**:

| Queue | Processor | Concurrency |
|-------|-----------|-------------|
| `contract-billing` | `processors/contract-billing.processor.ts` | 5 |
| `consolidated-billing` | `processors/consolidated-billing.processor.ts` | 2 |

`email`, `pdf-generation`, `tax-calculation` and `invoice-status` are **declared but have no processor and no producer**. BullMQ's `.add()` succeeds against a queue with no consumer, so wiring a caller to one of these would silently accumulate jobs in Redis — do not use them until a processor exists.

Retry policy is 3 attempts with exponential backoff (`queue.config.ts`), matching the CLAUDE.md constraint.

### Data access

- **Hierarchy traversal is application-level recursion, not SQL.** `accounts.service.ts` walks the tree with one query per level (`buildAccountTree` :379, `collectDescendants` :366, ancestors loop :314). The 5-level cap is enforced in TypeScript (`maxDepth = 5`, :236/:314), not by a SQL guard. No `WITH RECURSIVE` exists anywhere in `src`.
- **No statement timeout** is configured, so the 30s hierarchical-query constraint is unenforced.
- **No connection-pool cap.** `PrismaService` (`src/common/prisma/prisma.service.ts`) extends `PrismaClient` with no datasource override, and no `DATABASE_URL` carries `connection_limit`. Prisma therefore defaults to `num_cpus * 2 + 1` per process.

### Core DB entities

Purpose only — **`prisma/schema.prisma` is the schema's source of truth**; columns and indices are not duplicated here because they drift.

| Entity | Purpose |
|--------|---------|
| `accounts` | Hierarchical via `parent_account_id`, capped at 5 levels |
| `contracts` | Multi-year, seat-based pricing |
| `contract_products` / `contract_shares` | Product bindings with overrides; cross-account sharing |
| `products` | Seat-based and volume-tiered pricing |
| `invoices` / `invoice_items` | Linked to contracts, POs, groups; parent/child sub-invoices |
| `invoice_groups` | Department / cost-centre groupings |
| `purchase_orders` | Procurement with single-step approve/reject |
| `payments` | Applied against invoices |
| `exchange_rates` / `tax_rates` | FX by pair+date; tax by jurisdiction |
| `audit_log` | Mutation trail |
| `webhook_endpoints` / `webhook_deliveries` | Registrations and per-event delivery attempts |

### Integration points

| Target | Address | Notes |
|--------|---------|-------|
| Frontend → API | `http://localhost:5177` | CORS origins hardcoded in `main.ts`; `CORS_ORIGINS` is documented but unread |
| Redis | `redis://localhost:6379` | BullMQ only |
| Auth server | `http://localhost:5176` | **Not integrated** — no guard exists; see backlog |

Environment variables: [`env-vars.md`](./env-vars.md). Endpoints: [`openapi.json`](./openapi.json) or `/api/docs`.

---

## Designed, Not Built

Everything below was specified before Phase 1 and **none of it is implemented**. It is retained for Phase 6 planning. Each item is tracked in [README → Backlog](../../README.md#backlog-not-built).

### Original design (Express-era; corrected to the current stack)

```
        React frontend
              │ REST + webhooks
              ▼
    ┌─────────────────────────────┐
    │  PM2 cluster — 4 processes  │   ← not implemented
    │  Fastify API (I/O-bound)    │
    └──────────────┬──────────────┘
                   │ offload CPU / scheduled work
                   ▼
    ┌─────────────────────────────┐
    │  8 BullMQ queues            │   ← 2 exist
    │  contract-billing, consolidated-billing,
    │  pdf, tax, email, renewal-alerts,
    │  webhook-delivery, dunning  │
    └──────────────┬──────────────┘
                   ▼
    ┌─────────────────────────────┐
    │  Dedicated worker processes │   ← none exist
    │  2 contract billing         │
    │  2 consolidated billing     │
    │  3 PDF (Worker Threads)     │
    │  2 tax (Worker Threads)     │
    │  2 email, 1 renewal, 2 webhook
    └─────────────────────────────┘
```

The original diagram drew Express boxes; the stack has been NestJS + Fastify since ADR-001, so the boxes above are corrected. Full historical version: `docs/feature-spec.md`.

### Gaps against the documented constraints

| Designed | Reality |
|----------|---------|
| PM2 cluster, 4 API processes | Single process, no PM2 config in repo |
| Worker Threads for PDF/tax | No `worker_threads` usage; no PDF or tax worker |
| Recursive CTEs for hierarchy | Application-level recursion, one query per level |
| DB pool max 5/process, 90 total | No cap set; Prisma default applies |
| 30s statement timeout | Not configured |
| Read replicas, materialised ARR/MRR views | Neither exists |
| Caching (hierarchy 15m, catalog 1h, FX 24h) | No cache layer |

### Performance targets (unvalidated)

No load-test artefacts exist in the repo, and the topology these numbers assume was never built. Treat them as **goals, not measurements**: 200 req/sec API; 40 invoices/sec contract billing; 15/sec consolidated; 48 PDFs/sec; 10K accounts per 4 min quarterly; 50K per 21 min annual; 80 hierarchical queries/sec.

### Planned optimisations

Batch 500 contracts per billing job and 100 emails per batch; stagger month-end billing across days 1–5. Neither is implemented — batch billing itself is a stub (`contract-billing.processor.ts`).
