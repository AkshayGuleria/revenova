# Revenova Session Memory

## Project State
- **Current Phase:** Phase 5 COMPLETE ✅ — considering Phase 6 (B2C / usage-based billing)
- **Stack:** NestJS + TypeScript + Prisma + PostgreSQL + BullMQ + Redis
- **Frontend:** React Router v7 (Remix) + shadcn/ui
- **Monorepo:** npm workspaces (`packages/revenue-backend`, `packages/revenue-frontend`)

## Completed Phases
- Phase 1: Foundation (accounts, contracts, products, invoices) ✅
- Phase 2: Contract-Based Billing (automated invoicing, BullMQ, Worker Threads) ✅
- Phase 3: Hierarchical Accounts (recursive CTEs, consolidated billing) ✅
- Phase 3.5: Product Pricing Enhancement ✅
- Phase 4: Enterprise Operations ✅ (PRs #20-26)
  - Sub-invoices, invoice groups, contract-product binding, invoice dry run
  - Purchase orders, credit management, exchange rates, tax rates, payments
- Phase 5: Analytics & Optimization ✅ (PRs #27-30)
  - ARR/MRR analytics, renewal tracking, audit logging, webhooks

## Backend Modules (all on master, 811 tests)
accounts, analytics, app-config, audit-log, billing, contracts, credit-management,
exchange-rates, invoice-groups, invoices, payments, products, purchase-orders,
renewals, tax-rates, webhooks

## Key Decisions
- REST API: operator-based query params (`field[op]=value`), offset pagination
- Response shape: `{ data, paging }` always — see ADR-003
- Hierarchy depth capped at 5 levels (recursive CTE guard)
- DB pool: max 5 per process (90 total across PM2 cluster)
- MEMORY.md always committed and pushed to remote (Option C — accept one-commit lag)
- Autonomous dev: feature per branch, PR per feature, parallel agents where possible

## Resume Point
<!-- Auto-updated by session-end hook — edit "In progress" manually before stopping -->
- **Last stop:** 2026-06-04 21:13
- **Branch:** docs/phase5-doc-updates
- **Last commit:** dffaae7 docs(readme): update project status, phases, frontend features, DB schema, API docs
- **Modified files:**
```
M .claude/memory/MEMORY.md
 M .gitignore
```
- **In progress:** _(update this manually before closing session)_

## Session Log
- 2026-05-31 07:25 [8936b6aa] branch:main
- 2026-05-31 14:16 [8936b6aa] branch:feature/payments
- 2026-05-31 15:13 [8936b6aa] branch:feature/analytics-arr-mrr
- 2026-05-31 15:15 [8936b6aa] branch:feature/audit-log
- 2026-05-31 15:20 [8936b6aa] branch:feature/webhooks
- 2026-05-31 17:10 [8936b6aa] branch:master
- 2026-05-31 17:16 [8936b6aa] branch:master
- 2026-05-31 17:27 [8936b6aa] branch:feature/frontend-phase4-5
- 2026-05-31 18:41 [8936b6aa] branch:feature/frontend-phase4-5
- 2026-05-31 19:32 [bd1282eb] branch:feature/frontend-phase4-5
- 2026-05-31 19:48 [bd1282eb] branch:feature/frontend-phase4-5
- 2026-06-01 18:50 [bd1282eb] branch:master
- 2026-06-01 19:11 [bd1282eb] branch:master
- 2026-06-01 19:21 [bd1282eb] branch:master
- 2026-06-01 19:24 [bd1282eb] branch:master
- 2026-06-01 19:25 [bd1282eb] branch:master
- 2026-06-01 19:26 [bd1282eb] branch:master
- 2026-06-01 19:27 [bd1282eb] branch:master
- 2026-06-01 19:29 [bd1282eb] branch:master
- 2026-06-01 19:30 [bd1282eb] branch:master
- 2026-06-01 19:32 [bd1282eb] branch:master
- 2026-06-01 19:33 [bd1282eb] branch:master
- 2026-06-01 19:34 [bd1282eb] branch:master
- 2026-06-01 19:42 [bd1282eb] branch:master
- 2026-06-01 19:44 [bd1282eb] branch:master
- 2026-06-01 20:09 [bd1282eb] branch:master
- 2026-06-01 21:00 [bd1282eb] branch:feature/audit-log-webhooks-ui
- 2026-06-01 21:25 [bd1282eb] branch:master
- 2026-06-01 21:36 [bd1282eb] branch:master
- 2026-06-01 21:36 [bd1282eb] branch:master
- 2026-06-01 21:38 [bd1282eb] branch:master
- 2026-06-04 18:53 [bd1282eb] branch:master
- 2026-06-04 19:16 [bd1282eb] branch:master
- 2026-06-04 19:40 [bd1282eb] branch:master
- 2026-06-04 19:51 [bd1282eb] branch:master
- 2026-06-04 19:54 [bd1282eb] branch:master
- 2026-06-04 20:05 [bd1282eb] branch:master
- 2026-06-04 20:10 [bd1282eb] branch:docs/phase5-doc-updates
- 2026-06-04 20:11 [bd1282eb] branch:docs/phase5-doc-updates
- 2026-06-04 20:15 [bd1282eb] branch:docs/phase5-doc-updates
- 2026-06-04 20:15 [bd1282eb] branch:docs/phase5-doc-updates
- 2026-06-04 20:16 [bd1282eb] branch:docs/phase5-doc-updates
- 2026-06-04 20:18 [bd1282eb] branch:docs/phase5-doc-updates
- 2026-06-04 20:47 [bd1282eb] branch:docs/phase5-doc-updates
- 2026-06-04 21:13 [bd1282eb] branch:docs/phase5-doc-updates
<!-- Appended by .claude/hooks/session-end.js on Stop -->
