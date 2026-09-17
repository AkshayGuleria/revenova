# End-to-End Security & Correctness Audit — 2026-09-16

**Scope:** whole solution — `packages/revenue-backend` (NestJS + Fastify + Prisma + BullMQ),
`packages/revenue-frontend` (React Router 7), tests, CI and deployment config.
**Method:** six parallel read-only audits (auth/API surface, financial correctness, data layer,
background jobs, frontend, tests/config). Every P0 below was re-verified by hand against the source.
**Commit audited:** `fb065fa` (master).

This is a dated findings record. It is **not** a status tracker — open work is listed in
[README → Backlog](../../README.md#backlog-not-built). Do not update this file as items are fixed;
it stays as written.

**Severity:** **P0** = exploitable by an unauthenticated caller, or produces silently wrong money.
**P1** = serious defect or missing control, needs a fix before production. **P2** = real but lower risk.
Minor/style issues were deliberately excluded.

---

## P0 — exploitable or silently wrong money

### P0-1 · No authentication, and no tenancy scoping beneath it
`src/main.ts`, `src/app.module.ts` — no `AuthGuard`, `APP_GUARD`, JWT or session verification exists.
`AUTH_SERVER_URL`, `JWT_SECRET` and `API_KEY` are documented in env files but never read by any code.
Every `:id` route resolves a raw UUID with no ownership check in any service.

Anyone who can reach the port can read and mutate all accounts, invoices, payments, credit limits and PII.
The second half matters as much as the first: adding a login check alone still leaves every authenticated
caller able to read any other tenant's data by guessing a UUID. Authentication and resource scoping must
land together.

### P0-2 · Mass assignment marks invoices paid and grants credit
`src/modules/invoices/invoices.service.ts:574` — `const updateData: any = { ...data }` goes straight into
`prisma.invoice.update`. `UpdateInvoiceDto` is `PartialType(CreateInvoiceDto)`, which exposes `status`,
`paidAmount`, `subtotal`, `tax`, `discount` and `total`.

`PATCH /api/invoices/:id {"status":"paid","paidAmount":999999}` marks any invoice settled with no payment
record, bypassing `PaymentsService` entirely. `{"total":0}` zeroes an invoice.

Same pattern at `src/modules/accounts/accounts.service.ts:59` — `POST /api/accounts` accepts `creditLimit`
and `creditHold`, bypassing the dedicated `/accounts/:id/credit` endpoint.

Note `ValidationPipe` runs with `whitelist` + `forbidNonWhitelisted`, which blocks *unknown* fields but
does nothing here: these fields are declared on the DTO.

### P0-3 · SSRF via webhook registration
`src/modules/webhooks/dto/create-webhook.dto.ts:33` uses a bare `@IsUrl()`, which accepts
`http://169.254.169.254/…`, `http://127.0.0.1:6379/` and RFC1918 addresses.
`src/modules/webhooks/webhooks.service.ts:203` then does a raw `fetch(url)` — redirects followed by
default — and stores the response body in `WebhookDelivery.responseBody`, readable through
`GET /api/webhooks/:id/deliveries`.

Register a webhook pointing at cloud metadata, trigger any invoice event, read the credentials back out.
Blocking only at registration is insufficient (DNS rebinding) — resolve and check the IP before each dispatch.

### P0-4 · Webhook HMAC secret is brute-forcible through query filters
`src/modules/webhooks/webhooks.service.ts:53` builds a Prisma `where` from the raw request query via
`parseQuery`, and `src/common/utils/query-parser.ts` has no per-model field whitelist (`SAFE_FIELD_RE`
only blocks prototype-pollution names).

`secret` is correctly omitted from `select`, but remains filterable: `GET /api/webhooks?secret[like]=ab%`
turns `paging.total` into a boolean oracle, recovering the signing secret character by character. With the
secret, an attacker forges signed deliveries to the subscriber.

Four more controllers take the same unvalidated `@Query() query: Record<string, any>`, where the global
`ValidationPipe` is a no-op: `payments.controller.ts:30`, `purchase-orders.controller.ts:40`,
`audit-log.controller.ts:23`, `tax-rates.controller.ts:37`.

### P0-5 · Lost update on payment application
`src/modules/payments/payments.service.ts:163` reads the invoice **before** `$transaction` opens, then at
`:174` computes `Number(invoice.paidAmount) + Number(payment.amount)` from that stale object and writes it back.
Postgres Read Committed does not prevent this, and there is no `SELECT … FOR UPDATE` or version check.

Two 5,000 payments applied concurrently to an invoice at 0: both read 0, both write 5,000. The invoice records
5,000 received when 10,000 arrived. There is also no cap — `paidAmount` can exceed `total` with no error and
no credit-balance concept. The same code does money math in JS floats rather than `Decimal`.

Fix shape: `data: { paidAmount: { increment: amount } }` inside the transaction.

### P0-6 · Every automated invoice bills zero tax
`src/modules/billing/services/billing-engine.service.ts:412` — `const tax = new Decimal(0)`, unconditional.
`src/modules/billing/services/consolidated-billing.service.ts:493` — `calculateTax` is a TODO stub returning 0.
`TaxRatesService.calculateTax` exists and works, but no billing path calls it.

Every recurring and consolidated invoice for a VAT/GST/sales-tax jurisdiction under-bills tax to zero.

### P0-7 · Setup fees never charged; volume tiers never applied
`billing-engine.service.ts:73` and `:183` hardcode `const product: BillableProduct | null = null`, so
`getSetupFee(product, …)` (`:270`) always returns 0 — a configured `setupFee` never reaches an invoice,
contradicting ADR-004.

`Product.volumeTiers` is read nowhere: it appears only as a DTO field
(`products/dto/create-product.dto.ts:177`) and an unused parameter on
`seat-calculator.service.ts:25`. A negotiated 500-seat tier rate is never applied — every period bills list price.

### P0-8 · Automated billing ignores credit hold
`CreditHoldGuard` is wired to exactly one route, `POST /api/invoices`
(`invoices.controller.ts:31`), and reads `request.body.accountId`. `BillingController` has no guards, and
`BillingEngineService.generateInvoiceFromContract` — used by both `POST /billing/generate` and the BullMQ
processor — contains no `creditHold` check at all. `ConsolidatedBillingService:54` does check it.

An account frozen for non-payment keeps getting auto-invoiced. Sub-invoice creation bypasses the guard too,
since `accountId` is inherited from the parent rather than sent in the body.

### P0-9 · Batch billing is a stub that reports success
`src/modules/billing/processors/contract-billing.processor.ts:100-108` — `// TODO: Implement batch billing
logic`, returns `{processedCount: 0, failedCount: 0, message: 'Batch billing not yet implemented'}`. The
worker then logs "completed successfully" (`:112`), and `POST /api/billing/batch` returns 202 "queued
successfully" (`billing.controller.ts:102`).

No contract is ever bulk-billed, while API and logs both report success. This is the only batch entry point.

### P0-10 · Invoice totals are supplied by the client
`src/modules/invoices/invoices.service.ts:374` validates only internal consistency
(`subtotal + tax - discount ≈ total`, tolerance 0.01) and then persists the client's `subtotal` and `total`
verbatim (`:407-411`). The submitted `items[]` are never summed and compared.

`app/components/invoices/sub-invoice-form.tsx:135` computes these in the browser. A tampered request bills
line items worth 500 as 50,000.

### P0-11 · No audit trail on the billing engine or payments
`AuditLogService` is referenced only by `invoices.service.ts`, and there as an unawaited
`void this.auditLogService.log(...)` outside the transaction. `billing-engine.service.ts`,
`consolidated-billing.service.ts` and `payments.service.ts` write none.

Additionally, no call site anywhere passes `actorId`, so every audit row is written
`actorId: null, actorType: 'system'` (`audit-log.service.ts:24`). There is currently no code path able to
record *who* did anything — this defeats the SOC2/GDPR requirement in CLAUDE.md, and stays broken even once
auth lands unless the principal is threaded through.

### P0-12 · `npm run test:e2e` wipes the development database
`packages/revenue-backend/test/setup-e2e.ts:22-29` constructs `new PrismaClient()` and unconditionally
`deleteMany()`s `InvoiceItem`, `Invoice`, `InvoiceGroup`, `ContractProduct`, `ContractShare`, `Contract`,
`Product`, `Account`. There is no `NODE_ENV` or database-name check, and Prisma loads the same `.env`
`DATABASE_URL` (`revenue_db_local`) that `npm run dev` uses.

Running the e2e suite locally destroys local dev data. If `DATABASE_URL` is ever exported to a shared or
staging database, that gets truncated instead, with no confirmation. CI is safe only incidentally.

`Payment` and `PurchaseOrder` are missing from the cleanup lists and reference `Account` with non-cascading
FKs, so `account.deleteMany()` will start throwing as soon as either gets e2e coverage.

---

## P1 — fix before production

| # | Finding | Evidence |
|---|---------|----------|
| P1-1 | Swagger UI mounted unconditionally with `tryItOutEnabled`, giving an unauthenticated live console over every financial mutation. `ENABLE_SWAGGER` is documented but never read. | `src/main.ts:44-69` |
| P1-2 | Paid/sent invoices can be amended or reverted — `update()` has no status guard; `remove()` hard-deletes any invoice regardless of status, cascading its items, with no audit entry. | `invoices.service.ts:504-637`, `invoices.controller.ts:232` |
| P1-3 | `app.enableShutdownHooks()` never called and no SIGTERM handler — every deploy abandons in-flight billing jobs and leaks DB connections. | `src/main.ts` |
| P1-4 | The "max 5 connections/process" rule is enforced nowhere: no `connection_limit` in any `DATABASE_URL`, no datasource override. Prisma defaults to `cpus*2+1` per process. | `prisma.service.ts`, all `.env*` |
| P1-5 | No recursive CTE exists anywhere, despite the CLAUDE.md constraint. Hierarchy traversal is app-level N+1 recursion, and no `statement_timeout` is set, so the mandated 30s cap is unenforced. | `accounts.service.ts:379-456`, `consolidated-billing.service.ts:382-416` |
| P1-6 | Schema/migration drift: the partial unique indexes preventing double billing exist only as raw SQL, invisible to `schema.prisma`. A future migration can silently drop them. | `migrations/20260419182522_*/migration.sql:6-14` |
| P1-7 | No rate limiting (`@nestjs/throttler` absent) and no security headers (`helmet` absent), though both are documented in env files. | `app.module.ts`, `package.json` |
| P1-8 | No global Prisma exception filter: parameter pollution (`?status[eq]=a&status[eq]=b`) surfaces an unstructured 500 instead of the ADR-003 error envelope. | `src/main.ts`, `query-parser.ts:161` |
| P1-9 | `offset` has no upper bound (only `limit` is capped at 100) — `offset=50000000` forces a full scan-and-discard on large tables. | `pagination.dto.ts:20`, `query-parser.ts:65` |
| P1-10 | Contract `remove()` hard-deletes outside a transaction with no audit entry and no check for related invoices/POs; cascades destroy pricing overrides and orphan invoices. | `contracts.service.ts:242-250` |
| P1-11 | Failed jobs have no dead-letter path or alerting, and `removeOnFail: false` retains payloads in Redis forever. Redis connection has no fail-fast config, so queue calls hang when Redis is down. | `billing-queue.service.ts:36,58,83`, `queue.config.ts:4-26` |
| P1-12 | Invoice numbers come from a non-atomic `count()+1` under concurrency 5, so collisions surface as a misleading "duplicate invoice" 409. The `P2002` path has no test. | `billing-engine.service.ts:435-447` |
| P1-13 | `CORS_ORIGINS` is documented but never read; origins are hardcoded to localhost, inviting a hand-edit of source at deploy time. | `src/main.ts:27-34` |

---

## P2 — lower risk

| # | Finding | Evidence |
|---|---------|----------|
| P2-1 | `@db.Date` fields serialize as UTC midnight and render through local-timezone formatters, so invoice due dates display a day early anywhere west of UTC. | `app/components/date-display.tsx:20`, `schema.prisma:238-241` |
| P2-2 | Logout clears local state only — no API call invalidates the session cookie, and `/login` is not a defined route. | `header.tsx:22`, `auth-store.ts:44` |
| P2-3 | "Send Invoice" and "Download PDF" render as working buttons with no handler. | `app/routes/invoices.$id.tsx:269-277` |
| P2-4 | No confirmation on removing a contract product or on queueing batch billing, inconsistent with other destructive flows. | `contracts.$id.tsx:194`, `billing.batch.tsx:54` |
| P2-5 | No CSRF token on mutating requests despite `credentials: "include"` (backend posture unconfirmed). | `app/lib/api/client.ts:62-69` |
| P2-6 | Payments and purchase-orders have no e2e coverage; their only tests mock Prisma entirely. | `test/*.e2e-spec.ts` |
| P2-7 | `production-deploy.yml` has its entire deploy job commented out — it only re-runs tests, despite the name. | `.github/workflows/production-deploy.yml:94-273` |
| P2-8 | Money math in JS floats rather than `Decimal` in invoices/payments/tax/FX services, inconsistent with the billing engine. | `invoices.service.ts:122-144`, `payments.service.ts:74-77` |
| P2-9 | `PARENT_PAYS` cascade sets child status to paid but leaves `paidAmount` at 0, so parent rollups disagree with child status. | `invoices.service.ts:445-461` |
| P2-10 | `ExchangeRatesService` is never called by billing — a USD product price bills as EUR with no conversion. | `billing-engine.service.ts` (no import) |
| P2-11 | Documented PM2 topology and Worker Threads don't exist; processors share the API event loop. | no `ecosystem.config.js`, no `worker_threads` |

---

## Untested critical behaviors

No meaningful test covers: invoice-number collision handling (`P2002` path), concurrent payment
application, overpayment beyond `total`, credit-hold enforcement on the automated path, or end-to-end
tax/rounding. `SeatCalculatorService` and `query-parser` tests are genuine; several money-path specs assert
against mocked Prisma rather than behavior.

## Verified clean

Prototype-pollution field names blocked in `query-parser`; natural-key uniqueness (`invoiceNumber`,
`poNumber`, `paymentNumber`, FX rate per pair/date, contract-product); money columns are `Decimal` in the
schema; single-invoice and consolidated idempotency genuinely enforced by DB partial unique indexes with
`P2002` → 409; invoice creation wrapped in `$transaction`; no card data anywhere (PCI constraint respected);
no secrets committed (`.env`/`.env.local` gitignored); retry config matches the 3-attempt exponential-backoff
rule; no `dangerouslySetInnerHTML`/`eval` in the frontend; no bearer token in `localStorage`; webhook secret
shown once on create; API errors surface via toast in the flows reviewed.

## Not verified

Runtime behavior was never exercised — no server was started, so header and query-parser-array claims rest on
source reading. Fastify's duplicate-query-key handling, Postgres `numeric` rounding on insert, production
Redis/TLS config, GitHub branch-protection settings, and live `max_connections` are all outside what a
read-only pass could confirm. `contracts`, `purchase-orders` and `renewals` were not read in depth and may
hold further financial paths.

## Suggested sequencing

1. **P0-12** first — a one-line guard; it protects the data you develop against while everything else lands.
2. **P0-1** with tenancy scoping designed in, plus P1-1, P1-7 (auth, Swagger gating, rate limiting, helmet ship together).
3. **P0-2, P0-4, P0-10** — input-trust fixes: restricted DTOs, a per-model filter whitelist, server-side total recomputation.
4. **P0-3** — SSRF blocking on every dispatch.
5. **P0-5** — atomic increment plus an overpayment cap and a concurrency test.
6. **P0-6, P0-7, P0-8, P0-9** — the billing engine is materially incomplete; treat as one workstream with tests before wiring tax, setup fees, tiers, credit hold and batch.
7. **P0-11** — audit trail, threading the principal once auth exists.
