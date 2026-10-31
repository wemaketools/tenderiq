# TenderIQ: instructions for agents

TenderIQ ("Tender Intelligence") is a multi-organization tender management web application: buyers run procurements, suppliers respond, operators run the platform. TypeScript everywhere, React 18 SPA on Vite, Hono API on Vercel functions, Supabase (Postgres, Auth, Storage).

## Where the truth lives

Read before writing anything, in this order of precedence:

1. `docs/plan/design-decisions.md`: decision log DD-01 … DD-50 (DD-38 withdrawn; DD-50 supersedes DD-43 for Stage A). It amends everything below and wins on conflict.
2. `docs/plan/architecture-plan.md`: stages (§0), contracts (§3.10), prototype mode (§3.11), layout and URL map (§4), file ownership (§5), design system (§7).
3. `docs/architecture-brief.md`: technical conventions, followed literally unless the plan (§11) records an approved deviation.
4. `docs/plan/schema-blueprint.md` (tables, enums, permission codes), `docs/plan/demo-storyline.md` (the single demo world), `docs/PRD.md` (business requirements; screen tables are binding for UI).
5. `docs/plan/foundation-contract.md` (once it exists): the verified APIs of the foundation that domain code must use.
6. `docs/technical/**`: technical design documentation (architecture, data model, security, API, frontend, testing, ADRs). Read-only unless your task says otherwise.
7. `docs/screenshots/*.png` and `docs/css/**`: the visual reference.

## Delivery stages (plan §0)

- **Stage A (current): static UI prototype (DD-50).** The complete SPA, typed API contracts (`src/contracts`) and a mock API (`src/mock-api`) serving STATIC fixtures from the demo storyline. The mock API runs IN THE BROWSER (`src/mock-api/browser.ts`, loaded by `src/ui/src/api/prototypeTransport.ts`), so the prototype is a static site deployable to Vercel with no environment variables. Sign-in is a persona picker (no passwords); the persona's e-mail is the bearer token the mock API maps to its fixture persona. Nothing persists. No Supabase and no Docker in Stage A.
- In Stage A there is **no** database schema, no migrations, no business logic under `src/server` (only the platform modules `lib/config`, `lib/supabase`, `lib/auth/verify.ts`, kept for Stage B and unused by the prototype) and no `api/` functions.
- **Stage B (full backend) never starts without the owner's explicit written approval of the prototype.** It implements the same contracts.

## Rules for every agent

- **Git:** agents never run git commands (no commit, branch, checkout, reset, stash, push) except in the workflow's checkpoint steps. The owner owns git.
- **Ownership:** write only the paths your task owns (plan §5). Read anything. Report needed changes elsewhere as follow-ups; never edit, delete or reformat other agents' files.
- **Dependencies:** every dependency for both stages is already declared. Do not add npm packages or edit `package.json` files unless your task says so.
- **No placeholders:** no TODO/FIXME, lorem ipsum, "coming soon", dead buttons or no-op handlers. Everything you define is complete, with loading, empty, error and restricted states, and tests. Static data lives ONLY in `src/mock-api/fixtures/**`; UI code always goes through the API client.
- **No Supabase in Stage A (DD-50):** do not start Docker or a Supabase stack, and do not import `@supabase/supabase-js`. Stage B brings them back.
- **Ports:** 5173 is reserved for the owner. Use the port your task gives you (SPA with the in-browser mock API: `npx vite --port <Q>` in `src/ui`). Playwright's prototype project uses 5280. Stop every server you start.
- **Scratch files** go under `.qa-scratch/<your-label>/` (git-ignored). Never write report or summary files into the repository.
- While other agents work in parallel, filter typecheck and lint output to your own paths; your files must be error-free.

## Code conventions

