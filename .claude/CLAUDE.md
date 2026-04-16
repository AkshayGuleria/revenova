# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **B2B Enterprise Revenue Management Backend System** designed for SaaS companies selling to large organizations with complex contracts, hierarchical account structures, and custom payment terms.

**Current Status:** Phase 3.5 (Product Pricing Enhancement) - COMPLETED ✅
Phases 1-3.5 implemented with full test coverage. Phase 4-5 planned.

## Architecture

### Technology Stack

- **Backend:** Express.js (Node.js)
- **Database:** PostgreSQL with recursive CTEs for hierarchical queries
- **Job Queue:** BullMQ + Redis for async operations
- **Scalability:** PM2 + Node.js Cluster + Worker Threads (hybrid approach)
- **Payments:** Stripe API + ACH (planned)

### Key Architectural Patterns

**Hybrid Scalability Architecture:**
- PM2 cluster mode (4 API processes) for I/O-bound operations
- BullMQ job queues for async work (contract billing, PDF generation, emails)
- Worker Threads for CPU-intensive tasks (PDFs, tax calculations, consolidated billing)
- Dedicated worker processes by job type (contract billing, PDF, tax, email, renewal alerts, webhooks)
- Database connection pooling (max 5 per process = 90 total connections)

**B2B-Specific Patterns:**
- **Hierarchical accounts** - Parent-child company relationships using recursive CTEs
- **Contract-based billing** - Multi-year commitments with seat-based licensing
- **Consolidated billing** - Roll-up invoices across subsidiaries
- **Credit limit enforcement** - Pre-invoice validation
- **Approval workflows** - Purchase order approvals, large deal reviews
- **Audit trail** - All financial mutations logged for compliance

### Database Schema Design (Phase 1)

Core B2B entities:
- `accounts` - Hierarchical structure with `parent_account_id`
- `contracts` - Multi-year deals with seat-based pricing
- `products` - Seat-based and volume-tiered pricing models
- `invoices` - Linked to contracts and purchase orders
- `invoice_items` - Line item details
- `purchase_orders` - Enterprise procurement workflows (Phase 4)

Key indices for B2B performance:
- `idx_accounts_parent` on `accounts(parent_account_id)` for hierarchy queries
- `idx_contracts_end_date` on `contracts(end_date)` for renewal tracking
- `idx_invoices_po` on `invoices(purchase_order_number)` for PO lookups
- Composite indices on `(account_id, contract_id, status, due_date)` for common queries

### Performance Targets (B2B Enterprise Workload)

- **API throughput:** 200 req/sec (complex hierarchical queries)
- **Contract billing:** 40 invoices/sec (seat calculations + volume discounts)
- **Consolidated billing:** 15 invoices/sec (10 subsidiaries per parent)
- **PDF generation:** 48 PDFs/sec (3 workers × 2 threads each)
- **Quarterly billing:** 10K accounts in 4 minutes
- **Annual billing:** 50K accounts in 21 minutes
- **Hierarchical queries:** 80 queries/sec (3 levels deep, recursive CTEs)

## Development Phases

The implementation follows a 5-phase approach (141 subtasks across 12 weeks):

1. **Phase 1: Foundation** (Weeks 1-2, 30 tasks) - ✅ **COMPLETED**
   - Enterprise account CRUD with hierarchical support
   - Contract management (single and multi-year deals)
   - Product catalog with seat-based pricing
   - Manual invoice creation
   - Payment terms configuration (Net 30/60/90)

2. **Phase 2: Contract-Based Billing** (Weeks 3-4, 44 tasks) - ✅ **COMPLETED**
   - Automated invoice generation from contracts
   - Seat-based billing with volume discounts
   - Quarterly/Annual billing in advance
   - Email notifications and PDF generation
   - **Hybrid scalability implementation** (PM2, BullMQ, Worker Threads)

