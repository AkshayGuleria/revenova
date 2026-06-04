---
id: revenue-backend
title: B2B Enterprise Revenue Management Backend System
status: completed
priority: high
assignee: billman, habibi
created: 2026-01-11
updated: 2026-04-18
dependencies: [api-layer]
blocks: []
type: backend
focus: B2B Enterprise (contracts, hierarchical accounts, seat-based licensing)
phase: "5 of 5 (complete - Phase 6 B2C usage-based billing planned)"
phase1_status: completed (enterprise accounts, contracts, products, invoices)
phase2_status: completed (contract billing + hybrid scalability)
phase3_status: completed (hierarchical accounts, consolidated billing)
phase3_5_status: completed (product pricing enhancement — chargeType, category, setupFee)
phase4_status: completed
phase5_status: completed (ARR/MRR analytics, renewal tracking, audit logging, webhooks)
scalability: hybrid (cluster + worker threads + queues)
---

> **⚠ DEPRECATION NOTICE:** This file is a historical planning artifact from before Phase 1.
> It contains stale task tables, Express.js references, and `/api/customers` routes that no longer exist.
> **Source of truth for implemented features:** `docs/features/`
> **Source of truth for API endpoints:** `docs/reference/openapi.json` or `http://localhost:5177/api/docs`

## Proposed Solution

Build a **B2B Enterprise Revenue Management Backend System** in phases, starting with core enterprise billing features and expanding incrementally. The system is designed for B2B SaaS companies selling to enterprise customers with complex contracts, hierarchical account structures, and custom payment terms.

### Technology Stack

**Backend Framework:** Express.js (Node.js)

- Consistent with auth-server architecture
- Team already familiar with Express
- Excellent ecosystem for billing logic

**Database:** PostgreSQL

- Relational data (customers, products, invoices)
- ACID compliance (critical for financial data)
- JSON support for flexible schemas
- Mature and battle-tested

**Scalability & Performance:**

- **PM2** - Process manager for clustering and monitoring
- **Node.js Cluster** - Multi-process for I/O-bound API scaling
- **Worker Threads** - Multi-threading for CPU-bound tasks (PDF, tax calc)
- **BullMQ** - Queue system for async jobs (Redis-backed)
- **Redis** - Job queues, caching, session storage

**Additional Services:**

- Stripe/PayPal SDK for payment processing
- pdfkit or puppeteer for PDF generation
- Nodemailer for email notifications

### Architecture Overview

**B2B Enterprise Hybrid Scalability Architecture** (Cluster + Worker Threads + Queues):

