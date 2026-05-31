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
- **Last stop:** 2026-05-31 19:48
- **Branch:** feature/frontend-phase4-5
- **Last commit:** 00b819a Feature/webhooks (#30)
- **Modified files:**
```
M .claude/memory/MEMORY.md
 M packages/revenue-frontend/app/routes.ts
 M packages/revenue-frontend/tests/e2e/billing-operations.spec.ts
?? packages/revenue-frontend/app/lib/api/hooks/use-renewals.ts
?? packages/revenue-frontend/app/routes/renewals._index.tsx
?? packages/revenue-frontend/tests/e2e/renewals.spec.ts
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
<!-- Appended by .claude/hooks/session-end.js on Stop -->
