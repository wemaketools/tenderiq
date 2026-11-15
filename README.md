# TenderIQ

**Tender Intelligence**: a multi-organization tender management application. Buyer organizations plan and run procurements (requests, tenders, publication, clarifications, sealed submissions, opening, evaluation, award, contracts), suppliers discover opportunities and submit responses, and a platform operator runs the service. It belongs to the same product family as QuoteIQ.

## Status: Stage A, static UI prototype

TenderIQ is delivered in two stages with an owner approval gate between them (`docs/plan/architecture-plan.md` §0):

| Stage | What it contains |
|---|---|
| **A: UI prototype** (current) | The complete single-page application, typed API contracts for every endpoint (`src/contracts`), and a **mock API** (`src/mock-api`) that serves **static demo data** and runs **in the browser** (DD-50). The prototype is a static site: no server, no database, no Docker, no Supabase. Sign-in is a persona picker with no passwords. Nothing you do in the prototype is saved; actions return realistic static results, and a "Prototype — static demo data" banner is always shown. |
| **B: Full backend** | Database schema, business logic, background jobs, file storage and real Supabase Auth behind the same contracts. Starts only after the owner approves the prototype. |

## Prerequisites

- **Node.js 24** (`.nvmrc`) with npm 11
- Windows, macOS or Linux. `run.ps1` is a one-command runner for Windows.

Nothing else: no Docker, no database, no environment file.

## Quick start

On Windows, one command does everything below: `.\run.ps1`

Step by step:

```bash
npm install
npm run dev:prototype         # http://localhost:5173, with the mock API running in the page
```

Open http://localhost:5173 and choose a demo persona. The full runbook, including troubleshooting, is in [docs/local-development.md](docs/local-development.md).

## Demo accounts

Every account has an `@tenderiq.local` email address and is chosen on the sign-in page; there are no passwords in the prototype. The organizations and their story are defined in [docs/plan/demo-storyline.md](docs/plan/demo-storyline.md).

| Organization | Accounts |
|---|---|
| TenderIQ Platform Operations (operator) | `ops.admin`, `support.agent` |
| Kalahari Water Utilities (buyer, BWP, Africa/Gaborone) | `admin.kwu`, `mpho.manager`, `tebogo.officer`, `kagiso.requester`, `onalenna.budget`, `neo.assessor`, `lesego.finance`, `boitumelo.chair`, `thato.eval`, `kabo.eval`, `amantle.eval`, `refilwe.commercial`, `oratile.opener`, `goitse.witness`, `dineo.legal`, `keabetswe.approver`, `masego.contracts`, `pule.auditor`, and `former.officer` (deactivated, keeps its history) |
| Okavango District Council (buyer) | `admin.odc`, `officer.odc` |
| Suppliers: Tsodilo Engineering, Chobe Pipe & Valve, Serowe ICT, Gaborone Metering | an administrator, bid manager, contributor and signatory each (for example `tsodilo.bidmanager`) |
| Suppliers: Makgadikgadi Civil Works, Limpopo Environmental Services | an administrator each |
| Buyer and suppliers at once | `sam.dual`: evaluator at Kalahari Water Utilities and contributor at Tsodilo and Chobe (organization switching) |

The complete account list, grouped by organization, is on the sign-in page and in `src/mock-api/fixtures/platform.ts`.

Good starting points: `tebogo.officer` (buyer procurement officer), `boitumelo.chair` (evaluation chair), `tsodilo.bidmanager` (supplier), `masego.contracts` (contract manager), `admin.kwu` (organization administrator), `ops.admin` (platform operator).

## Commands

| Command | Purpose |
|---|---|
| `npm run dev:prototype` | Run the static prototype (Vite, with the mock API in the page) |
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
src/mock-api/    Stage A mock API (Hono) serving static fixtures; runs in the browser in the prototype
src/server/      backend; in Stage A only lib/config, lib/supabase and lib/auth/verify.ts (kept for Stage B)
src/ui/          the SPA workspace (React + Vite)
e2e_tests/       the Playwright workspace
scripts/         OpenAPI generation and CI scans
supabase/        local Supabase stack configuration (used from Stage B)
docs/            requirements, plan, technical documentation
```

## Deployment

Stage A: the prototype deploys to Vercel as static files (`vercel.json`: build `npm run typecheck && npm run build:ui`, output `src/ui/dist`) with no environment variables; the mock API ships inside it (DD-50). From Stage B, production runs on Vercel (static SPA plus Node functions) with hosted Supabase projects, and the mock API leaves the production build.

## Documentation

- [docs/local-development.md](docs/local-development.md): local runbook and troubleshooting
- [docs/PRD.md](docs/PRD.md): business requirements
- [docs/architecture-brief.md](docs/architecture-brief.md): technical conventions
- [docs/plan/architecture-plan.md](docs/plan/architecture-plan.md) and [docs/plan/design-decisions.md](docs/plan/design-decisions.md): the build plan and decision log
- [docs/technical/README.md](docs/technical/README.md): architecture, data model, security, API, frontend, testing and ADRs
- [CLAUDE.md](CLAUDE.md): conventions for coding agents
