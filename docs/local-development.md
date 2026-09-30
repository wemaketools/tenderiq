# Local development (Stage A: UI prototype)

This runbook takes a clean checkout to a running TenderIQ prototype. In Stage A the application runs against a **mock API with static demo data**, while sign-in uses **real Supabase Auth** in a local Docker stack (design decision DD-43). Nothing is persisted: actions return realistic static results, and the "Prototype — static demo data" banner is always shown.

Sources: `docs/architecture-brief.md` §7, `docs/plan/architecture-plan.md` §3.11 and §9, `docs/technical/10-deployment-environments.md` §3.

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 24 (`.nvmrc`, `engines` `24.x`, DD-45) | npm 11 comes with it |
| Docker Desktop (or Docker Engine) | running | Hosts the Supabase stack: Auth, Postgres, Studio, Mailpit, Storage |
| Git | any recent | |

Nothing else is installed globally: the Supabase CLI (pinned, `supabase` dev dependency), TypeScript, Vite, Vitest and Playwright all come from `npm install`.

## 2. Quick start on Windows

```powershell
.\run.ps1
```

`run.ps1` checks Node 24 and Docker, runs `npm install` when `node_modules` is missing, starts the Supabase stack, writes or refreshes the Supabase values in `.env.local`, creates the demo accounts and runs the prototype. Stop the prototype with Ctrl+C; the stack keeps running. `.\run.ps1 -StopDb` stops the stack. `-Prototype` selects the prototype explicitly; it is also the default in Stage A, where it is the only mode.

## 3. Step by step (any OS)

### 3.1 Install

```bash
npm install
```

npm workspaces install the root (backend tooling, contracts, mock API, scripts), `src/ui` (the SPA) and `e2e_tests` (Playwright) together. For end-to-end tests, also install the browser once:

```bash
cd e2e_tests && npx playwright install chromium
```

### 3.2 Start the local Supabase stack

```bash
npm run supabase:start
```

This first runs `scripts/db/ensure-signing-keys.mjs`, which generates `supabase/signing_keys.json` (a local ES256 key, git-ignored) when it is missing, then `supabase start`. The first start downloads the Docker images and takes several minutes. The stack keeps running until `npm run supabase:stop`.

Stage A uses only Supabase **Auth** from the stack. There is no application schema yet; the expected warning `no files matched pattern: supabase/seed.sql` is harmless.

### 3.3 Write `.env.local`

The root `.env.local` (git-ignored) holds the local values. Vite reads it too, because its `envDir` is the repository root. Print the stack's values:

```bash
npx supabase status -o env
```

and write `.env.local` with:

