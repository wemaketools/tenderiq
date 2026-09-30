# Architecture Brief: TypeScript + React + Supabase + Vercel SaaS

Use this brief to build a new application on the same architecture, platforms and engineering conventions as an existing production codebase. Business functionality is out of scope. This document covers only the technical foundation. Where it says `<app>`, substitute the new application's name.

Follow it literally unless the human owner approves a deviation. Do not add frameworks, ORMs, queue providers, auth providers, logging libraries or cloud services beyond the ones listed here without asking first.

---

## 1. Platform summary

| Concern | Choice |
|---|---|
| Language | TypeScript everywhere (backend, frontend, scripts, tests), strict mode, ESM (`"type": "module"`) |
| Runtime | Node.js 22 (pinned in `engines`, in CI and on Vercel) |
| Hosting | Vercel: one project serving the static SPA plus Node.js serverless functions |
| HTTP framework (backend) | Hono, adapted to Vercel with `hono/vercel` `handle()` |
| Database | Supabase PostgreSQL 17 |
| DB access | Kysely (query builder) over `pg` (node-postgres). No ORM. |
| DB types | Generated from the live local schema with `supabase gen types typescript --local`, then adapted to Kysely |
| Migrations | Plain SQL files in `supabase/migrations/`, applied by the Supabase CLI |
| Validation | Zod (v4) at every boundary: HTTP input, env config, queue payloads |
| Auth | Supabase Auth (GoTrue), email + password, asymmetric ES256 JWTs verified server-side with JWKS |
| File storage | Supabase Storage (private buckets, signed upload/download URLs) behind a small adapter interface |
| Scheduled jobs | Postgres `pg_cron` → `pg_net` HTTP call → secret-protected Vercel function |
| Async jobs / queues | Postgres `pgmq` queues, drained by a Vercel function that `pg_cron` calls every minute |
| Frontend | React 18 + TypeScript + Vite + Redux Toolkit + React Router 7 (+ Recharts for charts) |
| Unit/integration tests | Vitest (backend and SPA); React Testing Library + jsdom for the SPA |
| E2E tests | Playwright (+ `@axe-core/playwright` for accessibility) |
| Lint | ESLint 9 flat config + `typescript-eslint`; Prettier on the SPA |
| Local dev | Supabase CLI local stack on Docker (Postgres, Auth, Storage, Studio, Mailpit) |
| Secrets | Doppler as the single source of truth, synced to Vercel environments and GitHub Actions environments |
| CI | GitHub Actions: one `verify` job plus a `migrate` job that deploys the schema per branch |
| App deploy | Vercel Git integration (not a CI step) |

Explicitly **not** used: Next.js, any ORM (Prisma, TypeORM, Drizzle), EF/.NET, Liquibase, Hangfire, Redis, a resident worker process, Vercel Cron (`crons` in `vercel.json`), Vercel KV, Supabase Edge Functions, Supabase Realtime, the Supabase Data API from the browser, Postgres RLS as the primary isolation mechanism, third-party logging or error-tracking SDKs, a process-runner dependency such as `concurrently`.

---

## 2. Repository layout

A single repository using npm workspaces. The backend is at the root and the SPA and E2E suites are workspaces.

```
/
├── api/                          # Vercel function entrypoints ONLY (thin, 3–10 lines each)
│   ├── v1/index.ts               # the ONE function serving the whole /api/v1 surface (Hono app)
│   ├── cron/<job-name>.ts        # one file per scheduled job, GET, CRON_SECRET-protected
│   └── queue/drain.ts            # queue drain, POST, INTERNAL_JOB_SECRET-protected
├── src/
│   ├── server/                   # all backend code (never imported by src/ui)
│   │   ├── domains/<domain>/     # feature modules (see §5)
│   │   ├── jobs/                 # cron + queue infrastructure and handlers
│   │   │   ├── cron/             # sweep handlers + registry
│   │   │   └── queue/            # pgmq adapter, in-memory adapter, drain loop, handler registry
│   │   ├── lib/
│   │   │   ├── config/           # typed env config (the ONLY reader of process.env)
│   │   │   ├── db/               # Kysely client, pool config, tenant helpers, transactions, generated types
│   │   │   ├── auth/             # JWT verification, auth middleware, permission guard
│   │   │   ├── tenancy/          # tenant-context middleware (if multi-tenant)
│   │   │   ├── supabase/         # server-side supabase-js clients, JWKS cache
│   │   │   ├── storage/          # StorageAdapter port + supabase + fake bindings
│   │   │   ├── router/           # buildApp(): Hono app composition + middleware chain
│   │   │   ├── errors/           # AppError classes + RFC 7807 problem+json mapping
│   │   │   ├── logging/          # structured JSON logger + redactor
│   │   │   ├── validation/       # zod helpers → field errors
│   │   │   └── result.ts         # Result<T, E> type
│   │   └── tests/
│   │       ├── unit/             # pure tests, no DB
│   │       ├── integration/      # against the local Supabase stack
│   │       ├── types/            # compile-time type tests (@ts-expect-error)
│   │       ├── helpers/ fixtures/
│   └── ui/                       # React SPA workspace (own package.json, tsconfig, eslint, vite)
├── supabase/
│   ├── config.toml               # local stack config
│   ├── migrations/               # timestamped plain SQL, append-only
│   ├── seed.sql                  # baseline seed (code-owned reference data only, no users)
│   ├── schema.expected.sql       # committed schema snapshot for drift detection
│   └── signing_keys.json         # LOCAL ONLY ES256 key, generated by script, git-ignored
├── scripts/
│   ├── dev/                      # dev.mjs (runs API + SPA), serve-api.ts (local function host)
│   ├── db/                       # seed, seed-demo, generate-types, validate-migrations,
│   │                             # ensure-signing-keys, configure-job-cron, create-admin
│   ├── jobs/                     # run-cron, run-all-crons, local-queue-worker, job-status, enqueue-test
│   └── ci/                       # scan-secrets, scan-bundle, assert-test-run
├── e2e_tests/                    # Playwright workspace
├── docs/                         # local-development, environment-variables, deployment, background-jobs
├── .github/workflows/ci.yml
├── vercel.json
├── package.json                  # root: backend deps + all orchestration scripts
├── tsconfig.json                 # shared strict base
├── tsconfig.server.json          # backend typecheck scope
├── vitest.config.ts              # unit + integration projects
├── eslint.config.js              # backend lint
├── .env.example                  # DEPLOYED variable catalog (placeholders only)
├── .env.local.example            # LOCAL variable catalog (placeholders only)
├── run.ps1                       # optional one-command Windows local runner
└── .gitattributes                # LF everywhere; *.ps1 CRLF
```

