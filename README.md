# TeamOS

AI-native team operating system: operational visibility, workflow execution,
evidence-driven completion, immutable audit history, and advisory AI reporting.

This repository is built directly from the specification in
[`docs/`](docs/README.md) and [`architecture/`](architecture/architecture.md).
Those documents are the source of truth; the code implements them.

## Product principles

- Work generates reporting.
- Employee updates take **under 60 seconds**; manager review takes **under 5 minutes**.
- Completion **requires evidence or a completion comment**.
- Every material action is appended to an **immutable activity timeline**.
- AI can summarize, detect risk, and recommend — but **never mutates records** (ADR-0003).
- Runs on **free-tier friendly** infrastructure.

## Architecture

The codebase honors [ADR-0001](architecture/adr/0001-target-mvp-architecture.md)
and [ADR-0002](architecture/adr/0002-repository-pattern-over-sheets.md): business
logic is decoupled from the data source behind repository interfaces, so Google
Sheets can later be replaced by PostgreSQL and Apps Script by Cloud Run without
touching domain rules.

```
┌─────────────────────────────┐
│  apps/web  (Next.js PWA)     │  UI + API route handlers (stores no secrets)
└──────────────┬──────────────┘
               │ calls
┌──────────────▼──────────────┐
│  packages/core              │  entities · repository INTERFACES · services
│  (framework-agnostic)       │  RBAC · validation · activity · AI boundary
└──────┬───────────────┬──────┘
       │               │
┌──────▼──────┐ ┌──────▼─────────────┐
│ in-memory   │ │ Google Sheets/Drive│  ← apps/appsscript (documented MVP)
│ repositories│ │ repositories       │
└─────────────┘ └────────────────────┘
```

Two interchangeable backends implement one contract:

- **`apps/web`** — runnable today on a seeded in-memory backend. Dev login and a
  deterministic offline AI summarizer mean it needs **no Google project or
  secrets** to run and verify.
- **`apps/appsscript`** — the documented production data path: Apps Script API
  over Google Sheets + Drive, Google OAuth identity, and Gemini server-side.
  See [apps/appsscript/README.md](apps/appsscript/README.md).

## Repository layout

```
packages/core/            Domain core (TypeScript, framework-agnostic)
  src/domain/             Entities, enums, IDs, errors
  src/repositories/       Repository interfaces + in-memory implementation
  src/services/           RBAC, validation, task/evidence/workflow/dashboard/AI services
  src/ai/                 AI provider interface, Gemini adapter, offline fallback
  test/                   Vitest suite incl. every security-model requirement
apps/web/                 Next.js 14 App Router PWA (dashboards, task flow, API)
apps/appsscript/          Google Apps Script + Sheets backend (.gs)
docs/ , architecture/     The specification this code is built from
```

## Getting started

Requires Node 20+.

```bash
npm install
npm test          # run the core domain + security test suite
npm run dev        # start the web app at http://localhost:3000
```

Open http://localhost:3000 and sign in with a seeded demo account
(Admin / Manager / Employee) to explore each role. The dashboards, task update
flow, evidence capture, activity timeline, and AI summaries all work out of the box.

### Configuration

Copy [`.env.example`](.env.example) to `apps/web/.env.local` to adjust:

- `TEAMOS_ALLOWED_DOMAINS` — allowed Workspace email domains.
- `TEAMOS_DEV_LOGIN` — `false` to hide seeded accounts.
- `GEMINI_API_KEY` — set to use Gemini; empty uses the offline summarizer.
- `GOOGLE_OAUTH_*` / `NEXTAUTH_*` — real Google sign-in.
- `TEAMOS_DATA_BACKEND` — `memory` (default) or `sheets`.

## Quality gates

```bash
npm run typecheck   # strict TypeScript across core + web
npm test            # 23 tests; covers the security-model.md test matrix
npm run build       # production Next.js build
```

The test suite explicitly verifies the security requirements: an employee cannot
read team data or update another employee's task; archived users are denied;
completion without evidence or comment fails; waiting status without a reason
fails; and the AI summary path cannot mutate source records.

## Implementation gate

Per [docs/README.md](docs/README.md), before changing product behavior update the
PRD; before changing boundaries update the architecture, database design, API
spec, or security model; and record durable technical decisions as ADRs.

## License

UNLICENSED — internal project.
