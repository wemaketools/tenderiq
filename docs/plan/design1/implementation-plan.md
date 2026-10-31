# Design1 implementation plan

Status: design direction approved; implementation not started.
Branch: `design1`, created from `main`.
Scope of this change: this plan and six visual references only. No application code changes.

## Intended outcome

Make the core buyer workspace feel like a carefully designed native productivity app: clean, professional, easy to digest, with restrained playful details. Replace the existing density of filters, metric cards, and framed panels with clear reading order, open surfaces, concise working lists, and obvious next actions.

The approved direction is the second, Apple-inspired preview set. The forest-green proposal is rejected. This is a layout and interaction redesign, not a palette swap.

## Approved references

| Screen | Reference | Existing entry point |
| --- | --- | --- |
| Overview | [01-overview.png](references/01-overview.png) | `/buyer/dashboard` |
| Tenders | [02-tenders.png](references/02-tenders.png) | `/buyer/tenders` |
| Approvals | [03-approvals.png](references/03-approvals.png) | `/me/approvals`, `/me/approvals/:approvalId` |
| Evaluation workspace | [04-evaluation.png](references/04-evaluation.png) | `/buyer/evaluation/tenders/:tenderId` |
| Awards | [05-awards.png](references/05-awards.png) | Award register under `/buyer` |
| Contracts | [06-contracts.png](references/06-contracts.png) | Contract register under `/buyer` |

The images establish visual hierarchy and composition. They contain generated sample data and inconsistencies; they are not specifications for business rules, exact copy, record counts, dates, brand lettering, or currency. Retain TenderIQ identity and use real active-organization data, locale, currency, and official time zones. Do not introduce Northbridge Council, sample people, sterling amounts, or fabricated trends into the app.

## Visual specification

| Element | Implementation target |
| --- | --- |
| Canvas | White `#FFFFFF`; cool silver `#F5F5F7` for the rail and occasional secondary surfaces |
| Text | Near-black `#1D1D1F`; secondary gray selected for accessible contrast |
| Accent | System-blue direction `#007AFF`; use a darker accessible variant for small text or button fills when needed |
| Attention | Small amber/orange indicators, red for failures; always accompanied by text |
| Completed state | Blue check plus a label; no forest-green brand or green dashboard treatment |
| Typography | Native system sans stack, using the platform system face on Apple devices and suitable system fallbacks elsewhere; no downloaded Apple font assets |
| Scale | Page headings around 36–40px on desktop, section headings 22–24px, body 15–16px, metadata 12–14px; responsive rather than oversized marketing headlines |
| Layout | Approximately 80–96px labeled navigation rail, 56–64px utility bar, 32–48px desktop content gutters |
| Grouping | Whitespace and hairline separators; soft surfaces only when they clarify selection, a restriction, or expanded content |
| Controls | Compact rounded blue primary buttons, silver segmented controls, subtle selected rows, clear keyboard focus |
| Lists | Roughly 64–80px rows with short secondary lines; right-aligned money and readable deadlines |
| Personality | Small pastel icon accents, initials, progress dots, friendly concise copy; no decorative artwork competing with work |
| Motion | Short restrained transitions for selection and disclosure; respect reduced motion; no decorative looping animations |

Use existing `--tiq-*` token conventions. Keep the established icon component and refine its visual consistency; do not add another icon or UI framework just to imitate the images. Keep simple labels such as “Approvals” discoverable even when a page uses a friendlier headline.

## Scope and compatibility

Implement the six buyer experiences first, including the buyer-context approval inbox and decision view. Evaluation's preview is a tender workspace, not the entire evaluation register; preserve the register and assignment destinations that lead into it.

The shell and shared components also serve supplier, operations, public, and other buyer pages. Introduce an explicit buyer presentation variant, extending the existing tenant context, rather than changing every surface globally. Common `/me` routes must select presentation from active tenant context, not pathname alone. Keep default component behavior for unmigrated screens and preserve current dark-mode support. Provide a corresponding accessible dark variant for new buyer surfaces; the approved light references remain the visual baseline.

Existing routes, contracts, fetching hooks, mutations, permissions, localization, saved filters, sorting, pagination, deadline semantics, and audit behavior remain authoritative. Advanced controls can move into disclosures but must remain available. Unsupported preview controls must not become inert buttons.

## Repository touchpoints

All paths below are relative to `src/ui/src/` unless stated otherwise.

