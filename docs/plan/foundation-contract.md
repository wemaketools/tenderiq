# TenderIQ — Foundation contract (Stage A)

Status: **verified** on 2026-09-30 by the `foundation-integrate` step. Every signature below was read from the code,
and every example was compiled or run against the foundation (`npm run typecheck`, `typecheck:ui`, `lint`,
`lint:ui`, `test:unit` 709 tests, `test:ui` 182 tests, `build`, `ci:security`, `test:e2e:prototype` 5/5, and a
runtime smoke of the mock API on port 4190 with real Supabase Auth).

**Amended 2026-10-30 (DD-50):** Stage A is a fully static prototype. The mock API runs in the browser (no server, no
port), sign-in is a persona picker, and no Docker or Supabase is used. §2, §2.1, §2.5, §4, §5 and §6 describe the
current APIs; the verification note above records the original foundation run.

Domain agents MUST use these APIs as written. When one does not fit, report a follow-up; do not fork a helper.

Contents: [1 Contracts](#1-contracts-srccontracts) · [2 Mock API](#2-mock-api-srcmock-api) ·
[3 SPA](#3-spa-srcuisrc) · [4 URL map](#4-url-map) · [5 Personas, tenants and ports](#5-personas-tenants-and-ports) ·
[6 Running, screenshots and gates](#6-running-screenshots-and-gates)

---

## 1. Contracts (`src/contracts`)

Pure TypeScript + zod v4, shared by the SPA (alias `@contracts/<module>`), the mock API and Stage B. Lint forbids
any import other than `zod` and relative contract files, and forbids Node/browser globals (tests are exempt).
Relative imports carry `.js` extensions. The SPA compiles contracts without `exactOptionalPropertyTypes` and the
server with it: write optional fields as `.optional()` and never assign `undefined` explicitly to them.

A domain owns `src/contracts/<contract>.ts` (plus `src/contracts/<contract>/**`) and exports **one** map named
`<name>Endpoints`. Contract tests go in `src/contracts/<contract>/<contract>.test.ts` (root `unit` project; tests may
use `node:fs`).

### 1.1 `defineEndpoint` — `src/contracts/endpoint.ts`

```ts
defineEndpoint<const Path extends string, Params, Query, Body, Response>(definition: {
  id: string;                 // unique: '<audience>.<domain>.<action>', e.g. 'buyer.tenders.list', 'me.tasks.complete'
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: Path;                 // '/api/v1/<audience>/…' with ':name' params (audience prefix must match `audience`)
  audience: 'public' | 'me' | 'buyer' | 'supplier' | 'ops';
  permission?: PermissionCode | readonly [PermissionCode, ...PermissionCode[]]; // any-of list; required for buyer/supplier/ops
  params?: ZodType;           // required exactly when the path has :params, same keys (use IdParam for ids)
  query?: ZodType;
  body?: ZodType;
  response: ZodType;          // 204 → z.null()
  status?: 200 | 201 | 202 | 204; // default 200; 201 for an idempotent POST
  errors: readonly string[];  // UPPER_SNAKE business codes the endpoint may return (platform codes are implicit)
  screens: readonly [string, ...string[]]; // PRD screen ids, e.g. ['BUY-07']
  idempotent?: boolean;       // record-creating command; accepts Idempotency-Key (DD-39)
  rowTenant?: boolean;        // 'me' action on a listed row: X-Tenant-Id = the row's tenant (DD-21)
  summary?: string;
}): Endpoint<Path, Params, Query, Body, Response>
```

`defineEndpoint` validates the definition at module load and throws on a malformed contract (bad id, audience/prefix
mismatch, params keys ≠ path params, a permission of the wrong tenant kind, lower-case error codes, a missing
permission on a tenant audience, `support.view` on a command…).

Types and helpers from the same module: `AnyEndpoint`, `EndpointRequest<E>` (`{ params, query, body }` each required
exactly when declared), `EndpointResponse<E>`, `EndpointParsedQuery<E>`/`EndpointParsedBody<E>`/`EndpointParsedParams<E>`
(what handlers receive), `buildPath`, `buildQuery`, `buildUrl(endpoint, params, query)`, `matchPath`,
`endpointPermissions(endpoint)`, `isPermitted(endpoint, granted)`, `tenantHeaderMode(endpoint)` →
`'none' | 'active' | 'row'`, `API_BASE`, `HEALTH_PATH`.

Rules that keep the catalog routable (checked catalog-wide by `src/contracts/catalog.test.ts`, which discovers every
`*Endpoints` export in `src/contracts/*.ts`, even before Integration lists it):
- ids and `METHOD path` pairs are unique across ALL modules;
- no two routes of the same method may match the same URL, i.e. never put a static segment where another route has
  a `:param` (`/me/tasks/summary` vs `/me/tasks/:taskId` collides — hence `/me/task-summary`).

Verified example (compiled and run in `.qa-scratch/foundation-integrate/example-check.ts`):

```ts
// src/contracts/widgets.ts
import { z } from 'zod';

import { Id, Money, OfficialDeadline, issue, listQueryWithSort, pageOf, queryList } from './common.js';
import { defineEndpoint } from './endpoint.js';
import { TENDERS_STATUS } from './enums.js';

export const WidgetRow = z.object({
  id: Id,
  reference: z.string(),
  title: z.string(),
  status: z.enum(TENDERS_STATUS),
  estimatedValue: Money.nullable(),
  deadline: OfficialDeadline.nullable(),
});
export type WidgetRow = z.infer<typeof WidgetRow>;

export const WidgetListQuery = listQueryWithSort(['reference', 'deadline'] as const).extend({
  status: queryList(z.enum(TENDERS_STATUS)).optional(), // ?status=open&status=closed → ['open','closed']
});

export const CreateWidgetBody = z.object({
  title: z.string().trim().min(3, issue('TITLE_TOO_SHORT', 'At least 3 characters.')),
});

export const widgetEndpoints = {
  list: defineEndpoint({
    id: 'buyer.widgets.list', method: 'GET', path: '/api/v1/buyer/widgets', audience: 'buyer',
    permission: 'tender.view', query: WidgetListQuery, response: pageOf(WidgetRow), errors: [], screens: ['BUY-07'],
  }),
  create: defineEndpoint({
    id: 'buyer.widgets.create', method: 'POST', path: '/api/v1/buyer/widgets', audience: 'buyer',
    permission: 'tender.create', body: CreateWidgetBody, response: WidgetRow, errors: ['DUPLICATE_TITLE'],
    screens: ['BUY-08'], idempotent: true, // → status 201
  }),
};
```

### 1.2 `common.ts` — shared schemas

`import { … } from './common.js'` (contracts, mock API) · `from '@contracts/common'` (SPA).

| Export | Use |
|---|---|
| `issue(CODE, message)` / `splitIssueMessage(raw)` | every zod message is `"CODE|message"` (422 `errors[{field, code, message}]`) |
| `Id`, `IdParam` | numeric ids in bodies/responses; `IdParam` coerces a path/query string to a positive integer |
| `Reference`, `Slug`, `LinkPath` | `T-2026-0003`-style refs, tenant slugs, in-app links (`/buyer/tenders/3`) |
| `DecimalString`, `NonNegativeDecimalString`, `CurrencyCode`, `Money`, `NonNegativeMoney`, `Score` | money = `{ amount: '1500000.00', currency: 'BWP' }`; scores are decimal strings |
| `Instant`, `CalendarDate`, `TimeZone`, `OfficialDeadline` | ISO UTC instants (`2026-10-14T10:00:00Z`), `YYYY-MM-DD`, IANA zone, `{ at, timeZone }` |
| `ListQuery`, `listQueryWithSort(fields)`, `queryList(item)`, `QueryBoolean`, `SortDirection` | list filters: `q`, `page` (1-based), `pageSize` (1..100, default 25), `sort`, `dir` |
| `pageOf(item)`, `Page<T>`, `paginate(rows, page, pageSize)`, `PageMeta`, `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE` | page response `{ items, total, page, pageSize }` |
| `OrganizationLabel`, `PersonRef`, `ActorRef` | `/me` rows name their organization; people are `{ userId, fullName }` (+`capacity`) |
| `ReasonText`, `JsonObject` | required reason text (1..4000); JSON snapshots |
| `Problem`, `FieldError`, `PLATFORM_ERRORS`, `PROBLEM_CONTENT_TYPE`, `ERROR_CODE_PATTERN` | problem+json shape and the implicit platform codes (UNAUTHENTICATED 401, FORBIDDEN 403, TENANT_ACCESS_DENIED 403, NOT_FOUND 404, VALIDATION_FAILED 422, RATE_LIMITED 429, INTERNAL_ERROR 500) |
| `Audience`, `AUDIENCES`, `AUDIENCE_TENANT_KIND`, `TenantKind`, `toTenantId`, `toUserId` | audience ↔ tenant kind (`ops` → `operator`) |

### 1.3 `enums.ts` — every enumeration, once

Each blueprint CHECK list is exported as `TABLE_COLUMN` (tuple), `TableColumn` (zod enum) and `type TableColumn`,
e.g. `TENDERS_STATUS` / `TendersStatus`. Write variants never offer `framework_calloff` (DD-40):
`TENDERS_PROCEDURE_WRITE`, `PROCUREMENT_STRATEGIES_PROCEDURE_WRITE`, `POLICY_PROFILE_VERSIONS_PERMITTED_PROCEDURES_WRITE`.
Never redeclare an enum in a domain contract; import it.

Helpers keyed by the enum name `'<table>.<column>'` (`EnumName`):
`enumValues(name)`, `isEnumValue(name, v)`, `enumLabel(name, v)` → a display label,
`enumOptions(name)` → `[{ value, label }]` for selects, `enumTone(name, v)` → one of `CHIP_TONES`
(`neutral | info | success | warning | danger | accent | muted`), `isMandatoryNotificationEvent(eventType)`.

```ts
import { enumLabel, enumTone } from './enums.js';
enumLabel('tenders.status', 'award_pending'); // 'Award decision pending'
enumTone('tenders.status', 'award_pending');  // 'warning' (StatusChip uses exactly this)
```

### 1.4 `permissions.ts`

`PermissionCode` (type), `PERMISSION_CATALOG` (`{ code: { tenantKind, category, description } }`), `PERMISSION_CODES`,
`PermissionCodeSchema`, `isPermissionCode`, `permissionTenantKind(code)`, `ROLE_TEMPLATE_CODES`, `RoleTemplateCode`,
`ROLE_TEMPLATES`, `templatePermissions(code)`, `permissionsForTemplates(codes)`, `SUPPORT_GRANT_PERMISSIONS`
(`['support.view']`), `GRANT_ONLY_PERMISSIONS`, `roleTemplatePermissionRows()`.

```ts
import { permissionsForTemplates } from './permissions.js';
permissionsForTemplates(['procurement_officer']).includes('tender.edit'); // true
```

Use the most specific existing code. A new code means editing `permissions.ts` and the blueprint together (report it).

### 1.5 `decimal.ts` — money and score arithmetic (never JS floats)

`add`, `sub`, `mul`, `div(a, b, scale)`, `round(v, places)` (HALF_UP), `sum(values)`, `compare`, `eq`, `lt`, `lte`,
`gt`, `gte`, `isZero`, `isNegative`, `abs`, `neg`, `min`, `max`, `normalize`, `scaleOf`, `isDecimal`,
`fromInteger`, `format(v, { places })`, `formatMoney(amount, currency)`, `formatMoneyCompact(amount, currency)`
→ `'BWP 5.3M'`. Throws `DecimalError` on a malformed input.

```ts
import { mul, round, sum } from './decimal.js';
round(sum([mul('3', '12500.50'), '999.99']), 2); // '38501.49'
```

### 1.6 `catalog.ts` and the shared-surface endpoints

`src/contracts/catalog.ts` (owned by Integration) exports `ENDPOINT_MAPS`, `ENDPOINT_CATALOG`, `endpointById(id)`
and `pathsCollide(a, b)`. Domains do not edit it; Integration adds each domain map (A3). OpenAPI
(`npm run docs:api`) discovers every `*Endpoints` export itself.

Shared-surface endpoints already defined (contracts-core). The mock handlers of `tasks`, `notifications`,
`approvals`, `documents`, `audit` and `calendars` belong to the **workspace** domain (00); only `session` is served
today, so the top-bar badges and the shared widgets show their error/empty states until workspace lands.

| Module | Endpoints (id → method path) |
|---|---|
| `session.ts` | `me.session.context` GET `/api/v1/me/context[?tenantId=]` · `me.session.updateTheme` PUT `/api/v1/me/theme` |
| `tasks.ts` | `me.tasks.list` GET `/me/tasks` · `me.tasks.summary` GET `/me/task-summary` · `me.tasks.get` GET `/me/tasks/:taskId` · `me.tasks.complete`/`return`/`reassign` POST `/me/tasks/:taskId/{complete,return,reassign}` (row tenant) · `me.tasks.reassignCandidates` GET `/me/tasks/:taskId/reassign-candidates` |
| `notifications.ts` | `me.notifications.list` GET `/me/notifications` · `me.notifications.summary` GET `/me/notification-summary` · `markRead`/`acknowledge` POST `/me/notifications/:notificationId/{read,acknowledge}` (row tenant) · `preferences` GET / `updatePreferences` PUT `/me/notification-preferences` |
| `approvals.ts` | `me.approvals.list` GET `/me/approvals` · `me.approvals.get` GET `/me/approvals/:approvalId` · `me.approvals.decide` POST `/me/approvals/:approvalId/decide` (row tenant, `approval.decide`) · `buyer.approvals.forSubject` GET `/buyer/approvals/subjects/:subjectType/:subjectId` · `buyer.approvals.get` GET `/buyer/approvals/:approvalId` · `buyer.approvals.request` POST `/buyer/approvals` (idempotent) · `buyer.approvals.withdraw` POST `/buyer/approvals/:approvalId/withdraw` · `buyer.approvals.authorityCheck` GET `/buyer/approval-authority-check`. Permission maps: `APPROVAL_DECISION_PERMISSIONS`, `APPROVAL_REQUEST_PERMISSIONS`, `APPROVAL_AUTHORITY_DECISION_TYPES` |
| `documents.ts` | `me.documents.get`/`versions`/`download` GET `/me/documents/:documentId[/versions[/:versionId/download]]` · `buyer.documents.list` / `supplier.documents.list` GET `/{buyer,supplier}/documents` · `*.createUpload` POST `/{buyer,supplier}/documents/uploads` (idempotent) · `*.confirmUpload` POST `/{buyer,supplier}/documents/uploads/:versionId/confirm` · `buyer.documents.createRedactedCopy` POST `/buyer/documents/:documentId/redacted-copies` |
| `audit.ts` | `buyer.audit.entityHistory` GET `/buyer/audit/entities/:entityType/:entityId` (`audit.view`) |
| `calendars.ts` | `buyer.calendars.list/get/create/update/addHoliday/removeHoliday/impactReview/approve/retire/setDefault` under `/buyer/calendars` |

(Paths abbreviated: all start with `/api/v1`.)

---

## 2. Mock API (`src/mock-api`)

Hono app with the brief §5.1 order: security headers → correlation id → request log → problem+json boundary →
route resolution (unknown route = 404 **before** auth) → persona token check + persona mapping (401) →
tenant context (one identical 403 `TENANT_ACCESS_DENIED`) → permission (403 `FORBIDDEN`) → your handler → response
validated against the contract. **Nothing persists.** Handlers are pure functions over static fixtures.

In Stage A the app runs **in the browser** (DD-50): `src/mock-api/browser.ts` (`createBrowserMockApi`) builds it,
and the SPA's `src/ui/src/api/prototypeTransport.ts` lazy-loads it and answers every `/api/v1` request in the page.
The bearer token is the chosen persona's e-mail; `src/mock-api/prototype-auth.ts` (`personaTokenVerifier`) accepts
it and the chain maps it to the fixture persona. An unknown or deactivated persona (`former.officer`, AC-04) gets the
same 401. There is no JWT in Stage A. Mock-API runtime code must stay browser-safe (lint rule
`tenderiq/mock-api-browser-safe`: no `node:*`, no `src/server`, no Node globals; tests, `testing/**`,
`registry-discovery.ts` and `fixtures/approvals/spa-routes.ts` are exempt). Hash with `src/mock-api/sha256.ts`, not
`node:crypto`.

### 2.1 Handler module shape (static list)

`src/mock-api/handler-modules.ts` (`HANDLER_MODULES`) imports every handler module (`handlers/*.ts` and
`handlers/<name>/index.ts`) and names its `register(app)`, in alphabetical order. The browser cannot read the
directory, so the list is static: **add your module there**. `handler-modules.test.ts` fails when the list and the
modules on disk differ (on-disk discovery lives in `registry-discovery.ts`, for tests only). A module that throws
while registering, or claims a route/id another module owns, is logged and skipped (the app still builds; the boot
log reports skipped modules — treat any skip as a bug).

Recommended layout for domain `<contract>` (all inside your owned paths):

```
src/mock-api/fixtures/<contract>.ts            # static rows (or fixtures/<contract>/*.ts)
src/mock-api/handlers/<contract>/index.ts      # export function register(app: MockApp): void
src/mock-api/handlers/<contract>/<contract>.test.ts
```

### 2.2 `mockRoute` and the handler context

```ts
import { mockRoute } from '../../app.js';            // from handlers/<contract>/index.ts
import type { MockApp, MockHandlerContext } from '../../app.js';

mockRoute<E extends AnyEndpoint>(app: MockApp, endpoint: E, handler: (ctx: MockHandlerContext<E>) =>
  z.input<E['response']> | Promise<z.input<E['response']>>): void
```

| Context field | Meaning |
|---|---|
| `params`, `query`, `body` | already parsed by the contract (defaults applied, `queryList` → arrays). Invalid input never reaches you: 422 with `errors[]` |
| `persona` / `requirePersona()` | the signed-in fixture persona (`userId`, `email`, `fullName`, `status`, `isPlatformOperator`, `memberships`); `null` only on public endpoints |
| `tenant` / `requireTenant()` | `TenantAccess { tenant: FixtureTenant, access: 'membership' \| 'support_grant', membership, supportGrant, capacity, permissions }` for buyer/supplier/ops and row-tenant `me` endpoints; already checked against membership, kind and permission |
| `fixtures.page(rows)` | slices already-filtered/sorted rows by the request's `page`/`pageSize` → `{ items, total, page, pageSize }` |
| `fixtures.persona(userId)`, `personRef(userId)`, `organizationLabel(tenantId)`, `tenant(id)`, `tenantBySlug(slug)`, `activeMemberships()` | platform fixture lookups; `activeMemberships()` is the `/me` scope (DD-21) |
| `fail(status, CODE, detail?)` | throws a problem+json. `CODE` must be in the endpoint's `errors` (or a platform code), otherwise the response becomes a 500 and the log says `handler used an undeclared error code` |
| `notFound(detail?)` | 404 `NOT_FOUND` (use it for another tenant's record, too: never reveal it exists) |
| `now` | request time (`Date`); `correlationId`, `idempotencyKey` (header value or `null`), `appEnv`, `logger`, `endpoint` |

A response that does not match the contract is logged as drift and answered with a sanitized 500: fix the handler,
never loosen the contract.

### 2.3 Fixture conventions

- Static data lives only in `src/mock-api/fixtures/**`, uses the storyline's natural keys and the platform ids:
  `import { TENANT_IDS, PERSONAS, TENANT_ROLES, SUPPORT_GRANTS, TENANTS } from '../fixtures/platform.js'`
  (`TENANT_IDS.kwu === 2`, see §5). Store rows with their `tenantId` (and owner ids), strip internal fields in the
  handler.
- **Per-tenant filtering is the handler's job**: filter by `requireTenant().tenant.id` for buyer/supplier/ops lists
  and by `fixtures.activeMemberships()` tenant ids for `/me` lists; `total` counts only visible rows (BR-43). A
  supplier sees only its own rows; a buyer never sees drafts/sealed content before opening; public sees only public
  records (PRD §4.3).
- Persona helpers (`src/mock-api/persona.ts`): `findPersonaByEmail`, `personaByEmail`, `findPersonaById`,
  `allPersonas`, `findTenantById`, `findTenantBySlug`, `tenantBySlug`, `allTenants`, `findTenantRole`,
  `activeMemberships(persona)`, `membershipPermissions(membership)`, `resolveTenantAccess(persona, tenantId, now,
  kind)`, `personRef(userId)`, `organizationLabel(tenantId)`.
- **Commands are static**: validate, check the business state the fixture implies (return the declared error, e.g. a
  blocking readiness error), then return a contract-valid response describing the outcome (new ids ≥ 900, status
  after the action). The next GET still returns the fixture; the SPA shows the command result it received.
- The one storyline "now" is `DEMO_AS_OF = 2026-10-06T08:00:00Z` (`src/mock-api/fixtures/demo-clock.ts`). Every
  fixture is written as of that instant: what has happened is before it, what is pending or scheduled is after it.
  The mock API serves each request at `frozenStorylineNow()` (always `DEMO_AS_OF`), exposes it as
  `ctx.now`, as `serverTime` of `/api/v1/me/context` and as the `x-server-time` response header; handlers and tests
  compare against that clock, never against `Date.now()`.
- Buyer categories come only from `src/mock-api/fixtures/categories.ts`; other domains reference them by id.
- Money is `{ amount: '1500000.00', currency: 'BWP' }`; deadlines `{ at, timeZone: 'Africa/Gaborone' }`.

### 2.4 Verified handler example

```ts
// src/mock-api/handlers/widgets/index.ts
import { widgetEndpoints } from '../../../contracts/widgets.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { WIDGETS } from '../../fixtures/widgets.js'; // rows carry tenantId

export function register(app: MockApp): void {
  mockRoute(app, widgetEndpoints.list, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = WIDGETS.filter((row) => row.tenantId === tenant.id)
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .map(({ tenantId: _tenantId, ...row }) => row);
    return fixtures.page(rows);
  });

  mockRoute(app, widgetEndpoints.create, ({ requireTenant, body, fail }) => {
    const { tenant } = requireTenant();
    if (WIDGETS.some((row) => row.tenantId === tenant.id && row.title === body.title)) {
      fail(409, 'DUPLICATE_TITLE', 'A widget with this title already exists.');
    }
    return { id: 900, reference: 'T-2026-0900', title: body.title, status: 'draft', estimatedValue: null, deadline: null };
  });
}
```

Observed results: list as tebogo in `kwu` → 200 with only KWU rows; duplicate → 409 `DUPLICATE_TITLE`; new → 201;
title `'x'` → 422 `[{ field: 'title', code: 'TITLE_TOO_SHORT' }]`; `X-Tenant-Id` of `odc` → 403
`TENANT_ACCESS_DENIED`; `pule.auditor` (no `tender.create`) → 403 `FORBIDDEN`. The real session handler
(`src/mock-api/handlers/session.ts`) is the reference for a `me` endpoint.

### 2.5 Handler tests

```ts
import { beforeAll, describe, expect, it } from 'vitest';

import { widgetEndpoints } from '../../../contracts/widgets.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp } from '../../testing/index.js';

let api: TestMockApp;
beforeAll(async () => {
  api = await createTestMockApp(); // every module of HANDLER_MODULES; prototype persona auth, no Docker
});

describe('buyer.widgets.list', () => {
  it('returns only the active tenant’s widgets for a buyer officer', async () => {
    const response = await api.callAs('tebogo.officer@tenderiq.local', widgetEndpoints.list, {
      tenant: 'kwu', query: { status: ['open'] },
    });
    expect(response.status).toBe(200);
    expect(widgetEndpoints.list.response.parse(response.body).items.every((row) => row.id !== 2)).toBe(true);
  });
});
```

`src/mock-api/testing/index.js` exports `createTestMockApp(options?)` (`{ modules?: [{ name, register }],
handlersDir?, verifyToken?, now?, appEnv?, logLevel? }`) and `tenantIdOf(slug)`. The app offers `callAs(email,
endpoint, { params, query, body, tenant, headers })`, `requestAs(email, method, path, options)` (both send the
persona token the SPA sends, `personaToken(email)` from `prototype-auth.ts`), `request(method, path, { token, tenant,
query, body, headers })` → `{ status, headers, body, text }`, plus `logs` (captured JSON log lines), `loaded`,
`failed`, `endpointIds`. Everything runs offline (DD-50). Assert `api.failed` is empty and `api.loaded` contains your
module. Cover: per-tenant isolation, supplier isolation, permission denial, every declared error code, 422s.

---

## 3. SPA (`src/ui/src`)

Import paths are relative to a feature page at `src/ui/src/features/<feature>/pages/X.tsx`. Contracts are imported
as `@contracts/<module>`. Everything below is owned by `ui-shell`; features never edit it.

### 3.1 Feature registration — `FeatureModule` / `NavItem` (`app/featureRegistry`)

Each feature directory has `routes.tsx` exporting `features: FeatureModule[]`; the registry collects them with
`import.meta.glob('../features/*/routes.tsx', { eager: true })`.

```tsx
// src/ui/src/features/tenders/routes.tsx
import type { FeatureModule } from '../../app/featureRegistry';

export const features: FeatureModule[] = [
  {
    id: 'tenders',
    area: 'buyer', // 'buyer' → /buyer/*, 'supplier' → /supplier/*, 'ops' → /ops/*, 'common' → /me/*, 'public' → /*
    routes: [
      { path: 'tenders', load: () => import('./pages/TenderListPage'), permission: 'tender.view' },
      { path: 'tenders/:tenderId', load: () => import('./pages/TenderPage'), permission: 'tender.view' },
    ],
    nav: [
      {
        id: 'buyer.tenders',
        label: 'tenders.nav.tenders', // an i18n key
        path: 'tenders', // relative to the area root
        section: 'sourcing', // home, work, planning, sourcing, evaluation, award, contracts, suppliers, insights, platform, admin
        order: 10,
        icon: 'fileText', // IconName (ICON_NAMES in components/ui)
        permission: 'tender.view', // one code, or a non-empty list meaning "any of these"
        // badge: 'tasks' | 'notifications' | 'tasksOverdue' | { navBadgeId: 'buyer.clarifications' }
        // tenantKinds: ['buyer'] (only for area 'common' items)
        // end: true (exact-match active state)
      },
    ],
  },
];
```

Rules:
- `FeatureRoute { path, load | element (exactly one), permission?, title? }`. A page module's **default export** is
  the page component.
- `path: ''` claims the area root (`/buyer`). Without one, the area root opens the first nav destination.
- A route `permission` makes RouteGuard show the Forbidden page when the active membership lacks it. The API still
  enforces every permission.
- The sidebar shows items of the area matching the active tenant's kind plus `common` items, filtered by
  permission, grouped by section, with a separator before `admin`.
- Feature-reported nav counts: `dispatch(navBadgeSet({ id: 'buyer.clarifications', count }))` from
  `app/slices/badges` (tenant-scoped; cleared on a tenant switch).
- Public feature routes (area `public`) render inside `PublicShell` (e.g. `/opportunities`, `/register`,
  `/invite/:token`).

### 3.2 Strings: `t()` and per-feature catalogs (DD-37)

```ts
// src/ui/src/features/tenders/i18n/en.ts
export default {
  nav: { tenders: 'Tenders' },
  list: { title: 'Tenders', count_one: '{count} tender', count_other: '{count} tenders' },
};
```

```tsx
import { t, tEnum } from '../../../lib/i18n';
t('tenders.list.title');                  // key = <feature directory>.<key in the catalog>
t('tenders.list.count', { count: 3 });    // plurals: _one / _other with the `count` parameter
tEnum('tenders.status', row.status);      // catalog key enum.<table.column>.<value>, else the contract label
```

- Reserved namespaces (shell catalog `src/ui/src/i18n/en.ts`): `shell`, `common`, `auth`, `ui`, `format`, `enum`,
  `charts`, `approvalWidget`, `documentWidget`, `audit`, `pages`. A feature directory must not use these names
  (every planned directory, including the workspace's `approvals` and `documents`, is free; a test guards it).
- A missing key renders the key itself and warns in development.

### 3.3 Calling the API — `call()` and the domain client pattern

```ts
import { call, isApiError, fieldErrorsFor } from '../../../api/client';
import { useApiMutation, useApiQuery, invalidateApiQueries } from '../../../api/hooks';

call<E extends AnyEndpoint>(endpoint: E, request: EndpointRequest<E>, options?: {
  tenantId?: number; idempotencyKey?: string; signal?: AbortSignal;
}): Promise<EndpointResponse<E>>          // null for 204; throws ApiError
useApiQuery<E>(endpoint: E, request: EndpointRequest<E> | null, options?: { tenantId?: number }): QueryResult
useApiMutation<E>(endpoint: E): { mutate(request, options?), pending, error, data, reset }
invalidateApiQueries(match?: string | ((endpointId: string) => boolean)): void
```

- `call` builds the URL from the contract, reads the bearer token per request, sends `X-Tenant-Id` according to the
  contract (active tenant for buyer/supplier/ops, **`options.tenantId` for `me` row actions**, none for `me` reads and
  public), adds an `Idempotency-Key` on idempotent commands, signs out on 401, and validates the response with the
  contract schema in development builds (drift throws `ApiError` kind `contract`).
- `ApiError`: `kind` (`unauthenticated`, `forbidden`, `not_found`, `validation`, `conflict`, `rate_limited`,
  `server`, `network`, `contract`, `tenant_required`), `status`, `title`, `code`, `detail`,
  `fieldErrors[{ field, code, message }]`, `correlationId`.
- **The hooks take the contract endpoint object**, not a wrapper function. Domain client modules
  (`src/ui/src/api/<contract>.ts`, owned by the domain) hold the imperative wrappers for code outside hooks. The
  reference is `src/ui/src/api/session.ts`:

```ts
// src/ui/src/api/session.ts (real)
import { getSessionContext, updateTheme } from '@contracts/session';
import type { SessionContext } from '@contracts/session';
import { call } from './client';

export function fetchSessionContext(tenantId?: number): Promise<SessionContext> {
  return call(getSessionContext, { query: tenantId === undefined ? {} : { tenantId } });
}
```

```tsx
// in a page (pattern used by ApprovalStatusPanel)
const query = useApiQuery(getSubjectApprovals, { params: { subjectType, subjectId } }); // null request = skip
// query.status 'loading' | 'success' | 'error'; query.data; query.error; query.isFetching; query.reload()
const withdraw = useApiMutation(withdrawApproval);
await withdraw.mutate({ params: { approvalId }, body: { reason } });
invalidateApiQueries('buyer.approvals.'); // re-run mounted queries by endpoint id or id prefix ending in '.'
```

Query results are keyed by the tenant epoch: switching organization never shows the previous tenant's data.

### 3.4 Session, permissions, filters

```ts
import { useActiveTenant, useMemberships, useIsPrototype, useScreenFilters, useAppSelector } from '../../../app/hooks';
import { usePermission, usePermissions } from '../../../auth/permissions';
const tenant = useActiveTenant(); // ActiveTenantContext | null: tenantId, kind, name, slug, officialTimeZone, defaultCurrency, capacity, access, permissions
const canEdit = usePermission('tender.edit'); // or ['tender.edit', 'tender.view'] = any of
const [filters, setFilters, clearFilters] = useScreenFilters('BUY-07', { status: null, q: '' }); // tenant-scoped
```

### 3.5 Shared components and their props

Barrels: `../../../components/ui`, `…/charts`, `…/approvals`, `…/documents`, `…/audit`.
Example: `import { Button, Card, DataTable, PageHeader, StatusChip } from '../../../components/ui';`

| Component | Props |
|---|---|
| `PageHeader` | `title` (string; top bar + document title), `primaryAction` (ONE accent action, rendered in the top bar), `actions` (secondary), `subtitle`, `meta` (reference, status chip, `OfficialDeadline`, next action), `back {to,label}` |
| `Button`, `IconButton`, `ButtonLink` | `variant` (default `secondary`; `primary` for the one accent action), `size 'md'|'sm'`, `icon`, `iconAfter`, `loading`, `block`; `IconButton{icon, label, count}`; `ButtonLink{to}` |
| `FilterBar`, `QuickRanges`, `SearchField` | `FilterBar{onClear, canClear, quickRanges}` wraps the form fields |
| `KpiGrid`, `KpiCard` | `label, value, icon, tone?, delta{direction,text,positive?}, hint, to, restricted` |
| `Card`, `CardLink` | `title, subtitle, actions, footer, flush` (flush for edge-to-edge tables) |
| `DataTable<T>` | `columns[{id, header, cell, sortable?, sortKey?, numeric?}]`, `rows`, `rowKey`, `caption`, `sort`, `onSortChange`, `selection{selected,onChange,actions}`, `onRowClick`, `rowLabel`, `loading`, `error`, `onRetry`, `restricted`, `empty`, `pagination` |
| `Pagination` | `page, pageSize, total, onPageChange, onPageSizeChange?` |
| `StatusChip` | `enum="tenders.status" value={…}` (+`size`); tone and label for every enum value. `Chip{tone}`, `OverdueChip` |
| `Reference`, `MoneyText`, `OrDash` | `Reference{value,to}` mono accent link; `MoneyText{value: {amount,currency}, compact?}` |
| `OfficialDeadline` | `deadline={at, timeZone}`, `variant 'inline'|'block'`, `label`, `showLocal` (default true), `showRemaining` (never alone) |
| `DetailList` | `items[{label, value}]`, `stacked`; empty values render "—" |
| `Tabs`, `LinkTabs`, `VerticalTabs` | keyboard tablist / route tabs / settings sub-navigation |
| `Stepper`, `Timeline` | `steps[{id,label,description?,state}]`; `items[{id,title,meta,detail,tone,icon}]` |
| `Banner` | `tone 'info'|'success'|'warning'|'error'`, `title`, `actions` |
| `EmptyState`, `RestrictedState`, `ErrorState`, `QueryView`, `SkeletonBlock` | `QueryView{query, isEmpty, empty}` renders loading/error/restricted(403)/empty/data |
| `Dialog` | `open, title, onClose, footer, size, dismissible` |
| `ConfirmActionDialog` | COM-02: `title, scope, consequence, confirmLabel, onConfirm({reason}), onCancel, tone, organization? (row org for /me actions), reason?{label,required}, acknowledgement?, pending, error` |
| Form fields | `TextField, TextArea, Select{options, placeholder}, MultiSelect, Checkbox, RadioGroup, DateInput (YYYY-MM-DD), DateTimeInput{timeZone} (→ UTC instant), MoneyInput{value:{amount,currency}, currencies}, NumberInput{places}`; all take `label, hint, error, required, fieldClassName` |
| `formErrors(error, fields)`, `FormErrorSummary` | bind `errors[].field` to inputs by path prefix; unmatched errors are listed |
| `FileUpload` | `label, accept, maxBytes, multiple, onUpload(file, {sha256, onProgress})` |
| `ReadinessChecklist`, `isReady` | `items[{id,label,detail,status 'blocking'|'warning'|'passed',action}]` |
| `UnsavedChangesGuard` | `when` |
| `Menu`, `useToast` | `Menu{entries, trigger, label}`; `useToast().show(message, 'success'|'error'|'info')` |
| `FooterBar` | `currency, asOf, timeZone, onRefresh, refreshing, conversionNote` |
| Charts | `BarList{items[{id,label,value,display?,to?}]}`, `DonutChart{segments, caption}`, `TrendChart{series, points, variant 'line'|'area', formatValue}`, `StackedBarChart{series, points, horizontal}` |
| `ApprovalStatusPanel` | `subjectType, subjectId, subjectLabel, currentVersion {subjectVersion, contentHash} \| null, requestDefaults {title, summary?, amount?, legalEntityId?, categoryId?}, title?` (calls `buyer.approvals.forSubject/get/withdraw`) |
| `RequestApprovalDialog` | `open, onClose, subjectType, subjectId, subjectVersion, contentHash, subjectLabel, defaults, onRequested?` (calls `buyer.approvals.request` + `authorityCheck`) |
| `DocumentList` | `audience 'buyer'|'supplier', relatedType, relatedId, title?, canUpload?, defaultClassification?, classifications?` |
| `DocumentUploader` | `audience, relatedType, relatedId, documentId?, defaultTitle?, defaultClassification, classifications?, onUploaded?` (prototype mode skips the byte transfer and confirms) |
| `DocumentVersionHistory`, `DownloadVersionButton`, `ClassificationBadge` | `{documentId, canDownload?}`, `{documentId, versionId, fileName, label?}`, `{classification, redactedCopy?}` |
| `HistoryTimeline` | `entityType, entityId, title?, pageSize?` (buyer audit trail; restricted rows are metadata only) |

Styling uses only `.tiq-*` classes (`src/ui/src/theme/components.css`) and `--tiq-*` tokens: no raw colours, no
literal pixel gaps. Layout helpers: `.tiq-page`, `.tiq-grid .tiq-grid--2|--3|--sidebar`, `.tiq-stack`, `.tiq-inline`,
`.tiq-form-grid` + `.tiq-form-full`, `.tiq-cell-sub`, `.tiq-text-danger|warning|muted`.

### 3.6 Format helpers (`../../../lib/format`)

`formatMoney({amount,currency}, {compact?, places?})` → `BWP 1,500,000`; `formatOfficialTime(at, tz)` →
`14 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone`; `officialTimeParts`; `formatDateTime(at, tz)`;
`formatInstantDate(at, tz)`; `formatCalendarDate('2026-10-14')`; `formatAge(from, now)` → `38d`;
`formatTimeRemaining(until, now)`; `formatDecimalString(value, places?)`; `formatPercent`; `formatCount`;
`formatBytes`; `initialsOf`; `EMPTY_VALUE` (—). Use `useNow()` from `lib/useNow` for `now` (never `Date.now()` in
render). Downloads: `lib/download` (`downloadFromUrl`, `downloadBlob`, `toCsv`, `downloadCsv`). Deadline inputs:
`lib/zonedTime` (`wallTimeToInstant`, `instantToWallTime`). Live totals: `add`/`sum`/`mul` from `@contracts/decimal`.

### 3.7 SPA tests

Colocated `*.test.tsx`. Helpers in `src/ui/src/test/`: `renderWithProviders(element, { state, route, path, routes,
auth })` (`test/render`), `LocationProbe`, `stubAuth()`; `signedInSession(overrides)`, `makeTenant(overrides,
permissions)`, `makeUser`, `makeMembership`, `makeContext`, `stateWith` (`test/fixtures`); `installFetch({ 'GET
/api/v1/…': (request) => ({ status?, body }) })` → `{ requests }`, `problem(status, title, extra)` (`test/fetchMock`).
Responses are validated against the contract, so bodies must be contract-valid.

```tsx
installFetch({ 'GET /api/v1/buyer/approvals/31': () => ({ body: detail() }) });
renderWithProviders(<ApprovalStatusPanel {...props} />, { state: { session: signedInSession() } });
expect(await screen.findByText('Release T-2026-0005')).toBeInTheDocument();
```

---

## 4. URL map

| URL | Rendered by | Owner |
|---|---|---|
| `/` (+ public feature routes: `/b/:buyerSlug`, `/opportunities[/:buyerSlug/:ref]`, `/clarifications/:buyerSlug/:ref`, `/awards[/:buyerSlug/:ref]`, `/plans`, `/guidance/*`, `/register`, `/invite/:token`) | `PublicShell`; without a public home, `/` → `/signin` | shell + publication, suppliers, org-admin, operations |
| `/signin` | persona picker (DD-50; no password). Stage B adds supabase-js sign-in and `/forgot-password`, `/reset-password` | shell |
| `/select-organization` | COM-02 | shell |
| `/buyer/*`, `/supplier/*`, `/ops/*` | `AppShell` inside `RouteGuard` (signed in, active organization, area kind matches) | features |
| `/me/*` (`profile`, `tasks`, `approvals/:id`, `notifications`, `documents/:id`, `search`, `help`) | `AppShell`; matches every tenant kind | account, workspace, reporting, operations features |
| top bar | search → `/me/search?q=`, tasks → `/me/tasks`, bell → `/me/notifications`, help → `/me/help`; user menu → `/me/profile` | shell |

API audiences mirror it: `/api/v1/public/*`, `/api/v1/me/*`, `/api/v1/buyer/*`, `/api/v1/supplier/*`,
`/api/v1/ops/*`, plus `GET /api/v1/health` → `{"status":"ok","version":"v1"}`.

---

## 5. Personas, tenants and ports

Every persona signs in by choosing it in the sign-in page's persona picker (`src/ui/src/auth/PersonaPicker.tsx`,
list in `demoAccountList.ts`); there are no passwords (DD-50). The choice is kept in `sessionStorage`
(`tiq.prototype.persona`, `src/ui/src/auth/prototypeSession.ts`) and sent as the bearer token. Emails are
`<login>@tenderiq.local`. Any e-mail with no fixture persona gets 401.

| Tenant id | Slug | Kind | Name | Currency |
|---|---|---|---|---|
| 1 | `tenderiq-ops` | operator | TenderIQ Platform Operations | — |
| 2 | `kwu` | buyer | Kalahari Water Utilities (Pilot) | BWP |
| 3 | `odc` | buyer | Okavango District Council | BWP |
| 4 | `tsodilo` | supplier | Tsodilo Engineering | BWP |
| 5 | `chobe-pipe` | supplier | Chobe Pipe & Valve Supplies | BWP |
| 6 | `makgadikgadi` | supplier | Makgadikgadi Civil Works | BWP |
| 7 | `serowe-ict` | supplier | Serowe ICT Solutions | BWP |
| 8 | `limpopo-env` | supplier | Limpopo Environmental Services | BWP |
| 9 | `gaborone-meter` | supplier | Gaborone Metering Co. | BWP |

| Login | userId | Name | Membership: capacity (role templates) |
|---|---|---|---|
| `ops.admin` | 1 | Naledi Sebego | tenderiq-ops: Platform Operator (platform_operator) |
| `support.agent` | 2 | Kitso Ramotswa | tenderiq-ops: Support Agent (support_agent); support grant into `kwu` (case 1, metadata_only, until 2026-12-31) |
| `admin.kwu` | 3 | Lorato Kgosi | kwu: Organization Administrator (org_admin) |
| `mpho.manager` | 4 | Mpho Dikgang | kwu: Procurement Manager (procurement_manager; limit BWP 2,000,000.00) |
| `tebogo.officer` | 5 | Tebogo Molefe | kwu: Procurement Officer (procurement_officer) |
| `kagiso.requester` | 6 | Kagiso Phiri | kwu: Operations Engineer (requester) |
| `onalenna.budget` | 7 | Onalenna Tau | kwu: Budget Owner, Operations (budget_owner) |
| `neo.assessor` | 8 | Neo Mothibi | kwu: Qualification Assessor (qualification_assessor) |
| `lesego.finance` | 9 | Lesego Seretse | kwu: Financial Reviewer (financial_reviewer) |
| `boitumelo.chair` | 10 | Boitumelo Kgari | kwu: Evaluation Chair (evaluation_chair) |
| `thato.eval` | 11 | Thato Mokgosi | kwu: Evaluator, Technical Services (evaluator) |
| `kabo.eval` | 12 | Kabo Ntsima | kwu: Evaluator, Network Operations (evaluator) |
| `amantle.eval` | 13 | Amantle Segwai | kwu: Evaluator, Water Quality (evaluator) |
| `refilwe.commercial` | 14 | Refilwe Motsumi | kwu: Commercial Reviewer (commercial_reviewer) |
| `oratile.opener` | 15 | Oratile Baitse | kwu: Bid Opening Officer (opening_officer) |
| `goitse.witness` | 16 | Goitse Mooketsi | kwu: Opening Witness, Internal Audit (opening_witness) |
| `dineo.legal` | 17 | Dineo Masire | kwu: Legal Counsel (legal_reviewer) |
| `keabetswe.approver` | 18 | Keabetswe Nkwe | kwu: Chief Executive (Award Approver) (award_approver; limit BWP 10,000,000.00) |
| `masego.contracts` | 19 | Masego Rakgosi | kwu: Contract Manager (contract_manager) |
| `pule.auditor` | 20 | Pule Modise | kwu: Internal Auditor (auditor; read-only) |
| `former.officer` | 21 | Gaone Letsholo (deactivated → 401) | kwu: Procurement Officer (departed) (procurement_officer; revoked) |
| `admin.odc` | 22 | Wame Olebile | odc: Organization Administrator (org_admin) |
| `officer.odc` | 23 | Kefilwe Sekgoma | odc: Procurement Officer (procurement_officer) |
| `tsodilo.admin` / `.bidmanager` / `.contributor` / `.signatory` | 24–27 | Tumelo Sekgoma / Boago Moremi / Ditiro Kebonang / Motsamai Tsodilo | tsodilo: Organization Administrator (supplier_admin) / Bid Manager (bid_manager) / Technical Contributor (contributor) / Managing Director (authorized_signatory) |
| `chobe-pipe.*` (same four) | 28–31 | Chedza Ramokate / Bakang Chobe / Thabo Maano / Gorata Mphoeng | chobe-pipe: same four capacities |
| `serowe-ict.*` (same four) | 32–35 | Refentse Kgama / Otsile Serowe / Mmoloki Seabo / Tshepiso Khama | serowe-ict: same four capacities |
| `gaborone-meter.*` (same four) | 36–39 | Palesa Gabo / Kagiso Metsi / Omphile Ditshego / Lame Ntshole | gaborone-meter: same four capacities |
| `makgadikgadi.admin` | 40 | Sethunya Makgadi | makgadikgadi: Organization Administrator (supplier_admin) |
| `limpopo-env.admin` | 41 | Mothusi Limpopo | limpopo-env: Organization Administrator (supplier_admin) |
| `sam.dual` | 42 | Sam Keitumetse | kwu: Evaluator, Engineering (evaluator); tsodilo and chobe-pipe: Technical Contributor (contributor); serowe-ict: Technical Contributor (pending_approval) |

KWU also has a custom role "Opening witness" (fixtures `TENANT_ROLES`). Effective permissions per tenant come from
`permissionsForTemplates` over the membership's roles; `GET /api/v1/me/context?tenantId=<id>` returns them.

**Ports** (never 5173, the owner's). Only Vite listens (DD-50: the mock API runs in the page); Vite port Q:

| Who | Q |
|---|---|
| mock-platform, ui-shell | 5201, 5202 |
| domain `NN` (workspace 00, org-admin 01, policy 02, suppliers 03, qualification 04, requests 05, tenders 06, publication 07, clarifications 08, bids 09, opening 10, evaluation 11, selection 12, awards 13, contracts 14, reporting 15, operations 16) | `52NN` (e.g. tenders 5206) |
| verification gates, foundation-integrate | 5290 |
| Playwright `prototype` project | 5280 (`PROTOTYPE_WEB_PORT`) |

---

## 6. Running, screenshots and gates

No prerequisites: Stage A needs no Docker, no Supabase and no environment file (DD-50).

```bash
# from src/ui: the SPA with the in-browser mock API (Vite listens on localhost, i.e. ::1 on Windows)
npx vite --port 5206
```

Stop the server when done (and check that nothing still listens on your port: a background `npx` can leave its
`node` child running).

**Screenshot a page with Playwright** (verified; put the script under `.qa-scratch/<label>/`). In Git Bash set
`MSYS_NO_PATHCONV=1` so `/buyer/...` arguments are not rewritten to Windows paths.

```js
// .qa-scratch/<label>/screenshot.mjs — node .qa-scratch/<label>/screenshot.mjs <webPort> <login> <path|-> <out.png> [light|dark]
import { chromium } from '@playwright/test';

const [webPort, who, path, out, theme = 'light'] = process.argv.slice(2);
const base = `http://localhost:${webPort}`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const problems = [];
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') problems.push(`console: ${message.text()}`); });
await page.goto(`${base}/signin`);
await page.locator(`[data-persona="${who}@tenderiq.local"]`).click(); // the persona picker (DD-50)
await page.waitForURL((url) => !url.pathname.startsWith('/signin'));
if (path !== '-') await page.goto(`${base}${path}`);
if (theme === 'dark') await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
await page.waitForLoadState('networkidle');
await page.screenshot({ path: out, fullPage: true });
process.stdout.write(`${page.url()}\n${problems.join('\n')}\n`);
await browser.close();
```

A persona with several memberships (`sam.dual`) lands on `/select-organization`; pick the organization with
`page.getByRole('button', { name: /Tsodilo Engineering/ })` or see `e2e_tests/specs/prototype/shell.spec.ts`, which
also shows the axe pattern (`new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa'])`). Open
the PNG and compare it with `docs/screenshots/*.png`. E2E specs go in `e2e_tests/specs/prototype/**/*.spec.ts` and run
with `npm run test:e2e:prototype` (starts its own Vite server on 5280).

**Gates** (filter output to your paths while others work): `npm run typecheck`, `npm run typecheck:ui`,
`npm run lint`, `npm run lint:ui` (ESLint `--max-warnings 0` + Prettier: run `npx prettier --write <files>` from
`src/ui`), `npx vitest run --project unit <your paths>`, `npm run test:ui`, `npm run build`, `npm run ci:security`
(secret scan + production bundle scan, including the production CSP check).