| Variable | Value |
|---|---|
| `APP_ENV` | `local` |
| `LOG_LEVEL` | `info` |
| `SUPABASE_URL` | `API_URL` from the status output (http://127.0.0.1:54321) |
| `SUPABASE_ANON_KEY` | `ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | `SERVICE_ROLE_KEY` (server and scripts only, never the browser) |
| `VITE_SUPABASE_URL` | same as `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | same as `SUPABASE_ANON_KEY` |

The two `VITE_*` variables are the only values compiled into the SPA. `run.ps1` writes and refreshes these values for you. `.env.local.example` lists the same keys with placeholders.

### 3.4 Create the demo accounts

```bash
npm run auth:personas
```

Creates or updates every demo persona of `docs/plan/demo-storyline.md` in local Supabase Auth through the Admin API, already confirmed, with the password `test1234`. It is idempotent and refuses to run against anything that is not local. Run it again after a `supabase stop --no-backup` or whenever the persona list changes.

### 3.5 Run the prototype

```bash
npm run dev:prototype
```

| Process | Address |
|---|---|
| SPA (Vite dev server) | http://localhost:5173 |
| Mock API (Hono, static fixtures) | http://127.0.0.1:3001/api/v1, proxied by Vite so the browser calls `/api/v1/...` |

Open http://localhost:5173 and sign in with a demo account, for example `tebogo.officer@tenderiq.local` / `test1234`. In development builds the sign-in page lists the demo accounts grouped by organization for one-click sign-in; production builds never contain that list (checked by `npm run ci:security`).

`npm run dev:mock-api` runs only the mock API on port 3001. The mock API and the Stage B API runner both use port 3001, so only one of them can run at a time.

## 4. Local services

| Service | Address |
|---|---|
| Supabase API gateway (Auth) | http://127.0.0.1:54321 |
| Postgres | 127.0.0.1:54322, user and password `postgres` |
| Supabase Studio | http://127.0.0.1:54323 |
| Mailpit web UI and API | http://127.0.0.1:54324 |
| Mailpit SMTP | 127.0.0.1:54325 (used by the app's email channel from Stage B, DD-44) |

**Password-reset emails.** Use "Forgot password" on the sign-in page, then open Mailpit at http://127.0.0.1:54324 to read the email and follow its link. Invitation and registration emails appear from Stage B, when the real API sends them.

## 5. Port conventions

| Ports | Used by |
|---|---|
| 3001 / 5173 | The owner's `npm run dev:prototype` (reserved; agents never use them) |
| 4180 / 5280 | Playwright's `prototype` project (override with `PROTOTYPE_API_PORT` / `PROTOTYPE_WEB_PORT`) |
| 41xx / 52xx and similar pairs | Build agents, each on the pair its task names |

To run the SPA against a mock API on another port:

```bash
npx tsx scripts/dev/serve-mock-api.ts --port 4101
cd src/ui && VITE_API_PROXY_TARGET=http://127.0.0.1:4101 npx vite --port 5201
```

(PowerShell: `$env:VITE_API_PROXY_TARGET = 'http://127.0.0.1:4101'; npx vite --port 5201`.)

## 6. Checks and tests

| Command | What runs |
|---|---|
| `npm run typecheck` | Backend side: contracts, mock API, `src/server`, scripts, Vitest config |
| `npm run typecheck:ui` | SPA and the contracts it compiles |
| `npm run lint` | ESLint for the backend side (no `any`, type-only imports, `process.env` only in the config module, pure contracts, no mock API in backend code) |
| `npm run lint:ui` | ESLint for the SPA (warnings fail) plus the Prettier check. Fix formatting with `npm run format:ui`. |
| `npm run test:unit` | Root Vitest `unit` project: contracts, mock API (including real JWT verification against the local stack) and scripts |
| `npm run test` | All root Vitest projects (`unit`, and `integration` from Stage B) |
| `npm run test:ui` | SPA tests (Vitest, jsdom, React Testing Library) |
| `npm run test:e2e:prototype` | Playwright `prototype` project with axe checks. It starts its own mock API and Vite servers on 4180/5280 and needs the stack and the demo accounts. |
| `npm run build` | Backend typecheck + SPA production build (`src/ui/dist`) |
| `npm run ci:security` | Secret scan of tracked files and leak scan of the production bundle |
| `npm run verify` | typecheck → typecheck:ui → lint → lint:ui → test → test:ui → build:ui |

Root Vitest runs see the values of `.env.local` in `process.env` (application code still reads them only through `src/server/lib/config`).

## 7. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `supabase start` fails with a Docker error | Docker Desktop is not running or not ready. Start it, wait for "Engine running", retry `npm run supabase:start`. |
| `supabase start` reports a port already in use (54321–54327) | Another Supabase project's stack is running. List containers with `docker ps`, stop the other project (`npx supabase stop --project-id <id>`), then start again. |
| Sign-in fails for every account, or the mock API answers 401 for a fresh token | The demo accounts do not exist yet, or the stack was recreated: run `npm run auth:personas`. If `supabase/signing_keys.json` was regenerated, the anon and service-role keys changed: refresh `.env.local` (section 3.3 or `.\run.ps1`) and restart the stack. |
| `ensure-signing-keys` warns that the key file is invalid and generates a new one | The file was damaged (for example by an interrupted write). Restart the stack (`npm run supabase:stop`, then `npm run supabase:start`), refresh `.env.local`, and sign in again. |
| The page does not load and Vite reports "VITE_SUPABASE_URL is not set" (a production build fails with the same message) | `.env.local` is missing or incomplete. Write it (section 3.3), then restart Vite. |
| Vite or the mock API reports the port is in use | A previous run is still alive. Stop it (Ctrl+C in its terminal, or end the `node` process that owns the port), or use another port pair. Vite never falls back to another port (`strictPort`). |
| Playwright says a server URL "is already used" | A stale server holds 4180 or 5280. Stop it, or set `PROTOTYPE_API_PORT` / `PROTOTYPE_WEB_PORT` to free ports. Servers are never reused, so old code is never tested by accident. |
| Password-reset email never arrives | Open Mailpit at http://127.0.0.1:54324. Emails are caught there and never leave the machine. |
| `npm run lint:ui` fails on formatting | Run `npm run format:ui` (Prettier), then lint again. |
| Line-ending noise in `git status` on Windows | `.gitattributes` keeps every file LF (PowerShell scripts CRLF). Avoid editors that convert line endings. |
| Browser console shows a Content-Security-Policy violation | The SPA only talks to its own origin and to the Supabase URL (DD-30). Load fonts, scripts and data from the app itself; never from a third-party origin. |
