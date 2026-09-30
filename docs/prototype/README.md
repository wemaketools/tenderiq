# TenderIQ prototype (Stage A): review guide

This folder is the owner's review pack for the **Stage A UI prototype**. Stage B (the real backend) starts only after your explicit written approval of this prototype (architecture plan §0).

| File | What it is |
|---|---|
| `README.md` (this file) | How to run the prototype, who to sign in as, what is and is not real, a guided tour, acceptance scenarios, known limitations, and the approval checklist and feedback template |
| [`walkthrough.md`](walkthrough.md) | Every in-scope screen ID (118 screens) with its persona, URL, what it demonstrates, what to evaluate, and a screenshot |
| `screens/*.jpg` | 163 screenshots named `<SCREEN-ID>--<persona>[--<state>].jpg`, taken by `e2e_tests/specs/prototype/walkthrough.spec.ts` |

## 1. How to run it

Prerequisites: Node 24, npm 11, **Docker Desktop running**. The full runbook is [`docs/local-development.md`](../local-development.md).

```bash
npm install                 # once
npm run supabase:start      # local Supabase stack in Docker (Auth, Postgres, Studio, Mailpit)
npm run auth:personas       # creates or updates every demo account, password test1234
npm run dev:prototype       # mock API on 127.0.0.1:3001 + SPA on http://localhost:5173
```

On Windows, `.\run.ps1` does all of this in one step.

1. Open **http://localhost:5173**. The public portal opens without an account.
2. Choose **Sign in**. The **Demo accounts** list on the sign-in page (local development only) fills in the email and password of any persona. Every password is `test1234`.
3. **Password reset:** use "Forgot password" on the sign-in page, then open **Mailpit at http://127.0.0.1:54324** to read the email and follow its link. Emails never leave your machine.
4. Switch persona with the account menu (bottom left) → **Sign out**, then sign in again. A person with several organizations (`sam.dual`) uses **Switch organization** in the same menu.
5. Stop with Ctrl+C; `npm run supabase:stop` stops the Docker stack.

To regenerate the screenshots: `npm run test:e2e:prototype -- walkthrough.spec.ts`. It starts its own servers on the prototype ports and never touches 3001 or 5173.

## 2. Personas

Every address ends in `@tenderiq.local`; every password is `test1234`. KWU = Kalahari Water Utilities (Pilot), the demo buyer (BWP, Africa/Gaborone).

