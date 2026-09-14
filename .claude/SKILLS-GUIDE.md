# Agent Skills Quick Reference

This guide shows how to invoke agents as skills for the Revenova project.

## Available Agent Skills

### 🧠 tommi - Architecture & Design
**Use for:** Technical brainstorming, architecture design, scalability decisions

```
Invoke with: tommi, [your request]

Examples:
- "tommi, design the webhook delivery system for Phase 5"
- "tommi, should we use recursive CTEs or closure table for hierarchies?"
- "tommi, review the consolidated billing architecture"
```

**Expertise:** System architecture, PostgreSQL optimization, B2B SaaS patterns, performance

---

### 📋 tapsa - Task Management
**Use for:** Breaking down features, tracking progress, managing dependencies

```
Invoke with: tapsa, [your request]

Examples:
- "tapsa, status" - Get current task status
- "tapsa, create tasks for [feature]"
- "tapsa, what's blocking frooti?"
```

**Tools:** TaskCreate, TaskUpdate, TaskList, TaskGet

**Responsibilities:**
- Break features into tasks
- Track progress and dependencies
- Coordinate agent work
- Enforce git workflow

---

### 🔧 biksi - Backend Development
**Use for:** Implementing APIs, business logic, database operations

```
Invoke with: biksi, [your request]

Examples:
- "biksi, implement purchase order API"
- "biksi, add credit limit validation to invoice creation"
- "biksi, optimize the hierarchical account query"
```

**Expertise:** NestJS, Prisma, PostgreSQL, BullMQ, B2B billing logic

**Current Tasks:**
- Phase 4: Purchase orders, credit management, payments
- Phase 5: Analytics, renewals, webhooks, audit logging

---

### 🛠️ habibi - Infrastructure & DevOps
**Use for:** Database setup, Docker, PM2, Redis, performance optimization

```
Invoke with: habibi, [your request]

Examples:
- "habibi, configure PM2 for webhook workers"
- "habibi, optimize PostgreSQL for analytics queries"
- "habibi, set up materialized views for ARR/MRR"
```

**Expertise:** PostgreSQL admin, Docker, PM2, Redis, infrastructure monitoring

---

### 🎨 frooti - Frontend Development & UI/UX
**Use for:** Building React components, UI polish, frontend integration

```
Invoke with: frooti, [your request]

Examples:
- "frooti, implement invoice creation form (Task #19-23)"
- "frooti, add analytics dashboard charts"
- "frooti, polish the purchase order UI"
```

**Tech Stack:** React Router 7, shadcn/ui, Tailwind CSS v4, TanStack Query v5

**Design Philosophy:** Designer-engineer hybrid - technical precision + aesthetic sensibility

**Current Tasks:**
- #19-23: Invoice creation feature
- #8: Phase 4 Frontend UI (PO, Credit, Payments)
- #16: Phase 5 Analytics Dashboard

---

### 🧪 riina - Backend Testing
**Use for:** Writing backend tests, ensuring code coverage

```
Invoke with: riina, [your request]

Examples:
- "riina, write tests for purchase order API"
- "riina, test the billing engine calculations"
- "riina, check test coverage for Phase 4"
```

**Expertise:** Jest, Supertest, @nestjs/testing, TDD

**Strategy:** 60% unit tests, 30% integration tests, 80%+ coverage

---

### ✅ piia - Frontend E2E Testing
**Use for:** Writing E2E tests, testing user flows, accessibility

```
Invoke with: piia, [your request]

Examples:
- "piia, write E2E tests for invoice creation"
- "piia, test the purchase order workflow"
- "piia, check accessibility of analytics dashboard"
```

**Expertise:** Playwright, React Testing Library, visual regression, a11y

**Strategy:** 10% E2E tests for critical user flows

**Recent Work:**
- ✅ Invoice creation E2E test suite (15 tests)
- ✅ Test report with gap analysis
- ✅ Playwright configuration

---

## Agent Coordination Patterns

### Feature Implementation Flow

1. **tapsa** - Create tasks and assign to agents
2. **tommi** - Design architecture (if complex)
3. **biksi** - Implement backend API
4. **riina** - Write backend tests
5. **frooti** - Build frontend UI
6. **piia** - Write E2E tests
7. **habibi** - Optimize infrastructure (if needed)
8. **tapsa** - Verify completion and close tasks

### Example: Invoice Creation Feature

```
User: "piia, invoice creation doesn't work"
↓
piia: Writes E2E tests first, identifies gaps
↓
User: "tapsa, create implementation tasks for frooti"
↓
tapsa: Creates 5 tasks (#19-23) for frooti
↓
User: "frooti, start implementation"
↓
frooti: Implements route, form, line items, API integration
↓
frooti: Runs E2E tests, fixes failures
↓
tapsa: Marks tasks complete ✅
```

---

## Git Workflow Enforcement

All agents **MUST** follow the git workflow:

1. **Never commit directly to master**
2. **Always create feature branches:**
   - `feat/` - New features
   - `fix/` - Bug fixes
   - `test/` - Test additions
   - `docs/` - Documentation
   - `chore/` - Infrastructure/setup

3. **Merge via squash:**
   ```bash
   git checkout master
   git merge --squash feat/your-feature
   git commit -m "feat: description"
   ```

**tapsa enforces this workflow for all agents.**

---

## Current Project Status

### ✅ Completed
- Phase 1: Foundation (Accounts, Contracts, Products, Invoices)
- Phase 2: Contract Billing + Scalability
- Phase 3: Hierarchical Accounts + Consolidated Billing
- Frontend: All CRUD modules with Revenova branding

### 🎯 Current Work
- **frooti:** Invoice creation feature (Tasks #19-23)
- **piia:** E2E tests written, awaiting implementation ✅

### 📋 Upcoming (Phase 4-5)
- Purchase orders, credit management, payments
- Analytics dashboard (ARR, MRR, churn)
- Renewal tracking, webhooks, audit logging

---

## Task Status Dashboard

Use `tapsa, status` to see:
- Total tasks: 23 (18 Phase 4-5 + 5 invoice creation)
- By agent: biksi (12), frooti (10), riina (2), piia (1), habibi (1)
- Blocked tasks: #23 (blocked by #19, #20, #21, #22)

---

## Quick Tips

### For Backend Work
```
tommi, review this architecture
↓
biksi, implement the API
↓
riina, write tests
↓
habibi, optimize if needed
```

### For Frontend Work
```
piia, write E2E tests first (TDD)
↓
tapsa, create implementation tasks
↓
frooti, implement UI
↓
piia, verify tests pass
```

### For Features
```
tapsa, break down [feature] into tasks
↓
[Assign to appropriate agents]
↓
tapsa, track progress
```

---

## Agent Skill Levels

| Skill | tommi | tapsa | biksi | habibi | frooti | riina | piia |
|-------|:-----:|:-----:|:-----:|:------:|:------:|:-----:|:----:|
| Architecture | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| Project Mgmt | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ |
| Backend Dev | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| Frontend Dev | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐ |
| UI/UX Design | ⭐⭐ | ⭐⭐ | ⭐ | ⭐ | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐ |
| Infrastructure | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐ | ⭐⭐ |
| Backend Testing | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| E2E Testing | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| B2B Billing | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

---

**Last Updated:** 2026-01-31
**Project:** Revenova - Revenue Intelligence Platform
**Status:** see `README.md` → Development Phases
