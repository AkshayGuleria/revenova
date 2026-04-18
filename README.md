# Revenova - Revenue Intelligence

```
╭──────────────────────────────────────────────────────────────────────────╮
│                                                                          │
│   ██████╗ ███████╗██╗   ██╗███████╗███╗   ██╗ ██████╗ ██╗   ██╗ █████╗   │
│   ██╔══██╗██╔════╝██║   ██║██╔════╝████╗  ██║██╔═══██╗██║   ██║██╔══██╗  │
│   ██████╔╝█████╗  ██║   ██║█████╗  ██╔██╗ ██║██║   ██║██║   ██║███████║  │
│   ██╔══██╗██╔══╝  ╚██╗ ██╔╝██╔══╝  ██║╚██╗██║██║   ██║╚██╗ ██╔╝██╔══██║  │
│   ██║  ██║███████╗ ╚████╔╝ ███████╗██║ ╚████║╚██████╔╝ ╚████╔╝ ██║  ██║  │
│   ╚═╝  ╚═╝╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═══╝ ╚═════╝   ╚═══╝  ╚═╝  ╚═╝  │
│                                                                          │
│                    Revenue Intelligence Platform                         │
│                                                                          │
╰──────────────────────────────────────────────────────────────────────────╯
```

**Enterprise-grade B2B billing platform** for SaaS companies with complex contracts, hierarchical accounts, and seat-based licensing.

## Overview

A complete revenue management system designed for B2B SaaS companies selling to large enterprises. Handles multi-year contracts, hierarchical account structures, consolidated billing, and custom payment terms.

**Current Status:** Phase 4 In Progress — Sub-Invoices & Invoice Groups (COMPLETED), Purchase Orders + Credit Management (PLANNED)

### Key Features

- 🏢 **Hierarchical Accounts** - Parent companies with multiple subsidiaries
- 📄 **Contract Management** - Multi-year commitment-based contracts
- 👥 **Seat-Based Licensing** - Per-user/license pricing with volume discounts
- 📋 **Purchase Order Workflows** - Enterprise procurement and approval workflows
- 💳 **Credit Management** - Credit limits and holds
- 🧾 **Consolidated Billing** - Roll-up invoices across subsidiaries
- 📅 **Flexible Billing** - Quarterly/Annual billing in advance
- 💰 **Custom Payment Terms** - Net 30/60/90 configurations

---

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Redis 6+ (for Phase 2)
- Docker & Docker Compose (recommended)

### Backend Setup

```bash
# Clone repository
git clone https://github.com/AkshayGuleria/revenova.git
cd revenova

# Backend setup
cd packages/revenue-backend
npm install
cp .env.example .env
# Edit .env with database credentials

# Generate Prisma client
npm run prisma:generate

# Run migrations (after PostgreSQL is running)
npm run prisma:migrate

# Start development server
npm run start:dev
```

Backend runs at <http://localhost:5177>

- **API Docs:** <http://localhost:5177/api/docs>
- **Liveness:** <http://localhost:5177/health/liveness>
- **Readiness:** <http://localhost:5177/health/readiness>

See [packages/revenue-backend/README.md](./packages/revenue-backend/README.md) for detailed backend setup.

### Frontend Setup

Frontend is built with React Router 7, located in `packages/revenue-frontend/`.

```bash
# Frontend setup (from repository root)
cd packages/revenue-frontend
cp .env.example .env
# Edit .env (VITE_API_URL=http://localhost:5177)

# Start development server
npm run dev:frontend

# Or start both backend + frontend
cd ../..
npm run dev
```

Frontend runs at `http://localhost:5173` and connects to backend at `http://localhost:5177`.

**Frontend Features (Implemented):**

- ✅ Dashboard with key metrics
- ✅ Account management UI with hierarchy visualization
- ✅ Contract management with seat-based pricing
- ✅ Product catalog with pricing models
- ✅ Responsive layout with collapsible sidebar
- ✅ Type-safe API integration with TanStack Query
- ✅ Form validation with React Hook Form + Zod
- ✅ Invoice generation, sub-invoices, and invoice groups
- 🚧 Billing operations dashboard (in progress)
- ⚪ Analytics and reporting (Phase 5, planned)

---

## Project Structure

