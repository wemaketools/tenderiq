# Frontend (SPA)

Status: As-built (Stage A prototype); backend sections as-designed

Sources:
- `docs/plan/design-decisions.md`: DD-09 (reference formats), DD-15 (deadline authority), DD-21 (`/me` personal inbox), DD-22 (buyer slug in public URLs), DD-23 (dashboard permissions), DD-27 (invitation acceptance and registration), DD-28 (public write rate limiting), DD-29 (MFA deferred), DD-30 (CSP meta tag), DD-32 (browser decimals), DD-33 (zone display), DD-34 (CSS port), DD-35 (self-hosted fonts), DD-36 (shell behaviour), DD-37 (language and i18n catalogs), DD-38 (**withdrawn** by the owner decision of 2026-09-29, superseded by DD-43), DD-39 (idempotency and in-flight submit buttons), DD-40 (`framework_calloff`), DD-41 (pursuit vs bid intent), DD-42 (acknowledgment authority), DD-43 (real Supabase Auth in local Docker from Stage A, supabase-js only, dev-only demo accounts, prototype banner from `environment.mode`), DD-44 (email notices; `nodemailer` is server-only), DD-45 (Node 24), and §E (owner decisions of 2026-09-29).
- `docs/plan/architecture-plan.md` (revision 3): §0 delivery stages and the "static means static" rule, §1 product identity, §2 "no placeholder" rule, §3.1 tenancy and organization switching, §3.2 permission enforcement in the prototype, §3.3 sealing in fixtures, §3.4 official time, §3.7 money and the shared decimal helper, §3.10 contracts-first API, §3.11 prototype mode (local Supabase stack, supabase-js only, demo-accounts quick-pick), §4 repository layout, feature auto-registration and URL map, §5 file ownership (`ui-shell`, `ui-live-api`), §6 domain map, §7 UI design system, §8 testing strategy, §9 build commands (`supabase:start`, `auth:personas`), §11 deviations (items 2, 4, 6 and 8 to 10) and the other owner answers of 2026-09-29.
- `docs/plan/tenderiq-prototype.workflow.js`: the A1 `scaffold` task (`supabase/config.toml` auth settings, `.env.local`, `.nvmrc`), the A1 `ui-shell` task (`auth/supabase.ts`, `DemoAccounts` under `import.meta.env.DEV` with its marker string, `PrototypeBanner` from `/me/context`, `lib/i18n.ts`, responsive shell), the A1 `mock-platform` task (`scan-bundle` demo-accounts check, `seed-auth-personas.ts`), the A1 `contracts-core` task (`decimal.ts`) and the A5 `walkthrough` task.
- `docs/plan/tenderiq-backend.workflow.js`: the B1 `ui-live-api` task.
- `docs/architecture-brief.md`: §1 platform summary, §4.1 SPA tsconfig, §4.2 SPA lint, §5.7 browser authentication, §7.4 Vite proxy and `envDir`, §8.1 browser-safe variables, §8.4 bundle and boundary scans, §10 frontend, §11 testing, §14 security checklist.
- `docs/css/index.css`, `docs/css/theme/tokens.css`, `docs/css/theme/components.css`: tokens, themes and component classes to port.
- `docs/screenshots/overview.png`, `leads.png`, `reports.png`, `settings.png`: shell and page anatomy.
- `docs/PRD.md`: §4.3 audience matrix, §10 BR-11, BR-18, BR-41, BR-43, §11 to §13 screen catalogs (COM-02 context confirmation), §14.1 documents, §15.2 metric safeguards, §19 service expectations and accessibility, §23 acceptance scenarios.
- `docs/plan/schema-blueprint.md`: `users.theme`, `users.display_time_zone`, `saved_views`, `custom_fields`, `evaluation_plans.decimal_places_display`, `evaluation_results.total_score_display`, `tenders.official_time_zone`, `lots.submission_deadline`.
- `docs/plan/demo-storyline.md`: personas and tenants for the demo-accounts quick-pick (real local Supabase Auth accounts, password `test1234`).
- As built (Stage A): `src/ui/src/**` (in particular `app/featureTypes.ts`, `app/featureRegistry.ts`, `app/router.tsx`, `app/RouteGuard.tsx`, `app/slices/*`, `api/client.ts`, `api/hooks.ts`, `auth/*`, `components/**`, `lib/*`) and every `features/*/routes.tsx`. The route, navigation and feature tables below are generated from the registered feature modules on 2026-09-30.

