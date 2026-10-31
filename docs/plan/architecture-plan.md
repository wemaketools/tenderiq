# TenderIQ — Architectural Plan (build contract)

Status: APPROVED by the owner on 2026-09-29 (revision 3: prototype-first delivery; owner decisions of 2026-09-29 applied — real Supabase Auth in Stage A, Node 24, SMTP email channel via Mailpit locally). Awaiting owner approval before any application code is written. **Amended 2026-10-30 (DD-50, §11 item 11):** Stage A is a fully static prototype with no Supabase and no Docker; real Supabase Auth moves to Stage B.
Inputs: `docs/PRD.md` (business), `docs/architecture-brief.md` (technical, followed literally), `docs/css` + `docs/screenshots` (visual style).
Companions: `docs/plan/design-decisions.md` (decision log DD-01 … DD-50 (DD-38 withdrawn, superseded by DD-43; DD-43 superseded for Stage A by DD-50); it amends this plan and the blueprint and wins on conflict), `docs/plan/schema-blueprint.md` (database), `docs/plan/demo-storyline.md` (demo dataset), `docs/technical/` (technical documentation), `docs/plan/tenderiq-prototype.workflow.js` (Stage A), `docs/plan/tenderiq-backend.workflow.js` (Stage B, draft).

Every build agent reads this file first. Where this plan and the architecture brief disagree, the brief wins unless §11 lists an approved deviation.

---

## 0. Delivery stages and the human approval gate

TenderIQ is delivered in two stages. **A human approval sits between them.**

| Stage | What is built | What is NOT built | Ends with |
|---|---|---|---|
| **A: UI prototype** | Repository skeleton; the complete SPA (every in-scope screen, navigation, design system, all states); **typed API contracts** for every endpoint the UI calls (`src/contracts`); a **mock API** (Hono, same URL surface) that runs **in the browser** and serves **static fixture data** from the demo storyline; **sign-in by persona picker** (DD-50); UI, contract and E2E tests; a screen walkthrough; technical docs synced to the as-built contracts | Database schema, migrations, Storage wiring, real business logic, jobs, seeds, Supabase (including Auth) and Docker (DD-50) | A static prototype you can click through with `npm run dev:prototype` and deploy to Vercel as static files, `docs/prototype/walkthrough.md` (screenshot per screen), and a **STOP**. |
| ⛔ **Approval gate** | The owner reviews the prototype and either approves or requests changes. Change requests run as a UI-iteration workflow. **Stage B is never launched without explicit written approval.** | — | "Stage A approved" |
| **B: Full backend** | Schema from the blueprint, platform layer, shared services, real domain backends implementing the **same contracts**, the local Supabase stack and **real Supabase Auth** (introduced in Stage B, DD-50: the stack, `auth:personas`, supabase-js sign-in and recovery in the SPA, JWT verification), the auth middleware and app-user resolution, the storage and job platform, demo seed, and full QA | — | A production-ready build passing `npm run build`, `npm run verify` and E2E |

Rules that make the gate meaningful:
- **Contracts are the hand-off.** Stage B implements the Stage A contracts. A contract change in Stage B needs a recorded reason and a UI update in the same unit. The contract-conformance tests run the same zod response schemas against the mock and the real API.
- **The mock API stays** after Stage B as a development and test tool (`npm run dev:prototype`, and Playwright visual tests). In Stage A the production build **is** the static prototype and includes it (DD-50). From Stage B, the production build and `api/` never include it.
- **Static means static.** The mock API returns fixture data. It filters and paginates the fixtures per tenant, persona and query, but it **persists nothing**. Commands (approve, submit, publish…) validate the request against the contract and return a contract-valid static response, for example the fixture receipt for a submission. A visible **"Prototype — static demo data"** banner is always shown when the SPA is served by the mock API (the API reports its mode in `/api/v1/me/context`).

## 1. Product identity

- Name: **TenderIQ** — sub-brand "Tender Intelligence", in the same visual family as QuoteIQ ("Quotation Intelligence").
- Sidebar header pattern: `<TENANT NAME (PILOT)>` over the wordmark `Tender` + accent `IQ` over the sub-brand (see `docs/screenshots/overview.png`).
- Demo locale: Botswana (BWP, `Africa/Gaborone`). Money always carries its currency code.

## 2. Release scope

**In scope (both stages). This is PRD §22 "Core end-to-end release" plus the public portal, supplier journeys, reporting, records, and platform operations:**
FR-01 … FR-19, FR-21, FR-22. BR-01 … BR-48. Screens COM-01…09, PUB-01…07, SUP-01…24, BUY-01…35, EVA-01…06, CON-01…11, ADM-01…17, OPS-01…07, REP-01…02. Acceptance scenarios AC-01 … AC-36 and AC-39. Stage A demonstrates every screen. Stage B makes every acceptance scenario true.

**Deferred optional extensions.** The PRD labels these "Extension" and §22 places them after the core release:
FR-20 frameworks/call-offs (CON-12), EXT-01 joint procurement, EXT-02 reverse auctions, EXT-03 assisted content review, and construction-specific schedules. AC-37 and AC-38 are out of scope. Deferred items never appear in the UI as dead links.

**"No placeholder" rule.** Every screen, endpoint, job, and component that exists is complete. A capability is either fully built for its stage or absent.
- In Stage A, *static fixture data inside `src/mock-api/fixtures/**` is the intended design, not a placeholder.
- UI code never hard-codes data. It always calls the API client.
- No UI element is a dead end: every button calls a contract endpoint and handles its response.

## 3. Key architectural decisions

