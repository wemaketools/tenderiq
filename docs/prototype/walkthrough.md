# TenderIQ prototype walkthrough

Screen-by-screen guide for the Stage A approval review. Every in-scope screen ID (118 screens: COM-01…09, PUB-01…07, SUP-01…24, BUY-01…35, EVA-01…06, CON-01…11, ADM-01…17, OPS-01…07, REP-01…02) appears below with the persona to sign in as, its URL, what it demonstrates, what to evaluate and a screenshot. How to start the prototype, the persona table and the approval checklist are in [README.md](README.md).

- There are no passwords (DD-50). Sign in at http://localhost:5173/signin by choosing the persona in the sign-in page's persona picker.
- Addresses are `<persona>@tenderiq.local`. KWU = Kalahari Water Utilities (Pilot), the demo buyer.
- The demo "now" is **6 Oct 2026, 08:00 UTC** (10:00 in Africa/Gaborone). Data is static: actions show their realistic result but nothing is saved.
- Screenshots are taken by `e2e_tests/specs/prototype/walkthrough.spec.ts` at 1600 px width with the browser in Europe/London, so official deadlines also show a "your time" line. Long pages are cut at 3,200 px. Extra captures show the dark theme and key states.
- Requirement references: FR/BR = PRD functional requirements and business rules, AC = PRD §23 business acceptance scenarios, DD = design decisions.

## Contents