```
revenova/
├── .claude/                    # AI agent configuration
│   ├── CLAUDE.md              # Project guidance for AI agents
│   ├── agents.md              # Team agent definitions
│   └── git-workflow.md        # Git workflow guidelines
│
├── docs/                      # Documentation
│   ├── adrs/                  # Architecture Decision Records
│   │   ├── 001-nestjs-fastify-swc-framework.md
│   │   ├── 002-backend-testing-framework.md
│   │   └── 003-rest-api-response-structure.md
│   ├── features/              # Feature documentation
│   │   ├── accounts.md
│   │   ├── contracts.md
│   │   ├── products.md
│   │   ├── invoices.md
│   │   ├── billing.md
│   │   └── hierarchical-accounts.md
│   └── feature-spec.md        # Complete 141-task specification
│
├── packages/                  # Monorepo packages
│   ├── revenue-backend/       # NestJS API server
│   │   ├── src/               # Source code
│   │   ├── prisma/            # Database schema & migrations
│   │   ├── test/              # Tests (Jest + Supertest)
│   │   └── README.md          # Backend documentation
│   │
│   └── revenue-frontend/      # React Router frontend
│       ├── app/               # Application code
│       │   ├── routes/        # File-based routing
│       │   ├── components/    # React components
│       │   ├── lib/           # API client & utilities
│       │   └── types/         # TypeScript type definitions
│       └── public/            # Static assets
│
└── README.md                  # This file
```

---

## Technology Stack

### Frontend

- **Framework:** React Router 7 (formerly Remix)
- **Language:** TypeScript 5 (strict mode)
- **UI Components:** shadcn/ui + Radix UI primitives
- **Styling:** Tailwind CSS v4
- **Data Fetching:** TanStack Query (React Query) v5
- **State Management:** Zustand
- **Forms:** React Hook Form + Zod validation
- **Icons:** Lucide React
- **Date Handling:** date-fns
- **Testing:** Vitest + React Testing Library (planned)

### Backend

- **Framework:** NestJS 10 with Fastify adapter
- **Language:** TypeScript 5
- **Build Tool:** SWC (20x faster than tsc)
- **Database:** PostgreSQL 14+ with Prisma ORM
- **Job Queue:** BullMQ + Redis (Phase 2)
- **Testing:** Jest + Supertest (80% coverage)

### Scalability (Phase 2)

- **PM2** - Process manager (cluster mode)
- **Node.js Cluster** - Multi-process for I/O scaling
- **Worker Threads** - Multi-threading for CPU tasks
- **BullMQ** - Queue system for async jobs

### Architecture Decisions

- **ADR-001:** [NestJS + Fastify + SWC Framework](./docs/adrs/001-nestjs-fastify-swc-framework.md)
- **ADR-002:** [Jest + Supertest Testing Strategy](./docs/adrs/002-backend-testing-framework.md)

---

## Development Phases

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1** | Foundation - Accounts, Contracts, Products, Invoices | ✅ Completed |
| **Phase 2** | Contract Billing + Scalability (PM2, BullMQ, Workers) | ✅ Completed |
| **Phase 3** | Hierarchical Accounts + Consolidated Billing | ✅ Completed |
| **Phase 3.5** | Product Pricing Enhancement (chargeType, category, setupFee) | ✅ Completed |
| **Phase 4** | Sub-Invoices + Invoice Groups + Purchase Orders + Credit Management | 🚧 In Progress |
| **Phase 5** | Analytics + Renewal Tracking + Webhooks | ⚪ Planned |
| **Phase 6+** | B2C Event-Based Billing | 🔵 Deferred |

See [docs/feature-spec.md](./docs/feature-spec.md) for complete task breakdown.

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| **API throughput** | 200 req/sec | Complex hierarchical queries |
| **Contract billing** | 40 invoices/sec | Seat calculations + volume discounts |
| **Consolidated billing** | 15 invoices/sec | 10 subsidiaries per parent |
| **PDF generation** | 48 PDFs/sec | 3 workers × 2 threads each |
| **Quarterly billing** | 10K accounts in 4 min | Parallel batch processing |
| **Annual billing** | 50K accounts in 21 min | Large batch with seat-based calc |

---

## Team & Workflow

### Agent Team

| Agent | Role | Current Work |
|-------|------|--------------|
| **tommi** | Architecture & Brainstorming | Design reviews, problem solving |
| **tapsa** | Task Manager & Tracker | Coordinate work, track progress |
| **biksi** | Backend Development | NestJS API implementation |
| **riina** | Backend Testing | Jest unit + Supertest integration tests |
| **habibi** | Infrastructure & DevOps | Docker, PostgreSQL, Redis, PM2 |
| **frooti** | Frontend Development | React UI (Phase 1) |
| **piia** | Frontend Testing | Playwright E2E tests |

See [.claude/agents.md](./.claude/agents.md) for detailed agent responsibilities.

### Git Workflow

All development follows **feature branch workflow**:

```bash
# Create feature branch
git checkout -b feature/accounts-crud-api

# Develop and commit
git add .
git commit -m "feat: implement accounts CRUD endpoints"

# Merge to master (squash)
git checkout master
git merge --squash feature/accounts-crud-api
git commit -m "feat: implement accounts CRUD API"
```

**🚨 NEVER commit directly to master**

See [.claude/git-workflow.md](./.claude/git-workflow.md) for complete guidelines.

---