---

## 3. Vercel configuration

### 3.1 `vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run typecheck && npm run build:ui",
  "outputDirectory": "src/ui/dist",
  "rewrites": [
    { "source": "/api/v1/:path*", "destination": "/api/v1" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "functions": {
    "api/v1/index.ts":  { "maxDuration": 30 },
    "api/cron/*.ts":    { "maxDuration": 60 },
    "api/queue/*.ts":   { "maxDuration": 60 }
  }
}
```

Rules and the reasons behind them:

- **One project** builds the SPA (Vite) and the functions (`api/`) together. The build runs the backend typecheck first, so a type error fails the deploy.
- **The whole versioned API is one function.** Vercel's zero-config `api/` routing outside Next.js has **no catch-all filename syntax**. `[...slug].ts` compiles to a single-segment regex, so nested paths 404 before the function runs. Use a plain `api/v1/index.ts` plus the `/api/v1/:path*` → `/api/v1` rewrite. A rewrite only selects the function, and the function still receives the original URL, so Hono routes on real paths.
- **SPA fallback rewrite** `/((?!api/).*)` → `/index.html` lets deep links and hard refreshes load the app.
- **Never add a `crons` key.** Scheduling lives in the database (see §9). Add a regression test that fails if `vercel.json` gains one.
- **Security headers are set in the Hono app, not `vercel.json`,** because they depend on typed config (HSTS is emitted only when `APP_ENV !== 'local'`) and must also appear on error responses.
- Add an integration test that asserts the rewrites and function entrypoints exist. Local dev and tests call the Hono app directly, so nothing else exercises Vercel's routing layer.

### 3.2 Function entrypoint shape

- Every file in `api/` exports `export const config = { runtime: 'nodejs' } as const;`.
- **Use named HTTP-method exports (`export async function GET(request: Request)` / `POST`), never `export default`.** On Vercel's Node runtime, a default export is invoked with the legacy `(req, res)` signature, which breaks Web `Request`/`Response` code.
- `api/v1/index.ts` builds the Hono app **lazily and caches it per cold start**. If configuration fails, it returns a sanitized 500 problem+json with a correlation id instead of crashing at module load. It wires every domain's `defaultXxxDeps()` into `buildApp({...})` and wraps the result with `handle()` from `hono/vercel`.
- Entrypoints contain no logic. They delegate to `src/server/...`, so everything can be tested without a server.

### 3.3 Serverless constraints the code must respect

- Function instances are short-lived and may be recycled or duplicated at any time. Keep no business state in module scope. The only allowed module-level caches are cold-start caches holding no request data: parsed config, DB pool, supabase-js clients, JWKS, and the built Hono app.
- Never rely on in-memory caches for correctness.
- All long work is split into small, bounded, idempotent units that finish well inside `maxDuration`.

---

## 4. TypeScript and tooling conventions

### 4.1 Root `tsconfig.json` (shared base)

```json
{
  "compilerOptions": {
    "target": "es2023", "lib": ["ES2023"],
    "module": "nodenext", "moduleResolution": "nodenext", "moduleDetection": "force",
    "verbatimModuleSyntax": true, "resolveJsonModule": true, "types": ["node"],
    "skipLibCheck": true, "noEmit": true,
    "strict": true, "noUncheckedIndexedAccess": true, "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true, "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true, "noUnusedParameters": true, "forceConsistentCasingInFileNames": true
  }
}
```

- `tsconfig.server.json` extends it and includes `api/**/*.ts`, `src/server/**/*.ts`, `scripts/**/*.ts` and `vitest.config.ts`. It excludes `src/ui` and `e2e_tests`.
- Backend imports use explicit `.js` extensions (NodeNext ESM).
- There is no build step for the backend. Vercel compiles functions, and scripts run through `tsx`.
- The SPA has its own `tsconfig.app.json` (`moduleResolution: bundler`, `jsx: react-jsx`, `types: ["vite/client"]`, `strict`, `noUncheckedIndexedAccess`, `erasableSyntaxOnly`).

### 4.2 ESLint (backend, flat config)

- `@eslint/js` recommended + `typescript-eslint` recommended over `api/`, `src/server/` and `scripts/`.
- `@typescript-eslint/no-explicit-any: error`. Do not use `any` anywhere.
- `@typescript-eslint/consistent-type-imports: error`.
- `no-console: error` (except `warn`/`error`). Use the logger.
- `no-restricted-properties` bans `process.env` everywhere except `src/server/lib/config/index.ts`.
- The SPA has its own ESLint config (react-hooks, react-refresh, prettier).

### 4.3 Root `package.json` scripts (names to reproduce)

```
dev                 node scripts/dev/dev.mjs            # API runner :3001 + Vite :5173
dev:api             tsx --env-file-if-exists=.env.local scripts/dev/serve-api.ts
dev:vercel          vercel dev
supabase:start      node scripts/db/ensure-signing-keys.mjs && supabase start
supabase:stop       supabase stop
supabase:reset      node scripts/db/ensure-signing-keys.mjs && supabase db reset
db:migrate          supabase migration up --local
db:validate         migration-from-clean + schema snapshot diff
db:seed             baseline seed via DIRECT url (supports --env=)
db:seed:demo        demo dataset (refuses production)
db:cron:configure   writes job_cron_config (origin + secrets) for pg_cron
db:admin:create     bootstrap first admin user (prints password once)
db:types            regenerate DB types; db:types:check fails on drift
typecheck           tsc -p tsconfig.server.json
typecheck:ui / lint / lint:ui / build:ui
test                vitest run   (test:unit, test:integration projects)
ci:security         scan-secrets + scan-bundle
ci:test             ci:security + run backend suite, fail on ANY skipped test, enforce a test-count floor
ci:test:ui          same for SPA suite
test:e2e / test:e2e:smoke
cron:list / cron:run <job> / cron:run:all
queue:worker / queue:enqueue:test / jobs:status
```

All scripts that need env use `tsx --env-file-if-exists=.env.local`, which is Node's built-in loader, so no `dotenv` is needed. The Supabase CLI is **pinned as a devDependency** (`"supabase": "<exact version>"`), not installed globally, so laptops and CI run the same CLI.

Runtime dependencies are deliberately few: `hono`, `kysely`, `pg`, `zod` and `@supabase/supabase-js`, plus a library for any required file format (for example `exceljs`). Dev dependencies: `typescript`, `tsx`, `vitest`, `eslint`, `typescript-eslint`, `@types/node`, `@types/pg`, `jsdom`, `globals` and `supabase`.

---

## 5. Backend architecture

### 5.1 Request pipeline (Hono app, `lib/router/app.ts`)

`buildApp(deps)` takes every dependency explicitly, with no globals, so tests build the app with fakes. It registers middleware in this order:

1. **Security headers** (after `next()` so they survive replaced responses). HSTS is sent only in deployed environments.
2. **Request context.** Resolve or generate the correlation id from `x-correlation-id`/`x-request-id`, attach a request-scoped child logger, and echo `x-correlation-id` on the response.
3. **Request log line** (in a `finally`): method, route pattern, status, durationMs, userId, tenantId.
4. **Error boundary.** Any thrown error becomes RFC 7807 `application/problem+json`. The real error is logged server-side and a sanitized message goes to the client.
5. **Alternate-credential routes** (for example API-key-authenticated ingestion), mounted *before* auth so they never pass through the session-auth chain.
6. **Authentication.** Verify the bearer JWT, then resolve an *active* application user row. Unknown or inactive user → 401. Explicit public paths (for example `/api/v1/health`) are allow-listed. Unknown routes return 404, not 401.
7. **Tenant context** (multi-tenant apps). Read `X-Tenant-Id`, validate it server-side against membership and the tenant's active state, and return one identical 403 for every failure so the response can't be used to learn which tenants exist. Cross-tenant access by privileged internal users is audited *before* the handler runs. Certain path prefixes (`/me`, `/tenants`, `/global`) are exempt.
8. **Permission resolution.** Compute the effective permission set for (user, tenant). Routes then call a `requirePermission('code')` guard. A missing permission returns 403.
9. Domain routers mounted under `/api/v1` via `app.route(...)`.

Environment typing lives in `lib/router/env.ts` (the Hono `Variables`: correlationId, logger, userId, tenantId, auth context and permissions).

### 5.2 Domain module shape (`src/server/domains/<domain>/`)

Keep feature code together and boring:

```
index.ts        # public surface + defaultXxxDeps() factory wiring real implementations
routes.ts       # Hono router factory: xxxRoutes(deps) → parse input, call service, map Result → HTTP
schemas.ts      # zod request/response schemas + DTO types
service.ts      # business logic; returns Result<T, DomainError> for expected failures
repository.ts   # Kysely queries (tenant-scoped via forTenant)
errors.ts       # domain error codes
workflow/       # state machines / legality matrices where relevant
```

- **Dependency injection is plain function arguments.** Each domain exports a `Deps` interface and a `defaultXxxDeps()` that binds production implementations. There is no DI container.
- Do not add abstractions without two real implementations or a clear test seam. The storage adapter (supabase + fake) and queue adapter (pgmq + in-memory) are the model examples.

### 5.3 Errors and results

- `lib/result.ts`: `Result<T, E> = { ok: true, value } | { ok: false, error }` with `ok`, `err`, `mapOk`, `mapErr`, `andThen` and `collect`. Use it for **expected** business failures (conflicts, illegal transitions, invalid references).
- Exceptions are reserved for unexpected failures. The error boundary turns them into a 500.
- `lib/errors`: typed `AppError` subclasses carry `status`, `code`, optional `fieldErrors` and optional extras.
- **problem+json shape:** `{ type, title, status, detail?, code?, errors?: [{ field, code, message }], correlationId }`. Every 5xx has a constant sanitized `detail` ("An unexpected error occurred. Quote the correlation id…"). No stack, SQL or connection string ever reaches the client.
- Validation failures return 422 with a structured `errors[]`. The convention is a zod message of the form `"CODE|message"`, which a helper splits into `{ field, code, message }`.
- Zod gotcha: never write required fields as `.nullish().refine(...)`. Optional schemas short-circuit on `undefined` and the refine never runs. Declare required fields as required.

### 5.4 Configuration (`lib/config/`)

- `schema.ts` defines one zod schema for the **entire** server environment. `index.ts` exposes `loadConfig(env)` (pure, testable) and `getConfig()`, which parses once per cold start and deep-freezes the result. A failed parse is not cached.
- On failure it throws a `ConfigurationError` listing **every** bad variable by name and never returns partial config.
- Blank values are treated as unset. Optional variables use a `blankAsAbsent()` wrapper so a blank entry in the secret store doesn't take down every function.
- `tryGetConfig()` is a non-throwing variant, used only by the logger so it can report config failures.
- `APP_ENV` ∈ `local | dev | preview | staging | production` (defaults to `local`). The only behavioral branch is `!== 'local'`.
- **Only this module may read `process.env`.** This is enforced by an ESLint rule *and* by an integration test that scans the source.
- Adding a variable requires changing four things together: `schema.ts`, `.env.example`, `.env.local.example` and `docs/environment-variables.md`. A test enforces that the example files list exactly the keys the schema reads.

### 5.5 Logging (`lib/logging/`)

- Hand-rolled, with no dependency. Each call writes one JSON object on one line to stdout, which Vercel runtime logs ingest.
- Fields: timestamp, level, message, env and correlationId, plus a context object. `logger.child(ctx)` returns a scoped logger.
- Every value passes through a **redactor** that masks sensitive keys (token, authorization, password, secret, key, cookie, email and similar) and scrubs secret-looking substrings. Never log tokens, auth headers, passwords, PII or confidential business data. Tests assert this using fixtures that contain fake secrets.

### 5.6 Database access (`lib/db/`)

**Two connection strings, and the split is load-bearing:**

| Variable | Deployed target | Used by |
|---|---|---|
| `SUPABASE_DATABASE_URL` | Supavisor **transaction** pooler, port **6543** | all request and job traffic (`getDb()`) |
| `SUPABASE_DIRECT_DATABASE_URL` | Supavisor **session** pooler, port **5432** | migrations, seeds, codegen, admin scripts (`createDirectDb()`) |

- Use the **pooler hostname for both** (`aws-<region>.pooler.supabase.com`), not `db.<ref>.supabase.co`. The direct host is IPv6-only unless you pay for the IPv4 add-on, and GitHub runners are IPv4-only.
- Locally, both point at `127.0.0.1:54322` (the local pooler is disabled).

**Pool settings for transaction pooling (`pool.ts`):**

- `max: 2` per instance. Supavisor does the real pooling, and many concurrent Vercel instances each holding 10 connections would exhaust it. `idleTimeoutMillis: 10000`, `connectionTimeoutMillis: 10000` and `allowExitOnIdle: true`.
- **No named prepared statements.** Kysely's unnamed extended-query path is safe. A test asserts `pg_prepared_statements` stays empty.
- **No session state:** no `LISTEN/NOTIFY`, no session advisory locks, no bare `SET`, and no temp tables across statements. Use `SET LOCAL`, `pg_advisory_xact_lock()` and `SELECT … FOR UPDATE` *inside a transaction* only. A source-scanning test enforces this.
- No `options` startup parameter, and no AbortSignal query cancellation (`pg_cancel_backend` is unsafe under transaction pooling).
- Type parsers: `int8` is parsed to a JS number and throws above `MAX_SAFE_INTEGER`. `numeric` stays a **string** because money must not pass through floating point.
- Direct pool: `max: 1`.
- Attach a pool `'error'` listener so an idle-client error doesn't crash the instance.

**Clients (`client.ts`):** `getDb()` is a cached, pooler-safe Kysely instance. `createDb({connectionString})` is used for tests. `createDirectDb()` is used by scripts, and the caller must close it.

**Transactions (`transactions.ts`):** `withTransaction(db, fn)` wraps every multi-statement business operation. Keep callbacks short, make no network calls inside, and rethrow errors unchanged.

**Generated types (`npm run db:types`):**

1. `generated/supabase-types.ts` is the verbatim `supabase gen types typescript --local` output.
2. `generated/column-overrides.ts` is queried from `information_schema` and lists `numeric` columns whose runtime type is `string`.
3. `generated/tenant-scoped-tables.ts` lists every table with a `tenant_id` column.

`kyselify.ts` is a type-only adapter that maps the `{ Row, Insert, Update }` triples to Kysely `ColumnType`s. A drift test fails if the committed generated files don't match the live schema.

**Tenant scoping (multi-tenant apps, `tenant.ts`):**

- `TenantId` is a **branded** number, and `toTenantId()` is the only constructor (it validates). A raw number will not type-check.
- `forTenant(db, tenantId)` returns scoped `selectFrom/updateTable/deleteFrom/insertInto` helpers. The helper applies the table-qualified `tenant_id = ?` predicate, and `insertInto` injects `tenant_id` while its type forbids the caller from supplying one.
- `tenantPredicate(table, tenantId)` is used for complex joins and CTEs.
- A compile-time assertion checks that the generated tenant-table list matches the schema in both directions. Type tests (`@ts-expect-error`) prove that omitting the tenant fails to compile.
- There is no ambient or global "current tenant". The tenant is always an explicit argument.

### 5.7 Authentication (Supabase Auth)

- **Browser:** supabase-js is used **only for auth**. It covers email/password sign-in, the password-reset flow, session persistence and automatic token refresh. The SPA reads the access token *per request* and sends `Authorization: Bearer <jwt>`. The browser never uses the Data API, Storage or Realtime.
- **Server verification (`lib/auth/verify.ts`)**, cheapest and most suspicious checks first:
  1. decode the unsigned header (malformed → reject)
  2. algorithm allow-list (asymmetric only, blocking `none`/HS* downgrade)
  3. resolve `kid` against a cached JWKS (unknown → reject, no network round-trip)
  4. `supabase.auth.getClaims(token, { keys: [key] })`, which is pure local WebCrypto plus an exp check
  5. pin `iss` to the project's auth URL
- The verified token yields `authUserId` (`sub`), which maps to an application `users.auth_user_id` row. The app user must exist and be active.
- **Asymmetric signing keys (ES256)** are used locally and in hosted projects. `SUPABASE_JWT_SECRET` is intentionally absent. Locally, `scripts/db/ensure-signing-keys.mjs` generates `supabase/signing_keys.json` (git-ignored) because `config.toml` sets `signing_keys_path` and the CLI refuses to run without the file. CI's migrate job also generates one just to satisfy config parsing.
- **Server-side supabase-js clients (`lib/supabase/clients.ts`)** are memoized per (url, key), with `persistSession: false`, `autoRefreshToken: false` and `detectSessionInUrl: false`:
  - the *verification* client uses the anon key and is only used for `getClaims`
  - the *admin* client uses the service-role key and is used for the Auth Admin API (user provisioning) and Storage
- Self-signup is **disabled**. Users are provisioned by administrators through the Auth Admin API. Sign-in errors return one generic message so the form can't be used to discover which accounts exist.
- 401 means no or invalid token, or an unknown or inactive user. 403 means an authenticated, active user who lacks a permission or tenant access. Rejection details go to the server log only.

**Bootstrapping:** a fresh environment has no users. `npm run db:admin:create -- --email … --env=production` (run by an operator holding the service-role key) creates one super-admin and prints a generated password once. Everything after that happens in the app.

### 5.8 Authorization (RBAC pattern)

- Permissions are a fixed, code-owned catalog seeded by `supabase/seed.sql`.
- The effective permission set is computed server-side per request (direct grants, roles and groups, per tenant when multi-tenant). Every protected route declares `requirePermission(...)`.
- Frontend navigation hides items based on permissions, but the backend is always the authority. Treat the UI as hostile, and never trust tenant, user, role or permission IDs from the browser without server-side verification.
- Audit privileged actions to an `audit_log` table (who, what, tenant, when, correlation id).

### 5.9 File storage (`lib/storage/`)

- `StorageAdapter` interface: create signed upload URL, create signed download URL, stat, delete.
- `SupabaseStorageAdapter` uses the service-role client against **private** buckets that are created **by migration** (`storage.buckets` insert), never by hand.
- `FakeStorageAdapter` is in-memory and used for tests and local development. Composition **throws** if `STORAGE_ADAPTER=fake` is selected when `APP_ENV !== 'local'`.
- Object keys are tenant-prefixed and file names are sanitized. The domain authorizes *before* calling the adapter, because the adapter itself performs no checks.
- Uploads use a two-step envelope: the client gets a signed upload URL for a "pending" row, uploads directly to Storage, then confirms. A cron job reaps pending uploads that were never confirmed.
- One conformance test suite runs against both adapters.

---

## 6. Database and migrations (Supabase PostgreSQL)

### 6.1 Migration rules

- Migrations are plain SQL in `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql`, applied in filename order by the Supabase CLI (`supabase db reset` locally, `supabase db push` for hosted projects).
- **Append-only and forward-only.** Never edit an applied migration. Fix problems forward with a new migration (`CREATE OR REPLACE`, `ALTER`). Rollback means writing a corrective migration.
- Each migration starts with a header comment covering its purpose, ownership/task id, rollback and recovery notes, and anything non-obvious.
- The first migration (lowest timestamp) installs extensions **by migration, not by dashboard**, so every environment has them:
  ```sql
  create schema if not exists extensions;
  create extension if not exists pg_cron;                       -- installs into schema `cron`
  create extension if not exists pg_net with schema extensions; -- functions live in schema `net`!
  create extension if not exists pgmq;                          -- installs into schema `pgmq`
  ```
- Migrations must be idempotent enough to run twice from empty (`db:validate` runs the reset twice).
- Use relational tables, constraints, foreign keys and indexes for core data. Do not store queryable business fields in JSONB. Add indexes for every access pattern: tenant + status, date ranges, and job scans.
- Money uses `numeric`. Identity keys use `bigint generated … as identity`.

### 6.2 Multi-tenant data pattern (if the new app is multi-tenant)

- Every tenant-scoped table has a non-null `tenant_id` foreign key to `tenants`.
- Large tenant-scoped tables are **`PARTITION BY LIST (tenant_id)`**. A SQL function discovers every table partitioned by `tenant_id` from `pg_partitioned_table` and creates that tenant's partitions with `CREATE TABLE IF NOT EXISTS`. Tenant creation calls it **in the same transaction** as the tenant insert, so a rolled-back tenant leaves no orphan partitions. Calling it again is safe, and that is how backfill works.
- Tenants are soft-deleted.
- Tenant-configurable reference data (lookup lists) lives in structured tables with a global default template copied into new tenants. Disabled values are kept so historical records still display them.

### 6.3 Data API lockdown (RLS is not the isolation mechanism)

- Tenant isolation is enforced **in the application layer**: middleware, `forTenant` helpers and integration tests. RLS is not adopted (it could be added later as defense in depth).
- Therefore the PostgREST roles **`anon` and `authenticated` must have no SELECT/INSERT/UPDATE/DELETE on anything in `public`**, so the browser-visible anon key can't read data through the Supabase Data API.
- An integration test derives every table from the live catalog and asserts those privileges are absent, checking both `has_table_privilege` and `role_table_grants`. A stray `GRANT … TO anon` in a future migration fails the build.
- Secret-holding tables and `SECURITY DEFINER` functions explicitly `revoke all … from anon, authenticated`, and pin `search_path`.

### 6.4 Seeds (two layers)

1. **Baseline seed, `supabase/seed.sql`:** code-owned reference data only (permission catalog, global default templates). **It creates no users and no tenant data.** It is conflict-tolerant (`ON CONFLICT`) and transactional. It runs automatically after `supabase db reset` (`[db.seed] sql_paths`), and against deployed environments through `npm run db:seed -- --env=<env>`. That command extracts a delimited block from the same file and runs it in one transaction over the **direct** URL, so the data exists in only one place.
2. **Demo seed, `npm run db:seed:demo`:** a TypeScript script that creates demo tenants, personas (via the Auth Admin API) and realistic sample data that populates every screen.
   - It **refuses to run against production**, ever.
   - For non-local targets it requires `DEMO_SEED_PASSWORD` instead of re-publishing the committed local password.
   - Local personas use a known password (for example `test1234`) and `@<app>.local` emails.

**Seed target safety (`seed-target.ts`):** any non-local target requires an explicit `--env=<name>` that must equal the `APP_ENV` of the loaded config, so a stale flag cannot seed the wrong database.

### 6.5 Schema validation

`npm run db:validate` (destructive to local data) does four things:

- resets from empty twice
- scans CLI output for error markers, because the CLI has exited 0 on per-statement failures
- checks that the applied-migration list matches the files on disk
- dumps the `public` schema and diffs it against the committed `supabase/schema.expected.sql`

`--update-snapshot` rewrites the snapshot, and the diff should be reviewed before it's committed.

---

## 7. Local development (Supabase CLI + Docker)

### 7.1 Prerequisites

Node 22+ (npm 11+) and Docker Desktop/Engine running. Nothing else: the Supabase CLI comes from `npm install`.

### 7.2 Clean-checkout quick start

```bash
npm install
cp .env.local.example .env.local      # then paste values from `npx supabase status`
npm run supabase:start                # Postgres, Auth, Storage, Studio, Mailpit
npm run supabase:reset                # all migrations from empty + baseline seed
npm run db:seed:demo                  # optional demo dataset
npm run dev                           # API :3001 + SPA :5173
```

### 7.3 Local services (`supabase/config.toml`)

| Service | Address |
|---|---|
| SPA (Vite) | http://localhost:5173 |
| API runner | http://127.0.0.1:3001/api/v1 (proxied by Vite) |
| Supabase API gateway | http://127.0.0.1:54321 |
| Postgres | 127.0.0.1:54322 (user/password `postgres`) |
| Studio | http://127.0.0.1:54323 |
| Mailpit (catches auth email) | http://127.0.0.1:54324 |

Notable `config.toml` settings:

- `[db] major_version = 17`; `[db.pooler] enabled = false`; `[db.seed] sql_paths = ["./seed.sql"]`
- `[api] extra_search_path = ["public","extensions"]`
- `[realtime] enabled = false`; `[edge_runtime] enabled = false`; `[analytics] enabled = false`
- `[storage] enabled = true`
- `[auth] site_url = "http://localhost:5173"`, redirect URLs including `/reset-password`, `jwt_expiry = 3600`, `signing_keys_path = "./signing_keys.json"`, refresh-token rotation on, `enable_signup = false`, anonymous sign-ins off, MFA off, all external providers off, `[auth.email] enable_confirmations = false`

### 7.4 Local API hosting

- `scripts/dev/serve-api.ts` hosts **the same Hono app** as the Vercel function over `node:http`, bridging Node requests to Web `Request`/`Response` objects. It uses no extra dependencies. `vercel dev` (`npm run dev:vercel`) is the alternative reference runner.
- `scripts/dev/dev.mjs` spawns the API runner and the Vite dev server with prefixed, line-buffered output and a shared shutdown path. It is hand-rolled so no process-runner dependency is needed.
- The Vite config sets `envDir` to the **repo root** so the SPA reads `VITE_*` values from the root `.env.local`. It proxies `/api/v1` (and `/api/cron` for manual testing) to `http://127.0.0.1:3001`, so the browser sees one origin and no CORS configuration is needed. The SPA calls relative `/api/v1/...`.
- Add a `run.ps1` (Windows) one-command runner with `-Reset`, `-Demo` and `-StopDb` switches. `.gitattributes` keeps `*.ps1` as CRLF and everything else LF.

### 7.5 Local background jobs

`pg_net` runs inside the Docker container and can't reach the host dev server, so the pg_cron schedules are **deliberate no-ops locally** (the config table is empty and they raise a NOTICE). Locally, run the jobs through the same handler code:

- `npm run cron:run -- <job>`, `npm run cron:run:all`
- `npm run queue:worker` (supports `--once` and `--idle-exit`), `npm run queue:enqueue:test`
- `npm run jobs:status` shows job history, recent failures, stale runs, queue backlog, oldest-message age and dead-letter count (supports `--json`)

---

## 8. Environment variables and secrets

### 8.1 Server catalog (validated by the config schema)

| Variable | Purpose |
|---|---|
| `APP_ENV` | `local`/`dev`/`preview`/`staging`/`production`. Must be set explicitly when deployed. |
| `NODE_ENV` | optional; Vercel sets `production` |
| `LOG_LEVEL` | optional, defaults to `info` |
| `SUPABASE_URL` | project URL |
| `SUPABASE_ANON_KEY` | server-side token verification client |
| `SUPABASE_SERVICE_ROLE_KEY` | Auth Admin API and Storage. **Server only.** |
| `SUPABASE_DATABASE_URL` | transaction pooler (6543) |
| `SUPABASE_DIRECT_DATABASE_URL` | session pooler (5432) |
| `CRON_SECRET` | bearer secret for `/api/cron/*` |
| `INTERNAL_JOB_SECRET` | bearer secret for `/api/queue/drain`. Must be distinct from `CRON_SECRET`. |
| `STORAGE_ADAPTER`, `STORAGE_<BUCKET>` | optional, defaults to `supabase` / the migration-created bucket |
| app-specific secrets | for example an API-key hashing pepper (minimum length, write-once per environment) |

Script-only variables that are **not** in the app schema:

- `JOB_CRON_BASE_URL` (a stable deployed origin for pg_cron callbacks, never a per-deployment preview URL)
- `DEMO_SEED_PASSWORD`
- the CLI's `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD`

Browser-safe variables (compiled into the SPA): `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only.

Intentionally absent: `SUPABASE_JWT_SECRET` (asymmetric keys are used instead) and any error-tracking DSN.

### 8.2 Files

- `.env.example` is the **deployed** catalog. It contains placeholders only, is alphabetical `KEY="value"` to match a Doppler export, and has heavy comments explaining each variable's purpose and pitfalls.
- `.env.local.example` is the **local** catalog. Values come from `npx supabase status`. Even local examples must not contain an inline connection-string password (use `<local-db-password>`), and a test enforces this.
- The root `.gitignore` ignores `.env`, `.env.*` except the two examples, plus `.vercel/`, generated schema dumps, `*.tmp.ts`, and Playwright output. `supabase/.gitignore` ignores `signing_keys.json`, `.branches` and `.temp`.

### 8.3 Secret management flow

**Doppler** (one project, with configs such as `dev` and `prd`) is the single source of truth. It syncs outward:

```
Doppler config  →  Vercel environment  →  GitHub Actions ENVIRONMENT (not repo secrets)
dev                Preview                dev
prd                Production             Production
```

Syncing to GitHub *environments* (not repository secrets) is what lets the same `${{ secrets.X }}` resolve to a different Supabase project per branch. Put required reviewers on the `Production` GitHub environment. Server secrets are marked as Vercel **Sensitive** environment variables.

### 8.4 Automated secret hygiene (`npm run ci:security`)

- `scripts/ci/scan-secrets.ts` walks `git ls-files` and fails on JWT-shaped keys, `sb_secret_`/service-role literals, or credentialed connection URLs in any tracked file.
- `scripts/ci/scan-bundle.ts` builds the SPA and fails if `src/ui/dist` contains any server variable name, service-role literal or `src/server` code fragment.
- Import-boundary tests prove `src/ui` cannot import `src/server/lib/supabase` or `src/server/lib/config`.

---

## 9. Background jobs: pg_cron + pgmq + Vercel functions

The rules: there is no resident worker, no in-memory schedules, no exactly-once assumptions, and no Vercel Cron.

### 9.1 Scheduling model

```
pg_cron (in Supabase)  ──►  SECURITY DEFINER helper  ──►  pg_net net.http_get / net.http_post
                                                         │  Authorization: Bearer <secret>
                                                         ▼
                                   Vercel function  api/cron/<job>.ts   (GET,  CRON_SECRET)
                                                    api/queue/drain.ts  (POST, INTERNAL_JOB_SECRET)
                                                         │
                                                         ▼
                                   src/server/jobs/...  (same code the local scripts run)
```

- Schedules are created **by migration** with `cron.schedule('<name>', '<cron expr>', $$select public.invoke_cron_endpoint('<job>')$$)`. The queue drain runs every minute (`* * * * *`).
- `public.job_cron_config` is a single-row table with `base_url`, `cron_secret` and `internal_job_secret`. It is **created empty by migration and never populated by a migration or seed**. It is written per environment by `npm run db:cron:configure -- --env=<env>` (run by CI's migrate job) or by an operator's SQL. When it's empty, the helpers `RAISE NOTICE` and return (the normal local state). Revoke the table from `public`, `anon`, `authenticated` and `service_role`. Only `postgres` and the `SECURITY DEFINER` helpers (with `search_path` pinned to `public, extensions`) can read it.
- **pg_net's functions live in schema `net`** (`net.http_get`, `net.http_post`), even though the extension is registered in `extensions`. Calling `extensions.http_get` fails silently at the scheduled minute.
- **Standing rule:** any `SECURITY DEFINER` function that calls an extension function must have an integration test that **executes** it. Inspecting `prosrc` or catalog rows is not enough.
- `JOB_CRON_BASE_URL` must be a **stable** origin (a custom domain or branch alias), never a per-deployment preview URL.
- Stagger dependent schedules. For example, offset two sweeps by 10 minutes when one writes a column the other reads.

### 9.2 Endpoint protection

- Validate `Authorization: Bearer <secret>` (or a bare secret) **before touching the database**, with a constant-time comparison of SHA-256 digests.
- Rejection returns an identical 401 problem document for a missing or wrong secret. Log only the reason, never the value. Write no `job_run` row and perform no queue read.
- Use two separate secrets (cron vs. queue) so a leak of one doesn't authorize the other.

### 9.3 Durable job state (tables)

- `job_run`: one row per execution *attempt* with job name, trigger (`cron`/`queue`/`manual`), environment (check constraint listing the `APP_ENV` values), correlation id, started/finished/duration, status, error message and `counts` (jsonb). An endpoint for a not-yet-implemented job writes a failed row and returns 501. It never reports fake success.
- `job_idempotency_key`: claimed dedupe keys for queue messages.

### 9.4 Cron sweeps (state-guarded reconciliation)

- Prefer **state-guarded** sweeps over idempotency keys. The query selects only rows still needing work, and doing the work removes them from the set, so re-runs are no-ops and a missed tick self-heals on the next one.
- Iterate per tenant (`tenant-iterator.ts`) and per item, each item in its own transaction that re-reads and re-checks state. One tenant or item failing doesn't stop the rest. The run is marked failed with the failing ids and partial counts.
- A registry (`jobs/cron/registry.ts`) maps job name to handler. `run-cron-job.ts` is shared by the HTTP endpoint and `npm run cron:run`.

### 9.5 Queues (pgmq)

- Create queues by migration: `select pgmq.create('<queue>')`, which also creates the archive table `pgmq.a_<queue>` used as the dead-letter queue.
- Lifecycle: `pgmq.send` → `pgmq.read(queue, vt_seconds, qty)` (visibility timeout; increments `read_ct`) → handler → `pgmq.delete` (ack). A failure leaves the message unacked and re-hides it for a retry delay. After `max_attempts` (for example 5) it is `pgmq.archive`d.
- An unparseable message is archived immediately. An *unknown message type* is retried, because a producer can be ahead of the consumer during a rolling deploy.
- **Per message, in ONE transaction:** claim the idempotency key (`INSERT … ON CONFLICT DO NOTHING`), run the handler writing only through that transaction, then ack. Commit publishes all three or none. A duplicate delivery finds the key claimed and is skipped. A failed attempt rolls back the claim, so the retry genuinely re-runs.
- **Idempotency keys must be unique per event, not per entity**. For example, `{entityId}:{historyRowId}`. A per-entity key permanently drops every later event.
- Payloads carry **ids only**, and the handler re-reads current state. Tenant id travels on the envelope.
- Publish **after** the business transaction commits. A publish failure never fails the user's request: it is logged, and a periodic reconciliation sweep is the safety net.
- **Time budget:** `drain()` processes bounded batches and stops taking new messages after about 25s (with `maxDuration` at 60s). Unprocessed messages reappear when their visibility timeout expires. Each message is attempted at most once per invocation.
- `QueueAdapter` interface with a `pgmq-adapter.ts` implementation and an `in-memory-adapter.ts` for unit tests.

### 9.6 Documenting jobs

`docs/background-jobs.md` records, for every job: name and purpose, schedule (UTC) or trigger, payload shape, idempotency strategy, retry and failure behavior, required database state, and logging/observability (one log line per tenant, counts on `job_run`, ids and counts only).

---

## 10. Frontend (React SPA, `src/ui`)

- React 18 functional components, TypeScript strict, Vite, Redux Toolkit (`store.ts`, typed `hooks.ts`, slices for session, filters and badges), React Router 7 (`router.tsx`, `RouteGuard.tsx` for auth and permission gating), and Recharts.
- Folders: `api/` (client), `app/` (store, router, slices), `auth/` (supabase client, AuthProvider, sign-in, forgot/reset password, permissions), `features/<feature>/`, `components/`, `pages/`, `theme/` and `test/` (setup).
- **Single API client module (`api/client.ts`).** Every call goes through `apiGet`/`apiPost`/`apiPut`, which:
  - attaches `Authorization: Bearer` with the token read per request
  - injects `X-Tenant-Id` from the Redux session (omitted for exempt prefixes)
  - normalizes problem+json into `{ status, title, fieldErrors[] }`
  - handles 401 by signing out or redirecting
  - uses the relative base URL `/api/v1`
- `auth/supabase.ts` is the one browser Supabase client, built only from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. It is used for authentication only. A boundary test asserts the browser client is never used for data, storage or realtime.
- Switching the active tenant (multi-tenant) clears or refreshes all tenant-scoped state.
- Permission-bound navigation is hidden or disabled in the UI, but authorization is always enforced by the backend.
- The Vite build output is `src/ui/dist`, which is Vercel's `outputDirectory`.
- Tests use Vitest + jsdom + React Testing Library + jest-dom (`setupFiles: ./src/test/setup.ts`), colocated as `*.test.ts(x)`.

---

## 11. Testing strategy

Vitest, with two projects in the root `vitest.config.ts`:

- **unit**: `src/server/tests/unit/**/*.test.ts`, node environment, no database.
- **integration**: `src/server/tests/integration/**/*.test.ts`, run against the **real local Supabase stack**, with `testTimeout`/`hookTimeout` of 180s, `fileParallelism: false` and a `globalSetup` that cleans leftovers (for example orphaned tenant partitions from earlier runs).
- Integration suites **skip themselves when the stack is unreachable** so a laptop without Docker isn't blocked. In CI, `scripts/ci/assert-test-run.ts` **fails on any skipped test** and enforces a **minimum test-count floor** (`--min-tests N`), so a stack that failed to boot can't produce a green build.
- **Type tests** (`src/server/tests/types/`) use `@ts-expect-error` to prove unsafe code doesn't compile (for example a missing tenant id).
- **Architecture and guard tests** (make these part of the template):
  - `process.env` is read only in the config module
  - no `any` (lint-gate test)
  - `vercel.json` has no `crons`, and rewrites and entrypoints are correct
  - Data API lockdown: `anon`/`authenticated` hold no DML privileges
  - pool safety: max ≤ 2 and no prepared statements
  - no session-state SQL (source scan)
  - generated DB types have not drifted
  - env example files match the config schema, and examples contain no inline passwords
  - server-only modules are unreachable from `src/ui`
  - the logger redacts sensitive fields
  - tenant isolation and permission enforcement (401/403) per sensitive endpoint
  - job idempotency, duplicate delivery and retry/archive behavior; SECURITY DEFINER helpers are **executed**
  - npm scripts (`db:seed`, `cron:run`, `queue:worker`, `jobs:status`) are spawned as real subprocesses
  - migration and seed reset
- **E2E:** Playwright workspace (`e2e_tests/`) with a `smoke` project (login, logout, shell) and a full suite. Playwright's `webServer` starts the app. Include axe accessibility checks.
- Test names state the behavior, condition and expected outcome, using AAA structure. Tests are deterministic, isolated, order-independent and CI-safe.

---

## 12. CI/CD (GitHub Actions, `.github/workflows/ci.yml`)

Triggers: push on all branches, pull requests, `workflow_dispatch`. `permissions: contents: read`. `env: DO_NOT_TRACK: '1'` suppresses Supabase CLI telemetry timeouts.

**Concurrency:** group per ref, with `cancel-in-progress` **except on `main` and `dev`**. Cancelling a running `db push` could leave a hosted schema half-migrated.

**Job `verify`** (ubuntu-latest, Node 22 with npm cache, a single job because the integration suite needs the stack started earlier in the same job). Steps are ordered cheap-to-expensive:

1. `npm ci`, print toolchain versions
2. backend typecheck → SPA typecheck → backend lint → SPA lint
3. SPA tests (`ci:test:ui`, fail on skip, count floor) → SPA production build
4. `ci:security` (secret scan + bundle leak scan)
5. `npm run supabase:start` → `npm run supabase:reset` (fresh every run; the Docker volume is not cached, because migrating from clean is what's under test)
6. write a throwaway `.env.local` from `npx supabase status -o env` for the subprocess scripts
7. backend unit + integration (`ci:test`: fail on skip, count floor)
8. `db:validate` (destructive, so it runs last)
9. `supabase:stop` (`if: always()`)

**Job `migrate`** (`needs: verify`, **push events only** on `main`/`dev`, never on PRs):

- `environment: ${{ github.ref_name == 'main' && 'Production' || 'dev' }}`, with GitHub environment secrets synced from Doppler
- own concurrency group, **never cancelled**
- `APP_ENV` is derived from the **branch**, not the secret store
- steps:
  1. generate a local signing key (required only for CLI config parsing)
  2. `npx supabase link --project-ref $SUPABASE_PROJECT_REF`
  3. `npx supabase db push --dry-run` (logs pending migrations as an audit trail)
  4. `npx supabase db push --yes`
  5. `npm run db:seed -- --baseline --env=$APP_ENV`
  6. `npm run db:cron:configure -- --env=$APP_ENV`, skipped (not failed) when `JOB_CRON_BASE_URL` is unset
- the CLI password is passed as the env var `SUPABASE_DB_PASSWORD`, never as `--password`
- every write step is safe to re-run

**App deploy is not in CI.** Vercel's Git integration builds on push, with a preview per PR/branch, `main` as production and `dev` added as a deploy branch. It deploys in parallel with `migrate`. That is safe for additive expand/contract migrations. Breaking schema changes need human sequencing, or a `vercel deploy` step behind `needs: migrate` with the Git integration disabled.

An optional `e2e_smoke` job is kept commented out, ready to enable: its own stack, demo seed, `playwright install chromium`, then `test:e2e:smoke`.

---

## 13. Environments

| Environment | `APP_ENV` | Supabase | Vercel | Branch |
|---|---|---|---|---|
| Local | `local` | CLI stack in Docker | `npm run dev` / `vercel dev` | any |
| Dev / Preview | `dev` / `preview` | shared **non-production** project | Preview deployments | `dev`, PR branches |
| Production | `production` | dedicated production project | Production | `main` |

- One Supabase project per persistent environment. Preview and staging **never** reach the production project or production data.
- Per hosted Supabase project:
  - extensions come from migrations
  - enable **asymmetric JWT signing keys**
  - set the Auth Site URL and redirect URLs to the deployed origin(s)
  - keep self-signup disabled
- **Post-deploy smoke:**
  - `GET /api/v1/health` returns `200 {"status":"ok","version":"v1"}`
  - sign-in works
  - responses carry `x-correlation-id`, and the same id appears in Vercel logs
  - manually invoke each cron endpoint with the secret and confirm a `job_run` row appears
  - `cron.job_run_details` shows the schedules firing
- **Rollback:** promote the previous Vercel deployment (functions are stateless). The database is forward-only, so ship corrective migrations. To pause jobs, clear `job_cron_config` rather than dropping cron rows.

---

## 14. Security checklist

- Zero trust at every boundary: validate all input with zod, and treat the SPA as hostile.
- Service-role key, DB URLs, cron/job secrets and peppers are server-only. The browser gets only the anon key and URL.
- Every protected endpoint enforces authentication, permissions and, where relevant, tenant scope server-side.
- Error responses and auth/tenant rejections are uniform, so they don't reveal which accounts or tenants exist.
- Security headers come from the app. HSTS is sent only in deployed environments.
- Job endpoints are bearer-protected with constant-time comparison.
- Audit privileged and admin actions and cross-tenant access.
- Never log secrets, tokens, auth headers or PII. The redactor is mandatory.
- No custom cryptography. Use WebCrypto via supabase-js, and Node `crypto` for hashing and constant-time comparison.
- Use only permissive-license dependencies. Adding any new dependency requires approval.

---

## 15. Documentation to create in the new repo

- `README.md`: stack summary, prerequisites, quick start, local services table, demo users, testing commands, deployment overview, doc index.
- `docs/local-development.md`: full clean-checkout runbook and troubleshooting.
- `docs/environment-variables.md`: every variable, its tier (Vercel Sensitive / browser-safe / script-only), and where it comes from.
- `docs/deployment.md`: environment model, Vercel project shape, per-environment checklist, smoke tests, rollback.
- `docs/background-jobs.md`: scheduling model and the per-job table (see §9.6).
- `CLAUDE.md` / agent instructions: the conventions in this brief, plus "never run git operations" if the human owns git.
- Code comments: explain *why* at the top of non-obvious modules (pool settings, routing workarounds, security decisions). Don't narrate obvious code.

---

## 16. Build order for the new app (suggested)

1. Repo skeleton, workspaces, tsconfigs, ESLint, Vitest projects, `.gitattributes`/`.gitignore`, pinned Supabase CLI.
2. `supabase init` → `config.toml` as in §7.3. Extensions migration. Signing-key script.
3. Typed config module + env example files + the env-access lint rule and test.
4. Logger + redactor, Result type, errors/problem+json, validation helpers.
5. DB layer: pool config, `getDb`/`createDirectDb`, `withTransaction`, type generation, tenant helpers (if multi-tenant), guard tests.
6. Hono `buildApp` with the middleware chain, `/health`, `api/v1/index.ts`, `serve-api.ts`, `dev.mjs`, `vercel.json`.
7. Supabase Auth: JWKS verification, auth middleware, app-user lookup, permission guard, admin-bootstrap script.
8. SPA shell: Vite + proxy + envDir, auth pages, Redux store, API client, route guards.
9. Job platform: `job_run`, idempotency table, pgmq queue, `job_cron_config`, the invoke helpers, cron/drain endpoints, local scripts, tests that execute the helpers.
10. Storage adapter + private bucket migration, if files are needed.
11. Seeds (baseline + demo), `db:validate` + schema snapshot, CI security scans.
12. GitHub Actions `verify` + `migrate`, Doppler → Vercel/GitHub sync, Vercel project settings.
13. Then build business domains, following the domain module shape in §5.2.