3. **Phase 3: Hierarchical Accounts** (Weeks 5-6, 21 tasks) - ✅ **COMPLETED**
   - Parent-child company relationships (recursive traversal, max 5 levels)
   - Consolidated billing for subsidiaries
   - Hierarchy API endpoints (getHierarchy, getChildren, getAncestors, getDescendants)
   - BullMQ consolidated billing processor
   - Circular reference prevention
   - Multi-location billing address support

4. **Phase 4: Enterprise Operations** (Weeks 7-9, 23 tasks)
   - Purchase order management and tracking
   - Credit limit and credit hold management
   - Approval workflows for large deals
   - Payment processing and reconciliation
   - Multi-currency support and tax calculation

5. **Phase 5: Analytics & Optimization** (Weeks 10-12, 23 tasks)
   - Enterprise analytics (ARR, MRR, churn, bookings)
   - Contract renewal tracking and forecasting
   - SLA-based billing adjustments
   - Custom billing rules engine
   - Webhooks for enterprise events
   - Audit logging for compliance

**Phase 6+:** B2C event-based billing (usage metering, pay-as-you-go) - deferred to future

## Project Structure (Planned)

```
revenova/
├── docs/
│   └── feature-spec.md      # Complete 141-task specification
├── packages/                # Future monorepo
│   ├── revenue-backend/     # Express.js API server
│   │   ├── src/
│   │   │   ├── routes/      # accounts, contracts, products, invoices, billing, reports
│   │   │   ├── services/    # invoice-generator, billing-engine, seat-calculator, discount-engine
│   │   │   ├── jobs/        # contract-billing, renewal-alerts, dunning
│   │   │   ├── middleware/  # auth, validate, credit-check
│   │   │   └── utils/       # hierarchy, consolidated-billing, tax-calculator
│   │   └── migrations/      # PostgreSQL migrations
│   ├── workers/            # Dedicated BullMQ workers
│   │   ├── pdf-worker.js   # PDF generation with Worker Threads
│   │   ├── tax-worker.js   # Tax calculation with Worker Threads
│   │   └── email-worker.js # Email delivery
│   └── migrations/         # Database migrations
├── ecosystem.config.js     # PM2 configuration (API + workers)
└── README.md
```

## Key B2B Features

This system is built **B2B Enterprise-first**, not B2C:

- **Hierarchical Accounts** - Parent companies with multiple subsidiaries
- **Contract Management** - Multi-year commitment-based contracts
- **Seat-Based Licensing** - Per-user/license pricing with volume discounts
- **Purchase Order Workflows** - Enterprise procurement and approval flows
- **Credit Management** - Credit limits and holds
- **Consolidated Billing** - Roll-up invoices across subsidiaries
- **Flexible Billing** - Quarterly/Annual billing in advance
- **Custom Payment Terms** - Net 30/60/90 configurations
- **Renewal Tracking** - 90/60/30 day alerts before contract expiration

## Database Optimization Strategies

1. **Hierarchical Query Optimization**
   - Use recursive CTEs for parent-child traversal
   - Limit hierarchy depth to 5 levels (prevent infinite recursion)
   - Cache account hierarchy relationships (15 min TTL)
   - Consider materialized path pattern for deep hierarchies

2. **Indices for B2B Queries**
   - Composite index on `(parent_account_id, status)` for account trees
   - Index on `(end_date, auto_renew)` for renewal tracking
   - Composite index on `(account_id, contract_id, status, due_date)` for invoice queries
   - Index on `(po_number, status)` for procurement workflows

3. **Caching Strategy**
   - Product catalog (1 hour TTL)
   - Volume discount tiers (1 hour TTL)
   - Account hierarchy (15 min TTL, invalidate on update)
   - Exchange rates (24 hour TTL)
   - Credit limits (5 min TTL)
   - Tax rates (24 hour TTL)