### 3.1 Tenancy = organization (buyer, supplier, or operator)
- `tenants` rows are organizations with `kind ∈ {buyer, supplier, operator}`. The brief's `X-Tenant-Id` + membership check implements PRD BR-02 / COM-02 ("users act in an identified organization and capacity").
- A person (`users`) is global and may hold `memberships` in many tenants (AC-02). The SPA org/capacity switcher sets the active tenant. Switching clears all tenant-scoped Redux state.
- API surface is partitioned by audience. The tenant middleware enforces that the active tenant's `kind` matches the route prefix. The mock API enforces the same:
  - `/api/v1/public/*`: no auth, no tenant.
  - `/api/v1/me/*`: auth, tenant-exempt.
  - `/api/v1/buyer/*`: auth + buyer tenant.
  - `/api/v1/supplier/*`: auth + supplier tenant.
  - `/api/v1/ops/*`: auth + operator tenant.
  - `/api/v1/health`: public.
- **Cross-tenant records.** Procurement records carry `tenant_id` = the **buyer** tenant plus `supplier_tenant_id` where supplier-facing. Access goes through two typed scopers:
  - `forTenant(db, tenantId)`: buyer side.
  - `forSupplier(db, supplierTenantId)`: supplier side, only on the generated `supplier-scoped-tables` list. Inserts name the buyer `tenant_id` explicitly after the service verifies participation.
- Supplier-private collaboration (pursuits, notes, internal approvals, comments) lives in rows owned by the **supplier** tenant. The buyer never sees them.
- **Operator support access (OPS-04).** An operator may enter a customer tenant only while an active, customer-authorized `support_access_grants` row exists. Access is read-only via `support.view`, never includes sealed content, drafts, or scores, never allows submit/score/approve/sign, and is audited **before** the handler runs.

### 3.2 Authorization model (PRD §4.2)
- Permission catalog: fixed, code-owned, seeded (`schema-blueprint.md` §P). Roles are per-tenant copies of templates. Assignments are scoped (`organization | legal_entity | department | category | project | tender | lot | contract`) with validity dates.
- Effective permissions are computed per request from four sources: role assignments via direct membership, role assignments via groups, direct exceptional grants (owner, reason, start, expiry), and **explicit restrictions**. Restrictions subtract from the result and win over everything else.
- **Event-level access is assignment-based (BR-26).** `tender_team_members` and `evaluation_assignments` gate restricted material. A tenant admin without an assignment sees nothing restricted (AC-15).
- `requirePermission(code, { scope? })` for coarse checks. Domain services add sealing, assignment, conflict (BR-08), SoD (BR-07) and authority (BR-06) checks. Nobody can grant what they do not hold.
- Every contract endpoint declares its `permission`. The mock API enforces it against the persona's fixture permission set, so the prototype's navigation and 403 behavior already match Stage B.

### 3.3 Sealing and staged opening (BR-17, FR-13, AC-15/16)
- Bid content tables are readable by buyer users **only** through `sealing.assertEnvelopeReadable()` / `readableEnvelopes()`, which require all of the following:
  1. an `envelope_openings` row;
  2. an assignment to the tender, lot, or criterion;
  3. for a staged commercial envelope, a `price_gate_releases` row;
  4. a signed confidentiality undertaking and a conflict declaration.
- Before opening, buyers see receipt metadata only (`v_bid_receipt_metadata`). Drafts are never visible to buyers. A guard test fails if any other module reads sealed tables.
- The prototype's fixtures respect the same boundaries. A buyer persona's sealed bid view shows receipt metadata only, and opened content appears only for assigned personas.

### 3.4 Official time (BR-11, BR-12, BR-20)
- Instants are `timestamptz` (UTC). Each tender stores an IANA `official_time_zone`. The UI renders deadlines with zone and offset (`14 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone`, with an abbreviation such as CAT only when Intl provides one, DD-33), optionally with local-time help, and never as a countdown alone.
- **Official receipt time** = `clock_timestamp()` inside the submission transaction after locking the tender row `FOR SHARE`. Every attempt, including late or failed ones, is recorded with its true time (AC-13).
- Working-day math uses the tender's calendar. The time service is pure and unit-tested.

### 3.5 Versioning, approvals, and evidence (BR-09, BR-10, §18.2)
- Approvals target an exact version (`subject_version`, `content_hash`, `amount`, `currency`). A material edit invalidates them (AC-06).
- Immutable snapshots are kept in `record_snapshots`. History is append-only, and corrections add rows. `audit_log` records actor, capacity, delegation, entity, action, reason, before/after, and correlation id.
- Authority (BR-06) checks `authority_limits` + active `delegations` (value, currency, entity, category, and dates). `sod_policies` blocks self-approval and incompatible duties (BR-07), unless documented alternative oversight is recorded.

### 3.6 State machines
Each PRD §8 lifecycle is a pure legality matrix in `domains/<d>/workflow/*.ts` with `canTransition(from, to, ctx) → Result`, unit-tested row by row. The tender/lot lifecycle belongs to the shared `lifecycle` module. Holds (BR-13) are separate records listing blocked actions and never change dates. The **state enums are defined once in `src/contracts/enums.ts`** (mirroring the blueprint CHECK lists), so the UI, the mock API and the backend cannot drift.

### 3.7 Money and scoring (§3 amounts, §9)
- Money is `numeric(18,2)`. Rates and scores are `numeric(12,6)`. Both are carried end to end as **decimal strings** and computed with the shared decimal helper `src/contracts/decimal.ts` (BigInt-based, usable by the SPA for live totals; `src/server/lib/decimal.ts` re-exports it, DD-32). Each amount kind has its own column and label.
- The scoring engine is pure. Unit tests reproduce PRD §9.2 exactly (86.00 vs 88.00, and the 120,000 offer ranks first; AC-19). A missing score is `null`, never 0 (AC-18). The Stage A fixtures for T-2026-0003 carry exactly these numbers.