```
┌─────────────────────────────────────────────────────────────┐
│                     Revenue Frontend                        │
│       (React - Revenue App for Finance Teams)               │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP REST API
                     │ + Webhooks (enterprise integrations)
┌────────────────────▼────────────────────────────────────────┐
│                   PM2 Process Manager                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │   API Server (Cluster Mode - 4 processes)           │    │
│  │                                                     │    │
│  │   Worker 1   Worker 2   Worker 3   Worker 4         │    │
│  │    Express    Express    Express    Express         │    │
│  │   Port 5177                                         │    │
│  │                                                     │    │
│  │   Routes (I/O-bound - fast, with audit logging):    │    │
│  │   • GET  /api/accounts      - List accounts         │    │
│  │   • GET  /api/contracts     - List contracts        │    │
│  │   • GET  /api/invoices      - List invoices         │    │
│  │   • POST /api/accounts      - Create account        │    │
│  │   • POST /api/contracts     - Create contract       │    │
│  │                                                     │    │
│  │   Routes (CPU-bound/complex - queued):              │    │
│  │   • POST /api/billing/generate       → Contract Billing Queue │
│  │   • POST /api/billing/consolidated   → Consolidated Billing │
│  │   • POST /api/invoices/:id/pdf       → PDF Queue    │    │
│  │   • POST /api/invoices/tax           → Tax Queue    │    │
│  │   • POST /api/purchase-orders/approve → Approval Workflow │
│  │                                                      │    │
│  │   Enterprise Features:                              │    │
│  │   • Credit limit checks (before invoice creation)   │    │
│  │   • Hierarchical queries (recursive CTEs)           │    │
│  │   • Audit trail (all mutations logged)              │    │
│  │   • Transaction support (ACID guarantees)           │    │
│  └──────────────────┬──────────────────────────────────┘    │
│                     │ Offload heavy/scheduled work          │
│                     ▼                                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │       BullMQ Job Queues (Redis)                     │    │
│  │                                                     │    │
│  │  contract-billing-queue  consolidated-billing-queue │    │
│  │  pdf-queue   tax-queue   email-queue                │    │
│  │  renewal-alerts-queue   webhook-delivery-queue      │    │
│  │  approval-workflow-queue   dunning-queue            │    │
│  └──────────────────┬──────────────────────────────────┘    │
│                     │ Process async                         │
│                     ▼                                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │   Dedicated Worker Processes (B2B Optimized)        │    │
│  │                                                     │    │
│  │   • Contract Billing Workers (2 processes)          │    │
│  │     - Scheduled contract invoice generation         │    │
│  │     - Seat-based calculation                        │    │
│  │     - Volume discount application                   │    │
│  │                                                     │    │
│  │   • Consolidated Billing Workers (2 processes)      │    │
│  │     - Roll-up invoices across subsidiaries          │    │
│  │     - Hierarchical aggregation                      │    │
│  │                                                     │    │
│  │   • PDF Workers (3 processes × 2 threads each)      │    │
│  │     - Generate enterprise-branded invoices          │    │
│  │     - Complex invoice templates                     │    │
│  │                                                     │    │
│  │   • Tax Workers (2 processes × 2 threads each)      │    │
│  │     - Multi-jurisdiction tax calculations           │    │
│  │     - Tax rate lookup and caching                   │    │
│  │                                                     │    │
│  │   • Email Workers (2 processes)                     │    │
│  │     - Invoice delivery to billing contacts          │    │
│  │     - Contract renewal notifications                │    │
│  │                                                     │    │
│  │   • Renewal Alert Workers (1 process)               │    │
│  │     - Track contract expirations                    │    │
│  │     - Send 90/60/30 day alerts                      │    │
│  │                                                     │    │
│  │   • Webhook Workers (2 processes)                   │    │
│  │     - Deliver enterprise event notifications        │    │
│  │     - Retry logic with exponential backoff          │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Data Layer (Persistent Storage)                │
│                                                             │
│  ┌──────────────────────┐    ┌─────────────────────────┐    │
│  │  PostgreSQL Database │    │  Redis (Job Queues)     │    │
│  │                      │    │                         │    │
│  │  B2B Enterprise Tables:   │  Queues:                │    │
│  │  • accounts          │    │  • contract-billing-queue │  │
│  │  • contracts         │    │  • consolidated-billing-queue │ │
│  │  • products          │    │  • pdf-queue            │    │
│  │  • invoices          │    │  • tax-queue            │    │
│  │  • invoice_items     │    │  • email-queue          │    │
│  │  • purchase_orders   │    │  • renewal-alerts-queue │    │
│  │  • payments          │    │  • webhook-delivery-queue │  │
│  │  • audit_log         │    │  • approval-workflow-queue │ │
│  │                      │    │  • dunning-queue        │    │
│  │  Indices for B2B:    │    │                         │    │
│  │  • parent_account_id │    │  Cache:                 │    │
│  │  • contract_id       │    │  • Product catalog      │    │
│  │  • po_number         │    │  • Exchange rates       │    │
│  │  • end_date          │    │  • Volume discount tiers │   │
│  └──────────────────────┘    └─────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Key Architectural Decisions (B2B Enterprise Focus):**

1. **Cluster Mode (PM2)** - Scales I/O-bound API requests across CPU cores
   - B2B workload: Fewer concurrent users but more complex operations
   - Finance teams accessing dashboards, reports, contract management

2. **Worker Threads** - Parallelizes CPU-intensive B2B tasks
   - PDF generation (complex enterprise invoices with line items)
   - Tax calculations (multi-jurisdiction, multiple tax authorities)
   - Consolidated billing (hierarchical aggregation across subsidiaries)
   - Volume discount calculations (tiered pricing rules)

3. **Queue System (BullMQ)** - Decouples heavy/scheduled work from API
   - **Contract billing jobs** - Scheduled based on contract terms (monthly/quarterly/annual)
   - **Consolidated billing** - Roll-up invoices across parent-child accounts
   - **Renewal alerts** - Proactive notifications 90/60/30 days before expiration
   - **Webhook delivery** - Enterprise event notifications with retry logic
   - **Approval workflows** - Purchase order approvals, large deal reviews
   - Better for scheduled batch operations than real-time event processing

4. **Dedicated Workers** - Separate processes for different B2B job types
   - Contract billing workers (scheduled invoice generation)
   - Consolidated billing workers (hierarchical aggregation)
   - PDF workers (enterprise-branded invoices)
   - Tax workers (jurisdiction-based calculations)
   - Email workers (billing contacts, renewal alerts)
   - Webhook workers (enterprise integrations)

5. **PostgreSQL with B2B Optimizations**
   - **ACID compliance** - Critical for financial data integrity
   - **Recursive CTEs** - For hierarchical account queries
   - **Database indices** - On parent_account_id, contract_id, po_number, end_date
   - **Database views** - Pre-aggregated roll-up reporting
   - **Audit logging** - All mutations logged for SOC2/GDPR compliance
   - **Transaction support** - Multi-table operations (invoice + items + payment application)

6. **Redis** - Fast job queue and caching layer
   - Queue management for async B2B operations
   - Cache product catalog and volume discount tiers
   - Cache exchange rates (updated daily)
   - Session storage for API authentication

7. **B2B-Specific Architectural Patterns**
   - **Credit limit enforcement** - Check before invoice generation (prevent over-billing)
   - **Approval workflows** - Multi-stage approvals for purchase orders and large deals
   - **Audit trail** - Comprehensive logging of all financial operations
   - **Webhook delivery** - Enterprise event notifications with HMAC signatures
   - **Data export** - Integration with finance systems (QuickBooks, NetSuite, Xero)
   - **Hierarchical queries** - Efficient parent-child account traversal

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

- [ ] PostgreSQL database setup with migrations
- [ ] Enterprise account CRUD API with hierarchical ID support
- [ ] Contract management API (create, read, update contracts)
- [ ] Contract terms: start/end dates, commitment value, seat count
- [ ] Product catalog API with seat-based pricing models
- [ ] Payment terms configuration (Net 30, Net 60, Net 90, Custom)
- [ ] Manual invoice creation API with contract linking
- [ ] Invoice item line items
- [ ] Basic invoice status workflow (draft → sent → paid → overdue)
- [ ] RESTful API documentation (Swagger/OpenAPI)
- [ ] Database schema designed for B2B extensibility
- [ ] API authentication (integrate with auth-server sessions)
- [ ] Revenue frontend migrated to real backend

### Phase 2: Contract-Based Billing & Scalability (SHOULD HAVE)

- [ ] Automated invoice generation from active contracts
- [ ] Seat-based billing calculation (per user/license)
- [ ] Quarterly/Annual billing in advance support
- [ ] Volume discount rule engine (tiered pricing)
- [ ] Billing schedule configuration (monthly, quarterly, annual, custom)
- [ ] Scheduled job runner for contract billing
- [ ] Email notification system (invoice delivery)
- [ ] PDF invoice generation with enterprise branding
- [ ] Invoice numbering with customizable format
- [ ] Due date calculation based on payment terms
- [ ] Contract-based reporting (revenue by contract, account)
- [ ] **Hybrid Scalability Architecture:**
  - [ ] PM2 cluster mode for API server (4 processes)
  - [ ] BullMQ job queue system (Redis-backed)
  - [ ] Dedicated worker processes for CPU-intensive tasks
  - [ ] Worker Threads for parallel computation (PDF, tax calc)
  - [ ] Queue monitoring and job retry logic
  - [ ] Graceful shutdown and error handling
  - [ ] Database connection pooling (max 5 per process)

### Phase 3: Hierarchical Accounts (SHOULD HAVE)

- [ ] Parent-child company relationship modeling
- [ ] Account hierarchy API (create subsidiaries, link to parent)
- [ ] Consolidated billing for account hierarchies
- [ ] Roll-up reporting across parent and subsidiaries
- [ ] Shared contract support (contract applies to multiple subsidiaries)
- [ ] Multi-location billing address support
- [ ] Separate billing contacts per subsidiary
- [ ] Hierarchical account navigation in frontend
- [ ] Consolidated invoice generation (all subsidiaries on one invoice)
- [ ] Per-subsidiary invoice option

### Phase 4: Enterprise Operations (NICE TO HAVE)

- [ ] **Sub-Invoices & Organizational Billing (47 tasks, ~12-18 days):**
  - [ ] `InvoiceGroup` entity (department, cost center, location, custom groupings)
  - [ ] Prisma self-referencing parent-child relationship on Invoice
  - [ ] Sub-invoice number generation (`INV-001-A`, `INV-001-B`)
  - [ ] Rollup calculation (parent totals = sum of children)
  - [ ] Cascade status updates (paying parent marks children paid)
  - [ ] Invoice split endpoint (`POST /api/invoices/:id/split`)
  - [ ] Invoice merge endpoint (`POST /api/invoices/:id/merge`)
  - [ ] Consolidation strategy parameter (FLAT, BY_ACCOUNT, BY_GROUP)
  - [ ] Invoice group CRUD API (`/api/invoice-groups`)
  - [ ] Sub-invoice filtering and nested response support
- [ ] Purchase order (PO) management system
- [ ] PO number tracking on invoices
- [ ] PO approval workflows (configurable approval chains)
- [ ] Credit limit configuration per account
- [ ] Credit hold enforcement (prevent new invoices if over limit)
- [ ] Payment processing and payment application
- [ ] Payment reconciliation (match payments to invoices)
- [ ] Multi-currency support for global enterprises
- [ ] Currency conversion rates (daily updates)
- [ ] Tax calculation by jurisdiction (US states, EU VAT, etc.)
- [ ] Discount management (contract-level discounts)
- [ ] Credit notes and refunds
- [ ] Dunning workflows for overdue enterprise accounts

### Phase 5: Analytics & Optimization (NICE TO HAVE)

- [ ] Enterprise analytics dashboard (ARR, MRR, bookings, churn)
- [ ] Contract renewal tracking and alerts
- [ ] Revenue forecasting based on pipeline and renewals
- [ ] Customer health scoring (payment history, engagement)
- [ ] SLA-based billing adjustments (credits for downtime)
- [ ] Custom billing rules engine (Javascript/Lua scripting)
- [ ] Webhook system for enterprise events (invoice.created, payment.received, contract.renewed)
- [ ] Payment gateway integration (Stripe API, ACH)
- [ ] Audit logging for SOC2/GDPR compliance
- [ ] Data export for finance systems (CSV, JSON)
- [ ] API rate limiting and throttling
- [ ] Advanced contract analytics (win rate, deal velocity)

## Subtasks

### Phase 1: Foundation (Weeks 1-2)

| ID | Task | Status | Assignee | Notes |
|----|------|--------|----------|-------|
| **Database Setup** | | | | |
| 1 | Design database schema (ERD) | completed | billman | Customers, products, invoices |
| 2 | Set up PostgreSQL with Docker | completed | habibi | docker-compose service |
| 3 | Create migration system (node-pg-migrate) | completed | billman | Version control for schema |
| 4 | Write initial migrations | completed | billman | Create tables |
| 5 | Seed database with sample data | completed | billman | Test data |
| **API Server** | | | | |
| 6 | Create revenue-backend package structure | completed | billman | Express.js setup |
| 7 | Set up Express server with CORS | completed | billman | Port 5177 |
| 8 | Integrate auth-server session validation | completed | billman | Middleware for auth |
| 9 | Set up PostgreSQL connection pool (pg) | completed | billman | Database client |
| **Customer API** | | | | |
| 10 | POST /api/customers - Create customer | completed | billman | Validation, error handling |
| 11 | GET /api/customers - List customers | completed | billman | Pagination, filtering |
| 12 | GET /api/customers/:id - Get customer | completed | billman | With related data |
| 13 | PUT /api/customers/:id - Update customer | completed | billman | Partial updates |
| 14 | DELETE /api/customers/:id - Delete customer | completed | billman | Soft delete |
| **Product API** | | | | |
| 15 | POST /api/products - Create product | completed | billman | Name, price, type |
| 16 | GET /api/products - List products | completed | billman | Filter by type |
| 17 | GET /api/products/:id - Get product | completed | billman | With pricing details |
| 18 | PUT /api/products/:id - Update product | completed | billman | Price history |
| **Invoice API** | | | | |
| 19 | POST /api/invoices - Create invoice | completed | billman | Manual creation |
| 20 | GET /api/invoices - List invoices | completed | billman | Filter by status, customer |
| 21 | GET /api/invoices/:id - Get invoice | completed | billman | With line items |
| 22 | PUT /api/invoices/:id - Update invoice | completed | billman | Status transitions |
| 23 | POST /api/invoices/:id/items - Add line item | completed | billman | Product, quantity, price |
| 24 | DELETE /api/invoices/:id/items/:itemId | completed | billman | Remove line item |
| **Frontend Integration** | | | | |
| 25 | Update Revenue app API client | completed | billman | Point to localhost:5177 |
| 26 | Update useInvoices hook | completed | billman | Real API calls |
| 27 | Update useCustomers hook (Revenue context) | completed | billman | Different from CRM |
| 28 | Test full CRUD flow in UI | completed | billman | End-to-end |
| **Documentation** | | | | |
| 29 | Write API documentation (Swagger) | completed | billman | OpenAPI spec |
| 30 | Write README for revenue-backend | completed | billman | Setup, usage |

### Phase 2: Automation (Weeks 3-4)

| ID | Task | Status | Assignee | Notes |
|----|------|--------|----------|-------|
| **Billing Engine** | | | | |
| 31 | Design billing cycle configuration | completed | billman | Monthly, quarterly, annual |
| 32 | Create billing_cycles table | completed | billman | Migration |
| 33 | POST /api/billing-cycles - Create cycle | completed | billman | Schedule, rules |
| 34 | Build invoice generation engine | completed | billman | From billing cycle + customer |
| 35 | POST /api/billing/generate - Trigger generation | completed | billman | On-demand |
| **Scheduled Jobs** | | | | |
| 36 | Set up job scheduler (Bull/Redis) | completed | habibi | Job queue |
| 37 | Create recurring job for invoice generation | completed | billman | Daily cron |
| 38 | Add job monitoring dashboard | completed | billman | View job status |
| **Email System** | | | | |
| 39 | Set up email service (Nodemailer) | completed | billman | SMTP config |
| 40 | Create invoice email templates | completed | billman | HTML + plain text |
| 41 | POST /api/invoices/:id/send - Send invoice | completed | billman | Email to customer |
| 42 | Add email notification on invoice created | completed | billman | Event-driven |
| **PDF Generation** | | | | |
| 43 | Install PDF library (pdfkit or puppeteer) | completed | billman | Choose best fit |
| 44 | Create invoice PDF template | completed | billman | Company logo, styling |
| 45 | GET /api/invoices/:id/pdf - Download PDF | completed | billman | Generate on demand |
| 46 | Store PDFs in filesystem/S3 | completed | billman | Caching |
| **Invoice Enhancements** | | | | |
| 47 | Implement invoice numbering system | completed | billman | INV-2026-001 format |
| 48 | Add payment terms configuration | completed | billman | Net 30, Net 60 |
| 49 | Calculate due dates automatically | completed | billman | From issue date + terms |
| 50 | Invoice status auto-transition (overdue) | completed | billman | Scheduled check |
| **Reporting** | | | | |
| 51 | GET /api/reports/revenue - Revenue by period | completed | billman | Aggregate queries |
| 52 | GET /api/reports/customers - Customer analytics | completed | billman | Top customers |
| 53 | Create reports database views | completed | billman | Optimize queries |
| **Scalability Architecture (Hybrid Approach)** | | | | |
| 54 | Install PM2 process manager | completed | habibi | npm install -g pm2 |
| 55 | Create PM2 ecosystem.config.js | completed | habibi | Define API + workers |
| 56 | Configure API server cluster mode (4 processes) | completed | habibi | PM2 cluster config |
| 57 | Install BullMQ and ioredis | completed | billman | npm install bullmq ioredis |
| 58 | Create queue configuration module | completed | billman | Redis connection |
| 59 | Create PDF job queue (pdf-queue) | completed | billman | BullMQ queue setup |
| 60 | Create tax calculation queue (tax-queue) | completed | billman | For heavy tax calc |
| 61 | Create email queue (email-queue) | completed | billman | Async email sending |
| 62 | Update API routes to use queues | completed | billman | POST /pdf → queue job |
| 63 | Create PDF worker process | completed | billman | Separate worker.js |
| 64 | Implement Worker Threads in PDF worker | completed | billman | Thread pool for PDFs |
| 65 | Create tax calculation worker | completed | billman | With Worker Threads |
| 66 | Create email worker process | completed | billman | Process email queue |
| 67 | Implement database connection pooling | completed | billman | Max 5 per process |
| 68 | Add graceful shutdown handlers | completed | billman | SIGTERM handling |
| 69 | Implement job retry logic | completed | billman | 3 attempts, exp backoff |
| 70 | Add queue monitoring endpoints | completed | billman | GET /api/queues/status |
| 71 | Configure PM2 memory limits | completed | habibi | max_memory_restart |
| 72 | Test cluster mode load balancing | completed | habibi | Load test with Artillery |
| 73 | Benchmark PDF generation throughput | completed | billman | Measure PDFs/sec |
| 74 | Document scalability architecture | completed | billman | README for workers |

### Phase 3: Subscriptions (Weeks 5-6)

| ID | Task | Status | Assignee | Notes |
|----|------|--------|----------|-------|
| **Subscription Plans** | | | | |
| 75 | Create subscription_plans table | planned | billman | Migration |
| 76 | POST /api/plans - Create plan | planned | billman | Name, price, interval |
| 77 | GET /api/plans - List plans | planned | billman | Public catalog |
| 78 | Support tiered pricing | planned | billman | Different tiers/features |
| **Customer Subscriptions** | | | | |
| 79 | Create subscriptions table | planned | billman | Customer, plan, status |
| 80 | POST /api/subscriptions - Subscribe customer | planned | billman | Enroll in plan |
| 81 | GET /api/subscriptions - List subscriptions | planned | billman | Filter by customer |
| 82 | PUT /api/subscriptions/:id - Update subscription | planned | billman | Upgrade/downgrade |
| 83 | DELETE /api/subscriptions/:id - Cancel | planned | billman | Immediate or end of period |
| **Renewal Logic** | | | | |
| 84 | Build auto-renewal job | planned | billman | Check expiring subscriptions |
| 85 | Generate renewal invoices | planned | billman | Before renewal date |
| 86 | Handle renewal failures | planned | billman | Grace period |
| **Proration** | | | | |
| 87 | Calculate proration for upgrades | planned | billman | Credit unused time |
| 88 | Calculate proration for downgrades | planned | billman | Apply at next renewal |
| 89 | Handle mid-cycle cancellations | planned | billman | Refund or credit |
| **Trial Periods** | | | | |
| 90 | Add trial period support to plans | planned | billman | Days count |
| 91 | Create subscription with trial | planned | billman | No initial charge |
| 92 | Convert trial to paid automatically | planned | billman | After trial ends |
| **Analytics** | | | | |
| 93 | GET /api/reports/subscriptions/mrr | planned | billman | Monthly Recurring Revenue |
| 94 | GET /api/reports/subscriptions/churn | planned | billman | Cancellation rate |
| 95 | Subscription lifecycle metrics | planned | billman | Active, churned, etc. |

### Phase 4: Advanced Billing (Weeks 7-9)

| ID | Task | Status | Assignee | Notes |
|----|------|--------|----------|-------|
| **Usage-Based Billing** | | | | |
| 96 | Create usage_records table | planned | billman | Metered usage data |
| 97 | POST /api/usage - Ingest usage record | planned | billman | API calls, GB, etc. |
| 98 | GET /api/usage - Query usage | planned | billman | By customer, period |
| 99 | Build rating engine | planned | billman | Convert usage to charges |
| 100 | Support tiered/volume pricing | planned | billman | $0.10/GB 0-100, $0.05/GB 100+ |
| 101 | Generate usage-based invoices | planned | billman | Aggregate usage |
| **Dunning** | | | | |
| 102 | Create dunning_workflows table | planned | billman | Retry rules |
| 103 | POST /api/payments/:id/retry - Retry payment | planned | billman | Manual retry |
| 104 | Automated retry job | planned | billman | 3 retries over 7 days |
| 105 | Email notifications for failed payments | planned | billman | Escalating urgency |
| 106 | Suspend subscription after failures | planned | billman | Grace period expired |
| **Multi-Currency** | | | | |
| 107 | Add currency field to invoices | planned | billman | USD, EUR, GBP |
| 108 | Create exchange_rates table | planned | billman | Daily rates |
| 109 | GET /api/exchange-rates - Fetch rates | planned | billman | External API integration |
| 110 | Convert invoice amounts | planned | billman | Display in customer currency |
| **Tax Calculation** | | | | |
| 111 | Create tax_rules table | planned | billman | By region, product type |
| 112 | Calculate tax on invoice items | planned | billman | Based on customer location |
| 113 | Support VAT/GST/Sales tax | planned | billman | Different tax types |
| **Discounts & Credits** | | | | |
| 114 | Create discount_codes table | planned | billman | Promo codes |
| 115 | POST /api/discounts - Create discount | planned | billman | %, fixed amount |
| 116 | Apply discount to invoice | planned | billman | Validation |
| 117 | Create credit_notes table | planned | billman | Refunds, credits |
| 118 | POST /api/credit-notes - Issue credit | planned | billman | Adjust invoice |

### Phase 5: Enterprise Features (Weeks 10-12)

| ID | Task | Status | Assignee | Notes |
|----|------|--------|----------|-------|
| **Advanced Analytics** | | | | |
| 119 | Build analytics dashboard API | planned | billman | KPIs, charts |
| 120 | GET /api/analytics/arr - Annual Recurring Revenue | planned | billman | Forecasting |
| 121 | GET /api/analytics/ltv - Customer Lifetime Value | planned | billman | Cohort analysis |
| 122 | Revenue forecasting | planned | billman | Predictive analytics |
| **Custom Billing Rules** | | | | |
| 123 | Design rules engine architecture | planned | billman | Plugin system |
| 124 | Support custom Javascript rules | planned | billman | Sandboxed execution |
| 125 | Rule testing framework | planned | billman | Validate rules |
| **Webhooks** | | | | |
| 126 | Create webhooks table | planned | billman | Subscriber URLs |
| 127 | POST /api/webhooks - Register webhook | planned | billman | Event types |
| 128 | Webhook delivery system | planned | billman | Retry logic |
| 129 | Webhook signature verification | planned | billman | HMAC security |
| 130 | Events: invoice.created, payment.succeeded | planned | billman | Event catalog |
| **Payment Gateway** | | | | |
| 131 | Integrate Stripe SDK | planned | billman | Payment processing |
| 132 | POST /api/payments - Process payment | planned | billman | Credit card |
| 133 | Stripe webhook handler | planned | billman | Async updates |
| 134 | Support multiple payment methods | planned | billman | Card, ACH, etc. |
| **Multi-Tenant** | | | | |
| 135 | Add tenant_id to all tables | planned | billman | Row-level security |
| 136 | Tenant isolation middleware | planned | billman | Security |
| 137 | Tenant provisioning API | planned | billman | Create new tenant |
| **Compliance & Export** | | | | |
| 138 | Audit logging system | planned | billman | All mutations logged |
| 139 | GET /api/export/invoices - Export CSV | planned | billman | Data portability |
| 140 | GET /api/export/customers - Export JSON | planned | billman | Backup |
| 141 | API rate limiting | planned | billman | Prevent abuse |

### Phase 4.5: Sub-Invoices & Organizational Billing (~12-18 days)

Full detail: [`docs/features/sub-invoices.md`](./features/sub-invoices.md)

| ID | Task | Complexity | Status | Notes |
|----|------|------------|--------|-------|
| **Phase A: Database Schema** | | | | |
| A1 | Create `InvoiceGroup` entity | Medium | completed | DEPARTMENT, COST_CENTER, LOCATION, CUSTOM |
| A2 | Add Prisma self-referencing relationship for `parentInvoiceId` | Low | completed | Defines Invoice hierarchy |
| A3 | Add `invoiceGroupId` FK to Invoice model | Low | completed | Links invoice to org group |
| A4 | Add `groupType` enum | Low | completed | See InvoiceGroup entity |
| A5 | Add `groupReference` field to InvoiceItem | Low | completed | Line-item org attribution |
| A6 | Create database migration | Medium | completed | All schema changes |
| A7 | Add index on `parentInvoiceId` | Low | completed | Efficient hierarchy queries |
| **Phase B: Invoice Group Management** | | | | |
| B1 | `InvoiceGroup` service (CRUD) | Medium | completed | |
| B2 | DTOs for invoice group create/update/query | Medium | completed | |
| B3 | Invoice group controller + REST endpoints | Medium | completed | `/api/invoice-groups` |
| B4 | Validate group uniqueness per account | Low | completed | |
| B5 | Cascade behavior on group soft delete | Low | completed | |
| **Phase C: Sub-Invoice Core Logic** | | | | |
| C1 | Update Invoice service for parent-child support | Medium | completed | |
| C2 | `createSubInvoice()` method | Medium | completed | Links to parent |
| C3 | `getSubInvoices()` method | Low | completed | Children of a parent |
| C4 | `getParentInvoice()` method | Low | completed | Parent of a child |
| C5 | Sub-invoice number generation (`INV-001-A/B/C`) | Medium | completed | |
| C6 | Rollup calculation (parent totals = sum of children) | Medium | completed | |
| C7 | Validation: sub-invoice totals must match parent | Medium | completed | |
| C8 | Cascade status updates (parent → children) | Medium | completed | Paying parent marks children paid |
| **Phase D: Invoice Item Grouping** | | | | |
| D1 | Add `groupReference` to InvoiceItem | Low | completed | |
| D2 | Grouping logic in invoice creation | Medium | planned | |
| D3 | Move items between groups/sub-invoices endpoint | Medium | planned | |
| D4 | Validation for item reassignment | Medium | planned | Amount consistency |
| **Phase E: API Endpoints** | | | | |
| E1 | `GET /api/invoices/:id/sub-invoices` | Low | completed | |
| E2 | `POST /api/invoices/:id/sub-invoices` | Medium | completed | |
| E3 | `GET /api/invoices/:id/parent` | Low | planned | |
| E4 | `POST /api/invoices/:id/split` | High | planned | Split by group |
| E5 | `POST /api/invoices/:id/merge` | High | planned | Merge sub-invoices |
| E6 | `parentInvoiceId[eq]` filter on list endpoint | Low | completed | |
| E7 | `includeSubInvoices` query param | Medium | planned | Nested response |
| E8 | Invoice detail includes sub-invoice summary | Low | completed | |
| **Phase F: Consolidated Billing Integration** | | | | |
| F1 | Update consolidated billing for parent + sub-invoices | High | planned | |
| F2 | Strategy: sub-invoice per subsidiary account | Medium | planned | |
| F3 | Strategy: sub-invoice per cost center/department | Medium | planned | |
| F4 | `consolidationStrategy` param (FLAT, BY_ACCOUNT, BY_GROUP) | Medium | planned | |
| F5 | Update billing processor for sub-invoice generation | Medium | planned | |
| **Phase G: Testing** | | | | |
| G1 | Unit tests for invoice group service | Medium | completed | |
| G2 | Unit tests for sub-invoice creation/retrieval | Medium | completed | |
| G3 | Unit tests for rollup calculations | Medium | completed | |
| G4 | Integration tests for split/merge operations | High | planned | |
| G5 | Integration tests for consolidated billing with sub-invoices | High | planned | |
| G6 | E2E tests for complete sub-invoice workflows | High | planned | |
| **Phase H: Documentation** | | | | |
| H1 | Update `sub-invoices.md` post-implementation | Medium | planned | |
| H2 | Update `invoices.md` with sub-invoice info | Low | planned | |
| H3 | Update `billing.md` with consolidation strategies | Low | planned | |
| H4 | Add API examples and cURL commands | Low | planned | |

## Technical Notes

### Database Schema (Phase 1)

**Enterprise Accounts (B2B Focus):**

```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_account_id UUID REFERENCES accounts(id), -- For hierarchical structures
  account_name VARCHAR(255) NOT NULL,
  account_type VARCHAR(50) DEFAULT 'enterprise', -- enterprise, mid-market, smb
  primary_contact_email VARCHAR(255) NOT NULL,
  billing_contact_name VARCHAR(255),
  billing_contact_email VARCHAR(255),
  company_size VARCHAR(50), -- 1-50, 51-200, 201-1000, 1000+
  industry VARCHAR(100),

  -- Billing Address
  billing_address_line1 VARCHAR(255),
  billing_address_line2 VARCHAR(255),
  billing_city VARCHAR(100),
  billing_state VARCHAR(100),
  billing_postal_code VARCHAR(20),
  billing_country VARCHAR(2), -- ISO 3166-1 alpha-2

  -- Payment Configuration
  payment_terms VARCHAR(50) DEFAULT 'net_30', -- net_30, net_60, net_90, custom
  payment_terms_days INT DEFAULT 30,
  currency VARCHAR(3) DEFAULT 'USD', -- ISO 4217
  tax_id VARCHAR(100), -- VAT/EIN/Tax Registration

  -- Credit Management
  credit_limit DECIMAL(12, 2),
  credit_hold BOOLEAN DEFAULT false,

  -- Account Status
  status VARCHAR(20) DEFAULT 'active', -- active, suspended, closed, pending

  -- Metadata
  metadata JSONB, -- Custom fields
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP -- Soft delete
);