4. **Batch Operations**
   - Process contract billing in batches of 500 contracts per job
   - Parallel processing of consolidated billing by parent account
   - Stagger month-end billing across days 1-5 to avoid peak load
   - Pre-generate PDFs 2-3 days before send date

5. **Materialized Views**
   - Pre-aggregated ARR/MRR calculations (refreshed daily)
   - Roll-up reporting across hierarchies
   - Customer health metrics

## API Implementation Rules

**Decision Reference:** [ADR-003: REST API Response Structure & Query Parameters](../docs/adrs/003-rest-api-response-structure.md)

### Response Structure (MANDATORY)

All REST API responses MUST follow this structure:

```typescript
{
  "data": T | T[],  // Single resource or array
  "paging": {
    "offset": number | null,
    "limit": number | null,
    "total": number | null,
    "totalPages": number | null,
    "hasNext": boolean | null,
    "hasPrev": boolean | null
  }
}
```

**Rules:**
- ✅ **Paginated list**: Fill all paging fields
- ✅ **Single resource**: All paging fields are `null`
- ✅ **Non-paginated list**: Only `total` filled, rest `null`
- ✅ **Error responses**: Use `{ error: {...} }` structure

### Query Parameter Operators (MANDATORY)

All list endpoints MUST use operator-based query parameters:

```bash
# Pagination (offset-based, SQL-friendly)
?offset[eq]=0&limit[eq]=20

# Equality
?status[eq]=active&accountType[eq]=enterprise

# Comparisons
?creditLimit[gt]=10000&creditLimit[lte]=100000
?createdAt[gte]=2024-01-01&createdAt[lte]=2024-12-31

# IN operator (comma-separated)
?status[in]=pending,overdue

# LIKE (case-insensitive substring)
?accountName[like]=acme

# NULL checks
?parentAccountId[null]=true
```

**Supported Operators:**
- `[eq]` - Equals (`=`)
- `[ne]` - Not equals (`!=`)
- `[lt]` - Less than (`<`)
- `[lte]` - Less than or equal (`<=`)
- `[gt]` - Greater than (`>`)
- `[gte]` - Greater than or equal (`>=`)
- `[in]` - In list (`IN (...)`)
- `[nin]` - Not in list (`NOT IN (...)`)
- `[like]` - Case-insensitive substring (`ILIKE`)
- `[null]` - Is null / not null (`IS NULL`)

### Pagination Rules

- Use **offset-based pagination** (SQL-friendly: `LIMIT x OFFSET y`)
- Default: `offset=0`, `limit=20`
- Maximum limit: `100`
- Always include `paging` object in response (even if `null`)

### HTTP Status Codes

- `200 OK` - Successful GET, PUT, PATCH
- `201 Created` - Successful POST
- `204 No Content` - Successful DELETE
- `400 Bad Request` - Validation errors
- `404 Not Found` - Resource not found
- `409 Conflict` - Duplicate resource
- `500 Internal Server Error` - Server errors

### TypeScript Interfaces (Use These)

```typescript
// Located in: src/common/interfaces/api-response.interface.ts

interface PagingObject {
  offset: number | null;
  limit: number | null;
  total: number | null;
  totalPages: number | null;
  hasNext: boolean | null;
  hasPrev: boolean | null;
}

interface ApiResponse<T> {
  data: T | T[];
  paging: PagingObject;
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    statusCode: number;
    timestamp: string;
    path: string;
    details?: Record<string, any>;
  };
}
```

### Implementation Utilities

- **Query Parser**: `src/common/utils/query-parser.ts` - Converts `field[op]=value` to Prisma filters
- **Response Builder**: `src/common/utils/response-builder.ts` - Creates consistent API responses
- **Base DTO**: `src/common/dto/pagination.dto.ts` - Reusable pagination parameters

## API Structure (Planned)

### Core Endpoints (Phase 1)

