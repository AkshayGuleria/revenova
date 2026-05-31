# Revenova AI-Assisted SDLC Workflow

**Purpose:** Reference doc for the automated development workflow powered by ECC (Everything Claude Code).
This doc is for human reference only — not loaded by agents or hooks.

---

## Table of Contents

1. [Overview](#overview)
2. [Where to Start a Session](#where-to-start-a-session)
3. [The SDLC Pipeline](#the-sdlc-pipeline)
4. [Installed Components](#installed-components)
5. [Memory Persistence](#memory-persistence)
6. [Pre-Commit Quality Gate](#pre-commit-quality-gate)
7. [Token Optimization](#token-optimization)
8. [Model Routing Strategy](#model-routing-strategy)
9. [Resuming After Token Limit](#resuming-after-token-limit)
10. [Parallel Feature Development (Worktrees)](#parallel-feature-development-worktrees)
11. [Troubleshooting](#troubleshooting)
12. [Maintaining the Workflow](#maintaining-the-workflow)

---

## Overview

This workflow wraps Claude Code with three layers of automation:

1. **Structural context optimization** — CLAUDE.md trimmed to rules-only; reference content in `docs/reference/` loaded on demand
2. **Memory persistence** — session state auto-saved on stop, auto-loaded on start via hooks in `settings.local.json`
3. **Quality enforcement** — pre-commit git hook blocks bad commits; ECC skills enforce TDD, review, and planning discipline

Combined with **Caveman mode** (active globally), this reduces token usage by approximately 80% compared to vanilla Claude Code with a full CLAUDE.md.

---

## Where to Start a Session

**Always open Claude Code from:** `~/work/revenue-mgmt/`

This ensures:
- `CLAUDE.md` is loaded automatically (project rules + API contracts)
- `settings.local.json` is picked up (hooks + permissions)
- `SessionStart` hook fires and injects `MEMORY.md` into context

```bash
cd ~/work/revenue-mgmt
claude
```

Never start from a subdirectory (`packages/revenue-backend`) — Claude won't load the project-level config.

---

## The SDLC Pipeline

Every feature follows this sequence:

```
/plan → /tdd → implement → /code-review → /checkpoint → PR
```

### Step 1: `/plan`

Invoke before writing any code. The `architect` or `code-architect` subagent breaks the feature into:
- Subtasks with clear acceptance criteria
- DB schema changes needed
- API endpoints to add/modify
- Test scenarios to cover

**Why first:** Planning tokens are cheap. Rework tokens are expensive.

### Step 2: `/tdd`

Invokes the `tdd-workflow` skill. Forces red → green → refactor discipline:
1. Write failing test first
2. Write minimal code to pass
3. Refactor with tests green

Uses the `tdd-guide` agent for complex logic. Never skip for business logic in services or billing calculations.

### Step 3: Implement

Write the actual feature code guided by the plan and tests. Claude loads skills on demand:
- `nestjs-patterns` — module/service/controller structure
- `backend-patterns` — error handling, middleware, guards
- `prisma-patterns` — queries, transactions, relations
- `database-migrations` — Prisma migration workflow
- `api-design` — REST conventions, response shapes (ADR-003)

All code must follow the mandatory API rules in `CLAUDE.md` — response shape, query operators, pagination defaults.

### Step 4: `/code-review`

Invokes `code-reviewer` agent in an **isolated subagent context** (does not pollute main conversation window). With Caveman active, review output uses `caveman-review` format:

```
src/modules/po/po.service.ts:47 — no transaction guard — wrap in prisma.$transaction()
src/modules/po/po.controller.ts:23 — missing DTO validation — add @IsUUID() decorator
```

Each finding = one line: location, problem, fix. A full PR review produces ~20 lines instead of 200.

For security-sensitive changes, also run `/security-scan` (AgentShield integration via ECC).

### Step 5: `/checkpoint`

Compacts the conversation context before it grows too large. Also writes a session summary to `.claude/memory/MEMORY.md`. Run:
- Before any long implementation session
- After finishing a logical chunk (e.g., completing PO CRUD before starting approval workflows)
- Before switching features

This prevents context window exhaustion and ensures the next session loads current state.

### Step 6: PR

Create PR via `gh pr create`. PR body writes in **normal prose** (Caveman is auto-disabled for PRs per hard rule). Before creating:

```bash
npm run test --workspace=packages/revenue-backend
npm run typecheck --workspace=packages/revenue-frontend
```

The pre-commit hook covers this on each commit, but run the full suite before PR to catch integration issues.

---

## Installed Components

### ECC Skills (`~/.claude/skills/` → `.claude/skills/`)

| Skill | When to Use |
|-------|-------------|
| `nestjs-patterns` | Creating modules, services, controllers, guards |
| `backend-patterns` | Error handling, middleware, interceptors |
| `api-design` | REST conventions, versioning, response contracts |
| `database-migrations` | Any Prisma schema change or migration |
| `prisma-patterns` | Complex queries, transactions, upserts, relations |
| `tdd-workflow` | Business logic, billing calculations, services |
| `e2e-testing` | End-to-end flows, Playwright/Supertest setup |

### Subagents (`.claude/agents/`)

See `.claude/agents/` for the full list. Key ones:
- `code-reviewer` — isolated review context, outputs findings only
- `architect` / `code-architect` — planning and design decisions
- `doc-updater` — updates feature docs after implementation

### Hooks (`settings.local.json`)

| Event | Script | What it does |
|-------|--------|-------------|
| `SessionStart` | inline node | Prints `MEMORY.md` into context (capped 2000 chars) |
| `Stop` | `.claude/hooks/session-end.js` | Appends timestamped entry to `MEMORY.md` session log |

---

## Memory Persistence

### How it works

```
Session starts
  → SessionStart hook fires
  → Reads .claude/memory/MEMORY.md
  → Prints first 2000 chars into Claude's context
  → Claude knows: current phase, key decisions, active work

During session
  → /checkpoint writes summary to MEMORY.md "Active Work" section
  → Manual: ask Claude to update MEMORY.md when phase changes

Session ends
  → Stop hook fires (.claude/hooks/session-end.js)
  → Appends timestamped session log entry to MEMORY.md
```

### Updating MEMORY.md

The Stop hook writes timestamps only. Meaningful state updates (phase completion, new decisions) need to be written manually or via `/checkpoint`. After completing Phase 4, update the `## Active Work` and `## Completed Phases` sections in `.claude/memory/MEMORY.md`.

### Memory file location

```
.claude/memory/MEMORY.md   ← loaded every session start
```

Keep this file under ~3000 chars. The SessionStart hook caps at 2000 chars — content beyond that is silently truncated.

---

## Pre-Commit Quality Gate

Git hook at `.git/hooks/pre-commit`. Fires automatically on every `git commit`.

### What it checks (per changed package)

**Backend (`packages/revenue-backend/`):**
1. TypeScript compile check (`npx tsc --noEmit`)
2. ESLint (`npm run lint`)
3. Unit tests (`npm test -- --passWithNoTests --testPathIgnorePatterns=e2e`)

**Frontend (`packages/revenue-frontend/`):**
1. TypeScript compile check (`npm run typecheck`)

### Key behaviour

- Only runs checks for packages with staged changes — no full rebuild on every commit
- Exits non-zero and blocks the commit on any failure
- Error output tells you exactly which check failed and how to fix it

### Bypassing (use sparingly)

```bash
git commit --no-verify -m "wip: ..."   # skips hook
```

Only use for work-in-progress commits on feature branches. Never bypass on main.

---

## Token Optimization

Three mechanisms operate on different token types:

### 1. CLAUDE.md Slimming (Input — System Prompt)

| | Before | After | Saving |
|---|--------|-------|--------|
| CLAUDE.md | 20,202 bytes (~5,050 tokens) | 3,513 bytes (~878 tokens) | **~4,172 tokens/turn** |

This is a structural saving — compounded across every single turn of every session. Reference content moved to `docs/reference/` and loaded only when needed.

**50-turn session saving:** ~208,600 input tokens ≈ **$0.63**

### 2. Memory Persistence (Input — Context Re-establishment)

Without memory: ~5–10 minutes re-explaining project state at the start of each session, consuming 1,000–3,000 tokens of re-establishment prompts.

With `MEMORY.md` loaded via `SessionStart`: context established in ~500 tokens automatically.

**Per-session saving:** ~1,500–2,500 tokens of user re-prompting.

### 3. Caveman Mode (Output — Response Compression)

Reduces Claude's response token count by ~75% via fragment-style prose. Code blocks are never compressed.

**50-turn session saving (300 token avg response):** ~11,250 output tokens ≈ **$0.17**

Output tokens cost ~3–5× more than input tokens, making caveman disproportionately effective per token saved.

### Combined effect per 50-turn session

| Mechanism | Tokens saved | Cost saved (approx) |
|-----------|-------------|---------------------|
| CLAUDE.md slimming | ~208,600 input | ~$0.63 |
| Memory persistence | ~2,000 input | ~$0.006 |
| Caveman mode | ~11,250 output | ~$0.17 |
| **Total** | | **~$0.80/session** |

Beyond cost — smaller context = more room before compaction = fewer context loss events.

### On-demand loading

Reference docs (`docs/reference/`) are never auto-loaded. Claude reads them only when a relevant task requires it:
- Implementing a new endpoint → reads `api-endpoints.md`
- Changing DB schema → reads `architecture.md`
- Adding env var → reads `env-vars.md`
- Writing feature doc → reads `feature-doc-template.md`

---

## Model Routing Strategy

> **Plan constraint: 200k token limit. Opus is off-limits — it burns tokens 3× faster than Sonnet for marginal gains on this codebase.**

Use Haiku or Sonnet only:

| Task | Model | Reason |
|------|-------|--------|
| `/checkpoint` summaries | **Haiku** | Simple summarization |
| Boilerplate (DTOs, controllers, migrations) | **Haiku** | Pattern-following, no reasoning needed |
| Simple CRUD scaffolding | **Haiku** | Mechanical work |
| `/plan` for new features | **Sonnet** | Needs context + trade-off reasoning |
| `/tdd` test design | **Sonnet** | Context-aware, multi-step |
| Architecture decisions | **Sonnet** | Capable enough; Opus not justified |
| `/code-review` (including security) | **Sonnet** | Sufficient for this codebase |
| Debugging complex billing logic | **Sonnet** | Multi-step reasoning, within Sonnet capability |

Switch model in Claude Code: `/model` command.
Default session model is Sonnet — only drop to Haiku for explicitly mechanical tasks.

---

## Resuming After Token Limit

The 200k plan limit refreshes on a schedule. When Claude Code stops mid-work, the goal is to lose zero context on resume.

### Warning signs you're approaching the limit

- Context compaction fires more frequently (Claude auto-compacts conversation)
- Responses slow or truncate unexpectedly
- Claude starts forgetting earlier conversation turns

### Before-stop checklist (run when you see warning signs)

1. **Commit all stable work** — even partial features if tests pass:
   ```bash
   git add packages/revenue-backend/src/modules/po/
   git commit -m "feat(po): add PO service skeleton with CRUD"
   ```
   If tests fail, stash instead:
   ```bash
   git stash push -m "wip: po-approval-workflow mid-implementation"
   ```

2. **Run `/checkpoint`** — compacts conversation, writes summary to MEMORY.md

3. **Update MEMORY.md `## Active Work` and `## Resume Point → In progress`** manually:
   ```
   In progress: implementing PO approval workflow — po.service.ts:approvePurchaseOrder()
   next: wire up BullMQ job for approval notifications (see po.module.ts)
   ```

4. Close Claude Code — the `Stop` hook fires automatically and writes git state to `## Resume Point`

### What the Stop hook captures automatically

On every session end, `.claude/hooks/session-end.js` updates `## Resume Point` in MEMORY.md with:
- Current branch name
- Last commit (hash + message)
- All modified/staged files (`git status --short`)

This means even if you forget the checklist, the next session knows exactly what files were in flight.

### On resume (after limit refreshes)

1. Open Claude Code from `~/work/revenue-mgmt/`
2. `SessionStart` hook fires — MEMORY.md loads automatically including `## Resume Point`
3. Claude reads: branch, last commit, modified files, in-progress note
4. Prompt to continue: _"Resume from where we stopped — check MEMORY.md Resume Point"_

No re-explaining needed. Git state + MEMORY.md together reconstruct full context in one turn.

### If stash was used

```bash
git stash list          # see what's stashed
git stash pop           # restore WIP, then continue
```

Mention to Claude that you're popping a stash — it will re-read the modified files.

### Minimising limit hits

- Use Haiku for mechanical tasks (DTOs, migrations, boilerplate) — burns 3× fewer tokens than Sonnet
- Run `/checkpoint` proactively every ~30 turns, not reactively
- Keep MEMORY.md under 3000 chars (SessionStart cap is 2000 chars — anything beyond is truncated)
- Avoid pasting large file contents into prompts — ask Claude to read them with file paths instead

---

## Parallel Feature Development (Worktrees)

For implementing two Phase 4 features simultaneously (e.g., Purchase Orders + Credit Management):

```bash
# Create worktree for PO feature
git worktree add ../revenova-po feature/phase4-purchase-orders

# Create worktree for credit feature
git worktree add ../revenova-credit feature/phase4-credit-management
```

Open separate Claude Code sessions in each worktree. Benefits:
- Isolated contexts — no cross-feature confusion
- Parallel progress without branch switching
- Each session has its own conversation and tool output history

Merge back to main via PRs when each feature is complete.

**Note:** `.git/hooks/pre-commit` applies to both worktrees automatically (shared `.git`).

---

## Troubleshooting

### SessionStart hook not loading memory

Check `settings.local.json` has the `hooks.SessionStart` entry. Verify the MEMORY.md path is absolute:
```
~/.claude/memory/MEMORY.md  ✗ (tilde not expanded in hooks)
/Users/akshay.guleria/work/revenue-mgmt/.claude/memory/MEMORY.md  ✓
```

### Stop hook not writing session log

Run manually to test:
```bash
echo '{"session_id":"test123"}' | node .claude/hooks/session-end.js
```
Check `.claude/memory/MEMORY.md` for a new log entry.

### Pre-commit hook not firing

```bash
ls -la .git/hooks/pre-commit   # must be executable
chmod +x .git/hooks/pre-commit
```

### Pre-commit too slow

The hook only runs for packages with staged changes. If it's still slow, the bottleneck is likely the Jest run. Add `--bail` to stop after first failure:
```bash
# In .git/hooks/pre-commit, change:
npm test -- --passWithNoTests --testPathIgnorePatterns=e2e
# to:
npm test -- --passWithNoTests --testPathIgnorePatterns=e2e --bail
```

### Context loss mid-session

Run `/checkpoint` immediately. This compacts prior conversation and writes current state to MEMORY.md. If compaction has already happened and context is confused, start a fresh session — MEMORY.md will re-establish state.

### Skill not found

Skills are in `.claude/skills/`. Invoke by name in your prompt: "using the nestjs-patterns skill, create a module for...". Claude loads the `.md` file content when you reference it.

---

## Maintaining the Workflow

### When to update MEMORY.md

- Phase completion — update `## Completed Phases` and `## Active Work`
- New architectural decision — add to `## Key Decisions`
- Stack change — update `## Project State`

Keep MEMORY.md under 3000 chars total.

### When to update CLAUDE.md

Only when project-wide rules change:
- New mandatory API pattern
- New constraint added
- SDLC step added or removed

Never add descriptive/reference content back into CLAUDE.md — that defeats the token optimization.

### Adding new ECC skills

```bash
# From ECC repo
cp ~/work/ECC/skills/<skill-name>/SKILL.md \
   ~/work/revenue-mgmt/.claude/skills/<skill-name>.md
```

Then add an entry to the skills table in `CLAUDE.md`.

### Updating ECC

ECC is a separate repo at `~/work/ECC`. Pull updates there, then re-copy any skills you want. Skills are versioned in ECC — check the changelog before upgrading.