### 3.8 Notifications
In-app notifications and formal notices with separate delivered / opened / acknowledged / accepted-terms events (BR-41). A `DeliveryChannel` port has two implementations: `in_app` and `email`. The `email` channel sends over **SMTP with `nodemailer`**. Locally it delivers to **Mailpit** in the Supabase Docker stack; the hosted provider choice is deferred (see `docs/plan/email-delivery-options.md`). Emails carry the title, deadline and link only, never confidential content (DD-44). Where email is not enabled (`EMAIL_ENABLED` off), notices are in-app only and no email delivery rows are written. An undeliverable recipient org creates a delivery-exception task (BR-42) and never alters a deadline. Fan-out runs on the `notifications` pgmq queue.

### 3.9 Background jobs (brief §9; Stage B)
pg_cron → `invoke_cron_endpoint()` → `api/cron/<job>.ts`. Every sweep is state-guarded, per-tenant, and per-item transactional.

| Job | Schedule (UTC) | Owner domain | Purpose |
|---|---|---|---|
| `publish-scheduled` | `*/5 * * * *` | publication | Ready/scheduled tenders whose release time has passed → Open |
| `close-tenders` | `* * * * *` | bids | Open tenders past deadline → Closed/awaiting opening |
| `deadline-reminders` | `15 * * * *` | notifications | Closing-approaching, evaluation-due, approval-due reminders |
| `evidence-expiry` | `10 2 * * *` | qualification | Expiring evidence → notifications + reassessment triggers (BR-25) |
| `qualification-expiry` | `20 2 * * *` | qualification | Tasks and notices for decisions past `effective_to`. No decision rows are written; `v_qualification_status` derives expired (DD-20) |
| `obligation-status` | `30 2 * * *` | contracts | Due/overdue obligations, escalation tasks |
| `renewal-windows` | `40 2 * * *` | contracts | Notice windows → alerts only, never auto-renew (BR-37, AC-32) |
| `standstill-monitor` | `*/15 * * * *` | awards | Standstill ended with no blocking hold → task only (never auto-award) |
| `expire-access` | `0 * * * *` | org-admin | Display-status expiry of grants, restrictions, delegations, invitations (request-time checks compare timestamps directly, DD-18) |
| `expire-approvals` | `5 * * * *` | approvals | Expire approval requests past `expires_at` + notify owners |
| `expire-support-access` | `10 * * * *` | operations | Expire support access grants + audit |
| `contract-dates` | `50 2 * * *` | contracts | signed_not_effective → active on effective date; active → expired after term end (obligations remain); securities expiring/expired (DD-19) |
| `report-schedules` | `5 * * * *` | reporting | Run due scheduled reports; re-check recipient authorization at issue time |
| `notification-digests` | `0 5 * * *` | notifications | Daily/weekly digests per preferences (mandatory notices are never digested) |
| `notice-reconciliation` | `*/10 * * * *` | notifications | Re-enqueue notice recipients still pending after 10 min (brief §9.5 safety net) |
| `upload-reaper` | `50 3 * * *` | documents | Remove never-confirmed pending uploads; purge `request_idempotency` rows older than 24h |
| `retention-eligibility` | `0 4 * * 0` | records | Write `disposal_requests` (proposed, or blocked when held) for eligible records (BR-40, DD-20) |

Queues: `notifications` (fan-out + delivery) and `exports` (evidence packs, receipts, evaluation/award reports, handovers, report exports). The exports handler belongs to the documents service (`requestExport()`), with per-type generators registered by domains (DD-16). Alerts from state-less sweeps are deduplicated with `<job>:<entity>:<window>` idempotency keys (DD-19).

### 3.10 Contracts-first API (both stages)
- `src/contracts/` is a pure TypeScript + zod module importable by the SPA, the mock API and the real backend. It contains no Node or browser APIs.
- `common.ts`: ids, `Money` (decimal string + currency), `Instant`, `OfficialDeadline`, `Page<T>`, list query, `Problem` (problem+json with `errors[]`).
- `enums.ts`: every lifecycle state and classification.
- `endpoint.ts`: `defineEndpoint({ id, method, path, audience, permission?, params?, query?, body?, response, errors, screens })`.
- `<domain>.ts`: one file per domain, exporting request/response schemas, inferred types, and an endpoint map.
- `catalog.ts`: aggregates every domain map. It is written by the Integration step.
- The SPA calls `call(endpoint, { params, query, body })` from `api/client.ts`. That function builds the URL from the contract and validates responses with the contract schema in development builds. Domain client modules are thin wrappers.
- `npm run docs:api` generates `docs/technical/api/openapi.json` from the catalog using zod v4's built-in `z.toJSONSchema()`. No new dependency is needed.
- Stage B routes parse input with the contract's schemas and type their responses with the contract's types. Contract-conformance tests call every implemented endpoint and validate the response against the contract.

### 3.11 Prototype mode (Stage A)
- **Fully static, one deployable (DD-50).** Stage A is a single Vite SPA deployed to Vercel as static files. There are no `api/` functions, no database, no Docker and no Supabase in Stage A.
- **Mock API in the browser** (`src/mock-api/`): a Hono app with the same `/api/v1` surface, run inside the SPA through a same-origin fetch adapter. Its middleware mirrors the real chain (correlation id, identical-403 tenant validation, contract permission checks, problem+json errors, response validation against the contract). JWT verification is not part of Stage A. Per-domain handlers read typed fixtures (`src/mock-api/fixtures/<domain>.ts`) built from `docs/plan/demo-storyline.md`, filter by tenant, persona and query, and never persist anything.
- **Sign-in** is a persona picker (DD-50). No credentials are handled, and password-reset and invitation pages are removed in Stage A.
- `npm run dev:prototype` runs Vite alone. The standalone mock-API server and `dev:mock-api` are removed. Handler modules are listed in `src/mock-api/handler-modules.ts` (the browser cannot discover them on disk), and mock API runtime code avoids Node APIs (lint rule `tenderiq/mock-api-browser-safe`).

## 4. Repository layout

The brief §2 layout is used verbatim. Additions are marked ★. Paths marked Ⓐ are created in Stage A and Ⓑ in Stage B.