Contents:
1. [Scope and stack](#1-scope-and-stack)
2. [Workspace layout and ownership](#2-workspace-layout-and-ownership)
3. [Design system](#3-design-system)
4. [Component inventory](#4-component-inventory)
5. [App shell anatomy](#5-app-shell-anatomy)
6. [Page anatomy](#6-page-anatomy)
7. [Feature modules and auto-registration](#7-feature-modules-and-auto-registration)
8. [Routing and URL map](#8-routing-and-url-map)
9. [State management](#9-state-management)
10. [API client](#10-api-client)
11. [Authentication, demo accounts and prototype banner](#11-authentication-demo-accounts-and-prototype-banner)
12. [Forms and validation](#12-forms-and-validation)
13. [Official deadlines and time display](#13-official-deadlines-and-time-display)
14. [Money, numbers, references and statuses](#14-money-numbers-references-and-statuses)
15. [Accessibility](#15-accessibility)
16. [Frontend testing](#16-frontend-testing)
17. [Open points](#17-open-points)
18. [Related documents](#18-related-documents)

---

## 1. Scope and stack

The SPA is the whole product UI: the public portal, the buyer, evaluator, supplier and operator workspaces, and the personal `/me` area. **Stage A builds all of it**: every in-scope screen, navigation, the design system and all states, running against the mock API with static fixture data. Sign-in is real from Stage A: the SPA authenticates with supabase-js against Supabase Auth running in the local Supabase Docker stack (DD-43). Stage B points the SPA at the real API without rewriting screens (architecture-plan §0, §5). The prototype runs locally only; there is no hosted prototype (owner decision of 2026-09-29).

| Concern | Choice (brief §1, §10; architecture-plan §11.2) |
|---|---|
| Language and build | TypeScript strict, React 18 functional components, Vite. `tsconfig.app.json`: `moduleResolution: bundler`, `jsx: react-jsx`, `types: ["vite/client"]`, `strict`, `noUncheckedIndexedAccess`, `erasableSyntaxOnly` |
| State | Redux Toolkit + react-redux |
| Routing | React Router 7 |
| Charts | Recharts |
| Auth (browser) | `@supabase/supabase-js`, used **only** for authentication, in both stages (local Supabase Auth in Docker from Stage A, DD-43) |
| Icons | hand-rolled inline-SVG set; no icon dependency ([adr/0010-no-icon-or-pdf-dependencies.md](adr/0010-no-icon-or-pdf-dependencies.md)) |
| Fonts | Inter and JetBrains Mono (both OFL), **self-hosted** as woff2 files in `src/ui/public/fonts`; no Google Fonts request and no npm font dependency (DD-35, architecture-plan §11.9) |
| Decimals | the pure shared helper `src/contracts/decimal.ts` (BigInt-based) for live totals; the server recomputes authoritatively (DD-32) |
| Language | English only in this release; every UI string goes through `t()` with per-feature catalogs (DD-37, §7) |
| Lint and format | the SPA's own ESLint config (react-hooks, react-refresh, prettier) |
| Tests | Vitest + jsdom + React Testing Library + jest-dom; Playwright + `@axe-core/playwright` |
| Output | `src/ui/dist` (Vercel `outputDirectory`) |
| Tooling runtime | Node 24 for Vite, tests and builds: `engines` `24.x`, `.nvmrc` `24`, CI Node 24, Vercel Node.js 24.x (DD-45, a deviation from the brief's Node 22 pin) |

The SPA adds no runtime dependency beyond react, react-dom, @reduxjs/toolkit, react-redux, react-router, recharts and @supabase/supabase-js (architecture-plan §11.2). In particular there is no date library, no icon library, no font package and no PDF library. The project's one approved runtime addition, `nodemailer` for the email channel (DD-44), is server-only and never reaches the SPA. Business-readable downloads (receipts, evaluation reports, evidence packs) are server-produced exports in `xlsx`, `csv` or print-styled `html`.

**Boundaries.** The SPA never imports `src/server/**`. It imports `src/contracts` (pure TypeScript + zod) for endpoint definitions, schemas, inferred types, enums and the decimal helper. Import-boundary tests prove `src/ui` cannot reach `src/server/lib/supabase` or `src/server/lib/config`. `scan-bundle` fails the build if `src/ui/dist` contains a server variable name, a service-role literal, server code, or the mock API (brief §8.4, architecture-plan §11.1). It also fails if the unique marker string of the dev-only demo-accounts quick-pick appears, which proves that Vite stripped it from the production build (DD-43, §11).

**Document security headers.** `src/ui/index.html` carries a Content-Security-Policy `<meta http-equiv>` tag allowing `self` plus the Supabase URL for authentication; fonts are self-hosted, so no font origin is needed. The Hono app sets the API's headers, and `vercel.json` still has no header rules (DD-30, [07-api.md](07-api.md#7-correlation-ids-logging-and-security-headers)).

**Local serving.** Vite serves the SPA on `http://localhost:5173`. Its `envDir` is the repository root, so `VITE_*` values come from the root `.env.local`. It proxies `/api/v1` (and `/api/cron`, for manual testing) to `http://127.0.0.1:3001`, where either the mock API (`npm run dev:prototype`) or the real API runner (`npm run dev`, Stage B) listens. The browser sees one origin, so no CORS configuration exists (brief §7.4). Sign-in is real in both modes, so the local Supabase stack must be running (`npm run supabase:start`) and, for the prototype, the demo accounts must exist (`npm run auth:personas`); `.env.local` supplies `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from that stack (architecture-plan §3.11, §9). Deployed, the Vercel rewrite `/((?!api/).*)` → `/index.html` makes deep links and hard refreshes load the SPA (brief §3.1).

## 2. Workspace layout and ownership

`src/ui/` is an npm workspace with its own `package.json`, tsconfig, ESLint and Vite config (architecture-plan §4):

| Path (`src/ui/src/`) | Contents | Owner |
|---|---|---|
| `app/` | `store.ts`, `hooks.ts` (typed hooks), `router.tsx`, `RouteGuard.tsx`, `featureRegistry.ts` and `featureTypes.ts`, `RootLayout.tsx`, `AppProviders.tsx`, `sessionActions.ts` (context loading, organization switching), `sessionSelectors.ts`, `slices/` | A1 `ui-shell` |
| `api/client.ts` | `call(endpoint, { params, query, body })` and the transport rules | A1 `ui-shell` |
| `api/hooks.ts` | `useApiQuery`, `useApiMutation`, `invalidateApiQueries` (§9) | A1 `ui-shell` |
| `api/<domain>.ts` | thin domain client wrappers over `call` and the hooks (26 modules, one per contract module) | A2 domain pipeline |
| `auth/` | `supabase.ts` (the one browser Supabase client, authentication only, brief §10), `AuthProvider`, sign-in, forgot-password and reset-password pages, `DemoAccounts` (local development builds only, DD-43), `permissions.ts` | A1 `ui-shell` |
| `components/` | `shell/`, `ui/`, `charts/`, and the shared widgets `approvals/`, `documents/`, `audit/` | A1 `ui-shell` |
| `features/<feature>/` | `routes.tsx`, `pages/`, `components/`, `i18n/en.ts` (the feature's string catalog, DD-37), colocated `*.test.tsx` | A2 domain pipeline |
| `pages/` | shell-level pages: `AreaHomePage`, `ContextRequiredPage`, `ForbiddenPage`, `NotFoundPage`, `RouteErrorPage` (with chunk-load recovery), `LoadingScreen` | A1 `ui-shell` |
| `theme/` | `tokens.css`, `components.css`, `index.css` (`--tiq-` prefix), `@font-face` rules for the self-hosted fonts | A1 `ui-shell` |
| `lib/` | `format` (money, numbers, dates), `zonedTime` (official-zone rendering, DD-33), `clock` and `useNow` (the server-synchronized application clock), `download`, `i18n` (`t()`), `storage` (guarded `localStorage` for conveniences, DD-36), `hash`, `useMediaQuery` | A1 `ui-shell` |
| `i18n/en.ts` | the shell catalog: namespaces `shell`, `common`, `auth`, `ui`, `format`, `enum`, `charts`, `approvalWidget`, `documentWidget`, `audit`, `pages` (DD-37) | A1 `ui-shell` |
| `test/` | Vitest setup (`setup.ts`), `render.tsx` (render with store, router and providers), `fetchMock.ts`, `fixtures.ts` (session fixtures for tests), `readSourceFile.ts` (source guards) | A1 `ui-shell` |

Outside `src/ui/src/`, `src/ui/public/fonts/` holds the Inter and JetBrains Mono woff2 files (DD-35), and `src/ui/index.html` carries the CSP meta tag (DD-30); both belong to A1 `ui-shell`, which owns `src/ui/**` except the features and domain client files. The decimal helper is not an SPA file: it is `src/contracts/decimal.ts`, written by A1 `contracts-core` (DD-32).

`ui-shell` also owns the Playwright `prototype` and `smoke` specs in `e2e_tests/`. `app/**`, `components/**`, `theme/**` and `lib/**` are shared files that no parallel agent edits; a feature agent that needs a change there reports a follow-up for the Integration step (architecture-plan §5). In Stage B, B1 `ui-live-api` (owning `src/ui/src/{auth,api,app,components,lib}/**` and the Playwright `smoke` and `full` specs) points `npm run dev` at the real API while `npm run dev:prototype` keeps serving the mock API. Authentication is already real, so it changes no auth mode: it completes the invitation set-password flow against the real accept endpoint, handles real 401, 403, 409 and 422 flows in the client, and wires the real two-step upload envelope into the shared document widgets (architecture-plan §5).

## 3. Design system

### 3.1 Porting rules

- `docs/css/theme/*.css` is ported into `src/ui/src/theme/`, renaming `--qiq-*` → `--tiq-*` and `.qiq-*` → `.tiq-*` (architecture-plan §7). `docs/css/index.css` becomes `theme/index.css`: it imports the two theme files and adds the global reset (border-box, full-height root, body font and background from tokens, antialiasing) and the `prefers-reduced-motion` rule.
- **Components never contain raw hex values or literal pixel gaps.** Every colour and spacing value comes from a token. The Stage B no-raw-hex architecture guard enforces this (architecture-plan §8).
- **Port fixes (DD-34).** During the port:
  - the source's literal pixel gaps (for example `gap: 8px` in buttons, `gap: 6px` in chips) become spacing tokens;
  - the QuoteIQ-only tokens and chips (`series-*`, `quadrant-*`, `--quoted`, `--won`, `--lost`) are dropped;
  - chip classes are generated per TenderIQ enum tone;
  - in dark mode, the brand name and hovered nav items use a sidebar-legible token instead of `accent-contrast`, which is almost invisible on the dark sidebar;
  - the reference footer bar is kept for dashboards and reports (§4).
- **Fonts (DD-35).** Inter and JetBrains Mono are self-hosted woff2 files in `src/ui/public/fonts`, declared with `@font-face`. There is no Google Fonts request and no npm font dependency. The font stacks below keep their system fallbacks.
- Light and dark themes are token-driven. Theme selection is the `data-theme` attribute on `<html>` (`light` or `dark`); each theme block also sets `color-scheme`.
- The user's theme is stored in `users.theme` (`light` default, `dark`) and changed from the user-card menu through the `/me/theme` endpoint.

### 3.2 Tokens

Colour tokens (light / dark, from `docs/css/theme/tokens.css`):

| Token (`--tiq-…`) | Light | Dark | Use |
|---|---|---|---|
| `surface-sidebar` | `#0f2a3f` | `#0b1e2e` | sidebar background |
| `surface-app` | `#f4f6f8` | `#0e1621` | page background |
| `surface-card` | `#ffffff` | `#16232f` | cards, top bar, inputs |
| `surface-raised` | `#ffffff` | `#1c2b39` | dialogs, menus, toasts |
| `surface-hover` | `#f8fafb` | `#1b2a37` | row and control hover |
| `surface-inset` | `#eef2f5` | `#101c27` | disabled inputs, tab tracks, skeletons |
| `border-subtle` / `border-strong` | `#e3e8ee` / `#d0d9e0` | `#263644` / `#35485a` | dividers, control borders |
| `text-primary` / `text-secondary` | `#1b2733` / `#5b6b7a` | `#eaf0f5` / `#9db0bf` | body and muted text |
| `text-on-sidebar` | `#d7e3ec` | `#d7e3ec` | sidebar text |
| `accent` / `accent-strong` | `#159aa6` / `#0f7d87` | `#2fb6c2` / `#49c5d0` | primary actions, active nav pill, links |
| `accent-contrast` | `#ffffff` | `#08202a` | text on accent (not on the dark sidebar; DD-34) |
| `accent-soft` | `#e3f4f5` | `#123b41` | KPI icon halo, accent chips, active vertical tab |
| `success`, `warning`, `danger`, `info`, `neutral` (+ `-soft`) | `#1e8e5a`, `#c9820a`, `#c0392b`, `#2a6fb0`, `#6b7a88` | `#3fbf86`, `#e3a93c`, `#e56b5d`, `#5aa0dd`, `#8497a5` | status chips, banners, deltas, overdue |
| `shadow-card`, `shadow-raised`, `scrim`, `sidebar-hover` | per theme | per theme | elevation and overlays |
| `focus-ring` | `0 0 0 2px surface-card, 0 0 0 4px accent` | same formula | `:focus-visible` outline |
| `select-chevron` | data-URI SVG with the secondary text colour baked in | same, dark colour | native select arrow |

Theme-independent tokens:

| Token (`--tiq-…`) | Value |
|---|---|
| `font-sans` | `Inter, 'Segoe UI', system-ui, -apple-system, sans-serif` |
| `font-mono` | `'JetBrains Mono', 'SFMono-Regular', Consolas, monospace` |
| `space-1` … `space-7` | 4, 8, 12, 16, 24, 32, 48 px (4 px base scale) |
| `radius-card` / `radius-chip` | 10px / 999px |

The source also defines QuoteIQ-specific tokens (`series-motor`, `series-property`, `series-engineering`, `series-marine`, `series-grouplife` and the four `quadrant-*` aliases) that have no TenderIQ meaning. They are dropped in the port (DD-34).

## 4. Component inventory

Names in the first column are the ones the plan and the prototype workflow use (`PageHeader`, `FilterBar`, `StatusChip`, `DemoAccounts`, `PrototypeBanner`, `AuthProvider`, `RouteGuard`) or, where the plan names none, the component family defined by `docs/css/theme/components.css`. The as-built React components are listed after the table.

| Component or family | Location | Source | Rules |
|---|---|---|---|
| Sidebar: brand block, nav, separator, user card | `components/shell` | plan §7; `.qiq-sidebar`, `.qiq-brand*`, `.qiq-nav*`, `.qiq-sidebar-sep`, `.qiq-user-card*`, `.qiq-avatar`, `.qiq-menu` | See §5; icon rail below 1280px, drawer below 768px (DD-36) |
| Top bar: title, section action, global search, tasks, notifications bell, help | `components/shell` | plan §7, DD-46; `.qiq-topbar`, `.qiq-searchbox`, `.qiq-global-search`, `.qiq-search-*`, `.qiq-icon-btn`, `.qiq-count` | Only the active destination's section action; search and icons never move |
| Organization and capacity switcher | `components/shell`, `/select-organization` | plan §3.1, COM-02 | Switching clears tenant-scoped state (§9) |
| `DemoAccounts` quick-pick | `auth/` (on the sign-in page) | plan §3.11, DD-43 | Local development builds only (`import.meta.env.DEV`); Vite strips it from production builds and `scan-bundle` checks its marker string (§11) |
| `PrototypeBanner` | `components/shell` | plan §0, §3.11, DD-43 | Shown when `/me/context` reports `environment.mode = 'prototype'` (§11) |
| Buttons | `components/ui` | `.qiq-btn` + `--primary`, `--danger`, `--danger-soft`, `--ghost`, `--sm`; unclassed buttons render as secondary | Accent primary; danger-soft for repeated row-level destructive actions |
| `PageHeader` | `components/ui` | plan §7, DD-46; `.qiq-page-head`, `.qiq-page-actions` | Page-local head row below the top bar: back link, subtitle, record meta, secondary actions, then the page's one primary action |
| `FilterBar` | `components/ui` | plan §7; `.qiq-filterbar` inside a card | Labelled selects, date ranges, quick-range buttons, "Clear filters" (screenshots) |
| KPI card | `components/ui` | `.qiq-kpi-halo`, `.qiq-kpi-label`, `.qiq-kpi-value`, `.qiq-kpi-delta` | Icon halo, label, value, optional delta |
| Card | `components/ui` | `.qiq-card`, `.qiq-card-head`, `.qiq-card-title`, `.qiq-card-sub`, `.qiq-card-link`, `.qiq-menu-dots` | Title, subtitle, "View … →" link, overflow menu |
| Data table | `components/ui` | `table`, `.qiq-table-wrap`, `.qiq-th-sort`, `.qiq-sort-arrow*`, `.qiq-num`, `.qiq-mono`, `.qiq-row-actions`, `.qiq-row-clickable` | Uppercase headers; sortable headers are buttons with a fixed arrow slot; numeric cells right-aligned with tabular numerals; tables scroll horizontally inside their card (DD-36) |
| `StatusChip` | `components/ui` | plan §7; `.qiq-chip` tones: info, accent, success, danger, neutral, neutral-outlined, warning | A tone mapping for **every** lifecycle state in `enums.ts`, with chip classes generated per TenderIQ enum tone and the QuoteIQ chips dropped (DD-34); the label text is always shown |
| Definition list | `components/ui` | `.qiq-dl` | Read-only label/value panels |
| Form field, grid and sections | `components/ui` | `.qiq-field`, `.qiq-required`, `.qiq-field-hint`, `.qiq-field-error`, `[aria-invalid]`, `.qiq-form-grid`, `.qiq-form-full`, `.qiq-form-section-title`, `.qiq-fieldset`, `.qiq-check-list`, `.qiq-sticky-footer` | See §12 |
| Type-ahead select | `components/ui` | `.qiq-searchselect-*` | Record pickers |
| Dialog, including the consequential-action confirmation | `components/ui` | `.qiq-scrim`, `.qiq-dialog`, `--lg`, `-header`, `-body`, `-footer` | Confirmation shows acting organization, capacity, scope and result (COM-02) |
| Banners | `components/ui` | `.qiq-banner--error`, `--warning`, `--info`, `--success` | Blocking condition, warning, information and completed decision each look distinct (PRD §19) |
| Toasts | `components/ui` | `.qiq-toasts`, `.qiq-toast--success`, `--error` | Transient results of actions |
| Skeleton, empty state | `components/ui` | `.qiq-skeleton`, `.qiq-empty` | Loading and empty states; the restricted-access explanation only for a whole page opened by URL (PRD §11, DD-49) |
| Tabs, vertical tabs | `components/ui` | `.qiq-tabs`, `.qiq-tab`, `.qiq-vtabs` | Record workspaces and settings sub-navigation |
| Page scaffolding | `components/ui` | `.qiq-page`, `.qiq-grid` | Vertical rhythm `space-4` |
| Auth surfaces | `auth/` | `.qiq-auth-page`, `.qiq-auth-card` | Sign-in, forgot and reset password render outside the shell; in local development builds the sign-in page also lists the demo accounts (DD-43) |
| Charts | `components/charts` | Recharts | Colours from tokens |
| Approval widgets | `components/approvals` | plan §5 | Approval status and decision panels reused by many features (COM-05 mechanics) |
| Document widgets | `components/documents` | plan §5 | Document lists, version history, viewer and upload (COM-07); real uploads in Stage B |
| Audit widgets | `components/audit` | plan §5 | Record history panels |
| Icons | `components/ui` | plan §7 | Hand-rolled inline-SVG line icons |
| Footer bar | — | `.qiq-footer`; screenshots | Kept for dashboards and reports: currency basis of the amounts, "data as of" time and refresh (DD-34, PRD §15.2 freshness) |

**As-built shared components (Stage A).** Every family above exists under these names; features import them from the folder's `index.ts`.

| Folder | Components |
|---|---|
| `components/shell` | `AppShell` (sidebar, top bar, banner and page outlet; icon rail and drawer, DD-36), `Sidebar`, `Topbar`, `UserCard` (switch organization, profile, theme, sign out), `PrototypeBanner`, `PublicShell` (public portal header and footer), `SelectOrganizationPage` (COM-02), `useMeBadges` (bell and task counts) |
| `components/ui` | `Button`, `Card`, `PageHeader`, `FilterBar`, `KpiCard`, `DataTable` (sortable headers, row actions, horizontal scroll), `Pagination`, `StatusChip` (a tone for every enum state), `DetailList`, `FormFields` (`TextField`, `TextArea`, `Select`, `MultiSelect`, `Checkbox`, `RadioGroup`, `DateInput`, `DateTimeInput`, `NumberInput`, `MoneyInput`, `FormErrorSummary`), `FileUpload`, `Dialog`, `ConfirmActionDialog` (COM-02 confirmation), `Menu`, `Tabs`, `LinkTabs` and `VerticalTabs`, `Banner`, `ToastProvider`, `Skeleton` and `SkeletonBlock`, `EmptyState` and `RestrictedState`, `QueryView` (loading, error, restricted, empty and data states of one query), `OfficialDeadline` (DD-33), `Values` (`Reference`, `MoneyText`, `OrDash`), `Stepper`, `Timeline`, `ReadinessChecklist`, `UnsavedChangesGuard`, `FooterBar`, `Icon` (inline-SVG set) |
| `components/charts` | `ChartFrame`, `TrendChart`, `StackedBarChart`, `DonutChart`, `BarList`, with colours from tokens (`chartTheme.ts`) |
| `components/approvals` | `ApprovalStatusPanel`, `RequestApprovalDialog` |
| `components/documents` | `DocumentList`, `DocumentUploader` (upload envelope: create, transfer, confirm), `DocumentVersionHistory`, `DownloadVersionButton`, `ClassificationBadge` |
| `components/audit` | `HistoryTimeline` |
| `auth/` | `AuthProvider`, `SignInPage`, `ForgotPasswordPage`, `ResetPasswordPage`, `AuthLayout`, `DemoAccounts` (development builds only) |

## 5. App shell anatomy

The authenticated shell reproduces the layout of `docs/screenshots/*.png` in TenderIQ's identity (architecture-plan §1, §7):

**Sidebar** (dark `surface-sidebar`, full height, sticky, scrolls independently). Below 1280px it collapses to an icon rail; below 768px it becomes a drawer (DD-36).
- **Brand block**: the tenant label `<TENANT NAME (PILOT)>` in small uppercase letter-spaced text (for example `KALAHARI WATER UTILITIES (PILOT)`), the wordmark `Tender` + accent `IQ`, and the sub-brand "Tender Intelligence". In dark mode the brand name uses a sidebar-legible token (DD-34).
- **Navigation**: grouped sections of items, each a line icon plus label. The active item is an accent pill. An item may show a count badge (danger pill; inverted on the active item). Items come from the feature registry, filtered by the active tenant's kind and the user's permissions (§7).
- A **separator** before the **admin group**.
- **User card** at the bottom: avatar initials, name and current organization, and a menu with switch organization, profile (`/me/profile`), theme toggle and sign out.

**Top bar** (64 px, sticky, `surface-card` with a bottom border): page title, then the **section action** of the active sidebar destination in accent teal, global search (to `/me/search`, COM-08), tasks (to `/me/tasks`, COM-04), notifications bell with a count badge (to `/me/notifications`, COM-06) and help (to `/me/help`, COM-09). Search and notifications cover all the user's active memberships, and each row names its organization (DD-21).

Action placement (DD-46):
- Search and the three icons are always last, so they stay in the same place on every page. When a destination has no section action, the space to the left of search stays empty.
- A **section action** applies to a whole sidebar destination, usually "New …". It is declared on the nav item (`NavItem.sectionAction`), shows on every page of the destination (including the pages the user drills into), and is hidden only on the page it leads to. It always navigates. A destination that creates through a dialog links to its list with `?new=1`, and the page opens the dialog from that parameter (`lib/useCreateParam.ts`).
- Actions on one record or one part of a destination (a tab, a sub-list, a tender's workspace sections) are **page actions**. They render in the `PageHeader` head row in the content area: secondary actions, then the page's one primary action last. The head's first row holds the back link, subtitle and actions and is at least one button tall; the record meta runs full width below it, so the tabs start at the same height on every tab of a record.

**Prototype banner**: shown on every page whenever `/me/context` reports `environment.mode = 'prototype'`, which the mock API always does (§11, DD-43).

**Page content**: on `surface-app`, composed as in §6.

```mermaid
flowchart LR
  subgraph SIDEBAR["Sidebar - surface-sidebar, full height"]
    S1["Tenant label - KALAHARI WATER UTILITIES (PILOT)"]
    S2["Wordmark - Tender plus accent IQ"]
    S3["Sub-brand - Tender Intelligence"]
    S4["Nav sections - collapsible headings, line icon, label, accent pill when active, count badge"]
    S5["Separator"]
    S6["Admin nav group"]
    S7["User card - initials, name, organization - menu: switch organization, profile, theme, sign out"]
    S1 --- S2 --- S3 --- S4 --- S5 --- S6 --- S7
  end
  subgraph MAIN["Main column - surface-app"]
    subgraph TOPBAR["Top bar - 64px, sticky"]
      T1["Page title"] --- T5["Section action of the active destination - accent, optional"] --- T2["Global search"] --- T6["Tasks"] --- T3["Notifications bell with badge"] --- T4["Help"]
    end
    BANNER["Prototype banner - when me context reports prototype mode"]
    subgraph PAGE["Page content"]
      P1["PageHeader"] --- P2["FilterBar card"] --- P3["KPI row"] --- P4["Content cards"] --- P5["Tables"]
    end
    TOPBAR --- BANNER --- PAGE
  end
  SIDEBAR --- MAIN
```

Public routes and auth routes render **outside** this shell. Auth pages use the centred auth card (`AuthLayout`). Public routes render inside `PublicShell`: a header with the wordmark, Opportunities, Awards, Plans and Guidance, Sign in (or a link to the workspace when signed in) and Register, the prototype banner when it applies, the page, and a footer.

PRD §19 requires navigation to show the current organization, event or contract, stage, deadline and next required action. The shell supplies the organization (tenant label and user card). Record workspaces (tender, contract, bid, qualification application) supply the record reference, stage chip, official deadline and next required action in their header.

## 6. Page anatomy

Pages follow **`PageHeader` → `FilterBar` card → KPI row → content cards → tables** (architecture-plan §7). A page uses the parts it needs.

| Reference screenshot | Pattern | TenderIQ screens that follow it |
|---|---|---|
| `overview.png` | Filter bar with quick ranges and selects, KPI grid (icon halo, label, value, delta), chart cards with "View … →" links, table card, attention list, footer bar with the amounts' currency, "data as of" and refresh (DD-34) | Dashboards BUY-01 (`dashboard.view`), SUP-01 (`supplier.dashboard.view`) (DD-23); REP-01 |
| `leads.png` | Filter card (selects, date range, search, "my items" toggle, Clear filters) over a register table: selection column, monospace accent references, status chips, age in danger, overdue chip, owner, flags | Registers: BUY-02, BUY-07, BUY-31, BUY-33, CON-01, the SUP-06 lists |
| `reports.png` | Introductory text, grid of report cards with an accent "Open report" action and a CSV action; footer bar as above (DD-34) | REP-01, REP-02, ADM-13 |
| `settings.png` | Vertical sub-navigation (`vtabs`) beside a page-local header ("Brokers" + "Add broker") and a table with status chips and row "Edit" actions | Administration screens ADM-01 to ADM-17, SUP-04 |

Table conventions: uppercase headers, sort carets, monospace accent references (`T-2026-0003`), `StatusChip` for every lifecycle state, overdue chips in danger, and right-aligned money with its currency (architecture-plan §7). Every list has search, filters, status, ownership and dates, plus an empty state; a list the role cannot open is explained only when its page was opened by URL, and in-page elements the role cannot see are left out (PRD §11, DD-49). Every consequential action shows its scope and result.

**No placeholders.** Every button calls a contract endpoint and handles its response. UI code never hard-codes data; it always calls the API client. Deferred extensions (FR-20 / CON-12, EXT-01 to EXT-03) do not appear as dead links (architecture-plan §2).

## 7. Feature modules and auto-registration

Each feature lives in `src/ui/src/features/<feature>/` with `routes.tsx`, `pages/`, `components/` and colocated tests. `routes.tsx` exports:

```ts
export const features: FeatureModule[] // { id, area, routes, nav }
// area: 'buyer' | 'supplier' | 'ops' | 'public' | 'common'
// nav items declare: section, order, icon, permission
```

`app/featureRegistry.ts` collects every module with `import.meta.glob('../features/*/routes.tsx', { eager: true })`. The router mounts each module's routes under its area, and the shell builds the sidebar from the `nav` items. Parallel feature agents therefore never edit a shared SPA file (architecture-plan §4).

**String catalogs (DD-37).** This release is English only, but every UI string goes through `t()`. Each feature keeps its strings in `features/<feature>/i18n/en.ts`, and the catalogs are merged by glob; the prototype workflow places `t(key, params)` in `lib/i18n.ts` with an extra shell catalog. Languages can therefore be added later without refactoring (PRD §19, §25.2).

```mermaid
flowchart LR
  subgraph FEATURES["src/ui/src/features"]
    F1["tender-authoring - routes.tsx"]
    F2["responses - routes.tsx"]
    F3["ops - routes.tsx"]
    FN["every other feature - routes.tsx"]
  end
  GLOB["featureRegistry.ts - import.meta.glob eager"]
  REG["FeatureModule list - id, area, routes, nav"]
  ROUTER["router.tsx and RouteGuard"]
  NAV["Sidebar nav - section, order, icon"]
  SESSION["session slice - active tenant kind and permissions"]
  F1 --> GLOB
  F2 --> GLOB
  F3 --> GLOB
  FN --> GLOB
  GLOB --> REG
  REG --> ROUTER
  REG --> NAV
  SESSION --> NAV
  SESSION --> ROUTER
```

The sidebar shows a nav item only when its module's area matches the active tenant's kind (`common` items always qualify) and the user holds the item's `permission`. Hiding is a convenience: the API enforces every permission (brief §5.8).

As built (Stage A), 50 feature modules live in 34 feature directories. A directory may register several modules, one per area (for example `clarifications`, `clarifications-supplier` and `clarifications-public`). The table maps each domain (architecture-plan §6) to its directories, module ids, route count and the screens their pages implement. Each directory's API wrapper is `src/ui/src/api/<contract module>.ts`.

| Domain | Feature directory | Modules (area) | Routes | Screens |
|---|---|---|---|---|
| 00 workspace | `tasks` | `tasks` (common) | 1 | COM-04 |
| 00 workspace | `approvals` | `approvals` (common) | 2 | COM-04, COM-05 |
| 00 workspace | `notifications` | `notifications` (common), `notification-rules` (buyer) | 4 | COM-06, ADM-12 |
| 00 workspace | `documents` | `documents` (common) | 2 | COM-07 |
| 00 workspace | `calendars` | `calendars` (buyer) | 3 | ADM-10 |
| 01 identity and org-admin | `account` | `account` (common), `account-public` (public) | 3 | COM-01, COM-02, COM-03 |
| 01 identity and org-admin | `admin-org` | `admin-org` (buyer) | 5 | ADM-01, ADM-02, ADM-05 |
| 01 identity and org-admin | `admin-access` | `admin-access` (buyer), `admin-access-supplier` (supplier) | 19 | ADM-03, ADM-04, SUP-04 |
| 02 policy | `admin-policy` | `admin-policy` (buyer) | 12 | ADM-06, ADM-07, ADM-08, ADM-11 |
| 03 suppliers | `supplier-org` | `supplier-org` (supplier), `supplier-org.me` (common), `supplier-org.public` (public) | 10 | SUP-02, SUP-03, SUP-05 |
| 03 suppliers | `supplier-directory` | `supplier-directory` (buyer), `supplier-directory.ops` (ops) | 7 | BUY-31, BUY-32, SUP-02 (operator registration review) |
| 04 qualification | `qualification` | `qualification` (buyer), `qualification-supplier` (supplier) | 14 | ADM-09, BUY-33, BUY-34, BUY-35, SUP-20, SUP-24 |
| 05 requests | `requests` | `requests` (buyer) | 9 | BUY-02, BUY-03, BUY-04, BUY-06 |
| 05 requests | `planning` | `planning` (buyer), `planning-public` (public) | 8 | BUY-05, PUB-06 |
| 06 tenders | `tender-authoring` | `tender-authoring` (buyer) | 8 | BUY-07 to BUY-13 |
| 07 publication | `publication` | `publication` (buyer) | 4 | BUY-14, BUY-15 |
| 07 publication | `public-portal` | `public-portal` (public) | 6 | PUB-01, PUB-02, PUB-03, PUB-07 |
| 07 publication | `opportunities` | `opportunities` (supplier) | 8 | SUP-06 to SUP-09, PUB-03 (supplier view) |
| 08 clarifications | `clarifications` | `clarifications` (buyer), `clarifications-supplier` (supplier), `clarifications-public` (public) | 18 | BUY-16, BUY-17, BUY-18, SUP-10, SUP-11, PUB-04 |
| 09 bids | `responses` | `responses` (supplier) | 11 | SUP-12 to SUP-17 |
| 09 bids | `submission-monitoring` | `submission-monitoring` (buyer) | 2 | BUY-19 |
| 10 opening | `opening` | `opening` (buyer), `opening.supplier` (supplier) | 11 | BUY-20, BUY-21, EVA-03, SUP-18 |
| 11 evaluation | `evaluation` | `evaluation` (buyer) | 8 | EVA-01, EVA-02, EVA-04, EVA-05, EVA-06 |
| 12 selection | `selection` | `selection` (buyer), `selection-supplier` (supplier) | 24 | BUY-22 to BUY-25, BUY-27, SUP-18 (assessment invitations), SUP-19 |
| 13 awards | `awards` | `awards` (buyer) | 11 | BUY-26, BUY-28, BUY-29, BUY-30 |
| 13 awards | `outcomes` | `outcomes` (supplier), `outcomes-public` (public) | 7 | SUP-21, SUP-22, PUB-05 |
| 14 contracts | `contracts` | `contracts` (buyer), `contracts-supplier` (supplier) | 15 | CON-01 to CON-11, SUP-23 |
| 15 reporting and records | `dashboard` | `dashboard-buyer` (buyer), `dashboard-supplier` (supplier) | 2 | BUY-01, SUP-01 |
| 15 reporting and records | `reports` | `reports` (buyer) | 7 | REP-01, REP-02, ADM-13, ADM-14 (report exports) |
| 15 reporting and records | `records` | `records` (buyer) | 8 | ADM-14 |
| 15 reporting and records | `search` | `search` (common) | 1 | COM-08 |
| 16 operations | `ops` | `ops` (ops) | 20 | OPS-01 to OPS-07, ADM-17 (subscriptions) |
| 16 operations | `help` | `help` (common), `help-public` (public) | 4 | COM-09 |
| 16 operations | `admin-integrations` | `admin-integrations` (buyer) | 10 | ADM-15, ADM-16, ADM-17, OPS-04 (support-access authorization) |

Each domain also owns its client wrapper `src/ui/src/api/<domain>.ts` and the tests for its features.

## 8. Routing and URL map

Top-level URL map (architecture-plan §4), as built in `app/router.tsx`. Routes below an area prefix are declared by the features' `routes.tsx`; the complete as-built list follows in §8.1, and the sidebar in §8.2. References are unique per buyer, so public record URLs carry the buyer slug (DD-22).

| URL | Screens | Access |
|---|---|---|
| `/` | PUB-01 (global home) | public |
| `/b/:buyerSlug` | PUB-01 (buyer home) | public |
| `/opportunities`, `/opportunities/:buyerSlug/:ref` | PUB-02, PUB-03 | public |
| `/clarifications/:buyerSlug/:ref` | PUB-04 | public |
| `/awards`, `/awards/:buyerSlug/:ref` | PUB-05 | public |
| `/plans`, `/plans/:buyerSlug/:noticeId` | PUB-06 | public |
| `/guidance`, `/guidance/:articleSlug`, `/service-status` | PUB-07, COM-09 (public help and service status) | public |
| `/signin`, `/forgot-password`, `/reset-password` | COM-01 | auth pages |
| `/invite/:token` | COM-01 (invitation acceptance, rendered inside `PublicShell`, through `POST /api/v1/me/invitations/:token/accept`, the one API route open to an `invited` user, DD-27) | public (inside `PublicShell`) |
| `/register`, `/register/claim/:token` | SUP-02 (supplier registration and claiming an existing supplier record; a rate-limited public POST, DD-28) | public (inside `PublicShell`) |
| `/select-organization` | COM-02 | signed in |
| `/buyer/*` | BUY, EVA, CON, ADM, REP | signed in, active tenant kind `buyer` |
| `/supplier/*` | SUP | signed in, active tenant kind `supplier` |
| `/ops/*` | OPS | signed in, active tenant kind `operator` |
| `/me/profile` | COM-03 | signed in |
| `/me/tasks` | COM-04 | signed in |
| `/me/approvals`, `/me/approvals/:approvalId` | COM-04 (approval inbox), COM-05 | signed in (the nav item shows for buyer memberships) |
| `/me/notifications` | COM-06 | signed in |
| `/me/documents`, `/me/documents/:documentId` | COM-07 | signed in |
| `/me/search` | COM-08 | signed in |
| `/me/help`, `/me/help/articles/:articleSlug`, `/me/help/cases/:caseId` | COM-09 | signed in |
| `/me/memberships`, `/me/membership-requests` | COM-02, SUP-02 | signed in |
| any other path | Not found page (inside the shell under an area prefix) | — |

**Personal `/me` pages (DD-21).** `/me/tasks`, `/me/notifications`, `/me/approvals/:id`, `/me/documents/:id` and `/me/search` show the user's **own** rows across all active memberships, each labelled with its organization. Acting on a row requires the row's tenant to be active: the action request carries `X-Tenant-Id` equal to that row's tenant (§10).

`RouteGuard.tsx` gates authentication and permissions (brief §10). As built it shows a loading screen while the session is established, sends a signed-out user to `/signin` (remembering the requested URL), sends a user without an active organization to `/select-organization`, renders `ContextRequiredPage` when the area does not match the active organization's kind (when the user has a matching membership it offers "Switch organization", which opens `/select-organization`), and renders `ForbiddenPage` when the route's permission is not held. An area without its own index route shows `AreaHomePage`, which forwards to the first sidebar destination. A route that fails to load renders `RouteErrorPage`, inside the shell for area routes. After sign-in, the active tenant remembered for this user in `localStorage` is restored when `/me/context` confirms it; the remembered value is a convenience only (DD-36). An authenticated user with several memberships and no confirmed remembered tenant, or with no active tenant yet, goes to `/select-organization` (COM-02). Area routes additionally require the active tenant's kind to match the area, mirroring the API's audience prefixes ([07-api.md](07-api.md#22-audience-prefixes)).

```mermaid
flowchart TB
  NAV["Navigate to a URL"] --> OPEN{"Public or auth route?"}
  OPEN -- yes --> OUT["Render outside the app shell"]
  OPEN -- no --> SIGNED{"Signed in?"}
  SIGNED -- no --> SIGNIN["Redirect to /signin"]
  SIGNED -- yes --> TENANT{"Active tenant selected, or remembered and confirmed by /me/context?"}
  TENANT -- no --> SELECT["Redirect to /select-organization"]
  TENANT -- yes --> AREA{"Route area matches the active tenant kind - me routes always match"}
  AREA -- no --> CTX["ContextRequiredPage - offers to switch organization"]
  AREA -- yes --> PERM{"Route permission held?"}
  PERM -- no --> DENY["ForbiddenPage - restricted-access explanation"]
  PERM -- yes --> SHELL["Render inside the app shell"]
```

The guard is a usability layer. A user who bypasses it still meets the API's 401, identical 403 and permission checks.

### 8.1 As-built route list

The SPA registers **284 feature routes** in 50 feature modules (34 feature directories), plus the shell routes `/signin`, `/forgot-password`, `/reset-password` and `/select-organization`. Paths are absolute. "Page" is relative to `src/ui/src/features/`. "Screens" are the PRD screen ids named in the page's doc comment; a page that states its COM-02 confirmation also lists COM-02. A dash in the permission column means the route has no permission of its own (public routes, personal `/me` routes, and pages that gate each action instead); the API still enforces every endpoint's permission. Two entries are redirects (`/ops/content` to `/ops/content/announcements`, and `/supplier/responses/:bidId` to its `answers` tab).

**Public (`PublicShell`, no sign-in)**: 15 routes.

| Route | Feature module | Page | Screens (page doc comment) | Route permission (any of) |
|---|---|---|---|---|
| `/invite/:token` | `account-public` | `account/pages/InvitationPage` | COM-01, COM-02 | - |
| `/clarifications/:buyerSlug/:ref` | `clarifications-public` | `clarifications/pages/public/PublicClarificationsPage` | PUB-04 | - |
| `/service-status` | `help-public` | `help/pages/PublicServicePage` | COM-09 | - |
| `/awards` | `outcomes-public` | `outcomes/pages/PublicAwardsPage` | PUB-05 | - |
| `/awards/:buyerSlug/:reference` | `outcomes-public` | `outcomes/pages/PublicAwardPage` | PUB-05 | - |
| `/plans` | `planning-public` | `planning/pages/public/PublicPlansPage` | PUB-06 | - |
| `/plans/:buyerSlug/:noticeId` | `planning-public` | `planning/pages/public/PublicNoticePage` | PUB-06 | - |
| `/` | `public-portal` | `public-portal/pages/PortalHomePage` | PUB-01 | - |
| `/b/:buyerSlug` | `public-portal` | `public-portal/pages/BuyerPortalPage` | PUB-01 | - |
| `/opportunities` | `public-portal` | `public-portal/pages/OpportunitySearchPage` | PUB-02 | - |
| `/opportunities/:buyerSlug/:ref` | `public-portal` | `public-portal/pages/NoticePage` | PUB-03 | - |
| `/guidance` | `public-portal` | `public-portal/pages/GuidancePage` | PUB-07 | - |
| `/guidance/:articleSlug` | `public-portal` | `public-portal/pages/GuidanceArticlePage` | PUB-07 | - |
| `/register` | `supplier-org.public` | `supplier-org/pages/RegisterPage` | SUP-02 | - |
| `/register/claim/:token` | `supplier-org.public` | `supplier-org/pages/ClaimOrganizationPage` | COM-02, SUP-02 | - |

**Personal `/me` (any organization kind)**: 13 routes.

| Route | Feature module | Page | Screens (page doc comment) | Route permission (any of) |
|---|---|---|---|---|
| `/me/profile` | `account` | `account/pages/ProfilePage` | COM-03 | - |
| `/me/memberships` | `account` | `account/pages/MembershipsPage` | COM-02 | - |
| `/me/approvals` | `approvals` | `approvals/pages/ApprovalInboxPage` | COM-04 | - |
| `/me/approvals/:approvalId` | `approvals` | `approvals/pages/ApprovalDecisionPage` | COM-05 | - |
| `/me/documents` | `documents` | `documents/pages/MyDocumentsPage` | COM-07 | - |
| `/me/documents/:documentId` | `documents` | `documents/pages/DocumentViewerPage` | COM-07 | - |
| `/me/help` | `help` | `help/pages/HelpCentrePage` | COM-09 | - |
| `/me/help/articles/:articleSlug` | `help` | `help/pages/HelpArticlePage` | COM-09 | - |
| `/me/help/cases/:caseId` | `help` | `help/pages/MyCasePage` | COM-09 | - |
| `/me/notifications` | `notifications` | `notifications/pages/NotificationCenterPage` | COM-06 | - |
| `/me/search` | `search` | `search/pages/SearchPage` | COM-08 | - |
| `/me/membership-requests` | `supplier-org.me` | `supplier-org/pages/MyMembershipRequestsPage` | COM-02, SUP-02 | - |
| `/me/tasks` | `tasks` | `tasks/pages/TaskInboxPage` | COM-04 | - |

**Buyer `/buyer` (buyer organizations)**: 171 routes.

| Route | Feature module | Page | Screens (page doc comment) | Route permission (any of) |
|---|---|---|---|---|
| `/buyer/admin/access` | `admin-access` | `admin-access/pages/AccessIndexPage` | - | `org.users.view` or `org.users.manage` or `org.roles.manage` or `org.access.review` or `evaluation.chair` |
| `/buyer/admin/access/users` | `admin-access` | `admin-access/pages/UsersPage` | ADM-03, SUP-04 | `org.users.view` or `org.users.manage` |
| `/buyer/admin/access/users/:userId` | `admin-access` | `admin-access/pages/UserDetailPage` | ADM-03, SUP-04 | `org.users.view` or `org.users.manage` |
| `/buyer/admin/access/roles` | `admin-access` | `admin-access/pages/RolesPage` | ADM-04, SUP-04 | `org.roles.manage` or `org.access.review` or `org.users.manage` |
| `/buyer/admin/access/roles/:roleId` | `admin-access` | `admin-access/pages/RoleDetailPage` | ADM-04, SUP-04 | `org.roles.manage` or `org.access.review` or `org.users.manage` |
| `/buyer/admin/access/groups` | `admin-access` | `admin-access/pages/GroupsPage` | ADM-04, SUP-04 | `org.roles.manage` or `org.access.review` or `org.users.manage` |
| `/buyer/admin/access/groups/:groupId` | `admin-access` | `admin-access/pages/GroupDetailPage` | ADM-04, SUP-04 | `org.roles.manage` or `org.access.review` or `org.users.manage` |
| `/buyer/admin/access/review` | `admin-access` | `admin-access/pages/AccessReviewPage` | ADM-04 | `org.access.review` or `org.roles.manage` |
| `/buyer/admin/access/conflicts` | `admin-access` | `admin-access/pages/ConflictsPage` | ADM-04 | `org.access.review` or `evaluation.chair` |
| `/buyer/admin/access/conflicts/:declarationId` | `admin-access` | `admin-access/pages/ConflictDetailPage` | ADM-04 | `org.access.review` or `evaluation.chair` |
| `/buyer/admin/service` | `admin-integrations` | `admin-integrations/pages/ServiceIndexPage` | - | `org.integrations.manage` or `tender.publish` or `org.imports.manage` or `org.subscription.view` or `org.support_access.authorize` |
| `/buyer/admin/service/integrations` | `admin-integrations` | `admin-integrations/pages/IntegrationsPage` | ADM-15 | `org.integrations.manage` |
| `/buyer/admin/service/integrations/:connectionId` | `admin-integrations` | `admin-integrations/pages/IntegrationPage` | ADM-15 | `org.integrations.manage` |
| `/buyer/admin/service/exceptions` | `admin-integrations` | `admin-integrations/pages/ExceptionsPage` | ADM-15 | `org.integrations.manage` or `tender.publish` |
| `/buyer/admin/service/exceptions/:exceptionId` | `admin-integrations` | `admin-integrations/pages/ExceptionPage` | ADM-15 | `org.integrations.manage` or `tender.publish` |
| `/buyer/admin/service/imports` | `admin-integrations` | `admin-integrations/pages/ImportsPage` | ADM-16 | `org.imports.manage` |
| `/buyer/admin/service/imports/:batchId` | `admin-integrations` | `admin-integrations/pages/ImportBatchPage` | ADM-16 | `org.imports.manage` |
| `/buyer/admin/service/subscription` | `admin-integrations` | `admin-integrations/pages/SubscriptionPage` | ADM-17 | `org.subscription.view` |
| `/buyer/admin/service/support-access` | `admin-integrations` | `admin-integrations/pages/SupportAccessPage` | OPS-04 | `org.support_access.authorize` |
| `/buyer/admin/service/support-access/:grantId` | `admin-integrations` | `admin-integrations/pages/SupportGrantPage` | - | `org.support_access.authorize` |
| `/buyer/admin/organization` | `admin-org` | `admin-org/pages/OrgIndexPage` | ADM-01, ADM-02, ADM-05 | `org.settings.manage` or `org.structure.manage` or `org.authority.manage` or `org.access.review` |
| `/buyer/admin/organization/settings` | `admin-org` | `admin-org/pages/OrganizationPage` | ADM-01 | `org.settings.manage` or `org.structure.manage` |
| `/buyer/admin/organization/structure` | `admin-org` | `admin-org/pages/StructurePage` | ADM-02 | `org.structure.manage` or `org.settings.manage` |
| `/buyer/admin/organization/authority` | `admin-org` | `admin-org/pages/AuthorityPage` | ADM-05 | `org.authority.manage` or `org.access.review` or `org.structure.manage` |
| `/buyer/admin/organization/committees/:committeeId` | `admin-org` | `admin-org/pages/CommitteePage` | ADM-05 | `org.authority.manage` or `org.structure.manage` |
| `/buyer/admin/policy` | `admin-policy` | `admin-policy/pages/PolicyIndexPage` | ADM-06, ADM-07, ADM-08, ADM-11 | `org.policy.manage` or `org.policy.approve` or `audit.view` or `org.fields.manage` or `org.templates.manage` or `org.templates.approve` or `org.portal.manage` or `org.settings.manage` or `tender.publish` |
| `/buyer/admin/policy/profiles` | `admin-policy` | `admin-policy/pages/PolicyProfilesPage` | ADM-06 | `org.policy.manage` or `org.policy.approve` or `audit.view` |
| `/buyer/admin/policy/profiles/new` | `admin-policy` | `admin-policy/pages/PolicyProfileNewPage` | ADM-06 | `org.policy.manage` |
| `/buyer/admin/policy/profiles/:profileId` | `admin-policy` | `admin-policy/pages/PolicyProfilePage` | ADM-06 | `org.policy.manage` or `org.policy.approve` or `audit.view` |
| `/buyer/admin/policy/profiles/:profileId/versions/:versionId` | `admin-policy` | `admin-policy/pages/PolicyVersionPage` | ADM-06 | `org.policy.manage` or `org.policy.approve` or `audit.view` |
| `/buyer/admin/policy/fields` | `admin-policy` | `admin-policy/pages/CustomFieldsPage` | ADM-07 | `org.fields.manage` or `audit.view` |
| `/buyer/admin/policy/fields/new` | `admin-policy` | `admin-policy/pages/CustomFieldNewPage` | ADM-07 | `org.fields.manage` |
| `/buyer/admin/policy/fields/:fieldId` | `admin-policy` | `admin-policy/pages/CustomFieldPage` | ADM-07 | `org.fields.manage` or `audit.view` |
| `/buyer/admin/policy/templates` | `admin-policy` | `admin-policy/pages/TemplatesPage` | ADM-08 | `org.templates.manage` or `org.templates.approve` or `audit.view` |
| `/buyer/admin/policy/templates/new` | `admin-policy` | `admin-policy/pages/TemplateNewPage` | ADM-08 | `org.templates.manage` |
| `/buyer/admin/policy/templates/:templateId` | `admin-policy` | `admin-policy/pages/TemplatePage` | ADM-08 | `org.templates.manage` or `org.templates.approve` or `audit.view` |
| `/buyer/admin/policy/portal` | `admin-policy` | `admin-policy/pages/PortalPolicyPage` | ADM-11 | `org.portal.manage` or `org.settings.manage` or `tender.publish` or `audit.view` |
| `/buyer/awards` | `awards` | `awards/pages/AwardRegisterPage` | BUY-26 | `award.recommend` or `award.approve` or `notice.issue` or `event.closeout` or `audit.view` |
| `/buyer/awards/:tenderId` | `awards` | `awards/pages/AwardOverviewPage` | BUY-26 | `award.recommend` or `award.approve` or `notice.issue` or `event.closeout` or `audit.view` |
| `/buyer/awards/:tenderId/recommendations/:recommendationId` | `awards` | `awards/pages/RecommendationPage` | BUY-26 | `award.recommend` or `award.approve` or `notice.issue` or `event.closeout` or `audit.view` |
| `/buyer/awards/:tenderId/notices` | `awards` | `awards/pages/NoticesPage` | BUY-28 | `notice.issue` or `award.recommend` or `award.approve` or `complaint.manage` or `audit.view` |
| `/buyer/awards/:tenderId/notices/:noticeId` | `awards` | `awards/pages/NoticePage` | BUY-28 | `notice.issue` or `award.recommend` or `award.approve` or `complaint.manage` or `audit.view` |
| `/buyer/awards/:tenderId/closeout` | `awards` | `awards/pages/CloseoutPage` | BUY-30 | `event.closeout` or `award.recommend` or `audit.view` |
| `/buyer/closeout` | `awards` | `awards/pages/CloseoutRegisterPage` | BUY-30 | `event.closeout` or `award.recommend` or `audit.view` |
| `/buyer/award-cases` | `awards` | `awards/pages/DebriefsPage` | BUY-29 | `complaint.manage` or `debrief.manage` or `audit.view` |
| `/buyer/award-cases/debriefs/:debriefId` | `awards` | `awards/pages/DebriefPage` | BUY-29 | `complaint.manage` or `debrief.manage` or `audit.view` |
| `/buyer/award-cases/complaints` | `awards` | `awards/pages/ComplaintsPage` | BUY-29 | `complaint.manage` or `debrief.manage` or `audit.view` |
| `/buyer/award-cases/complaints/:complaintId` | `awards` | `awards/pages/ComplaintPage` | BUY-29 | `complaint.manage` or `debrief.manage` or `audit.view` |
| `/buyer/admin/calendars` | `calendars` | `calendars/pages/CalendarsPage` | ADM-10 | `org.calendars.manage` or `tender.edit` or `tender.view` |
| `/buyer/admin/calendars/new` | `calendars` | `calendars/pages/CalendarNewPage` | ADM-10 | `org.calendars.manage` |
| `/buyer/admin/calendars/:calendarId` | `calendars` | `calendars/pages/CalendarPage` | ADM-10 | `org.calendars.manage` or `tender.edit` or `tender.view` |
| `/buyer/clarifications` | `clarifications` | `clarifications/pages/BuyerClarificationsHome` | - | `tender.clarifications.manage` or `tender.addenda.approve` or `tender.sessions.manage` |
| `/buyer/clarifications/questions` | `clarifications` | `clarifications/pages/buyer/QuestionsPage` | BUY-16 | `tender.clarifications.manage` |
| `/buyer/clarifications/questions/:questionId` | `clarifications` | `clarifications/pages/buyer/QuestionPage` | BUY-16, COM-02 | `tender.clarifications.manage` |
| `/buyer/clarifications/addenda` | `clarifications` | `clarifications/pages/buyer/AddendaPage` | BUY-17 | `tender.clarifications.manage` or `tender.addenda.approve` |
| `/buyer/clarifications/addenda/new` | `clarifications` | `clarifications/pages/buyer/AddendumFormPage` | BUY-17 | `tender.clarifications.manage` |
| `/buyer/clarifications/addenda/:addendumId` | `clarifications` | `clarifications/pages/buyer/AddendumPage` | BUY-17 | `tender.clarifications.manage` or `tender.addenda.approve` |
| `/buyer/clarifications/addenda/:addendumId/edit` | `clarifications` | `clarifications/pages/buyer/AddendumFormPage` | BUY-17 | `tender.clarifications.manage` |
| `/buyer/clarifications/sessions` | `clarifications` | `clarifications/pages/buyer/SessionsPage` | BUY-18 | `tender.sessions.manage` |
| `/buyer/clarifications/sessions/new` | `clarifications` | `clarifications/pages/buyer/SessionFormPage` | BUY-18 | `tender.sessions.manage` |
| `/buyer/clarifications/sessions/:sessionId` | `clarifications` | `clarifications/pages/buyer/SessionPage` | BUY-18 | `tender.sessions.manage` |
| `/buyer/clarifications/sessions/:sessionId/edit` | `clarifications` | `clarifications/pages/buyer/SessionFormPage` | BUY-18 | `tender.sessions.manage` |
| `/buyer/contracts` | `contracts` | `contracts/pages/ContractRegisterPage` | CON-01 | `contract.view` |
| `/buyer/contracts/new` | `contracts` | `contracts/pages/NewContractPage` | CON-02 | `contract.prepare` |
| `/buyer/contracts/:contractId` | `contracts` | `contracts/pages/ContractOverviewPage` | CON-05 | `contract.view` |
| `/buyer/contracts/:contractId/preparation` | `contracts` | `contracts/pages/ContractPreparationPage` | CON-02 | `contract.view` |
| `/buyer/contracts/:contractId/signature` | `contracts` | `contracts/pages/SignaturePage` | CON-03 | `contract.view` |
| `/buyer/contracts/:contractId/handover` | `contracts` | `contracts/pages/HandoverPage` | CON-04 | `contract.view` |
| `/buyer/contracts/:contractId/milestones` | `contracts` | `contracts/pages/MilestonesPage` | CON-06 | `contract.view` |
| `/buyer/contracts/:contractId/obligations/:obligationId` | `contracts` | `contracts/pages/ObligationPage` | CON-06 | `contract.view` |
| `/buyer/contracts/:contractId/performance` | `contracts` | `contracts/pages/PerformancePage` | CON-07 | `contract.view` |
| `/buyer/contracts/:contractId/financials` | `contracts` | `contracts/pages/FinancialsPage` | CON-08 | `contract.financials.view` |
| `/buyer/contracts/:contractId/changes` | `contracts` | `contracts/pages/ChangesPage` | CON-09 | `contract.view` |
| `/buyer/contracts/:contractId/renewals` | `contracts` | `contracts/pages/RenewalsPage` | CON-10 | `contract.view` |
| `/buyer/contracts/:contractId/closeout` | `contracts` | `contracts/pages/CloseoutPage` | CON-11 | `contract.view` |
| `/buyer/dashboard` | `dashboard-buyer` | `dashboard/pages/BuyerDashboardPage` | BUY-01 | `dashboard.view` |
| `/buyer/evaluation` | `evaluation` | `evaluation/pages/EvaluationsPage` | EVA-01, EVA-05, EVA-06 | `evaluation.chair` or `evaluation.score` or `evaluation.commercial` or `evaluation.moderate` or `evaluation.signoff` or `award.recommend` or `award.approve` |
| `/buyer/evaluation/assignments` | `evaluation` | `evaluation/pages/AssignmentsPage` | EVA-01 | `evaluation.score` or `evaluation.commercial` or `evaluation.chair` |
| `/buyer/evaluation/assignments/:assignmentId` | `evaluation` | `evaluation/pages/AssignmentPage` | EVA-01 | `evaluation.score` or `evaluation.commercial` or `evaluation.chair` |
| `/buyer/evaluation/assignments/:assignmentId/assessment` | `evaluation` | `evaluation/pages/AssessmentPage` | EVA-02 | `evaluation.score` or `evaluation.chair` |
| `/buyer/evaluation/tenders/:tenderId` | `evaluation` | `evaluation/pages/EvaluationOverviewPage` | EVA-01, EVA-04 | `evaluation.chair` or `evaluation.score` or `evaluation.commercial` or `evaluation.moderate` or `evaluation.signoff` or `award.recommend` or `award.approve` |
| `/buyer/evaluation/tenders/:tenderId/commercial` | `evaluation` | `evaluation/pages/CommercialPage` | EVA-04 | `evaluation.commercial` or `evaluation.chair` |
| `/buyer/evaluation/tenders/:tenderId/moderation` | `evaluation` | `evaluation/pages/ModerationPage` | EVA-05 | `evaluation.moderate` or `evaluation.chair` |
| `/buyer/evaluation/tenders/:tenderId/results` | `evaluation` | `evaluation/pages/ResultsPage` | EVA-06 | `evaluation.chair` or `evaluation.signoff` or `award.recommend` or `award.approve` |
| `/buyer/admin/notification-rules` | `notification-rules` | `notifications/pages/NotificationRulesPage` | ADM-12 | `org.notifications.manage` |
| `/buyer/admin/notification-rules/new` | `notification-rules` | `notifications/pages/NotificationRuleNewPage` | ADM-12 | `org.notifications.manage` |
| `/buyer/admin/notification-rules/:ruleId` | `notification-rules` | `notifications/pages/NotificationRulePage` | ADM-12 | `org.notifications.manage` |
| `/buyer/opening` | `opening` | `opening/pages/OpeningPage` | BUY-20 | `bid.open` or `bid.witness` or `compliance.assess` or `evaluation.chair` or `exclusion.approve` |
| `/buyer/opening/tenders/:tenderId` | `opening` | `opening/pages/TenderOpeningPage` | BUY-20 | `bid.open` or `bid.witness` or `compliance.assess` or `evaluation.chair` or `exclusion.approve` |
| `/buyer/opening/sessions/:sessionId` | `opening` | `opening/pages/OpeningSessionPage` | BUY-20 | `bid.open` or `bid.witness` or `compliance.assess` or `evaluation.chair` or `exclusion.approve` |
| `/buyer/compliance` | `opening` | `opening/pages/CompliancePage` | BUY-21 | `compliance.assess` or `exclusion.approve` or `evaluation.chair` |
| `/buyer/compliance/tenders/:tenderId` | `opening` | `opening/pages/ComplianceRegisterPage` | BUY-21 | `compliance.assess` or `exclusion.approve` or `evaluation.chair` |
| `/buyer/compliance/bids/:bidId` | `opening` | `opening/pages/BidCompliancePage` | BUY-21 | `compliance.assess` or `exclusion.approve` or `evaluation.chair` |
| `/buyer/compliance/exclusions/:exclusionId` | `opening` | `opening/pages/ExclusionPage` | BUY-21 | `compliance.assess` or `exclusion.approve` |
| `/buyer/bid-clarifications` | `opening` | `opening/pages/ClarificationsPage` | EVA-03 | `compliance.assess` or `evaluation.chair` or `exclusion.approve` or `evaluation.score` |
| `/buyer/bid-clarifications/:clarificationId` | `opening` | `opening/pages/ClarificationPage` | BUY-21, EVA-03 | `compliance.assess` or `evaluation.chair` or `exclusion.approve` or `evaluation.score` |
| `/buyer/planning` | `planning` | `planning/pages/PlanningPage` | BUY-05 | `plan.manage` or `request.view_all` |
| `/buyer/planning/items/new` | `planning` | `planning/pages/PlanItemFormPage` | BUY-05 | `plan.manage` |
| `/buyer/planning/items/:planItemId` | `planning` | `planning/pages/PlanItemPage` | BUY-05 | `plan.manage` or `request.view_all` |
| `/buyer/planning/items/:planItemId/edit` | `planning` | `planning/pages/PlanItemFormPage` | BUY-05 | `plan.manage` |
| `/buyer/planning/notices/new` | `planning` | `planning/pages/AdvanceNoticeFormPage` | BUY-05 | `plan.manage` |
| `/buyer/planning/notices/:noticeId` | `planning` | `planning/pages/AdvanceNoticePage` | BUY-05, PUB-06 | `plan.manage` or `request.view_all` |
| `/buyer/publications` | `publication` | `publication/pages/PublicationRegisterPage` | BUY-14 | `tender.view` or `tender.publish` |
| `/buyer/tenders/:tenderId/publication` | `publication` | `publication/pages/TenderPublicationPage` | BUY-14 | `tender.view` or `tender.publish` |
| `/buyer/tenders/:tenderId/participants` | `publication` | `publication/pages/ParticipantsPage` | BUY-15 | `tender.view` or `tender.participants.manage` |
| `/buyer/tenders/:tenderId/participants/:participantId` | `publication` | `publication/pages/ParticipantPage` | BUY-15 | `tender.view` or `tender.participants.manage` |
| `/buyer/qualification` | `qualification` | `qualification/pages/buyer/QueuePage` | BUY-33 | `qualification.review` or `qualification.financial_review` or `qualification.decide` |
| `/buyer/qualification/applications/:applicationId` | `qualification` | `qualification/pages/buyer/AssessmentPage` | BUY-34, BUY-35 | `qualification.review` or `qualification.financial_review` or `qualification.decide` |
| `/buyer/qualification/applications/:applicationId/decision` | `qualification` | `qualification/pages/buyer/DecidePage` | BUY-35 | `qualification.decide` |
| `/buyer/qualification/monitoring` | `qualification` | `qualification/pages/buyer/MonitoringPage` | BUY-35 | `qualification.review` or `qualification.financial_review` or `qualification.decide` |
| `/buyer/qualification/decisions/:decisionId` | `qualification` | `qualification/pages/buyer/DecisionPage` | BUY-35, SUP-24 | `qualification.review` or `qualification.financial_review` or `qualification.decide` |
| `/buyer/qualification/triggers/:triggerId` | `qualification` | `qualification/pages/buyer/TriggerPage` | BUY-35 | `qualification.review` or `qualification.financial_review` or `qualification.decide` |
| `/buyer/admin/qualification` | `qualification` | `qualification/pages/admin/ProgramsPage` | ADM-09 | `qualification.program.manage` or `qualification.review` or `qualification.financial_review` or `qualification.decide` |
| `/buyer/admin/qualification/new` | `qualification` | `qualification/pages/admin/ProgramNewPage` | ADM-09 | `qualification.program.manage` |
| `/buyer/admin/qualification/:programId` | `qualification` | `qualification/pages/admin/ProgramPage` | ADM-09 | `qualification.program.manage` or `qualification.review` or `qualification.financial_review` or `qualification.decide` |
| `/buyer/admin/records` | `records` | `records/pages/RecordsOverviewPage` | ADM-14 | `audit.view` or `records.retention.manage` or `records.hold.manage` or `records.disposal.approve` or `export.create` |
| `/buyer/admin/records/audit` | `records` | `records/pages/AuditEventsPage` | ADM-14 | `audit.view` |
| `/buyer/admin/records/retention` | `records` | `records/pages/RetentionPage` | ADM-14 | `audit.view` or `records.retention.manage` or `records.hold.manage` or `records.disposal.approve` |
| `/buyer/admin/records/holds` | `records` | `records/pages/HoldsPage` | ADM-14 | `audit.view` or `records.retention.manage` or `records.hold.manage` or `records.disposal.approve` |
| `/buyer/admin/records/holds/:holdId` | `records` | `records/pages/HoldPage` | ADM-14 | `audit.view` or `records.retention.manage` or `records.hold.manage` or `records.disposal.approve` |
| `/buyer/admin/records/disposals` | `records` | `records/pages/DisposalsPage` | ADM-14 | `audit.view` or `records.retention.manage` or `records.hold.manage` or `records.disposal.approve` |
| `/buyer/admin/records/disposals/:disposalRequestId` | `records` | `records/pages/DisposalPage` | ADM-14 | `audit.view` or `records.retention.manage` or `records.hold.manage` or `records.disposal.approve` |
| `/buyer/admin/records/evidence-packs` | `records` | `records/pages/EvidencePacksPage` | ADM-14 | `audit.view` or `export.create` |
| `/buyer/reports` | `reports` | `reports/pages/ReportsPage` | REP-01 | `report.view` or `report.manage` |
| `/buyer/reports/definitions/new` | `reports` | `reports/pages/DefinitionPage` | ADM-13, REP-02 | `report.manage` |
| `/buyer/reports/definitions/:definitionId` | `reports` | `reports/pages/DefinitionPage` | ADM-13, REP-02 | `report.view` or `report.manage` |
| `/buyer/reports/:family` | `reports` | `reports/pages/ReportPage` | REP-01 | `report.view` or `report.manage` |
| `/buyer/admin/reports` | `reports` | `reports/pages/ReportDefinitionsPage` | ADM-13 | `report.view` or `report.manage` or `export.create` or `audit.view` |
| `/buyer/admin/reports/exports` | `reports` | `reports/pages/ExportsPage` | ADM-13 | `export.create` or `report.manage` or `audit.view` |
| `/buyer/admin/reports/exports/:exportId` | `reports` | `reports/pages/ExportPage` | ADM-13, ADM-14 | `export.create` or `report.manage` or `audit.view` |
| `/buyer/requests` | `requests` | `requests/pages/RequestRegisterPage` | BUY-02 | `request.create` or `request.view_all` |
| `/buyer/requests/new` | `requests` | `requests/pages/RequestFormPage` | BUY-03 | `request.create` |
| `/buyer/requests/:requestId` | `requests` | `requests/pages/RequestPage` | BUY-03 | `request.create` or `request.view_all` |
| `/buyer/requests/:requestId/edit` | `requests` | `requests/pages/RequestFormPage` | BUY-03 | `request.create` |
| `/buyer/requests/:requestId/decision` | `requests` | `requests/pages/RequestDecisionPage` | BUY-04 | `request.review` or `request.approve` or `request.funding_confirm` or `request.view_all` |
| `/buyer/strategies` | `requests` | `requests/pages/StrategiesPage` | BUY-06 | `strategy.manage` or `strategy.approve` or `audit.view` |
| `/buyer/strategies/new` | `requests` | `requests/pages/StrategyFormPage` | BUY-06 | `strategy.manage` |
| `/buyer/strategies/:strategyId` | `requests` | `requests/pages/StrategyPage` | BUY-06 | `strategy.manage` or `strategy.approve` or `audit.view` |
| `/buyer/strategies/:strategyId/edit` | `requests` | `requests/pages/StrategyFormPage` | BUY-06 | `strategy.manage` |
| `/buyer/selection` | `selection` | `selection/pages/buyer/SelectionRegisterPage` | BUY-22, BUY-25, BUY-27 | `selection.manage` or `shortlist.approve` or `diligence.manage` or `negotiation.conduct` or `negotiation.approve` or `award.approve` or `audit.view` or `evaluation.chair` or `evaluation.score` |
| `/buyer/selection/tenders/:tenderId` | `selection` | `selection/pages/buyer/TenderSelectionPage` | BUY-22, BUY-25, BUY-27 | `selection.manage` or `shortlist.approve` or `diligence.manage` or `negotiation.conduct` or `negotiation.approve` or `award.approve` or `audit.view` |
| `/buyer/selection/assessments` | `selection` | `selection/pages/buyer/AssessmentsPage` | BUY-22 | `selection.manage` or `shortlist.approve` or `diligence.manage` or `negotiation.conduct` or `negotiation.approve` or `award.approve` or `audit.view` or `evaluation.chair` or `evaluation.score` |
| `/buyer/selection/assessments/new` | `selection` | `selection/pages/buyer/AssessmentSessionFormPage` | BUY-22 | `selection.manage` |
| `/buyer/selection/assessments/:sessionId` | `selection` | `selection/pages/buyer/AssessmentSessionPage` | BUY-22 | `selection.manage` or `shortlist.approve` or `diligence.manage` or `negotiation.conduct` or `negotiation.approve` or `award.approve` or `audit.view` or `evaluation.chair` or `evaluation.score` |
| `/buyer/selection/references` | `selection` | `selection/pages/buyer/ReferenceChecksPage` | BUY-22 | `selection.manage` or `shortlist.approve` or `diligence.manage` or `negotiation.conduct` or `negotiation.approve` or `award.approve` or `audit.view` or `evaluation.chair` or `evaluation.score` |
| `/buyer/selection/shortlists` | `selection` | `selection/pages/buyer/ShortlistsPage` | BUY-23 | `selection.manage` or `shortlist.approve` or `diligence.manage` or `negotiation.conduct` or `negotiation.approve` or `award.approve` or `audit.view` |
| `/buyer/selection/shortlists/new` | `selection` | `selection/pages/buyer/ShortlistFormPage` | BUY-23 | `selection.manage` |
| `/buyer/selection/shortlists/:shortlistId` | `selection` | `selection/pages/buyer/ShortlistPage` | BUY-23 | `selection.manage` or `shortlist.approve` or `diligence.manage` or `negotiation.conduct` or `negotiation.approve` or `award.approve` or `audit.view` |
| `/buyer/selection/preferred-bidders` | `selection` | `selection/pages/buyer/PreferredBiddersPage` | BUY-24 | `selection.manage` or `shortlist.approve` or `diligence.manage` or `negotiation.conduct` or `negotiation.approve` or `award.approve` or `audit.view` |
| `/buyer/selection/preferred-bidders/new` | `selection` | `selection/pages/buyer/PreferredBidderFormPage` | BUY-24 | `selection.manage` |
| `/buyer/selection/preferred-bidders/:preferredBidderId` | `selection` | `selection/pages/buyer/PreferredBidderPage` | BUY-24 | `selection.manage` or `shortlist.approve` or `diligence.manage` or `negotiation.conduct` or `negotiation.approve` or `award.approve` or `audit.view` |
| `/buyer/selection/due-diligence` | `selection` | `selection/pages/buyer/DiligenceCasesPage` | BUY-25 | `selection.manage` or `shortlist.approve` or `diligence.manage` or `negotiation.conduct` or `negotiation.approve` or `award.approve` or `audit.view` |
| `/buyer/selection/due-diligence/:caseId` | `selection` | `selection/pages/buyer/DiligenceCasePage` | BUY-25 | `selection.manage` or `shortlist.approve` or `diligence.manage` or `negotiation.conduct` or `negotiation.approve` or `award.approve` or `audit.view` |
| `/buyer/selection/negotiations` | `selection` | `selection/pages/buyer/NegotiationsPage` | BUY-27 | `selection.manage` or `shortlist.approve` or `diligence.manage` or `negotiation.conduct` or `negotiation.approve` or `award.approve` or `audit.view` |
| `/buyer/selection/negotiations/new` | `selection` | `selection/pages/buyer/NegotiationFormPage` | BUY-27 | `negotiation.conduct` |
| `/buyer/selection/negotiations/:negotiationId` | `selection` | `selection/pages/buyer/NegotiationPage` | BUY-27 | `selection.manage` or `shortlist.approve` or `diligence.manage` or `negotiation.conduct` or `negotiation.approve` or `award.approve` or `audit.view` |
| `/buyer/selection/final-offers` | `selection` | `selection/pages/buyer/FinalOffersPage` | BUY-27 | `selection.manage` or `shortlist.approve` or `diligence.manage` or `negotiation.conduct` or `negotiation.approve` or `award.approve` or `audit.view` |
| `/buyer/selection/final-offers/new` | `selection` | `selection/pages/buyer/FinalOfferFormPage` | BUY-27 | `selection.manage` |
| `/buyer/selection/final-offers/:roundId` | `selection` | `selection/pages/buyer/FinalOfferPage` | BUY-27 | `selection.manage` or `shortlist.approve` or `diligence.manage` or `negotiation.conduct` or `negotiation.approve` or `award.approve` or `audit.view` |
| `/buyer/submissions` | `submission-monitoring` | `submission-monitoring/pages/MonitoringListPage` | BUY-19 | `bid.monitor` |
| `/buyer/submissions/:tenderId` | `submission-monitoring` | `submission-monitoring/pages/MonitoringTenderPage` | BUY-19, COM-02 | `bid.monitor` |
| `/buyer/suppliers` | `supplier-directory` | `supplier-directory/pages/SupplierDirectoryPage` | BUY-31 | `supplier.directory.view` |
| `/buyer/suppliers/:supplierTenantId` | `supplier-directory` | `supplier-directory/pages/SupplierRecordPage` | BUY-32 | `supplier.directory.view` |
| `/buyer/tenders` | `tender-authoring` | `tender-authoring/pages/TenderRegisterPage` | BUY-07 | `tender.view` |
| `/buyer/tenders/new` | `tender-authoring` | `tender-authoring/pages/CreateTenderPage` | BUY-07, COM-02 | `tender.create` |
| `/buyer/tenders/:tenderId` | `tender-authoring` | `tender-authoring/pages/TenderOverviewPage` | BUY-08 | `tender.view` |
| `/buyer/tenders/:tenderId/scope` | `tender-authoring` | `tender-authoring/pages/ScopePage` | BUY-09 | `tender.view` |
| `/buyer/tenders/:tenderId/pricing` | `tender-authoring` | `tender-authoring/pages/PricingPage` | BUY-10 | `tender.view` |
| `/buyer/tenders/:tenderId/evaluation` | `tender-authoring` | `tender-authoring/pages/EvaluationPlanPage` | BUY-11 | `tender.view` |
| `/buyer/tenders/:tenderId/timetable` | `tender-authoring` | `tender-authoring/pages/TimetablePage` | BUY-12 | `tender.view` |
| `/buyer/tenders/:tenderId/release` | `tender-authoring` | `tender-authoring/pages/ReleaseReviewPage` | BUY-13, COM-05 | `tender.view` |

**Supplier `/supplier` (supplier organizations)**: 60 routes.

| Route | Feature module | Page | Screens (page doc comment) | Route permission (any of) |
|---|---|---|---|---|
| `/supplier/admin/access` | `admin-access-supplier` | `admin-access/pages/AccessIndexPage` | - | `supplier.users.manage` |
| `/supplier/admin/access/users` | `admin-access-supplier` | `admin-access/pages/UsersPage` | ADM-03, SUP-04 | `supplier.users.manage` |
| `/supplier/admin/access/users/:userId` | `admin-access-supplier` | `admin-access/pages/UserDetailPage` | ADM-03, SUP-04 | `supplier.users.manage` |
| `/supplier/admin/access/roles` | `admin-access-supplier` | `admin-access/pages/RolesPage` | ADM-04, SUP-04 | `supplier.users.manage` |
| `/supplier/admin/access/roles/:roleId` | `admin-access-supplier` | `admin-access/pages/RoleDetailPage` | ADM-04, SUP-04 | `supplier.users.manage` |
| `/supplier/admin/access/groups` | `admin-access-supplier` | `admin-access/pages/GroupsPage` | ADM-04, SUP-04 | `supplier.users.manage` |
| `/supplier/admin/access/groups/:groupId` | `admin-access-supplier` | `admin-access/pages/GroupDetailPage` | ADM-04, SUP-04 | `supplier.users.manage` |
| `/supplier/admin/access/authority` | `admin-access-supplier` | `admin-access/pages/SupplierAuthorityPage` | SUP-04 | `supplier.users.manage` |
| `/supplier/admin/access/assignments` | `admin-access-supplier` | `admin-access/pages/TenderAssignmentsPage` | SUP-04 | `supplier.users.manage` |
| `/supplier/clarifications` | `clarifications-supplier` | `clarifications/pages/supplier/SupplierClarificationsPage` | SUP-10 | `supplier.opportunities.view` |
| `/supplier/clarifications/tenders/:tenderId` | `clarifications-supplier` | `clarifications/pages/supplier/SupplierTenderPage` | COM-02, SUP-10 | `supplier.opportunities.view` |
| `/supplier/clarifications/questions/:questionId` | `clarifications-supplier` | `clarifications/pages/supplier/SupplierQuestionPage` | SUP-10 | `supplier.opportunities.view` |
| `/supplier/clarifications/addenda/:addendumId` | `clarifications-supplier` | `clarifications/pages/supplier/SupplierAddendumPage` | SUP-10 | `supplier.opportunities.view` |
| `/supplier/briefings` | `clarifications-supplier` | `clarifications/pages/supplier/SupplierSessionsPage` | SUP-11 | `supplier.opportunities.view` |
| `/supplier/briefings/:sessionId` | `clarifications-supplier` | `clarifications/pages/supplier/SupplierSessionPage` | SUP-11 | `supplier.opportunities.view` |
| `/supplier/contracts` | `contracts-supplier` | `contracts/pages/supplier/SupplierContractsPage` | SUP-23 | `supplier.contract.participate` or `supplier.outcomes.view` |
| `/supplier/contracts/:contractId` | `contracts-supplier` | `contracts/pages/supplier/SupplierContractPage` | SUP-23 | `supplier.contract.participate` or `supplier.outcomes.view` |
| `/supplier/dashboard` | `dashboard-supplier` | `dashboard/pages/SupplierDashboardPage` | SUP-01 | `supplier.dashboard.view` |
| `/supplier/assessment-requests` | `opening.supplier` | `opening/pages/AssessmentRequestsPage` | SUP-18 | `supplier.response.edit` or `supplier.response.approve` or `supplier.response.submit` or `supplier.outcomes.view` |
| `/supplier/assessment-requests/:requestId` | `opening.supplier` | `opening/pages/AssessmentRequestPage` | COM-02, SUP-18 | `supplier.response.edit` or `supplier.response.approve` or `supplier.response.submit` or `supplier.outcomes.view` |
| `/supplier/opportunities` | `opportunities` | `opportunities/pages/DiscoveryPage` | SUP-06 | `supplier.opportunities.view` |
| `/supplier/opportunities/find/:buyerSlug/:ref` | `opportunities` | `opportunities/pages/OpportunityLookupPage` | PUB-03, SUP-08 | `supplier.opportunities.view` |
| `/supplier/opportunities/:tenderId` | `opportunities` | `opportunities/pages/OpportunityWorkspacePage` | SUP-08 | `supplier.opportunities.view` |
| `/supplier/opportunities/:tenderId/pursuit` | `opportunities` | `opportunities/pages/PursuitPage` | SUP-09 | `supplier.pursuit.manage` or `supplier.opportunities.view` |
| `/supplier/opportunities/:tenderId/response` | `opportunities` | `opportunities/pages/ResponseRedirectPage` | SUP-12 | `supplier.opportunities.view` |
| `/supplier/invitations` | `opportunities` | `opportunities/pages/InvitationsPage` | SUP-07 | `supplier.opportunities.view` |
| `/supplier/invitations/:participantId` | `opportunities` | `opportunities/pages/InvitationPage` | SUP-07 | `supplier.opportunities.view` |
| `/supplier/pursuits` | `opportunities` | `opportunities/pages/PursuitsPage` | SUP-09 | `supplier.pursuit.manage` or `supplier.opportunities.view` |
| `/supplier/outcomes` | `outcomes` | `outcomes/pages/SupplierOutcomesPage` | SUP-21 | `supplier.outcomes.view` |
| `/supplier/outcomes/:tenderId` | `outcomes` | `outcomes/pages/SupplierOutcomePage` | SUP-21 | `supplier.outcomes.view` |
| `/supplier/complaints` | `outcomes` | `outcomes/pages/SupplierComplaintsPage` | SUP-22 | `supplier.complaint.submit` or `supplier.outcomes.view` |
| `/supplier/complaints/new` | `outcomes` | `outcomes/pages/NewComplaintPage` | SUP-22 | `supplier.complaint.submit` |
| `/supplier/complaints/:complaintId` | `outcomes` | `outcomes/pages/SupplierComplaintPage` | SUP-22 | `supplier.complaint.submit` or `supplier.outcomes.view` |
| `/supplier/qualification` | `qualification-supplier` | `qualification/pages/supplier/SupplierQualificationPage` | SUP-20, SUP-24 | `supplier.qualification.apply` or `supplier.outcomes.view` |
| `/supplier/qualification/programs/:programId` | `qualification-supplier` | `qualification/pages/supplier/SupplierProgramPage` | SUP-20 | `supplier.qualification.apply` |
| `/supplier/qualification/applications/:applicationId` | `qualification-supplier` | `qualification/pages/supplier/SupplierApplicationPage` | SUP-20 | `supplier.qualification.apply` |
| `/supplier/qualification/decisions` | `qualification-supplier` | `qualification/pages/supplier/SupplierDecisionsPage` | SUP-24 | `supplier.qualification.apply` or `supplier.outcomes.view` |
| `/supplier/qualification/decisions/:decisionId` | `qualification-supplier` | `qualification/pages/supplier/SupplierDecisionPage` | SUP-24 | `supplier.qualification.apply` or `supplier.outcomes.view` |
| `/supplier/responses` | `responses` | `responses/pages/ResponsesPage` | SUP-12, SUP-17 | `supplier.response.edit` or `supplier.pricing.edit` or `supplier.response.approve` or `supplier.response.submit` |
| `/supplier/responses/:bidId` | `responses` | redirect to `answers` | - | `supplier.response.edit` or `supplier.pricing.edit` or `supplier.response.approve` or `supplier.response.submit` |
| `/supplier/responses/:bidId/answers` | `responses` | `responses/pages/AnswersPage` | SUP-12 | `supplier.response.edit` or `supplier.pricing.edit` or `supplier.response.approve` or `supplier.response.submit` |
| `/supplier/responses/:bidId/answers/:requirementId` | `responses` | `responses/pages/AnswerPage` | SUP-12 | `supplier.response.edit` or `supplier.pricing.edit` or `supplier.response.approve` or `supplier.response.submit` |
| `/supplier/responses/:bidId/pricing` | `responses` | `responses/pages/PricingPage` | SUP-13 | `supplier.response.edit` or `supplier.pricing.edit` or `supplier.response.approve` or `supplier.response.submit` |
| `/supplier/responses/:bidId/declarations` | `responses` | `responses/pages/DeclarationsPage` | SUP-14 | `supplier.response.edit` or `supplier.pricing.edit` or `supplier.response.approve` or `supplier.response.submit` |
| `/supplier/responses/:bidId/review` | `responses` | `responses/pages/ReviewPage` | SUP-15 | `supplier.response.edit` or `supplier.pricing.edit` or `supplier.response.approve` or `supplier.response.submit` |
| `/supplier/responses/:bidId/submit` | `responses` | `responses/pages/SubmitPage` | COM-02, SUP-16 | `supplier.response.edit` or `supplier.pricing.edit` or `supplier.response.approve` or `supplier.response.submit` |
| `/supplier/responses/:bidId/receipts` | `responses` | `responses/pages/ResponseHistoryPage` | SUP-17 | `supplier.response.edit` or `supplier.pricing.edit` or `supplier.response.approve` or `supplier.response.submit` |
| `/supplier/receipts` | `responses` | `responses/pages/ReceiptsPage` | SUP-17 | `supplier.response.edit` or `supplier.pricing.edit` or `supplier.response.approve` or `supplier.response.submit` or `supplier.outcomes.view` |
| `/supplier/receipts/:receiptId` | `responses` | `responses/pages/ReceiptPage` | SUP-16, SUP-17 | `supplier.response.edit` or `supplier.pricing.edit` or `supplier.response.approve` or `supplier.response.submit` or `supplier.outcomes.view` |
| `/supplier/assessment-invites` | `selection-supplier` | `selection/pages/supplier/SupplierInvitesPage` | SUP-18 | `supplier.opportunities.view` |
| `/supplier/negotiations` | `selection-supplier` | `selection/pages/supplier/SupplierNegotiationsPage` | SUP-19 | `supplier.outcomes.view` or `supplier.pricing.edit` |
| `/supplier/negotiations/:negotiationId` | `selection-supplier` | `selection/pages/supplier/SupplierNegotiationPage` | SUP-19 | `supplier.outcomes.view` or `supplier.pricing.edit` |
| `/supplier/final-offers/:roundId` | `selection-supplier` | `selection/pages/supplier/SupplierFinalOfferPage` | SUP-19 | `supplier.outcomes.view` or `supplier.pricing.edit` |
| `/supplier/organization` | `supplier-org` | `supplier-org/pages/OrganizationProfilePage` | SUP-02, SUP-03 | `supplier.org.manage` or `supplier.dashboard.view` |
| `/supplier/organization/edit` | `supplier-org` | `supplier-org/pages/ProfileEditPage` | SUP-03 | `supplier.org.manage` |
| `/supplier/organization/identity-changes/new` | `supplier-org` | `supplier-org/pages/IdentityChangeNewPage` | SUP-03 | `supplier.org.manage` |
| `/supplier/organization/identity-changes/:changeId` | `supplier-org` | `supplier-org/pages/IdentityChangeDetailPage` | SUP-03 | `supplier.org.manage` or `supplier.dashboard.view` |
| `/supplier/evidence` | `supplier-org` | `supplier-org/pages/EvidenceLibraryPage` | SUP-05 | `supplier.evidence.manage` or `supplier.evidence.share` or `supplier.financial.view` |
| `/supplier/evidence/new` | `supplier-org` | `supplier-org/pages/EvidenceNewPage` | SUP-05 | `supplier.evidence.manage` |
| `/supplier/evidence/:evidenceId` | `supplier-org` | `supplier-org/pages/EvidenceDetailPage` | SUP-05 | `supplier.evidence.manage` or `supplier.evidence.share` or `supplier.financial.view` |

**Operator `/ops` (the platform operator)**: 25 routes.

| Route | Feature module | Page | Screens (page doc comment) | Route permission (any of) |
|---|---|---|---|---|
| `/ops/customers` | `ops` | `ops/pages/CustomersPage` | OPS-01 | `ops.customers.manage` or `ops.support.manage` or `ops.oversight.view` |
| `/ops/customers/:customerTenantId` | `ops` | `ops/pages/CustomerPage` | OPS-01, OPS-02 | `ops.customers.manage` or `ops.support.manage` or `ops.oversight.view` |
| `/ops/customers/:customerTenantId/onboarding` | `ops` | `ops/pages/OnboardingPage` | OPS-02 | `ops.customers.manage` or `ops.support.manage` or `ops.oversight.view` |
| `/ops/offboarding` | `ops` | `ops/pages/OffboardingPlansPage` | OPS-02 | `ops.customers.manage` or `ops.support.manage` or `ops.oversight.view` |
| `/ops/offboarding/:planId` | `ops` | `ops/pages/OffboardingPlanPage` | ADM-17, OPS-02 | `ops.customers.manage` or `ops.support.manage` or `ops.oversight.view` |
| `/ops/subscriptions` | `ops` | `ops/pages/SubscriptionsPage` | OPS-03 | `ops.subscriptions.manage` or `ops.oversight.view` |
| `/ops/subscriptions/:subscriptionId` | `ops` | `ops/pages/SubscriptionPage` | OPS-03 | `ops.subscriptions.manage` or `ops.oversight.view` |
| `/ops/support` | `ops` | `ops/pages/SupportCasesPage` | OPS-04 | `ops.support.manage` or `ops.oversight.view` |
| `/ops/support/grants` | `ops` | `ops/pages/SupportGrantsPage` | OPS-04 | `ops.support.manage` or `ops.oversight.view` |
| `/ops/support/cases/:caseId` | `ops` | `ops/pages/SupportCasePage` | OPS-04 | `ops.support.manage` or `ops.oversight.view` |
| `/ops/incidents` | `ops` | `ops/pages/IncidentsPage` | OPS-05 | `ops.incidents.manage` or `ops.oversight.view` |
| `/ops/incidents/:incidentId` | `ops` | `ops/pages/IncidentPage` | OPS-05 | `ops.incidents.manage` or `ops.oversight.view` |
| `/ops/oversight` | `ops` | `ops/pages/OversightPage` | OPS-06 | `ops.oversight.view` |
| `/ops/content` | `ops` | redirect to `/ops/content/announcements` | - | `ops.content.manage` or `ops.oversight.view` |
| `/ops/content/announcements` | `ops` | `ops/pages/AnnouncementsPage` | OPS-07 | `ops.content.manage` or `ops.oversight.view` |
| `/ops/content/announcements/new` | `ops` | `ops/pages/AnnouncementEditorPage` | OPS-07 | `ops.content.manage` |
| `/ops/content/announcements/:announcementId` | `ops` | `ops/pages/AnnouncementEditorPage` | OPS-07 | `ops.content.manage` or `ops.oversight.view` |
| `/ops/content/help` | `ops` | `ops/pages/HelpArticlesPage` | OPS-07 | `ops.content.manage` or `ops.oversight.view` |
| `/ops/content/help/new` | `ops` | `ops/pages/HelpArticleEditorPage` | OPS-07 | `ops.content.manage` |
| `/ops/content/help/:articleId` | `ops` | `ops/pages/HelpArticleEditorPage` | OPS-07 | `ops.content.manage` or `ops.oversight.view` |
| `/ops/supplier-registrations` | `supplier-directory.ops` | `supplier-directory/pages/OpsRegistrationsPage` | SUP-02 | `ops.customers.manage` |
| `/ops/supplier-duplicates` | `supplier-directory.ops` | `supplier-directory/pages/OpsDuplicatesPage` | - | `ops.customers.manage` |
| `/ops/supplier-duplicates/:candidateId` | `supplier-directory.ops` | `supplier-directory/pages/OpsDuplicateDetailPage` | - | `ops.customers.manage` |
| `/ops/supplier-identity-changes` | `supplier-directory.ops` | `supplier-directory/pages/OpsIdentityChangesPage` | - | `ops.customers.manage` |
| `/ops/supplier-identity-changes/:changeId` | `supplier-directory.ops` | `supplier-directory/pages/OpsIdentityChangeDetailPage` | - | `ops.customers.manage` |

### 8.2 As-built navigation

The sidebar shows the items of the active organization's area plus the `common` items, filtered by the active membership's permissions (any of the listed codes) and, for two `common` items, by tenant kind. Sections render in the order `home`, `work`, `planning`, `sourcing`, `responding`, `evaluation`, `award`, `contracts`, `suppliers`, `insights`, `platform`, then a separator and `admin`. Items sort by `order` inside a section. Section headings (DD-48): a section with more than one destination has a heading button ("My work", "Requests and planning", "Sourcing", "Responses and assessment", "Opening and evaluation", "Selection and award", "Suppliers", "Reports and records", "Platform operations", "Administration") that opens and closes it. The section of the current page is always open (closing it lasts until the next page), "My work" starts open, the others start closed and remember the user's choice in local storage (`tiq.nav.sections`), and a closed heading shows the total of its badges. The icon rail shows every destination without headings. Search, notifications and help have no sidebar entry: the top bar's search box, bell and help icon reach `/me/search`, `/me/notifications` and `/me/help`. Badges: `open tasks` and `unread notifications` come from the `badges` slice (`/me` summaries, across all memberships); a `feature count` is reported by the feature for the active organization (open clarification questions).

| Area | Section | Order | Destination | Nav item id | Shown when the membership holds (any of) | Badge |
|---|---|---|---|---|---|---|
| buyer | home | 10 | `/buyer/dashboard` | `buyer.dashboard` | `dashboard.view` | — |
| buyer | planning | 10 | `/buyer/requests` | `buyer.requests` | `request.create` or `request.view_all` | — |
| buyer | planning | 20 | `/buyer/planning` | `buyer.planning` | `plan.manage` or `request.view_all` | — |
| buyer | planning | 30 | `/buyer/strategies` | `buyer.strategies` | `strategy.manage` or `strategy.approve` or `audit.view` | — |
| buyer | sourcing | 10 | `/buyer/tenders` | `buyer.tenders` | `tender.view` | — |
| buyer | sourcing | 30 | `/buyer/publications` | `buyer.publications` | `tender.view` or `tender.publish` | — |
| buyer | sourcing | 40 | `/buyer/clarifications` | `buyer.clarifications` | `tender.clarifications.manage` or `tender.addenda.approve` or `tender.sessions.manage` | feature count |
| buyer | sourcing | 50 | `/buyer/submissions` | `buyer.submissions` | `bid.monitor` | — |
| buyer | evaluation | 10 | `/buyer/opening` | `buyer.opening` | `bid.open` or `bid.witness` or `compliance.assess` or `evaluation.chair` or `exclusion.approve` | — |
| buyer | evaluation | 20 | `/buyer/compliance` | `buyer.compliance` | `compliance.assess` or `exclusion.approve` or `evaluation.chair` | — |
| buyer | evaluation | 30 | `/buyer/bid-clarifications` | `buyer.bidClarifications` | `compliance.assess` or `evaluation.chair` or `exclusion.approve` or `evaluation.score` | — |
| buyer | evaluation | 40 | `/buyer/evaluation/assignments` | `buyer.evaluation.assignments` | `evaluation.score` or `evaluation.commercial` or `evaluation.chair` | — |
| buyer | evaluation | 50 | `/buyer/evaluation` | `buyer.evaluation.evaluations` | `evaluation.chair` or `evaluation.score` or `evaluation.commercial` or `evaluation.moderate` or `evaluation.signoff` or `award.recommend` or `award.approve` | — |
| buyer | award | 5 | `/buyer/selection` | `buyer.selection` | `selection.manage` or `shortlist.approve` or `diligence.manage` or `negotiation.conduct` or `negotiation.approve` or `award.approve` or `audit.view` or `evaluation.chair` or `evaluation.score` | — |
| buyer | award | 10 | `/buyer/awards` | `buyer.awards` | `award.recommend` or `award.approve` or `notice.issue` or `event.closeout` or `audit.view` | — |
| buyer | award | 20 | `/buyer/award-cases` | `buyer.award-cases` | `complaint.manage` or `debrief.manage` or `audit.view` | — |
| buyer | award | 30 | `/buyer/closeout` | `buyer.closeout` | `event.closeout` or `award.recommend` or `audit.view` | — |
| buyer | contracts | 10 | `/buyer/contracts` | `buyer.contracts` | `contract.view` | — |
| buyer | suppliers | 10 | `/buyer/suppliers` | `buyer.suppliers` | `supplier.directory.view` | — |
| buyer | suppliers | 20 | `/buyer/qualification` | `buyer.qualification.queue` | `qualification.review` or `qualification.financial_review` or `qualification.decide` | — |
| buyer | suppliers | 21 | `/buyer/qualification/monitoring` | `buyer.qualification.monitoring` | `qualification.review` or `qualification.financial_review` or `qualification.decide` | — |
| buyer | insights | 10 | `/buyer/reports` | `buyer.reports` | `report.view` or `report.manage` | — |
| buyer | insights | 20 | `/buyer/admin/reports` | `buyer.admin.reports` | `report.manage` or `export.create` or `audit.view` | — |
| buyer | insights | 30 | `/buyer/admin/records` | `buyer.admin.records` | `audit.view` or `records.retention.manage` or `records.hold.manage` or `records.disposal.approve` or `export.create` | — |
| buyer | admin | 10 | `/buyer/admin/organization` | `buyer.admin-org` | `org.settings.manage` or `org.structure.manage` or `org.authority.manage` or `org.access.review` | — |
| buyer | admin | 20 | `/buyer/admin/access` | `buyer.admin-access` | `org.users.view` or `org.users.manage` or `org.roles.manage` or `org.access.review` or `evaluation.chair` | — |
| buyer | admin | 30 | `/buyer/admin/policy` | `buyer.admin-policy` | `org.policy.manage` or `org.policy.approve` or `audit.view` or `org.fields.manage` or `org.templates.manage` or `org.templates.approve` or `org.portal.manage` or `org.settings.manage` or `tender.publish` | — |
| buyer | admin | 40 | `/buyer/admin/qualification` | `buyer.qualification.programs` | `qualification.program.manage` or `qualification.review` or `qualification.financial_review` or `qualification.decide` | — |
| buyer | admin | 50 | `/buyer/admin/calendars` | `buyer.calendars` | `org.calendars.manage` | — |
| buyer | admin | 60 | `/buyer/admin/notification-rules` | `buyer.notification-rules` | `org.notifications.manage` | — |
| buyer | admin | 70 | `/buyer/admin/service` | `buyer.admin-integrations` | `org.integrations.manage` or `tender.publish` or `org.imports.manage` or `org.subscription.view` or `org.support_access.authorize` | — |
| supplier | home | 10 | `/supplier/dashboard` | `supplier.dashboard` | `supplier.dashboard.view` | — |
| supplier | sourcing | 10 | `/supplier/opportunities` | `supplier.opportunities` | `supplier.opportunities.view` | — |
| supplier | sourcing | 20 | `/supplier/invitations` | `supplier.invitations` | `supplier.opportunities.view` | — |
| supplier | sourcing | 30 | `/supplier/pursuits` | `supplier.pursuits` | `supplier.pursuit.manage` or `supplier.opportunities.view` | — |
| supplier | sourcing | 40 | `/supplier/clarifications` | `supplier.clarifications` | `supplier.opportunities.view` | feature count |
| supplier | sourcing | 45 | `/supplier/briefings` | `supplier.briefings` | `supplier.opportunities.view` | — |
| supplier | responding | 50 | `/supplier/responses` | `supplier.responses` | `supplier.response.edit` or `supplier.pricing.edit` or `supplier.response.approve` or `supplier.response.submit` | — |
| supplier | responding | 55 | `/supplier/receipts` | `supplier.receipts` | `supplier.response.edit` or `supplier.pricing.edit` or `supplier.response.approve` or `supplier.response.submit` or `supplier.outcomes.view` | — |
| supplier | responding | 60 | `/supplier/assessment-requests` | `supplier.assessmentRequests` | `supplier.response.edit` or `supplier.response.approve` or `supplier.response.submit` or `supplier.outcomes.view` | — |
| supplier | responding | 70 | `/supplier/assessment-invites` | `supplier.selection.invites` | `supplier.opportunities.view` | — |
| supplier | award | 10 | `/supplier/outcomes` | `supplier.outcomes` | `supplier.outcomes.view` | — |
| supplier | award | 20 | `/supplier/negotiations` | `supplier.selection.negotiations` | `supplier.outcomes.view` or `supplier.pricing.edit` | — |
| supplier | award | 30 | `/supplier/complaints` | `supplier.complaints` | `supplier.complaint.submit` or `supplier.outcomes.view` | — |
| supplier | contracts | 10 | `/supplier/contracts` | `supplier.contracts` | `supplier.contract.participate` or `supplier.outcomes.view` | — |
| supplier | suppliers | 10 | `/supplier/qualification` | `supplier.qualification` | `supplier.qualification.apply` or `supplier.outcomes.view` | — |
| supplier | suppliers | 11 | `/supplier/qualification/decisions` | `supplier.qualification.decisions` | `supplier.qualification.apply` or `supplier.outcomes.view` | — |
| supplier | suppliers | 20 | `/supplier/evidence` | `supplier.evidence` | `supplier.evidence.manage` or `supplier.evidence.share` or `supplier.financial.view` | — |
| supplier | admin | 10 | `/supplier/organization` | `supplier.organization` | `supplier.org.manage` or `supplier.dashboard.view` | — |
| supplier | admin | 20 | `/supplier/admin/access` | `supplier.admin-access` | `supplier.users.manage` | — |
| ops | platform | 10 | `/ops/customers` | `ops.customers` | `ops.customers.manage` or `ops.support.manage` or `ops.oversight.view` | — |
| ops | platform | 20 | `/ops/offboarding` | `ops.offboarding` | `ops.customers.manage` or `ops.support.manage` or `ops.oversight.view` | — |
| ops | platform | 30 | `/ops/subscriptions` | `ops.subscriptions` | `ops.subscriptions.manage` or `ops.oversight.view` | — |
| ops | platform | 40 | `/ops/support` | `ops.support` | `ops.support.manage` or `ops.oversight.view` | — |
| ops | platform | 50 | `/ops/incidents` | `ops.incidents` | `ops.incidents.manage` or `ops.oversight.view` | — |
| ops | platform | 60 | `/ops/oversight` | `ops.oversight` | `ops.oversight.view` | — |
| ops | platform | 70 | `/ops/content` | `ops.content` | `ops.content.manage` or `ops.oversight.view` | — |
| ops | platform | 80 | `/ops/supplier-registrations` | `ops.supplierReviews` | `ops.customers.manage` | — |
| ops | platform | 81 | `/ops/supplier-duplicates` | `ops.supplierDuplicates` | `ops.customers.manage` | — |
| ops | platform | 82 | `/ops/supplier-identity-changes` | `ops.supplierIdentityChanges` | `ops.customers.manage` | — |
| common | work | 10 | `/me/tasks` | `me.tasks` | — | open tasks |
| common | work | 20 | `/me/approvals` | `me.approvals` | — (buyer memberships only) | — |
| common | work | 40 | `/me/documents` | `me.documents` | — | — |
| common | admin | 90 | `/me/memberships` | `me.memberships` | — | — |
| common | admin | 92 | `/me/membership-requests` | `me.supplierMembershipRequests` | — (supplier memberships only) | — |

## 9. State management

Redux Toolkit holds client state in `app/store.ts`, with typed hooks in `app/hooks.ts`. As built, the store has exactly the three slices the brief names (brief §10):

| Slice | Holds | Tenant-scoped |
|---|---|---|
| `session` | auth status, signed-in user (with `theme`), memberships (tenant, kind, capacity, status), the `environment` reported by `/me/context` (`mode`, `appEnv`), **active tenant** with its effective permissions, the tenant status (`none`, `switching`, `active`, `error`), the last sign-out reason, and `tenantEpoch`, which increases every time the active tenant is set or cleared | user and memberships: no; active tenant and permissions: yes |
| `filters` | current filter and sort state per screen, and the applied saved view (`saved_views.scope` = screen id) | yes |
| `badges` | counts for the notifications bell and nav badges | yes, except the `/me` counts, which cover all active memberships (DD-21) |

The session slice is the single source of `X-Tenant-Id` for the API client. Feature pages hold server data through the hooks of `api/hooks.ts`, not in Redux: `useApiQuery(endpoint, request)` fetches on mount and whenever the request, the active tenant or the tenant epoch changes. Its cache key includes the tenant epoch, so data fetched under one tenant never renders under another (BR-02); while a new request runs, the previous data of the same endpoint and tenant stays visible (`isFetching`) to avoid flicker. `useApiMutation(endpoint)` runs commands and exposes `pending` (submit buttons are disabled while it is true, DD-39) and the normalized `error`. `invalidateApiQueries(match)` re-runs mounted queries whose endpoint id matches after a command. `QueryView` renders a query's loading, error, restricted, empty and data states consistently. The `/me` lists span all active memberships and label each row with its organization (DD-21).

**Remembered tenant (DD-36).** The active tenant is remembered per user in `localStorage`. This is a convenience only: on the next load the SPA re-validates it through `/me/context` before using it, and the API still validates `X-Tenant-Id` on every request.

**Switching organization clears all tenant-scoped state** (architecture-plan §3.1, brief §10). BR-02 requires that changing organizations transfers no permissions or confidential information, so nothing fetched under one tenant may render under another.

```mermaid
sequenceDiagram
  participant U as User
  participant M as User card menu or select-organization page
  participant S as Redux store
  participant C as API client
  participant A as API
  U->>M: choose organization and capacity
  M->>S: set active tenant in the session slice
  S->>S: remember the active tenant for this user in localStorage - convenience only
  S->>S: clear every tenant-scoped slice and cached feature data
  C->>A: next requests carry the new X-Tenant-Id
  A-->>C: data for the new tenant, or the identical 403 if access is invalid
  C-->>S: reload permissions, badges and the landing page data
```

```mermaid
stateDiagram-v2
  [*] --> SignedOut
  SignedOut --> Authenticating: sign in
  Authenticating --> SignedOut: failure - one generic message
  Authenticating --> LoadingContext: token obtained
  LoadingContext --> SelectingOrganization: no active tenant, or several memberships and no confirmed remembered tenant
  LoadingContext --> Active: exactly one membership, or remembered tenant confirmed by me context
  SelectingOrganization --> Active: organization and capacity chosen
  Active --> SwitchingTenant: switch organization
  SwitchingTenant --> Active: tenant-scoped state cleared and reloaded
  Active --> SignedOut: sign out or 401
```

## 10. API client

`api/client.ts` exposes `call(endpoint, { params, query, body }, options?)`, where `endpoint` is a `defineEndpoint` value from `src/contracts`. Domain modules in `api/<domain>.ts` are thin wrappers (architecture-plan §3.10). The client imports neither supabase-js nor the store: `AuthProvider` installs its adapters once (`configureApiClient`: the per-request token, the active tenant id, and sign-out on 401). `options.tenantId` names the row's tenant for a `/me` row action (DD-21). The brief's transport rules for `apiGet`/`apiPost`/`apiPut` (brief §10) apply to every request `call()` makes:

| Behaviour | Rule |
|---|---|
| URL | Built from the contract `path` and typed `params` and `query`, under the relative base `/api/v1` |
| Bearer token | `Authorization: Bearer <token>`, read **per request** from the supabase-js session (`auth/supabase.ts`), in both stages (DD-43) |
| Tenant | `X-Tenant-Id` from the session slice; omitted for `/me/*` reads, `/public/*` and `/health`. An action on a row listed under `/me/*` carries the row's tenant (DD-21) |
| Double submission | Submit buttons are disabled while their request is in flight. On idempotent commands the client sends an `Idempotency-Key`, generated per call unless the caller passes one (DD-39, [07-api.md](07-api.md#6-commands-state-guards-and-idempotency)) |
| Response validation | In **development builds**, the body is parsed with the contract's `response` schema, so drift between UI, mock and backend surfaces immediately |
| Errors | problem+json is normalized to an `ApiError` with `status`, `title`, `code`, `fieldErrors` (from `errors[]`, `{ field, code, message }`), `correlationId` and a `kind`: `unauthenticated`, `forbidden`, `not_found`, `validation`, `conflict` (409, 410, 412), `rate_limited` (429), `server`, `network`, `contract` (a response that fails its schema in development builds) or `tenant_required` |
| Server clock | Each response's `x-server-time` header updates the application clock (`lib/clock.ts`, §13) |
| 401 | Sign out and redirect to `/signin` |
| 403 | For the page's main content: a restricted-access explanation (the user opened that page). For an in-page panel, tab or tile: the element is not rendered (DD-49). Nothing about other tenants is revealed |
| 5xx | Sanitized message plus the `correlationId`, which the user is asked to quote |

```mermaid
sequenceDiagram
  participant P as Feature page
  participant D as Domain client module
  participant C as call in api/client.ts
  participant SB as supabase-js session
  participant API as Mock API or real API
  P->>D: user action, for example submit a response
  D->>C: call endpoint with params, query and body
  C->>C: build the URL from the contract path under /api/v1
  C->>SB: get the access token for this request
  C->>API: fetch with Bearer, and X-Tenant-Id unless a me read or public - a me row action sends the row tenant
  alt success
    API-->>C: JSON body
    C->>C: development builds - parse with the contract response schema
    C-->>P: typed data
  else problem+json
    API-->>C: status, title, code, errors, correlationId
    C->>C: normalize to status, title and fieldErrors
    C-->>P: typed error for the form or banner
  else 401
    C->>SB: sign out
    C-->>P: redirect to /signin
  end
```

When the mock API serves the SPA (prototype mode), a command returns a static response and changes no fixture (architecture-plan §0); prototype actions do not persist (owner decision of 2026-09-29). A page shows the command's own response (for example the returned receipt); lists re-read afterwards still show the unchanged fixture world.

## 11. Authentication, demo accounts and prototype banner

Authentication is **real Supabase Auth in both stages** (DD-43, architecture-plan §3.11). There is no mock auth adapter, no persona switcher, no `VITE_AUTH_MODE` build variable and no `/api/v1/__mock/auth/*` endpoint; DD-38, which had introduced them, is withdrawn. The SPA needs only the brief's browser-safe variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

**Local Supabase stack from Stage A.** The Supabase CLI runs in Docker (Auth, Postgres, Studio, Mailpit) from Stage A and is started with `npm run supabase:start`. Stage A uses Auth only; no application schema exists yet. `npm run auth:personas` creates or updates every demo persona in local Supabase Auth through the Admin API (email confirmed, password `test1234`). It is idempotent and refuses to run against anything that is not local. Local Supabase Auth is configured with `site_url` `http://localhost:5173`, redirect URLs that include `/reset-password` and `/invite`, and self-signup disabled (`enable_signup = false`). The cost of this choice is that Docker must be running to use the prototype (architecture-plan §11.8).

**supabase-js only.** `auth/supabase.ts` is the one browser Supabase client, built only from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` and used for **authentication only**: never the Data API, Storage or Realtime (brief §5.7, §10). The SPA uses it exactly as in production for email + password sign-in, forgot and reset password, invitation set-password, session persistence, automatic token refresh and sign-out. The CSP meta tag allows its Supabase URL (DD-30). `AuthProvider` exposes the auth state, gives the API client the current token and loads the session context (`/me/context`) after sign-in. As built it also keeps the Redux session slice in step with supabase-js, handles the password-recovery session that lands on `/reset-password`, and applies the user's theme to `<html data-theme>`. After sign-in, `sessionActions.ts` restores the remembered organization when `/me/context` confirms it, enters the only enterable membership (tenant status `active` or `offboarding`), or sends the user to `/select-organization`. The sign-in form shows one generic error for every failure and returns focus to the password field. `permissions.ts` answers "does the active membership hold permission X?" for navigation and control visibility.

The mock API verifies the resulting JWT with the real `src/server/lib/auth/verify.ts` and maps the verified email to its fixture persona; an account with no persona gets 401 ([07-api.md](07-api.md#32-authentication)). In Stage B the real API verifies the same token and resolves the application user.

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant SI as Sign-in page
  participant SB as supabase-js
  participant SA as Supabase Auth in local Docker
  participant AP as AuthProvider
  participant M as Mock API
  U->>SI: pick a demo account - development builds only - or type email and password
  SI->>SB: sign in with email and password
  SB->>SA: password sign-in
  SA-->>SB: session with access token
  SB-->>AP: session available
  AP->>M: GET /api/v1/me/context with Bearer
  M->>M: verify the JWT with lib/auth/verify.ts and map the email to its fixture persona
  alt invalid token or unknown account
    M-->>AP: 401 problem+json
    AP->>SB: sign out
  else persona found
    M-->>AP: user, memberships and environment mode prototype
    AP->>AP: show the prototype banner, then restore or select the organization
  end
```

**Emails in Mailpit.** Emails sent by Supabase Auth are visible in Mailpit at `http://127.0.0.1:54324`. In Stage A only password-reset emails arrive there: the demo accounts are created already confirmed by `npm run auth:personas`, and the mock API persists nothing and never calls the Auth Admin invite. Invitation and registration emails arrive from Stage B, when the real API calls the Auth Admin invite (DD-43). Locally, TenderIQ's own notice emails from the Stage B `email` channel go there too (DD-44, [07-api.md](07-api.md#00-workspace-session-and-shared-services)).

**Sign-in rules.** One generic error message for any sign-in failure, so the form cannot reveal which accounts exist. MFA and step-up sign-in are not in this release; they are recorded as a later extension using Supabase MFA (DD-29). Self-signup is disabled: `/register` submits a supplier registration that the platform turns into a provisioned account in one transaction before sending the Auth Admin invite, and the public POST is rate-limited (DD-27, DD-28, [adr/0012-supplier-registration-via-provisioned-accounts.md](adr/0012-supplier-registration-via-provisioned-accounts.md)). The owner confirmed this approach on 2026-09-29 (architecture-plan §11.4). `/invite/:token` accepts an invitation through `POST /api/v1/me/invitations/:token/accept`, the only API route open to a user in status `invited`; accepting activates the membership, and the user if needed (DD-27). In Stage B, B1 `ui-live-api` completes this set-password flow through the Supabase invite link against the real accept endpoint. The password-reset redirect lands on `/reset-password`.

**Demo accounts** (local development builds only). As built, `SignInPage` loads `DemoAccounts` with a lazy import that exists only when `import.meta.env.DEV` is true, so Vite removes both the import and the module (`auth/demoAccountList.ts`) from production builds. The component carries `data-marker="tiq-demo-accounts-dev-only-quick-pick"`, and `scan-bundle` fails if that string appears in `src/ui/dist`. The list holds 42 accounts in 9 groups: Kalahari Water Utilities (19), Okavango District Council (2), several organizations (`sam.dual`), Tsodilo Engineering, Chobe Pipe & Valve Supplies, Serowe ICT Solutions and Gaborone Metering Co. (4 each), other suppliers (2) and TenderIQ Platform Operations (2). Choosing an account fills its email and the password `test1234`, and the SPA then signs in **for real** through supabase-js (§1, §16). The personas include `tebogo.officer` (tender owner), `boitumelo.chair`, `thato.eval`, `refilwe.commercial`, `oratile.opener`, `admin.kwu` (no sealed access, AC-15), `keabetswe.approver`, `masego.contracts`, `pule.auditor`, `tsodilo.bidmanager`, `sam.dual` (one person in a buyer and two suppliers, AC-02), `ops.admin` and `support.agent`. Each persona's fixture permission set drives both navigation and the mock API's 403s, so the prototype demonstrates Stage B access behaviour. With no persona switcher, changing persona means signing out and signing in with another demo account.

**Prototype banner.** `PrototypeBanner` shows "Prototype — static demo data" whenever `/me/context` reports `environment.mode = 'prototype'` (DD-43). The mock API always reports that mode (together with `appEnv`), so in the prototype the banner is visible on every page. It cannot be dismissed, so nobody mistakes fixture data for live data (architecture-plan §0). Against the real API, the banner shows only when `/me/context` reports that mode (B1 `ui-live-api`).

## 12. Forms and validation

| Concern | Design |
|---|---|
| Field anatomy | Every input has a visible label (`.tiq-field`), a required marker (`.tiq-required`), optional hint (`.tiq-field-hint`) and an error line (`.tiq-field-error`); the invalid input carries `aria-invalid="true"`, which the CSS styles in danger. Labels, hints and messages come from `t()` (DD-37) |
| Layout | Two-column `.tiq-form-grid` (one column below 1200 px), full-width rows (`.tiq-form-full`), section titles or `fieldset` legends, check lists, and a sticky footer holding the save and submit actions |
| Schemas | Request bodies are defined by the contract schemas in `src/contracts`. The server's (or mock's) 422 is authoritative |
| Server errors | `errors[]` (`{ field, code, message }`, from the `CODE|message` convention) become `fieldErrors`, bound to inputs by `field`. No field error is dropped silently: as built, `formErrors()` binds each error to the input whose name is its `field` path or a prefix of it, and errors that match no input are listed by `FormErrorSummary` above the form actions |
| Enumerations | Option lists come from `src/contracts/enums.ts`, never from hand-typed strings. `framework_calloff` is never offered: the write enums exclude it and it never appears in the UI (DD-40) |
| Custom fields | Request, tender, qualification-application and contract forms render the tenant's configured `custom_fields` (text, number, date, boolean, choice; optional, required or conditional; audience) (ADM-07) |
| Money input | Entered and held as a **decimal string** plus a currency code; never converted to a JavaScript number ([adr/0005-decimal-strings-for-money-and-scores.md](adr/0005-decimal-strings-for-money-and-scores.md)). Live totals, for example on the SUP-13 pricing schedule, are computed in the browser with `src/contracts/decimal.ts`; the server recomputes them authoritatively (DD-32) |
| Deadline input | Date and time are entered in the tender's official time zone, which is displayed beside the input |
| Large forms | Split into sections with progress, assigned responsibilities, search and clear validation instead of one long form (PRD §19); for example responses by lot and section (SUP-12) and pricing schedules (SUP-13) |
| Save vs submit | Saving a draft, internal approval and readiness checks are visibly different from submission. Only an official receipt shows a response as submitted (BR-18, SUP-16, AC-11). A failed replacement never shows as a new effective submission (AC-12). Readiness takes acknowledgments from `participant_acknowledgments` (DD-42) |
| Double submission | Submit buttons are disabled while their request is in flight (DD-39). A retried submission still records a new submission attempt on the server, as intended evidence |
| Bid intent | A supplier's pursuit decision (SUP-09) is private. The buyer-visible bid intent and shared no-bid reason change **only** through the explicit "notify buyer" action on SUP-07 or SUP-09 (DD-41) |
| Unsaved work | The user is warned before leaving a form with unsaved changes (PRD §19) |
| Consequential actions | Submit, approve, publish, sign and similar actions open a confirmation dialog that states the **acting organization, capacity, scope and result** (COM-02, architecture-plan §7) |
| Outcome display | Warnings, blocking errors and completed decisions use distinct banners and chips (PRD §19) |

## 13. Official deadlines and time display

Rules (BR-11, BR-12, PRD §19, architecture-plan §3.4):

1. An official deadline always shows **date, time, UTC offset and IANA zone name**, for example: `14 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone`. The numeric offset comes from `Intl`. A short abbreviation (such as CAT) is shown only when `Intl` provides one (DD-33).
2. The zone is the tender's `official_time_zone` (from the `OfficialDeadline` contract type), never the browser's zone and never the user's `display_time_zone`.
3. Local-time help is optional and secondary. It uses the user's `display_time_zone` and never replaces or obscures the official line.
4. A countdown may accompany the official deadline, **never replace it**.
5. Lot-specific deadlines (`lots.submission_deadline`) are shown per lot where they differ from the tender's. A lot's deadline, when set, is authoritative for that lot; otherwise the tender's submission deadline applies (DD-15).
6. After an addendum changes a date, the current deadline is shown with the amendment history (PUB-03).
7. Official receipt times (`submission_receipts.received_at`) come from the server and are shown in the same official format. The client clock is never used for deadline logic. Countdowns, overdue marks and relative times use the application clock of `src/ui/src/lib/clock.ts`: the browser clock plus the server offset measured from the `x-server-time` response header ([07-api.md](07-api.md#31-headers)) and from `serverTime` of `/api/v1/me/context`, so in the prototype they follow the storyline clock. Components read it through `useNow()` (`src/ui/src/lib/useNow.ts`) and never call `Date.now()` during render; event handlers use `clockNow()` / `clockDate()` instead of `Date.now()` or `new Date()`.
8. Holds never move dates in the UI: a hold is displayed as a hold with its blocked actions (BR-13).
9. Overdue items (tasks, obligations, follow-ups) use a danger chip.

Formatting uses the platform `Intl` API in `lib/format`; no date library is approved. Page tests cover official deadline rendering (architecture-plan §8).

## 14. Money, numbers, references and statuses

| Item | Display rule |
|---|---|
| Money | Right-aligned, tabular numerals, always with the currency code (screenshots: `BWP 1,500,000`; KPI cards may abbreviate, for example `BWP 5.3M`). Formatting works on the decimal string; arithmetic uses `src/contracts/decimal.ts` (DD-32). Each amount kind carries its own label: estimate, approved budget, submitted price, evaluated cost, intended award, actual award, contract ceiling, committed spend, paid spend (PRD §3) |
| Consolidated totals | State the currency basis and conversion date (PRD §15.2) |
| Price adjustments | Corrections, FX conversions and discounts are shown separately from the supplier's original offer (BR-29) |
| Scores | Server-provided display values (`total_score_display`, decimals from `evaluation_plans.decimal_places_display`); the SPA does not re-round. A missing score is shown as not scored, never as 0 (AC-18) |
| References | Monospace accent text (`T-2026-0003`, `PR-2026-0001`, `PP-2026-0001`, `QA-2026-0001`, `C-2026-0001`, `RCPT-2026-000001`, `CMP-2026-0001`, and change requests as `CR-0001` within their contract) linking to the record (DD-09). References are unique per buyer, so public links also carry the buyer slug (DD-22). Rows in `/me` lists name their organization (DD-21) |
| Statuses | `StatusChip` with the state's label and tone; the label text is always present, so colour is never the only signal |
| Empty values | An em dash, as in the reference screenshots |
| Restricted data | Never rendered, counted or totalled for a user who cannot read it (BR-43). In-page elements the role cannot see or use are left out with their wrapper, never shown locked or as a zero; only a whole page opened by URL is explained (DD-49). `useCanCall(endpoint)` gates an element and its query on the endpoint contract's permission |

## 15. Accessibility

| Requirement (PRD §19, architecture-plan §7) | How the SPA meets it |
|---|---|
| Keyboard operation | Native buttons and links everywhere; sortable headers are buttons; menus, dialogs and tabs are keyboard operable |
| Visible focus | `:focus-visible` uses the `--tiq-focus-ring` token (two-ring outline) |
| Understandable labels | Every input is labelled; required fields are marked; hints explain unfamiliar terms where decisions are made |
| Meaningful errors | Field-level messages from `errors[]`; blocking conditions, warnings and completed decisions look distinct |
| Progress announcements | `aria-live` regions announce progress (uploads, submission, long-running exports) |
| Readable contrast | Token pairs per theme; in dark mode the brand and hovered nav text use a sidebar-legible token instead of `accent-contrast` (DD-34) |
| Reduced motion | The global `prefers-reduced-motion` rule from `index.css` disables animations and transitions |
| Current context | Organization in the shell; record, stage, official deadline and next action in record headers |
| Save and resume | Drafts save without losing completed work; unsaved-work warning; saved vs submitted always distinct |
| Time zones | Official deadlines per §13; never a countdown alone |
| Mobile use | Reading, approvals and notifications work on common mobile devices; below 1280px the sidebar collapses to an icon rail and below 768px it becomes a drawer, forms collapse to one column, and tables scroll horizontally inside their card (DD-36) |
| Language | English only in this release; every string goes through `t()` with per-feature catalogs, so languages can be added without refactoring (DD-37, PRD §19) |
| Accommodation requests | Help and support cases (COM-09) and session accessibility needs (SUP-11) |
| Verification | axe checks run in the Playwright `prototype` project on every nav destination for each key persona |

## 16. Frontend testing

| Layer | Tooling | Scope | Stage |
|---|---|---|---|
| Component and page tests | Vitest + jsdom + React Testing Library + jest-dom (`setupFiles: ./src/test/setup.ts`), colocated `*.test.ts(x)` | Every shared component. At least one test per page covering permission-hidden navigation, readiness vs submitted, and official deadline rendering | A, extended in B |
| Contract checks in the client | development-build response validation | Drift between contract and mock or backend | A and B |
| Playwright `prototype` | against `npm run dev:prototype` (`npm run test:e2e:prototype`), with the local Supabase stack running and the demo accounts created; personas sign in through real local Supabase Auth (DD-43) | Every nav destination for each key persona, plus axe | A |
| Playwright `smoke` | against the app started by Playwright's `webServer` | Login, logout, shell | A and B |
| Playwright `full` | real stack and demo seed | End-to-end journeys | B |
| Visual tests | Playwright against the mock API | Screen appearance | after Stage B |
| Guards | boundary and scan tests | Browser Supabase client used only for auth; `src/ui` cannot import server modules; `scan-bundle`, including the check that the marker string of the dev-only demo-accounts quick-pick is absent from `src/ui/dist` (DD-43); no raw hex values in components | A (scans), B (architecture guards) |

`ci:test:ui` fails on any skipped test and enforces a minimum test count, set after each stage's integration. As built at the end of Stage A, the SPA suite has 265 test files with 1,456 tests; the Playwright `prototype` project has the `shell` and `a11y` specs in `e2e_tests/specs/prototype/`. The Stage A `verify` sequence is typecheck → typecheck:ui → lint → lint:ui → test → test:ui → build:ui (architecture-plan §9). At Stage A handoff, `docs/prototype/walkthrough.md` records a screenshot per screen; the screenshots in `docs/prototype/screens/` are committed (owner decision of 2026-09-29). See [11-testing-strategy.md](11-testing-strategy.md).

## 17. Open points

| # | Open point | Status |
|---|---|---|
| 1 | `VITE_AUTH_MODE` is not in the brief's browser-safe variable list (only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`) and not in the plan's §11 deviations. It needs owner confirmation. Whether the mock adapter is tree-shaken out of production builds is not specified. | Resolved — DD-43 (owner decision 2026-09-29): there is no `VITE_AUTH_MODE`, no mock auth adapter and no persona switcher. The SPA signs in with supabase-js against Supabase Auth in local Docker from Stage A, so only the brief's `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are used and no deviation is needed. The dev-only demo-accounts quick-pick renders only under `import.meta.env.DEV`, Vite strips it from production builds, and `scan-bundle` fails on its marker string (§11). The earlier resolution, DD-38, is withdrawn. |
| 2 | `Intl` may render `GMT+2` instead of `CAT` for `Africa/Gaborone`. The required format needs a defined source of zone abbreviations. | Resolved — DD-33: deadlines render as `14 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone` (IANA name plus the numeric offset from `Intl`); an abbreviation is shown only when `Intl` provides one (§13). |
| 3 | `lib/decimal.ts` is server code, which the SPA may not import. Live totals on pricing forms (SUP-13) need decimal arithmetic in the browser, or server-computed totals only. | Resolved — DD-32: the helper lives in `src/contracts/decimal.ts`, re-exported by `src/server/lib/decimal.ts`; the SPA computes live totals with it and the server recomputes authoritatively (§12). |
| 4 | The source `components.css` contains literal pixel gaps (for example `gap: 8px` in buttons, `gap: 6px` in chips), which conflicts with the no-literal-pixel-gap rule. It also has QuoteIQ-specific tokens and chip names (`series-*`, `quadrant-*`, `--quoted`, `--won`, `--lost`). | Resolved — DD-34: literal gaps become spacing tokens, the QuoteIQ-only tokens and chips are dropped, and chips are generated per TenderIQ enum tone (§3.1). |
| 5 | In dark theme, `.qiq-brand-name` and hovered nav items use `--qiq-accent-contrast` (`#08202a`) on the dark sidebar (`#0b1e2e`), which is almost invisible. The port must use a sidebar-legible token. | Resolved — DD-34: in dark mode the brand and nav hover text use a sidebar-legible token (§3.1). |
| 6 | The reference footer bar (`.qiq-footer`: copyright, "All amounts in …", data-as-of time with refresh) is not in plan §7. | Resolved — DD-34: the footer bar (amounts currency, "data as of", refresh) is kept for dashboards and reports, for PRD §15.2 freshness (§4, §6). |
| 7 | Font files for Inter and JetBrains Mono: loading them is not specified, and no font dependency is approved. The stacks fall back to system fonts. | Resolved — DD-35: both fonts are self-hosted woff2 files in `src/ui/public/fonts`, with no Google Fonts request and no npm font dependency (§1, §3.1). |
| 8 | PRD §19 asks for consistent languages where a buyer operates multilingually; no i18n mechanism is specified. | Resolved — DD-37: English only in this release; every UI string goes through `t()` with per-feature catalogs `features/<f>/i18n/en.ts` merged by glob (§7). |
| 9 | Persistence of the active tenant across page reloads is not specified. | Resolved — DD-36: the active tenant is remembered per user in `localStorage` as a convenience and re-validated by `/me/context` (§9). |
| 10 | Responsive breakpoints beyond the form grid's 1199 px rule, and the sidebar's behaviour on narrow screens. | Resolved — DD-36: below 1280px the sidebar collapses to an icon rail, below 768px it becomes a drawer, and tables scroll horizontally inside their card (§5, §15). |

## 18. Related documents

- [07-api.md](07-api.md): contracts, problem+json, mock API, endpoint catalog by domain ([api/endpoint-catalog.md](api/endpoint-catalog.md)).
- [02-architecture.md](02-architecture.md): containers and components.
- [04-security-model.md](04-security-model.md): tenancy, permissions, sealing (the UI only mirrors them).
- [05-lifecycles.md](05-lifecycles.md): the states `StatusChip` must cover.
- [06-key-flows.md](06-key-flows.md): journeys the screens implement.
- [10-deployment-environments.md](10-deployment-environments.md): Vercel output, environment variables.
- [11-testing-strategy.md](11-testing-strategy.md): the full test pyramid.
- [12-traceability.md](12-traceability.md): screens to FR, BR and AC.
- [13-delivery-and-resilience.md](13-delivery-and-resilience.md): Stage A, approval gate, Stage B.
- [adr/0006-contracts-first-ui-prototype-stage.md](adr/0006-contracts-first-ui-prototype-stage.md), [adr/0010-no-icon-or-pdf-dependencies.md](adr/0010-no-icon-or-pdf-dependencies.md), [adr/0005-decimal-strings-for-money-and-scores.md](adr/0005-decimal-strings-for-money-and-scores.md), [adr/0001-tenancy-equals-organization.md](adr/0001-tenancy-equals-organization.md), [adr/0012-supplier-registration-via-provisioned-accounts.md](adr/0012-supplier-registration-via-provisioned-accounts.md).
- [../plan/design-decisions.md](../plan/design-decisions.md): the decision log (DD-01 … DD-49); DD-32 to DD-37, DD-43 and DD-46 shape this document, and DD-38 is withdrawn.
- [glossary.md](glossary.md).