| Area | Existing files | Planned change |
| --- | --- | --- |
| Tokens and styling | `theme/tokens.css`, `theme/components.css`, `theme/index.css` | Scoped buyer palette, typography, spacing, focus and surface variants |
| Shell | `components/shell/AppShell.tsx`, `Sidebar.tsx`, `Topbar.tsx`, `UserCard.tsx` | Labeled rail, organization utility bar, workspace navigation and responsive drawer |
| Navigation | `app/featureRegistry.ts`, feature `routes.tsx` files | Retain registry-driven permission filtering and route matching; group secondary destinations |
| Heading placement | `components/ui/PageHeader.tsx`, `pageSlots.ts`, shell title slot | Add opt-in content heading placement; preserve document titles and one semantic H1 |
| Working controls | `components/ui/DataTable.tsx`, `FilterBar.tsx`, `Tabs.tsx`, `Button.tsx`, `StatusChip.tsx` | Unframed table and compact toolbar variants; accessible segmentation and status labels |
| Overview | `features/dashboard/pages/BuyerDashboardPage.tsx`, dashboard components | Attention-first layout, calendar/deadline list, compact pipeline and renewals |
| Tenders | `features/tender-authoring/pages/TenderRegisterPage.tsx` | Spacious register, stage filters, concise row metadata |
| Approvals | `features/approvals/pages/ApprovalInboxPage.tsx`, `ApprovalDecisionPage.tsx`, approval components | Reusable decision content inside a responsive inbox/detail workspace |
| Evaluation | `features/evaluation/pages/EvaluationOverviewPage.tsx`, `components/EvaluationWorkspace.tsx` | Overall progress, reviewer list, bid summary and conditional commercial gate |
| Awards | `features/awards/components/AwardRegister.tsx`, award overview components | Register with expandable readiness; preserve separate closeout mode |
| Contracts | `features/contracts/pages/ContractRegisterPage.tsx`, `components/shared.tsx` | Upcoming decisions and a lean contract register |
| Copy | `i18n/en.ts`, corresponding `features/*/i18n/en.ts` | Concise localized labels, accurate summaries and state-dependent wording |

## Implementation sequence

### 1. Establish the baseline and data mapping

- Capture current six-screen behavior with existing personas and fixtures, including restricted roles and incomplete data.
- Map each visible element in the references to existing typed response fields, permissions, and actions before composing pages.
- Record missing data explicitly. Do not calculate global counts from a paginated subset or fabricate sparklines, dates, progress, or successful checks.
- Prefer existing data and commands. If a necessary aggregate is absent, document the smallest contract change separately; omit unsupported decorative information in the first implementation.
- Keep these PNG references as documentation assets, never as rendered application UI.

Deliverable: verified field/action mapping and baseline screenshots for comparison.

### 2. Build the buyer shell and visual foundation

- Add scoped buyer tokens and shared component variants; use the existing styling architecture.
- Make the labeled rail the desktop buyer default. Pin Overview, Tenders, Approvals, Evaluation, Awards, and Contracts only when authorized.
- Add an accessible “More” navigation surface for tasks, planning, documents, suppliers, reports, administration, and all other permitted destinations. Keep active nested routes identifiable and preserve notification badges.
- Move organization switching into the utility bar. Reuse existing search, notifications, help, account, and theme behavior.
- Make page-local H1 placement explicit. The current `PageHeader` portals its title into the top bar; changing CSS alone will not achieve the reference layout.
- Resolve section-action duplication: retain access to existing actions while showing one clear primary page action. Do not leave both utility-bar and page-local versions of the same action.
- Retain the prototype indication where applicable, skip link, main landmark, focus return, drawer dismissal, and tenant separation.

Deliverable: working buyer navigation and shell with unmigrated routes still usable.

### 3. Implement overview and tender register

**Overview:** Start with actionable items and deadlines. Show a prioritized short list with a route to all items. Combine permitted approval/attention information without double-counting it. Keep important exceptions, workload, complaints, renewals, and incomplete-value notices reachable through secondary sections. Do not claim “Everything else is moving” unless the data establishes that. Use real time and time-zone formatting. Show pipeline totals and stage counts only when authorized; render a trend only if a real historical series exists.

**Tenders:** Use a broad working table without an always-open inspector. Group status filters into a segmented control only where existing enums/query semantics support the mapping. Retain exact statuses in rows; simplified group labels must not erase distinctions such as opening versus assessment. Keep search, owner, saved views, advanced filters, sorting, pagination, and readiness warnings. Preserve source/lot/value/deadline context through row metadata or accessible disclosure. Do not implement the preview's grid toggle or selection toolbar without meaningful supported behavior; default to existing row navigation.