```
/
├── api/  Ⓑ                                  # v1/index.ts (single Hono function), cron/<job>.ts, queue/drain.ts
├── src/
│   ├── contracts/ ★Ⓐ                        # common.ts enums.ts endpoint.ts <domain>.ts catalog.ts
│   ├── mock-api/ ★Ⓐ                         # app.ts middleware/ handlers/<domain>.ts fixtures/<domain>.ts registry.ts
│   ├── server/  Ⓑ (lib/config, lib/supabase and lib/auth/verify.ts were written in Ⓐ under DD-43; unused by the Stage A prototype since DD-50, kept for Ⓑ)
│   │   ├── domains/
│   │   │   ├── registry.ts ★                 # composes every domain router (Integration)
│   │   │   ├── session/                      # /me/context, /me/theme (SPA boot)
│   │   │   ├── identity/  org-admin/  policy/
│   │   │   ├── approvals/  notifications/  documents/  audit/  lifecycle/  sealing/  time/   (shared services)
│   │   │   ├── suppliers/  qualification/  requests/  tenders/  publication/  clarifications/
│   │   │   ├── bids/  opening/  evaluation/ (scoring/)  selection/  awards/  contracts/
│   │   │   └── reporting/  records/  operations/
│   │   │   (each: index.ts routes.ts schemas.ts service.ts repository.ts errors.ts workflow/ jobs/)
│   │   ├── jobs/{cron,queue}/
│   │   ├── lib/{config,db,auth,tenancy,permissions★,audit★,supabase,storage,router,errors,logging,validation}/
│   │   ├── lib/decimal.ts ★ (re-exports src/contracts/decimal.ts)  lib/result.ts
│   │   └── tests/{unit,integration,types,helpers,fixtures}/
│   └── ui/  Ⓐ                                # SPA workspace
│       └── src/
│           ├── app/        store.ts hooks.ts router.tsx RouteGuard.tsx featureRegistry.ts★ slices/
│           ├── api/        client.ts (call(endpoint…)) <domain>.ts
│           ├── auth/       Ⓐ persona picker and session (DD-50), permissions.ts; Ⓑ supabase.ts AuthProvider SignIn/Forgot/Reset pages
│           ├── components/ shell/ ui/ charts/ approvals/ documents/ audit/
│           ├── features/<feature>/  routes.tsx★ pages/ components/ *.test.tsx
│           ├── pages/  theme/ (tokens.css components.css index.css, --tiq-)  lib/ (format, download)  test/
├── supabase/ Ⓑ config.toml ([inbucket] smtp_port 54325) migrations/ seed.sql schema.expected.sql (config.toml exists from Ⓐ, unused since DD-50)
├── scripts/  dev/ (Ⓑ seed-auth-personas.ts, serve-api.ts, dev.mjs; Stage A has none since DD-50: `dev:prototype` runs Vite)  docs/ ★Ⓐ (generate-openapi.ts)
│             db/ (Ⓐ ensure-signing-keys.mjs; Ⓑ everything else + demo/NN-<domain>.ts)  jobs/ Ⓑ  ci/ Ⓐ/Ⓑ
├── e2e_tests/ Ⓐ (projects: prototype, smoke, full)
├── docs/     technical/ ★ (architecture, ERDs, security, flows, API, ADRs…)  prototype/ ★Ⓐ (walkthrough + screens)
│             plan/  local-development.md  environment-variables.md  deployment.md  background-jobs.md
├── .build/progress/ ★                       # resume markers (see §12)
└── vercel.json package.json tsconfig*.json vitest.config.ts eslint.config.js .env.example .env.local.example run.ps1 .gitattributes CLAUDE.md README.md
```

**Feature auto-registration (SPA).** `app/featureRegistry.ts` collects `import.meta.glob('../features/*/routes.tsx', { eager: true })`. Each exports `features: FeatureModule[]` (`{ id, area: 'buyer'|'supplier'|'ops'|'public'|'common', routes, nav }`). Nav items declare `section`, `order`, `icon` and `permission`. Parallel feature agents never edit a shared SPA file.

**URL map.**
- Public: `/`, `/opportunities`, `/opportunities/:buyerSlug/:ref`, `/clarifications/:buyerSlug/:ref`, `/awards`, `/awards/:buyerSlug/:ref`, `/plans`, `/guidance/*`, `/b/:buyerSlug`. References are unique per buyer, so public URLs carry the buyer slug (DD-22).
- Personal `/me/*` pages list the caller's **own** tasks, notifications, approvals and documents across all active memberships, each labelled with its organization. Acting on a row requires the row's tenant to be active (DD-21).
- Auth: `/signin`, `/forgot-password`, `/reset-password`, `/invite/:token`, `/register`.
- Context selection: `/select-organization`.
- App areas: `/buyer/*`, `/supplier/*`, `/ops/*`, and personal `/me/*` (profile, tasks, notifications, approvals/:id, documents/:id, search, help).

**Registries**, wired only by the Integration step of each stage:
- `src/mock-api/registry.ts` Ⓐ
- `src/contracts/catalog.ts` Ⓐ
- `domains/registry.ts` Ⓑ
- `jobs/cron/registry.ts` Ⓑ
- `jobs/queue/handlers.ts` Ⓑ
- `domains/approvals/outcome-registry.ts` Ⓑ (approval final-state handlers per subject type)
- `domains/documents/access-registry.ts` Ⓑ (per related type; anything unregistered is denied)
- `domains/documents/export-registry.ts` Ⓑ (export generators per type, DD-16)

