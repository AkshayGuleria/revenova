# API Endpoint Reference

Base: `http://localhost:5177/api`

## Phase 1 — Core

### Accounts
| Method | Path | Description |
|--------|------|-------------|
| POST | /accounts | Create enterprise account |
| GET | /accounts | List (paginated, filtered) |
| GET | /accounts/:id | Get with hierarchy |
| PUT | /accounts/:id | Update |
| DELETE | /accounts/:id | Soft delete |

### Contracts
| Method | Path | Description |
|--------|------|-------------|
| POST | /contracts | Create with seat-based terms |
| GET | /contracts | List (filter by account, status) |
| GET | /contracts/:id | Get details |
| PUT | /contracts/:id | Update |

### Products
| Method | Path | Description |
|--------|------|-------------|
| POST | /products | Create with pricing model |
| GET | /products | List |
| GET | /products/:id | Get with volume tiers |

### Invoices
| Method | Path | Description |
|--------|------|-------------|
| POST | /invoices | Create manual invoice |
| GET | /invoices | List (filter by account, status, contract) |
| GET | /invoices/:id | Get with line items |
| PUT | /invoices/:id | Update status |

## Phase 2 — Billing

| Method | Path | Description |
|--------|------|-------------|
| POST | /billing/generate | Generate from contract (queued) |
| POST | /billing/consolidated | Generate consolidated (queued) |
| GET | /jobs/:id | Check job status |

## Phase 4 — Enterprise Operations (planned)

| Method | Path | Description |
|--------|------|-------------|
| POST | /purchase-orders | Create PO |
| GET | /purchase-orders | List POs |
| PUT | /purchase-orders/:id/approve | Approve PO |
| GET | /credits/:accountId | Get credit limit/status |
| POST | /credits/:accountId/hold | Apply credit hold |

## Phase 5 — Analytics (planned)

| Method | Path | Description |
|--------|------|-------------|
| GET | /reports/revenue | Revenue by period |
| GET | /analytics/arr | Annual Recurring Revenue |
| GET | /analytics/mrr | Monthly Recurring Revenue |