Deliverable: first two screens matching the approved composition with real data.

### 4. Implement the approval workspace

- Extract reusable approval detail presentation so the inbox can show a selected decision alongside its list while direct links continue to work.
- Preserve `/me/approvals/:approvalId` as an addressable record with correct browser back/forward behavior. Define selection through routing rather than hidden local-only state.
- On small screens, show the inbox or record as separate views with a clear back action. Protect unsaved decision text when changing selection.
- Preserve the inbox's existing cross-organization scope: display the selected record's organization explicitly and follow existing context/authority checks; the utility bar's active organization must not imply every approval belongs to it.
- Present requested amount, exact version, evidence, authority, funding, independence/conflicts, invalidation and routing in a readable order. A successful check appears only when its source data supports it.
- Keep existing allowed decisions, conditions, required reasons, confirmation dialog, duplicate-submit protection, mutation errors, and audit history. The mockup's inline controls do not authorize bypassing `DecisionDialog` or making required reasons optional.
- Use “To review / Sent / History” only if existing query capabilities support those views. Otherwise preserve current filters with the new visual treatment.

Deliverable: responsive inbox/detail layout with the same decision guarantees.

### 5. Implement evaluation, awards, and contracts

**Evaluation:** Introduce the submission summary and team progress list. Show fractions alongside dots; use a compact meter when assignment counts are large. Preserve incomplete, overdue, conflict, anonymous-bid, restricted-detail, and lot-specific states. Keep commercial, moderation, results, assignment, and plan routes available even though the illustration omits some tabs. Derive sealed/open status and available actions from the actual price gate; never hard-code all commercial bids as sealed or reveal hidden prices.

**Awards:** Use readable rows with explicit next actions and accessible inline readiness disclosure. Load authorized detail on expansion if the register lacks readiness data; avoid fetching full details for every row. Preserve per-lot outcomes, partial/cancelled awards, recommendation versions, standstill extensions, complaints, holds, final-award gates, and handover state. The stage summary is a filter/count view, not an editable stepper or a claim that every award follows one linear path. Do not restyle closeout mode accidentally or infer whole-register counts from the existing capped overview query.

**Contracts:** Put the next actionable dates above the register, ordered chronologically and using official deadlines. Keep search, owner/manager filters, renewal windows, sorting, pagination, assignments, and next decisions. Preserve status, remaining ceiling, award differences, overdue obligations, term dates, and renewal/extension distinctions through concise metadata or disclosure. Totals must respect currency boundaries and authorization. “Prepare contract” must reuse the existing permitted creation flow.

Deliverable: three remaining experiences implemented with accurate business states.

### 6. Validate, refine, and prepare review

- Compare rendered screens against the saved references at 1440px and 1600px widths, judging composition, typography, spacing, restraint, and reading order rather than generated sample text.
- Check 1024px, 768px, and 390px widths, 200% zoom, long names, large amounts, translated-length labels, and dense records.
- Below tablet widths, collapse secondary columns; use the existing accessible drawer pattern for navigation. Keep any necessary table overflow contained within its region and preserve useful record identity and actions.
- Verify keyboard navigation, visible focus, semantic tables, selected states, disclosure announcements, label contrast, reduced motion, and loading/error/empty states. Small colored dots must never be the only state indication.
- Update existing shell, component, route, and feature tests for changed interactions. Add focused tests for new behaviors rather than snapshot tests that merely mirror markup.
- Run the repository's UI checks: `npm run typecheck:ui`, `npm run lint:ui`, `npm run test:ui`, and `npm run build:ui`.
- Run relevant Playwright coverage with `npm run test:e2e:prototype`, including shell, layout, accessibility, and walkthrough flows. Confirm the configured environment before running it.
- Run server/contract checks as well if implementation actually changes those layers. Do not change contracts solely to satisfy decorative preview elements.
- Capture final screenshots for each screen, including critical restricted/error states, and document any deliberate deviations from the concept images.

## Completion criteria

- All six experiences follow the approved white/silver/blue direction and substantially different layouts.
- Buyer navigation remains complete and permission-aware; direct links, back/forward navigation, and responsive layouts work.
- Existing decisions and workflows retain validation, authority checks, versioning, sealed-data restrictions, and audit history.
- No fabricated metrics, tenant identities, dates, or unavailable actions from the mockups enter production UI.
- Shared-component changes do not regress supplier, operations, public, or unmigrated buyer experiences; theme preference remains usable.
- Relevant checks pass, and rendered screenshots demonstrate visual fidelity and legibility.