CREATE INDEX idx_accounts_parent ON accounts(parent_account_id);
CREATE INDEX idx_accounts_status ON accounts(status);
CREATE INDEX idx_accounts_type ON accounts(account_type);
```

**Contracts (B2B Commitment-Based):**

```sql
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number VARCHAR(100) UNIQUE NOT NULL,
  account_id UUID REFERENCES accounts(id) NOT NULL,

  -- Contract Terms
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  contract_value DECIMAL(12, 2) NOT NULL, -- Total contract value (TCV)
  billing_frequency VARCHAR(50) DEFAULT 'annual', -- monthly, quarterly, annual, custom

  -- Seat-Based Licensing
  seat_count INT, -- Number of licenses/users
  committed_seats INT, -- Minimum committed seats
  seat_price DECIMAL(10, 2), -- Price per seat

  -- Payment Terms
  payment_terms VARCHAR(50) DEFAULT 'net_30',
  billing_in_advance BOOLEAN DEFAULT true, -- Bill at start of period

  -- Auto-Renewal
  auto_renew BOOLEAN DEFAULT true,
  renewal_notice_days INT DEFAULT 90, -- Alert N days before renewal

  -- Status
  status VARCHAR(20) DEFAULT 'active', -- draft, active, expired, cancelled

  -- Metadata
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_contracts_account ON contracts(account_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_end_date ON contracts(end_date); -- For renewal tracking
```

**Products (B2B Seat-Based Focus):**

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sku VARCHAR(100) UNIQUE,

  -- Pricing Model
  pricing_model VARCHAR(50) NOT NULL, -- seat_based, flat_fee, volume_tiered, custom
  base_price DECIMAL(10, 2), -- Base price or per-seat price
  currency VARCHAR(3) DEFAULT 'USD',

  -- Seat-Based Configuration
  min_seats INT DEFAULT 1, -- Minimum seats required
  max_seats INT, -- Maximum seats allowed (null = unlimited)
  seat_increment INT DEFAULT 1, -- Must buy in increments (e.g., 5, 10)

  -- Volume Discount Tiers (JSONB for flexibility)
  volume_tiers JSONB, -- [{ "min": 1, "max": 50, "price": 99 }, { "min": 51, "max": 200, "price": 89 }]

  -- Billing Configuration
  billing_interval VARCHAR(20), -- month, quarter, year (for recurring)

  -- Product Status
  active BOOLEAN DEFAULT true,
  is_addon BOOLEAN DEFAULT false, -- Is this an add-on product?

  -- Metadata
  metadata JSONB, -- Custom fields
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_products_pricing_model ON products(pricing_model);
CREATE INDEX idx_products_active ON products(active);
```

**Invoices (B2B with Contract & PO Linking):**

```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,

  -- B2B Relationships
  account_id UUID REFERENCES accounts(id) NOT NULL,
  contract_id UUID REFERENCES contracts(id), -- Link to contract (null if ad-hoc)
  purchase_order_number VARCHAR(100), -- Customer PO number

  -- Invoice Dates
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  period_start DATE, -- Billing period start
  period_end DATE, -- Billing period end

  -- Amounts
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  tax DECIMAL(12, 2) NOT NULL DEFAULT 0,
  discount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'USD',

  -- Payment Status
  status VARCHAR(20) DEFAULT 'draft', -- draft, sent, paid, partially_paid, overdue, void, cancelled
  paid_amount DECIMAL(12, 2) DEFAULT 0,
  paid_date DATE,

  -- Billing Type
  billing_type VARCHAR(50) DEFAULT 'recurring', -- recurring, one_time, adjustment

  -- Enterprise Features
  consolidated BOOLEAN DEFAULT false, -- Is this a consolidated invoice?
  parent_invoice_id UUID REFERENCES invoices(id), -- For consolidated billing

  -- Notes & Metadata
  notes TEXT,
  internal_notes TEXT, -- Internal notes (not shown to customer)
  metadata JSONB,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invoices_account ON invoices(account_id);
CREATE INDEX idx_invoices_contract ON invoices(contract_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_po ON invoices(purchase_order_number);
```

**Invoice Items:**

```sql
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  description TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL, -- quantity * unit_price
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
```

**Purchase Orders (Phase 4):**

```sql
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number VARCHAR(100) UNIQUE NOT NULL,
  account_id UUID REFERENCES accounts(id) NOT NULL,
  contract_id UUID REFERENCES contracts(id),

  -- PO Details
  po_amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,

  -- Approval Workflow
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, expired
  approval_required BOOLEAN DEFAULT false,
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,

  -- Usage Tracking
  amount_invoiced DECIMAL(12, 2) DEFAULT 0,
  amount_remaining DECIMAL(12, 2),

  -- Metadata
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_po_account ON purchase_orders(account_id);
CREATE INDEX idx_po_number ON purchase_orders(po_number);
CREATE INDEX idx_po_status ON purchase_orders(status);
```

### API Structure

```
packages/revenue-backend/
├── src/
│   ├── index.js              # Server entry point
│   ├── config/
│   │   ├── database.js       # PostgreSQL connection
│   │   └── env.js            # Environment variables
│   ├── routes/
│   │   ├── accounts.js       # Enterprise account endpoints
│   │   ├── contracts.js      # Contract management endpoints (Phase 1)
│   │   ├── products.js       # Product catalog endpoints
│   │   ├── invoices.js       # Invoice endpoints
│   │   ├── purchase-orders.js # PO management endpoints (Phase 4)
│   │   ├── payments.js       # Payment endpoints (Phase 4)
│   │   ├── billing.js        # Contract billing engine (Phase 2)
│   │   └── reports.js        # Analytics & forecasting (Phase 5)
│   ├── services/
│   │   ├── invoice-generator.js  # Contract-based invoice generation
│   │   ├── billing-engine.js     # Automated contract billing
│   │   ├── seat-calculator.js    # Seat-based pricing calculations
│   │   ├── discount-engine.js    # Volume discount calculations
│   │   ├── email-service.js      # Email sending
│   │   ├── pdf-generator.js      # PDF creation with enterprise branding
│   │   └── payment-gateway.js    # Stripe/ACH integration
│   ├── jobs/
│   │   ├── contract-billing.js   # Scheduled contract billing
│   │   ├── renewal-alerts.js     # Contract renewal notifications
│   │   └── dunning.js            # Overdue account management
│   ├── middleware/
│   │   ├── auth.js               # Session validation
│   │   ├── validate.js           # Request validation
│   │   └── credit-check.js       # Credit limit enforcement (Phase 4)
│   └── utils/
│       ├── hierarchy.js          # Account hierarchy utilities
│       ├── consolidated-billing.js # Consolidated invoice logic
│       └── tax-calculator.js     # Tax calculation by jurisdiction
├── migrations/
│   ├── 001_create_customers.sql
│   ├── 002_create_products.sql
│   └── 003_create_invoices.sql
├── package.json
├── Dockerfile
└── README.md
```

### Environment Variables

```bash
# packages/revenue-backend/.env
PORT=5177
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/revenue_db

# Auth Server Integration
AUTH_SERVER_URL=http://localhost:5176

# Email (Phase 2)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=billing@hybrid-ui.com
SMTP_PASSWORD=secret

# Payment Gateway (Phase 5)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Redis for jobs (Phase 2)
REDIS_URL=redis://localhost:6379
```

### API Examples

**Create Enterprise Contract:**

```http
POST /api/contracts
Content-Type: application/json
Authorization: Bearer {sessionToken}

{
  "account_id": "acc-789",
  "contract_number": "CTR-2026-001",
  "start_date": "2026-02-01",
  "end_date": "2027-01-31",
  "contract_value": 119880.00,
  "billing_frequency": "annual",
  "seat_count": 100,
  "committed_seats": 100,
  "seat_price": 99.90,
  "payment_terms": "net_30",
  "billing_in_advance": true,
  "auto_renew": true,
  "renewal_notice_days": 90,
  "notes": "Enterprise annual contract with 100 seats"
}
```

**Response:**

```json
{
  "id": "ctr-uuid-123",
  "contract_number": "CTR-2026-001",
  "account_id": "acc-789",
  "start_date": "2026-02-01",
  "end_date": "2027-01-31",
  "contract_value": 119880.00,
  "billing_frequency": "annual",
  "seat_count": 100,
  "committed_seats": 100,
  "seat_price": 99.90,
  "payment_terms": "net_30",
  "billing_in_advance": true,
  "auto_renew": true,
  "status": "active",
  "created_at": "2026-01-11T10:30:00Z"
}
```

**Generate Invoice from Contract:**

```http
POST /api/billing/generate
Content-Type: application/json
Authorization: Bearer {sessionToken}

{
  "contract_id": "ctr-uuid-123",
  "billing_period_start": "2026-02-01",
  "billing_period_end": "2027-01-31",
  "purchase_order_number": "PO-ACME-2026-045"
}
```

**Response:**

```json
{
  "id": "inv-uuid-456",
  "invoice_number": "INV-2026-001",
  "account_id": "acc-789",
  "contract_id": "ctr-uuid-123",
  "purchase_order_number": "PO-ACME-2026-045",
  "issue_date": "2026-02-01",
  "due_date": "2026-03-03",
  "period_start": "2026-02-01",
  "period_end": "2027-01-31",
  "subtotal": 119880.00,
  "tax": 0.00,
  "discount": 0.00,
  "total": 119880.00,
  "currency": "USD",
  "status": "draft",
  "billing_type": "recurring",
  "items": [
    {
      "id": "item-uuid-1",
      "product_id": "prod-crm-enterprise",
      "description": "CRM Enterprise - Annual (100 seats @ $99.90/seat)",
      "quantity": 100,
      "unit_price": 99.90,
      "amount": 9990.00
    },
    {
      "id": "item-uuid-2",
      "description": "Annual Billing (12 months @ $9,990/month)",
      "quantity": 12,
      "unit_price": 9990.00,
      "amount": 119880.00
    }
  ],
  "created_at": "2026-02-01T08:00:00Z"
}
```

### Scalability Architecture Implementation

**PM2 Ecosystem Configuration:**

```javascript
// ecosystem.config.js (PM2 configuration)
module.exports = {
  apps: [
    // API Server (Cluster mode for I/O scaling)
    {
      name: 'revenue-api',
      script: './src/server.js',
      instances: 4,  // 4 processes (for 4-8 core CPU)
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5177,
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/revenue_db',
        REDIS_URL: 'redis://localhost:6379'
      },
      max_memory_restart: '500M',  // Restart if memory > 500MB
      error_file: './logs/api-err.log',
      out_file: './logs/api-out.log',
      merge_logs: true
    },

    // PDF Worker (separate process with Worker Threads)
    {
      name: 'pdf-worker',
      script: './src/workers/pdf-worker.js',
      instances: 4,  // 4 worker processes
      exec_mode: 'fork',  // Not cluster mode
      env: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'pdf',
        REDIS_URL: 'redis://localhost:6379',
        THREAD_POOL_SIZE: 2  // 2 threads per process
      },
      max_memory_restart: '800M'  // PDFs use more memory
    },

    // Tax Calculation Worker
    {
      name: 'tax-worker',
      script: './src/workers/tax-worker.js',
      instances: 2,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'tax',
        THREAD_POOL_SIZE: 4  // More threads for CPU-heavy calc
      }
    },

    // Email Worker
    {
      name: 'email-worker',
      script: './src/workers/email-worker.js',
      instances: 2,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'email'
      }
    },

    // Billing Scheduler (recurring jobs)
    {
      name: 'billing-scheduler',
      script: './src/jobs/recurring-billing.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

**Queue Configuration:**

```javascript
// src/config/queues.js
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null
});