**Accounts:**
- `POST /api/accounts` - Create enterprise account
- `GET /api/accounts` - List accounts (pagination, filtering)
- `GET /api/accounts/:id` - Get account with hierarchy
- `PUT /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Soft delete account

**Contracts:**
- `POST /api/contracts` - Create contract with seat-based terms
- `GET /api/contracts` - List contracts (filter by account, status)
- `GET /api/contracts/:id` - Get contract details
- `PUT /api/contracts/:id` - Update contract

**Products:**
- `POST /api/products` - Create product with pricing model
- `GET /api/products` - List products
- `GET /api/products/:id` - Get product with volume tiers

**Invoices:**
- `POST /api/invoices` - Create invoice (manual)
- `GET /api/invoices` - List invoices (filter by account, status, contract)
- `GET /api/invoices/:id` - Get invoice with line items
- `PUT /api/invoices/:id` - Update invoice status

### Advanced Endpoints (Phase 2+)

**Billing:**
- `POST /api/billing/generate` - Generate invoice from contract (queued)
- `POST /api/billing/consolidated` - Generate consolidated invoice (queued)

**Job Management:**
- `GET /api/jobs/:id` - Check job status (PDF, billing, tax)

**Reporting (Phase 5):**
- `GET /api/reports/revenue` - Revenue by period
- `GET /api/analytics/arr` - Annual Recurring Revenue
- `GET /api/analytics/mrr` - Monthly Recurring Revenue

## Environment Variables (Planned)

```bash
# Server
PORT=5177
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/revenue_db
DB_POOL_MAX=5  # Connections per process

# Auth Integration
AUTH_SERVER_URL=http://localhost:5176

# Redis (Phase 2)
REDIS_URL=redis://localhost:6379

# Email (Phase 2)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=billing@example.com
SMTP_PASSWORD=secret