## Suggested delivery slices

1. Scoped visual foundation, shell, and content headings.
2. Overview and tender register.
3. Approval inbox and decision workspace.
4. Evaluation workspace.
5. Award and contract registers.
6. Responsive/accessibility refinement and final visual review.

Each slice should be reviewable with real fixture data and screenshots. Application implementation begins only after a subsequent instruction to code; this planning task does not start it.

## Implementation notes (branch `design1`, 31 Oct 2026)

Status: implemented on `design1` (based on `static`, so Vercel can build a preview) and pushed for a preview deployment only. Not merged into `static` or `main`.

### What was built

- **Presentation variant.** `AppShell` sets `data-presentation="buyer"` on `<html>` while a buyer organization is active (tenant context, not pathname), so the `/me` pages take the buyer look too. Supplier, operator and public surfaces keep the default shell. Tokens: `theme/tokens.css` (light + dark buyer palette), primitives: `theme/buyer.css`, per-screen rules: `theme/pages/*.css`.
- **Shell.** Labelled 88px rail (`BuyerRail`) pinning Overview, Tenders, Approvals, Evaluations, Awards, Contracts when permitted; every other destination lives in the accessible "More" menu (grouped by section, badges kept, "More" marked current on nested routes). Utility bar: organization switcher (`OrgSwitcher`, enters an organization in place with the same `selectTenant` flow as COM-02), centred search, personal icons. The utility bar shows no actions: the destination's section action (DD-46) renders in the page head, as the primary action or, when the page has its own, as a secondary one. Below 768px the drawer shows the full grouped list.
- **Headings.** `PageHeader` renders a content H1 in the buyer presentation (`headline` + plain `title` as eyebrow, so "Approvals" stays discoverable under "A few things need your say."). Record headers (with meta) use a smaller title and a fixed actions row so tabs line up across a record (DD-46).
- **Shared variants.** `Tabs`/`LinkTabs variant="segmented"`, `DataTable variant="plain"`, `FilterBar variant="panel"` + `Toolbar`/`FilterDisclosure`, and new primitives: `Section`, `WorkList`/`WorkRow`, `IconTile`/`Avatar`/`Person`/`StatusLabel`/`CheckList`/`Attention`, `ProgressDots`/`Meter`/`BigCount`/`Stat`/`StageGlance`, `DateBadge`, `DisclosureToggle`/`DisclosurePanel`, `NumberedSteps`/`StageSummary`/`Milestones`/`ApprovalPath`, `Columns`/`Split`/`Callout`.
- **Screens.** All six per §3–§5; captures at 1440px (plus the overview in dark mode and at 390px) are in `captures/`.

### Deliberate deviations from the concept images

- No fabricated figures: no pipeline sparkline (no historical series), stage counts on the award register only when the whole register is loaded (the 100-row overview query reports `total`), tender phase counts only because `statusCounts` is whole-register by contract.
- Tenders: no grid/list toggle and no selection toolbar (no supported behaviour); segmented labels are the existing phases (In preparation / In market / Assessment / Award / Closed), exact statuses stay on every row.
- Approvals: no inline decision note; every decision goes through `DecisionDialog` with its required reason, so nothing unsaved exists outside the dialog. An extra "All" view precedes To review / Sent / History so blocked pending approvals stay visible.
- Evaluation: the sealed-prices callout derives from the real price gate (closed / released / not applicable); the chair keeps the release action.
- Awards: rows show "n of m lots decided/proposed" instead of a supplier name (the register row carries none); the award progress panel is built from register fields only ("Not started" where the row has nothing). The closeout register keeps its own structure.
- Contracts: "Coming up" lists the next dated decisions of the contracts on the current page (there is no cross-page feed) and says so; "obligations need attention" is text, not a link (no such filter exists).
- Overview: deadlines under "Today/Tomorrow" still carry the full official deadline (DD-33); the previous cards (attention, workload, approvals, renewals, KPI figures) stay reachable in a "More detail" section.

### Verification

`npm run typecheck`, `typecheck:ui`, `lint`, `lint:ui`, `build:ui` pass; `test:ui` passes except 7 pre-existing SHA-256 upload tests that also fail on `static` in this environment. Playwright `shell.spec.ts`, `layout.spec.ts` and the buyer persona part of `a11y.spec.ts` (axe in both themes, phone width, route error page) pass; the specs were updated for the utility bar, the rail and the content headings.
