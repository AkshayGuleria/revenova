# Revenue Backend

B2B Enterprise Revenue Management Backend System built with NestJS, Fastify, and Prisma.

## Features

- **Framework:** NestJS with Fastify adapter (3x faster than Express)
- **Build Tool:** SWC (20x faster than TypeScript compiler)
- **Database:** PostgreSQL with Prisma ORM
- **API Documentation:** Auto-generated Swagger/OpenAPI
- **Validation:** Automatic DTO validation with class-validator
- **Testing:** Jest + Supertest (ADR-002)

## Prerequisites

- Node.js 20+
- Docker & Docker Compose (recommended)
- **OR** PostgreSQL 14+ and Redis 6+ (manual setup)

## Getting Started

### Option 1: Docker Setup (Recommended)

The easiest way to get started is using Docker Compose:

```bash
# 1. Start PostgreSQL and Redis
docker-compose up -d

# 2. Copy environment file
cp .env.example .env

# 3. Install dependencies
npm install

# 4. Run database migrations
npm run prisma:migrate

# 5. Generate Prisma client
npm run prisma:generate
```

**Docker Compose includes:**
- PostgreSQL 14 on port 5432
- Redis 6 on port 6379 (for Phase 2)
- Persistent data volumes
- Health checks
- Auto-restart on failure

**Useful Docker commands:**
```bash
# View logs
docker-compose logs -f postgres
docker-compose logs -f redis

# Stop services
docker-compose down

# Stop and remove volumes (⚠️ deletes data)
docker-compose down -v

# Check service health
docker-compose ps
```

### Option 2: Manual Database Setup

If you prefer to install PostgreSQL and Redis manually:

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your database credentials

# 3. Set Up Database
# Run Prisma migrations
npm run prisma:migrate

# Generate Prisma client
npm run prisma:generate

# (Optional) Open Prisma Studio to view data
npm run prisma:studio
```

### Start Development Server

```bash
npm run start:dev
```

Server will start on http://localhost:5177

- **API Documentation:** http://localhost:5177/api/docs
- **Liveness Probe:** http://localhost:5177/health/liveness
- **Readiness Probe:** http://localhost:5177/health/readiness

## Development Commands

```bash
# Development (with hot reload)
npm run start:dev

# Build for production (SWC - fast!)
npm run build

# Production mode
npm run start:prod

# Run tests
npm test

# Test with coverage
npm run test:cov

# E2E tests — these TRUNCATE the target database, so it must be a test database.
# setup/teardown refuse any database whose name lacks test/tests/e2e/ci.
DATABASE_URL="postgresql://revenue_local:<password>@localhost:5433/revenue_e2e_db?schema=public" \
  npm run test:e2e

# Lint and format
npm run lint
npm run format
```

## Prisma Commands

```bash
# Generate Prisma client
npm run prisma:generate

# Create and run migrations
npm run prisma:migrate

# Open Prisma Studio (GUI)
npm run prisma:studio

# Seed database
npm run prisma:seed
```

## Project Structure

```
revenue-backend/
├── src/
│   ├── common/
│   │   └── prisma/          # Prisma module
│   ├── modules/
│   │   ├── accounts/        # Accounts module (Phase 1)
│   │   ├── contracts/       # Contracts module (Phase 1)
│   │   ├── products/        # Products module (Phase 1)
│   │   ├── invoices/        # Invoices module (Phase 1)
│   │   └── billing/         # Billing engine (Phase 2)
│   ├── app.module.ts
│   ├── app.controller.ts
│   ├── app.service.ts
│   └── main.ts
├── docker/
│   └── postgres/
│       └── init.sql         # PostgreSQL initialization
├── prisma/
│   └── schema.prisma        # Database schema
├── test/                    # E2E tests
├── docker-compose.yml       # PostgreSQL + Redis setup
├── .dockerignore
├── package.json
├── nest-cli.json            # NestJS config (SWC enabled)
├── tsconfig.json
└── README.md
```

## Technology Stack

- **NestJS** 10+ - Backend framework
- **Fastify** - HTTP adapter (high performance)
- **Prisma** 5+ - Type-safe ORM
- **PostgreSQL** - Relational database
- **SWC** - Fast TypeScript compiler
- **Jest** - Testing framework
- **Supertest** - API testing
- **class-validator** - DTO validation
- **Swagger** - API documentation

## Performance

- **Build time:** 5-8 seconds (with SWC)
- **API throughput:** 30K+ req/sec (Fastify)
- **Target:** 200 req/sec for B2B enterprise workload

## Testing Strategy (ADR-002)

- **60% Unit tests** - Services, utilities, business logic (Jest)
- **30% Integration tests** - API endpoints (Supertest)
- **10% E2E tests** - Full user flows (Playwright - frontend repo)

**Minimum coverage:** 80% per module

## Architecture Decisions

See `docs/adrs/` for detailed architecture decisions:

- **ADR-001:** NestJS + Fastify + SWC framework selection
- **ADR-002:** Jest + Supertest testing strategy

## Development Phases

- **Phase 1 (Current):** Foundation - Accounts, Contracts, Products, Invoices CRUD
- **Phase 2:** Contract billing engine + Scalability (PM2, BullMQ, Worker Threads)
- **Phase 3:** Hierarchical accounts + Consolidated billing
- **Phase 4:** Purchase orders + Credit management + Payments
- **Phase 5:** Analytics + Renewal tracking + Webhooks

## Git Workflow

All development must follow feature branch workflow:

```bash
# Create feature branch
git checkout -b feature/accounts-crud-api

# Make changes and commit
git add .
git commit -m "feat: implement accounts CRUD endpoints"

# Merge to master (squash)
git checkout master
git merge --squash feature/accounts-crud-api
git commit -m "feat: implement accounts CRUD API"
```

See `.claude/git-workflow.md` for complete guidelines.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5177` |
| `NODE_ENV` | Environment | `development` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_URL` | Redis connection string | Phase 2 |
| `AUTH_SERVER_URL` | Auth server URL | `http://localhost:5176` |

## Database Schema

Phase 1 includes:

- **accounts** - Enterprise accounts with hierarchical support
- **contracts** - Multi-year contracts with seat-based pricing
- **products** - Product catalog with volume tiers
- **invoices** - Invoices linked to contracts
- **invoice_items** - Line items for invoices

See `prisma/schema.prisma` for complete schema.

## Contributing

1. Follow git workflow (feature branches only)
2. Write tests for all new code (80% coverage minimum)
3. Update API documentation (Swagger decorators)
4. Follow NestJS best practices (modules, services, controllers)

## License

UNLICENSED - Internal use only

## Support

For questions or issues:
- Check `.claude/CLAUDE.md` for project guidance
- Review ADRs in `docs/adrs/`
- Contact the development team