# Payment Gateway (Phase 5)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Worker Configuration (Phase 2)
THREAD_POOL_SIZE=2  # Worker Threads per process
```

## Integration Points

### Auth Server Integration
- Uses session-based authentication from auth-server (http://localhost:5176)
- Session validation middleware on all protected endpoints
- User context extracted from session token

### Revenue Frontend Integration
- Frontend consumes API at http://localhost:5177
- Dashboard displays contracts, invoices, and analytics
- Currently uses mock data - will migrate to real backend in Phase 1

## Important Technical Considerations

1. **ACID Compliance** - All financial operations use database transactions
2. **Audit Trail** - All mutations logged for SOC2/GDPR compliance
3. **Credit Limit Checks** - Validate before invoice generation
4. **PCI Compliance** - Never store credit card numbers (use Stripe tokenization)
5. **Row-Level Security** - Tenant isolation in multi-tenant scenarios
6. **Graceful Shutdown** - SIGTERM handlers for all processes and workers
7. **Job Retry Logic** - 3 attempts with exponential backoff
8. **Connection Pooling** - Carefully manage 90 total connections across workers

## B2B vs B2C Focus

This system is designed **B2B-first** for these reasons:
- Higher ARPC (Average Revenue Per Customer)
- More predictable revenue (annual contracts)
- Simpler to implement initially (no real-time event processing)
- Matches typical SaaS growth trajectory (B2B → B2B+B2C)

B2C features (usage-based billing, pay-as-you-go, self-service) are deferred to Phase 6+.

## Project Status Reports

When asked for project status, read docs in this order: `README.md`, then all files in `docs/features/`, then `docs/feature-spec.md`. Report status organized by Phase (Phase 1, Phase 2, etc.) with completion state and what's next.

Do NOT mark tasks complete without explicit user confirmation — especially avoid bulk sed/regex updates across phase boundaries.

## Agent Configuration

Agent definitions live in `.claude/agents/` as individual files (one agent per file), NOT in a single `agents.md`. When adding or modifying agents, create/edit files in that directory.

## Documentation Conventions

When updating task checkboxes or status fields in documentation:
- Use the **Edit tool** for each change individually — never `sed` or bulk regex replacements
- If more than 3 changes are needed, list them all and confirm before proceeding
- Never modify tasks outside the phase or scope explicitly requested

## Testing Strategy

- **Phase 1:** Unit tests for CRUD endpoints, contract validation, payment terms
- **Phase 2:** Integration tests for billing engine, job scheduler, email/PDF generation
- **Phase 3:** Hierarchical query testing, consolidated billing accuracy
- **Phase 4+:** PO workflows, credit enforcement, payment reconciliation, tax calculation

## Documentation

- **README.md** - Overview, quick start, development phases
- **docs/feature-spec.md** - Complete 141-task specification with:
  - Detailed architecture diagrams
  - Database schema with SQL examples
  - API endpoint specifications
  - Performance benchmarks and optimization strategies
  - Scalability implementation with code examples
  - PM2 ecosystem configuration
  - BullMQ queue setup and worker patterns
  - Progress log and decision history
- **docs/features/** - Feature-specific documentation (created upon feature implementation)

### Feature Documentation

**Completed Documentation:**
- ✅ `docs/features/accounts.md` - Phase 1 Accounts API
- ✅ `docs/features/contracts.md` - Phase 1 Contracts API
- ✅ `docs/features/products.md` - Phase 1 Products API
- ✅ `docs/features/invoices.md` - Phase 1 Invoices API
- ✅ `docs/features/billing.md` - Phase 2 Billing Engine
- ✅ `docs/features/hierarchical-accounts.md` - Phase 3 Hierarchical Accounts & Consolidated Billing

**MANDATORY:** When a new feature is implemented, you MUST create comprehensive feature documentation at `docs/features/<feature-name>.md`.

**Documentation Structure:**

Each feature document must include:

1. **Header Section:**
   - Status (Implemented/In Progress/Planned)
   - Phase (Phase 1-5)
   - Implementation Date
   - ADR Compliance references

2. **Overview:**
   - High-level description of the feature
   - Business context and use cases

3. **Database Schema:**
   - Prisma schema snippet
   - Key indices and constraints
   - Relationships to other entities

4. **API Endpoints:**
   - Complete endpoint documentation
   - Request/response examples (ADR-003 compliant)
   - Query parameter operators
   - Error responses
   - Validation rules

5. **Implementation Details:**
   - Project structure
   - Technology stack
   - Key features and business logic
   - Code examples for complex logic

6. **Testing:**
   - Test file location
   - Coverage percentage
   - Test scenarios covered
   - How to run tests

7. **Usage Examples:**
   - cURL examples for common operations
   - Example workflows

8. **Performance Considerations:**
   - Database optimization strategies
   - Caching strategy
   - Query optimization

9. **Security Considerations:**
   - Input validation
   - Data integrity
   - Error handling

10. **Future Enhancements:**
    - Planned improvements by phase
    - Advanced features

11. **Related Features:**
    - Links to related feature docs
    - Integration points

**Examples:**
- `docs/features/accounts.md` - Accounts API feature
- `docs/features/contracts.md` - Contracts API feature
- `docs/features/products.md` - Products API feature

**When to Create:**
- Immediately after implementing a new API/feature
- Before marking a task/phase as complete
- As part of the PR review checklist

## Key Constraints and Design Decisions

1. **Vertical Scaling First** - B2B benefits from powerful single servers (complex queries) before horizontal scaling
2. **Read Replicas** - For analytics/reporting to avoid blocking writes
3. **Month-End Peak Planning** - Most B2B billing on 1st of month, stagger across days 1-5
4. **Query Timeouts** - 30s max on complex hierarchical queries
5. **Hierarchy Depth Limit** - Cap at 5 levels to prevent infinite recursion
6. **Batch Size** - Process 500 contracts per billing job, 100 emails per batch
7. **Database Sharding** - By region if needed (North America, EMEA, APAC)