**Cross-domain writes (Stage B).** A domain writes only its own tables. The exceptions below must happen in the triggering transaction and be audited:
- tenders → `procurement_requests.status='converted'`.
- clarifications → `requirements`, `tender_milestones`, `lots.submission_deadline` (through the lifecycle snapshot API when an addendum is issued).
- opening → `bids.compliance_status`. evaluation → `bids.evaluation_status`. Tender and lot status change only through the lifecycle service.
- publication → `integration_exceptions` (AC-33). contracts → `integration_exceptions` (external signature failure).
- suppliers → `tenants` (buyer-created provisional supplier records).
- bids, selection, contracts, qualification → `evidence_submissions`, via the suppliers-owned `snapshotEvidence()` helper (append-only).
- opening → `submission_receipts.status = 'selected_for_evaluation'`.
- Shared owners (DD-16): tasks → approvals; comments, holds, record_snapshots, process_decisions → lifecycle (core); exports → documents; exchange_rates and price_gate_releases → evaluation.
- operations → `tenants` (onboarding), historical `contracts` and provisional supplier `tenants` (imports).
- bids owns every bid, revision and receipt row, including `round_type = 'bafo' | 'next_stage'`. Selection owns final-offer rounds and invitees.

## 5. Build waves and file ownership

Agents run concurrently in one working tree. **Ownership is by path.** An agent writes only the paths it owns. It may read anything. Shared files that no parallel agent edits: package.json files, `src/contracts/{common,enums,endpoint}.ts`, `lib/**`, `components/**`, `theme/**`, `app/**`, and `seed.sql`. Needs outside an agent's paths are reported as `followUps` and applied by the Integration step.

### Stage A — UI prototype (`tenderiq-prototype` workflow)

| Phase | Agent | Owns (writes) |
|---|---|---|
| A1 Foundation | `scaffold` | root configs, all package.json files (every dependency for both stages), tsconfigs, eslint, vitest config, vercel.json, .gitignore/.gitattributes, .nvmrc (24), run.ps1, CI yml (Stage A verify job), CLAUDE.md, README skeleton, **supabase/config.toml + signing-key script**, `.env.local`; starts the local Supabase stack |
| A1 | `contracts-core` | `src/contracts/{common,enums,endpoint,permissions,decimal}.ts` + contracts for shared surfaces: `session`, `approvals`, `tasks`, `notifications`, `documents`, `audit`, `calendars` |
| A1 | `mock-platform` | `src/mock-api/{app.ts,middleware/**,registry.ts,persona.ts,fixtures/{platform,session}.ts,handlers/session.ts,testing/**}`, `src/server/tests/unit/platform-auth/**`, `scripts/ci/{scan-secrets,scan-bundle,assert-test-run}.ts`, **`src/server/lib/{config,supabase}/**` and `src/server/lib/auth/verify.ts`** (the real modules, Stage A variable subset; Stage B extends them), `scripts/dev/{serve-mock-api.ts,dev-prototype.mjs,seed-auth-personas.ts}`, `scripts/docs/**`, `.env.example`/`.env.local.example` (Stage A subset), mock-api tests |
| A1 | `ui-shell` | `src/ui/**` except `src/ui/src/features/**` and domain client files; includes `components/{approvals,documents,audit}` (shared widgets), supabase-js auth, the dev-only demo-accounts quick-pick, and the e2e prototype specs (smoke/full belong to Stage B) |
| A1 | `foundation-integrate` | fix-only anywhere in Stage A paths; writes `docs/plan/foundation-contract.md` |
| A2 Domains | per domain (00 workspace + 01–16): contract+mock → UI → adversarial review → fix | `src/contracts/<d>.ts`, `src/mock-api/{handlers,fixtures}/<d>.ts`, `src/ui/src/api/<d>.ts`, `src/ui/src/features/<f>/**`, tests for those, `.build/progress/A/<d>.json` |
| A3 Integration | `integrate` | `src/contracts/catalog.ts`, `src/mock-api/registry.ts`, cross-fixture consistency, `docs/technical/api/**` |
| A4 QA | auditors (read-only) → verifiers → fixers | fixers write within the owning area's paths |
| A5 Handoff | `walkthrough`, `docs-sync` | `docs/prototype/**`, `e2e_tests/specs/prototype/walkthrough.spec.ts`, `docs/technical/**` |

### Stage B — full backend (`tenderiq-backend` workflow; launched only after approval)

| Phase | Agent | Owns (writes) |
|---|---|---|
| B1 Foundation | `scaffold-b` | Stage B npm scripts (including `supabase:*` and `auth:personas`), CI migrate job, docs; starts the local Supabase stack (first used in Stage B, DD-50) |
| B1 | `schema-w1/w2/w3` → `schema-apply` | migrations, seed.sql, generated types, schema.expected.sql, type/validation scripts |
| B1 | `platform-http` | lib/config (extends the Stage A module to every server variable), logging, errors, result, validation, decimal, router, `api/**`, `scripts/dev/{serve-api.ts,dev.mjs}`, `scripts/ci/**`, docs/environment-variables.md |
| B1 | `platform-data-auth` | lib/db (not generated), supabase + auth (extends the Stage A modules `lib/config`, `lib/supabase`, `lib/auth/verify.ts` and their local-stack tests: middleware, app-user resolution), tenancy, permissions, storage, audit, `domains/session`, `jobs/**`, `scripts/db/**` (not generate-types/validate), `scripts/jobs/**`, test helpers, demo `00-platform.ts` + runner |
| B1 | `ui-live-api` | point the SPA at the real API for `npm run dev`, and bring in real auth: supabase-js sign-in, forgot/reset password and invitation set-password (PRD COM-01), the dev-only demo-accounts quick-pick and its `scan-bundle` check (DD-50). `dev:prototype` keeps serving the in-browser mock API with the persona picker. Real upload flows go into the shared document widgets |
| B2 Shared | `svc-approvals`, `svc-notifications`, `svc-documents`, `svc-core` | domains/{approvals,notifications,documents,audit,lifecycle,sealing,time}. They implement the workspace contracts |
| B3 Domains | per domain: API (implements the contract + contract tests + demo seed module) → UI hardening → review → fix | `src/server/domains/<d>/**`, `src/server/tests/**/<d>/**`, `scripts/db/demo/NN-<d>.ts`, `src/ui/src/features/<f>/**`, reserved migration slot `2026100310NN*` |
| B4 Integration | `integrate` | server registries, cron/queue wiring, seed.sql, integration migrations, docs |
| B5 QA / B6 Final | auditors → verifiers → fixers → gate; docs-sync | as in Stage A |

