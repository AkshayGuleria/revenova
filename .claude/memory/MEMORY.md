# Revenova Session Memory

## Project State
- **Current Phase:** Phase 4 — Enterprise Operations (Purchase Orders + Credit Management)
- **Stack:** NestJS + TypeScript + Prisma + PostgreSQL + BullMQ + Redis
- **Frontend:** React Router v7 (Remix) + shadcn/ui
- **Monorepo:** npm workspaces (`packages/revenue-backend`, `packages/revenue-frontend`)

## Completed Phases
- Phase 1: Foundation (accounts, contracts, products, invoices) ✅
- Phase 2: Contract-Based Billing (automated invoicing, BullMQ, Worker Threads) ✅
- Phase 3: Hierarchical Accounts (recursive CTEs, consolidated billing) ✅
- Phase 3.5: Product Pricing Enhancement ✅

## Active Work
<!-- Update manually when starting/finishing a task -->

## Key Decisions
- REST API: operator-based query params (`field[op]=value`), offset pagination
- Response shape: `{ data, paging }` always — see ADR-003
- Hierarchy depth capped at 5 levels (recursive CTE guard)
- DB pool: max 5 per process (90 total across PM2 cluster)

## Resume Point
<!-- Auto-updated by session-end hook — edit "In progress" manually before stopping -->
- **Last stop:** 2026-05-31 13:38
- **Branch:** feature/tax-calculation
- **Last commit:** 15ea93d feat: add tax rates and jurisdiction-based tax calculation
- **Modified files:**
```
M .claude/memory/MEMORY.md
```
- **In progress:** _(update this manually before closing session)_

## Session Log
- 2026-05-31 07:25 [8936b6aa] branch:main
- 2026-05-31 09:45 [8936b6aa] branch:test/billing-dry-run-unit-e2e
- 2026-05-31 12:54 [8936b6aa] branch:master
- 2026-05-31 13:10 [8936b6aa] branch:feature/tax-calculation
- 2026-05-31 13:22 [8936b6aa] branch:feature/tax-calculation
- 2026-05-31 13:28 [8936b6aa] branch:feature/tax-calculation
- 2026-05-31 13:38 [8936b6aa] branch:feature/tax-calculation
<!-- Appended by .claude/hooks/session-end.js on Stop -->