- **TypeScript strict, ESM.** No `any` (lint error). `import type` for type-only imports (`consistent-type-imports`). Backend, contracts, mock API and scripts use NodeNext resolution: relative imports carry explicit `.js` extensions.
- **Zod v4** at every boundary (HTTP input, config, fixtures). Never write required fields as `.nullish().refine(...)`. Field errors use the `"CODE|message"` convention (brief §5.3).
- **Configuration:** only `src/server/lib/config/index.ts` reads `process.env` (lint-enforced). Everything else calls `getConfig()`/`loadConfig()`.
- **Errors:** RFC 7807 `application/problem+json` with `errors[{field, code, message}]` and `correlationId`; 422 for validation; 401 vs 403 as brief §5.7; tenant failures return one identical 403.
- **Money and scores** are decimal STRINGS with a currency code (`src/contracts/decimal.ts`, DD-32), never JS floats. **Instants** are ISO 8601 UTC strings. **Deadlines** always travel with their IANA official time zone and render as `14 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone` (DD-33).
- **Contracts** (`src/contracts`) are pure TypeScript + zod shared by the SPA, the mock API and the backend: no Node or browser APIs, only `zod` and sibling imports (lint-enforced). Enums live once in `src/contracts/enums.ts`.
- **Boundaries (lint-enforced):** the SPA never imports `src/server`; only `src/ui/src/api/prototypeTransport.ts` imports `src/mock-api`; nothing imports `@supabase/supabase-js` in Stage A; `src/server` and `api/` never import the mock API. Mock API runtime code also runs in the browser: no `node:*` imports, no `src/server` imports and no Node globals outside its tests, `testing/**` and `registry-discovery.ts` (hash with `src/mock-api/sha256.ts`). A new handler module is added to `src/mock-api/handler-modules.ts`.
- **Logging:** no `console.log` (only `console.warn`/`console.error`); scripts print progress with `process.stdout.write`. Never log tokens, keys, passwords or personal data.
- **SPA:** only the design system (`src/ui/src/theme`, `src/ui/src/components`): tokens, no raw hex, no literal pixel gaps; match `docs/screenshots`. Every UI string goes through `t()` with per-feature catalogs (DD-37). Deadlines render through the OfficialDeadline component. Consequential actions confirm organization, capacity, scope and result (COM-02).
- **SPA formatting and lint:** Prettier (`src/ui/.prettierrc`) is checked by `npm run lint:ui`, and ESLint warnings fail the lint (`--max-warnings 0`). Format your SPA files with `npx prettier --write <files>` from `src/ui` (or `npm run format:ui`). The react-hooks preset includes the React Compiler rules (for example no synchronous `setState` inside an effect body, no impure calls such as `Date.now()` during render).
- **Tests:** names state behavior, condition and outcome (AAA). Deterministic and order-independent. Root Vitest projects: `unit` (`src/server/tests/unit`, `src/contracts/**/*.test.ts`, `src/mock-api/**/*.test.ts`, `scripts/**/*.test.ts`) and `integration` (Stage B). SPA tests are colocated `*.test.ts(x)` under `src/ui/src` (jsdom, RTL, jest-dom; setup `src/ui/src/test/setup.ts`). Root tests see `.env.local` values when the file exists; Stage A tests need none.

## Commands (Stage A)

| Command | What it does |
|---|---|
| `npm run dev:prototype` | The static prototype on http://localhost:5173 (the owner's port): Vite, with the mock API in the page |
| `npm run typecheck` / `typecheck:ui` | Backend+contracts+mock API+scripts / SPA |
| `npm run lint` / `lint:ui` / `format:ui` | Backend lint / SPA lint + Prettier check / SPA Prettier write |
| `npm run test` / `test:unit` / `test:ui` | All root projects / root unit project / SPA suite |
| `npm run ci:test:ui` | SPA suite with the skip and count-floor assertions |
| `npm run build:ui` / `build` | SPA production build / backend typecheck + SPA build (Vercel's build command) |
| `npm run docs:api` | Generates `docs/technical/api/openapi.json` from the contracts |
| `npm run ci:security` | Secret scan of tracked files + production bundle leak scan |
| `npm run test:e2e:prototype` | Playwright `prototype` project (starts its own Vite server on 5280) |
| `npm run verify` | typecheck → typecheck:ui → lint → lint:ui → test → test:ui → build:ui |

Stage A needs no local services, Docker or `.env.local`. Runbook: `docs/local-development.md`. Deploy: Vercel serves `src/ui/dist` as static files (`vercel.json`).

## Build progress and resilience

Workflow checkpoints write `.build/progress/<stage>/<unit>.json` (committed, not ignored) and commit once per phase. After an interruption, run the typecheck and tests before continuing (plan §12).