## 6. Domain map with PRD traceability

| # | Domain (server dir → UI feature dirs) | FR / BR | Screens | Acceptance |
|---|---|---|---|---|
| 00 | workspace (shared screens; Stage B = shared services) → `features/tasks`, `features/approvals`, `features/notifications`, `features/documents`, `features/calendars` | FR-21, BR-06, BR-07, BR-10, BR-41, BR-42 | COM-04, COM-05, COM-06, COM-07, ADM-10, ADM-12 | AC-05 and AC-06 mechanics |
| 01 | identity + org-admin → `account`, `admin-org`, `admin-access` | FR-01, FR-03, §5.4, BR-02, BR-06/07, BR-38 | COM-01..03, ADM-01..05, SUP-04 | AC-02, AC-03, AC-04 |
| 02 | policy → `admin-policy` | FR-22, §17 | ADM-06, ADM-07, ADM-08, ADM-11 | supports AC-06 |
| 03 | suppliers → `supplier-org`, `supplier-directory` | FR-02, BR-44, BR-45 | SUP-02, SUP-03, SUP-05, BUY-31, BUY-32 | AC-07 (registration side) |
| 04 | qualification → `qualification` | FR-06, BR-24, BR-25 | ADM-09, SUP-20, SUP-24, BUY-33..35 | AC-07, AC-08, AC-09 |
| 05 | requests → `requests`, `planning` | FR-04, FR-05 | BUY-02..06, PUB-06 | AC-05, AC-39 (strategy) |
| 06 | tenders → `tender-authoring` | FR-07, BR-09, BR-10, BR-16 | BUY-07..13 | AC-06 |
| 07 | publication → `publication`, `public-portal`, `opportunities` | FR-08, FR-09, BR-14, BR-15, BR-46 | BUY-14, BUY-15, PUB-01..03, PUB-07, SUP-06..09 | AC-01 |
| 08 | clarifications → `clarifications` | FR-10, BR-14, BR-16 | BUY-16..18, SUP-10, SUP-11, PUB-04 | AC-10 |
| 09 | bids → `responses`, `submission-monitoring` | FR-11, FR-12, BR-17..21 | SUP-12..17, BUY-19 | AC-03, AC-11..14 |
| 10 | opening → `opening` | FR-13, BR-22, BR-23 | BUY-20, BUY-21, SUP-18, EVA-03 | AC-15, AC-16, AC-17 |
| 11 | evaluation → `evaluation` | FR-14, §9, BR-26..29 | EVA-01, 02, 04, 05, 06 | AC-18, AC-19, AC-20 |
| 12 | selection → `selection` | FR-15, FR-16, BR-30, BR-31 | BUY-22..25, BUY-27, SUP-19 | AC-21..24 |
| 13 | awards → `awards`, `outcomes` | FR-17, BR-32..34 | BUY-26, BUY-28..30, SUP-21, SUP-22, PUB-05 | AC-25, 26, 27, 29, 39 |
| 14 | contracts → `contracts` | FR-18, FR-19, BR-35..37 | CON-01..11, SUP-23 | AC-28..32 |
| 15 | reporting + records → `dashboard`, `reports`, `records`, `search` | FR-21, §15, §18, BR-40, BR-43 | BUY-01, SUP-01, REP-01, REP-02, ADM-13, ADM-14, COM-08 | AC-34, AC-35 |
| 16 | operations → `ops`, `help`, `admin-integrations` | FR-22, §21, BR-46, BR-47 | OPS-01..07, ADM-15..17, COM-09 | AC-33, AC-36 |

## 7. UI design system (from `docs/css` + screenshots)

