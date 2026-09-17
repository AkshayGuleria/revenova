# Revenova Session Memory

## Project State
- **Phase status + backlog:** `README.md` → Development Phases (single source of truth — do not copy status here)
- **Stack:** NestJS + TypeScript + Prisma + PostgreSQL + BullMQ + Redis
- **Frontend:** React Router v7 (Remix) + shadcn/ui
- **Monorepo:** npm workspaces (`packages/revenue-backend`, `packages/revenue-frontend`)

## Key Decisions
- Progress tracked in ONE place: README phase table (+ per-feature `**Status:**` header in `docs/features/`). `docs/feature-spec.md` frozen, no status (2026-09-14)
- REST API: operator-based query params (`field[op]=value`), offset pagination
- Response shape: `{ data, paging }` always — see ADR-003
- Hierarchy depth capped at 5 levels (recursive CTE guard)
- DB pool: max 5 per process (90 total across PM2 cluster)
- MEMORY.md always committed and pushed to remote (Option C — accept one-commit lag)
- Autonomous dev: feature per branch, PR per feature, parallel agents where possible

## Resume Point
<!-- Auto-updated by session-end hook — edit "In progress" manually before stopping -->
- **Last stop:** 2026-09-16 15:59
- **Branch:** docs/phase5-doc-updates
- **Last commit:** 845c4ff Merge origin/master into docs/phase5-doc-updates
- **Modified files:**
```
M .claude/memory/MEMORY.md
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
- 2026-09-14 19:31 [63a831f7] branch:docs/phase5-doc-updates
- 2026-09-14 19:32 [63a831f7] branch:docs/phase5-doc-updates
- 2026-09-14 19:57 [63a831f7] branch:docs/phase5-doc-updates
- 2026-09-14 19:58 [63a831f7] branch:docs/phase5-doc-updates
- 2026-09-14 19:58 [8fd8a4e3] branch:docs/phase5-doc-updates
- 2026-09-14 19:58 [8fd8a4e3] branch:docs/phase5-doc-updates
- 2026-09-14 19:58 [8fd8a4e3] branch:docs/phase5-doc-updates
- 2026-09-14 19:59 [8fd8a4e3] branch:docs/phase5-doc-updates
- 2026-09-14 19:59 [8fd8a4e3] branch:docs/phase5-doc-updates
- 2026-09-14 19:59 [8fd8a4e3] branch:docs/phase5-doc-updates
- 2026-09-14 19:59 [8fd8a4e3] branch:docs/phase5-doc-updates
- 2026-09-14 20:00 [8fd8a4e3] branch:docs/phase5-doc-updates
- 2026-09-14 20:44 [63a831f7] branch:docs/phase5-doc-updates
- 2026-09-15 19:07 [63a831f7] branch:docs/phase5-doc-updates
- 2026-09-15 19:12 [63a831f7] branch:docs/phase5-doc-updates
- 2026-09-15 19:58 [63a831f7] branch:docs/phase5-doc-updates
- 2026-09-15 19:58 [63a831f7] branch:docs/phase5-doc-updates
- 2026-09-16 15:55 [63a831f7] branch:docs/phase5-doc-updates
- 2026-09-16 15:57 [63a831f7] branch:docs/phase5-doc-updates
- 2026-09-16 15:58 [63a831f7] branch:docs/phase5-doc-updates
- 2026-09-16 15:59 [63a831f7] branch:docs/phase5-doc-updates
- 2026-09-16 15:59 [63a831f7] branch:docs/phase5-doc-updates
<!-- Appended by .claude/hooks/session-end.js on Stop -->
