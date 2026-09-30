# TenderIQ

**Tender Intelligence**: a multi-organization tender management application. Buyer organizations plan and run procurements (requests, tenders, publication, clarifications, sealed submissions, opening, evaluation, award, contracts), suppliers discover opportunities and submit responses, and a platform operator runs the service. It belongs to the same product family as QuoteIQ.

## Status: Stage A, UI prototype

TenderIQ is delivered in two stages with an owner approval gate between them (`docs/plan/architecture-plan.md` §0):

| Stage | What it contains |
|---|---|
| **A: UI prototype** (current) | The complete single-page application, typed API contracts for every endpoint (`src/contracts`), and a **mock API** (`src/mock-api`) that serves **static demo data**. Sign-in is **real**: the local Supabase Auth stack runs in Docker. Nothing you do in the prototype is saved; actions return realistic static results, and a "Prototype — static demo data" banner is always shown. |
| **B: Full backend** | Database schema, business logic, background jobs and file storage behind the same contracts. Starts only after the owner approves the prototype. |

## Prerequisites

- **Node.js 24** (`.nvmrc`) with npm 11
- **Docker Desktop**, running (for the local Supabase stack)
- Windows, macOS or Linux. `run.ps1` is a one-command runner for Windows.

The Supabase CLI is a pinned dev dependency; nothing else needs a global install.

## Quick start

On Windows, one command does everything below: `.\run.ps1`

Step by step:

```bash
npm install
npm run supabase:start        # local Supabase stack in Docker (first run downloads the images)
# write the root .env.local from `npx supabase status -o env` (see docs/local-development.md)
npm run auth:personas         # create the demo accounts in local Supabase Auth
npm run dev:prototype         # mock API on 127.0.0.1:3001 + SPA on http://localhost:5173
```

Open http://localhost:5173 and sign in. In local development builds the sign-in page lists the demo accounts for one-click sign-in (this list never exists in production builds). The full runbook, including `.env.local` and troubleshooting, is in [docs/local-development.md](docs/local-development.md).

## Local services

| Service | Address |
|---|---|
| SPA (Vite) | http://localhost:5173 |
| Mock API (Stage A) | http://127.0.0.1:3001/api/v1 (proxied by Vite, so the browser uses `/api/v1`) |
| Supabase API gateway (Auth) | http://127.0.0.1:54321 |
| Postgres | 127.0.0.1:54322 (no application schema in Stage A) |
| Supabase Studio | http://127.0.0.1:54323 |
| Mailpit (password-reset emails) | http://127.0.0.1:54324 (SMTP 54325) |

## Demo accounts

Every account uses the password **`test1234`** and an `@tenderiq.local` email address. The organizations and their story are defined in [docs/plan/demo-storyline.md](docs/plan/demo-storyline.md).

| Organization | Accounts |
|---|---|
| TenderIQ Platform Operations (operator) | `ops.admin`, `support.agent` |
| Kalahari Water Utilities (buyer, BWP, Africa/Gaborone) | `admin.kwu`, `mpho.manager`, `tebogo.officer`, `kagiso.requester`, `onalenna.budget`, `neo.assessor`, `lesego.finance`, `boitumelo.chair`, `thato.eval`, `kabo.eval`, `amantle.eval`, `refilwe.commercial`, `oratile.opener`, `goitse.witness`, `dineo.legal`, `keabetswe.approver`, `masego.contracts`, `pule.auditor`, and `former.officer` (deactivated, keeps its history) |
| Okavango District Council (buyer) | `admin.odc`, `officer.odc` |
| Suppliers: Tsodilo Engineering, Chobe Pipe & Valve, Serowe ICT, Gaborone Metering | an administrator, bid manager, contributor and signatory each (for example `tsodilo.bidmanager`) |
| Suppliers: Makgadikgadi Civil Works, Limpopo Environmental Services | an administrator each |
| Buyer and suppliers at once | `sam.dual`: evaluator at Kalahari Water Utilities and contributor at Tsodilo and Chobe (organization switching) |

The complete account list, grouped by organization, is on the sign-in page's demo accounts panel and in `src/mock-api/fixtures/platform.ts`.

Good starting points: `tebogo.officer` (buyer procurement officer), `boitumelo.chair` (evaluation chair), `tsodilo.bidmanager` (supplier), `masego.contracts` (contract manager), `admin.kwu` (organization administrator), `ops.admin` (platform operator).

## Commands

| Command | Purpose |
|---|---|
| `npm run supabase:start` / `npm run supabase:stop` / `npm run supabase:status` | Start, stop or inspect the local Supabase stack |
| `npm run auth:personas` | Create or update the demo accounts (local only, idempotent) |
| `npm run dev:prototype` | Run the prototype: mock API + SPA |
| `npm run dev:mock-api` | Run only the mock API on port 3001 |
| `npm run typecheck`, `npm run typecheck:ui` | Type-check the backend side (contracts, mock API, scripts) and the SPA |
| `npm run lint`, `npm run lint:ui`, `npm run format:ui` | ESLint (backend side), ESLint + Prettier check (SPA), Prettier write (SPA) |
| `npm run test`, `npm run test:unit`, `npm run test:ui` | Vitest: all root projects, the unit project, the SPA suite |
| `npm run test:e2e:prototype` | Playwright end-to-end tests with accessibility checks, against the prototype |
| `npm run build` | Backend typecheck + SPA production build (the Vercel build command) |
| `npm run docs:api` | Generate the OpenAPI document from the contracts |
| `npm run ci:security` | Secret scan and production-bundle leak scan |
| `npm run verify` | typecheck, lint, tests and SPA build in one go |

## Technology

TypeScript (strict, ESM) everywhere. SPA: React 18, Vite, Redux Toolkit, React Router 7, Recharts. API: Hono with zod contracts (Vercel functions from Stage B). Data and identity: Supabase (PostgreSQL 17, Auth with ES256 JWTs, Storage). Tests: Vitest, React Testing Library, Playwright with axe. Node 24. Details: [docs/architecture-brief.md](docs/architecture-brief.md) and [docs/technical/README.md](docs/technical/README.md).

## Repository layout

```
src/contracts/   typed API contracts (zod), shared by the SPA, the mock API and the backend
src/mock-api/    Stage A mock API (Hono) serving static fixtures; dev and test only, never deployed
src/server/      backend; in Stage A only lib/config, lib/supabase and lib/auth/verify.ts
src/ui/          the SPA workspace (React + Vite)
e2e_tests/       the Playwright workspace
scripts/         dev servers, auth personas, OpenAPI generation, CI scans, signing-key helper
supabase/        local Supabase stack configuration
docs/            requirements, plan, technical documentation
```

## Deployment

Production runs on Vercel (static SPA plus Node functions) with hosted Supabase projects, configured from Stage B. The mock API is never deployed. In Stage A the prototype runs locally only.

## Documentation

- [docs/local-development.md](docs/local-development.md): local runbook and troubleshooting
- [docs/PRD.md](docs/PRD.md): business requirements
- [docs/architecture-brief.md](docs/architecture-brief.md): technical conventions
- [docs/plan/architecture-plan.md](docs/plan/architecture-plan.md) and [docs/plan/design-decisions.md](docs/plan/design-decisions.md): the build plan and decision log
- [docs/technical/README.md](docs/technical/README.md): architecture, data model, security, API, frontend, testing and ADRs
- [CLAUDE.md](CLAUDE.md): conventions for coding agents
