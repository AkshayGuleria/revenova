---
id: revenue-backend
title: B2B Enterprise Revenue Management Backend System
status: frozen
priority: high
assignee: billman, habibi
created: 2026-01-11
updated: 2026-04-18
dependencies: [api-layer]
blocks: []
type: backend
focus: B2B Enterprise (contracts, hierarchical accounts, seat-based licensing)
scalability: hybrid (cluster + worker threads + queues)
---

> **⚠ HISTORICAL ARTIFACT — do not use as a reference.** This is the original plan written before
> Phase 1. It records what was *intended*, including scope that was never built and a stack
> (Express, `/api/customers`) that never shipped. Nothing here is maintained.
>
> **Where each topic actually lives:**
>
> | Topic | Owner |
> |-------|-------|
> | Phase status, gaps, backlog | [README → Development Phases](../README.md#development-phases) |
> | Runtime architecture (built + designed) | [`reference/architecture.md`](./reference/architecture.md) |
> | Database schema | `packages/revenue-backend/prisma/schema.prisma` |
> | API endpoints and examples | [`reference/openapi.json`](./reference/openapi.json) or `/api/docs` |
> | Environment variables | [`reference/env-vars.md`](./reference/env-vars.md) |
> | Per-feature behaviour | [`features/`](./features/) |
> | Testing strategy | `.claude/CLAUDE.md` |
>
> Progress markers were removed on 2026-09-14; duplicated reference content was removed on
> 2026-09-26 (see Progress Log). Git history holds the full original.

## Proposed Solution

Build a **B2B Enterprise Revenue Management Backend System** in phases, starting with core enterprise billing features and expanding incrementally. The system is designed for B2B SaaS companies selling to enterprise customers with complex contracts, hierarchical account structures, and custom payment terms.

### Phased Approach

**Phase 1: Foundation** (Weeks 1-2)

- Enterprise account CRUD with hierarchical support
- Contract management (single and multi-year deals)
- Product catalog with seat-based pricing
- Manual invoice creation
- Payment terms configuration (Net 30/60/90)

**Phase 2: Contract-Based Billing** (Weeks 3-4)

- Automated invoice generation from contracts
- Seat-based billing (per user/license)
- Quarterly/Annual billing in advance
- Volume discount rules
- Email notifications
- PDF invoice generation

**Phase 3: Hierarchical Accounts** (Weeks 5-6)

- Parent-child company relationships
- Consolidated billing for subsidiaries
- Roll-up reporting across account hierarchies
- Multi-location support
- Shared contracts across subsidiaries

**Phase 4: Enterprise Operations** (Weeks 7-9)

- Purchase order management and tracking
- Credit limit and credit hold management
- Approval workflows for large deals
- Payment processing and reconciliation
- Multi-currency support
- Tax calculation by jurisdiction

**Phase 5: Analytics & Optimization** (Weeks 10-12)

- Enterprise analytics dashboard (ARR, MRR, churn)
- Contract renewal tracking and forecasting
- SLA-based billing adjustments
- Custom billing rules engine
- Webhooks for enterprise events
- Payment gateway integration (Stripe/ACH)
- Audit logging for compliance

## Acceptance Criteria

### Phase 1: Foundation (MUST HAVE)

- PostgreSQL database setup with migrations
- Enterprise account CRUD API with hierarchical ID support
- Contract management API (create, read, update contracts)
- Contract terms: start/end dates, commitment value, seat count
- Product catalog API with seat-based pricing models
- Payment terms configuration (Net 30, Net 60, Net 90, Custom)
- Manual invoice creation API with contract linking
- Invoice item line items
- Basic invoice status workflow (draft → sent → paid → overdue)
- RESTful API documentation (Swagger/OpenAPI)
- Database schema designed for B2B extensibility
- API authentication (integrate with auth-server sessions)
- Revenue frontend migrated to real backend

### Phase 2: Contract-Based Billing & Scalability (SHOULD HAVE)

- Automated invoice generation from active contracts
- Seat-based billing calculation (per user/license)
- Quarterly/Annual billing in advance support
- Volume discount rule engine (tiered pricing)
- Billing schedule configuration (monthly, quarterly, annual, custom)
- Scheduled job runner for contract billing
- Email notification system (invoice delivery)
- PDF invoice generation with enterprise branding
- Invoice numbering with customizable format
- Due date calculation based on payment terms
- Contract-based reporting (revenue by contract, account)
- **Hybrid Scalability Architecture:**
  - PM2 cluster mode for API server (4 processes)
  - BullMQ job queue system (Redis-backed)
  - Dedicated worker processes for CPU-intensive tasks
  - Worker Threads for parallel computation (PDF, tax calc)
  - Queue monitoring and job retry logic
  - Graceful shutdown and error handling
  - Database connection pooling (max 5 per process)

### Phase 3: Hierarchical Accounts (SHOULD HAVE)

- Parent-child company relationship modeling
- Account hierarchy API (create subsidiaries, link to parent)
- Consolidated billing for account hierarchies
- Roll-up reporting across parent and subsidiaries
- Shared contract support (contract applies to multiple subsidiaries)
- Multi-location billing address support
- Separate billing contacts per subsidiary
- Hierarchical account navigation in frontend
- Consolidated invoice generation (all subsidiaries on one invoice)
- Per-subsidiary invoice option

### Phase 4: Enterprise Operations (NICE TO HAVE)

- **Sub-Invoices & Organizational Billing (47 tasks, ~12-18 days):**
  - `InvoiceGroup` entity (department, cost center, location, custom groupings)
  - Prisma self-referencing parent-child relationship on Invoice
  - Sub-invoice number generation (`INV-001-A`, `INV-001-B`)
  - Rollup calculation (parent totals = sum of children)
  - Cascade status updates (paying parent marks children paid)
  - Invoice split endpoint (`POST /api/invoices/:id/split`)
  - Invoice merge endpoint (`POST /api/invoices/:id/merge`)
  - Consolidation strategy parameter (FLAT, BY_ACCOUNT, BY_GROUP)
  - Invoice group CRUD API (`/api/invoice-groups`)
  - Sub-invoice filtering and nested response support
- Purchase order (PO) management system
- PO number tracking on invoices
- PO approval workflows (configurable approval chains)
- Credit limit configuration per account
- Credit hold enforcement (prevent new invoices if over limit)
- Payment processing and payment application
- Payment reconciliation (match payments to invoices)
- Multi-currency support for global enterprises
- Currency conversion rates (daily updates)
- Tax calculation by jurisdiction (US states, EU VAT, etc.)
- Discount management (contract-level discounts)
- Credit notes and refunds
- Dunning workflows for overdue enterprise accounts

### Phase 5: Analytics & Optimization (NICE TO HAVE)

- Enterprise analytics dashboard (ARR, MRR, bookings, churn)
- Contract renewal tracking and alerts
- Revenue forecasting based on pipeline and renewals
- Customer health scoring (payment history, engagement)
- SLA-based billing adjustments (credits for downtime)
- Custom billing rules engine (Javascript/Lua scripting)
- Webhook system for enterprise events (invoice.created, payment.received, contract.renewed)
- Payment gateway integration (Stripe API, ACH)
- Audit logging for SOC2/GDPR compliance
- Data export for finance systems (CSV, JSON)
- API rate limiting and throttling
- Advanced contract analytics (win rate, deal velocity)

## Subtasks

### Phase 1: Foundation (Weeks 1-2)

| ID | Task | Assignee | Notes |
|----|------|----------|-------|
| **Database Setup** | | | |
| 1 | Design database schema (ERD) | billman | Customers, products, invoices |
| 2 | Set up PostgreSQL with Docker | habibi | docker-compose service |
| 3 | Create migration system (node-pg-migrate) | billman | Version control for schema |
| 4 | Write initial migrations | billman | Create tables |
| 5 | Seed database with sample data | billman | Test data |
| **API Server** | | | |
| 6 | Create revenue-backend package structure | billman | Express.js setup |
| 7 | Set up Express server with CORS | billman | Port 5177 |
| 8 | Integrate auth-server session validation | billman | Middleware for auth |
| 9 | Set up PostgreSQL connection pool (pg) | billman | Database client |
| **Customer API** | | | |
| 10 | POST /api/customers - Create customer | billman | Validation, error handling |
| 11 | GET /api/customers - List customers | billman | Pagination, filtering |
| 12 | GET /api/customers/:id - Get customer | billman | With related data |
| 13 | PUT /api/customers/:id - Update customer | billman | Partial updates |
| 14 | DELETE /api/customers/:id - Delete customer | billman | Soft delete |
| **Product API** | | | |
| 15 | POST /api/products - Create product | billman | Name, price, type |
| 16 | GET /api/products - List products | billman | Filter by type |
| 17 | GET /api/products/:id - Get product | billman | With pricing details |
| 18 | PUT /api/products/:id - Update product | billman | Price history |
| **Invoice API** | | | |
| 19 | POST /api/invoices - Create invoice | billman | Manual creation |
| 20 | GET /api/invoices - List invoices | billman | Filter by status, customer |
| 21 | GET /api/invoices/:id - Get invoice | billman | With line items |
| 22 | PUT /api/invoices/:id - Update invoice | billman | Status transitions |
| 23 | POST /api/invoices/:id/items - Add line item | billman | Product, quantity, price |
| 24 | DELETE /api/invoices/:id/items/:itemId | billman | Remove line item |
| **Frontend Integration** | | | |
| 25 | Update Revenue app API client | billman | Point to localhost:5177 |
| 26 | Update useInvoices hook | billman | Real API calls |
| 27 | Update useCustomers hook (Revenue context) | billman | Different from CRM |
| 28 | Test full CRUD flow in UI | billman | End-to-end |
| **Documentation** | | | |
| 29 | Write API documentation (Swagger) | billman | OpenAPI spec |
| 30 | Write README for revenue-backend | billman | Setup, usage |

### Phase 2: Automation (Weeks 3-4)

| ID | Task | Assignee | Notes |
|----|------|----------|-------|
| **Billing Engine** | | | |
| 31 | Design billing cycle configuration | billman | Monthly, quarterly, annual |
| 32 | Create billing_cycles table | billman | Migration |
| 33 | POST /api/billing-cycles - Create cycle | billman | Schedule, rules |
| 34 | Build invoice generation engine | billman | From billing cycle + customer |
| 35 | POST /api/billing/generate - Trigger generation | billman | On-demand |
| **Scheduled Jobs** | | | |
| 36 | Set up job scheduler (Bull/Redis) | habibi | Job queue |
| 37 | Create recurring job for invoice generation | billman | Daily cron |
| 38 | Add job monitoring dashboard | billman | View job status |
| **Email System** | | | |
| 39 | Set up email service (Nodemailer) | billman | SMTP config |
| 40 | Create invoice email templates | billman | HTML + plain text |
| 41 | POST /api/invoices/:id/send - Send invoice | billman | Email to customer |
| 42 | Add email notification on invoice created | billman | Event-driven |
| **PDF Generation** | | | |
| 43 | Install PDF library (pdfkit or puppeteer) | billman | Choose best fit |
| 44 | Create invoice PDF template | billman | Company logo, styling |
| 45 | GET /api/invoices/:id/pdf - Download PDF | billman | Generate on demand |
| 46 | Store PDFs in filesystem/S3 | billman | Caching |
| **Invoice Enhancements** | | | |
| 47 | Implement invoice numbering system | billman | INV-2026-001 format |
| 48 | Add payment terms configuration | billman | Net 30, Net 60 |
| 49 | Calculate due dates automatically | billman | From issue date + terms |
| 50 | Invoice status auto-transition (overdue) | billman | Scheduled check |
| **Reporting** | | | |
| 51 | GET /api/reports/revenue - Revenue by period | billman | Aggregate queries |
| 52 | GET /api/reports/customers - Customer analytics | billman | Top customers |
| 53 | Create reports database views | billman | Optimize queries |
| **Scalability Architecture (Hybrid Approach)** | | | |
| 54 | Install PM2 process manager | habibi | npm install -g pm2 |
| 55 | Create PM2 ecosystem.config.js | habibi | Define API + workers |
| 56 | Configure API server cluster mode (4 processes) | habibi | PM2 cluster config |
| 57 | Install BullMQ and ioredis | billman | npm install bullmq ioredis |
| 58 | Create queue configuration module | billman | Redis connection |
| 59 | Create PDF job queue (pdf-queue) | billman | BullMQ queue setup |
| 60 | Create tax calculation queue (tax-queue) | billman | For heavy tax calc |
| 61 | Create email queue (email-queue) | billman | Async email sending |
| 62 | Update API routes to use queues | billman | POST /pdf → queue job |
| 63 | Create PDF worker process | billman | Separate worker.js |
| 64 | Implement Worker Threads in PDF worker | billman | Thread pool for PDFs |
| 65 | Create tax calculation worker | billman | With Worker Threads |
| 66 | Create email worker process | billman | Process email queue |
| 67 | Implement database connection pooling | billman | Max 5 per process |
| 68 | Add graceful shutdown handlers | billman | SIGTERM handling |
| 69 | Implement job retry logic | billman | 3 attempts, exp backoff |
| 70 | Add queue monitoring endpoints | billman | GET /api/queues/status |
| 71 | Configure PM2 memory limits | habibi | max_memory_restart |
| 72 | Test cluster mode load balancing | habibi | Load test with Artillery |
| 73 | Benchmark PDF generation throughput | billman | Measure PDFs/sec |
| 74 | Document scalability architecture | billman | README for workers |

### Phase 3: Subscriptions (Weeks 5-6)

| ID | Task | Assignee | Notes |
|----|------|----------|-------|
| **Subscription Plans** | | | |
| 75 | Create subscription_plans table | billman | Migration |
| 76 | POST /api/plans - Create plan | billman | Name, price, interval |
| 77 | GET /api/plans - List plans | billman | Public catalog |
| 78 | Support tiered pricing | billman | Different tiers/features |
| **Customer Subscriptions** | | | |
| 79 | Create subscriptions table | billman | Customer, plan, status |
| 80 | POST /api/subscriptions - Subscribe customer | billman | Enroll in plan |
| 81 | GET /api/subscriptions - List subscriptions | billman | Filter by customer |
| 82 | PUT /api/subscriptions/:id - Update subscription | billman | Upgrade/downgrade |
| 83 | DELETE /api/subscriptions/:id - Cancel | billman | Immediate or end of period |
| **Renewal Logic** | | | |
| 84 | Build auto-renewal job | billman | Check expiring subscriptions |
| 85 | Generate renewal invoices | billman | Before renewal date |
| 86 | Handle renewal failures | billman | Grace period |
| **Proration** | | | |
| 87 | Calculate proration for upgrades | billman | Credit unused time |
| 88 | Calculate proration for downgrades | billman | Apply at next renewal |
| 89 | Handle mid-cycle cancellations | billman | Refund or credit |
| **Trial Periods** | | | |
| 90 | Add trial period support to plans | billman | Days count |
| 91 | Create subscription with trial | billman | No initial charge |
| 92 | Convert trial to paid automatically | billman | After trial ends |
| **Analytics** | | | |
| 93 | GET /api/reports/subscriptions/mrr | billman | Monthly Recurring Revenue |
| 94 | GET /api/reports/subscriptions/churn | billman | Cancellation rate |
| 95 | Subscription lifecycle metrics | billman | Active, churned, etc. |

### Phase 4: Advanced Billing (Weeks 7-9)

| ID | Task | Assignee | Notes |
|----|------|----------|-------|
| **Usage-Based Billing** | | | |
| 96 | Create usage_records table | billman | Metered usage data |
| 97 | POST /api/usage - Ingest usage record | billman | API calls, GB, etc. |
| 98 | GET /api/usage - Query usage | billman | By customer, period |
| 99 | Build rating engine | billman | Convert usage to charges |
| 100 | Support tiered/volume pricing | billman | $0.10/GB 0-100, $0.05/GB 100+ |
| 101 | Generate usage-based invoices | billman | Aggregate usage |
| **Dunning** | | | |
| 102 | Create dunning_workflows table | billman | Retry rules |
| 103 | POST /api/payments/:id/retry - Retry payment | billman | Manual retry |
| 104 | Automated retry job | billman | 3 retries over 7 days |
| 105 | Email notifications for failed payments | billman | Escalating urgency |
| 106 | Suspend subscription after failures | billman | Grace period expired |
| **Multi-Currency** | | | |
| 107 | Add currency field to invoices | billman | USD, EUR, GBP |
| 108 | Create exchange_rates table | billman | Daily rates |
| 109 | GET /api/exchange-rates - Fetch rates | billman | External API integration |
| 110 | Convert invoice amounts | billman | Display in customer currency |
| **Tax Calculation** | | | |
| 111 | Create tax_rules table | billman | By region, product type |
| 112 | Calculate tax on invoice items | billman | Based on customer location |
| 113 | Support VAT/GST/Sales tax | billman | Different tax types |
| **Discounts & Credits** | | | |
| 114 | Create discount_codes table | billman | Promo codes |
| 115 | POST /api/discounts - Create discount | billman | %, fixed amount |
| 116 | Apply discount to invoice | billman | Validation |
| 117 | Create credit_notes table | billman | Refunds, credits |
| 118 | POST /api/credit-notes - Issue credit | billman | Adjust invoice |

### Phase 5: Enterprise Features (Weeks 10-12)

| ID | Task | Assignee | Notes |
|----|------|----------|-------|
| **Advanced Analytics** | | | |
| 119 | Build analytics dashboard API | billman | KPIs, charts |
| 120 | GET /api/analytics/arr - Annual Recurring Revenue | billman | Forecasting |
| 121 | GET /api/analytics/ltv - Customer Lifetime Value | billman | Cohort analysis |
| 122 | Revenue forecasting | billman | Predictive analytics |
| **Custom Billing Rules** | | | |
| 123 | Design rules engine architecture | billman | Plugin system |
| 124 | Support custom Javascript rules | billman | Sandboxed execution |
| 125 | Rule testing framework | billman | Validate rules |
| **Webhooks** | | | |
| 126 | Create webhooks table | billman | Subscriber URLs |
| 127 | POST /api/webhooks - Register webhook | billman | Event types |
| 128 | Webhook delivery system | billman | Retry logic |
| 129 | Webhook signature verification | billman | HMAC security |
| 130 | Events: invoice.created, payment.succeeded | billman | Event catalog |
| **Payment Gateway** | | | |
| 131 | Integrate Stripe SDK | billman | Payment processing |
| 132 | POST /api/payments - Process payment | billman | Credit card |
| 133 | Stripe webhook handler | billman | Async updates |
| 134 | Support multiple payment methods | billman | Card, ACH, etc. |
| **Multi-Tenant** | | | |
| 135 | Add tenant_id to all tables | billman | Row-level security |
| 136 | Tenant isolation middleware | billman | Security |
| 137 | Tenant provisioning API | billman | Create new tenant |
| **Compliance & Export** | | | |
| 138 | Audit logging system | billman | All mutations logged |
| 139 | GET /api/export/invoices - Export CSV | billman | Data portability |
| 140 | GET /api/export/customers - Export JSON | billman | Backup |
| 141 | API rate limiting | billman | Prevent abuse |

### Phase 4.5: Sub-Invoices & Organizational Billing (~12-18 days)

Full detail: [`docs/features/sub-invoices.md`](./features/sub-invoices.md)

| ID | Task | Complexity | Notes |
|----|------|----------|-------|
| **Phase A: Database Schema** | | | |
| A1 | Create `InvoiceGroup` entity | Medium | DEPARTMENT, COST_CENTER, LOCATION, CUSTOM |
| A2 | Add Prisma self-referencing relationship for `parentInvoiceId` | Low | Defines Invoice hierarchy |
| A3 | Add `invoiceGroupId` FK to Invoice model | Low | Links invoice to org group |
| A4 | Add `groupType` enum | Low | See InvoiceGroup entity |
| A5 | Add `groupReference` field to InvoiceItem | Low | Line-item org attribution |
| A6 | Create database migration | Medium | All schema changes |
| A7 | Add index on `parentInvoiceId` | Low | Efficient hierarchy queries |
| **Phase B: Invoice Group Management** | | | |
| B1 | `InvoiceGroup` service (CRUD) | Medium | |
| B2 | DTOs for invoice group create/update/query | Medium | |
| B3 | Invoice group controller + REST endpoints | Medium | `/api/invoice-groups` |
| B4 | Validate group uniqueness per account | Low | |
| B5 | Cascade behavior on group soft delete | Low | |
| **Phase C: Sub-Invoice Core Logic** | | | |
| C1 | Update Invoice service for parent-child support | Medium | |
| C2 | `createSubInvoice()` method | Medium | Links to parent |
| C3 | `getSubInvoices()` method | Low | Children of a parent |
| C4 | `getParentInvoice()` method | Low | Parent of a child |
| C5 | Sub-invoice number generation (`INV-001-A/B/C`) | Medium | |
| C6 | Rollup calculation (parent totals = sum of children) | Medium | |
| C7 | Validation: sub-invoice totals must match parent | Medium | |
| C8 | Cascade status updates (parent → children) | Medium | Paying parent marks children paid |
| **Phase D: Invoice Item Grouping** | | | |
| D1 | Add `groupReference` to InvoiceItem | Low | |
| D2 | Grouping logic in invoice creation | Medium | |
| D3 | Move items between groups/sub-invoices endpoint | Medium | |
| D4 | Validation for item reassignment | Medium | Amount consistency |
| **Phase E: API Endpoints** | | | |
| E1 | `GET /api/invoices/:id/sub-invoices` | Low | |
| E2 | `POST /api/invoices/:id/sub-invoices` | Medium | |
| E3 | `GET /api/invoices/:id/parent` | Low | |
| E4 | `POST /api/invoices/:id/split` | High | Split by group |
| E5 | `POST /api/invoices/:id/merge` | High | Merge sub-invoices |
| E6 | `parentInvoiceId[eq]` filter on list endpoint | Low | |
| E7 | `includeSubInvoices` query param | Medium | Nested response |
| E8 | Invoice detail includes sub-invoice summary | Low | |
| **Phase F: Consolidated Billing Integration** | | | |
| F1 | Update consolidated billing for parent + sub-invoices | High | |
| F2 | Strategy: sub-invoice per subsidiary account | Medium | |
| F3 | Strategy: sub-invoice per cost center/department | Medium | |
| F4 | `consolidationStrategy` param (FLAT, BY_ACCOUNT, BY_GROUP) | Medium | |
| F5 | Update billing processor for sub-invoice generation | Medium | |
| **Phase G: Testing** | | | |
| G1 | Unit tests for invoice group service | Medium | |
| G2 | Unit tests for sub-invoice creation/retrieval | Medium | |
| G3 | Unit tests for rollup calculations | Medium | |
| G4 | Integration tests for split/merge operations | High | |
| G5 | Integration tests for consolidated billing with sub-invoices | High | |
| G6 | E2E tests for complete sub-invoice workflows | High | |
| **Phase H: Documentation** | | | |
| H1 | Update `sub-invoices.md` post-implementation | Medium | |
| H2 | Update `invoices.md` with sub-invoice info | Low | |
| H3 | Update `billing.md` with consolidation strategies | Low | |
| H4 | Add API examples and cURL commands | Low | |

## Product Direction (historical)

### B2B Enterprise Focus

This specification is **B2B Enterprise-first**, designed for SaaS companies selling to large organizations with:

| B2B Enterprise Feature | Our Implementation | Phase |
|------------------------|-------------------|-------|
| **Core B2B Features** | | |
| Hierarchical Accounts | Parent-child company relationships | Phase 3 |
| Contract Management | Multi-year commitment-based contracts | Phase 1 |
| Seat-Based Licensing | Per-user/license pricing | Phase 1-2 |
| Purchase Orders | PO tracking and approval workflows | Phase 4 |
| Credit Management | Credit limits and credit holds | Phase 4 |
| Payment Terms | Net 30/60/90 custom terms | Phase 1 |
| Consolidated Billing | Roll-up invoices for subsidiaries | Phase 3 |
| Volume Discounts | Tiered pricing by seat count | Phase 2 |
| **Billing & Invoicing** | | |
| Manual Invoicing | Invoice CRUD with contract linking | Phase 1 |
| Automated Contract Billing | Schedule-based invoice generation | Phase 2 |
| Quarterly/Annual Billing | Billing in advance support | Phase 2 |
| Email Notifications | Invoice delivery automation | Phase 2 |
| PDF Generation | Enterprise-branded invoices | Phase 2 |
| Multi-Currency | Global enterprise support | Phase 4 |
| Tax Calculation | Jurisdiction-based tax rules | Phase 4 |
| **Enterprise Operations** | | |
| Payment Processing | Stripe/ACH integration | Phase 5 |
| Payment Reconciliation | Match payments to invoices | Phase 4 |
| Dunning Management | Overdue account workflows | Phase 4 |
| Credit Notes & Refunds | Financial adjustments | Phase 4 |
| **Analytics & Reporting** | | |
| Contract Analytics | ARR, MRR, bookings, churn | Phase 5 |
| Renewal Tracking | Contract expiration alerts | Phase 5 |
| Revenue Forecasting | Pipeline-based forecasting | Phase 5 |
| SLA Adjustments | Downtime credit calculations | Phase 5 |
| **Integration & Security** | | |
| RESTful API | API-first design | All phases |
| Webhooks | Enterprise event notifications | Phase 5 |
| Audit Logging | SOC2/GDPR compliance | Phase 5 |
| Custom Fields | JSONB metadata flexibility | Phase 1 |

**B2B Enterprise Advantages:**

- ✅ **Contract-first approach** - Built around multi-year enterprise deals
- ✅ **Hierarchical accounts** - Parent companies with multiple subsidiaries
- ✅ **Seat-based licensing** - Standard B2B SaaS pricing model
- ✅ **Purchase order support** - Enterprise procurement workflows
- ✅ **Credit management** - Enterprise credit limits and holds
- ✅ **Consolidated billing** - Roll-up invoices across subsidiaries
- ✅ **Volume discounts** - Automatic tiered pricing
- ✅ **Modern tech stack** (PostgreSQL, Express, React)
- ✅ **Hybrid scalability** - Cluster + Worker Threads + Queues
- ✅ **API-first design** - Easy integration with CRM/ERP systems

### B2C Event-Based Billing (Future Phase 6+)

After establishing the B2B Enterprise foundation, the system can be **extended to support B2C** use cases where events are billed as they occur:

**Future B2C Extensions:**

- Usage-based (metered) billing for API calls, storage, bandwidth
- Event ingestion API for real-time usage tracking
- Rating engine to convert usage to charges
- Pay-as-you-go pricing models
- Self-service customer portal
- Automated subscription upgrades/downgrades
- Proration calculations
- Trial periods and free tiers

**Implementation Strategy:**

1. **Phase 1-5:** Build robust B2B Enterprise billing foundation
2. **Phase 6+ (Future):** Add B2C event tables (`usage_records`, `usage_events`)
3. Add rating engine for usage-to-charge conversion
4. Add self-service portal and subscription management
5. Keep B2B and B2C models separate but share common infrastructure

**Why B2B First?**

- ✅ Higher average revenue per customer (ARPC)
- ✅ More predictable revenue (annual contracts)
- ✅ Simpler to implement (no real-time event processing)
- ✅ Better foundation for future B2C extension
- ✅ Matches typical SaaS company growth trajectory (B2B → B2B+B2C)

## Progress Log

### 2026-09-26 (Reference content moved out)

- Removed every section that duplicated a live source: Technology Stack, Architecture Overview,
  Technical Notes (DB schema, API structure, env vars, API examples, scalability implementation,
  integration notes), Security Considerations, Performance Considerations, Testing Strategy,
  Quick Reference — 1906 lines down to ~614
- The architecture diagram moved to `docs/reference/architecture.md` under "Designed, Not Built",
  with its Express boxes corrected to the shipped NestJS + Fastify stack
- What remains is the origin story: phased approach, original acceptance criteria and subtasks,
  the B2B-over-B2C rationale, and this log

### 2026-09-14 (Status tracking removed)

- File frozen as historical plan; all progress markers removed (frontmatter phase statuses, acceptance checkboxes, subtask Status columns)
- Single source of truth for phase status and descoped backlog: README.md → Development Phases

### 2026-01-12 (Major Refactor - B2B Enterprise Focus + Architecture Audit)

- **Completely rewrote specification to focus on B2B Enterprise billing**
- Shifted from telecom/metered billing to contract-based B2B models
- **Core Changes:**
  - Replaced "customers" with "accounts" (hierarchical support)
  - Added contracts table (commitment-based, multi-year deals)
  - Added seat-based licensing and volume discounts
  - Added purchase order management (Phase 4)
  - Added credit limit management
  - Added consolidated billing for parent-child accounts
- **Database Schema Updates:**
  - accounts table with parent_account_id for hierarchies
  - contracts table with seat-based pricing
  - invoices table with contract and PO linking
  - purchase_orders table for enterprise workflows
  - products table with seat-based and volume-tiered pricing
- **Phase Restructure:**
  - Phase 1: Enterprise accounts, contracts, seat-based pricing
  - Phase 2: Contract-based billing automation, volume discounts
  - Phase 3: Hierarchical accounts, consolidated billing
  - Phase 4: Purchase orders, credit management, payment reconciliation
  - Phase 5: Analytics, renewal tracking, SLA adjustments
- **Added B2C Extension Plan (Phase 6+):**
  - Usage/event-based billing deferred to future phases
  - B2B foundation provides better starting point
  - Clear migration path from B2B to B2B+B2C
- **API Examples Updated:**
  - Create enterprise contract example
  - Generate invoice from contract example
  - Removed subscription-focused examples
- **Architecture Audit & Updates:**
  - Updated architecture diagram for B2B workloads
  - Changed queue names (added contract-billing, consolidated-billing, renewal-alerts, webhook-delivery)
  - Added B2B-specific workers (Contract Billing Workers, Consolidated Billing Workers, Renewal Alert Workers, Webhook Workers)
  - Adjusted worker counts for B2B patterns (fewer users, more complex operations)
  - Updated database table list to reflect B2B schema
  - Added B2B-specific architectural patterns (credit limit checks, approval workflows, audit trail, hierarchical queries)
  - Updated performance metrics for B2B enterprise workload (vs B2C consumer workload)
  - Added detailed B2B vs B2C performance characteristics comparison
  - Updated connection pooling calculations (90 total connections across all workers)
  - Rewrote performance considerations section with B2B-specific optimizations:
    - Hierarchical query optimization (recursive CTEs, materialized paths)
    - Month-end performance planning (peak load on 1st of month)
    - Batch operation optimization (contract billing in batches of 500)
    - Caching strategy for B2B (account hierarchy, volume discounts, credit limits)
    - Database indices for B2B queries (parent_account_id, contract_id, po_number, end_date)
    - Materialized views for ARR/MRR calculations
- Reset all acceptance criteria checkboxes to planned state

### 2026-01-11 (Hybrid Scalability)

- **Hybrid scalability architecture added** based on tommi's recommendation
- Updated Phase 2 to include scalability implementation (21 new tasks)
- Architecture: PM2 Cluster + Worker Threads + BullMQ Queues
- Total subtasks increased from 120 to 141
- Added comprehensive scalability implementation examples
- Performance targets defined: 400+ req/sec, 80+ PDFs/sec
- Tech stack updated: BullMQ, Worker Threads, connection pooling

### 2026-01-11 (Initial)

- Initial spec created by tapsa
- Assigned to billman (revenue domain) and habibi (database/infrastructure)
- 5-phase approach designed based on jBilling reference
- 120 subtasks defined across all phases
- Priority: high (critical backend infrastructure)
- Dependencies: api-layer (for frontend integration patterns)

## Related

- Depends on: api-layer (for frontend integration patterns)
- Blocks: (none currently)
- Related discussion: jBilling research for feature reference
- Related apps: Revenue app (frontend consumer)
- Related agents: billman (primary), habibi (database setup)

---

## Sources

Research based on B2B Enterprise SaaS billing best practices:

- Stripe Billing for B2B Enterprise patterns
- Zuora billing models (contract-based, seat licensing)
- Salesforce CPQ (Configure-Price-Quote) workflows
- NetSuite SuiteBilling architecture
- ChargeBee enterprise billing features
- Industry standard B2B SaaS metrics (ARR, MRR, bookings)

Previous research (telecom-focused):

- [jBilling Reviews & Features](https://www.softwaresuggest.com/jbilling)
- [Best Open-Source Billing Tools 2025](https://flexprice.io/blog/best-open-source-tools-subscription-billing)