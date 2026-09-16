---
name: phase-audit
description: Use this skill to run an end-to-end security and correctness audit of a completed phase (or the whole solution) before declaring it done, before a release, or when docs claim more than the code delivers. Dispatches parallel read-only domain audits, verifies every critical finding against source, and produces a dated review doc plus a P0 task list.
origin: project
---

# Phase Audit

A repeatable review that answers one question: **does the code actually do what we claim it does,
and can it be attacked?** Designed to be re-run per phase. First run: 2026-09-16
(`docs/reviews/2026-09-16-security-and-correctness-audit.md`) — 12 P0s in phases marked complete.

## When to Activate

- A phase is about to be marked complete, or was marked complete without verification
- Before a production release or a security sign-off
- Docs/status claims look ahead of reality ("all phases complete" with unticked criteria)
- After a burst of parallel agent work, where nobody read the whole result
- Periodically on the money paths, even when nothing changed

## Core Rules

1. **Read-only.** The audit never edits, stages, or commits source. Fixes are separate work on a
   separate branch, after a human picks priorities.
2. **Evidence before assertion.** Every finding cites `file:line` and a concrete failure or exploit
   scenario. "Looks unsafe" is not a finding. Never infer behavior from a filename, a doc or a test name.
3. **Verify the criticals yourself.** Subagent output is a lead, not a conclusion. Re-read the cited
   lines for every P0 before it reaches the user or a doc.
4. **Minor issues are noise.** Style, naming and formatting are out of scope — they bury the real findings.
5. **Docs may be wrong.** Treat `README`/feature docs as claims to test, not as ground truth.

## Step 1 — Scope and survey

Decide the scope (one phase's modules, or the whole solution) and size it first:

```bash
find packages/revenue-backend/src -name '*.ts' -not -name '*.spec.ts' | xargs wc -l | tail -1
for d in packages/revenue-backend/src/modules/*/; do \
  printf "%-24s %s\n" "$(basename $d)" "$(find $d -name '*.ts' | xargs cat | wc -l)"; done
ls packages/revenue-backend/test/
```

Also note what the docs currently claim for that scope (`README.md` → Development Phases), so the audit
can confirm or refute each claim.

## Step 2 — Dispatch the domains in parallel

Issue **all agent calls in a single message** so they run concurrently. Use `model: sonnet`
(CLAUDE.md model routing — Opus is off-limits; this work needs reasoning, so not Haiku).
One agent per domain, no shared state:

| # | Domain | Hunts for |
|---|--------|-----------|
| 1 | Auth & API surface | Missing guards, tenancy/object-level access, mass assignment, CORS, validation pipe gaps, error leakage, SSRF, secrets, Swagger exposure |
| 2 | Financial correctness | Decimal vs float, transaction boundaries, read-then-write races, idempotency, rounding, tier/proration math, hardcoded zeros, unreachable pricing features |
| 3 | Data layer | Query-parser/filter injection and field whitelisting, pagination caps, recursive CTE + depth/cycle guards, statement timeouts, constraints, indexes, cascade deletes, schema/migration drift, pool limits |
| 4 | Queues & lifecycle | Queues with no consumer, retry-induced duplication, partial-failure semantics, dead-letter/alerting, shutdown hooks, worker isolation, Redis failure behavior |
| 5 | Frontend | Token storage, XSS, CSRF, client-computed money, timezone handling on date-only fields, double-submit, silent failures, inert controls |
| 6 | Tests, config & deploy | Over-mocked money-path specs, destructive test setup, skipped suites, CI gates, env vars documented but unread, unsafe defaults, startup migrations |

Adapt the list to the phase under review: a UI-only phase can drop domain 3; a billing phase should
split domain 2 across two agents rather than stretch one thin.

### Agent prompt template

```
READ-ONLY audit. Do not edit, create, stage, or commit any file.
Repo: <path>, <stack summary>. Ignore .claude/worktrees/ and node_modules.

SCOPE: <domain and why it matters for this product>

Project rules that must hold (from CLAUDE.md): <the relevant constraints>

Known context (verify, don't just repeat): <already-known gaps, so the agent goes past them>

Investigate and verify in code:
- <8-15 specific, checkable questions naming real paths>

Method: grep + read the actual files. Verify every claim by reading code — never infer from
names or docs. Ignore minor style issues.

OUTPUT (markdown, no preamble): a table, most severe first:
| Severity (CRITICAL/HIGH/MEDIUM) | Issue | file:line | Concrete failure scenario | Suggested fix (1 line) |
Max 12 findings. Then "Checked but clean: ...". State explicitly what you could not verify.
```

The "Known context" line matters: without it agents spend their budget rediscovering the gap you
already know about, and report it as their headline.

## Step 3 — Verify before reporting

For each CRITICAL/HIGH, open the cited lines yourself:

```bash
sed -n '<start>,<end>p' <file>            # read the actual code path
grep -rn '<symbol>' packages/*/src --include='*.ts' --exclude='*.spec.ts'   # confirm a "never called" claim
```

Typical corrections this catches: a "missing" check that exists on another path; a guard that is wired
to exactly one route; a feature that exists but is unreachable because a parameter is hardcoded `null`.
Downgrade or drop anything you cannot confirm, and say so.

## Step 4 — Severity

- **P0** — exploitable by an unauthenticated caller, or silently produces wrong money/data.
  Includes: anything reporting success while doing nothing; anything destroying data.
- **P1** — serious defect or missing control; fix before production, not exploitable alone.
- **P2** — real but contained: UX-visible bugs, coverage gaps, drifted docs/config.

A stub that returns success is P0, not P1. Users and logs both believe it worked.

## Step 5 — Output

Two artifacts, and no third:

1. **`docs/reviews/<YYYY-MM-DD>-<scope>.md`** — findings with evidence, grouped P0/P1/P2, plus
   "Verified clean", "Untested critical behaviors" and "Not verified" sections. State the audited commit.
   This is a **dated record, not a tracker**: never update it as items are fixed.
2. **`README.md` → a "Must fix" section above the Backlog** — P0s as checkboxes, P1/P2 summarized with a
   pointer to the review doc. This is the single source of truth per CLAUDE.md; do not create a second
   tracker, and do not copy findings into MEMORY.md or feature docs.

If the audit contradicts the phase table, correct the table (e.g. ✅ → 🟡 Partial) and say so plainly in
your summary — that contradiction is the most valuable output of the whole exercise.

## Step 6 — Sequence the fixes

Order by *blast radius and cheapness*, not by severity number:

1. Cheap guards that protect developers and data right now (e.g. a test-setup DB check).
2. Controls that must ship together (auth + tenancy scoping + rate limiting + doc-console gating).
3. Input-trust fixes (restricted DTOs, filter whitelists, server-side recomputation of money).
4. Concurrency and correctness fixes, each with a test that fails first (see `tdd-workflow`).
5. Whole-workstream rebuilds (a billing engine missing tax, fees and tiers is one project, not four tickets).

Present the list and stop. Do not start fixing during an audit — priorities are the user's call.

## Anti-Patterns

| Anti-pattern | Why it fails |
|--------------|--------------|
| One agent audits everything | Runs out of budget, returns shallow generalities |
| Sequential agents | Wastes wall-clock time for zero gain; domains are independent |
| Reporting agent output verbatim | Agents overstate; unverified P0s destroy trust in the whole report |
| Including minor/style findings | Buries the exploitable ones |
| Marking tasks complete from the audit | CLAUDE.md forbids it without explicit user confirmation |
| Editing the review doc later | It is a dated snapshot; the README tracks what is still open |
| Fixing while auditing | Mixes unreviewed changes into a read-only pass |