// PDF Generation Queue
export const pdfQueue = new Queue('pdf-generation', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

// Tax Calculation Queue
export const taxQueue = new Queue('tax-calculation', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    }
  }
});

// Email Queue
export const emailQueue = new Queue('email', {
  connection,
  defaultJobOptions: {
    attempts: 5,  // Retry more for emails
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  }
});

// Billing Queue (scheduled jobs)
export const billingQueue = new Queue('billing', {
  connection,
  defaultJobOptions: {
    attempts: 2
  }
});
```

**API Server with Queue Integration:**

```javascript
// src/server.js
import express from 'express';
import { pdfQueue, taxQueue, emailQueue } from './config/queues.js';
import { pool } from './config/database.js';  // Connection pooling

const app = express();

// I/O-bound route (fast, handled by cluster)
app.get('/api/invoices', async (req, res) => {
  const invoices = await pool.query('SELECT * FROM invoices');
  res.json(invoices.rows);
});

// CPU-bound route → queue it (non-blocking)
app.post('/api/invoices/:id/pdf', async (req, res) => {
  const { id } = req.params;

  // Add job to queue (returns immediately)
  const job = await pdfQueue.add('generate-pdf', {
    invoiceId: id,
    userId: req.user.id
  });

  res.json({
    jobId: job.id,
    status: 'queued',
    message: 'PDF generation started. Poll /api/jobs/:id for status'
  });
});