| Email (local part) | Organization | Role | What to try |
|---|---|---|---|
| `tebogo.officer` | KWU | Procurement officer, tender owner | Requests, tenders T-2026-0001…0014, publication, Q&A and addenda, submissions monitoring, selection, awards |
| `mpho.manager` | KWU | Procurement manager (approval limit BWP 2,000,000) | Dashboard, approvals (`/me/approvals/37`), planning, shortlist, due diligence, reports; try approving PR-2026-0003, which exceeds the limit (AC-05) |
| `kagiso.requester` | KWU | Requester | Create and follow procurement requests |
| `onalenna.budget` | KWU | Budget owner | Funding confirmation on requests |
| `keabetswe.approver` | KWU | Award approver (BWP 10,000,000) | PR-2026-0003 decision, award recommendations |
| `neo.assessor` | KWU | Qualification assessor | Qualification queue and Makgadikgadi's application (AC-08) |
| `lesego.finance` | KWU | Financial reviewer | Financial evidence clarification (AC-08) |
| `boitumelo.chair` | KWU | Evaluation chair | Compliance of T-2026-0003, clarification coordination, moderation, ranking report |
| `amantle.eval`, `thato.eval`, `kabo.eval` | KWU | Evaluators | Individual assessment of T-2026-0003 (Amantle has one criterion unscored, AC-18) |
| `refilwe.commercial` | KWU | Commercial reviewer | Commercial comparison after the price gate (AC-19) |
| `oratile.opener`, `goitse.witness` | KWU | Opening officer, opening witness | Opening of the sealed T-2026-0008 |
| `dineo.legal` | KWU | Legal counsel | Complaints, holds, debriefs (AC-25) |
| `masego.contracts` | KWU | Contract manager | Contracts C-2026-0001 (active), C-2026-0002 (awaiting signature), C-2025-0007 (expired) |
| `pule.auditor` | KWU | Internal auditor | Audit, retention and legal holds (AC-35); read-only elsewhere |
| `admin.kwu` | KWU | Organization administrator only | Organization, users, roles, policy, calendars; try `/buyer/opening/tenders/8`: sealed bids stay out of reach (AC-15) |
| `former.officer` | KWU | Departed procurement officer (deactivated) | The account is refused access (the API answers 401 and the SPA signs out); historic approvals stay attributed (AC-04) |
| `admin.odc`, `officer.odc` | Okavango District Council | Administrator, procurement officer | A second buyer that never sees KWU data (BR-45); T-2026-0011 |
| `tsodilo.admin`, `.bidmanager`, `.contributor`, `.signatory` | Tsodilo Engineering | Supplier admin, bid manager, contributor, authorized signatory | Supplier dashboard, opportunities, responses, receipts, outcome of T-2026-0001, contract C-2026-0001; the contributor cannot submit (AC-03) |
| `chobe-pipe.admin`, `.bidmanager`, `.contributor`, `.signatory` | Chobe Pipe & Valve | Supplier roles | Evidence library with expiring insurance (AC-09), invitation to T-2026-0006 |
| `serowe-ict.admin`, `.bidmanager`, `.contributor`, `.signatory` | Serowe ICT Solutions | Supplier roles | Internally approved but not submitted response on T-2026-0002 (AC-11); submit it as the signatory; assessment requests, negotiation |
| `gaborone-meter.admin`, `.bidmanager`, `.contributor`, `.signatory` | Gaborone Metering | Supplier roles | Failed replacement that keeps the earlier receipt (AC-12) |
| `makgadikgadi.admin` | Makgadikgadi Civil Works | Supplier admin | Registered but not qualified (AC-07); qualification awaiting information (AC-08) |
| `limpopo-env.admin` | Limpopo Environmental Services | Supplier admin | Complaint CMP-2026-0002 on T-2026-0007 (AC-25) |
| `sam.dual` | KWU + Tsodilo + Chobe | Evaluator at KWU, contributor at both suppliers | Organization chooser, pending membership, switching capacity (AC-02) |
| `ops.admin` | TenderIQ Platform Operations | Platform operator | Customers, onboarding and exit (AC-36), subscriptions, incidents, oversight, content |
| `support.agent` | TenderIQ Platform Operations | Support agent | Support cases and time-limited access grants; no sealed-bid access (AC-15) |

## 3. What is real and what is static

| Real | Static |
|---|---|
| Sign-in, sign-out, token refresh and password reset against the **local Supabase Auth** in Docker (DD-43) | All business data: fixtures in `src/mock-api/fixtures/**` built from the demo storyline (`docs/plan/demo-storyline.md`) |
| The mock API checks the real JWT, maps the account to its persona, and enforces tenant isolation (one identical 403), permissions and response contracts | **Nothing persists.** Commands (approve, submit, publish, save…) are validated against the contract and return a realistic static outcome (for example a fixture receipt), shown in the UI; a reload shows the original data again |
| Every screen, navigation entry, filter, form validation and confirmation dialog of the final product | The clock: the storyline "now" is **6 Oct 2026, 08:00 UTC** (10:00 in Gaborone), so deadlines and countdowns never move |
| Light and dark themes, keyboard use and accessibility checks (axe) | Uploads and downloads use fixture documents |

The yellow banner **"Prototype — static demo data"** is shown on every page served by the mock API.

## 4. Guided tour: the 16-step lifecycle (PRD §6)

Follow one procurement world from need to contract. The screen IDs link to [`walkthrough.md`](walkthrough.md).

