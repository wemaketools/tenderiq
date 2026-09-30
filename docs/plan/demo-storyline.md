# TenderIQ — Demo Storyline (single source for Stage A fixtures and Stage B seeds)

This one story drives **Stage A** static fixtures (`src/mock-api/fixtures/<domain>.ts`) and **Stage B** demo seed modules (`scripts/db/demo/NN-<domain>.ts`). The stakeholder-approved prototype and the live system therefore show the same world. The data must populate every screen and make every in-scope acceptance scenario demonstrable from the UI.

- Each domain writes **only its own fixtures/tables**. It uses the natural keys below (tenant slugs, user emails, tender/contract references).
- **Stage A fixtures** are typed against `src/contracts` and validated by the contract schemas. A cross-fixture consistency test checks that every reference resolves across domains.
- **Stage B seed modules** run in numeric order, are idempotent (look up by natural key, skip what exists), and refuse to run against production (brief §6.4).
- All personas use password `test1234`. They are real accounts in the local Supabase Auth (Docker) from Stage A, created by `npm run auth:personas` (DD-43).

## Organizations (tenants)

| Slug | Kind | Name | Notes |
|---|---|---|---|
| `tenderiq-ops` | operator | TenderIQ Platform Operations | created by `db:admin:create` / 00-platform |
| `kwu` | buyer | Kalahari Water Utilities (Pilot) | BWP, Africa/Gaborone, calendar "Botswana Public Holidays 2026", legal entity "Kalahari Water Utilities Corporation" |
| `odc` | buyer | Okavango District Council | second buyer, used to prove cross-buyer segregation (BR-45) |
| `tsodilo` | supplier | Tsodilo Engineering (Pty) Ltd | qualified (pumps & mechanical) |
| `chobe-pipe` | supplier | Chobe Pipe & Valve Supplies | qualified with conditions (insurance expiring → AC-09) |
| `makgadikgadi` | supplier | Makgadikgadi Civil Works | registered, **not** qualified for WTR-PUMP (AC-07) |
| `serowe-ict` | supplier | Serowe ICT Solutions | SCADA/ICT bidder |
| `limpopo-env` | supplier | Limpopo Environmental Services | RFI participant, complainant (AC-25) |
| `gaborone-meter` | supplier | Gaborone Metering Co. | water-meter RFQ bidder |

## Personas (`@tenderiq.local`)

- Operator: `ops.admin` (platform_operator), `support.agent` (support_agent)
- KWU: `admin.kwu` (org_admin only, used to prove no sealed access, AC-15), `mpho.manager` (procurement_manager, approval limit BWP 2,000,000), `tebogo.officer` (procurement_officer, tender owner), `kagiso.requester` (requester), `onalenna.budget` (budget_owner), `neo.assessor` (qualification_assessor), `lesego.finance` (financial_reviewer), `boitumelo.chair` (evaluation_chair), `thato.eval`, `kabo.eval`, `amantle.eval` (evaluators), `refilwe.commercial` (commercial_reviewer), `oratile.opener` (opening_officer), `goitse.witness` (opening witness), `dineo.legal` (legal_reviewer), `keabetswe.approver` (award_approver, BWP 10,000,000), `masego.contracts` (contract_manager), `pule.auditor` (auditor)
- ODC: `admin.odc`, `officer.odc`
- Suppliers: `<name>.admin`, `<name>.bidmanager`, `<name>.contributor`, `<name>.signatory` for tsodilo, chobe-pipe, serowe-ict, gaborone-meter. Plus admins for the others.
- **Dual-capacity person** `sam.dual`: member of `kwu` (evaluator) **and** `tsodilo` (contributor) **and** `chobe-pipe` (contributor). Demonstrates AC-02. The conflict is routed for review on T-2026-0003.
- **Departed employee** `former.officer` (deactivated, has historic approvals and submissions, AC-04).

## Tenders (buyer `kwu` unless noted)