- Port `docs/css/theme/*.css` into `src/ui/src/theme/`, renaming `--qiq-*`/`.qiq-*` to `--tiq-*`/`.tiq-*`. Light and dark themes stay token-driven. Components never contain raw hex values or literal pixel gaps.
- Shell: dark sidebar (tenant label, wordmark, sub-brand), grouped nav under collapsible section headings (the current page's section open, DD-48) with line icons and an accent pill for the active item, a separator before the admin group, and a user card with a menu for switching org, profile, theme, and sign-out. The top bar holds the page title, then the section action of the active sidebar destination in accent teal (DD-46), global search, tasks, a notifications bell with badge and help; search and the icons never move between pages. A page's own actions render in its content head row, with its one primary action last (DD-46).
- Pages: `PageHeader` → `FilterBar` card → KPI row → content cards → tables. Tables have uppercase headers, sort carets, monospace accent references (`T-2026-0003`), `StatusChip` tones for every lifecycle state, overdue chips in danger, and right-aligned money with currency.
- Icons are a hand-rolled inline-SVG set. There is no icon dependency.
- Accessibility (PRD §19): keyboard operable, focus-ring token, labelled inputs, `aria-live` for progress, and axe checks in E2E. Consequential actions confirm the **acting organization + capacity + scope + result** (COM-02). Warnings, blocking errors, and completed decisions each look distinct.

## 8. Testing strategy

- **Stage A:**
  - Contract unit tests: schemas parse every fixture, every endpoint has a screen reference, and enums match the blueprint CHECK lists.
  - Mock-API tests: persona mapping (unknown or inactive persona → 401; Stage A has no JWT, DD-50), identical 403s, permission enforcement, and tenant filtering, including that a supplier persona never receives another supplier's fixtures.
  - SPA tests with React Testing Library: every shared component, and at least one test per page covering permission-hidden navigation, readiness vs submitted, and official deadline rendering.
  - Playwright `prototype` project: every nav destination for each key persona, plus axe.
- **Stage B:** everything in brief §11, plus:
  - An integration test per endpoint for 401, 403, and tenant isolation.
  - At least one `AC-xx` integration test per acceptance scenario.
  - **Contract conformance:** every contract endpoint is implemented, and real responses validate against the contract.
  - Architecture guards, including the sealed-table and no-raw-hex guards.
  - Full E2E journeys.
- CI floors fail on any skipped test and enforce a minimum test count, set after each stage's integration.

## 9. Build & verification commands

- Stage A adds `dev:prototype` (Vite with the in-browser mock API, DD-50), `docs:api` (OpenAPI generation), and `test:e2e:prototype`. `build` = `npm run typecheck && npm run build:ui` (Vercel's `buildCommand`). `verify` = typecheck → typecheck:ui → lint → lint:ui → test → test:ui → build:ui.
- Stage B adds the full brief §4.3 catalog, plus `db:migrate` (`supabase migration up --local --include-all`) and `db:sql:check` for safe additive migrations by parallel agents.

## 10. Demo data

`docs/plan/demo-storyline.md` is the single story.
- Stage A: each domain writes typed fixtures in `src/mock-api/fixtures/<domain>.ts`. A cross-fixture consistency test checks that references, tenders, suppliers and personas line up across domains.
- Stage B: each domain writes `scripts/db/demo/NN-<domain>.ts` against the same storyline, so the approved prototype and the live system show the same world.

## 11. Deviations from the brief and assumptions

Owner review of 2026-09-29. All items below are now **ACCEPTED** or **DECIDED**. The plan still awaits the owner's final approval after the consistency re-verification.

1. **ACCEPTED — `src/contracts/` and `src/mock-api/`** are new top-level source folders. The SPA never imports `src/server/**`, and `src/contracts` is pure. The mock API is dev/test only and is excluded from `api/` and the production bundle (verified by `scan-bundle`).
2. **ACCEPTED — No new runtime dependencies beyond the brief, with one approved exception: `nodemailer`** (runtime) plus `@types/nodemailer` (dev), for the email channel (item 3, DD-44). The brief's list: `hono, kysely, pg, zod, @supabase/supabase-js, exceljs`; SPA: react, react-dom, @reduxjs/toolkit, react-redux, react-router, recharts, @supabase/supabase-js; dev tools as listed in the brief + Vite/RTL/Playwright/axe/prettier. Icons are hand-rolled SVG. PDFs are print-styled HTML plus XLSX/CSV. OpenAPI uses zod v4 `z.toJSONSchema()`.
3. **DECIDED — Email delivery (local now, hosted provider later).** Stage B builds an SMTP `email` channel next to `in_app` using **`nodemailer`** (MIT; the one added runtime dependency, plus `@types/nodemailer`). Locally, every email (app notices and Supabase Auth invites and resets) goes to **Mailpit** in the Supabase Docker stack. The **hosted provider choice is deferred** (options in `docs/plan/email-delivery-options.md`). In an environment without SMTP configured, notices stay in-app only. (DD-44)
4. **DECIDED — Supplier self-registration via the API + Auth Admin invite (clarification; not a deviation).**
   - The full Supabase stack (Postgres, Auth, Storage, Studio, Mailpit) runs locally in Docker through the Supabase CLI, and the same code runs against hosted Supabase in other environments.
   - "Self-signup disabled" is a Supabase Auth setting (`enable_signup = false`). It behaves the same locally and hosted, and brief §5.7 mandates it.
   - PRD FR-02 needs public supplier registration, so the public form posts to the TenderIQ API. The API validates, checks duplicates, rate-limits, creates the supplier org + user + membership in one transaction, and **after the commit** asks Supabase Auth to send the verification/set-password email (Mailpit locally). The brief forbids network calls inside a transaction, so a failed invite marks the registration for retry rather than rolling it back (DD-27).
   - The alternative, turning Supabase signup on so browsers sign up directly, would deviate from the brief and create auth accounts with no organization behind them. It would also bypass server-side duplicate and abuse checks. Recommendation: keep the proposed approach.
5. **ACCEPTED — Doppler / GitHub environments / Vercel project**: files and runbooks only. No Vercel, Supabase or GitHub accounts exist yet, and no code is pushed.
6. **DECIDED — Node 24 everywhere (option a; deviation from the brief's Node 22 pin).** `engines` `24.x`, `.nvmrc` 24, CI Node 24, and Vercel Node.js 24.x (via `engines`). (DD-45)
   - The brief pins **Node 22** (in `engines`, CI and Vercel). This machine has **Node 24.16**.
   - The earlier proposal (allow `>=22 <25`: build locally on 24, CI and Vercel on 22) risks shipping code that only works on 24. With no GitHub remote, CI does not run yet, so nothing would test on 22.
   - Node 22 reaches **end-of-life on 30 April 2027**. Node 24 is supported until **30 April 2028**.
   - Options:
     - (a) **Node 24 everywhere.** Pin engines `24.x` and use Node 24 in CI and on Vercel. This deviates from the brief's pin but avoids an EOL runtime around launch. *Recommended.*
     - (b) **Node 22 everywhere.** This conforms to the brief, but Node 22 must be installed on this machine (for example with nvm-windows), which is a machine change done by the owner or with permission.
     - (c) The mixed range. Not recommended.
7. **ACCEPTED — Git**: the existing repository is kept (not re-initialized). Work happens on branch `build/tenderiq-core` with one checkpoint commit per phase, **local only** (no remote). The first commit includes the owner's uncommitted docs changes.
8. **SUPERSEDED by item 11 (DD-50, 2026-10-30).** Real Supabase Auth in local Docker from Stage A (DD-43) no longer applies to Stage A. Stage B keeps real Supabase Auth. The analysis follows for the record.
   - The mock sign-in (`VITE_AUTH_MODE`, persona switcher) existed only because Stage A was read as "no backend infrastructure at all". It would let the prototype run without Docker.
   - Supabase Auth runs locally in Docker, and the owner prefers a Docker-first architecture. So the alternative is:
     - (b) **Real Supabase Auth from Stage A.**
       - Stage A starts the local Supabase stack. A script creates the demo persona accounts in local Supabase Auth.
       - The SPA signs in with supabase-js exactly as in production. The mock API verifies the real Supabase JWT and maps the account to its fixture persona, while data stays static.
       - Invitation, password-reset and registration emails appear in Mailpit.
       - A "demo accounts" quick sign-in list shows only in local development builds; Vite strips it from production builds automatically.
       - No `VITE_AUTH_MODE`, no mock auth adapter, and no deviation. The typed config and JWT-verification code (brief §5.4, §5.7) are written in Stage A instead of Stage B.
       - Cost: Docker must be running to use the prototype.
     - (a) Keep the mock sign-in. The prototype runs without Docker, but this adds a build variable and throwaway code.
   - *Recommended: (b).*
9. **ACCEPTED — Fonts**: Inter and JetBrains Mono (OFL) are self-hosted in `src/ui/public/fonts`, with no external font request (DD-35). The SPA document gets a CSP meta tag (DD-30).
10. **ACCEPTED — Not in this release**: MFA/step-up sign-in (DD-29) and languages other than English. The system is **designed for localization**: every UI string goes through per-feature message catalogs (DD-37), dates, numbers and money are formatted by locale-aware helpers, and each user has a stored language preference. Adding a language is a translation task, not a refactor.

11. **APPROVED by the owner 2026-10-30 — Stage A is static and runs without Supabase or Docker (DD-50).** Owner requirement: no Supabase, deployable to Vercel only, no further dependencies.
   - **Brief §3.1 `vercel.json`:** Stage A drops the `/api/v1` rewrite and the `functions` block (there is no `api/` in Stage A) and keeps `framework`, `buildCommand`, `outputDirectory` and the SPA fallback rewrite. Stage B restores the brief's file. (No test pins `vercel.json` today; the "no `crons` key" test in `docs/technical/10-deployment-environments.md` is a Stage B item.)
   - **Brief §5.7 authentication and PRD COM-01:** not implemented in Stage A. Sign-in, invitation acceptance and account recovery are replaced by the persona picker. Stage B implements them in full.
   - **Brief §7 local development and §8 environment variables:** no Docker and no `SUPABASE_*` / `VITE_SUPABASE_*` values in Stage A. The CSP (DD-30) becomes `connect-src 'self'`.
   - **Amends item 1:** in Stage A the SPA imports the mock API through **one** adapter module, and the production bundle includes the mock API and its fixtures. The SPA lint boundary allows `src/mock-api` from that module only (it still forbids `src/server`). `scan-bundle` keeps the secret and server-variable checks and drops the mock-code, persona-e-mail and demo-accounts-marker checks for Stage A; Stage B restores them.
   - **Amends item 2:** `hono` is added to the SPA workspace's dependencies (`src/ui/package.json`). It is already an approved project dependency, so nothing new enters the project. No other dependency is added or removed. `@supabase/supabase-js` stays declared for Stage B and is not imported by Stage A code.
   - **Amends item 5 and the hosting answer below:** the static prototype may be hosted on Vercel. Agents create no accounts and do not deploy: the owner creates the Vercel project and deploys (git stays local only unless the owner decides otherwise).
   - **Browser compatibility of the mock API:** `registry.ts` discovers handlers with `node:fs` and becomes a static (build-time) registry; `node:crypto` `createHash` (seven files) is replaced by a synchronous pure-TypeScript hash with identical output; `Buffer` (two files) is replaced by `TextEncoder`/`Uint8Array`. Test-only helpers may keep Node APIs. The mock API loads as a lazy chunk so the first screen is not delayed by fixtures.
   - **Tests and tooling:** the local-stack tests (`src/server/tests/unit/platform-auth/verify.local-stack.test.ts` and the mock-API `*real-auth*` / `*-auth` tests) leave the Stage A suites and return in Stage B. `npm run verify` must pass with Docker stopped. Playwright's `prototype` project starts Vite only.
   - **Agent instructions:** `CLAUDE.md` (Stage A description, commands, Supabase rule, boundaries, ports) and `docs/local-development.md` are updated in the same change.

**Other owner answers (2026-09-29):** the prototype is hosted **local only** (amended by item 11: Vercel static hosting is allowed); checkpoints stay **local only** (no remote); prototype actions show realistic results but **do not persist**; walkthrough screenshots **are committed**.

## 12. Resilience and resume (interruptions such as a power or internet outage)

The work is protected in four layers:

1. **Built-in replay.** Every workflow run records each agent's result in a run journal. Relaunching the same script with `resumeFromRunId` returns cached results for every completed agent and re-runs only what had not finished. This works within the same Claude Code session. After a crash, reopen the session with `claude --resume` and try this first.
2. **Progress markers on disk (session-independent; committed with the checkpoints, not git-ignored).** When a unit of work finishes (a phase, or one domain pipeline), its last agent writes `.build/progress/<stage>/<unit>.json` with the unit's report. Both workflow scripts accept `args.resume = { skipPhases: [...], skipUnits: [...] }`. In a brand-new session, the orchestrator reads the markers and relaunches the script, skipping completed units. Integration reads skipped units' reports from their markers.
3. **Git checkpoints.** One commit per completed phase on `build/tenderiq-core` gives a known-good baseline to diff or roll back to.
4. **Outage circuit breaker.** If several agents in a row fail (for example the network is down), the workflow stops launching new agents and returns `status: "interrupted"` with the completed units, instead of cascading failures through later phases.

On resume, the first action is always a verification gate: typecheck and tests (in Stage B, first `npm run supabase:start`, because Docker restarts after a power loss). That gate catches half-written files from agents that were interrupted mid-write. **Worst-case loss is the work of agents that were in flight at the moment of interruption.** Their units simply re-run.