| # | Step | Sign in as | Where to go | What you will see |
|---|---|---|---|---|
| 1 | Buyer identifies a need | `kagiso.requester`, then `keabetswe.approver` | Requests → PR-2026-0003 (BUY-02, BUY-03); `/buyer/requests/3/decision` (BUY-04) | A business case beyond the manager's authority routed to the award approver (AC-05) |
| 2 | Decide how to approach the market | `mpho.manager`, `tebogo.officer` | Procurement plan (BUY-05), Strategy (BUY-06); public `/plans` (PUB-06) | Plan items, advance notices, the multi-stage strategy of T-2026-0009; the RFI T-2026-0004 ends without a purchase (AC-39) |
| 3 | Prepare the tender documents | `tebogo.officer` | Tenders → T-2026-0003 and T-2026-0005 (BUY-07…BUY-13) | Scope, pricing, evaluation plan, timetable in the official zone; T-2026-0005's release approval invalidated by a later change (AC-06) |
| 4 | Issue the tender | anonymous, then `tebogo.officer` | `/opportunities` (PUB-01…03); Publication (BUY-14, BUY-15) | Public notice; invitation-only T-2026-0006 absent from the portal (AC-01); failed Gazette publication (AC-33) |
| 5 | Suppliers study and decide | `tsodilo.bidmanager` | Opportunities, Invitations, Pursuits (SUP-06…SUP-09) | Discovery, the T-2026-0006 invitation, bid/no-bid |
| 6 | Questions, clarifications, amendments | `tsodilo.bidmanager`, `tebogo.officer` | Questions & addenda (SUP-10, BUY-16, BUY-17); `/clarifications/kwu/T-2026-0002` (PUB-04) | Addendum 2 adds a mandatory requirement after two submissions (AC-10) |
| 7 | Suppliers prepare bids | `tsodilo.bidmanager`, `tsodilo.contributor` | Responses → T-2026-0006 draft (SUP-12…SUP-15) | Answers, pricing, declarations, internal approval; the contributor cannot submit (AC-03) |
| 8 | Submit before the deadline | `tsodilo.bidmanager`, `serowe-ict.signatory`, `tebogo.officer` | Submit tab (SUP-16), Receipts (SUP-17), Submissions (BUY-19) | Readiness with blocking errors; "Not submitted" after internal approval (AC-11); failed replacement and late attempt (AC-12, AC-13); withdrawal (AC-14) |
| 9 | Check compliance | `oratile.opener`, `boitumelo.chair`, `admin.kwu` | Opening (BUY-20), Compliance (BUY-21) | Sealed T-2026-0008 refused to the administrator (AC-15); REQ-Q-03 failure and exclusion (AC-17) |
| 10 | Evaluate against weighted criteria | `amantle.eval`, `refilwe.commercial`, `boitumelo.chair` | My evaluations, Evaluations → T-2026-0003 (EVA-01…EVA-06) | Staged price access (AC-16), a missing score not counted as zero (AC-18), the §9 worked example 86 vs 88 (AC-19), moderation history (AC-20) |
| 11 | Demonstrations, interviews, references | `tebogo.officer`, `serowe-ict.bidmanager` | Selection → Demonstrations (BUY-22), Assessment requests (SUP-18) | Recorded assessments on the announced basis (AC-21) |
| 12 | Shortlist | `mpho.manager` | Selection → Shortlists (BUY-23) | Approved stage-1 shortlist of T-2026-0009 (AC-22) |
| 13 | Preferred bidder | `tebogo.officer`, `keabetswe.approver` | Preferred bidders (BUY-24), Awards → recommendation (BUY-26) | Conditional preferred status; per-lot award of T-2026-0001 (AC-26) |
| 14 | Due diligence and negotiation | `mpho.manager`, `serowe-ict.bidmanager` | Due diligence (BUY-25), Final offers (BUY-27), Negotiations (SUP-19) | Failed diligence with fallback (AC-24); final offers blocked where negotiation is not permitted (AC-23) |
| 15 | Award | `tebogo.officer`, `dineo.legal`, `limpopo-env.admin`, `tsodilo.bidmanager` | Awards → T-2026-0007 (BUY-28), Debriefs & complaints (BUY-29), Outcomes (SUP-21, SUP-22), Contracts → C-2026-0002 (CON-02, CON-03) | Standstill with a complaint hold (AC-25), debrief (AC-27), contract differing from the award (AC-28) |
| 16 | Deliver and manage the contract | `masego.contracts`, `tsodilo.admin` | Contracts → C-2026-0001 (CON-04…CON-11, SUP-23) | Handover (AC-29), rejected milestone evidence (AC-30), cumulative changes beyond authority (AC-31), renewal window without decision (AC-32), closeout with a surviving warranty |

Qualification runs alongside: `makgadikgadi.admin` (SUP-20), `neo.assessor` and `lesego.finance` (BUY-33…BUY-35), `chobe-pipe.admin` (SUP-05, SUP-24).

## 5. Acceptance scenarios you can demonstrate

The PRD §23 scenarios in scope (AC-01…AC-36 and AC-39). In Stage A each is **shown** on static data; Stage B makes them true on live data. AC-37 and AC-38 belong to deferred extensions and are not in the prototype.

