# Architecture Reference

## Technology Stack

- **Backend:** NestJS + TypeScript (Node.js ≥18)
- **Database:** PostgreSQL + Prisma ORM, recursive CTEs for hierarchical queries
- **Job Queue:** BullMQ + Redis
- **Scalability:** PM2 cluster (4 API processes) + Worker Threads (hybrid)
- **Payments:** Manual payment reconciliation (Stripe integration deferred)
- **Frontend:** React Router v7 (Remix) + shadcn/ui
- **Monorepo:** npm workspaces (`packages/revenue-backend`, `packages/revenue-frontend`)

## Scalability Architecture

- PM2 cluster mode — 4 API processes for I/O-bound operations
- BullMQ job queues — contract billing, PDF generation, emails, webhooks
- Worker Threads — CPU-intensive tasks (PDFs, tax calculations, consolidated billing)
- DB connection pooling — max 5 per process = 90 total connections

## Core DB Entities

| Entity | Purpose |
|--------|---------|
| `accounts` | Hierarchical (parent_account_id), max 5 levels |
| `contracts` | Multi-year, seat-based pricing |
| `contract_products` | Contract-to-product bindings with overrides |
| `contract_shares` | Shared contract access across accounts |
| `products` | Seat-based + volume-tiered pricing |
| `invoice_groups` | Organizational groupings (dept, cost center) |
| `invoices` | Linked to contracts, POs, invoice groups |
| `invoice_items` | Line item details with contract-product binding |
| `purchase_orders` | Enterprise procurement with approval workflow |
| `payments` | Payment records applied to invoices |
| `exchange_rates` | FX rates with source tracking |
| `tax_rates` | Tax rates by jurisdiction and category |
| `audit_log` | Immutable audit trail for all mutations |
| `webhook_endpoints` | Webhook registrations per account |
| `webhook_deliveries` | Per-event delivery attempts and status |

## Key Indices

- `idx_accounts_parent` on `accounts(parent_account_id)`
- `idx_contracts_end_date` on `contracts(end_date)`
- `idx_invoices_po` on `invoices(purchase_order_number)`
- Composite: `(account_id, contract_id, status, due_date)`

## Performance Targets

| Operation | Target |
|-----------|--------|
| API throughput | 200 req/sec |
| Contract billing | 40 invoices/sec |
| Consolidated billing | 15 invoices/sec |
| PDF generation | 48 PDFs/sec |
| Quarterly billing | 10K accounts / 4 min |
| Annual billing | 50K accounts / 21 min |
| Hierarchical queries | 80 queries/sec (3 levels deep) |

## DB Optimization Strategies

1. Recursive CTEs for hierarchy — depth capped at 5
2. Cache hierarchy (15 min TTL), product catalog (1h), exchange rates (24h), credit limits (5 min)
3. Batch: 500 contracts/billing job, 100 emails/batch
4. Stagger month-end billing days 1–5
5. Materialized views for ARR/MRR (refreshed daily)
6. Read replicas for analytics

## Integration Points

- **Auth server:** session-based auth at `http://localhost:5176`
- **Frontend:** API at `http://localhost:5177`
- **Redis:** `redis://localhost:6379`