- [Public](#public)
- [Every signed-in user](#every-signed-in-user)
- [Supplier](#supplier)
- [Buyer](#buyer)
- [Evaluator](#evaluator)
- [Contracts](#contracts)
- [Administration](#administration)
- [Operations](#operations)

## Public

Anyone, without an account. Open http://localhost:5173/ in a private window.

### COM-01 — Sign-in, invitation acceptance, and account recovery

| | |
|---|---|
| **Persona** | anonymous (no sign-in) |
| **URL** | `/signin` |
| **Demonstrates** | FR-01 as far as Stage A goes (DD-50): sign-in is a persona picker listing every demo persona by organization, with no password; a persona the API refuses gets one generic message. AC-04: `former.officer` is deactivated and cannot get in. Password sign-in, account recovery and invitation acceptance with real Supabase Auth arrive in Stage B. |
| **Evaluate** | Wording of the sign-in page and its refusal message; that the persona list makes each role clear. |

![COM-01 Sign-in, invitation acceptance, and account recovery — public](screens/COM-01--public.jpg)

### PUB-01 — Public procurement home

| | |
|---|---|
| **Persona** | anonymous (no sign-in) |
| **URL** | `/`<br>`/` (dark theme)<br>`/b/kwu` (buyer portal page) |
| **Demonstrates** | FR-08, AC-01, BR-15. Public home without an account: active opportunities, future notices, recent awards and guidance. The invitation-only T-2026-0006 is absent. Buyer page `/b/kwu`. |
| **Evaluate** | First impression of the public portal in light and dark themes; that nothing private appears. |

![PUB-01 Public procurement home — public](screens/PUB-01--public.jpg)

![PUB-01 dark theme — public](screens/PUB-01--public--dark.jpg)

![PUB-01 buyer portal page — public](screens/PUB-01--public--buyer.jpg)

### PUB-02 — Opportunity search

| | |
|---|---|
| **Persona** | anonymous (no sign-in) |
| **URL** | `/opportunities` |
| **Demonstrates** | FR-08, AC-01. Filter by buyer, category, procedure, status and dates; closed and cancelled notices are labelled. |
| **Evaluate** | Filters and the status labels. |

![PUB-02 Opportunity search — public](screens/PUB-02--public.jpg)

### PUB-03 — Tender notice and public documents

| | |
|---|---|
| **Persona** | anonymous (no sign-in) |
| **URL** | `/opportunities/kwu/T-2026-0002` |
| **Demonstrates** | FR-08, FR-09. Notice for T-2026-0002 (smart water meters): scope, lots, eligibility, official deadline with its time zone (DD-33), documents and addenda. |
| **Evaluate** | Deadline rendering `21 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone`, the documents list and the "participate" route. |

![PUB-03 Tender notice and public documents — public](screens/PUB-03--public.jpg)

### PUB-04 — Public clarifications and amendments

| | |
|---|---|
| **Persona** | anonymous (no sign-in) |
| **URL** | `/clarifications/kwu/T-2026-0002` |
| **Demonstrates** | FR-10, AC-10. Public edition of released questions, answers and addenda for T-2026-0002 without supplier identities. |
| **Evaluate** | That no supplier identity or commercial detail leaks. |

![PUB-04 Public clarifications and amendments — public](screens/PUB-04--public.jpg)

### PUB-05 — Award search and award detail

| | |
|---|---|
| **Persona** | anonymous (no sign-in) |
| **URL** | `/awards`<br>`/awards/kwu/T-2026-0001` (detail) |
| **Demonstrates** | FR-17, AC-26. Award search and the T-2026-0001 detail: Lot 1 awarded to Tsodilo, Lot 2 cancelled, Lot 3 still under evaluation. |
| **Evaluate** | Per-lot outcomes and disclosed values. |

![PUB-05 Award search and award detail — public](screens/PUB-05--public.jpg)

![PUB-05 detail — public](screens/PUB-05--public--detail.jpg)

### PUB-06 — Procurement plans and advance notices

| | |
|---|---|
| **Persona** | anonymous (no sign-in) |
| **URL** | `/plans`<br>`/plans/kwu/401` (advance notice) |
| **Demonstrates** | FR-05. Procurement plans and two published advance notices, clearly marked as forecasts that are not invitations to bid. |
| **Evaluate** | The forecast disclaimer and the expression-of-interest instructions. |

![PUB-06 Procurement plans and advance notices — public](screens/PUB-06--public.jpg)

![PUB-06 advance notice — public](screens/PUB-06--public--notice.jpg)

### PUB-07 — Supplier participation guidance

| | |
|---|---|
| **Persona** | anonymous (no sign-in) |
| **URL** | `/guidance` |
| **Demonstrates** | BR-46. Guidance articles for every participation topic (registration, qualification, submission, deadlines, evaluation, complaints, accessibility, contact). |
| **Evaluate** | Tone and completeness of the guidance; general guidance vs binding tender conditions. |

![PUB-07 Supplier participation guidance — public](screens/PUB-07--public.jpg)

## Every signed-in user

Personal screens shared by buyer, supplier and operator accounts (the `/me/*` pages).

### COM-02 — Organization and capacity selection

| | |
|---|---|
| **Persona** | `sam.dual` (KWU + Tsodilo + Chobe) |
| **URL** | `/select-organization` |
| **Demonstrates** | FR-01 to FR-03, AC-02. `sam.dual` is a KWU evaluator and a contributor for Tsodilo and Chobe; one membership is pending approval. The current organization and capacity are always named, and consequential actions repeat them in the confirmation dialog. |
| **Evaluate** | Is it obvious which organization and capacity you are acting for? Switch organization from the account menu and check that the sidebar, data and URL area change together. |

![COM-02 Organization and capacity selection — sam.dual](screens/COM-02--sam.dual.jpg)

### COM-03 — Personal profile and preferences

| | |
|---|---|
| **Persona** | `tebogo.officer` (Kalahari Water Utilities) |
| **URL** | `/me/profile` |
| **Demonstrates** | FR-01, §5.4. Name, contacts, language, time display, notification choices, memberships and theme. |
| **Evaluate** | Which preferences you expect here; mandatory process notices cannot be switched off. |

![COM-03 Personal profile and preferences — tebogo.officer](screens/COM-03--tebogo.officer.jpg)

### COM-04 — Task and approval inbox

| | |
|---|---|
| **Persona** | `tebogo.officer` (Kalahari Water Utilities) |
| **URL** | `/me/tasks` |
| **Demonstrates** | FR-21, BR-06/07. Personal tasks across memberships, each labelled with its organization, with due dates, urgency and overdue chips. |
| **Evaluate** | Whether the columns and filters let an officer plan the day; that unrelated task details are never shown. |

![COM-04 Task and approval inbox — tebogo.officer](screens/COM-04--tebogo.officer.jpg)

### COM-05 — Approval decision

| | |
|---|---|
| **Persona** | `mpho.manager` (Kalahari Water Utilities) |
| **URL** | `/me/approvals/37`<br>`/me/approvals/37` (confirmation dialog open (COM-02)) |
| **Demonstrates** | BR-06, BR-10, AC-05 mechanics. The exact subject version, amount, scope, evidence, previous decisions and the approver's authority; the confirmation dialog repeats organization, capacity, scope and result (COM-02). |
| **Evaluate** | The decision layout (approve, reject, return with reasons) and the confirmation wording before a consequential action. |

![COM-05 Approval decision — mpho.manager](screens/COM-05--mpho.manager.jpg)

![COM-05 confirmation dialog open (COM-02) — mpho.manager](screens/COM-05--mpho.manager--confirm.jpg)

### COM-06 — Notification center

| | |
|---|---|
| **Persona** | `tebogo.officer` (Kalahari Water Utilities) |
| **URL** | `/me/notifications` |
| **Demonstrates** | FR-21. Official notices, reminders and delivery exceptions; unread vs acknowledged are separate states. |
| **Evaluate** | That reading is clearly distinct from acknowledging. |

![COM-06 Notification center — tebogo.officer](screens/COM-06--tebogo.officer.jpg)

### COM-07 — Document and evidence viewer

| | |
|---|---|
| **Persona** | `tebogo.officer` (Kalahari Water Utilities) |
| **URL** | `/me/documents/204` |
| **Demonstrates** | BR-41/42. Document title, owner, version history, classification, related record and downloads; originals and redacted copies are distinguished. |
| **Evaluate** | The version list and download actions; the classification labels. |

![COM-07 Document and evidence viewer — tebogo.officer](screens/COM-07--tebogo.officer.jpg)

### COM-08 — Global search and saved views

| | |
|---|---|
| **Persona** | `tebogo.officer` (Kalahari Water Utilities) |
| **URL** | `/me/search?q=pump` |
| **Demonstrates** | FR-21, BR-43. Search across authorized tenders, suppliers, tasks, contracts and documents; saved views. Counts never reveal restricted records. |
| **Evaluate** | Result grouping and saved views. |

![COM-08 Global search and saved views — tebogo.officer](screens/COM-08--tebogo.officer.jpg)

### COM-09 — Help, accessibility, and service cases

| | |
|---|---|
| **Persona** | `tebogo.officer` (Kalahari Water Utilities); anonymous (no sign-in) |
| **URL** | `/me/help`<br>`/service-status` (public service status) |
| **Demonstrates** | FR-22, BR-46. Help centre, guidance, service notices and support cases for signed-in users; public service status page. |
| **Evaluate** | That support cases cannot become an informal bid channel (the page says so). |

![COM-09 Help, accessibility, and service cases — tebogo.officer](screens/COM-09--tebogo.officer.jpg)

![COM-09 public service status — public](screens/COM-09--public--public.jpg)

## Supplier

Supplier organizations: Tsodilo, Chobe, Makgadikgadi, Serowe ICT, Limpopo and Gaborone Metering.

### SUP-01 — Supplier dashboard

| | |
|---|---|
| **Persona** | `tsodilo.bidmanager` (Tsodilo Engineering) |
| **URL** | `/supplier/dashboard`<br>`/supplier/dashboard` (dark theme) |
| **Demonstrates** | FR-21. Tsodilo's prioritized work: invitations, pursuits, submission status (only a receipt means submitted), deadlines in each buyer's zone, qualifications, outcomes. Cards the persona's role does not cover show a restricted state. |
| **Evaluate** | Priorities and wording; the dark theme. |

![SUP-01 Supplier dashboard — tsodilo.bidmanager](screens/SUP-01--tsodilo.bidmanager.jpg)

![SUP-01 dark theme — tsodilo.bidmanager](screens/SUP-01--tsodilo.bidmanager--dark.jpg)

### SUP-02 — Organization registration and membership

| | |
|---|---|
| **Persona** | anonymous (no sign-in); `makgadikgadi.admin` (Makgadikgadi Civil Works) |
| **URL** | `/register`<br>`/me/membership-requests` (membership requests) |
| **Demonstrates** | FR-02, BR-44. Public organization registration (duplicate candidates, invitation claim) and the personal list of membership requests. |
| **Evaluate** | The registration form fields and the duplicate warning. |

![SUP-02 Organization registration and membership — public](screens/SUP-02--public.jpg)

![SUP-02 membership requests — makgadikgadi.admin](screens/SUP-02--makgadikgadi.admin--membership.jpg)

### SUP-03 — Organization profile

| | |
|---|---|
| **Persona** | `tsodilo.admin` (Tsodilo Engineering) |
| **URL** | `/supplier/organization` |
| **Demonstrates** | FR-02. Legal and trading names, registrations, locations, categories, ownership declarations and buyer-sharing choices; legal-identity changes go through review. |
| **Evaluate** | That identity changes are requested, not edited in place. |

![SUP-03 Organization profile — tsodilo.admin](screens/SUP-03--tsodilo.admin.jpg)

### SUP-04 — Supplier users and authority

| | |
|---|---|
| **Persona** | `tsodilo.admin` (Tsodilo Engineering) |
| **URL** | `/supplier/admin/access/users`<br>`/supplier/admin/access/authority` (signing authority) |
| **Demonstrates** | FR-03, AC-03, BR-05. Members, roles, groups, tender assignments and signing authority. A contributor cannot submit or grant itself authority. |
| **Evaluate** | Sign in as `tsodilo.contributor` and check that submission is not offered. |

![SUP-04 Supplier users and authority — tsodilo.admin](screens/SUP-04--tsodilo.admin.jpg)

![SUP-04 signing authority — tsodilo.admin](screens/SUP-04--tsodilo.admin--authority.jpg)

### SUP-05 — Evidence library

| | |
|---|---|
| **Persona** | `chobe-pipe.admin` (Chobe Pipe & Valve) |
| **URL** | `/supplier/evidence` |
| **Demonstrates** | FR-02, AC-09. Chobe's evidence library: insurance certificate expiring within 10 days, sharing audiences, prospective replacement. |
| **Evaluate** | The expiry warnings and "where an earlier edition was formally submitted". |

![SUP-05 Evidence library — chobe-pipe.admin](screens/SUP-05--chobe-pipe.admin.jpg)

### SUP-06 — Opportunity discovery and watchlist

| | |
|---|---|
| **Persona** | `tsodilo.bidmanager` (Tsodilo Engineering) |
| **URL** | `/supplier/opportunities` |
| **Demonstrates** | FR-09. Matched opportunities, saved filters and watchlist; a match does not guarantee eligibility. |
| **Evaluate** | Discovery filters and subscriptions. |

![SUP-06 Opportunity discovery and watchlist — tsodilo.bidmanager](screens/SUP-06--tsodilo.bidmanager.jpg)

### SUP-07 — Invitations and access requests

| | |
|---|---|
| **Persona** | `tsodilo.bidmanager` (Tsodilo Engineering) |
| **URL** | `/supplier/invitations`<br>`/supplier/invitations/604` (invitation detail) |
| **Demonstrates** | FR-09, AC-01. Invitation to the invitation-only T-2026-0006, access requests and confidentiality acknowledgment. |
| **Evaluate** | Accept/decline and the conditions wording. |

![SUP-07 Invitations and access requests — tsodilo.bidmanager](screens/SUP-07--tsodilo.bidmanager.jpg)

![SUP-07 invitation detail — tsodilo.bidmanager](screens/SUP-07--tsodilo.bidmanager--invitation.jpg)

### SUP-08 — Opportunity workspace

| | |
|---|---|
| **Persona** | `tsodilo.bidmanager` (Tsodilo Engineering) |
| **URL** | `/supplier/opportunities/2` |
| **Demonstrates** | FR-09, FR-10. Opportunity workspace for T-2026-0002: package, lots, dates, addenda to acknowledge, readiness to participate. |
| **Evaluate** | Addendum acknowledgment and the move to response preparation. |

![SUP-08 Opportunity workspace — tsodilo.bidmanager](screens/SUP-08--tsodilo.bidmanager.jpg)

### SUP-09 — Bid/no-bid and pursuit team

| | |
|---|---|
| **Persona** | `tsodilo.bidmanager` (Tsodilo Engineering) |
| **URL** | `/supplier/opportunities/6/pursuit` |
| **Demonstrates** | FR-09. Bid/no-bid decision with internal rationale, risk, capacity and team; only an explicitly shared decline reason reaches the buyer. |
| **Evaluate** | The private vs shared fields. |

![SUP-09 Bid/no-bid and pursuit team — tsodilo.bidmanager](screens/SUP-09--tsodilo.bidmanager.jpg)

### SUP-10 — Tender questions and clarifications

| | |
|---|---|
| **Persona** | `tsodilo.bidmanager` (Tsodilo Engineering) |
| **URL** | `/supplier/clarifications/tenders/2` |
| **Demonstrates** | FR-10, AC-10. Own questions, buyer replies, published answers and addenda for T-2026-0002. |
| **Evaluate** | That other suppliers' private cases are never visible. |

![SUP-10 Tender questions and clarifications — tsodilo.bidmanager](screens/SUP-10--tsodilo.bidmanager.jpg)

### SUP-11 — Briefings and site visits

| | |
|---|---|
| **Persona** | `tsodilo.bidmanager` (Tsodilo Engineering) |
| **URL** | `/supplier/briefings`<br>`/supplier/briefings/41` (session detail) |
| **Demonstrates** | FR-10. Briefings and site visits: booking, mandatory status, accessibility needs, minutes. |
| **Evaluate** | Booking and cancellation flows. |

![SUP-11 Briefings and site visits — tsodilo.bidmanager](screens/SUP-11--tsodilo.bidmanager.jpg)

![SUP-11 session detail — tsodilo.bidmanager](screens/SUP-11--tsodilo.bidmanager--session.jpg)

### SUP-12 — Response answers and attachments

| | |
|---|---|
| **Persona** | `tsodilo.bidmanager` (Tsodilo Engineering) |
| **URL** | `/supplier/responses/14/answers` |
| **Demonstrates** | FR-11, AC-03. Answers by section on Tsodilo's draft for T-2026-0006, contributors, reuse of approved content, completion. |
| **Evaluate** | Answer editing, assignment and reuse. |

![SUP-12 Response answers and attachments — tsodilo.bidmanager](screens/SUP-12--tsodilo.bidmanager.jpg)

### SUP-13 — Pricing and commercial offer

| | |
|---|---|
| **Persona** | `tsodilo.bidmanager` (Tsodilo Engineering) |
| **URL** | `/supplier/responses/14/pricing` |
| **Demonstrates** | FR-11, §3 money. Pricing schedule with quantities, rates, taxes and totals as decimal amounts with currency. |
| **Evaluate** | Totals and the pricing rules shown. |

![SUP-13 Pricing and commercial offer — tsodilo.bidmanager](screens/SUP-13--tsodilo.bidmanager.jpg)

### SUP-14 — Declarations, qualifications, and exceptions

| | |
|---|---|
| **Persona** | `tsodilo.bidmanager` (Tsodilo Engineering) |
| **URL** | `/supplier/responses/14/declarations` |
| **Demonstrates** | FR-11. Declarations, subcontractors, conflicts, tender-specific evidence and contract exceptions. |
| **Evaluate** | The declarations wording. |

![SUP-14 Declarations, qualifications, and exceptions — tsodilo.bidmanager](screens/SUP-14--tsodilo.bidmanager.jpg)

### SUP-15 — Internal bid review and approval

| | |
|---|---|
| **Persona** | `tsodilo.bidmanager` (Tsodilo Engineering) |
| **URL** | `/supplier/responses/14/review` |
| **Demonstrates** | FR-11, AC-11. Internal review and approval; a later material change invalidates an earlier approval. |
| **Evaluate** | Approval history and the invalidated approval. |

![SUP-15 Internal bid review and approval — tsodilo.bidmanager](screens/SUP-15--tsodilo.bidmanager.jpg)

### SUP-16 — Final review and submission

| | |
|---|---|
| **Persona** | `serowe-ict.bidmanager` (Serowe ICT Solutions); `tsodilo.bidmanager` (Tsodilo Engineering); `serowe-ict.signatory` (Serowe ICT Solutions) |
| **URL** | `/supplier/responses/7/submit`<br>`/supplier/responses/14/submit` (readiness check with blocking errors)<br>`/supplier/responses/7/submit` (confirmation dialog open (COM-02)) |
| **Demonstrates** | FR-12, AC-11, AC-13. Readiness check with 5 blocking errors (draft on T-2026-0006); Serowe's internally approved response on T-2026-0002 that is still "Not submitted"; the signatory's confirmation dialog with organization, capacity, scope and result. |
| **Evaluate** | Blocking errors vs warnings vs passed checks; the "nothing has been submitted" message; the final declaration. |

![SUP-16 Final review and submission — serowe-ict.bidmanager](screens/SUP-16--serowe-ict.bidmanager.jpg)

![SUP-16 readiness check with blocking errors — tsodilo.bidmanager](screens/SUP-16--tsodilo.bidmanager--readiness-blocked.jpg)

![SUP-16 confirmation dialog open (COM-02) — serowe-ict.signatory](screens/SUP-16--serowe-ict.signatory--confirm.jpg)

### SUP-17 — Receipts, revision history, and withdrawal

| | |
|---|---|
| **Persona** | `tsodilo.bidmanager` (Tsodilo Engineering) |
| **URL** | `/supplier/responses/6/receipts`<br>`/supplier/receipts` (all receipts) |
| **Demonstrates** | FR-12, AC-12, AC-14. Receipts, revision history, superseded editions and withdrawal. Gaborone Metering's failed replacement keeps the earlier effective receipt. |
| **Evaluate** | Receipt details and how the effective revision is marked. |

![SUP-17 Receipts, revision history, and withdrawal — tsodilo.bidmanager](screens/SUP-17--tsodilo.bidmanager.jpg)

![SUP-17 all receipts — tsodilo.bidmanager](screens/SUP-17--tsodilo.bidmanager--receipts.jpg)

### SUP-18 — Assessment requests and appointments

| | |
|---|---|
| **Persona** | `serowe-ict.bidmanager` (Serowe ICT Solutions) |
| **URL** | `/supplier/assessment-requests`<br>`/supplier/assessment-invites` (appointments) |
| **Demonstrates** | FR-13, FR-15. Compliance clarification requests from the buyer (T-2026-0003) and demonstration/interview appointments (T-2026-0009). |
| **Evaluate** | That an assessment request cannot be used as an informal channel. |

![SUP-18 Assessment requests and appointments — serowe-ict.bidmanager](screens/SUP-18--serowe-ict.bidmanager.jpg)

![SUP-18 appointments — serowe-ict.bidmanager](screens/SUP-18--serowe-ict.bidmanager--appointments.jpg)

### SUP-19 — Negotiation and final-offer rounds

| | |
|---|---|
| **Persona** | `serowe-ict.bidmanager` (Serowe ICT Solutions) |
| **URL** | `/supplier/negotiations`<br>`/supplier/negotiations/1` (negotiation) |
| **Demonstrates** | FR-16, AC-23. Negotiation topics and final-offer rounds visible only to the invited supplier. |
| **Evaluate** | Round instructions and deadlines. |

![SUP-19 Negotiation and final-offer rounds — serowe-ict.bidmanager](screens/SUP-19--serowe-ict.bidmanager.jpg)

![SUP-19 negotiation — serowe-ict.bidmanager](screens/SUP-19--serowe-ict.bidmanager--negotiation.jpg)

### SUP-20 — Qualification applications

| | |
|---|---|
| **Persona** | `makgadikgadi.admin` (Makgadikgadi Civil Works) |
| **URL** | `/supplier/qualification` |
| **Demonstrates** | FR-06, AC-07, AC-08. Makgadikgadi's qualification: registered but not qualified for WTR-PUMP; application awaiting more information on the financial statement. |
| **Evaluate** | That registration is never shown as qualification. |

![SUP-20 Qualification applications — makgadikgadi.admin](screens/SUP-20--makgadikgadi.admin.jpg)

### SUP-21 — Outcomes and debriefings

| | |
|---|---|
| **Persona** | `tsodilo.bidmanager` (Tsodilo Engineering) |
| **URL** | `/supplier/outcomes/1` |
| **Demonstrates** | FR-17, AC-27. Tsodilo's outcome for T-2026-0001 per lot, waiting periods and debrief route. |
| **Evaluate** | Per-lot outcome wording and next steps. |

![SUP-21 Outcomes and debriefings — tsodilo.bidmanager](screens/SUP-21--tsodilo.bidmanager.jpg)

### SUP-22 — Complaints and appeals

| | |
|---|---|
| **Persona** | `limpopo-env.admin` (Limpopo Environmental) |
| **URL** | `/supplier/complaints/92` |
| **Demonstrates** | FR-17, AC-25. Limpopo's complaint CMP-2026-0002 on T-2026-0007: grounds, deadlines, status and responses. |
| **Evaluate** | That buyer deliberations are not visible. |

![SUP-22 Complaints and appeals — limpopo-env.admin](screens/SUP-22--limpopo-env.admin.jpg)

### SUP-23 — Supplier contracts and performance

| | |
|---|---|
| **Persona** | `tsodilo.admin` (Tsodilo Engineering) |
| **URL** | `/supplier/contracts/1` |
| **Demonstrates** | FR-18, FR-19. Tsodilo's view of C-2026-0001: obligations, milestones, rejected evidence, performance review it disputes. |
| **Evaluate** | Which contract details the supplier should see. |

![SUP-23 Supplier contracts and performance — tsodilo.admin](screens/SUP-23--tsodilo.admin.jpg)

### SUP-24 — Qualification decisions and renewals

| | |
|---|---|
| **Persona** | `chobe-pipe.admin` (Chobe Pipe & Valve) |
| **URL** | `/supplier/qualification/decisions` |
| **Demonstrates** | FR-06, AC-09. Qualification decisions and renewals (Chobe qualified with conditions, insurance expiring). |
| **Evaluate** | Buyer-specific vs general decisions and renewal deadlines. |

![SUP-24 Qualification decisions and renewals — chobe-pipe.admin](screens/SUP-24--chobe-pipe.admin.jpg)

## Buyer

Kalahari Water Utilities procurement staff, approvers and management reporting.

### BUY-01 — Procurement dashboard

| | |
|---|---|
| **Persona** | `mpho.manager` (Kalahari Water Utilities) |
| **URL** | `/buyer/dashboard`<br>`/buyer/dashboard` (dark theme) |
| **Demonstrates** | FR-21. Pipeline, active events, deadlines, workload, approvals and exceptions for KWU. |
| **Evaluate** | KPIs and drill-through; the dark theme. |

![BUY-01 Procurement dashboard — mpho.manager](screens/BUY-01--mpho.manager.jpg)

![BUY-01 dark theme — mpho.manager](screens/BUY-01--mpho.manager--dark.jpg)

### BUY-02 — Request register

| | |
|---|---|
| **Persona** | `tebogo.officer` (Kalahari Water Utilities) |
| **URL** | `/buyer/requests` |
| **Demonstrates** | FR-04. PR-2026-0001…0015 covering every request status. |
| **Evaluate** | Filters, status chips and the "new request" action. |

![BUY-02 Request register — tebogo.officer](screens/BUY-02--tebogo.officer.jpg)

### BUY-03 — Request and business case

| | |
|---|---|
| **Persona** | `kagiso.requester` (Kalahari Water Utilities) |
| **URL** | `/buyer/requests/3`<br>`/buyer/requests/new` (new record form) |
| **Demonstrates** | FR-04, AC-05. PR-2026-0003 Northern wellfield pipeline extension (business case, budget, risk, evidence) and the new-request form. |
| **Evaluate** | Form fields and required information. |

![BUY-03 Request and business case — kagiso.requester](screens/BUY-03--kagiso.requester.jpg)

![BUY-03 new record form — kagiso.requester](screens/BUY-03--kagiso.requester--new.jpg)

### BUY-04 — Request and funding decision

| | |
|---|---|
| **Persona** | `keabetswe.approver` (Kalahari Water Utilities) |
| **URL** | `/buyer/requests/3/decision` |
| **Demonstrates** | FR-04, AC-05, BR-06. PR-2026-0003 exceeds `mpho.manager`'s BWP 2,000,000 limit and is routed to `keabetswe.approver`. |
| **Evaluate** | Sign in as `mpho.manager`: the decision shows that the amount is beyond the grant. |

![BUY-04 Request and funding decision — keabetswe.approver](screens/BUY-04--keabetswe.approver.jpg)

### BUY-05 — Procurement plan and calendar

| | |
|---|---|
| **Persona** | `mpho.manager` (Kalahari Water Utilities) |
| **URL** | `/buyer/planning` |
| **Demonstrates** | FR-05. Plan items for 2026 Q4 and 2027 Q1, owners, budgets and published advance notices. |
| **Evaluate** | Plan columns and the advance-notice flow. |

![BUY-05 Procurement plan and calendar — mpho.manager](screens/BUY-05--mpho.manager.jpg)

### BUY-06 — Market research and strategy

| | |
|---|---|
| **Persona** | `tebogo.officer` (Kalahari Water Utilities) |
| **URL** | `/buyer/strategies/504` |
| **Demonstrates** | FR-05, AC-39. Strategy for T-2026-0009 (restricted, multi-stage): research, procedure rationale, lots, risks and approval. |
| **Evaluate** | The strategy sections and approval. |

![BUY-06 Market research and strategy — tebogo.officer](screens/BUY-06--tebogo.officer.jpg)

### BUY-07 — Tender register and creation

| | |
|---|---|
| **Persona** | `tebogo.officer` (Kalahari Water Utilities) |
| **URL** | `/buyer/tenders`<br>`/buyer/tenders/new` (new record form) |
| **Demonstrates** | FR-07. Tender register (T-2026-0001…0014) and creation from template or request. |
| **Evaluate** | Register columns and creation choices. |

![BUY-07 Tender register and creation — tebogo.officer](screens/BUY-07--tebogo.officer.jpg)

![BUY-07 new record form — tebogo.officer](screens/BUY-07--tebogo.officer--new.jpg)

### BUY-08 — Tender overview and team

| | |
|---|---|
| **Persona** | `tebogo.officer` (Kalahari Water Utilities) |
| **URL** | `/buyer/tenders/3` |
| **Demonstrates** | FR-07. T-2026-0003 SCADA telemetry upgrade: summary, version, stage, lots, dates, team, outstanding decisions. |
| **Evaluate** | Navigation between the tender's tabs. |

![BUY-08 Tender overview and team — tebogo.officer](screens/BUY-08--tebogo.officer.jpg)

### BUY-09 — Scope, lots, and requirements

| | |
|---|---|
| **Persona** | `tebogo.officer` (Kalahari Water Utilities) |
| **URL** | `/buyer/tenders/2/scope` |
| **Demonstrates** | FR-07. Requirements and lots of T-2026-0002 with mandatory status and evidence. |
| **Evaluate** | Requirement authoring and ownership. |

![BUY-09 Scope, lots, and requirements — tebogo.officer](screens/BUY-09--tebogo.officer.jpg)

### BUY-10 — Pricing and commercial terms

| | |
|---|---|
| **Persona** | `tebogo.officer` (Kalahari Water Utilities) |
| **URL** | `/buyer/tenders/2/pricing` |
| **Demonstrates** | FR-07, §3. Pricing schedules, currencies, taxes and draft terms. |
| **Evaluate** | The pricing schedule layout. |

![BUY-10 Pricing and commercial terms — tebogo.officer](screens/BUY-10--tebogo.officer.jpg)

### BUY-11 — Evaluation plan

| | |
|---|---|
| **Persona** | `tebogo.officer` (Kalahari Water Utilities) |
| **URL** | `/buyer/tenders/3/evaluation` |
| **Demonstrates** | FR-07, FR-14, §9. Evaluation plan for T-2026-0003: criteria, weights, scales, price method, staged envelopes. |
| **Evaluate** | Criteria and weights; the price formula. |

![BUY-11 Evaluation plan — tebogo.officer](screens/BUY-11--tebogo.officer.jpg)

### BUY-12 — Timetable and participation rules

| | |
|---|---|
| **Persona** | `tebogo.officer` (Kalahari Water Utilities) |
| **URL** | `/buyer/tenders/3/timetable` |
| **Demonstrates** | FR-07, BR-11/12. Timetable in the official zone, staged opening plan and participation rules. |
| **Evaluate** | Deadline rendering and the envelope stages. |

![BUY-12 Timetable and participation rules — tebogo.officer](screens/BUY-12--tebogo.officer.jpg)

### BUY-13 — Document package and release review

| | |
|---|---|
| **Persona** | `tebogo.officer` (Kalahari Water Utilities) |
| **URL** | `/buyer/tenders/5/release` |
| **Demonstrates** | FR-07, AC-06, BR-10. T-2026-0005: a scope/value edit after release approval invalidated that approval. |
| **Evaluate** | That the invalidated approval is impossible to miss. |

![BUY-13 Document package and release review — tebogo.officer](screens/BUY-13--tebogo.officer.jpg)

### BUY-14 — Publication and distribution

| | |
|---|---|
| **Persona** | `tebogo.officer` (Kalahari Water Utilities) |
| **URL** | `/buyer/tenders/2/publication`<br>`/buyer/publications` (register) |
| **Demonstrates** | FR-08, AC-33. Publication of T-2026-0002: channels, confirmations, failures; the publication register. |
| **Evaluate** | The failed external publication and its exception. |

![BUY-14 Publication and distribution — tebogo.officer](screens/BUY-14--tebogo.officer.jpg)

![BUY-14 register — tebogo.officer](screens/BUY-14--tebogo.officer--register.jpg)

### BUY-15 — Participants and document access

| | |
|---|---|
| **Persona** | `tebogo.officer` (Kalahari Water Utilities) |
| **URL** | `/buyer/tenders/6/participants` |
| **Demonstrates** | FR-08, FR-09. Participants of the invitation-only T-2026-0006: invitations, access requests, confidentiality, acknowledgments. |
| **Evaluate** | Participant statuses and access decisions. |

![BUY-15 Participants and document access — tebogo.officer](screens/BUY-15--tebogo.officer.jpg)

### BUY-16 — Tender Q&A

| | |
|---|---|
| **Persona** | `tebogo.officer` (Kalahari Water Utilities) |
| **URL** | `/buyer/clarifications/questions`<br>`/buyer/clarifications/questions/201` (question detail) |
| **Demonstrates** | FR-10, BR-14. Tender Q&A: questions, owners, draft replies, audience of publication; question Q-201. |
| **Evaluate** | Reply and publish flow; confidentiality of the asker. |

![BUY-16 Tender Q&A — tebogo.officer](screens/BUY-16--tebogo.officer.jpg)

![BUY-16 question detail — tebogo.officer](screens/BUY-16--tebogo.officer--question.jpg)

### BUY-17 — Addenda and date changes

| | |
|---|---|
| **Persona** | `tebogo.officer` (Kalahari Water Utilities) |
| **URL** | `/buyer/clarifications/addenda/22` |
| **Demonstrates** | FR-10, AC-10. Addendum 2 on T-2026-0002 adds a mandatory requirement after two submissions: affected lots, acknowledgments, resubmission consequences. |
| **Evaluate** | How the consequences for existing submissions are explained. |

![BUY-17 Addenda and date changes — tebogo.officer](screens/BUY-17--tebogo.officer.jpg)

### BUY-18 — Briefings and visits

| | |
|---|---|
| **Persona** | `tebogo.officer` (Kalahari Water Utilities) |
| **URL** | `/buyer/clarifications/sessions` |
| **Demonstrates** | FR-10. Briefings and site visits: sessions, registrations, attendance, minutes. |
| **Evaluate** | Session management. |

![BUY-18 Briefings and visits — tebogo.officer](screens/BUY-18--tebogo.officer.jpg)

### BUY-19 — Submission monitoring and closing

| | |
|---|---|
| **Persona** | `tebogo.officer` (Kalahari Water Utilities); `admin.kwu` (Kalahari Water Utilities) |
| **URL** | `/buyer/submissions/2`<br>`/buyer/submissions/8` (sealed: restricted for the organization administrator (AC-15)) |
| **Demonstrates** | FR-12, AC-12, AC-13, AC-15. Receipt metadata only for T-2026-0002 (late attempt rejected, failed replacement); `admin.kwu` gets the restricted page on the sealed T-2026-0008. |
| **Evaluate** | That no sealed content or draft is visible; the restricted page. |

![BUY-19 Submission monitoring and closing — tebogo.officer](screens/BUY-19--tebogo.officer.jpg)

![BUY-19 sealed: restricted for the organization administrator (AC-15) — admin.kwu](screens/BUY-19--admin.kwu--sealed-restricted.jpg)

### BUY-20 — Opening session

| | |
|---|---|
| **Persona** | `oratile.opener` (Kalahari Water Utilities); `admin.kwu` (Kalahari Water Utilities) |
| **URL** | `/buyer/opening/tenders/8`<br>`/buyer/opening/tenders/8` (sealed: restricted for the organization administrator (AC-15))<br>`/buyer/opening/sessions/180` (session detail) |
| **Demonstrates** | FR-13, AC-15, AC-16. Opening of T-2026-0008 (closed, awaiting opening, two sealed submissions, one withdrawn) and its session with witnesses; administrators are refused. |
| **Evaluate** | Opening authority, witnesses and minutes. |

![BUY-20 Opening session — oratile.opener](screens/BUY-20--oratile.opener.jpg)

![BUY-20 sealed: restricted for the organization administrator (AC-15) — admin.kwu](screens/BUY-20--admin.kwu--sealed-restricted.jpg)

![BUY-20 session detail — oratile.opener](screens/BUY-20--oratile.opener--session.jpg)

### BUY-21 — Compliance and exclusions

| | |
|---|---|
| **Persona** | `boitumelo.chair` (Kalahari Water Utilities) |
| **URL** | `/buyer/compliance/bids/3003`<br>`/buyer/compliance/exclusions/5101` (exclusion approval) |
| **Demonstrates** | FR-13, AC-17. Makgadikgadi fails REQ-Q-03 (ISO 9001) on T-2026-0003: evidence cited, exclusion awaiting approval, commercial envelope stays sealed. |
| **Evaluate** | The finding, evidence and exclusion approval. |

![BUY-21 Compliance and exclusions — boitumelo.chair](screens/BUY-21--boitumelo.chair.jpg)

![BUY-21 exclusion approval — boitumelo.chair](screens/BUY-21--boitumelo.chair--exclusion.jpg)

### BUY-22 — Demonstrations and references

| | |
|---|---|
| **Persona** | `tebogo.officer` (Kalahari Water Utilities) |
| **URL** | `/buyer/selection/assessments?tenderId=9`<br>`/buyer/selection/references` (reference checks) |
| **Demonstrates** | FR-15, AC-21. Demonstrations and reference checks for T-2026-0009 with the announced assessment basis. |
| **Evaluate** | Equal-treatment checks and recorded evidence. |

![BUY-22 Demonstrations and references — tebogo.officer](screens/BUY-22--tebogo.officer.jpg)

![BUY-22 reference checks — tebogo.officer](screens/BUY-22--tebogo.officer--references.jpg)

### BUY-23 — Shortlist and stage progression

| | |
|---|---|
| **Persona** | `mpho.manager` (Kalahari Water Utilities) |
| **URL** | `/buyer/selection/shortlists/9` |
| **Demonstrates** | FR-15, AC-22. Approved stage-1 shortlist of T-2026-0009 (2 of 3), reasons and next-stage invitations. |
| **Evaluate** | Rationale and approvals. |

![BUY-23 Shortlist and stage progression — mpho.manager](screens/BUY-23--mpho.manager.jpg)

### BUY-24 — Preferred-bidder recommendation

| | |
|---|---|
| **Persona** | `tebogo.officer` (Kalahari Water Utilities) |
| **URL** | `/buyer/selection/preferred-bidders/1` |
| **Demonstrates** | FR-16, AC-24. Preferred bidder Serowe ICT on T-2026-0009 with conditions. |
| **Evaluate** | That preferred status is not treated as a contract. |

![BUY-24 Preferred-bidder recommendation — tebogo.officer](screens/BUY-24--tebogo.officer.jpg)

### BUY-25 — Due-diligence case

| | |
|---|---|
| **Persona** | `mpho.manager` (Kalahari Water Utilities) |
| **URL** | `/buyer/selection/due-diligence/1` |
| **Demonstrates** | FR-16, AC-24. Serowe fails due diligence; the fallback decision is recorded. |
| **Evaluate** | Findings and the fallback decision. |

![BUY-25 Due-diligence case — mpho.manager](screens/BUY-25--mpho.manager.jpg)

### BUY-26 — Award recommendation and approval

| | |
|---|---|
| **Persona** | `keabetswe.approver` (Kalahari Water Utilities) |
| **URL** | `/buyer/awards/1/recommendations/14902`<br>`/buyer/awards/1` (award overview) |
| **Demonstrates** | FR-17, AC-26. Award recommendation version 2 for T-2026-0001 and the per-lot award overview (awarded / cancelled / under evaluation). |
| **Evaluate** | Per-lot outcomes and approval. |

![BUY-26 Award recommendation and approval — keabetswe.approver](screens/BUY-26--keabetswe.approver.jpg)

![BUY-26 award overview — keabetswe.approver](screens/BUY-26--keabetswe.approver--overview.jpg)

### BUY-27 — Negotiation and final offers

| | |
|---|---|
| **Persona** | `mpho.manager` (Kalahari Water Utilities); `tebogo.officer` (Kalahari Water Utilities) |
| **URL** | `/buyer/selection/final-offers/1`<br>`/buyer/selection/negotiations/1` (negotiation) |
| **Demonstrates** | FR-16, AC-23. Final-offer round on T-2026-0009 blocked because negotiation is not permitted for the variant; negotiation record with Serowe. |
| **Evaluate** | The blocking message and the procedural decision it asks for. |

![BUY-27 Negotiation and final offers — mpho.manager](screens/BUY-27--mpho.manager.jpg)

![BUY-27 negotiation — tebogo.officer](screens/BUY-27--tebogo.officer--negotiation.jpg)

### BUY-28 — Outcome notices and waiting period

| | |
|---|---|
| **Persona** | `tebogo.officer` (Kalahari Water Utilities) |
| **URL** | `/buyer/awards/7/notices`<br>`/buyer/awards/7` (complaint hold blocks the final award (AC-25)) |
| **Demonstrates** | FR-17, AC-25. T-2026-0007: intent notice issued, standstill running, Limpopo complaint places a blocking hold on final award and contract signature. |
| **Evaluate** | The hold banner, readiness list and notices. |

![BUY-28 Outcome notices and waiting period — tebogo.officer](screens/BUY-28--tebogo.officer.jpg)

![BUY-28 complaint hold blocks the final award (AC-25) — tebogo.officer](screens/BUY-28--tebogo.officer--complaint-hold.jpg)

### BUY-29 — Debriefings and complaints

| | |
|---|---|
| **Persona** | `dineo.legal` (Kalahari Water Utilities) |
| **URL** | `/buyer/award-cases/complaints/92`<br>`/buyer/award-cases` (register) |
| **Demonstrates** | FR-17, AC-25, AC-27. Complaint CMP-2026-0002 with independent owner, deadlines, evidence; debrief register. |
| **Evaluate** | Case handling and release of holds. |

![BUY-29 Debriefings and complaints — dineo.legal](screens/BUY-29--dineo.legal.jpg)

![BUY-29 register — dineo.legal](screens/BUY-29--dineo.legal--register.jpg)

### BUY-30 — Event closeout and archive

| | |
|---|---|
| **Persona** | `tebogo.officer` (Kalahari Water Utilities) |
| **URL** | `/buyer/awards/7/closeout`<br>`/buyer/closeout` (register) |
| **Demonstrates** | FR-17, AC-29. Event closeout of T-2026-0007 and the closeout register; closure is gated on handover and open cases. |
| **Evaluate** | The closure gates. |

![BUY-30 Event closeout and archive — tebogo.officer](screens/BUY-30--tebogo.officer.jpg)

![BUY-30 register — tebogo.officer](screens/BUY-30--tebogo.officer--register.jpg)

### BUY-31 — Supplier directory

| | |
|---|---|
| **Persona** | `mpho.manager` (Kalahari Water Utilities) |
| **URL** | `/buyer/suppliers` |
| **Demonstrates** | FR-02, BR-45. Supplier directory with qualification scope, restrictions and evidence freshness. |
| **Evaluate** | Directory filters. |

![BUY-31 Supplier directory — mpho.manager](screens/BUY-31--mpho.manager.jpg)

### BUY-32 — Supplier relationship record

| | |
|---|---|
| **Persona** | `mpho.manager` (Kalahari Water Utilities) |
| **URL** | `/buyer/suppliers/5` |
| **Demonstrates** | FR-02, BR-45. Chobe's relationship record (buyer-specific; other buyers' assessments never shown). |
| **Evaluate** | Record tabs. |

![BUY-32 Supplier relationship record — mpho.manager](screens/BUY-32--mpho.manager.jpg)

### BUY-33 — Qualification review queue

| | |
|---|---|
| **Persona** | `neo.assessor` (Kalahari Water Utilities) |
| **URL** | `/buyer/qualification` |
| **Demonstrates** | FR-06. Qualification review queue: applications, risk, assessors, deadlines. |
| **Evaluate** | Assignment and prioritization. |

![BUY-33 Qualification review queue — neo.assessor](screens/BUY-33--neo.assessor.jpg)

### BUY-34 — Qualification assessment

| | |
|---|---|
| **Persona** | `neo.assessor` (Kalahari Water Utilities) |
| **URL** | `/buyer/qualification/applications/503` |
| **Demonstrates** | FR-06, AC-08. Makgadikgadi's application: unclear financial statement, info request from `lesego.finance`, reporting periods. |
| **Evaluate** | Criteria, evidence and the info request. |

![BUY-34 Qualification assessment — neo.assessor](screens/BUY-34--neo.assessor.jpg)

### BUY-35 — Qualification decision and monitoring

| | |
|---|---|
| **Persona** | `mpho.manager` (Kalahari Water Utilities) |
| **URL** | `/buyer/qualification/monitoring`<br>`/buyer/qualification/applications/509/decision` (decision form) |
| **Demonstrates** | FR-06, AC-09. Decisions and monitoring (expired, suspended, conditional) and the decision form for Chobe. |
| **Evaluate** | Monitoring triggers and decision wording. |

![BUY-35 Qualification decision and monitoring — mpho.manager](screens/BUY-35--mpho.manager.jpg)

![BUY-35 decision form — mpho.manager](screens/BUY-35--mpho.manager--decision.jpg)

### REP-01 — Management reports

| | |
|---|---|
| **Persona** | `mpho.manager` (Kalahari Water Utilities) |
| **URL** | `/buyer/reports/participation`<br>`/buyer/reports` (report catalogue) |
| **Demonstrates** | FR-21, AC-34. Participation report counting unique organizations for T-2026-0001 (3 lots) and T-2026-0002 (several revisions), BWP basis stated; report catalogue. |
| **Evaluate** | That counts are not inflated and the currency basis is stated. |

![REP-01 Management reports — mpho.manager](screens/REP-01--mpho.manager.jpg)

![REP-01 report catalogue — mpho.manager](screens/REP-01--mpho.manager--catalog.jpg)

### REP-02 — Report definition and export review

| | |
|---|---|
| **Persona** | `mpho.manager` (Kalahari Water Utilities) |
| **URL** | `/buyer/reports/definitions/1` |
| **Demonstrates** | FR-21. Report definition "Weekly pipeline for ExCo" with fields, filters, audience and schedule. |
| **Evaluate** | Scope preview before sharing. |

![REP-02 Report definition and export review — mpho.manager](screens/REP-02--mpho.manager.jpg)

## Evaluator

The evaluation committee of T-2026-0003 (chair, evaluators, commercial reviewer).

### EVA-01 — Evaluator assignments

| | |
|---|---|
| **Persona** | `amantle.eval` (Kalahari Water Utilities) |
| **URL** | `/buyer/evaluation/assignments`<br>`/buyer/evaluation/assignments/3003` (assignment detail) |
| **Demonstrates** | FR-14. `amantle.eval`'s assignments with declarations and due dates. |
| **Evaluate** | Conflict declaration and assignment acceptance. |

![EVA-01 Evaluator assignments — amantle.eval](screens/EVA-01--amantle.eval.jpg)

![EVA-01 assignment detail — amantle.eval](screens/EVA-01--amantle.eval--assignment.jpg)

### EVA-02 — Individual assessment

| | |
|---|---|
| **Persona** | `amantle.eval` (Kalahari Water Utilities) |
| **URL** | `/buyer/evaluation/assignments/3003/assessment`<br>`/buyer/evaluation/assignments/3003/assessment` (dark theme) |
| **Demonstrates** | FR-14, AC-16, AC-18. Amantle's in-progress assessment on T-2026-0003: one criterion not scored (never counted as zero), prices never shown, other assessors hidden. |
| **Evaluate** | Scoring layout, scale anchors and the clarification request. |

![EVA-02 Individual assessment — amantle.eval](screens/EVA-02--amantle.eval.jpg)

![EVA-02 dark theme — amantle.eval](screens/EVA-02--amantle.eval--dark.jpg)

### EVA-03 — Clarification coordination

| | |
|---|---|
| **Persona** | `boitumelo.chair` (Kalahari Water Utilities) |
| **URL** | `/buyer/bid-clarifications`<br>`/buyer/bid-clarifications/4101` (detail) |
| **Demonstrates** | FR-13, FR-14. Chair's consolidation of assessors' clarification questions (CL-4101). |
| **Evaluate** | Consolidate and issue flow. |

![EVA-03 Clarification coordination — boitumelo.chair](screens/EVA-03--boitumelo.chair.jpg)

![EVA-03 detail — boitumelo.chair](screens/EVA-03--boitumelo.chair--detail.jpg)

### EVA-04 — Commercial comparison

| | |
|---|---|
| **Persona** | `refilwe.commercial` (Kalahari Water Utilities) |
| **URL** | `/buyer/evaluation/tenders/3/commercial` |
| **Demonstrates** | FR-14, AC-19, §9. Commercial comparison after the price gate: evaluated cost 100,000 vs 120,000. |
| **Evaluate** | The price formula and assumptions. |

![EVA-04 Commercial comparison — refilwe.commercial](screens/EVA-04--refilwe.commercial.jpg)

### EVA-05 — Moderation

| | |
|---|---|
| **Persona** | `boitumelo.chair` (Kalahari Water Utilities) |
| **URL** | `/buyer/evaluation/tenders/3/moderation` |
| **Demonstrates** | FR-14, AC-20. Moderation keeps original individual scores and records the changed score with reasons. |
| **Evaluate** | Divergences and the recorded method. |

![EVA-05 Moderation — boitumelo.chair](screens/EVA-05--boitumelo.chair.jpg)

### EVA-06 — Ranking and evaluation report

| | |
|---|---|
| **Persona** | `boitumelo.chair` (Kalahari Water Utilities) |
| **URL** | `/buyer/evaluation/tenders/3/results` |
| **Demonstrates** | FR-14, AC-19. Ranking: Serowe 86.00, Tsodilo 88.00 (the 120,000 offer ranks first), committee sign-off. |
| **Evaluate** | That the worked example of PRD §9 is reproduced. |

![EVA-06 Ranking and evaluation report — boitumelo.chair](screens/EVA-06--boitumelo.chair.jpg)

## Contracts

Contract management after award (`masego.contracts`).

### CON-01 — Contract register

| | |
|---|---|
| **Persona** | `masego.contracts` (Kalahari Water Utilities) |
| **URL** | `/buyer/contracts` |
| **Demonstrates** | FR-18. Contract register with owners, values, ceilings, terms and renewal dates. |
| **Evaluate** | Columns and filters. |

![CON-01 Contract register — masego.contracts](screens/CON-01--masego.contracts.jpg)

### CON-02 — Contract preparation and review

| | |
|---|---|
| **Persona** | `masego.contracts` (Kalahari Water Utilities) |
| **URL** | `/buyer/contracts/2/preparation` |
| **Demonstrates** | FR-18, AC-28. C-2026-0002 differs from the award; the difference is flagged for review. |
| **Evaluate** | The difference view. |

![CON-02 Contract preparation and review — masego.contracts](screens/CON-02--masego.contracts.jpg)

### CON-03 — Signature and commencement

| | |
|---|---|
| **Persona** | `masego.contracts` (Kalahari Water Utilities) |
| **URL** | `/buyer/contracts/2/signature` |
| **Demonstrates** | FR-18, AC-28, AC-33. Signatories, authority and signature status; start authorization is gated. |
| **Evaluate** | Signature steps. |

![CON-03 Signature and commencement — masego.contracts](screens/CON-03--masego.contracts.jpg)

### CON-04 — Procurement handover

| | |
|---|---|
| **Persona** | `masego.contracts` (Kalahari Water Utilities) |
| **URL** | `/buyer/contracts/1/handover` |
| **Demonstrates** | FR-18, AC-29. Handover of C-2026-0001 (accepted), without losing bids. |
| **Evaluate** | Handover content. |

![CON-04 Procurement handover — masego.contracts](screens/CON-04--masego.contracts.jpg)

### CON-05 — Contract overview and obligations

| | |
|---|---|
| **Persona** | `masego.contracts` (Kalahari Water Utilities) |
| **URL** | `/buyer/contracts/1`<br>`/buyer/contracts/1` (dark theme) |
| **Demonstrates** | FR-19. C-2026-0001 overview and obligations, owners and statuses. |
| **Evaluate** | Obligation tracking; the dark theme. |

![CON-05 Contract overview and obligations — masego.contracts](screens/CON-05--masego.contracts.jpg)

![CON-05 dark theme — masego.contracts](screens/CON-05--masego.contracts--dark.jpg)

### CON-06 — Milestones and acceptance

| | |
|---|---|
| **Persona** | `masego.contracts` (Kalahari Water Utilities) |
| **URL** | `/buyer/contracts/1/milestones` |
| **Demonstrates** | FR-19, AC-30. Milestone "Q3 service report" evidence rejected with remediation; payment readiness not implied. |
| **Evaluate** | Rejection and remediation records. |

![CON-06 Milestones and acceptance — masego.contracts](screens/CON-06--masego.contracts.jpg)

### CON-07 — Performance and improvement

| | |
|---|---|
| **Persona** | `masego.contracts` (Kalahari Water Utilities) |
| **URL** | `/buyer/contracts/1/performance` |
| **Demonstrates** | FR-19. Performance review shared with the supplier, who disputes it. |
| **Evaluate** | Scorecards and dispute. |

![CON-07 Performance and improvement — masego.contracts](screens/CON-07--masego.contracts.jpg)

### CON-08 — Contract financial view

| | |
|---|---|
| **Persona** | `masego.contracts` (Kalahari Water Utilities) |
| **URL** | `/buyer/contracts/1/financials` |
| **Demonstrates** | FR-19. Original value, approved changes, ceiling, commitments, accepted milestones and payments, with sources. |
| **Evaluate** | That estimated or disputed figures are not shown as paid. |

![CON-08 Contract financial view — masego.contracts](screens/CON-08--masego.contracts.jpg)

### CON-09 — Changes, disputes, and remedies

| | |
|---|---|
| **Persona** | `masego.contracts` (Kalahari Water Utilities) |
| **URL** | `/buyer/contracts/1/changes` |
| **Demonstrates** | FR-19, AC-31, BR-36. Three changes whose cumulative value exceeds the officer's authority. |
| **Evaluate** | The cumulative exposure and required approval. |

![CON-09 Changes, disputes, and remedies — masego.contracts](screens/CON-09--masego.contracts.jpg)

### CON-10 — Renewal, extension, and termination

| | |
|---|---|
| **Persona** | `masego.contracts` (Kalahari Water Utilities) |
| **URL** | `/buyer/contracts/1/renewals` |
| **Demonstrates** | FR-19, AC-32, BR-37. Renewal option whose notice window opens in 5 days with no decision; nothing renews automatically. |
| **Evaluate** | The alert and decision options. |

![CON-10 Renewal, extension, and termination — masego.contracts](screens/CON-10--masego.contracts.jpg)

### CON-11 — Closeout and continuing obligations

| | |
|---|---|
| **Persona** | `masego.contracts` (Kalahari Water Utilities) |
| **URL** | `/buyer/contracts/4/closeout` |
| **Demonstrates** | FR-19. C-2025-0007 (imported legacy contract, expired) with a surviving warranty obligation. |
| **Evaluate** | Closing while tracking surviving obligations. |

![CON-11 Closeout and continuing obligations — masego.contracts](screens/CON-11--masego.contracts.jpg)

## Administration

Buyer organization administration, policy, records and service settings.

### ADM-01 — Organization and legal entities

| | |
|---|---|
| **Persona** | `admin.kwu` (Kalahari Water Utilities) |
| **URL** | `/buyer/admin/organization/settings` |
| **Demonstrates** | FR-22. Organization identity, legal entity, branding, languages, official time zone. |
| **Evaluate** | Settings and their effect on public notices. |

![ADM-01 Organization and legal entities — admin.kwu](screens/ADM-01--admin.kwu.jpg)

### ADM-02 — Departments, locations, and business classifications

| | |
|---|---|
| **Persona** | `admin.kwu` (Kalahari Water Utilities) |
| **URL** | `/buyer/admin/organization/structure` |
| **Demonstrates** | FR-22. Departments, locations and business classifications (WTR-INFRA tree). |
| **Evaluate** | Structure editing. |

![ADM-02 Departments, locations, and business classifications — admin.kwu](screens/ADM-02--admin.kwu.jpg)

### ADM-03 — User directory and user detail

| | |
|---|---|
| **Persona** | `admin.kwu` (Kalahari Water Utilities) |
| **URL** | `/buyer/admin/access/users`<br>`/buyer/admin/access/users/4` (user detail) |
| **Demonstrates** | FR-03, AC-04. User directory and user detail with memberships, delegations and outstanding work. |
| **Evaluate** | Invite, suspend, reassign. |

![ADM-03 User directory and user detail — admin.kwu](screens/ADM-03--admin.kwu.jpg)

![ADM-03 user detail — admin.kwu](screens/ADM-03--admin.kwu--user.jpg)

### ADM-04 — Roles, groups, and access review

| | |
|---|---|
| **Persona** | `admin.kwu` (Kalahari Water Utilities) |
| **URL** | `/buyer/admin/access/roles`<br>`/buyer/admin/access/review` (access review) |
| **Demonstrates** | FR-03. Roles, groups and access review with conflicting authority. |
| **Evaluate** | The access review. |

![ADM-04 Roles, groups, and access review — admin.kwu](screens/ADM-04--admin.kwu.jpg)

![ADM-04 access review — admin.kwu](screens/ADM-04--admin.kwu--review.jpg)

### ADM-05 — Authority, committees, and delegations

| | |
|---|---|
| **Persona** | `admin.kwu` (Kalahari Water Utilities) |
| **URL** | `/buyer/admin/organization/authority` |
| **Demonstrates** | BR-06/07. Approval limits (BWP 2,000,000 / 10,000,000), committees and delegations. |
| **Evaluate** | Authority matrix. |

![ADM-05 Authority, committees, and delegations — admin.kwu](screens/ADM-05--admin.kwu.jpg)

### ADM-06 — Procurement policy profiles

| | |
|---|---|
| **Persona** | `admin.kwu` (Kalahari Water Utilities) |
| **URL** | `/buyer/admin/policy/profiles` |
| **Demonstrates** | FR-22, §17. Policy profiles with versions and the events using them. |
| **Evaluate** | Profile versioning. |

![ADM-06 Procurement policy profiles — admin.kwu](screens/ADM-06--admin.kwu.jpg)

### ADM-07 — Forms and business fields

| | |
|---|---|
| **Persona** | `admin.kwu` (Kalahari Water Utilities) |
| **URL** | `/buyer/admin/policy/fields` |
| **Demonstrates** | FR-22. Custom business fields. |
| **Evaluate** | Field configuration. |

![ADM-07 Forms and business fields — admin.kwu](screens/ADM-07--admin.kwu.jpg)

### ADM-08 — Template and content library

| | |
|---|---|
| **Persona** | `admin.kwu` (Kalahari Water Utilities) |
| **URL** | `/buyer/admin/policy/templates` |
| **Demonstrates** | FR-22. Template and content library. |
| **Evaluate** | Template lifecycle. |

![ADM-08 Template and content library — admin.kwu](screens/ADM-08--admin.kwu.jpg)

### ADM-09 — Qualification programs

| | |
|---|---|
| **Persona** | `mpho.manager` (Kalahari Water Utilities) |
| **URL** | `/buyer/admin/qualification` |
| **Demonstrates** | FR-06. Qualification program "Water Infrastructure Suppliers — Category A" scoped to WTR-INFRA. |
| **Evaluate** | Program scope and criteria. |

![ADM-09 Qualification programs — mpho.manager](screens/ADM-09--mpho.manager.jpg)

### ADM-10 — Calendars and deadline policies

| | |
|---|---|
| **Persona** | `admin.kwu` (Kalahari Water Utilities) |
| **URL** | `/buyer/admin/calendars/1` |
| **Demonstrates** | BR-11/12. Calendar "Botswana Public Holidays 2026" and deadline policies. |
| **Evaluate** | Holiday list and impact review. |

![ADM-10 Calendars and deadline policies — admin.kwu](screens/ADM-10--admin.kwu.jpg)

### ADM-11 — Public portal and publication policy

| | |
|---|---|
| **Persona** | `admin.kwu` (Kalahari Water Utilities) |
| **URL** | `/buyer/admin/policy/portal` |
| **Demonstrates** | FR-08. Public portal and publication policy. |
| **Evaluate** | Disclosure settings. |

![ADM-11 Public portal and publication policy — admin.kwu](screens/ADM-11--admin.kwu.jpg)

### ADM-12 — Notification rules and messages

| | |
|---|---|
| **Persona** | `admin.kwu` (Kalahari Water Utilities) |
| **URL** | `/buyer/admin/notification-rules` |
| **Demonstrates** | FR-21. Notification rules and messages. |
| **Evaluate** | Recipients and mandatory notices. |

![ADM-12 Notification rules and messages — admin.kwu](screens/ADM-12--admin.kwu.jpg)

### ADM-13 — Reports and controlled exports

| | |
|---|---|
| **Persona** | `mpho.manager` (Kalahari Water Utilities) |
| **URL** | `/buyer/admin/reports` |
| **Demonstrates** | FR-21. Report definitions and controlled exports. |
| **Evaluate** | Export history and audiences. |

![ADM-13 Reports and controlled exports — mpho.manager](screens/ADM-13--mpho.manager.jpg)

### ADM-14 — Audit, retention, and legal holds

| | |
|---|---|
| **Persona** | `pule.auditor` (Kalahari Water Utilities); `mpho.manager` (Kalahari Water Utilities) |
| **URL** | `/buyer/admin/records/holds`<br>`/buyer/admin/records/disposals/1` (disposal blocked by a legal hold (AC-35)) |
| **Demonstrates** | FR-22, AC-35, BR-40. Legal holds and the disposal of T-2025-0003 records blocked by a hold. |
| **Evaluate** | The blocked disposal. |

![ADM-14 Audit, retention, and legal holds — pule.auditor](screens/ADM-14--pule.auditor.jpg)

![ADM-14 disposal blocked by a legal hold (AC-35) — mpho.manager](screens/ADM-14--mpho.manager--disposal-blocked.jpg)

### ADM-15 — Integration register and reconciliation

| | |
|---|---|
| **Persona** | `admin.kwu` (Kalahari Water Utilities) |
| **URL** | `/buyer/admin/service/integrations`<br>`/buyer/admin/service/exceptions` (integration exceptions) |
| **Demonstrates** | FR-22, AC-33. Integration register and the open external-publication exception. |
| **Evaluate** | Exception assignment and reconciliation. |

![ADM-15 Integration register and reconciliation — admin.kwu](screens/ADM-15--admin.kwu.jpg)

![ADM-15 integration exceptions — admin.kwu](screens/ADM-15--admin.kwu--exceptions.jpg)

### ADM-16 — Imports, duplicate review, and historical onboarding

| | |
|---|---|
| **Persona** | `admin.kwu` (Kalahari Water Utilities) |
| **URL** | `/buyer/admin/service/imports` |
| **Demonstrates** | FR-22. Imports and historical records (C-2025-0007 from "Legacy spreadsheet 2025"). |
| **Evaluate** | Review and acceptance of imported records. |

![ADM-16 Imports, duplicate review, and historical onboarding — admin.kwu](screens/ADM-16--admin.kwu.jpg)

### ADM-17 — Subscription and organization offboarding

| | |
|---|---|
| **Persona** | `admin.kwu` (Kalahari Water Utilities) |
| **URL** | `/buyer/admin/service/subscription` |
| **Demonstrates** | FR-22, AC-36. Subscription and exit. |
| **Evaluate** | Service arrangements. |

![ADM-17 Subscription and organization offboarding — admin.kwu](screens/ADM-17--admin.kwu.jpg)

## Operations

TenderIQ platform operations (`ops.admin`, `support.agent`).

### OPS-01 — Customer organization register

| | |
|---|---|
| **Persona** | `ops.admin` (TenderIQ Platform Operations) |
| **URL** | `/ops/customers` |
| **Demonstrates** | FR-22. Customer register; no automatic visibility of customer tender content. |
| **Evaluate** | Customer data shown to operators. |

![OPS-01 Customer organization register — ops.admin](screens/OPS-01--ops.admin.jpg)

### OPS-02 — Customer onboarding and offboarding

| | |
|---|---|
| **Persona** | `ops.admin` (TenderIQ Platform Operations) |
| **URL** | `/ops/offboarding/1`<br>`/ops/customers/3/onboarding` (onboarding) |
| **Demonstrates** | FR-22, AC-36, BR-47. ODC exit plan in draft with a live tender and contract; KWU onboarding. |
| **Evaluate** | Continuity and export plan. |

![OPS-02 Customer onboarding and offboarding — ops.admin](screens/OPS-02--ops.admin.jpg)

![OPS-02 onboarding — ops.admin](screens/OPS-02--ops.admin--onboarding.jpg)

### OPS-03 — Plans, entitlements, and commercial accounts

| | |
|---|---|
| **Persona** | `ops.admin` (TenderIQ Platform Operations) |
| **URL** | `/ops/subscriptions` |
| **Demonstrates** | FR-22. Plans, entitlements and subscriptions. |
| **Evaluate** | Entitlements. |

![OPS-03 Plans, entitlements, and commercial accounts — ops.admin](screens/OPS-03--ops.admin.jpg)

### OPS-04 — Support cases and temporary access

| | |
|---|---|
| **Persona** | `support.agent` (TenderIQ Platform Operations) |
| **URL** | `/ops/support/cases/1`<br>`/ops/support/grants` (access grants) |
| **Demonstrates** | FR-22, AC-15. Support case with a time-limited, customer-authorized access grant; no business impersonation. |
| **Evaluate** | Grant scope and expiry. |

![OPS-04 Support cases and temporary access — support.agent](screens/OPS-04--support.agent.jpg)

![OPS-04 access grants — support.agent](screens/OPS-04--support.agent--grants.jpg)

### OPS-05 — Service incidents and continuity

| | |
|---|---|
| **Persona** | `ops.admin` (TenderIQ Platform Operations) |
| **URL** | `/ops/incidents/1` |
| **Demonstrates** | FR-22. Resolved service incident linked to T-2026-0002. |
| **Evaluate** | Customer notices and deadline decisions left to the buyer. |

![OPS-05 Service incidents and continuity — ops.admin](screens/OPS-05--ops.admin.jpg)

### OPS-06 — Platform oversight

| | |
|---|---|
| **Persona** | `ops.admin` (TenderIQ Platform Operations) |
| **URL** | `/ops/oversight`<br>`/ops/supplier-duplicates` (duplicate suppliers) |
| **Demonstrates** | FR-22. Platform oversight and supplier duplicate review. |
| **Evaluate** | That no confidential procurement content is exposed. |

![OPS-06 Platform oversight — ops.admin](screens/OPS-06--ops.admin.jpg)

![OPS-06 duplicate suppliers — ops.admin](screens/OPS-06--ops.admin--duplicates.jpg)

### OPS-07 — Product announcements and help content

| | |
|---|---|
| **Persona** | `ops.admin` (TenderIQ Platform Operations) |
| **URL** | `/ops/content/announcements` |
| **Demonstrates** | FR-22. Product announcements and help content. |
| **Evaluate** | Distinction from formal tender notices. |

![OPS-07 Product announcements and help content — ops.admin](screens/OPS-07--ops.admin.jpg)