| Ref | Title | Type / procedure | State to seed | Demonstrates |
|---|---|---|---|---|
| T-2026-0001 | Borehole pump replacement programme (3 lots) | tender / open | Lot 1 awarded (Tsodilo), Lot 2 cancelled, Lot 3 under evaluation → tender `partially_awarded` | AC-26, per-lot status |
| T-2026-0002 | Smart water meter supply | rfq / open | `open`. 3 submissions, an addendum after 2 of them (new mandatory requirement, acknowledge + supplement), Gaborone Metering has a failed replacement attempt and an earlier effective receipt, Chobe has a late attempt recorded and rejected | AC-10, AC-12, AC-13 |
| T-2026-0003 | SCADA telemetry upgrade | rfp / open, staged opening | `under_assessment`: technical opened, price gate released, 2 bids scored reproducing PRD §9.2 (Supplier A = Serowe 86.00, Supplier B = Tsodilo 88.00, evaluated cost 100,000 vs 120,000), one evaluator missing a criterion, moderation changed one score | AC-16, AC-18, AC-19, AC-20 |
| T-2026-0004 | Leak-detection market consultation | rfi / rfi | `information_collected`, market findings + linked next-step decision to T-2026-0009 | AC-39 |
| T-2026-0005 | Water treatment chemicals framework (draft) | tender / open | `awaiting_release_approval`, then a scope/value edit invalidated the approval | AC-06 |
| T-2026-0006 | Chlorine dosing equipment | rfq / invitation_only | `open`, invited Tsodilo + Chobe only, invisible to public | AC-01 |
| T-2026-0007 | Reservoir rehabilitation works | tender / open | `award_pending`: intent notice issued, standstill running, Limpopo complaint (blocking hold) | AC-25, AC-27 (debrief) |
| T-2026-0008 | Pipeline valves bulk supply | tender / open | `closed` awaiting opening, 2 sealed submissions (one withdrawn), admin/support cannot read | AC-14, AC-15 |
| T-2026-0009 | Acoustic leak detection services | rfp / restricted, multi-stage | `under_assessment`: shortlist approved (2 of 3), demos held, preferred bidder failed due diligence → fallback recorded, BAFO blocked on a variant with negotiation not permitted | AC-21..AC-24 |
| T-2026-0010 | Fleet vehicle maintenance | rfq / open | `awarded` with accepted handover → contract C-2026-0001 | AC-28, AC-29 |
| T-2026-0011 | Office cleaning services (ODC) | rfq / open, buyer `odc` | `open` | cross-buyer segregation |

## Requests and planning

PR-2026-0001…0012 cover every request status (draft, submitted, under_review, information_requested, approved, rejected, withdrawn, deferred, converted, routed_to_existing, rescinded, closed). PRD §8.1 "abandoned" is represented by withdrawn. PR-0003 exceeds `mpho.manager`'s limit and is routed to `keabetswe.approver` (AC-05). PR-0006 is combined into PR-0005. Seed plan items for 2026 Q4 and 2027 Q1, with two published advance notices.

## Qualification

Program "Water Infrastructure Suppliers — Category A", scoped to the parent category WTR-INFRA (which covers WTR-PUMP and WTR-PIPE; category scope includes descendants, DD-26). Tsodilo is qualified. Chobe is qualified with conditions, and its insurance evidence expires within the next 10 days (AC-09). Makgadikgadi has an application in `more_info_required` with an unclear financial statement and an info request from `lesego.finance` (AC-08). Also seed one expired decision and one suspended decision.

## Contracts

- C-2026-0001 Fleet maintenance (T-0010): `active`. Milestone "Q3 service report" evidence **rejected** with remediation (AC-30). Three change requests whose cumulative value exceeds the officer's authority (AC-31). A renewal option whose notice window opens in 5 days with no decision (AC-32). Performance review shared with the supplier, and the supplier disputes it.
- C-2026-0002 Borehole pumps Lot 1 (T-0001): `awaiting_signature`, and differs from the award (AC-28).
- C-2025-0007 Legacy meter reading (imported, origin "Legacy spreadsheet 2025"): `expired` with a surviving warranty obligation.

## Additional scenario anchors

- **AC-11 (saved and internally approved, not submitted):** Serowe ICT’s response on T-2026-0002 is `approved_internally` and has no receipt. The UI shows it as "Not submitted".
- **AC-17 (mandatory requirement failed):** on T-2026-0003, Makgadikgadi’s bid fails mandatory requirement REQ-Q-03 (ISO 9001 certificate). A compliance check cites the evidence, an exclusion is awaiting approval, and its commercial envelope stays sealed.
- **AC-34 (report counts):** the participation report counts unique organizations for T-2026-0001 (3 lots) and T-2026-0002 (several revisions per supplier), showing event-level and lot-level counts separately with the BWP currency basis stated.

## Records and operations

A legal hold on T-2025-legacy records whose retention has expired, so disposal is blocked (AC-35). One external-publication integration exception is open (AC-33). ODC has a customer offboarding plan in `draft` with a live tender and contract (AC-36). Seed two support cases, one of them with an authorized, time-limited support access grant. Seed one resolved service incident linked to T-2026-0002, plus help articles for every PUB-07 topic.
