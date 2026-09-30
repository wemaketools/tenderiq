# Key Flows

Status: As-designed (pre-build). Updated to as-built at the end of Stage A and Stage B.

Sources:
- `docs/plan/architecture-plan.md` (revision 3): §0 (delivery stages; real Supabase Auth in Stage A), §3.1 (tenancy, scopers, support access), §3.2 (authorization), §3.3 (sealing and staged opening), §3.4 (official time), §3.5 (versioning, approvals, evidence), §3.6 (state machines), §3.7 (money and scoring), §3.8 (notifications: `in_app` and `email` channels), §3.9 (jobs), §3.10 and §3.11 (contracts and prototype mode, local Supabase stack from Stage A), §4 (URL map, registries, cross-domain writes, shared table owners), §5 (ownership: `ui-live-api`), §6 (domain map), §11 (owner decisions of 2026-09-29: item 3 email channel, item 4 supplier self-registration, item 8 real Supabase Auth from Stage A, item 10 MFA not in this release)
- `docs/plan/design-decisions.md`: DD-02, DD-03, DD-05, DD-07, DD-09, DD-11 to DD-19, DD-21 to DD-25, DD-27 to DD-29, DD-31 to DD-33, DD-36, DD-38 (withdrawn, superseded by DD-43), DD-39, DD-41, DD-42, DD-43 (real Supabase Auth from Stage A), DD-44 (email channel); §E (owner decisions of 2026-09-29)
- `docs/plan/email-delivery-options.md`: §1 and §2 (Supabase Auth and notice emails go to Mailpit locally; hosted provider deferred)
- `docs/plan/tenderiq-prototype.workflow.js`: Stage A tasks `mock-platform` (JWT verification through `src/server/lib/auth/verify.ts`, `npm run auth:personas`, the `scan-bundle` marker check) and `ui-shell` (supabase-js sign-in, dev-only demo accounts, prototype banner)
- `docs/plan/schema-blueprint.md`: §0 (conventions), Migrations 01, 02, 04, 06, 07, 08, 09, 10, 11, 12, 13, 14; §P (permission catalog and role templates)
- `docs/architecture-brief.md`: §5.1 (request pipeline), §5.3 (errors and results), §5.6 (transactions and pooler rules), §5.7 (authentication), §5.9 (file storage), §9.5 (queues), §10 (SPA client)
- `docs/PRD.md`: FR-04, FR-07, FR-08, FR-10, FR-12, FR-13, FR-14, FR-17, FR-18, FR-19; §8 (lifecycles); §9.2 (worked scoring example); §10 (BR-06, BR-07, BR-09, BR-10, BR-13, BR-14, BR-16 to BR-21, BR-23, BR-26, BR-27, BR-32 to BR-35, BR-41, BR-42); §14 (documents and notices); §23 (AC-05, AC-06, AC-10 to AC-13, AC-15, AC-16, AC-18 to AC-20, AC-25, AC-28 to AC-30)
- `docs/plan/tenderiq-backend.workflow.js`: Stage B domain notes for publication (notices through the notifications service), opening and evaluation (`price_gate_releases` written by evaluation), suppliers (public registration through the Auth Admin invite); tasks `svc-notifications` (the `email` channel over SMTP, Mailpit in integration tests) and `ui-live-api` (invitation set-password flow, emails in Mailpit)
- `docs/plan/demo-storyline.md`: personas, PR-2026-0003, T-2026-0002, T-2026-0003, T-2026-0005, T-2026-0006, T-2026-0007, T-2026-0008, T-2026-0010, C-2026-0001, C-2026-0002