| AC | Scenario | Persona | Where |
|---|---|---|---|
| AC-01 | Public vs invitation-only events | anonymous; `tsodilo.bidmanager` | `/opportunities` (T-2026-0006 absent); `/supplier/invitations/604` |
| AC-02 | One person, three organizations | `sam.dual` | `/select-organization`, account menu → Switch organization |
| AC-03 | Contributor without submission authority | `tsodilo.contributor` | `/supplier/responses/14/submit`; `/supplier/admin/access/authority` (as `tsodilo.admin`) |
| AC-04 | Departed employee | `former.officer`; `admin.kwu` | Access refused; `/buyer/admin/access/users` |
| AC-05 | Request beyond a manager's authority | `mpho.manager`, `keabetswe.approver` | `/buyer/requests/3/decision` |
| AC-06 | Change after release approval | `tebogo.officer` | `/buyer/tenders/5/release` |
| AC-07 | Registered but not qualified | `makgadikgadi.admin` | `/supplier/qualification` |
| AC-08 | Unclear financial evidence | `neo.assessor`, `lesego.finance` | `/buyer/qualification/applications/503` |
| AC-09 | Insurance expiring during assessment | `chobe-pipe.admin`; `mpho.manager` | `/supplier/evidence`, `/supplier/qualification/decisions`; `/buyer/qualification/monitoring` |
| AC-10 | Addendum after submissions | `tebogo.officer`; `tsodilo.bidmanager` | `/buyer/clarifications/addenda/22`; `/supplier/opportunities/2` |
| AC-11 | Internally approved, not submitted | `serowe-ict.bidmanager` | `/supplier/responses/7/submit` |
| AC-12 | Failed replacement keeps the earlier receipt | `gaborone-meter.bidmanager`; `tebogo.officer` | `/supplier/responses/4/receipts`; `/buyer/submissions/2` |
| AC-13 | Late completion rejected | `tebogo.officer` | `/buyer/submissions/2` (Chobe's late attempt) |
| AC-14 | Explicit withdrawal | `tsodilo.bidmanager`; `oratile.opener` | `/supplier/responses` (T-2026-0008 withdrawn); `/buyer/opening/tenders/8` |
| AC-15 | Administrator or support cannot open sealed bids | `admin.kwu`, `support.agent` | `/buyer/opening/tenders/8`, `/buyer/submissions/8`; `/ops/support/grants` |
| AC-16 | Price gate after non-price assessment | `amantle.eval`, `boitumelo.chair` | `/buyer/evaluation/assignments/3003/assessment`; `/buyer/opening/tenders/3` |
| AC-17 | Mandatory requirement failed | `boitumelo.chair` | `/buyer/compliance/bids/3003`, `/buyer/compliance/exclusions/5101` |
| AC-18 | Unscored criterion | `amantle.eval` | `/buyer/evaluation/assignments/3003/assessment` |
| AC-19 | PRD §9 worked example (86 / 88) | `refilwe.commercial`, `boitumelo.chair` | `/buyer/evaluation/tenders/3/commercial`, `/buyer/evaluation/tenders/3/results` |
| AC-20 | Moderation changes a result | `boitumelo.chair` | `/buyer/evaluation/tenders/3/moderation` |
| AC-21 | Demonstration or reference affects selection | `tebogo.officer` | `/buyer/selection/assessments?tenderId=9`, `/buyer/selection/references` |
| AC-22 | Shortlist to a further stage | `mpho.manager` | `/buyer/selection/shortlists/9` |
| AC-23 | Final offer where negotiation is not permitted | `mpho.manager` | `/buyer/selection/final-offers/1` |
| AC-24 | Preferred bidder fails due diligence | `mpho.manager`, `tebogo.officer` | `/buyer/selection/due-diligence/1`, `/buyer/selection/preferred-bidders/1` |
| AC-25 | Complaint creates a blocking hold | `tebogo.officer`, `dineo.legal`, `limpopo-env.admin` | `/buyer/awards/7`, `/buyer/award-cases/complaints/92`, `/supplier/complaints/92` |
| AC-26 | Awarded, cancelled and evaluating lots | `keabetswe.approver`; anonymous | `/buyer/awards/1`; `/awards/kwu/T-2026-0001` |
| AC-27 | Debrief for an unsuccessful supplier | `tsodilo.bidmanager`; `dineo.legal` | `/supplier/outcomes` (T-2026-0007); `/buyer/award-cases` |
| AC-28 | Contract differs from the award | `masego.contracts` | `/buyer/contracts/2/preparation`, `/buyer/contracts/2/signature` |
| AC-29 | Closure before handover acceptance | `masego.contracts`; `tebogo.officer` | `/buyer/contracts/1/handover`; `/buyer/closeout` |
| AC-30 | Rejected milestone evidence | `masego.contracts` | `/buyer/contracts/1/milestones` |
| AC-31 | Changes exceed cumulative authority | `masego.contracts` | `/buyer/contracts/1/changes` |
| AC-32 | Renewal deadline without decision | `masego.contracts` | `/buyer/contracts/1/renewals` |
| AC-33 | External publication failure | `admin.kwu`; `tebogo.officer` | `/buyer/admin/service/exceptions`; `/buyer/tenders/2/publication` |
| AC-34 | Report counts with lots and revisions | `mpho.manager` | `/buyer/reports/participation` |
| AC-35 | Legal hold on expired records | `pule.auditor`, `mpho.manager` | `/buyer/admin/records/holds`, `/buyer/admin/records/disposals/1` |
| AC-36 | Customer exit with live work | `ops.admin`; `admin.odc` | `/ops/offboarding/1`; `/buyer/admin/service/subscription` |
| AC-39 | RFI without a purchase | `tebogo.officer` | `/buyer/tenders/4`, `/buyer/strategies/503` |

## 6. Known limitations of the prototype

- **Nothing is saved.** Every action shows its realistic result (a receipt, an approval outcome, a toast), but the next page load shows the storyline data again. Multi-step flows therefore cannot be chained (for example, submitting and then seeing the new receipt in the list).
- **The clock is frozen** at 6 Oct 2026, 08:00 UTC. Countdowns, overdue chips and waiting periods are computed against that instant.
- **Emails:** only Supabase Auth's password-reset email is sent (to Mailpit). Invitation, registration and business notification emails arrive in Stage B, when the real API sends them (DD-44).
- **Invitation links** (`/invite/:token`) and the claim link of a provisional supplier work only for the fixture invitations; no email delivers them in Stage A.
- **Documents** are fixture files. Upload controls validate the file and return the static outcome; nothing is stored.
- **Search** covers the fixture world only.
- **Deferred extensions** (PRD §22): frameworks and call-offs (CON-12, AC-37), joint procurement, reverse auctions, assisted content review (AC-38) and construction-specific schedules are not in the product and have no links.
- The **Demo accounts** list on the sign-in page exists only in local development builds; production builds never contain it.
- Screenshots in `screens/` are cut at 3,200 px height for readability; open the live page to see very long pages in full.

## 7. Approval checklist

Tick each line, or record a change request with the template below.

- [ ] The prototype starts with the commands in §1, and every persona in §2 can sign in.
- [ ] Every screen in [`walkthrough.md`](walkthrough.md) shows the information and actions the PRD screen tables require (Required information / Principal actions).
- [ ] The public portal hides invitation-only events and never shows other suppliers' or buyers' data (AC-01, BR-45).
- [ ] The current organization and capacity are always clear, and consequential actions confirm organization, capacity, scope and result (COM-02, AC-02).
- [ ] Official deadlines always show the official time zone, for example `14 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone` (DD-33).
- [ ] Submission is unmistakable: only an official receipt means "submitted"; readiness warnings, blocking errors and completed decisions look different (AC-11…AC-14).
- [ ] Sealed bids are out of reach for administrators and support, and prices stay hidden until the price gate (AC-15, AC-16).
- [ ] The evaluation screens reproduce the PRD §9 worked example and never count a missing score as zero (AC-18, AC-19).
- [ ] Holds, complaints and waiting periods visibly block award and signature (AC-25).
- [ ] Contract management covers handover, milestones, performance, finances, changes, renewal and closeout (CON-01…CON-11).
- [ ] Administration, records and platform operations screens cover the settings and controls you expect (ADM, OPS).
- [ ] Visual style matches the reference in `docs/screenshots` in the light and dark themes.
- [ ] Wording and terminology suit the users (Botswana public procurement, English).
- [ ] The contracts in `src/contracts` (see `docs/technical/api/openapi.json`) may become the Stage B hand-off.

**Decision:** ☐ Stage A approved, Stage B may start ☐ Changes requested (list below)

Signed: ______________________ Date: ______________

## 8. Feedback template

Copy one block per finding. The screen ID and persona let the UI-iteration workflow reproduce it exactly.

```markdown
### <short title>
- Screen: <SCREEN-ID> (for example BUY-19)
- Persona: <email local part> (for example tebogo.officer)
- URL: <path> (for example /buyer/submissions/2)
- Type: missing information | missing action | wrong behaviour | wording | visual | new idea
- Priority: must fix before approval | should fix | later
- What I see:
- What I expect:
- PRD reference (if any): <FR/BR/AC/section>
```
