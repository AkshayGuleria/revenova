# Feature Documentation Template

Create at: `docs/features/<feature-name>.md`
Create immediately after implementing a feature, before marking phase complete.

## Required Sections

1. **Header** — Status (one line: `Implemented` | `Partial — see README backlog` | `Planned`), Phase, Implementation Date, ADR Compliance. No task-tracker/checkbox tables — progress lives only in `README.md` → Development Phases
2. **Overview** — description, business context, use cases
3. **Database Schema** — Prisma schema snippet, indices, relationships
4. **API Endpoints** — full docs, request/response examples (ADR-003 compliant), query operators, error responses, validation rules
5. **Implementation Details** — project structure, tech, business logic, code examples
6. **Testing** — file location, coverage %, test scenarios, how to run
7. **Usage Examples** — cURL for common operations, workflows
8. **Performance** — DB optimization, caching strategy, query optimization
9. **Security** — input validation, data integrity, error handling
10. **Future Enhancements** — design ideas only, no status markers; unbuilt scope is tracked in `README.md` → Backlog
11. **Related Features** — links to related docs, integration points

## Examples
- `docs/features/accounts.md`
- `docs/features/contracts.md`
- `docs/features/billing.md`