Contents:
- [1. Conventions](#1-conventions)
- [2. Flow index](#2-flow-index)
- [3. Flow 1: Sign-in and organization/capacity selection](#3-flow-1-sign-in-and-organizationcapacity-selection)
- [4. Flow 2: Procurement request approval routed by authority (AC-05)](#4-flow-2-procurement-request-approval-routed-by-authority-ac-05)
- [5. Flow 3: Tender release approval and invalidation (AC-06)](#5-flow-3-tender-release-approval-and-invalidation-ac-06)
- [6. Flow 4: Publication and invitation notices](#6-flow-4-publication-and-invitation-notices)
- [7. Flow 5: Supplier submission with official receipt time (AC-11 to AC-13)](#7-flow-5-supplier-submission-with-official-receipt-time-ac-11-to-ac-13)
- [8. Flow 6: Addendum after submissions (AC-10)](#8-flow-6-addendum-after-submissions-ac-10)
- [9. Flow 7: Sealed access, staged opening and price gate (AC-15, AC-16)](#9-flow-7-sealed-access-staged-opening-and-price-gate-ac-15-ac-16)
- [10. Flow 8: Evaluation, moderation and ranking (AC-18 to AC-20)](#10-flow-8-evaluation-moderation-and-ranking-ac-18-to-ac-20)
- [11. Flow 9: Award, standstill, complaint hold and final award (AC-25)](#11-flow-9-award-standstill-complaint-hold-and-final-award-ac-25)
- [12. Flow 10: Contract, signature, handover and closeout gate (AC-28, AC-29)](#12-flow-10-contract-signature-handover-and-closeout-gate-ac-28-ac-29)
- [13. Flow 11: Milestone evidence rejection (AC-30)](#13-flow-11-milestone-evidence-rejection-ac-30)
- [14. Flow 12: Document upload two-step envelope](#14-flow-12-document-upload-two-step-envelope)
- [15. Open points](#15-open-points)

Related: [02-architecture.md](02-architecture.md) (middleware chain and request pipeline), [04-security-model.md](04-security-model.md) (authorization, sealing, support access), [05-lifecycles.md](05-lifecycles.md) (state machines), [07-api.md](07-api.md) (endpoint inventory), [08-background-jobs.md](08-background-jobs.md) (jobs and queues), [03-data-model/README.md](03-data-model/README.md) (tables), [glossary.md](glossary.md).

---

## 1. Conventions

### 1.1 Participants

| Participant | Meaning |
|---|---|
| SPA | React SPA in `src/ui`. Every call goes through `api/client.ts` `call(endpoint, ...)`, which attaches `Authorization: Bearer <jwt>` (token read per request) and `X-Tenant-Id` from the Redux session slice, except on tenant-exempt prefixes (brief §10, architecture-plan §3.10). |
| API middleware | The single Hono function `api/v1/index.ts` and its middleware chain: security headers, request context and correlation id, request log, error boundary, authentication, tenant context, permission resolution ([02-architecture.md §3.1](02-architecture.md#31-middleware-chain)). In most flows the chain is compressed into one note, for example `auth, buyer tenant, tender.publish`. |
| Domain service | `src/server/domains/<domain>/service.ts`. Returns `Result<T, DomainError>` for expected failures (brief §5.3). |
| Shared services | `approvals`, `notifications`, `documents`, `audit`, `lifecycle`, `sealing`, `time` (architecture-plan §4). |
| Postgres | Supabase Postgres 17 through Kysely over the transaction pooler. The `pgmq` queues live in the same database. |
| Supabase Auth, Supabase Storage | Auth (GoTrue) for sign-in, Storage behind `StorageAdapter` for files. Auth is real in both stages: the local Supabase CLI stack runs in Docker from Stage A, and Stage A uses only its Auth service (DD-43). |
| SMTP server (Mailpit locally) | Receives the emails of the `email` `DeliveryChannel` (sent with `nodemailer`) and Supabase Auth's invitation, password-reset and registration emails. Locally this is Mailpit in the Supabase Docker stack (SMTP `127.0.0.1:54325`, web UI `http://127.0.0.1:54324`). The hosted provider is deferred (DD-44; `docs/plan/email-delivery-options.md`). |
| Queue drain | `api/queue/drain.ts` and the handlers in `jobs/queue/handlers.ts`, called every minute by pg_cron ([08-background-jobs.md](08-background-jobs.md)). |

### 1.2 Rules that hold in every flow

- **Endpoint notation.** Paths are written as the audience prefix plus the intent, for example `POST /api/v1/supplier/... submit revision`. `...` stands for the contract path. Exact paths, endpoint ids, request and response schemas and error codes come from the Stage A contracts (`src/contracts/<domain>.ts`) and are listed in [07-api.md](07-api.md). Where the sources do not fix the audience prefix, the diagram writes `/api/v1/...`.
- **Permission codes** are codes from the catalog (blueprint §P). The binding of a code to an endpoint is declared by the endpoint's contract (`defineEndpoint({ permission })`) and enforced by `requirePermission` in `routes.ts`.
- **Transactions.** Every multi-statement business operation runs inside `withTransaction`. There are no network calls inside a transaction. Row locks (`SELECT ... FOR UPDATE`, `FOR SHARE`) are taken only inside a transaction (brief §5.6). `BEGIN` and `COMMIT` in the diagrams mark that boundary.
- **Queue publishes happen after commit.** A failed publish is logged and never fails the user's request (brief §9.5). Payloads carry ids only. The tenant id travels on the envelope. For formal notices, the `notice-reconciliation` job re-enqueues recipients still `pending` after 10 minutes (DD-19).
- **Delivery channels.** The `DeliveryChannel` port has an `in_app` and an `email` implementation. Formal notices go to both channels, and non-mandatory events follow the user's preferences. Email is sent only where it is enabled (`EMAIL_ENABLED`) and carries the title, the official deadline and a link, never bid, evaluation or other confidential content (DD-44, BR-43). Where email is not enabled, no email delivery rows are written.
- **Audit.** State-changing commands write `audit_log` (actor, capacity, delegation, entity, action, reason, before and after state, correlation id; architecture-plan §3.5). The row goes to the partition of the tenant that **owns the affected record**: a supplier acting on a buyer-owned row is audited in the buyer's partition with `actor_capacity` naming the supplier organization, and support-access events go to the customer tenant (DD-11). For sealed records and evaluator scores, `before_state` and `after_state` hold ids and hashes only, with `sensitivity = 'restricted'` (DD-31). Diagrams show audit only where it matters to the flow.
- **Shared table owners.** A domain writes only its own tables (architecture-plan §4). `tasks` belong to the approvals service. `holds`, `record_snapshots`, `comments` and `process_decisions` belong to the core `lifecycle` service (DD-16). Diagrams that show another domain creating a task or snapshot mean a call to that owner inside the same transaction.
- **Supplier scope.** Supplier-side access goes through `forSupplier(db, supplierTenantId)`, which reaches only `[S]` tables on the generated allow-list. `[R]` tables carry `supplier_tenant_id` for reference only and stay buyer-internal. Suppliers learn outcomes through notices and supplier-facing projections (DD-03).
- **Status changes of tenders and lots** go only through the `lifecycle` service (architecture-plan §4). Legality is decided by `canTransition(from, to, ctx)` matrices ([05-lifecycles.md](05-lifecycles.md)).
- **Idempotency.** Commands that create records accept an optional `Idempotency-Key` header, stored in `request_idempotency` for 24 hours. The SPA disables submit buttons while a request is in flight (DD-39).
- **References** come from `next_reference(tenant, prefix)`. The year segment is the year in the tenant's official time zone (DD-09).
- **Errors.** Expected failures become problem+json with a `code`. Validation failures are 422 with `errors[]`. Unexpected failures are 500 with a sanitized `detail` and the correlation id (brief §5.3). The status code for each domain error is set in the contracts ([02-architecture.md §4.3](02-architecture.md#43-response-outcomes)).
- **Money and scores** travel as decimal strings and are computed with the shared helper `src/contracts/decimal.ts`, which `src/server/lib/decimal.ts` re-exports. The SPA uses it for live totals, and the server recomputes authoritatively (DD-32; [adr/0005-decimal-strings-for-money-and-scores.md](adr/0005-decimal-strings-for-money-and-scores.md)).
- **Approval decisions.** Deciding a step requires `approval.decide`, the decision-specific permission (for example `award.approve`) and sufficient authority (DD-24).

### 1.3 Stage A versus Stage B

The diagrams describe Stage B. In Stage A the mock API (`src/mock-api/`) serves the same URL surface with the same middleware behavior: real Supabase JWT verification through `src/server/lib/auth/verify.ts` (the verified email is mapped to its fixture persona, and an unknown account gets 401), identical 403 tenant validation, contract permission checks against the persona's fixture permission set, and problem+json errors. Supabase Auth is the same in both stages: the local Supabase stack runs in Docker from Stage A, which uses only its Auth service and has no application schema (DD-43). Every participant to the right of the API middleware is replaced by typed fixtures. Commands validate the request against the contract and return a contract-valid static response, for example the fixture receipt for a submission. Nothing is persisted. The SPA shows the prototype banner when `/api/v1/me/context` reports `environment.mode = 'prototype'` (architecture-plan §0, §3.11; DD-43; [adr/0006-contracts-first-ui-prototype-stage.md](adr/0006-contracts-first-ui-prototype-stage.md)). The prototype sends no notice emails and only displays delivery status from fixtures. Password-reset emails from Supabase Auth do reach Mailpit in Stage A; invitation and registration emails follow in Stage B, when the real API calls the Auth Admin invite (DD-43; `docs/plan/email-delivery-options.md`).

---

## 2. Flow index

| # | Flow | Acceptance | Screens | Domains and shared services | Principal tables |
|---|---|---|---|---|---|
| 1 | Sign-in and organization/capacity selection | AC-02 context, AC-04 inactive user | COM-01, COM-02 | session, identity; `lib/auth`, `lib/tenancy`, `lib/permissions` | `users`, `memberships`, `tenants`, `role_assignments`, `role_permissions`, `user_group_members`, `access_grants`, `access_restrictions` |
| 2 | Procurement request approval routed by authority | AC-05 | BUY-03, BUY-04, COM-04, COM-05 | requests, approvals | `procurement_requests`, `record_snapshots`, `approval_requests`, `approval_steps`, `authority_limits`, `delegations`, `sod_policies`, `tasks` |
| 3 | Tender release approval and invalidation on material edit | AC-06 | BUY-09 to BUY-13, COM-05 | tenders, approvals, lifecycle | `tenders`, `release_checks`, `record_snapshots`, `approval_requests`, `approval_steps`, `tasks` |
| 4 | Publication and invitation notices | AC-01, AC-33 | BUY-14, BUY-15, PUB-02, PUB-03, SUP-07, COM-06 | publication, lifecycle, notifications | `publications`, `tender_versions`, `participants`, `notices`, `notice_recipients`, `participant_acknowledgments`, `notifications`, `notification_deliveries`, `integration_exceptions` |
| 5 | Supplier submission with official receipt time | AC-11, AC-12, AC-13 (AC-03) | SUP-15, SUP-16, SUP-17 | bids | `bids`, `bid_revisions`, `bid_internal_approvals`, `submission_attempts`, `submission_receipts`, `receipt_inventory_items`, `reference_counters`, `late_submission_exceptions` |
| 6 | Addendum after submissions | AC-10 | BUY-16, BUY-17, SUP-08, SUP-17 | clarifications, lifecycle, approvals, notifications, publication, bids | `addenda`, `addendum_lots`, `addendum_requirement_changes`, `requirements`, `tender_milestones`, `lots`, `tender_versions`, `notices`, `notice_recipients`, `participant_acknowledgments` |
| 7 | Sealed access, staged opening and price gate | AC-15, AC-16 | BUY-19, BUY-20, EVA-02, EVA-04, OPS-04 | opening, sealing, lifecycle, evaluation | `opening_sessions`, `opening_participants`, `envelope_openings`, `price_gate_releases`, `tender_team_members`, `support_access_grants`, `v_bid_receipt_metadata` |
| 8 | Evaluation, moderation and ranking | AC-18, AC-19, AC-20 | EVA-01, EVA-02, EVA-04, EVA-05, EVA-06 | evaluation (scoring), sealing | `evaluation_assignments`, `evaluation_scores`, `score_corrections`, `moderation_sessions`, `moderated_scores`, `commercial_evaluations`, `evaluation_results`, `evaluation_reports` |
| 9 | Award recommendation to final award with a complaint hold | AC-25 | BUY-26, BUY-28, BUY-29, SUP-21, SUP-22, PUB-05 | awards, approvals, time, lifecycle, notifications | `award_recommendations`, `lot_outcomes`, `approval_requests`, `notices`, `standstill_periods`, `complaints`, `complaint_events`, `holds`, `public_award_notices` |
| 10 | Contract from award to closeout gate | AC-28, AC-29 | CON-02, CON-03, CON-04, SUP-23, BUY-30 | contracts, approvals, awards | `contracts`, `contract_lot_allocations`, `contract_signatories`, `handovers`, `event_closeouts` |
| 11 | Milestone evidence rejection | AC-30 | SUP-23, CON-06 | contracts, documents, notifications | `obligations`, `obligation_evidence`, `acceptance_decisions`, `tasks`, `contract_invoices` |
| 12 | Document upload two-step envelope | supports AC-11 to AC-14, AC-30 | COM-07 and every upload widget | documents | `documents`, `document_versions`, `document_access_log` |

---

## 3. Flow 1: Sign-in and organization/capacity selection

**Narrative.** A person is one global `users` row with `memberships` in any number of organizations (tenants). The browser uses supabase-js only for authentication, exactly the same way in both stages (DD-43). The SPA boots its session from the tenant-exempt `/api/v1/me/context`, then the user picks the organization and capacity to act in (COM-02). From then on the SPA sends `X-Tenant-Id` on every buyer, supplier or ops call. The server re-validates the tenant and recomputes effective permissions on every request, because the browser is untrusted (brief §5.8). Switching organization clears all tenant-scoped Redux state (architecture-plan §3.1). The SPA remembers the last active tenant per user in `localStorage` as a convenience only, and re-validates it against `/me/context` (DD-36). Personal pages under `/me/*` (tasks, notifications, approvals, documents, search) return the caller's own rows across all active memberships, each labelled with its organization. Acting on such a row requires `X-Tenant-Id` equal to the row's tenant, and search results are filtered by the caller's authorization in each row's tenant (DD-21). MFA and step-up sign-in are not in this release: the brief disables MFA, and Supabase MFA is recorded as a later extension (DD-29). Demo: `sam.dual` holds memberships in `kwu` (evaluator), `tsodilo` and `chobe-pipe` (contributor) and demonstrates AC-02.

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant SPA as SPA
    participant AUTH as Supabase Auth
    participant API as API middleware
    participant SES as session domain
    participant PERM as lib permissions
    participant DB as Postgres
    U->>SPA: Email and password on /signin, COM-01
    SPA->>AUTH: signInWithPassword through supabase-js
    alt credentials rejected
        AUTH-->>SPA: error
        SPA-->>U: One generic sign-in error, no account discovery
    else credentials accepted
        AUTH-->>SPA: Session with ES256 access token and refresh token
    end
    SPA->>API: GET /api/v1/me/context, Bearer token, no X-Tenant-Id
    Note over API: headers, correlation id, request log, error boundary
    Note over API: verify JWT: header, alg allow-list, kid in cached JWKS, getClaims, iss pin
    API->>DB: users row by auth_user_id
    DB-->>API: user row
    alt no users row or status not active
        API-->>SPA: 401 problem+json
        SPA->>AUTH: sign out, then redirect to /signin
    else active user
        Note over API: /me prefix is tenant-exempt
        API->>SES: context for userId
        SES->>DB: memberships of the user joined to tenants
        DB-->>SES: memberships with tenant kind, name, status and title
        SES-->>API: organizations and capacities
        API-->>SPA: 200 context
    end
    SPA-->>U: /select-organization lists organizations, capacities and pending memberships, COM-02
    Note over SPA: a tenant remembered in localStorage is only a preselection, re-validated against the context, DD-36
    U->>SPA: Choose organization and capacity
    Note over SPA: set active tenant in the session slice, clear all tenant-scoped state
    SPA->>API: GET /api/v1/buyer/... first page, Bearer and X-Tenant-Id
    Note over API: authenticate as above
    API->>DB: membership for user and tenant, tenant status and kind
    alt no active membership, tenant not active, or kind does not match the prefix
        API-->>SPA: 403 problem+json, identical body for every cause
    else valid context
        API->>PERM: effective permissions for user and tenant
        PERM->>DB: role assignments via membership and via groups, direct grants, restrictions, valid now
        DB-->>PERM: rows
        PERM-->>API: permission set with restrictions subtracted
        Note over API: requirePermission for the route, 403 when missing
        API-->>SPA: 200 with x-correlation-id
    end
```

**Stage A (prototype mode).** Sign-in is real Supabase Auth from Stage A. There is no mock auth adapter, no persona switcher, no `VITE_AUTH_MODE` and no `/__mock/auth` endpoints. DD-43 supersedes the withdrawn DD-38 (architecture-plan §3.11, §11 item 8).
- **Setup.** The local Supabase CLI stack runs in Docker (`npm run supabase:start`), and Stage A uses only its Auth service. `npm run auth:personas` creates or updates every demo persona in local Supabase Auth through the Admin API, with the password `test1234`. The script is idempotent and refuses to run against anything that is not local.
- **SPA.** The SPA signs in with supabase-js exactly as in production. In local development builds only (`import.meta.env.DEV`), the sign-in page lists the demo accounts grouped by organization. Picking one fills the email and password and signs in for real. Vite strips the quick-pick from production builds, and `scan-bundle` fails if its marker string appears in the production bundle.
- **Mock API.** The mock API verifies the JWT with the real `src/server/lib/auth/verify.ts` (the brief §5.7 checks, using the real `lib/config` and `lib/supabase` modules written in Stage A and extended in Stage B). It then maps the verified email to its fixture persona instead of reading a `users` row. An account with no fixture persona gets 401.
- **Banner and email.** The prototype banner is shown when `/api/v1/me/context` reports `environment.mode = 'prototype'`. In Stage A only password-reset emails from Supabase Auth appear in Mailpit at `http://127.0.0.1:54324`: the demo accounts are created already confirmed, and the mock API persists nothing and never calls the Auth Admin invite. Invitation and registration emails appear there from Stage B, when the real API calls the Auth Admin invite.

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant SPA as SPA dev build
    participant AUTH as Supabase Auth in local Docker
    participant MOCK as Mock API
    participant FIX as Fixtures
    Note over AUTH: npm run auth:personas created the demo accounts with password test1234, DD-43
    U->>SPA: Pick a demo account on /signin
    Note over SPA: quick-pick rendered only under import.meta.env.DEV, stripped from production builds, checked by scan-bundle
    SPA->>AUTH: signInWithPassword through supabase-js
    AUTH-->>SPA: Session with ES256 access token and refresh token
    SPA->>MOCK: GET /api/v1/me/context, Bearer token, no X-Tenant-Id
    Note over MOCK: real verify.ts: header, alg allow-list, kid in cached JWKS, getClaims, iss pin
    alt token rejected, or no fixture persona for the verified email
        MOCK-->>SPA: 401 problem+json
    else persona found
        MOCK->>FIX: persona memberships and effective permissions
        FIX-->>MOCK: static fixture data
        MOCK-->>SPA: 200 context with environment.mode prototype
        Note over SPA: prototype banner shown, static demo data
    end
```

**Supplier self-registration.** The owner approved the proposed approach on 2026-09-29 (architecture-plan §11 item 4). Supabase self-signup stays disabled (`enable_signup = false`), locally and hosted (brief §5.7). The public `/register` form posts to the TenderIQ API, which does four things:
1. It validates the request and checks for duplicates.
2. It rate-limits public POSTs per IP hash and per email hash (DD-28).
3. In one transaction, it creates the supplier tenant (status `pending`), the user (`invited`), a pending membership and the supplier profile, and commits.
4. After the commit, it calls the Auth Admin invite, because brief §5.6 forbids network calls inside a transaction. If the invite fails, a short follow-up transaction sets the registrant’s `invitations` row to `send_failed`, and the state guard allows a retry. The committed registration is not rolled back (DD-27).

Supabase Auth sends the verification and set-password email, which lands in Mailpit locally. See [04-security-model.md §3.6](04-security-model.md#36-invitations-and-registration) and [adr/0012-supplier-registration-via-provisioned-accounts.md](adr/0012-supplier-registration-via-provisioned-accounts.md).

**Failure handling.**

| Condition | Decided by | Result |
|---|---|---|
| Wrong email or password | Supabase Auth | One generic message. The form cannot be used to discover accounts (brief §5.7). |
| Malformed token, disallowed algorithm, unknown `kid`, expired token, wrong `iss` | Authentication middleware | 401. The reason goes to the server log only. An unknown `kid` is rejected without a network round-trip. |
| Valid token but no `users` row, or user `suspended` or `deactivated` (AC-04) | Authentication middleware | 401. The SPA signs out and redirects. Past approvals and submissions remain attributable (BR-38). |
| Valid token for an account with no fixture persona (Stage A) | Mock API authentication | 401, the prototype's equivalent of a missing `users` row (DD-43). |
| User in status `invited` | Authentication middleware | Only `POST /api/v1/me/invitations/:token/accept` is allowed. Accepting activates the membership, and the user if needed (DD-27). The Supabase invite link leads to `/invite/:token`, where the user sets a password. Locally the invitation email lands in Mailpit (DD-43; backend workflow `ui-live-api`). |
| Forgotten password | Supabase Auth | `/forgot-password` and `/reset-password` use supabase-js. Supabase Auth sends the reset email over SMTP, which lands in Mailpit locally. The hosted SMTP provider is deferred, and the same credentials will serve Supabase Auth and the `email` channel (DD-43, DD-44). |
| Supabase Auth Admin invite fails during supplier registration | suppliers service | The invite runs after the registration transaction has committed, so nothing is rolled back. A short follow-up transaction sets the registrant’s `invitations` row to `send_failed`, and the registrant sees "we could not send the verification email — try again". The state guard allows a retry. A "resend verification" action and the unique `users.email` constraint prevent duplicate organizations and users. Abandoned pending registrations stay visible to operators in the supplier registration and duplicate review, where they can be closed (DD-27). |
| Membership `invited`, `pending_approval`, `suspended` or `revoked` | `/me/context` shows it; tenant middleware refuses it | The SPA can show a pending membership but cannot act in it. Any call with that tenant returns the identical 403. |
| `X-Tenant-Id` names a tenant the user does not belong to, an inactive tenant, or a tenant whose kind does not match the prefix | Tenant middleware | Identical 403 for every cause, so the response cannot reveal which tenants exist. |
| Permission missing for the route | `requirePermission` | 403. The SPA hides permission-bound navigation, but the backend is the authority. |
| Grant, restriction, delegation or role assignment outside its dates | Permission resolution | Applied on every request: `starts_at`, `expires_at` (or `ends_at`) and `revoked_at` are compared directly. The expiry jobs only update display statuses and send notices (DD-18). |
| Action on a `/me/*` row with `X-Tenant-Id` different from the row's tenant | Tenant middleware and the owning service | Refused. The personal list spans memberships, but every action runs in the row's tenant (DD-21). |
| Access token expires | supabase-js automatic refresh | The SPA reads the token per request. A 401 signs the user out. |
| Platform operator acting in a customer tenant | Tenant middleware | Only with a customer-authorized `support_access_grants` row whose `starts_at`, `expires_at` and `revoked_at` allow access now. A buyer administrator authorizes it with `org.support_access.authorize` (DD-23). Access is read-only through `support.view` and audited in the customer tenant before the handler (DD-11). See [Flow 7](#9-flow-7-sealed-access-staged-opening-and-price-gate-ac-15-ac-16) and [adr/0013-operator-support-access-grants.md](adr/0013-operator-support-access-grants.md). |

---

## 4. Flow 2: Procurement request approval routed by authority (AC-05)

**Narrative.** Submitting a request snapshots the exact version and opens a version-bound approval request (`subject_type = 'procurement_request'`, `subject_version`, `content_hash`, `amount`, `currency`, `legal_entity_id`, `category_id`). Authority is checked again at decision time against `authority_limits` (`decision_type = 'request_approval'`, amount, currency, entity, category, effective dates) and active `delegations` (BR-06). Self-approval is blocked by `sod_policies` rule `requester_vs_request_approval` unless the policy records alternative oversight (BR-07). Deciding a step requires `approval.decide`, the decision-specific permission and sufficient authority (DD-24). The approver finds the approval in the personal inbox (`/me/approvals/:id`, COM-04 and COM-05), and the decision call carries `X-Tenant-Id` equal to the approval's tenant (DD-21). The final state is dispatched to the requests domain through `domains/approvals/outcome-registry.ts`. Demo: PR-2026-0003 exceeds `mpho.manager`'s limit of BWP 2,000,000 and is routed to `keabetswe.approver` (limit BWP 10,000,000).

```mermaid
sequenceDiagram
    autonumber
    actor R as Requester
    actor M as Procurement manager
    actor A as Approver with higher limit
    participant SPA as SPA
    participant API as API middleware
    participant RQS as requests service
    participant APS as approvals service
    participant DB as Postgres
    R->>SPA: Submit PR-2026-0003 on BUY-03
    SPA->>API: POST /api/v1/buyer/... submit request
    Note over API: auth, buyer tenant, request.create
    API->>RQS: submit request
    RQS->>DB: BEGIN
    RQS->>DB: load request, canTransition draft to submitted
    RQS->>DB: record_snapshots through the lifecycle core service, version = revision, content_hash
    RQS->>DB: procurement_requests status submitted, submitted_at, audit_log
    RQS->>APS: create approval for procurement_request, version, hash, amount, currency, entity, category
    APS->>DB: authority_limits and active delegations for request_approval
    APS->>DB: insert approval_requests pending and approval_steps
    APS->>DB: insert tasks of type approval for step approvers
    RQS->>DB: COMMIT
    RQS->>DB: pgmq.send notifications, approval needed
    API-->>SPA: 200 request submitted
    M->>SPA: Open the approval on COM-05 and choose Approve
    SPA->>API: POST /api/v1/buyer/... approval decision, X-Tenant-Id of the approval
    Note over API: auth, buyer tenant, approval.decide
    API->>APS: decide step, approve
    APS->>DB: step, request, current subject version and content_hash
    APS->>DB: decision-specific permission of the decider, DD-24
    APS->>DB: sod_policies requester_vs_request_approval
    APS->>DB: decider authority_limits and delegations for request_approval, exchange_rates at the request date when currencies differ
    alt amount above the decider authority
        APS-->>API: Result error, authority exceeded, required authority named
        API-->>SPA: problem+json, step unchanged
        SPA-->>M: Route shows the approver whose authority covers the amount
    end
    A->>SPA: Open the same approval and choose Approve
    SPA->>API: POST /api/v1/buyer/... approval decision
    API->>APS: decide step, approve
    APS->>DB: BEGIN
    APS->>DB: re-check version, hash, SoD and authority
    APS->>DB: approval_steps approved, authority_checked_amount, authority_limit_id, acting_for_user_id and delegation_id when delegated
    APS->>DB: approval_requests approved, decided_at, tasks completed, audit_log
    APS->>RQS: outcome handler for procurement_request from outcome-registry
    RQS->>DB: procurement_requests approved, decided_at
    APS->>DB: COMMIT
    APS->>DB: pgmq.send notifications, request approved
    API-->>SPA: 200 decision recorded
```

**Route selection.** The sources fix the decision-time invariant: the authority check uses `authority_limits` plus active `delegations`, and the step records `authority_checked_amount` and `authority_limit_id`. The algorithm that picks step approvers from `policy_thresholds.required_approval_level`, `authority_limits` and committees (`route_mode` sequential, parallel_all or committee_quorum) is finalized in Stage B.

**Failure handling.**

| Condition | Result |
|---|---|
| Decider's limit is below the amount, or the currency, entity, category or dates do not match | The step stays `pending`. Problem+json names the missing authority. The route shows who holds sufficient authority (AC-05). |
| Decider holds `approval.decide` but not the decision-specific permission | Refused. All three conditions are required: `approval.decide`, the decision-specific permission and sufficient authority (DD-24). |
| Authority limit in another currency than the request | Converted with `exchange_rates` at the request date. With no rate, the step routes to the next level up. It is never an assumed pass (DD-24). |
| Delegate decides | Allowed only within the delegation's `decision_types`, `max_amount`, currency, entity, category and dates. A trigger keeps a delegation's `max_amount` at or below the delegator's own limit when created. `acting_for_user_id` and `delegation_id` are recorded. |
| Requester tries to approve their own request | Blocked by `sod_policies` in `enforced` mode. In `alternative_oversight` mode the decision proceeds and the oversight note is part of the record. |
| Request edited after submission (new revision or content hash) | The approval no longer matches the current version and is invalidated, the same mechanism as [Flow 3](#5-flow-3-tender-release-approval-and-invalidation-ac-06). A prior approval is never reused for a different commercial decision (BR-10). |
| Approval passes `expires_at` while pending | The hourly `expire-approvals` job (approvals, at :05) moves it to `expired` and notifies the approver and the record owner. Expiry jobs only update display statuses and send notices (DD-18; [08-background-jobs.md](08-background-jobs.md#4-job-catalog)). |
| Notification publish fails after commit | Logged. The approval and its task exist, so the approver still sees it in COM-04, the personal inbox across memberships (DD-21). |

---

## 5. Flow 3: Tender release approval and invalidation (AC-06)

**Narrative.** A release approval targets one exact package: `subject_type = 'tender_release'`, `subject_version = tenders.draft_revision`, and the `content_hash` of the `record_snapshots` row. A material edit bumps `draft_revision`, which invalidates every approval bound to the previous revision (`approval_requests.status = 'invalidated'` with `invalidated_reason` and `invalidated_at`). `release_checks` rows carry the `draft_revision` they were recorded against, one per (`tender_id`, `check_area`, `draft_revision`) (DD-07), so checks recorded for an older revision no longer count. The snapshot is written through the lifecycle core service, which owns `record_snapshots` (DD-16). Whether release approval is required at all comes from the policy profile version (`requires_release_approval`). Demo: T-2026-0005 is `awaiting_release_approval`, then a scope and value edit invalidated its approval.

```mermaid
sequenceDiagram
    autonumber
    actor O as Tender officer
    actor AP as Release approver
    participant SPA as SPA
    participant API as API middleware
    participant TS as tenders service
    participant APS as approvals service
    participant LC as lifecycle service
    participant DB as Postgres
    O->>SPA: Request release approval on BUY-13
    SPA->>API: POST /api/v1/buyer/... request release approval
    Note over API: auth, buyer tenant, tender.edit
    API->>TS: request release approval
    TS->>DB: BEGIN
    TS->>DB: required information, approved evaluation plan, review assignments
    TS->>DB: release_checks for the current draft_revision passed or not_applicable
    TS->>LC: snapshot tender, version = draft_revision, content_hash
    LC->>DB: record_snapshots
    TS->>LC: transition draft to awaiting_release_approval
    LC->>DB: tenders.status, audit_log
    TS->>APS: create approval tender_release, subject_version, content_hash, amount, currency
    APS->>DB: approval_requests pending, approval_steps, tasks
    TS->>DB: COMMIT
    opt approver decides before any material edit
        AP->>SPA: Approve on COM-05
        SPA->>API: POST /api/v1/buyer/... approval decision
        API->>APS: decide
        APS->>DB: version and hash still current, decision-specific permission and release_approval authority, DD-24
        APS->>DB: approval_steps and approval_requests approved
        APS->>TS: outcome handler for tender_release
        TS->>LC: transition awaiting_release_approval to ready
    end
    O->>SPA: Edit scope and estimated value on BUY-09 or BUY-10
    SPA->>API: PUT /api/v1/buyer/... tender section
    Note over API: auth, buyer tenant, tender.edit
    API->>TS: update tender
    TS->>DB: BEGIN
    TS->>TS: classify the edit as material
    TS->>DB: tenders fields, draft_revision + 1
    TS->>APS: invalidate approvals for tender_release and this tender
    APS->>DB: approval_requests invalidated, invalidated_reason, invalidated_at
    APS->>DB: pending approval_steps invalidated, open approval tasks cancelled
    TS->>LC: move the tender out of ready if it was ready
    TS->>DB: audit_log with before and after state
    TS->>DB: COMMIT
    TS->>DB: pgmq.send notifications, approval invalidated
    API-->>SPA: 200, approval shown as invalidated
    Note over SPA: BUY-13 shows the invalidated approval and asks for a new request for the new revision
```

**Failure handling.**

| Condition | Result |
|---|---|
| Release approval requested with missing information, unapproved evaluation plan, or failed release checks | Result error listing the gaps. The tender stays `draft` (PRD §8.2, FR-07). |
| Approver acts on a version that was invalidated while the approval screen was open | The approvals service compares `subject_version` and `content_hash` with the current tender and refuses. No step changes. |
| Publication attempted without an approved release approval for the current `draft_revision` | Refused by the publication service ([Flow 4](#6-flow-4-publication-and-invitation-notices)). Publication is blocked while required approvals are incomplete (FR-07). |
| Non-material edit | `draft_revision` is unchanged, so approvals stand. The rule set that classifies an edit as material is finalized in Stage B. PRD FR-04 and FR-07 name scope, amount, funding, risk and contracting entity. |
| Tender was already `ready` when the material edit happened | The approval is invalidated and the tender leaves `ready`. The target state is a row in the lifecycle legality matrix, finalized in Stage B ([05-lifecycles.md](05-lifecycles.md)). |

---

## 6. Flow 4: Publication and invitation notices

**Narrative.** Releasing a tender does four things in one transaction: the lifecycle transition `ready → open`, an issued version (`tender_versions` with a `record_snapshots` snapshot, `tenders.current_version_no`), the freeze of `policy_profile_version_id` (BR-09), and formal notices (`notices` with `notice_type` `tender_issued` or `invitation`, plus `notice_recipients`). The publication service does not write `notices` itself: it asks the notifications service, which owns `notices` and `notice_recipients`, to issue them inside the same transaction ([03-data-model/03-shared-services.md §5](03-data-model/03-shared-services.md#5-notifications-and-formal-notices)). Release happens immediately or, for a scheduled publication, through the `publish-scheduled` job. `tenders.scheduled_release_at` is authoritative for the release time, and `publications.scheduled_at` mirrors it per channel (DD-15). Fan-out to people runs on the `notifications` queue, and the `notice-reconciliation` job re-enqueues recipients still `pending` after 10 minutes (DD-19). The events, producers and recipients are listed in the [notification event catalog](03-data-model/03-shared-services.md#51-notification-event-catalog) (row 3 for this flow). Formal notices go to both delivery channels: `in_app`, and `email` where email is enabled (`EMAIL_ENABLED`). The `email` channel sends over SMTP with `nodemailer`, locally to Mailpit, and carries only the title, the official deadline and a link (DD-44). Delivered, opened, acknowledged and terms-accepted are recorded as separate events (BR-41; [adr/0007-in-app-formal-notices.md](adr/0007-in-app-formal-notices.md)). For submission readiness, `participant_acknowledgments` is authoritative. `notice_recipients.acknowledged_at` records the delivery-level event and is written in the same transaction when the acknowledgment comes from a notice (DD-42). Accepting an invitation does not change the buyer-visible `participants.bid_intent`, which changes only through the explicit "notify buyer" action on SUP-07 or SUP-09 (DD-41). Public discovery reads `v_public_tenders`, which contains only `participation = 'open'` tenders of buyers whose public portal is enabled, in public-safe statuses (DD-13), so invitation-only T-2026-0006 never appears publicly (AC-01). References are unique per buyer, so public detail URLs carry the buyer slug (`/opportunities/:buyerSlug/:ref`), and supplier API paths use tender ids (DD-22).

### 6.1 Release

```mermaid
sequenceDiagram
    autonumber
    actor O as Tender officer
    participant SPA as SPA
    participant API as API middleware
    participant PUB as publication service
    participant LC as lifecycle service
    participant NS as notifications service
    participant JOB as publish-scheduled job
    participant DB as Postgres
    O->>SPA: Publish now or schedule on BUY-14
    SPA->>API: POST /api/v1/buyer/... publish or schedule
    Note over API: auth, buyer tenant, tender.publish
    API->>PUB: publish tender
    PUB->>DB: tender ready, tender_release approved for current draft_revision, no hold blocking publish
    alt schedule for later
        PUB->>DB: tenders.scheduled_release_at, authoritative, DD-15
        PUB->>DB: publications channel portal, status scheduled, scheduled_at mirrors the tender
        API-->>SPA: 200 scheduled
        JOB->>DB: every 5 minutes, ready tenders whose scheduled_release_at has passed
        JOB->>PUB: release the tender, one transaction per tender
    else publish now
        API-->>SPA: 200 after the release below
    end
    PUB->>DB: BEGIN
    PUB->>LC: transition ready to open and issue a version
    LC->>DB: tenders open, released_at, current_version_no + 1, policy_profile_version_id frozen
    LC->>DB: record_snapshots and tender_versions with snapshot_id
    PUB->>DB: publications published, published_at
    PUB->>NS: issue notice tender_issued, and invitation for invited suppliers, same transaction
    NS->>DB: notices status issued, issued_at, issued_by
    NS->>DB: notice_recipients pending per recipient organization
    PUB->>DB: participants invitation_status invited, invited_at
    PUB->>DB: audit_log tender.published
    PUB->>DB: COMMIT
    NS->>DB: pgmq.send notifications after commit, one message per notice
    opt external notice channel
        PUB->>DB: publications channel external_notice, status awaiting_confirmation
        alt confirmation recorded
            PUB->>DB: publications confirmed, confirmation_received_at, external_reference, reconciled
        else external service reports failure
            PUB->>DB: publications failed, failure_reason, integration_exceptions open, exception_task_id
            Note over PUB,DB: the event stays visibly unconfirmed until reconciled, AC-33
        end
    end
```

### 6.2 Notice fan-out, delivery and acknowledgment

```mermaid
sequenceDiagram
    autonumber
    actor S as Supplier user
    actor V as Public visitor
    participant SPA as SPA
    participant API as API middleware
    participant QD as queue drain
    participant NS as notifications handler
    participant REC as notice-reconciliation job
    participant PUB as publication service
    participant DB as Postgres
    participant MP as SMTP server or local Mailpit
    loop every minute, api/queue/drain.ts
        QD->>DB: pgmq.read notifications
        QD->>DB: BEGIN, INSERT job_idempotency_key ON CONFLICT DO NOTHING
        QD->>NS: handle message, ids and tenant id from the envelope
        NS->>DB: re-read notice and notice_recipients
        NS->>DB: resolve recipient users from notification_rules.recipient_roles and memberships
        alt recipient organization has a deliverable user
            NS->>DB: notifications in the recipient tenant partition, DD-11, category formal_notice, requires_acknowledgment, notice_recipient_id
            NS->>DB: notification_deliveries channel in_app, status delivered
            NS->>DB: notice_recipients delivered, delivered_at
        else no deliverable recipient
            NS->>DB: notice_recipients failed, failure_reason
            NS->>DB: task delivery_exception for the responsible owner through the approvals service, exception_task_id
            Note over NS,DB: no deadline changes, BR-42
        end
        QD->>DB: pgmq.delete, COMMIT
        opt EMAIL_ENABLED and a recipient user resolved, DD-44
            NS->>MP: SMTP through nodemailer, title, official deadline and link only
            alt message accepted
                MP-->>NS: accepted, locally by Mailpit
                NS->>DB: notification_deliveries channel email, status delivered, attempted_at
            else send fails
                MP-->>NS: error
                NS->>DB: notification_deliveries channel email, status failed, failure_reason
            end
            Note over NS,MP: a network call, never inside a database transaction. Exact placement and retry are finalized in Stage B
        end
    end
    loop every 10 minutes
        REC->>DB: notice_recipients still pending 10 minutes after creation
        REC->>DB: pgmq.send notifications again, ids only, DD-19
        Note over REC,DB: a duplicate of a slow message is skipped by the idempotency key and the re-read
    end
    S->>SPA: Open the notice on COM-06
    SPA->>API: POST /api/v1/... notice opened
    API->>DB: notifications read_at, notice_recipients opened_at
    S->>SPA: Acknowledge, then accept terms where required
    SPA->>API: POST /api/v1/... acknowledge notice
    Note over API: auth, supplier tenant, supplier.notices.acknowledge, DD-23
    API->>DB: BEGIN
    API->>DB: participant_acknowledgments for the notice, authoritative for readiness, DD-42
    API->>DB: notice_recipients acknowledged_at, acknowledged_by, the delivery-level event
    API->>DB: terms_accepted_at when terms are accepted, a separate event, BR-41
    API->>DB: COMMIT
    S->>SPA: Accept the invitation on SUP-07
    SPA->>API: POST /api/v1/supplier/... accept invitation, tender id in the path
    API->>PUB: accept invitation
    PUB->>DB: participants invitation_status accepted, confidentiality_accepted_at when a condition applies
    Note over PUB,DB: bid_intent changes only through the explicit notify buyer action, DD-41
    V->>SPA: Search /opportunities, PUB-02
    SPA->>API: GET /api/v1/public/... opportunities, no auth, no tenant
    API->>DB: v_public_tenders
    DB-->>API: open participation, buyer portal enabled, public-safe statuses, no internal budget, DD-13
    API-->>SPA: 200 public list
    Note over SPA: detail links are /opportunities/buyerSlug/ref, DD-22
```

**Failure handling.**

| Condition | Result |
|---|---|
| Tender not `ready`, release approval not approved for the current `draft_revision`, or a hold whose `blocked_actions` include `publish` | Result error. Nothing is published. |
| `publish-scheduled` finds that the approval was invalidated after scheduling | The per-item re-check fails, the tender stays unreleased, and the run reports the skip ([08-background-jobs.md](08-background-jobs.md#4-job-catalog)). |
| Queue publish fails after commit | Logged. The notices and `notice_recipients` rows exist with `delivery_status = 'pending'`. The `notice-reconciliation` job (every 10 minutes) re-enqueues recipients still `pending` after 10 minutes (DD-19; [08-background-jobs.md](08-background-jobs.md#4-job-catalog)). |
| Acknowledgment arrives from the notice | `participant_acknowledgments` (authoritative for readiness) and `notice_recipients.acknowledged_at` are written in one transaction (DD-42). |
| Public detail page for a reference used by two buyers | Not ambiguous: public URLs carry the buyer slug, `/opportunities/:buyerSlug/:ref` (DD-22). |
| Recipient organization cannot be reached | `notice_recipients.delivery_status = 'failed'` and a `delivery_exception` task. The deadline is not altered (BR-42). |
| Handler fails mid-message | The message transaction rolls back, including the idempotency claim, and the message is retried after its visibility timeout. It is archived after the maximum attempts. |
| Email channel | Resolved — DD-44: the `DeliveryChannel` port has `in_app` and `email` implementations (architecture-plan §3.8). When `EMAIL_ENABLED`, formal notices are also emailed over SMTP with `nodemailer`, and non-mandatory events follow the user's preferences. Locally every message goes to Mailpit in the Supabase Docker stack (SMTP `127.0.0.1:54325`, web UI `http://127.0.0.1:54324`), and the `email` delivery is recorded as `delivered` when Mailpit accepts it. The email carries only the title, the official deadline and a link, never bid, evaluation or other confidential content (BR-43, PRD ADM-12). Original wording, kept for traceability: "No email provider is approved. Only the `in_app` `DeliveryChannel` exists (architecture-plan §3.8)." |
| Email not enabled | Notices are in-app only, and no `email` rows are written to `notification_deliveries` (DD-44). The schema's `status = 'not_configured'` value is therefore not produced by any designed flow. |
| Email delivery events in a hosted environment (bounce, open) | Deferred (DD-44). The hosted provider and its delivery-event webhooks are chosen before the first hosted environment (`docs/plan/email-delivery-options.md` §3). Opening and acknowledging a notice are recorded in the app (COM-06). |
| External notice confirmation | How confirmation or failure is captured (manual entry on BUY-14 or an integration) is finalized in Stage B. The recorded states and the `integration_exceptions` row are fixed by the schema and AC-33. |
| Recipients of `tender_issued` for open tenders | PRD §14.3 names "approved supplier audience and relevant buyer owners" ([event catalog](03-data-model/03-shared-services.md#51-notification-event-catalog) row 3). Matching against `notice_subscriptions` and `saved_searches` is finalized in Stage B. |

---

## 7. Flow 5: Supplier submission with official receipt time (AC-11 to AC-13)

**Narrative.** Saving and internal approval never establish submission (BR-18). Submission is one transaction that locks the tender row `FOR SHARE`, reads `clock_timestamp()` as the **official receipt time**, and compares it with the effective deadline: `lots.submission_deadline` when set, which is authoritative for that lot, otherwise the tender's `tender_milestones` row (`submission_deadline`, `lot_id` null) (DD-15). Every attempt, including late and failed ones, is recorded in `submission_attempts` with its true time and the deadline at the time of the attempt (AC-13). A successful replacement supersedes the earlier revision and receipt. A failed replacement leaves the earlier receipt effective and issues no receipt (BR-19, AC-12). Supplier access goes through `forSupplier(db, supplierTenantId)`, which reaches only `[S]` tables (DD-03). Inserts name the buyer `tenant_id` explicitly after the service verifies participation (architecture-plan §3.1; [adr/0011-official-receipt-time-from-database.md](adr/0011-official-receipt-time-from-database.md)). The submission is audited in the buyer's `audit_log` partition, with `actor_capacity` naming the supplier organization (DD-11). The receipt number comes from `next_reference` for the buyer tenant (`RCPT-2026-000001`), with the year taken in the buyer's official time zone (DD-09). Each `receipt_inventory_items` row records the envelope of its file (DD-05).

**Why `FOR SHARE`.** Shared locks do not conflict with each other, so submissions from different suppliers proceed in parallel. Anything that updates the tender row, such as the `close-tenders` transition or an addendum that bumps `current_version_no` ([Flow 6](#8-flow-6-addendum-after-submissions-ac-10)), waits for in-flight submission transactions to commit, and in-flight submissions wait for such an update to commit. An addendum that changes a deadline also updates `tenders.updated_at` in the same transaction, so the tender-row lock serializes deadline changes too (DD-15). A deadline or version change therefore never interleaves with a receipt.

Demo: on T-2026-0002, Gaborone Metering has an earlier effective receipt and a failed replacement attempt, and Chobe has a late attempt recorded and rejected.

```mermaid
sequenceDiagram
    autonumber
    actor C as Supplier contributor
    actor AP as Supplier approver
    actor S as Supplier submitter
    participant SPA as SPA
    participant API as API middleware
    participant BS as bids service
    participant DB as Postgres
    C->>SPA: Save answers and prices on SUP-12 and SUP-13
    Note over SPA: live totals use src/contracts/decimal.ts, the server recomputes, DD-32
    SPA->>API: PUT /api/v1/supplier/... draft revision
    API->>BS: save draft
    BS->>DB: bid_answers and bid_prices on the draft revision
    AP->>SPA: Approve internally on SUP-15
    SPA->>API: POST /api/v1/supplier/... internal approval, supplier.response.approve
    API->>BS: approve internally
    BS->>DB: bid_internal_approvals approved, content_hash_at_decision
    BS->>DB: bid_revisions approved_internally, internally_approved_at
    Note over SPA: bids.submission_state stays not_submitted, the UI shows Not submitted, AC-11
    S->>SPA: Final declaration and Submit on SUP-16
    Note over SPA: submit button disabled while the request is in flight, DD-39
    SPA->>API: POST /api/v1/supplier/... submit revision, optional Idempotency-Key
    Note over API: auth, supplier tenant, supplier.response.submit
    API->>BS: submit revision
    BS->>DB: forSupplier, S tables only: bid, revision, participants row for this supplier and tender
    BS->>DB: BEGIN
    BS->>DB: SELECT tenders row FOR SHARE
    BS->>DB: t = clock_timestamp()
    BS->>DB: effective deadline, lots.submission_deadline when set, else tender milestone with lot_id null, DD-15
    alt tender not open or t after the deadline
        BS->>DB: submission_attempts failed_late, started_at, completed_at = t, deadline_at_attempt
        BS->>DB: bid_revisions late_rejected
        BS->>DB: audit_log, COMMIT
        API-->>SPA: problem+json late, true receipt time shown, no receipt
    else readiness fails, for example a failed replacement
        Note over BS: missing mandatory answers, unacknowledged addendum, internal approval hash mismatch, unmet participation condition
        BS->>DB: submission_attempts failed_validation, failure_reason, completed_at = t
        BS->>DB: bid_revisions submission_failed
        Note over DB: bids.effective_revision_id and the earlier receipt are untouched, AC-12
        BS->>DB: audit_log, COMMIT
        API-->>SPA: 422 problem+json with readiness errors, no receipt
    else accepted
        BS->>DB: next_reference for the buyer tenant and prefix RCPT, reference_counters row locked
        BS->>DB: submission_receipts received, received_at = t, tender_version_no
        BS->>DB: receipt_inventory_items from confirmed document_versions with sha256 and envelope, DD-05
        BS->>DB: previous effective revision superseded, its receipt superseded
        BS->>DB: bid_revisions submitted, submitted_at = t, receipt_id
        BS->>DB: bids effective_revision_id, submission_state submitted
        BS->>DB: submission_attempts succeeded, completed_at = t
        BS->>DB: audit_log, COMMIT
        BS->>DB: pgmq.send notifications, submission succeeded
        API-->>SPA: 200 receipt number and official receipt time in the tender zone
    end
```

Official times render with the IANA zone name and the numeric offset from Intl, for example `14 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone`, never as a countdown alone. A short abbreviation such as CAT is shown only when Intl provides one (DD-33, architecture-plan §3.4).

**Buyer view.** Before opening, the buyer sees only `v_bid_receipt_metadata`: `tenant_id` (for `forTenant`), `supplier_tenant_id`, the supplier legal name valid at `received_at` (from `supplier_legal_names`), bid id, effective receipt number, `received_at`, status (including withdrawn) and document count. Drafts are never visible to buyers (BR-17, DD-13).

**Late submission exception.** When the policy profile version has `late_submission_policy = 'exception_route'`, the buyer can open a `late_submission_exceptions` row (`attempt_id`, `policy_basis`, `evidence`, `equal_treatment_review`, `decision` pending) decided through an approval of subject type `late_submission_exception`. The table is `[R]`: buyer-internal and not reachable through `forSupplier` (DD-03). The recorded times are never edited (BR-20).

**Failure handling.**

| Condition | Result |
|---|---|
| Contributor without `supplier.response.submit` (AC-03) | 403 from `requirePermission` before the service runs. The contributor can still edit assigned work. |
| Finer authority failure inside the service | Attempt recorded with outcome `failed_authority`. |
| Material change after internal approval | `bid_internal_approvals.content_hash_at_decision` no longer matches the revision's `content_hash`. The approval is `invalidated`, and submission readiness fails until re-approval (FR-11). |
| Deadline passed, or tender already `closed` | `failed_late`, true time preserved, revision `late_rejected`, no `received` receipt (AC-13). |
| Replacement fails validation | `failed_validation`, revision `submission_failed`. The earlier revision and receipt stay effective (AC-12). |
| Unexpected error inside the transaction | The transaction rolls back and nothing of the submission persists. AC-13 requires the attempt to be recorded as `failed_error`. How it is persisted after the rollback is finalized in Stage B. |
| Response lost in transit (network outage after commit) | The receipt list on SUP-17 is the source of truth. The UI must not imply success without an official receipt (FR-12). |
| Submission retried, with or without the same `Idempotency-Key` | Every retry still records its own `submission_attempts` row, which is intended evidence (DD-39). The SPA disables the submit button while a request is in flight. |
| Two concurrent submissions of the same bid | The partial unique index allows at most one `submitted` revision per bid. Further serialization for the same bid is finalized in Stage B. |
| Explicit withdrawal (AC-14) | Separate command: a `withdrawals` row with a `confirmation_no`, the revision and receipt move to `withdrawn`, and `bids.submission_state = 'withdrawn'`. |

---

## 8. Flow 6: Addendum after submissions (AC-10)

**Narrative.** A change to scope, terms, submission requirements or evaluation becomes a formal addendum (BR-16). The addendum records materiality, affected lots, requirement changes, any new deadline, the response-time assessment, and what existing submissions must do (`existing_submission_action`: none, acknowledge, supplement or replace). Issuing it is the only path by which the clarifications domain writes `requirements`, `tender_milestones` and `lots.submission_deadline`, through the lifecycle snapshot API (architecture-plan §4). Issuing bumps `tenders.current_version_no` and, when a deadline changes, `tenders.updated_at` (DD-15), so it waits for in-flight submissions holding `FOR SHARE` ([Flow 5](#7-flow-5-supplier-submission-with-official-receipt-time-ac-11-to-ac-13)). The `addendum` notice, and a `deadline_change` notice when dates move, are issued through the notifications service in the same transaction, as in [Flow 4](#6-flow-4-publication-and-invitation-notices). The supplier's acknowledgment is recorded in `participant_acknowledgments`, which is authoritative for submission readiness. When it comes from the notice, `notice_recipients.acknowledged_at` is written in the same transaction (DD-42). Prior receipts are retained. Demo: T-2026-0002 has an addendum issued after 2 of 3 submissions, adding a mandatory requirement with action "acknowledge and supplement".

```mermaid
sequenceDiagram
    autonumber
    actor O as Tender officer
    actor AP as Addendum approver
    actor S as Supplier with a receipt
    participant SPA as SPA
    participant API as API middleware
    participant CS as clarifications service
    participant APS as approvals service
    participant LC as lifecycle service
    participant NS as notifications service
    participant PUB as publication service
    participant DB as Postgres
    O->>SPA: Draft addendum on BUY-17, directly or from an escalated question
    SPA->>API: POST /api/v1/buyer/... addendum
    Note over API: auth, buyer tenant, tender.clarifications.manage
    API->>CS: create addendum
    CS->>DB: addenda draft, number, materiality material, changes_submission, existing_submission_action supplement
    CS->>DB: addendum_lots, addendum_requirement_changes added mandatory requirement
    CS->>DB: questions escalated_to_addendum with addendum_id when escalated
    opt approval required by policy
        CS->>APS: approval for subject addendum
        AP->>SPA: Approve on COM-05, tender.addenda.approve
        APS->>CS: outcome handler, addenda approved
    end
    O->>SPA: Issue the addendum
    SPA->>API: POST /api/v1/buyer/... issue addendum
    API->>CS: issue addendum
    CS->>DB: BEGIN
    CS->>LC: snapshot API, apply addendum
    LC->>DB: UPDATE tenders current_version_no + 1, and updated_at when a deadline changes, waits for in-flight FOR SHARE submissions, DD-15
    LC->>DB: requirements added or modified, tender_milestones and lots.submission_deadline when dates change
    LC->>DB: record_snapshots and tender_versions with addendum_id
    CS->>NS: issue notice addendum, plus deadline_change when dates moved, same transaction
    NS->>DB: notices status issued, issued_at, issued_by
    NS->>DB: notice_recipients for every eligible participant of the affected lots
    NS-->>CS: notice id
    CS->>DB: addenda issued, issued_at, resulting_version_no, notice_id
    CS->>DB: audit_log, COMMIT
    NS->>DB: pgmq.send notifications after commit, fan-out as in Flow 4
    S->>SPA: Open SUP-08 and SUP-17
    SPA->>API: GET /api/v1/supplier/... readiness
    API-->>SPA: earlier receipt still effective, action required acknowledge and supplement
    S->>SPA: Acknowledge the addendum
    SPA->>API: POST /api/v1/supplier/... acknowledge addendum
    API->>PUB: acknowledge
    PUB->>DB: BEGIN
    PUB->>DB: participant_acknowledgments subject_type addendum, acknowledged_by, acknowledged_at, authoritative for readiness
    opt acknowledged from the addendum notice
        PUB->>NS: record the delivery-level acknowledgment, same transaction, DD-42
        NS->>DB: notice_recipients acknowledged_at, acknowledged_by
    end
    PUB->>DB: COMMIT
    S->>SPA: Prepare the supplement as a new revision based_on_revision_id and submit
    Note over SPA,DB: submission follows Flow 5, a new receipt is issued and the earlier receipt becomes superseded but is kept
    alt supplier does not resubmit before closing
        Note over DB: the earlier receipt stays effective but does not satisfy the new mandatory requirement, compliance_checks record an explicit finding after opening, BR-23
    end
```

**Failure handling.**

| Condition | Result |
|---|---|
| Issue attempted while approval is required but not approved | Result error. Nothing changes. |
| Late registrant | Receives the complete current package and the amendment history (FR-10), because the package is read from the current issued version. |
| Revision prepared against an older version | Readiness compares `bid_revisions.acknowledged_tender_version` and `participant_acknowledgments` (the authoritative acknowledgment record, DD-42) with the current version. A missing mandatory acknowledgment blocks submission ([Flow 5](#7-flow-5-supplier-submission-with-official-receipt-time-ac-11-to-ac-13), `failed_validation`). |
| Notice undeliverable to a participant | `delivery_exception` task. The deadline is not changed silently (BR-42). |
| Addendum issue racing a submission | Serialized by the tender row lock. A submission that committed first carries the old `tender_version_no` on its receipt. A later one sees the new version and requirements. |

---

## 9. Flow 7: Sealed access, staged opening and price gate (AC-15, AC-16)

**Narrative.** Bid content tables are sealed. Buyer users read them only through `sealing.assertEnvelopeReadable()` or `readableEnvelopes()`, which require an `envelope_openings` row, an assignment to the tender, lot or criterion, a `price_gate_releases` row for a staged commercial envelope, and a signed confidentiality undertaking plus conflict declaration (architecture-plan §3.3; [adr/0003-application-layer-sealing.md](adr/0003-application-layer-sealing.md)). An organization administrator holds `org.*` permissions only and no assignment, so administration gives no early access (BR-26). A support agent acts through a support access grant limited to `support.view`, which never includes sealed content. A declared conflict blocks restricted access while its disposition is `pending_review`. Access resumes only on `cleared` or `mitigated`, and `recused` or `reassigned` block it permanently for that subject (DD-25). Opening needs the assigned opening officer and the quorum or second person that the policy profile version requires. Envelopes follow a fixed mapping: `bid_answers` copy the envelope of their requirement, `bid_answer_documents` follow their answer, `bid_declarations` are `qualification`, `bid_subcontractors` and `bid_key_personnel` are `technical`, and `bid_prices`, `bid_commercial_terms` and `bid_exceptions` are `commercial`. A single-stage opening (`opening_sessions.envelope = 'all'`) writes one `envelope_openings` row per envelope in the same transaction (DD-05). The opening domain may also set `submission_receipts.status = 'selected_for_evaluation'` (DD-17). The price gate (`price_gate_releases`) is written by the evaluation domain: the evaluation chair releases it with permission `evaluation.chair` after non-price moderation is finalized, and the commercial opening follows (DD-16, DD-23). Audit rows for opening and evaluation actions hold ids and hashes only, never sealed content or scores (DD-31). Demo: T-2026-0008 is `closed` with two sealed submissions that `admin.kwu` and `support.agent` cannot read. T-2026-0003 has its technical envelope opened and its price gate released.

### 9.1 Administrative and support access to a sealed bid

```mermaid
sequenceDiagram
    autonumber
    actor ADM as Org administrator
    actor SA as Support agent
    participant SPA as SPA
    participant API as API middleware
    participant BID as bids service
    participant SEAL as sealing service
    participant DB as Postgres
    ADM->>SPA: Open bids of T-2026-0008 on BUY-19
    SPA->>API: GET /api/v1/buyer/... submission monitoring
    Note over API: auth and buyer tenant pass
    API->>BID: receipt metadata
    BID->>DB: v_bid_receipt_metadata
    API-->>SPA: 200 receipt numbers, times, document counts, no content
    ADM->>SPA: Try to open bid content
    SPA->>API: GET /api/v1/buyer/... bid content
    Note over API: org_admin role holds org.* only
    API-->>SPA: 403 missing permission
    SA->>SPA: Open the customer record under a support case, OPS-04
    SPA->>API: GET customer-tenant route with X-Tenant-Id of the customer
    API->>DB: support_access_grants customer-authorized for this operator and tenant, starts_at, expires_at and revoked_at compared now, DD-18
    API->>DB: audit_log in the customer tenant with support_grant_id, before the handler, DD-11
    Note over API: permission set is support.view only, read-only
    API-->>SPA: 403 for any bid-content endpoint
    Note over SEAL,DB: second line of defense: neither persona holds an assignment or an envelope opening, so assertEnvelopeReadable refuses even if a permission were misconfigured
```

### 9.2 Staged opening and price gate

```mermaid
sequenceDiagram
    autonumber
    actor OO as Opening officer
    actor WIT as Witness
    actor CH as Evaluation chair
    actor CR as Commercial reviewer
    participant SPA as SPA
    participant API as API middleware
    participant OPN as opening service
    participant EVS as evaluation service
    participant SEAL as sealing service
    participant LC as lifecycle service
    participant DB as Postgres
    OO->>SPA: Start the technical opening on BUY-20
    SPA->>API: POST /api/v1/buyer/... opening session
    Note over API: auth, buyer tenant, bid.open
    API->>OPN: open session, envelope technical
    OPN->>DB: tender closed or under_assessment, opening_officer on tender_team_members
    OPN->>DB: undertaking, declaration, sod_policies submission_custody_vs_opening, no hold blocking open
    OPN->>DB: opening_sessions awaiting_quorum, opening_participants
    WIT->>SPA: Confirm presence
    SPA->>API: POST /api/v1/buyer/... confirm participant, bid.witness
    API->>OPN: confirm
    OPN->>DB: opening_participants confirmed_at
    OPN->>DB: BEGIN
    OPN->>DB: quorum_required and second person met
    OPN->>DB: envelope_openings per effective revision for the envelopes due in open_order
    OPN->>DB: opening_sessions completed, opened_at, minutes, irregularities
    OPN->>LC: transition closed to under_assessment on the first opening
    OPN->>DB: audit_log, COMMIT
    CR->>SPA: Try to view prices on EVA-04
    SPA->>API: GET /api/v1/buyer/... commercial content
    API->>EVS: commercial content
    EVS->>SEAL: readableEnvelopes
    SEAL->>DB: no price_gate_releases for the tender and lot
    SEAL-->>EVS: commercial not readable
    API-->>SPA: 403, prices unavailable, AC-16
    CH->>SPA: Confirm the non-price assessment is complete
    SPA->>API: POST /api/v1/buyer/... release price gate
    Note over API: auth, buyer tenant, evaluation.chair, DD-23
    API->>EVS: release price gate
    EVS->>DB: check non-price moderation_sessions finalized for the tender and lot
    EVS->>DB: price_gate_releases released_at, released_by, non_price_complete_confirmed, note
    OO->>SPA: Commercial opening session with quorum, same steps as above
    OPN->>DB: envelope_openings commercial for bids not excluded
    CR->>SPA: View prices
    SPA->>API: GET /api/v1/buyer/... commercial content
    API->>EVS: commercial content
    EVS->>SEAL: readableEnvelopes
    SEAL->>DB: opening row, commercial assignment, gate row, undertaking, declaration with no conflict or one cleared or mitigated, DD-25
    SEAL-->>EVS: commercial readable
    API-->>SPA: 200 commercial envelope, bid_prices, bid_commercial_terms and bid_exceptions, DD-05
```

**Failure handling.**

| Condition | Result |
|---|---|
| Quorum or second person missing | Session stays `awaiting_quorum`. No `envelope_openings` rows are written. |
| Opening officer not assigned, or undertaking or declaration missing | Result error. Nothing opens (BR-08). |
| SoD rule `submission_custody_vs_opening` violated | Blocked in `enforced` mode (BR-07). |
| Hold whose `blocked_actions` include `open` | Opening refused. The hold changes no dates (BR-13). |
| Commercial read before the gate or before the commercial opening | Refused by sealing (AC-16). |
| Bid excluded before commercial opening | Its commercial envelope stays unopened unless the approved procedure permits later release (FR-13). |
| Withdrawn or late revisions | Not effective, so no `envelope_openings` row is created for them (BR-21). |
| Any module other than `sealing` reads a sealed table | A guard test fails the build (architecture-plan §3.3). |
| Permission and owner of the price-gate release | Written by the evaluation domain, which owns `price_gate_releases`. The chair releases the gate with `evaluation.chair` after non-price moderation is finalized (DD-16, DD-23; [03-data-model/09-opening-evaluation.md](03-data-model/09-opening-evaluation.md)). |
| Second release for the same tender and lot | Refused by the unique key (`tender_id`, `lot_id`), declared `UNIQUE NULLS NOT DISTINCT`, so a tender-level release (`lot_id` null) also exists at most once (DD-02). |
| Single-stage opening | `opening_sessions.envelope = 'all'` writes one `envelope_openings` row per envelope in the same transaction (DD-05). |
| Evaluator or reviewer with a declared conflict | Restricted access is blocked while the disposition is `pending_review`, resumes only on `cleared` or `mitigated`, and stays blocked for that subject after `recused` or `reassigned` (DD-25). |

---

## 10. Flow 8: Evaluation, moderation and ranking (AC-18 to AC-20)

**Narrative.** Evaluators accept an assignment only after a conflict declaration and confidentiality undertaking (BR-08). A score that has not been entered is `NULL`, never 0, and an assessment with an unscored assigned criterion cannot be submitted (AC-18). Where `independent_evaluation` is set, an evaluator does not see other evaluators' scores before submitting their own. Moderation writes `moderated_scores` with the method and reasons and never edits the individual `evaluation_scores`. Corrections add `score_corrections` rows (AC-20, BR-27). Ranking is computed by the pure scoring engine on decimal strings and reproduces PRD §9.2 exactly (AC-19). The evaluation domain writes `bids.evaluation_status`, which is one of the approved cross-domain writes (architecture-plan §4).

```mermaid
sequenceDiagram
    autonumber
    actor EV as Evaluator
    actor CH as Evaluation chair
    participant SPA as SPA
    participant API as API middleware
    participant EVS as evaluation service
    participant SC as scoring engine
    participant SEAL as sealing service
    participant DB as Postgres
    EV->>SPA: Accept the assignment on EVA-01
    SPA->>API: POST /api/v1/buyer/... accept assignment
    API->>EVS: accept
    EVS->>DB: conflict_declarations and confidentiality_undertakings for the tender
    EVS->>DB: evaluation_assignments accepted_at, in_progress
    EV->>SPA: Open responses on EVA-02
    SPA->>API: GET /api/v1/buyer/... assessment workspace
    API->>EVS: workspace
    EVS->>SEAL: readableEnvelopes
    SEAL-->>EVS: technical envelope for assigned criteria only
    EV->>SPA: Save scores, one criterion left unscored
    SPA->>API: PUT /api/v1/buyer/... draft scores, evaluation.score
    API->>EVS: save draft
    EVS->>DB: evaluation_scores draft, score NULL where not scored
    EV->>SPA: Submit the assessment
    SPA->>API: POST /api/v1/buyer/... submit assessment
    API->>EVS: submit
    EVS->>DB: assigned criteria with score NULL and is_not_applicable false
    alt a criterion is unscored
        EVS-->>API: Result error incomplete, missing criteria listed
        API-->>SPA: 422, assignment stays in_progress, nothing becomes 0, AC-18
    else complete
        EVS->>DB: evaluation_scores submitted, submitted_at, assignment submitted
    end
    CH->>SPA: Open moderation on EVA-05
    SPA->>API: POST /api/v1/buyer/... moderation session, evaluation.moderate
    API->>EVS: open moderation
    EVS->>DB: moderation_sessions open, method from evaluation_plans.aggregation_method
    opt chair returns an assessment for correction
        EVS->>DB: evaluation_assignments returned
        EV->>SPA: Correct a score with a reason
        SPA->>API: POST /api/v1/buyer/... score correction
        API->>EVS: correct
        EVS->>DB: score_corrections previous and new score, reason, returned_by_chair
        EVS->>DB: evaluation_scores new value, version + 1
    end
    CH->>SPA: Record the moderated result with reasons
    SPA->>API: POST /api/v1/buyer/... moderated score
    API->>EVS: moderate
    EVS->>DB: moderated_scores final_score, method, reasons, moderated_by
    Note over DB: individual evaluation_scores stay unchanged, AC-20
    CH->>SPA: Finalize moderation
    SPA->>API: POST /api/v1/buyer/... finalize moderation
    API->>EVS: finalize
    EVS->>DB: moderation_sessions finalized, finalized_at, assignments finalized
    Note over EVS,DB: after the price gate the commercial reviewer approves commercial_evaluations, Flow 7
    CH->>SPA: Compute ranking on EVA-06
    SPA->>API: POST /api/v1/buyer/... compute results
    API->>EVS: compute results
    EVS->>DB: moderated_scores, approved commercial_evaluations, evaluation_plans, evaluation_criteria, tie_break_rules
    EVS->>SC: pure calculation on decimal strings
    SC-->>EVS: per bid non-price, price, total, gates, rank, or incomplete
    EVS->>DB: evaluation_results draft, computed_at, audit_log
    API-->>SPA: 200 Tsodilo 88.00 rank 1, Serowe 86.00 rank 2
    CH->>SPA: Evaluation report and sign-off
    SPA->>API: POST /api/v1/buyer/... report sign-off, evaluation.signoff
    API->>EVS: sign off
    EVS->>DB: evaluation_reports in_signoff, evaluation_report_signoffs, then signed_off with snapshot_id
    EVS->>DB: evaluation_results signed_off, bids.evaluation_status evaluated
    Note over EVS,DB: trigger of evaluated finalized in Stage B, 05-lifecycles open point 14
```

**Worked example reproduced (PRD §9.2, demo T-2026-0003).** Rating scale 0 to 5. Weighted points = final rating ÷ `scale_max` × `max_points`. Price rule `lowest_ratio`: lowest eligible evaluated cost ÷ this offer's evaluated cost × price weight 30. Calculation uses `decimal_places_calc` (default 4). Display uses `decimal_places_display` (default 2).

| Criterion | Max points | Serowe (Supplier A) | Tsodilo (Supplier B) |
|---|---|---|---|
| Solution quality | 35 | 28.00 (4 of 5) | 31.50 (4.5 of 5) |
| Delivery approach | 20 | 16.00 | 18.00 |
| Relevant experience | 15 | 12.00 | 13.50 |
| Price (evaluated cost 100,000 vs 120,000) | 30 | 30.00 | 25.00 |
| **Total** | 100 | **86.00** | **88.00**, rank 1 |

**Failure handling.**

| Condition | Result |
|---|---|
| Unscored criterion | Submission refused. The assignment stays `in_progress`. The engine reports the bid as incomplete instead of computing a total with 0 (AC-18). |
| Evaluator has not signed the undertaking or declared conflicts | Assignment cannot be accepted, and sealing refuses content (BR-08). |
| Conflict declared (for example `sam.dual` on T-2026-0003) | While the disposition is `pending_review`, restricted access is blocked. It resumes only on `cleared` or `mitigated`. `recused` or `reassigned` block access permanently for that subject, and the assignment moves to `recused` or `reassigned` with `reassignment_reason` (DD-25). Prior work is preserved. |
| Scores seen by suppliers | Never. `evaluation_scores`, `moderated_scores`, `commercial_evaluations` and `evaluation_results` are `[R]` tables, unreachable through `forSupplier` (DD-03). Audit rows for scores hold ids and hashes only (DD-31). |
| Moderated score without reasons | 422. `moderated_scores.reasons` is required. |
| Commercial evaluation not approved | The engine cannot compute the price score. Results stay incomplete. |
| Display-rounded tie with different decision values | Ties are decided on calculation precision, then by `tie_break_rules` in sequence (PRD §9.3). |
| Rank treated as award | It is not. Ranking never triggers an award ([Flow 9](#11-flow-9-award-standstill-complaint-hold-and-final-award-ac-25)). |

---

## 11. Flow 9: Award, standstill, complaint hold and final award (AC-25)

**Narrative.** The award recommendation brings together signed-off evaluation results and the other inputs FR-17 lists. Submitting it moves the tender from `under_assessment` to `award_pending`, so approval, notification and any challenge hold all happen while the tender is `award_pending` (PRD §8.2 "Award decision pending"; [05-lifecycles.md](05-lifecycles.md)). It is approved through the approvals service with `award_approval` authority. A tender can have several `award_recommendations` over time, each covering the lots listed in its `lot_outcomes`, so lots on different timelines are supported. The final award is distinct from the intent: it is its own approval per lot outcome, of subject type `final_award`, recorded in `lot_outcomes.final_award_approval_id` (DD-14). Deciding either approval requires `approval.decide`, the decision-specific permission (for an award, `award.approve`) and sufficient authority (DD-24). Complaint holds are `holds` rows owned by the core `lifecycle` service, and tasks are created through the approvals service (DD-16). Every notice in this flow (`intent_to_award`, `unsuccessful_outcome`, `complaint_update`, `standstill_change`, `final_award`) is issued through the notifications service, as in [Flow 4](#6-flow-4-publication-and-invitation-notices). The intention-to-award notice is distinct from the final award notice. Where the policy requires it, the intent notice starts a standstill period computed by the time service from the policy's `standstill_length` and `standstill_day_type` and the tender's calendar. A timely blocking complaint creates a `holds` row whose `blocked_actions` include `award_final` and `contract_sign`. The hold changes no date (BR-13). The `standstill-monitor` job only creates a task when the standstill has ended with no blocking hold, deduplicated by its job idempotency key (DD-19). It never awards. Final award checks the approvals, the standstill, the holds and the conditions (BR-32). The public award notice is read through `v_public_awards`, which shows only published notices (DD-13), at `/awards/:buyerSlug/:ref` (DD-22). Demo: T-2026-0007 is `award_pending` with an intent notice issued, standstill running, and a blocking complaint from Limpopo Environmental Services.

### 11.1 Recommendation, approval and intent notice

```mermaid
sequenceDiagram
    autonumber
    actor O as Tender officer
    actor AP as Award approver
    participant SPA as SPA
    participant API as API middleware
    participant AW as awards service
    participant APS as approvals service
    participant TIME as time service
    participant LC as lifecycle service
    participant NS as notifications service
    participant DB as Postgres
    O->>SPA: Prepare and submit the recommendation on BUY-26
    SPA->>API: POST /api/v1/buyer/... award recommendation
    Note over API: auth, buyer tenant, award.recommend
    API->>AW: submit recommendation
    AW->>DB: signed-off evaluation_results, compliance, diligence state
    AW->>DB: award_recommendations draft, lot_outcomes recommended for the lots it covers
    AW->>LC: snapshot the recommendation version
    LC->>DB: record_snapshots
    AW->>APS: approval for subject award, version, hash, amount, currency
    AW->>DB: award_recommendations awaiting_approval
    AW->>LC: transition under_assessment to award_pending
    AP->>SPA: Approve on COM-05
    Note over APS: approval.decide, award.approve and award_approval authority, DD-24, the tender is award_pending
    APS->>AW: outcome handler for award
    AW->>DB: award_recommendations approved, lot_outcomes approved
    O->>SPA: Issue the intent notice on BUY-28
    SPA->>API: POST /api/v1/buyer/... issue intent notice
    Note over API: auth, buyer tenant, notice.issue
    API->>AW: issue intent
    AW->>TIME: standstill end from start basis, standstill_length, standstill_day_type, tender calendar
    TIME-->>AW: ends_at
    AW->>DB: BEGIN
    AW->>NS: issue notices intent_to_award and unsuccessful_outcome, same transaction
    NS->>DB: notices issued, notice_recipients pending
    NS-->>AW: intent notice id
    AW->>DB: standstill_periods running, starts_at, ends_at, day_type, intent_notice_id
    AW->>DB: lot_outcomes intent_notified, audit_log, COMMIT
    NS->>DB: pgmq.send notifications after commit
```

### 11.2 Complaint hold, standstill monitor and final award

```mermaid
sequenceDiagram
    autonumber
    actor SUP as Complainant supplier
    actor CO as Complaints owner
    actor O as Tender officer
    actor AP as Award approver
    participant SPA as SPA
    participant API as API middleware
    participant AW as awards service
    participant APS as approvals service
    participant JOB as standstill-monitor job
    participant LC as lifecycle service
    participant NS as notifications service
    participant DB as Postgres
    SUP->>SPA: Submit a complaint on SUP-22
    SPA->>API: POST /api/v1/supplier/... complaint
    Note over API: auth, supplier tenant, supplier.complaint.submit
    API->>AW: submit complaint
    AW->>DB: complaints received, reference CMP-2026-nnnn, received_at, within_window from complaint_window_days
    AW->>DB: complaint_events
    AW->>APS: task for the complaints owner, DD-16
    CO->>SPA: Acknowledge, confirm standing and independence, mark blocking on BUY-29
    SPA->>API: POST /api/v1/buyer/... complaint decision
    Note over API: auth, buyer tenant, complaint.manage
    API->>AW: mark blocking
    AW->>DB: BEGIN
    AW->>LC: place hold complaint_hold, blocked_actions award_final and contract_sign, DD-16
    LC->>DB: holds row with complaint_id, owner, review_date
    AW->>DB: complaints acknowledged, is_blocking, hold_id, complaint_events
    AW->>NS: issue notice complaint_update, same transaction
    AW->>DB: audit_log, COMMIT
    Note over DB: the hold changes no date, BR-13
    loop every 15 minutes
        JOB->>DB: standstill_periods running or extended whose end has passed
        alt blocking hold on the tender or lot
            JOB->>DB: no action
        else no blocking hold
            JOB->>DB: claim job idempotency key for the period and window, DD-19
            JOB->>APS: task for the award owner, never an award
        end
    end
    O->>SPA: Request the final award for the lot
    SPA->>API: POST /api/v1/buyer/... final award
    Note over API: auth, buyer tenant, permission declared by the awards contract
    API->>AW: request final award
    AW->>DB: intent approved, standstill ended, unreleased holds blocking award_final, conditions
    alt blocking hold active or standstill not ended
        AW-->>API: Result error, blocking hold and dates listed
        API-->>SPA: problem+json, lot outcome stays intent_notified, AC-25
    end
    CO->>SPA: Record the complaint outcome and release the hold
    SPA->>API: POST /api/v1/buyer/... complaint outcome and hold release
    API->>AW: resolve and release
    opt hold release requires approval
        Note over AW: approval of subject hold_release, as in Flow 2
    end
    AW->>DB: complaints response_issued or resolved, outcome, complaint_events
    AW->>LC: release the hold
    LC->>DB: holds released_at, released_by, release_reason
    opt revised waiting period decided
        AW->>DB: standstill_periods extended, extended_to, extension_reason
        AW->>NS: issue notice standstill_change
    end
    O->>SPA: Request the final award after the waiting period
    SPA->>API: POST /api/v1/buyer/... final award
    API->>AW: request final award
    AW->>DB: intent approved, standstill ended, no blocking hold, conditions met
    AW->>APS: approval for subject final_award for the lot outcome, DD-14
    AW->>DB: lot_outcomes final_award_approval_id
    AP->>SPA: Approve on COM-05
    Note over APS: approval.decide, award.approve and award_approval authority, DD-24
    APS->>DB: BEGIN
    APS->>DB: approval_steps and approval_requests approved
    APS->>AW: outcome handler for final_award
    AW->>DB: lot_outcomes final_awarded, final_awarded_at, final_award_approved_by
    AW->>NS: issue notice final_award, same transaction
    NS->>DB: notices issued, notice_recipients pending
    AW->>LC: transition award_pending to awarded or partially_awarded
    APS->>DB: audit_log, COMMIT
    Note over AW,DB: public_award_notices draft, reviewed for confidentiality and personal information, approved, published, BR-34, read through v_public_awards at /awards/buyerSlug/ref, DD-13 and DD-22
```

**Failure handling.**

| Condition | Result |
|---|---|
| Recommendation lacks signed-off evaluation results or has unresolved blocking conditions | Result error. Approval cannot be requested. |
| Approver lacks `award_approval` authority for the amount | As in [Flow 2](#4-flow-2-procurement-request-approval-routed-by-authority-ac-05). |
| Recommendation returned or rejected | The tender moves `award_pending → under_assessment` with a reason. The earlier recommendation version is kept ([05-lifecycles.md](05-lifecycles.md), a design reading finalized in Stage B). |
| Complaint outside `complaint_window_days` | Recorded with `within_window = false`. Admissibility is decided explicitly (`admissibility_review`). |
| Independent review required (`complaint_requires_independent_review`) | The case owner must not be the person whose conduct is challenged. `independence_confirmed` records it (FR-17). |
| Final award with an active blocking hold or before the standstill ends | Refused, and the reasons are listed (AC-25). |
| Final award approver lacks `award.approve` or authority for the lot's value | The `final_award` approval step stays `pending`, as in [Flow 2](#4-flow-2-procurement-request-approval-routed-by-authority-ac-05) (DD-14, DD-24). |
| Lots of one tender on different timelines | Each `award_recommendations` row covers the lots listed in its `lot_outcomes`, and each lot outcome has its own `final_award` approval (DD-14). |
| `standstill-monitor` misses ticks | The next tick finds the same periods. It never creates an award. A re-run creates no second task, because the task is deduplicated by a `<job>:<entity>:<window>` key in `job_idempotency_key` (DD-19; [08-background-jobs.md](08-background-jobs.md#4-job-catalog)). |
| Standstill start basis is receipt or acknowledgment (`notices.period_start_basis`) | The start instant depends on delivery events. How the period starts in that case is finalized in Stage B ([§15](#15-open-points) #8). |
| Contract signature while the hold is active | Refused by the contracts service ([Flow 10](#12-flow-10-contract-signature-handover-and-closeout-gate-ac-28-ac-29)). |

---

## 12. Flow 10: Contract, signature, handover and closeout gate (AC-28, AC-29)

**Narrative.** A contract is created from final-awarded lot outcomes. `legal_entity_id` is required before a binding commitment (BR-04). Allocations reconcile to awarded values: the sum of `contract_lot_allocations` for a lot outcome may not exceed its `awarded_value` (BR-33). A contract that differs from the award is flagged (`differs_from_award`, `difference_explanation`), and the difference must be approved before signature through its own approval of subject type `contract_difference`, recorded in `difference_approval_id` (AC-28, DD-14). Signature, effective date, notice to proceed and delivery start are separate milestones (BR-35). A contract is never active merely because it was sent for signature. The `contract-dates` job (daily 02:50 UTC) moves a `signed_not_effective` contract to `active` when its effective date is reached, and an `active` contract to `expired` after `term_end`, leaving open obligations in place (DD-19). An external signature failure is recorded by the contracts domain as an `integration_exceptions` row (DD-17, AC-33). The event closeout is gated: every lot has an explicit outcome, awarded lots have signed contracts, handovers are accepted, and no case or hold remains open. A failed gate is recorded as `event_closeouts.status = 'blocked'` with `blocking_reasons` (AC-29). Demo: C-2026-0002 is `awaiting_signature` and differs from the award. T-2026-0010 has an accepted handover leading to C-2026-0001.

```mermaid
sequenceDiagram
    autonumber
    actor O as Procurement officer
    actor CA as Contract approver
    actor BSG as Buyer signatory
    actor SSG as Supplier signatory
    actor CM as Contract manager
    participant SPA as SPA
    participant API as API middleware
    participant CS as contracts service
    participant APS as approvals service
    participant AW as awards service
    participant JOB as contract-dates job
    participant DB as Postgres
    O->>SPA: Create the contract from the final award on CON-02
    SPA->>API: POST /api/v1/buyer/... contract from award
    Note over API: auth, buyer tenant, contract.prepare
    API->>CS: create from award
    CS->>DB: lot_outcomes final_awarded, awarded_value, bid supplier
    CS->>DB: BEGIN
    CS->>DB: contracts draft, reference C-2026-nnnn from next_reference, legal_entity_id required
    CS->>DB: contract_lot_allocations, sum per lot outcome at most awarded_value
    CS->>DB: contract_signatories pending for buyer and supplier
    CS->>DB: audit_log, COMMIT
    O->>SPA: Adjust value or terms and submit for approval
    SPA->>API: POST /api/v1/buyer/... submit contract for approval
    API->>CS: submit
    CS->>DB: compare with the award, differs_from_award, difference_explanation
    CS->>APS: approval for subject contract, version, hash, amount, currency
    opt contract differs from the award
        CS->>APS: approval for subject contract_difference, DD-14
        CS->>DB: contracts difference_approval_id
    end
    CS->>DB: contracts under_review
    CA->>SPA: Approve on COM-05
    Note over APS: approval.decide, decision-specific permission and contract_approval authority, DD-24
    APS->>CS: outcome handlers for contract and contract_difference
    CS->>DB: contracts awaiting_signature once the required approvals are approved
    BSG->>SPA: Sign on CON-03
    SPA->>API: POST /api/v1/buyer/... sign contract
    Note over API: auth, buyer tenant, contract.sign
    API->>CS: sign
    CS->>DB: difference approved when differs_from_award, no hold blocking contract_sign
    CS->>DB: authority_limits for contract_signature
    CS->>DB: contract_signatories signed, signed_at, method in_app, authority_limit_id
    SSG->>SPA: Sign on SUP-23
    SPA->>API: POST /api/v1/supplier/... sign contract
    Note over API: auth, supplier tenant, supplier.contract.participate
    API->>CS: sign
    CS->>DB: supplier contract_signatories signed
    CS->>DB: all parties signed, so contracts signed_not_effective, signed_at, signed_document_id
    O->>SPA: Record the effective date and notice to proceed on CON-03 when preconditions are met
    SPA->>API: POST /api/v1/buyer/... authorize commencement
    API->>CS: commence
    CS->>DB: effective_date, notice_to_proceed_at
    JOB->>DB: daily 02:50 UTC, contracts signed_not_effective whose effective_date is reached
    JOB->>CS: transition signed_not_effective to active, DD-19
    O->>SPA: Submit the handover on CON-04
    SPA->>API: POST /api/v1/buyer/... submit handover
    API->>CS: submit handover
    CS->>DB: handovers submitted, contract_manager_user_id, submitted_at
    alt contract manager returns it
        CM->>SPA: Return with omissions
        SPA->>API: POST /api/v1/buyer/... return handover
        API->>CS: return
        CS->>DB: handovers returned, returned_at, omissions
    else contract manager accepts it
        CM->>SPA: Accept the handover
        SPA->>API: POST /api/v1/buyer/... accept handover
        API->>CS: accept
        CS->>DB: handovers accepted, accepted_at
    end
    O->>SPA: Close the event on BUY-30
    SPA->>API: POST /api/v1/buyer/... close event
    Note over API: auth, buyer tenant, event.closeout
    API->>AW: close event
    AW->>DB: every lot has an outcome, awarded lots have signed contracts, handovers accepted, no open complaint or hold
    alt a gate fails
        AW->>DB: event_closeouts blocked, blocking_reasons
        API-->>SPA: blocked, reasons listed such as handover not accepted, AC-29
    else all gates pass
        AW->>DB: event_closeouts closed, closed_by, closed_at
        API-->>SPA: 200 closed
    end
```

**Failure handling.**

| Condition | Result |
|---|---|
| Allocations exceed the awarded value of a lot outcome | Service check refuses (BR-33). |
| Contract differs from the award and the difference is not approved | Signature refused (AC-28). |
| Signatory lacks `contract_signature` authority for the value | Signature refused. The authority limit used is recorded on `contract_signatories.authority_limit_id` when it succeeds. |
| Complaint hold blocks `contract_sign` | Signature refused ([Flow 9](#11-flow-9-award-standstill-complaint-hold-and-final-award-ac-25)). |
| A signatory refuses | `contract_signatories.status = 'refused'`. The contract stays `awaiting_signature`. |
| Agreement signed outside the app | Recorded as `signed_outside_app` with `external_signature_evidence`, and signatories `recorded_external` with `method = 'external_recorded'`. No in-app signing evidence is manufactured (PRD §20). |
| External signature service reports a failure | The contracts domain writes an `integration_exceptions` row, an allowed cross-domain write (DD-17, AC-33). |
| Handover returned | `omissions` recorded. The event closeout gate stays blocked and the incomplete handover remains visible (AC-29). |
| Moving `signed_not_effective` to `active` | CON-03 records the effective date and notice to proceed. The `contract-dates` job (daily 02:50 UTC) performs the transition when the effective date is reached (DD-19; [08-background-jobs.md](08-background-jobs.md#4-job-catalog)). |
| Contract passes `term_end` | The `contract-dates` job moves it from `active` to `expired`. Open obligations remain (DD-19). |

---

## 13. Flow 11: Milestone evidence rejection (AC-30)

**Narrative.** A supplier submits evidence against a milestone (`obligations.kind = 'milestone'`). The file travels through the two-step upload ([Flow 12](#14-flow-12-document-upload-two-step-envelope)) into the `contract-documents` bucket. Its storage key is prefixed with the buyer tenant, which owns the contract record, and `documents.owner_tenant_id` records the supplier as the uploader (DD-12). The buyer's rejection records reasons, which are required, plus the remediation requirement, owner and due date in `acceptance_decisions`. It also creates a remediation task through the approvals service, which owns `tasks` (DD-16). A rejection never implies acceptance or payment readiness: `contract_invoices.acceptance_status` and `payment_status` are unchanged. Resubmission adds new `obligation_evidence` rows. Earlier evidence and decisions are kept. Demo: on C-2026-0001, the milestone "Q3 service report" evidence was rejected with remediation.

```mermaid
sequenceDiagram
    autonumber
    actor SP as Supplier contributor
    actor CM as Contract manager
    participant SPA as SPA
    participant API as API middleware
    participant CS as contracts service
    participant DB as Postgres
    SP->>SPA: Upload the Q3 service report on SUP-23
    Note over SPA,DB: two-step upload, Flow 12, bucket contract-documents
    SP->>SPA: Submit evidence for the milestone
    SPA->>API: POST /api/v1/supplier/... obligation evidence
    Note over API: auth, supplier tenant, supplier.contract.participate
    API->>CS: submit evidence
    CS->>DB: obligation belongs to this contract and supplier, document version confirmed
    CS->>DB: BEGIN
    CS->>DB: obligation_evidence submitted_by, document_version_id, note, submitted_at
    CS->>DB: obligations due to evidence_submitted
    CS->>DB: review task for owner_user_id through the approvals service, audit_log, COMMIT
    CS->>DB: pgmq.send notifications
    CM->>SPA: Start the review on CON-06
    SPA->>API: POST /api/v1/buyer/... start review
    Note over API: auth, buyer tenant, contract.manage
    API->>CS: start review
    CS->>DB: obligations under_review
    CM->>SPA: Reject with reasons and remediation
    SPA->>API: POST /api/v1/buyer/... acceptance decision rejected
    API->>CS: decide
    alt reasons missing
        API-->>SPA: 422 with errors, nothing written
    else valid decision
        CS->>DB: BEGIN
        CS->>DB: acceptance_decisions rejected, reasons, remediation_required, remediation_owner_user_id, remediation_due_at, decided_by, decided_at
        CS->>DB: obligations rejected
        CS->>DB: task for the remediation owner due at remediation_due_at through the approvals service, audit_log, COMMIT
        CS->>DB: pgmq.send notifications to the supplier contacts
        API-->>SPA: 200 rejected, remediation shown
    end
    Note over DB: contract_invoices acceptance_status and payment_status unchanged
    SP->>SPA: Resubmit corrected evidence
    SPA->>API: POST /api/v1/supplier/... obligation evidence
    API->>CS: submit evidence
    CS->>DB: new obligation_evidence row, earlier evidence and decision retained
```

**Failure handling.**

| Condition | Result |
|---|---|
| Decision without reasons | 422. `acceptance_decisions.reasons` is required. |
| Supplier submits evidence for another supplier's contract | `forSupplier` scoping finds no row. The response matches a missing record. |
| Evidence document not confirmed (upload still `pending`) | Result error. Only confirmed versions can be referenced. |
| Obligation passes its due date without evidence | The `obligation-status` job marks it `overdue` and creates escalation tasks ([08-background-jobs.md](08-background-jobs.md)). |
| Payment milestone rejected | `is_payment_milestone` does not change invoice or payment status. Payment readiness is never implied (AC-30). |
| Status transition out of `rejected` on resubmission | Governed by the obligation legality matrix ([05-lifecycles.md](05-lifecycles.md)), finalized in Stage B. |

---

## 14. Flow 12: Document upload two-step envelope

**Narrative.** Files never pass through the API function. The client asks the documents service for a signed upload URL tied to a `pending` `document_versions` row, uploads the bytes directly to Supabase Storage with a plain HTTP request to that URL, and then confirms. The browser never uses the supabase-js Storage client (brief §5.7, §10). The documents service authorizes the request before calling `StorageAdapter`, because the adapter performs no checks. Access is decided per related type by `domains/documents/access-registry.ts`, and unregistered types are denied. Object keys follow `<owning-record tenant_id>/<related_type>/<related_id>/<document_id>/<version_no>-<sanitized name>`. The buyer tenant owns procurement records even for supplier uploads, and `documents.owner_tenant_id` records who uploaded (DD-12). Buckets are private and created by migration: `tender-documents`, `bid-submissions`, `supplier-evidence`, `contract-documents`, `exports`. Never-confirmed uploads are removed by the `upload-reaper` job (brief §5.9).

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant SPA as SPA
    participant API as API middleware
    participant DOC as documents service
    participant REG as access registry
    participant SA as StorageAdapter
    participant ST as Supabase Storage
    participant DB as Postgres
    U->>SPA: Choose a file in the shared document widget
    SPA->>API: POST /api/v1/... create upload, related type and id, file name, content type, size
    Note over API: auth, tenant, permission of the owning screen
    API->>DOC: create upload
    DOC->>REG: access rule for the related type
    REG-->>DOC: allowed, or denied when unregistered
    DOC->>DB: BEGIN
    DOC->>DB: documents when new, with classification, related_type, related_id and owner_tenant_id of the uploader
    DOC->>DB: document_versions pending, version_no, bucket, sanitized file_name
    Note over DOC,DB: storage_key is owning tenant, related_type, related_id, document_id, then version_no and sanitized name, DD-12
    DOC->>DB: COMMIT
    DOC->>SA: create signed upload URL for bucket and key
    SA->>ST: signed upload URL through the service-role client
    ST-->>SA: URL
    DOC-->>API: version id and signed URL
    API-->>SPA: 200
    SPA->>ST: PUT the file bytes to the signed URL
    ST-->>SPA: 200
    SPA->>API: POST /api/v1/... confirm upload, version id
    API->>DOC: confirm
    DOC->>SA: stat bucket and key
    SA->>ST: object metadata
    ST-->>SA: size and content type
    alt object missing or not matching the pending row
        DOC-->>API: Result error
        API-->>SPA: 422, version stays pending
    else object matches
        DOC->>DB: BEGIN
        DOC->>DB: document_versions confirmed, confirmed_at, size_bytes, sha256
        DOC->>DB: documents current_version_id, audit_log
        DOC->>DB: COMMIT
        API-->>SPA: 200 confirmed version
    end
    Note over DOC,ST: upload-reaper at 03:50 UTC removes objects and rows still pending, see 08-background-jobs.md
```

**Download.** A download goes through the same access rule and returns a short-lived signed download URL from `StorageAdapter`. Supplier access to tender documents is logged in `document_access_log` (`tender_id`, `user_id`, `document_version_id`, `accessed_at`).

**Stage notes.** In Stage A the mock API returns contract-valid static responses and no file is stored. Real upload flows go into the shared document widgets in Stage B phase B1 (agent `ui-live-api`, architecture-plan §5). `FakeStorageAdapter` serves tests and local development, and composition throws if it is selected when `APP_ENV !== 'local'`.

**Failure handling.**

| Condition | Result |
|---|---|
| Related type not registered in `access-registry.ts`, or the rule denies | Refused before any row or URL is created. |
| Signed URL creation fails after the pending row committed | Error returned. The orphan pending row is removed by `upload-reaper`. |
| Upload interrupted or never confirmed | The row stays `pending`. `upload-reaper` removes the object and the row. |
| Confirm called but the object is missing or does not match | 422. The row stays `pending`, or moves to `rejected` for a mismatch. |
| Confirmed version referenced by a submission | Immutable. A later upload creates a new version (`supersedes_version_id`). Receipts inventory the exact version with `sha256` (FR-12, PRD §14.1). |
| `sha256` source | Recorded on confirm. Whether it is computed client-side or by reading the object server-side is finalized in Stage B. |

---

## 15. Open points

These details are not fixed by the sources and are finalized in Stage B unless noted. Points resolved by the design decision log (`docs/plan/design-decisions.md`) are marked and kept for traceability.

| # | Flow | Open point |
|---|---|---|
| 1 | All | Exact endpoint paths, ids, error codes and HTTP statuses per domain error. Fixed by the Stage A contracts and listed in [07-api.md](07-api.md). The decision log fixes only the `/me/*` aggregation (DD-21), the buyer slug in public URLs with tender ids in supplier API paths (DD-22), and the invitation-accept route (DD-27). |
| 2 | 2 | The algorithm that selects step approvers from `policy_thresholds.required_approval_level`, `authority_limits`, committees and `route_mode`. DD-24 fixes only the cross-currency case: with no exchange rate, the step routes to the next level up. |
| 3 | 3 | The rule set that classifies an edit as material, and the lifecycle target state when a `ready` tender's approval is invalidated. |
| 4 | 4 | How external notice confirmation or failure is captured, and recipient resolution of `tender_issued` for open tenders (`notice_subscriptions`, `saved_searches`). |
| 5 | 5 | How a `failed_error` attempt is persisted after its transaction rolls back. Whether a late attempt also creates a `submission_receipts` row with status `late_rejected`. Serialization of concurrent submissions of the same bid beyond the partial unique index. |
| 6 | 7 | Resolved — DD-23 (with DD-16): the price gate is released with `evaluation.chair`, and `price_gate_releases` is owned by the evaluation domain. |
| 7 | 8 | Whether `bids.evaluation_status = 'evaluated'` is set at result computation or at report sign-off. Drawn at sign-off, following the `in_evaluation → evaluated` row of [05-lifecycles.md](05-lifecycles.md) ("computed and signed off", open point 14). |
| 8 | 9 | Resolved — DD-19: `standstill-monitor` deduplicates its task with a `<job>:<entity>:<window>` key in `job_idempotency_key`, so a re-run creates no second task. Still open: standstill start when `period_start_basis` is `receipt` or `acknowledgment`. |
| 9 | 10 | Resolved — DD-19: the `contract-dates` job (daily 02:50 UTC) moves `signed_not_effective` to `active` when the effective date is reached; CON-03 records the effective date and notice to proceed. |
| 10 | 12 | How `sha256` is computed on confirm. The age threshold after which `upload-reaper` treats a pending upload as abandoned. |
| 11 | 4 | DD-44 fixes the `email` channel: `nodemailer` over SMTP, Mailpit locally, `delivered` when Mailpit accepts the message, and no email rows when email is disabled. Still open: where the SMTP send sits relative to the per-message transaction (no network calls inside a transaction, brief §5.6), how a failed send is retried, and whether a failed email raises a `delivery_exception` task when in-app delivery succeeded. Deferred (DD-44): the hosted provider and its delivery-event webhooks. |
| 12 | 1 | Resolved — DD-43: real Supabase Auth in local Docker from Stage A. The mock sign-in is removed. Original design, kept for traceability: "`VITE_AUTH_MODE` (`mock` or `supabase`) selects a `mock` `AuthAdapter` that signs in demo personas against `/api/v1/__mock/auth/*`, with a persona switcher; the `supabase` adapter is written in Stage A and first used in Stage B" (the withdrawn DD-38). |
