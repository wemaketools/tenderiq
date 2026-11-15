# Local development (Stage A: static UI prototype)

This runbook takes a clean checkout to a running TenderIQ prototype. In Stage A the application is a **static site**: the SPA and a **mock API with static demo data** that runs **in the browser**, and sign-in is a **persona picker** with no passwords (design decision DD-50). There is no server, no database, no Docker and no Supabase in Stage A. Nothing is persisted: actions return realistic static results, and the "Prototype — static demo data" banner is always shown.

Sources: `docs/architecture-brief.md` §7, `docs/plan/architecture-plan.md` §3.11, §9 and §11 item 11, `docs/plan/design-decisions.md` DD-50, `docs/technical/10-deployment-environments.md` §3.

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 24 (`.nvmrc`, `engines` `24.x`, DD-45) | npm 11 comes with it |
| Git | any recent | |

Nothing else is installed globally: TypeScript, Vite, Vitest and Playwright all come from `npm install`. No Docker, no database and no `.env.local` are needed in Stage A.

## 2. Quick start on Windows

```powershell
.\run.ps1
```

`run.ps1` checks Node 24, runs `npm install` when `node_modules` is missing and runs the prototype. Stop it with Ctrl+C. `-Prototype` selects the prototype explicitly; it is also the default in Stage A, where it is the only mode.

## 3. Step by step (any OS)

### 3.1 Install

```bash
npm install
```

npm workspaces install the root (backend tooling, contracts, mock API, scripts), `src/ui` (the SPA) and `e2e_tests` (Playwright) together. For end-to-end tests, also install the browser once:

```bash
cd e2e_tests && npx playwright install chromium
```

### 3.2 Run the prototype

```bash
npm run dev:prototype
```

This runs the Vite dev server on http://localhost:5173. The SPA's API client sends every `/api/v1` request to the mock API running in the page (`src/ui/src/api/prototypeTransport.ts` loads `src/mock-api/browser.ts` as a lazy chunk), so no second process is needed.

Open http://localhost:5173/signin and choose a demo persona, for example Tebogo Molefe (procurement officer). The sign-in page lists every persona of `docs/plan/demo-storyline.md`, grouped by organization. The choice is kept for the browser tab (`sessionStorage`) until you sign out. The deactivated persona (Gaone Letsholo, `former.officer`) is refused with one generic message (AC-04).

### 3.3 Try the production build locally

```bash
npm run build:ui
cd src/ui && npx vite preview --port 4173
```

`vite preview` serves `src/ui/dist` exactly as a static host does.

## 4. Deploying to Vercel

The prototype deploys as static files with no environment variables (`vercel.json`): build command `npm run typecheck && npm run build:ui`, output directory `src/ui/dist`, and one rewrite that sends every path to `index.html` (client-side routing). There are no Vercel functions in Stage A. The owner creates the Vercel project and deploys; agents create no accounts and do not deploy (architecture-plan §11 items 5 and 11).

## 5. Port conventions

| Port | Used by |
|---|---|
| 5173 | The owner's `npm run dev:prototype` (reserved; agents never use it) |
| 5280 | Playwright's `prototype` project (override with `PROTOTYPE_WEB_PORT`) |
| 52xx and similar | Build agents, each on the port its task names |

To run the SPA on another port:

```bash
cd src/ui && npx vite --port 5201
```

## 6. Checks and tests

| Command | What runs |
|---|---|
| `npm run typecheck` | Backend side: contracts, mock API, `src/server`, scripts, Vitest config |
| `npm run typecheck:ui` | SPA, the contracts it compiles and the mock API it runs in the browser |
| `npm run lint` | ESLint for the backend side (no `any`, type-only imports, `process.env` only in the config module, pure contracts, no mock API in backend code, browser-safe mock API runtime code) |
| `npm run lint:ui` | ESLint for the SPA (warnings fail) plus the Prettier check. Fix formatting with `npm run format:ui`. |
| `npm run test:unit` | Root Vitest `unit` project: contracts, mock API (with the prototype persona token) and scripts |
| `npm run test` | All root Vitest projects (`unit`, and `integration` from Stage B) |
| `npm run test:ui` | SPA tests (Vitest, jsdom, React Testing Library) |
| `npm run test:e2e:prototype` | Playwright `prototype` project with axe checks. It starts its own Vite server on 5280; nothing else is needed. |
| `npm run build` | Backend typecheck + SPA production build (`src/ui/dist`) |
| `npm run ci:security` | Secret scan of tracked files and leak scan of the production bundle |
| `npm run verify` | typecheck → typecheck:ui → lint → lint:ui → test → test:ui → build:ui |

Root Vitest runs see the values of `.env.local` in `process.env` when the file exists (application code still reads them only through `src/server/lib/config`). Stage A tests need none. The one test that needs the local Supabase stack (`verify.local-stack.test.ts`) is left out of the unit project until Stage B.

## 7. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Vite reports the port is in use | A previous run is still alive. Stop it (Ctrl+C in its terminal, or end the `node` process that owns the port), or use another port. Vite never falls back to another port (`strictPort`). |
| Playwright says a server URL "is already used" | A stale server holds 5280. Stop it, or set `PROTOTYPE_WEB_PORT` to a free port. Servers are never reused, so old code is never tested by accident. |
| Every page shows "The service could not be reached." | The mock API chunk failed to load (for example a dropped connection while the dev server restarted). Reload the page; the next request retries the load. |
| Signed out after closing the tab | Expected: the chosen persona is kept per browser tab (`sessionStorage`). Choose it again. |
| `npm run lint:ui` fails on formatting | Run `npm run format:ui` (Prettier), then lint again. |
| `npm run lint` flags a `node:` import in `src/mock-api` | Mock API runtime code also runs in the browser (DD-50). Use `src/mock-api/sha256.ts`, `TextEncoder` or `Uint8Array`; Node APIs are allowed only in tests, `testing/**` and `registry-discovery.ts`. |
| A new handler module is not served | Add it to `src/mock-api/handler-modules.ts`; `handler-modules.test.ts` fails until the list matches `src/mock-api/handlers`. |
| Line-ending noise in `git status` on Windows | `.gitattributes` keeps every file LF (PowerShell scripts CRLF). Avoid editors that convert line endings. |
| Browser console shows a Content-Security-Policy violation | The SPA only talks to its own origin (DD-30, DD-50). Load fonts, scripts and data from the app itself; never from a third-party origin. |