## Documentation

### For Developers

- **[Backend Setup](./packages/revenue-backend/README.md)** - NestJS backend setup and development
- **[Git Workflow](./.claude/git-workflow.md)** - Branching strategy and commit guidelines
- **[Feature Spec](./docs/feature-spec.md)** - Complete 141-task specification

### For AI Agents

- **[CLAUDE.md](./.claude/CLAUDE.md)** - Project guidance for Claude Code
- **[Agents](./.claude/agents.md)** - Agent team definitions and coordination

### Architecture Decisions

- **[ADR Index](./docs/adrs/README.md)** - All architecture decision records
- **[ADR-001](./docs/adrs/001-nestjs-fastify-swc-framework.md)** - Framework selection
- **[ADR-002](./docs/adrs/002-backend-testing-framework.md)** - Testing strategy

---

## Testing Strategy

Following ADR-002 testing pyramid:

### Backend Testing

- **60% Unit Tests** (Jest) - Services, utilities, business logic
- **30% Integration Tests** (Supertest) - API endpoints, database operations
- **Minimum Coverage:** 80% per module

```bash
# Backend tests (in packages/revenue-backend/)
npm test                # Unit tests
npm run test:e2e        # Integration tests
npm run test:cov        # Coverage report
```

### Frontend Testing

- **10% E2E Tests** (Playwright) - Critical user flows through UI
- Tests complete workflows: UI → Backend API → Database
- Located in separate Revenue app repository

**Testing Agents:**

- **riina** - Backend testing (Jest + Supertest)
- **piia** - Frontend testing (Playwright E2E)

---

## Database Schema

Phase 1 includes:

- **accounts** - Hierarchical enterprise accounts
- **contracts** - Multi-year seat-based contracts
- **products** - Product catalog with volume tiers
- **invoices** - Invoices linked to contracts
- **invoice_items** - Invoice line items

See [packages/revenue-backend/prisma/schema.prisma](./packages/revenue-backend/prisma/schema.prisma) for complete schema.

---

## Contributing

### Development Process

1. **Check out a feature branch** (required)

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Write code with tests**
   - Unit tests for services
   - Integration tests for APIs
   - Minimum 80% coverage

3. **Commit following conventions**

   ```
   feat: add new feature
   fix: fix bug
   test: add tests
   docs: update documentation
   ```

4. **Merge via squash**

   ```bash
   git checkout master
   git merge --squash feature/your-feature-name
   git commit -m "feat: descriptive message"
   ```

5. **Push to remote**

   ```bash
   git push origin master
   ```

### Code Quality

- Follow NestJS best practices
- Use TypeScript strict mode
- Write descriptive commit messages
- Include tests with all PRs
- Update documentation

---

## API Documentation

Once running, access auto-generated Swagger documentation:

**<http://localhost:5177/api/docs>**

### Key Endpoints (Phase 1)

**Accounts:**

- `POST /api/accounts` - Create account
- `GET /api/accounts` - List accounts
- `GET /api/accounts/:id` - Get account details
- `PUT /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Delete account

**Contracts:**

- `POST /api/contracts` - Create contract
- `GET /api/contracts` - List contracts
- `GET /api/contracts/:id` - Get contract details

**Invoices:**

- `POST /api/invoices` - Create invoice
- `GET /api/invoices` - List invoices
- `GET /api/invoices/:id` - Get invoice with line items

**Frontend Integration:**
The Revenue app (React) consumes these REST APIs to provide a dashboard for finance teams to manage accounts, contracts, and invoices.

See backend README for complete API reference.

---

## Environment Variables

```bash
# Server
PORT=5177
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/revenue_db

# Redis (Phase 2)
REDIS_URL=redis://localhost:6379

# Auth Integration
AUTH_SERVER_URL=http://localhost:5176
```

See [packages/revenue-backend/.env.example](./packages/revenue-backend/.env.example) for complete list.

---

## Performance & Scalability

Built for enterprise scale:

- **Hybrid scalability:** PM2 cluster + Worker Threads + BullMQ queues
- **Database optimization:** Recursive CTEs, materialized views, strategic indices
- **Caching strategy:** Product catalog, volume tiers, account hierarchies
- **Batch operations:** Process 500 contracts per job, 100 emails per batch

See feature spec for detailed performance benchmarks.

---

## License

UNLICENSED - Internal use only

---

## Support & Contact

- **Issues:** GitHub Issues
- **Documentation:** `docs/` directory
- **Architecture:** `docs/adrs/` directory
- **AI Guidance:** `.claude/CLAUDE.md`

---

**Built with:** NestJS • Fastify • Prisma • PostgreSQL • TypeScript • SWC

**Status:** ✅ Phases 1-3.5 + Phase 4 (Sub-Invoices) Completed | Phase 4 (POs, Credit) + Phase 5 Planned