// Check job status
app.get('/api/jobs/:id', async (req, res) => {
  const job = await pdfQueue.getJob(req.params.id);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const state = await job.getState();

  if (state === 'completed') {
    const result = job.returnvalue;
    res.json({
      status: 'completed',
      pdfUrl: result.url,
      completedAt: job.finishedOn
    });
  } else if (state === 'failed') {
    res.json({
      status: 'failed',
      error: job.failedReason
    });
  } else {
    res.json({
      status: state,  // waiting, active, delayed
      progress: job.progress
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server gracefully');

  await pool.end();  // Close database connections
  await pdfQueue.close();
  await taxQueue.close();
  await emailQueue.close();

  process.exit(0);
});

app.listen(5177);
```

**PDF Worker with Worker Threads:**

```javascript
// src/workers/pdf-worker.js
import { Worker as BullWorker } from 'bullmq';
import { Worker as ThreadWorker } from 'worker_threads';
import { pdfQueue } from '../config/queues.js';
import path from 'path';

const THREAD_POOL_SIZE = parseInt(process.env.THREAD_POOL_SIZE) || 2;
const threadPool = [];

// Initialize thread pool
for (let i = 0; i < THREAD_POOL_SIZE; i++) {
  threadPool.push(null);  // Lazy initialization
}

function getAvailableThreadSlot() {
  return threadPool.findIndex(worker => worker === null);
}

async function generatePDFInThread(invoiceId) {
  return new Promise((resolve, reject) => {
    const slotIndex = getAvailableThreadSlot();

    const worker = new ThreadWorker(
      path.resolve('./src/threads/pdf-generator.js'),
      { workerData: { invoiceId } }
    );

    threadPool[slotIndex] = worker;

    worker.on('message', (result) => {
      threadPool[slotIndex] = null;  // Free slot
      resolve(result);
    });

    worker.on('error', (err) => {
      threadPool[slotIndex] = null;
      reject(err);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        threadPool[slotIndex] = null;
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

// BullMQ worker (processes jobs from queue)
const pdfWorker = new BullWorker('pdf-generation', async (job) => {
  const { invoiceId } = job.data;

  console.log(`[PDF Worker ${process.pid}] Processing invoice ${invoiceId}`);

  // Update progress
  await job.updateProgress(10);

  // Offload to Worker Thread
  const { pdfBuffer } = await generatePDFInThread(invoiceId);

  await job.updateProgress(80);

  // Upload to S3 (or save to disk)
  const url = await uploadPDF(pdfBuffer, invoiceId);

  await job.updateProgress(100);

  return { url, invoiceId };
}, {
  connection: { host: 'localhost', port: 6379 },
  concurrency: THREAD_POOL_SIZE  // Process N jobs in parallel
});

pdfWorker.on('completed', (job, result) => {
  console.log(`[PDF Worker] Job ${job.id} completed: ${result.url}`);
});

pdfWorker.on('failed', (job, err) => {
  console.error(`[PDF Worker] Job ${job.id} failed:`, err.message);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing PDF worker gracefully');
  await pdfWorker.close();
  process.exit(0);
});
```

**Worker Thread (actual PDF generation):**

```javascript
// src/threads/pdf-generator.js
import { parentPort, workerData } from 'worker_threads';
import PDFDocument from 'pdfkit';
import { pool } from '../config/database.js';

const { invoiceId } = workerData;

async function generatePDF() {
  // Fetch invoice data
  const invoice = await pool.query(
    'SELECT * FROM invoices WHERE id = $1',
    [invoiceId]
  );

  const items = await pool.query(
    'SELECT * FROM invoice_items WHERE invoice_id = $1',
    [invoiceId]
  );

  // CPU-intensive PDF generation
  const doc = new PDFDocument();
  const chunks = [];

  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', () => {
    const pdfBuffer = Buffer.concat(chunks);
    parentPort.postMessage({ pdfBuffer });
  });

  // Build PDF (heavy computation)
  doc.fontSize(20).text('Invoice', { align: 'center' });
  doc.fontSize(12).text(`Invoice #: ${invoice.rows[0].invoice_number}`);

  // Add line items
  items.rows.forEach(item => {
    doc.text(`${item.description}: $${item.amount}`);
  });

  doc.end();
}

// Run and send result back
generatePDF().catch(err => {
  parentPort.postMessage({ error: err.message });
});
```

**Database Connection Pooling:**

```javascript
// src/config/database.js
import pkg from 'pg';
const { Pool } = pkg;

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'revenue_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 5,  // Max 5 connections per process
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// B2B Enterprise connection pooling:
// Total connections: 4 API workers × 5 = 20
//                    + 2 Contract Billing workers × 5 = 10
//                    + 2 Consolidated Billing workers × 5 = 10
//                    + 3 PDF workers × 5 = 15
//                    + 2 tax workers × 5 = 10
//                    + 2 email workers × 5 = 10
//                    + 1 renewal alert worker × 5 = 5
//                    + 2 webhook workers × 5 = 10
//                    = 90 total (within PostgreSQL limits)
```

**Performance Metrics (B2B Enterprise Workload):**

| Scenario | Without Scaling | With Hybrid Scaling | Improvement | Notes |
|----------|----------------|---------------------|-------------|-------|
| **API Operations** | | | | |
| Concurrent API requests (finance teams) | ~50 req/sec | ~200 req/sec (4 workers) | 4x | Lower concurrency than B2C but complex queries |
| Hierarchical account queries (3 levels deep) | ~20 req/sec | ~80 req/sec (optimized CTEs + workers) | 4x | Recursive queries for parent-child relationships |
| Contract CRUD operations | ~100 req/sec | ~400 req/sec (4 workers) | 4x | Standard CRUD with audit logging |
| **Billing Operations** | | | | |
| Contract-based invoice generation | ~5 invoices/sec | ~40 invoices/sec (2 workers) | 8x | Seat calculation + volume discounts |
| Consolidated invoices (10 subsidiaries) | ~2 invoices/sec | ~15 invoices/sec (2 dedicated workers) | 7.5x | Hierarchical aggregation + roll-up |
| Quarterly billing (10K accounts) | 33 minutes | 4 minutes (parallel workers) | 8x | Scheduled batch job |
| Annual billing (50K accounts) | 2.8 hours | 21 minutes (parallel workers) | 8x | Large batch with seat-based calc |
| **Document Generation** | | | | |
| Enterprise PDF invoices | ~8 PDFs/sec | ~48 PDFs/sec (3 workers × 2 threads) | 6x | Complex templates with branding |
| Batch PDF generation (1000 invoices) | 2.1 minutes | 21 seconds (parallel workers) | 6x | Month-end invoice delivery |
| **Tax & Discounts** | | | | |
| Multi-jurisdiction tax calculation | ~80/sec | ~320/sec (2 workers × 2 threads) | 4x | Multiple tax authorities per invoice |
| Volume discount application | ~150/sec | ~600/sec (tier lookup + caching) | 4x | Tiered pricing calculations |
| **Notifications** | | | | |
| Invoice email delivery (10K invoices) | 8.3 minutes | 1.0 minute (2 workers + queue) | 8x | To billing contacts |
| Contract renewal alerts (1K expiring) | 16.7 minutes | 2.1 minutes (1 worker + batch) | 8x | 90/60/30 day notifications |
| Webhook delivery (enterprise events) | ~10/sec | ~80/sec (2 workers + retry logic) | 8x | With exponential backoff |
| **Enterprise Operations** | | | | |
| Purchase order approvals | ~30/sec | ~120/sec (workflow queue) | 4x | Multi-stage approval chains |
| Credit limit checks | ~200/sec | ~800/sec (cached + workers) | 4x | Pre-invoice validation |
| Payment reconciliation (5K payments) | 25 minutes | 3 minutes (parallel matching) | 8x | Match payments to invoices |
| **Reporting & Analytics** | | | | |
| ARR/MRR calculation (10K accounts) | 45 seconds | 6 seconds (materialized views) | 7.5x | Pre-aggregated with DB views |
| Hierarchical roll-up reports | ~5 reports/sec | ~20 reports/sec (optimized CTEs) | 4x | Across parent-child structures |

**Key Performance Characteristics (B2B vs B2C):**

| Characteristic | B2C (Original) | B2B Enterprise (Updated) |
|----------------|----------------|--------------------------|
| **Concurrent Users** | High (1000s) | Lower (10s-100s finance users) |
| **Request Complexity** | Simple (read-heavy) | Complex (hierarchical, aggregations) |
| **Transaction Size** | Small ($5-$500) | Large ($10K-$1M+) |
| **Billing Frequency** | Real-time/monthly | Quarterly/Annual (scheduled) |
| **Query Patterns** | Simple lookups | Recursive CTEs, joins, aggregations |
| **Critical Operations** | Fast response time | Accuracy + audit trail |
| **Peak Load** | User-driven spikes | Scheduled batch operations (month-end) |
| **Scalability Need** | Horizontal (many servers) | Vertical (fewer powerful servers) + batch optimization |

### Integration with Existing System

**Auth Server Integration:**

```javascript
// middleware/auth.js
import axios from 'axios';

export async function validateSession(req, res, next) {
  const sessionToken = req.headers.authorization?.replace('Bearer ', '');

  if (!sessionToken) {
    return res.status(401).json({ error: 'No session token' });
  }

  try {
    const response = await axios.post('http://localhost:5176/auth/validate', {
      sessionToken
    });

    if (!response.data.valid) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    req.user = response.data.user;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Auth validation failed' });
  }
}
```

**Revenue Frontend Migration:**

```javascript
// packages/revenue-app/src/api/invoices.js (updated)

const API_BASE = import.meta.env.VITE_REVENUE_API_URL || 'http://localhost:5177';

export const invoicesApi = {
  async getAll() {
    const sessionToken = localStorage.getItem('sessionToken');
    const response = await fetch(`${API_BASE}/api/invoices`, {
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    });
    return response.json();
  },

  async getById(id) {
    const sessionToken = localStorage.getItem('sessionToken');
    const response = await fetch(`${API_BASE}/api/invoices/${id}`, {
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    });
    return response.json();
  },

  async create(invoice) {
    const sessionToken = localStorage.getItem('sessionToken');
    const response = await fetch(`${API_BASE}/api/invoices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invoice)
    });
    return response.json();
  }
};
```

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

## Security Considerations

1. **Financial Data Protection:**
   - All financial data in PostgreSQL (ACID compliance)
   - No sensitive data in logs
   - Encrypt data at rest (production)
   - Audit trail for all financial operations

2. **API Security:**
   - Session-based authentication (via auth-server)
   - Rate limiting to prevent abuse
   - Input validation on all endpoints
   - SQL injection prevention (parameterized queries)

3. **Payment Data:**
   - Never store credit card numbers (PCI compliance)
   - Use Stripe for card storage (tokenization)
   - Secure webhook signature verification

4. **Multi-Tenant Isolation:**
   - Row-level security in PostgreSQL
   - Tenant ID in all queries
   - Prevent cross-tenant data access

## Performance Considerations (B2B Enterprise)

1. **Database Optimization for B2B:**
   - **Hierarchical indices** - Composite index on `(parent_account_id, status)` for account tree queries
   - **Contract indices** - Index on `(end_date, auto_renew)` for renewal tracking
   - **Invoice indices** - Composite index on `(account_id, contract_id, status, due_date)`
   - **PO indices** - Index on `(po_number, status)` for procurement workflows
   - **Recursive CTEs** - Optimized queries for parent-child account traversal
   - **Materialized views** - Pre-aggregated ARR/MRR calculations (refreshed daily)
   - **Connection pooling** - Max 5 connections per worker process (90 total)
   - **Query optimization** - EXPLAIN ANALYZE for complex hierarchical queries
   - **Partial indices** - On active contracts, unpaid invoices (reduce index size)

2. **Caching Strategy for B2B:**
   - **Product catalog** - Cache seat-based pricing and volume discount tiers (1 hour TTL)
   - **Exchange rates** - Cache daily rates from external API (24 hour TTL)
   - **Account hierarchy** - Cache parent-child relationships (15 min TTL, invalidate on update)
   - **Volume discount rules** - Cache tiered pricing calculations (1 hour TTL)
   - **Tax rates** - Cache jurisdiction-based tax rates (24 hour TTL)
   - **Credit limits** - Cache account credit limit checks (5 min TTL)
   - **Contract terms** - Cache active contract details (30 min TTL)

3. **Scalability for B2B Workloads:**
   - **Vertical scaling first** - B2B benefits from powerful single server (complex queries)
   - **Read replicas** - For analytics and reporting queries (avoid blocking writes)
   - **Database sharding** - By account region if needed (North America, EMEA, APAC)
   - **Job queues** - Decouple heavy batch operations (contract billing, consolidated invoicing)
   - **Scheduled jobs** - Off-peak batch processing for monthly/quarterly billing runs
   - **Connection pooling** - Balance across worker processes to avoid connection exhaustion
   - **Query timeouts** - Set reasonable limits on complex hierarchical queries (30s max)

4. **Batch Operation Optimization:**
   - **Contract billing** - Process in batches of 500 contracts per job
   - **Consolidated billing** - Parallel processing by parent account
   - **PDF generation** - Queue-based with Worker Threads (48 PDFs/sec throughput)
   - **Email delivery** - Batch send in groups of 100 (avoid SMTP throttling)
   - **Renewal alerts** - Daily batch job for contracts expiring in 90/60/30 days
   - **Payment reconciliation** - Batch matching with fuzzy logic (invoice # + amount + date)

5. **Hierarchical Query Optimization:**
   - **Limit depth** - Cap account hierarchy at 5 levels (prevent infinite recursion)
   - **Materialized path** - Store full parent path for faster lookups
   - **Adjacency list** - Primary storage method with parent_account_id
   - **Closure table** - Optional secondary table for complex hierarchy queries
   - **Query caching** - Cache recursive CTE results for frequently accessed hierarchies

6. **Month-End Performance:**
   - **Peak load planning** - Most B2B billing occurs on 1st of month
   - **Stagger billing** - Spread contract billing across days 1-5 of month
   - **Pre-generate PDFs** - Create invoices 2-3 days before send date
   - **Database backups** - Schedule before month-end billing runs
   - **Monitoring** - Alert on job queue depth, database CPU, connection pool exhaustion

## Testing Strategy

**Phase 1:**

- Unit tests for account and contract API endpoints
- Integration tests with PostgreSQL
- Contract validation testing (dates, commitment values)
- Payment terms calculation testing
- API contract testing

**Phase 2:**

- Contract-based invoice generation testing
- Seat-based pricing calculation accuracy
- Volume discount rule testing
- Job scheduler testing
- Email delivery testing (mock SMTP)
- PDF generation with enterprise branding testing

**Phase 3:**

- Hierarchical account relationship testing
- Consolidated billing logic testing
- Roll-up reporting accuracy testing
- Parent-child contract inheritance testing

**Phase 4+:**

- Purchase order workflow testing
- Credit limit enforcement testing
- Payment reconciliation accuracy
- Multi-currency conversion testing
- Tax calculation by jurisdiction testing
- Payment gateway integration testing (Stripe/ACH test mode)

## Progress Log

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

## Quick Reference

**Phase Summary (B2B Enterprise Focus):**

- **Phase 1** (2 weeks): Foundation - Enterprise accounts, contracts, seat-based pricing (30 tasks)
- **Phase 2** (2 weeks): Contract Billing + Scalability - Automated billing, volume discounts, **Hybrid Architecture** (44 tasks)
- **Phase 3** (2 weeks): Hierarchical Accounts - Parent-child, consolidated billing (21 tasks)
- **Phase 4** (3 weeks): Enterprise Operations - Purchase orders, credit management, payments (23 tasks)
- **Phase 5** (3 weeks): Analytics & Optimization - ARR/MRR, renewal tracking, SLA adjustments (23 tasks)
- **Phase 6+ (Future):** B2C Event-Based Billing - Usage metering, pay-as-you-go (deferred)

**Total:** 141 subtasks across 12 weeks (3 months) for B2B Enterprise foundation

**B2B Enterprise Features:**

- 🏢 Hierarchical accounts (parent companies + subsidiaries)
- 📄 Contract-based billing (multi-year commitments)
- 👥 Seat-based licensing with volume discounts
- 📋 Purchase order management and approval workflows
- 💳 Credit limit management and enforcement
- 🧾 Consolidated billing across subsidiaries
- 📅 Quarterly/Annual billing in advance
- 💰 Custom payment terms (Net 30/60/90)

**Tech Stack:**

- **Backend:** Express.js (Node.js)
- **Database:** PostgreSQL (with connection pooling)
- **Scalability:** PM2 + Node.js Cluster + Worker Threads + BullMQ
- **Jobs:** BullMQ + Redis (queue system for contract billing)
- **Payments:** Stripe API + ACH
- **Email:** Nodemailer
- **PDF:** pdfkit with Worker Threads (enterprise-branded invoices)

**Scalability Architecture (B2B Optimized):**

- PM2 cluster mode (4 API processes for I/O-bound operations)
- BullMQ job queues (Redis-backed) - 8 queues for different B2B workflows
- Worker Threads for CPU tasks (PDF generation, tax calculations, consolidated billing)
- Dedicated worker processes:
  - 2 Contract Billing Workers (seat-based calculations, volume discounts)
  - 2 Consolidated Billing Workers (hierarchical aggregation)
  - 3 PDF Workers with Worker Threads (enterprise-branded invoices)
  - 2 Tax Workers with Worker Threads (multi-jurisdiction)
  - 2 Email Workers (billing contacts, renewal alerts)
  - 1 Renewal Alert Worker (contract expiration tracking)
  - 2 Webhook Workers (enterprise event delivery)
- Database connection pooling (max 5 per process = 90 total connections)
- Database optimizations (recursive CTEs, materialized views, hierarchical indices)

**Performance Targets (B2B Enterprise Workload):**

- **API throughput:** 200 req/sec (finance teams, complex queries with hierarchical joins)
- **Contract billing:** 40 invoices/sec (seat calculations + volume discounts)
- **Consolidated billing:** 15 consolidated invoices/sec (10 subsidiaries per parent)
- **PDF generation:** 48 enterprise PDFs/sec (complex templates with branding)
- **Tax calculations:** 320 calculations/sec (multi-jurisdiction, 2 workers × 2 threads)
- **Quarterly billing:** 10K accounts in 4 minutes (parallel batch processing)
- **Annual billing:** 50K accounts in 21 minutes (large batch with seat-based calc)
- **Hierarchical queries:** 80 queries/sec (3 levels deep, recursive CTEs)
- **Account hierarchy:** Support for 10K+ parent companies with 100K+ subsidiaries
- **Contract management:** 100K+ active enterprise contracts with renewal tracking
- **Month-end processing:** Complete billing for 50K accounts in under 30 minutes

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
