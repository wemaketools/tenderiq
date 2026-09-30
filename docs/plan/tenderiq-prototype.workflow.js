export const meta = {
  name: 'tenderiq-prototype',
  description: 'Stage A: build the complete TenderIQ UI prototype (all screens) on typed API contracts and a static-data mock API, verify it, produce a walkthrough, then STOP for human approval',
  whenToUse: 'After the owner approves docs/plan/architecture-plan.md (revision 3). Stage B (tenderiq-backend) must never start without explicit approval of the prototype. Requires Docker (local Supabase stack for auth).',
  phases: [
    { title: 'A1 Foundation', detail: 'scaffold → contracts-core → (mock-platform ∥ ui-shell) → integrate → gate' },
    { title: 'A2 Domains', detail: '17 domains pipelined, no barrier: contract+fixtures+mock → UI → adversarial review → fix' },
    { title: 'A3 Integration', detail: 'catalog/OpenAPI, cross-fixture consistency, follow-ups, gate' },
    { title: 'A4 QA', detail: '10 auditors → dedup → adversarial verification → fixers → gate' },
    { title: 'A5 Handoff', detail: 'walkthrough screenshots + review guide ∥ docs sync → final gate → STOP for approval' },
  ],
}

// ───────────────────────────── configuration & resume ─────────────────────────────
const A = args || {}
const BRANCH = A.branch || 'build/tenderiq-core'
const COMMITS = A.checkpointCommits !== false
const RESUME = A.resume || {}
const SKIP_PHASES = RESUME.skipPhases || []
const SKIP_UNITS = RESUME.skipUnits || []
const REPO = 'C:\\Code\\Brittany\\TenderIQ'
const TRAILER = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'
const COMPLETED = []

const RULES = `You are one agent in a multi-agent build of the TenderIQ web application in ${REPO}
(Windows 11. Use the Bash tool (Git Bash, path /c/Code/Brittany/TenderIQ) or PowerShell. Node 24 (the pinned runtime, DD-45) and npm 11 are installed. Docker Desktop is running.)

THIS IS STAGE A: A UI PROTOTYPE. You build the complete SPA, typed API contracts (src/contracts), and a mock API (src/mock-api) that serves STATIC fixture data. There is NO application database schema and NO real business logic in this stage. The local Supabase Docker stack runs for AUTHENTICATION ONLY (DD-43): the SPA signs in with supabase-js, and the mock API verifies the real JWT and maps the account to its fixture persona. Never create migrations, business code under src/server (only the platform modules lib/config, lib/supabase and lib/auth/verify.ts, owned by mock-platform) or api/ functions. Never reset or modify the Supabase stack except through the scripts your task names.

BINDING DOCUMENTS. Read the parts relevant to your task before writing anything:
- docs/plan/design-decisions.md: decision log DD-01 … DD-45 (DD-38 withdrawn, superseded by DD-43). It amends the plan and the blueprint and WINS on any conflict. Read it in full.
- docs/plan/architecture-plan.md: §0 stages, §3.10 contracts, §3.11 prototype mode, §4 layout/URL map, §5 ownership, §7 design system.
- docs/plan/schema-blueprint.md: field names, enumerations and permission codes that contracts must mirror so Stage B can implement them.
- docs/plan/demo-storyline.md: the single demo world for fixtures.
- docs/architecture-brief.md: conventions (TypeScript, ESLint, zod, problem+json, SPA rules §10).
- docs/PRD.md: always §4, §8, §10, plus the sections your task names. For UI screens, the "Required information" and "Principal actions" columns of the screen tables are binding.
- docs/technical/*: technical documentation of the design (read-only for you unless your task says otherwise).
- docs/plan/foundation-contract.md: the real APIs of the foundation. Use it if it exists.
- docs/screenshots/*.png and docs/css/**: the visual reference.

HARD RULES:
1. No placeholders. No TODO/FIXME, lorem ipsum, "coming soon", dead buttons, or no-op handlers. Static data may exist ONLY in src/mock-api/fixtures/**. UI code never hard-codes business data; it always goes through the API client. Everything you define is complete, with loading/empty/error/restricted states and tests.
2. Write ONLY the paths you own (listed in your task). You may read anything. Other agents write other paths at the same time. Never modify, delete or reformat files you do not own. Report needed changes elsewhere in followUps.
3. Do not add npm dependencies or edit package.json files unless your task says so.
4. Never run state-changing git commands unless your task says so.
5. TypeScript strict per the brief. No 'any'. Consistent type imports. Zod v4. Money and scores are decimal STRINGS with a currency. Instants are ISO strings. Deadlines always travel with their IANA official time zone.
6. UI uses only the design system (src/ui/src/theme + src/ui/src/components): tokens only, no raw hex, no literal pixel gaps. It matches docs/screenshots.
7. Ports: never use 3001/5173 (reserved for the owner). If your task gives you a port pair, use it for the mock API (npx tsx scripts/dev/serve-mock-api.ts --port <P>) and Vite (VITE_API_PROXY_TARGET=http://127.0.0.1:<P> npx vite --port <Q> in src/ui). Stop any server you start.
8. When typechecking while others are working, filter the output to your own paths. Your files must be error-free.
9. Your final message is data for an orchestrator, not prose for a human.`

// ───────────────────────────── schemas ─────────────────────────────
const S = (props, req) => ({ type: 'object', properties: props, required: req || Object.keys(props) })
const STR = { type: 'string' }
const STRS = { type: 'array', items: STR }
const FOLLOWUP_KINDS = ['permission', 'enum', 'shared_component', 'contract_common', 'mock_platform', 'dependency', 'wiring', 'other']
const REPORT = S({
  summary: STR, filesWritten: STRS,
  checks: S({ typecheck: STR, lint: STR, tests: STR }),
  endpoints: { type: 'integer' }, screensCovered: STRS,
  followUps: { type: 'array', items: S({ kind: { type: 'string', enum: FOLLOWUP_KINDS }, description: STR, detail: STR }) },
  openIssues: STRS,
})
const REVIEW = S({
  verdict: { type: 'string', enum: ['pass', 'gaps'] },
  gaps: { type: 'array', items: S({ requirement: STR, severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, file: STR, description: STR, fix: STR }) },
})
const FIX = S({ summary: STR, filesChanged: STRS, remaining: STRS })
const GATE = S({
  passed: { type: 'boolean' },
  commandResults: { type: 'array', items: S({ command: STR, ok: { type: 'boolean' }, summary: STR }) },
  failures: { type: 'array', items: S({ area: STR, command: STR, files: STRS, errorExcerpt: STR }) },
})
const FINDINGS = S({ findings: { type: 'array', items: S({
  title: STR, severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, category: STR,
  file: STR, line: { type: 'integer' }, requirement: STR, evidence: STR, suggestedFix: STR, area: STR }) } })
const VERDICT = S({ refuted: { type: 'boolean' }, reasoning: STR })

// ───────────────────────────── domains ─────────────────────────────
const DOMAINS = [
  { id: 'workspace', num: '00', title: 'Workspace: tasks, approvals, notifications, documents, calendars, notification rules',
    contracts: ['approvals', 'tasks', 'notifications', 'documents', 'audit', 'calendars', 'notification-rules'],
    ui: ['tasks', 'approvals', 'notifications', 'documents', 'calendars'],
    fr: 'FR-21, BR-06, BR-07, BR-10, BR-41, BR-42', screens: 'COM-04, COM-05, COM-06, COM-07, ADM-10, ADM-12', ac: 'AC-05 and AC-06 as displayed (authority routing hint, invalidated approval)', prd: '§4.2, §11.1, §13.2 (ADM-10, ADM-12), §14',
    notes: `contracts-core already wrote first versions of the approvals/tasks/notifications/documents/audit/calendars contracts for the shell's shared widgets. You now OWN them: extend them to cover every page action. COM-04 inbox: tasks for the active org with source record links, owner, due date, overdue, delegation/reassignment within authority; the cross-org count comes from /me/tasks/summary. COM-05 approval decision: exact version snapshot, amount, scope, justification, evidence documents, previous decisions, conflicts, the approver's authority limit, approve / conditional / reject / return with required reasons, an "exceeds your authority — routed to X" state (AC-05), and an "invalidated by change" state (AC-06). COM-06: Unread / Requires acknowledgment / All; reading is visibly distinct from acknowledging (BR-41); preferences with mandatory types locked. COM-07 document viewer: classification, version history, redacted copy vs original, and download only if permitted (sealed documents never downloadable). ADM-10 calendars: working days, holidays, approval, and impact review of active tenders. ADM-12 notification rules. Fixtures cover every persona.` },
  { id: 'org-admin', num: '01', title: 'Identity & organization administration', contracts: ['org-admin'], ui: ['account', 'admin-org', 'admin-access'],
    fr: 'FR-01, FR-03, PRD §5.4, BR-02, BR-06, BR-07, BR-38', screens: 'COM-01 (invitation acceptance /invite/:token), COM-02 (org list/pending memberships page beyond the shell picker), COM-03, ADM-01, ADM-02, ADM-03, ADM-04, ADM-05, SUP-04', ac: 'AC-02, AC-03, AC-04', prd: '§4, §5.1, §5.3, §5.4, §11.1, §13.2',
    notes: `The same screens serve /buyer/admin/* and /supplier/admin/*; grantable role templates depend on tenant kind (a supplier admin never sees buyer privileges). User lifecycle: invited/pending/active/suspended/deactivated; reissue an expired invitation; deactivation shows open tasks to reassign and delegations to review; historical actions stay attributed (AC-04, BR-38). Access review: effective permissions (roles via membership and groups, direct grants with owner/reason/expiry, restrictions winning), grants expiring soon, and incompatible authority per SoD policies. Nobody can grant what they do not hold. Delegations are capped at the delegator's limit. The conflict-declaration review queue shows dual buyer/supplier memberships (sam.dual, AC-02). Structure values are deactivated, never deleted. SUP-04: members, groups, tender assignments, signing limits, submission authority; a contributor cannot submit or self-grant (AC-03). COM-03 profile: language, display time zone, contact changes needing confirmation.` },
  { id: 'policy', num: '02', title: 'Policy profiles, forms, templates, public portal policy', contracts: ['policy'], ui: ['admin-policy'],
    fr: 'FR-22, PRD §17, BR-09', screens: 'ADM-06, ADM-07, ADM-08, ADM-11', ac: 'supports AC-06', prd: '§13.2, §17, §18.1',
    notes: `Versioned policy profiles (draft/in_review/approved/retired). An approved version is immutable, and the page shows which tenders use each version. Custom fields with conditional required rules, plus an exported reusable CustomFieldsSection component (src/ui/src/features/admin-policy/components/CustomFieldsSection.tsx) that other forms can embed. Report a wiring followUp for the request, tender, qualification and contract forms. Templates library (tender_package, questionnaire, criteria_set, clause, letter, checklist, contract) with versions, owner, review date, approval and retirement; retired templates cannot be selected. ADM-11 portal disclosure settings with approval. Mandatory controls cannot be hidden.` },
  { id: 'suppliers', num: '03', title: 'Supplier registration, profile, evidence library, directory and relationships', contracts: ['suppliers'], ui: ['supplier-org', 'supplier-directory'],
    fr: 'FR-02, BR-03, BR-44, BR-45', screens: 'SUP-02 (public /register + membership request), SUP-03, SUP-05, BUY-31, BUY-32, plus operator duplicate review and legal-identity change review pages', ac: 'AC-07 (registration is not qualification)', prd: '§2.1, §3, §5.2, §11.3, §12.1 (BUY-31/32), §18.1',
    notes: `Public registration flow (contact verification, membership approval, identity verification and qualification are separate statuses). A possible duplicate shows only "an organization with similar details exists — request membership or continue" and discloses nothing else. Membership requests. Legal-identity change requests with evidence and history. Evidence library: add, replace prospectively, renew, withdraw future sharing per buyer, and show where each edition was formally submitted. Financial evidence is only visible to supplier.financial.view personas. BUY-31 directory (identity, categories, relationship, qualification scope, evidence freshness from shared evidence only). BUY-32 buyer-specific relationship record that never shows other buyers' assessments (BR-45). Banking details are not collected (explained).` },
  { id: 'qualification', num: '04', title: 'Qualification programs, applications, assessment, decisions, monitoring', contracts: ['qualification'], ui: ['qualification'],
    fr: 'FR-06, BR-03, BR-23, BR-24, BR-25, BR-48', screens: 'ADM-09, SUP-20, SUP-24, BUY-33, BUY-34, BUY-35', ac: 'AC-07, AC-08, AC-09', prd: '§7.3, §8.3, §11.3, §12.1 (BUY-33..35)',
    notes: `Programs are versioned, with criteria per assessment area (PRD §7.3). Application states follow PRD §8.3; buyer views never show drafts. N/A needs a reason. Missing evidence is never a pass. Screening flags only prompt review (BR-48). The financial review panel is visible only to the financial reviewer persona (lesego.finance) and deciders, and records period, currency, consolidated flag, source and review date, plus info requests to the supplier (AC-08, Makgadikgadi). Decisions show outcome, scope, dates, conditions with allowed activities and blocked gate, reasons, supplier explanation and appeal route, and are superseded rather than overwritten. Monitoring shows reassessment triggers (Chobe insurance expiring, AC-09) with impacted active bids/contracts and an explicit disposition. SUP-24 separates buyer-specific decisions. The UI clearly shows "Registered — not qualified for <category>" (AC-07).` },
  { id: 'requests', num: '05', title: 'Procurement requests, funding decisions, planning, advance notices, strategy', contracts: ['requests'], ui: ['requests', 'planning'],
    fr: 'FR-04, FR-05, BR-06, BR-10', screens: 'BUY-02, BUY-03, BUY-04, BUY-05, BUY-06, PUB-06 (public page)', ac: 'AC-05, AC-39 (strategy side)', prd: '§6, §7.1, §7.2, §8.1, §11.2 (PUB-06), §12.1 (BUY-02..06)',
    notes: `Request states per PRD §8.1. The business case form covers every FR-04 field and distinguishes indicative / approved budget / firm commitment. Info requests, combine (keeps originals; approval uses the aggregate value), split, route to an existing contract, defer, reject with reasons. A material change shows re-approval required. The funding decision shows the authority check and the higher route when exceeded (PR-2026-0003, AC-05). "Create tender" links to /buyer/tenders/new?fromRequest=ID. Planning: plan items, a month calendar, dependencies, resource demand, owners, advance notices (PUB-06 says forecasts are not invitations). Strategy (BUY-06): procedure per the FR-05 table, direct-award grounds, market research flagged unverified vs supplier commitment, fairness review on prior involvement, and strategy approval.` },
  { id: 'tenders', num: '06', title: 'Tender authoring and release approval', contracts: ['tenders'], ui: ['tender-authoring'],
    fr: 'FR-07, BR-01, BR-09, BR-10, BR-11, BR-12, BR-16', screens: 'BUY-07, BUY-08, BUY-09, BUY-10, BUY-11, BUY-12, BUY-13', ac: 'AC-06', prd: '§7.4, §8.2, §9.1, §12.1 (BUY-07..13)',
    notes: `Create from template, prior event (copies structure, never bids/deliberations/approvals/outcomes), blank, or approved request/strategy. "Save as template". Overview with readiness and team roles. Lots and requirements with owner, applicability, response type, treatment (mandatory gate vs rated vs information), envelope, and missing-item consequence; contradiction/missing-owner warnings. Pricing schedules (one-time vs recurring, optional, provisional, evaluation periods). Evaluation plan: weights must total 100 (validation message), threshold scope, price method, zero/missing price treatment, decimals, anchors, tie rules, and approval. Timetable in the official zone with calendar working-day hints and coherence checks; envelopes; participation conditions. Release review: checklist by area, supplier and public preview of the package, and release approval. A material edit after approval shows the approval invalidated (T-2026-0005, AC-06). Publication stays blocked while incomplete.` },
  { id: 'publication', num: '07', title: 'Publication, participants and access, public portal, supplier discovery and pursuit', contracts: ['publication'], ui: ['publication', 'public-portal', 'opportunities'],
    fr: 'FR-08, FR-09, BR-14, BR-15, BR-46', screens: 'BUY-14, BUY-15, PUB-01, PUB-02, PUB-03, PUB-07, SUP-06, SUP-07, SUP-08, SUP-09', ac: 'AC-01, AC-33 (external publication failure shown unconfirmed)', prd: '§7.5, §7.6, §11.2, §11.3 (SUP-06..09), §12.1 (BUY-14, BUY-15), §17.2',
    notes: `Publish now or schedule; external notice channel states (awaiting confirmation / confirmed / failed with an exception). Participants: invitations (legal supplier + contact; replacing the contact never changes the supplier), register interest, access requests with decisions, confidentiality acceptance, acknowledgments, delivery status, and the qualification gate. The buyer never sees drafts or pursuits. Public portal without login: home (global and /b/:slug), search with filters/sort (closed and cancelled labelled), notice page at /opportunities/:buyerSlug/:ref (DD-22) (lots, official-time deadlines, public documents, prominent amendment history, register interest / request access / start participation), and guidance from help articles. Invitation-only/restricted tenders (T-2026-0006) never appear publicly or in counts (AC-01). Supplier: discovery (matches are suggestions), saved searches, subscriptions, watchlist, invitations (accept/decline by an authorized rep, optional shared decline reason), opportunity workspace (package, versions, addenda with ack status, sessions, readiness, lot selection), and bid/no-bid + pursuit team + private notes. The buyer-visible bid intent / decline reason changes ONLY through an explicit 'notify buyer' action (DD-41).` },
  { id: 'clarifications', num: '08', title: 'Questions, addenda and date changes, briefings and site visits', contracts: ['clarifications'], ui: ['clarifications'],
    fr: 'FR-10, BR-13, BR-14, BR-16, BR-41', screens: 'BUY-16, BUY-17, BUY-18, SUP-10, SUP-11, PUB-04', ac: 'AC-10', prd: '§7.7, §11.2 (PUB-04), §11.3 (SUP-10, SUP-11), §12.1 (BUY-16..18), §14.2',
    notes: `Questions: late-question disposition, owner, draft answer, confidentiality review (sanitized, no questioner identity), publish to participants/public, answer privately, or escalate to an addendum. Suppliers never see other suppliers' private cases. Addenda: materiality, affected lots/requirements with before/after, response-time assessment, new deadline, existing-submission action (acknowledge/supplement/replace), approval, and issue with recipients and acknowledgment status. A deadline change happens only via an addendum. Sessions: briefing/site visit, capacity, registration, accessibility needs, alternatives, attendance, and minutes as shared answers. PUB-04 is the public edition. AC-10 on T-2026-0002: affected suppliers see the required action, and prior receipts stay intact.` },
  { id: 'bids', num: '09', title: 'Supplier response preparation, submission, receipts, revisions, withdrawal, closing', contracts: ['bids'], ui: ['responses', 'submission-monitoring'],
    fr: 'FR-11, FR-12, BR-17..BR-21', screens: 'SUP-12, SUP-13, SUP-14, SUP-15, SUP-16, SUP-17, BUY-19', ac: 'AC-03, AC-11, AC-12, AC-13, AC-14', prd: '§7.8, §7.9, §8.3, §11.3 (SUP-12..17), §12.1 (BUY-19), §20',
    notes: `Response workspace for initial, next_stage and bafo rounds: lot selection, answers by section with assignment/progress/review comments, reuse flagged for review, deviations. Pricing is restricted to pricing personas; priced / included / not offered are distinct from zero; totals come from decimal strings. Declarations, subcontractors, key personnel, consortium, exceptions, and evidence attached as snapshots. Internal approval per revision; a material change invalidates it. Readiness separates BLOCKING errors from WARNINGS. Submission requires supplier.response.submit (a contributor sees why not, AC-03), shows a context-confirmation dialog, reports progress via aria-live, and returns an official receipt. A failed replacement keeps the earlier receipt effective (Gaborone Metering fixture, AC-12). A late attempt is rejected with the true time recorded (Chobe fixture, AC-13). Explicit withdrawal gives a confirmation number (AC-14). Draft readiness is never displayed as submission (AC-11). BUY-19 shows receipt metadata only (unique suppliers, not revisions), closing status and incidents; there is NO buyer content view.` },
  { id: 'opening', num: '10', title: 'Opening sessions, compliance review, exclusions, bid clarifications', contracts: ['opening'], ui: ['opening'],
    fr: 'FR-13, BR-05, BR-17, BR-22, BR-23, BR-26', screens: 'BUY-20, BUY-21, SUP-18, EVA-03', ac: 'AC-15, AC-16, AC-17', prd: '§7.10, §11.3 (SUP-18), §12.1 (BUY-20, BUY-21), §12.2 (EVA-03)',
    notes: `Opening session: officer + witness/quorum confirmation, stage selection (single or staged qualification → technical → commercial), commercial blocked until the price gate is released (AC-16), and a record of participants, time, irregularities, minutes and the public opening summary. admin.kwu, auditors and support personas get a restricted state with no content (AC-15; T-2026-0008). Compliance checklist per bid with finding class, result, evidence and reason. Clarification requests with permitted scope; the supplier response is attached to the clarification and never becomes a new bid (BR-22). EVA-03 lets the chair consolidate evaluator questions. Exclusions need grounds, approval, a notice and a challenge route. Excluded bids are not ranked, and their unopened price envelopes stay sealed (AC-17).` },
  { id: 'evaluation', num: '11', title: 'Evaluation, commercial comparison, moderation, ranking and report', contracts: ['evaluation'], ui: ['evaluation'],
    fr: 'FR-14, PRD §9, BR-26..BR-29', screens: 'EVA-01, EVA-02, EVA-04, EVA-05, EVA-06', ac: 'AC-18, AC-19, AC-20', prd: '§7.11, §9 (all), §12.2',
    notes: `Assignments: accept, confidentiality undertaking and conflict declaration BEFORE any content, recusal/reassignment. Individual assessment: scale with anchors, rationale required, evidence refs, clarification flag, save/submit; others' scores are hidden until own submission; price is hidden until the gate. A missing score shows as "Not scored", never 0, and the assessment stays incomplete (AC-18). Corrections after submission need a reason and keep history. Commercial comparison: submitted vs corrected vs evaluated cost, FX basis with the original amount visible, reference set, abnormally-low flag for review, and affordability shown separately from rank. Moderation: divergence view, consensus/aggregation with reasons, return to evaluator, originals preserved (AC-20). Ranking & report with sign-off. T-2026-0003 fixtures MUST show exactly PRD §9.2: Serowe (A) 28.00/16.00/12.00/30.00 = 86.00 on evaluated cost 100,000; Tsodilo (B) 31.50/18.00/13.50/25.00 = 88.00 on 120,000; B ranks first (AC-19).` },
  { id: 'selection', num: '12', title: 'Demonstrations and references, shortlist, preferred bidder, due diligence, negotiation and BAFO', contracts: ['selection'], ui: ['selection'],
    fr: 'FR-15, FR-16, BR-30, BR-31', screens: 'BUY-22, BUY-23, BUY-24, BUY-25, BUY-27, SUP-19 (+ supplier assessment invites)', ac: 'AC-21, AC-22, AC-23, AC-24', prd: '§7.12, §7.13, §11.3 (SUP-18, SUP-19), §12.1 (BUY-22..25, BUY-27), §20',
    notes: `Assessment sessions have a declared basis (scored criterion / claim verification / eligibility gate), equal-treatment confirmation, invitations and findings (AC-21). Reference checks require consent. Shortlist with rule/threshold, include/exclude reasons, approval and outcome notices (AC-22), plus a "create next-stage event" link. Preferred bidder is conditional: scope, value, rationale, remaining checks, topics, contingency and fallback. Never use the word "award" (BR-31). Due diligence findings by area. A failure blocks award and requires a recorded fallback decision (T-2026-0009, AC-24). Negotiation/BAFO is blocked with an explanation when not permitted, and requires a process decision (AC-23). Mandate, rounds, minutes, concessions. SUP-19 shows only the supplier's own negotiation and links to the response workspace for a BAFO submission.` },
  { id: 'awards', num: '13', title: 'Award recommendation and approval, notices and standstill, debriefs and complaints, closeout', contracts: ['awards'], ui: ['awards', 'outcomes'],
    fr: 'FR-17, BR-31..BR-35', screens: 'BUY-26, BUY-28, BUY-29, BUY-30, SUP-21, SUP-22, PUB-05', ac: 'AC-25, AC-26, AC-27, AC-29, AC-39', prd: '§7.14, §8.2, §8.3, §11.2 (PUB-05), §11.3 (SUP-21, SUP-22), §12.1 (BUY-26, BUY-28..30), §20',
    notes: `The recommendation assembles evaluation, commercial, affordability, qualification, diligence, negotiation, conflicts and exceptions. Per-lot outcomes (award, partial, conditional, no award, cancelled) reconcile to totals. T-2026-0001 shows lot 1 awarded, lot 2 cancelled, lot 3 in evaluation, overall "Partially awarded" (AC-26). Intent notice is distinct from final award. The standstill shows calendar, end date, extensions and blocked actions. Final award is blocked while a complaint hold is active (T-2026-0007, AC-25). Debrief shows the recipient's own result only (AC-27). Complaints: standing, acknowledgment, independent owner, hold, investigation, response, appeal, closure and history. Redacted public award notice (PUB-05 search/detail). Closeout gate lists blocking reasons, including an unaccepted handover (AC-29). The RFI path is information_collected with findings and a linked next step (T-2026-0004, AC-39).` },
  { id: 'contracts', num: '14', title: 'Contract formation, handover, obligations, performance, finance, changes, renewal, closeout', contracts: ['contracts'], ui: ['contracts'],
    fr: 'FR-18, FR-19, BR-04, BR-33, BR-35, BR-36, BR-37', screens: 'CON-01..CON-11, SUP-23', ac: 'AC-28, AC-29, AC-30, AC-31, AC-32', prd: '§7.15, §7.16, §8.3, §13.1, §11.3 (SUP-23)',
    notes: `Create from awarded lot outcomes with reconciling allocations. Legal entity + supplier legal party are required. Differences from the award are flagged and need approval before signature/start (C-2026-0002, AC-28). Signatories with authority; in-app vs externally-recorded signatures (never fabricated). Signed / effective / notice-to-proceed / delivery start are separate milestones. Handover accept/return with omissions; losing bids are never shown. Obligations/milestones: supplier evidence, buyer accept/reject with reasons and remediation; payment readiness never implied (AC-30). Performance reviews with supplier response before finalization. The financial view labels source and as-of date and never shows estimates as paid. Change requests show the cumulative value and the authority check on the cumulative figure (C-2026-0001, AC-31). Renewal options: notice windows, explicit decision, "no automatic renewal" (AC-32). Closeout with surviving obligations. SUP-23 shows the supplier's own contracts only.` },
  { id: 'reporting', num: '15', title: 'Dashboards, management reports, exports, global search, audit/retention/legal holds', contracts: ['reporting', 'records'], ui: ['dashboard', 'reports', 'records', 'search'],
    fr: 'FR-21, FR-22, PRD §15, §18, BR-39, BR-40, BR-43', screens: 'BUY-01, SUP-01, REP-01, REP-02, ADM-13, ADM-14, COM-08', ac: 'AC-34, AC-35', prd: '§13.2 (ADM-13, ADM-14), §13.4, §15, §18',
    notes: `BUY-01 is modelled closely on docs/screenshots/overview.png: quick-range chips + filter bar, KPI cards (active events, pending approvals, closing within 7 days, open complaints, renewals within 90 days, overdue obligations), pipeline-by-stage bar list, deadlines, workload chart, "Requires attention", and drill-through links. SUP-01 supplier dashboard. REP-01 report families (§15.1) with §15.2 safeguards: unique organizations not revisions (AC-34), event vs lot level labelled, currency basis and conversion date stated, completeness indicators. REP-02/ADM-13: definitions, preview of scope and redactions, schedules, exports with a manifest. COM-08 search shows only authorized results and counts (BR-43), plus saved views. ADM-14: audit viewer, retention classes, legal holds, disposal blocked while held (AC-35), evidence packs. Reports and reports.png styling follow docs/screenshots/reports.png.` },
  { id: 'operations', num: '16', title: 'Platform operations, integrations, imports, subscription/offboarding, help and service cases', contracts: ['operations'], ui: ['ops', 'help', 'admin-integrations'],
    fr: 'FR-22, PRD §21, BR-46, BR-47', screens: 'OPS-01..OPS-07, ADM-15, ADM-16, ADM-17, COM-09', ac: 'AC-33, AC-36', prd: '§13.2 (ADM-15..17), §13.3, §16, §19, §20, §21',
    notes: `Operator area with no tender content: customer register, onboarding/offboarding plans (ODC offboarding with live tender and contract, AC-36), plans/entitlements (usage limits create service actions and never block submissions), support cases with customer-authorized, time-limited access grants (the buyer-side authorization page lives here too; never impersonation), service incidents with impacts, platform oversight (privileged access reviews, aggregate usage), announcements and help content management. Buyer ADM-15 integration register with exceptions and reconciliation (failed external publication, AC-33). ADM-16 imports with quality issues, duplicate candidates, review, and provenance. ADM-17 subscription and offboarding request. COM-09 help center, accessibility accommodation requests and service cases. Support is never a bid-submission channel. Settings styling follows docs/screenshots/settings.png.` },
]

// ───────────────────────────── ownership ─────────────────────────────
const AREAS = ['scaffold', 'contracts-core', 'mock-platform', 'ui-shell', 'integration'].concat(DOMAINS.map(d => 'domain:' + d.id))
function ownedPaths(area) {
  if (area.indexOf('domain:') === 0) {
    const d = DOMAINS.find(x => 'domain:' + x.id === area)
    if (!d) return 'nothing (unknown area) — report instead of editing'
    const c = d.contracts
    return c.map(x => 'src/contracts/' + x + '.ts, src/contracts/' + x + '/**').concat(
      c.map(x => 'src/mock-api/handlers/' + x + '.ts, src/mock-api/handlers/' + x + '/**, src/mock-api/fixtures/' + x + '.ts, src/mock-api/fixtures/' + x + '/**'),
      c.map(x => 'src/ui/src/api/' + x + '.ts'),
      d.ui.map(u => 'src/ui/src/features/' + u + '/**'),
      ['.build/progress/A/' + d.id + '.json']).join(', ')
  }
  const M = {
    'scaffold': 'root package.json, src/ui/package.json, e2e_tests/package.json, tsconfig*.json, eslint configs, vitest.config.ts, vercel.json, .gitignore, .gitattributes, .nvmrc, supabase/config.toml, supabase/.gitignore, scripts/db/ensure-signing-keys.mjs, .env.local (local only), run.ps1, .github/workflows/ci.yml, CLAUDE.md, README.md, docs/local-development.md, src/ui/{index.html,vite.config.ts,tsconfig*.json,eslint.config.js,.prettierrc}, e2e_tests/playwright.config.ts',
    'contracts-core': 'src/contracts/{common,enums,endpoint,permissions,decimal,session,approvals,tasks,notifications,documents,audit,calendars}.ts and their tests',
    'mock-platform': 'src/mock-api/{app.ts,middleware/**,registry.ts,persona.ts,fixtures/platform.ts,fixtures/session.ts,handlers/session.ts,testing/**}, src/server/lib/config/**, src/server/lib/supabase/**, src/server/lib/auth/verify.ts, src/server/tests/unit/platform-auth/**, .env.example, .env.local.example, scripts/dev/{serve-mock-api.ts,dev-prototype.mjs,seed-auth-personas.ts}, scripts/docs/**, scripts/ci/{scan-secrets.ts,scan-bundle.ts,assert-test-run.ts}',
    'ui-shell': 'src/ui/src/** except src/ui/src/features/** and src/ui/src/api/<domain>.ts; e2e_tests/specs/**',
    'integration': 'src/contracts/catalog.ts, src/mock-api/registry.ts, src/mock-api/fixtures/consistency.test.ts, docs/technical/api/**, package.json test-count floors, and fix-only edits anywhere in Stage A paths',
  }
  return M[area] || 'nothing (unknown area) — report instead of editing'
}

// ───────────────────────────── helpers (retry, circuit breaker, gates, checkpoints) ─────────────────────────────
let consecutiveFailures = 0
let HALTED = false
async function run(prompt, opts, tries) {
  const n = tries || 2
  for (let i = 0; i < n; i++) {
    if (HALTED) throw new Error('halted by circuit breaker')
    const r = await agent(prompt, i === 0 ? opts : Object.assign({}, opts, { label: opts.label + ':retry' }))
    if (r) { consecutiveFailures = 0; return r }
    consecutiveFailures++
    log('agent ' + opts.label + ' returned no result (' + consecutiveFailures + ' consecutive failures)')
    if (consecutiveFailures >= 4) { HALTED = true; log('CIRCUIT BREAKER: 4 consecutive agent failures (likely outage). Halting; resume later with args.resume.'); throw new Error('halted by circuit breaker') }
  }
  return null
}

function gatePrompt(name, commands) {
  return RULES + `

TASK: Verification gate "${name}". You are READ-ONLY for source files. Only run commands. Use ports 4190 (mock API) and 5290 (Vite) for runtime checks. Run each command from the repo root and capture the outcome (generous timeouts; run long commands in the background and wait):
${commands.map((c, i) => (i + 1) + '. ' + c).join('\n')}
passed = true only if EVERY command succeeded. For each failure, find the ROOT-CAUSE file(s) and set area to the owning area, one of: ${AREAS.join(', ')} (ownership: docs/plan/architecture-plan.md §5, Stage A). Give the real error text, trimmed. Group duplicates.`
}
function fixPrompt(area, failures, stage) {
  return RULES + `

TASK: Fix verification failures from gate "${stage}" for area "${area}". You own ONLY: ${ownedPaths(area)}.
Failures:
${JSON.stringify(failures, null, 1)}
Fix root causes properly. Do not suppress errors, skip tests, loosen types, or add eslint-disable. Re-run the failing commands until they pass. If a root cause lies outside your paths, list it in 'remaining' with the exact file and change.`
}
async function gateLoop(name, phaseTitle, commands, maxRounds) {
  let last = null
  for (let r = 1; r <= maxRounds; r++) {
    const g = await run(gatePrompt(name, commands), { label: 'gate:' + name + ':' + r, phase: phaseTitle, schema: GATE, effort: 'medium' })
    if (!g) continue
    last = g
    if (g.passed) { log('gate ' + name + ' passed (round ' + r + ')'); return { passed: true, rounds: r, last: g } }
    const byArea = {}
    for (const f of g.failures) { const k = AREAS.indexOf(f.area) >= 0 ? f.area : 'integration'; (byArea[k] = byArea[k] || []).push(f) }
    log('gate ' + name + ' round ' + r + ': ' + g.failures.length + ' failures in ' + Object.keys(byArea).join(', '))
    if (r === maxRounds) break
    const fixes = await parallel(Object.keys(byArea).map(area => () =>
      run(fixPrompt(area, byArea[area], name), { label: 'fix:' + area + ':' + name + ':' + r, phase: phaseTitle, schema: FIX })))
    const cross = fixes.filter(Boolean).flatMap(x => x.remaining || [])
    if (cross.length) await run(fixPrompt('integration', cross.map(c => ({ area: 'integration', command: 'cross-area', files: [], errorExcerpt: c })), name), { label: 'fix:cross:' + name + ':' + r, phase: phaseTitle, schema: FIX })
  }
  log('gate ' + name + ' NOT passed after ' + maxRounds + ' rounds')
  return { passed: false, rounds: maxRounds, last }
}
async function checkpoint(unit, message, phaseTitle, report) {
  COMPLETED.push(unit)
  return run(`TASK: Record progress for unit "${unit}" in ${REPO}.
1. Write .build/progress/A/${unit}.json containing exactly this JSON (pretty-printed): ${JSON.stringify({ stage: 'A', unit, message, report: report || null })}
2. ${COMMITS ? `Create a git checkpoint commit on branch ${BRANCH}. Run git status --short and confirm that .env.local, node_modules, dist and .qa-scratch are ignored (fix .gitignore if not). Then git add -A and git commit with this message (use a heredoc so the trailer is on its own line):
${message}

${TRAILER}
Never push. If there is nothing to commit, say so.` : 'Do not commit (checkpointCommits disabled).'}
Return the short commit hash or "no commit".`, { label: 'checkpoint:' + unit, phase: phaseTitle, effort: 'low' })
}

const A_GATE_BASE = [
  'npm run typecheck', 'npm run typecheck:ui', 'npm run lint', 'npm run lint:ui', 'npm run test:unit', 'npm run test:ui', 'npm run build', 'npm run ci:security',
  'Runtime smoke: start the mock API on port 4190 in the background (npx tsx scripts/dev/serve-mock-api.ts --port 4190). GET http://127.0.0.1:4190/api/v1/health must return 200 {"status":"ok","version":"v1"} with x-correlation-id. Ensure the local Supabase stack runs (npm run supabase:start) and the demo accounts exist (npm run auth:personas). Sign in tebogo.officer@tenderiq.local / test1234 with the password grant at http://127.0.0.1:54321/auth/v1/token?grant_type=password (apikey = the anon key from .env.local). GET /api/v1/me/context on the mock API with that bearer must return 200 with memberships and environment.mode = "prototype". A forged or expired token must get 401. A request to /api/v1/buyer/... with an X-Tenant-Id the persona is not a member of must return the uniform 403 problem+json. Stop the server afterwards.',
]
const A_GATE_FULL = A_GATE_BASE.concat(['npm run docs:api (OpenAPI regenerates without error and validates)', 'npm run test:e2e:prototype'])

// ═════════════════════════════ main ═════════════════════════════
async function main() {
  // ── A1 Foundation ──
  phase('A1 Foundation')
  let g1 = { passed: true }
  if (SKIP_PHASES.indexOf('A1 Foundation') >= 0) {
    log('Skipping A1 Foundation (resume); verifying foundation state')
    g1 = await gateLoop('A1-resume', 'A1 Foundation', A_GATE_BASE, 3)
  } else {
    const scaffold = await run(RULES + `

TASK: SCAFFOLD (you are the only agent running right now). You own: ${ownedPaths('scaffold')}.
0. Git: 'git checkout -b ${BRANCH}' (or 'git checkout ${BRANCH}' if it exists). This is the ONLY git command you run. Do not commit.
1. Create the repository skeleton per architecture-brief §2, §4 and architecture-plan §4/§9 for STAGE A, while declaring ALL dependencies for both stages now so Stage B never edits dependencies:
   - Root package.json: name "tenderiq", type module, engines node "24.x" (DD-45), workspaces ["src/ui", "e2e_tests"]. Runtime deps: hono, kysely, pg, zod (v4), @supabase/supabase-js, exceljs, nodemailer (DD-44). Dev: typescript, tsx, vitest, eslint, @eslint/js, typescript-eslint, @types/node (v24), @types/pg, @types/nodemailer, jsdom, globals, supabase (exact pinned). Stage A scripts: supabase:start (node scripts/db/ensure-signing-keys.mjs && supabase start), supabase:stop, auth:personas (tsx --env-file-if-exists=.env.local scripts/dev/seed-auth-personas.ts),
     dev:prototype (node scripts/dev/dev-prototype.mjs), dev:mock-api (tsx scripts/dev/serve-mock-api.ts --port 3001), typecheck (tsc -p tsconfig.server.json), typecheck:ui, lint (eslint api src/server src/contracts src/mock-api scripts), lint:ui, build:ui, build (npm run typecheck && npm run build:ui), test, test:unit, test:ui, docs:api (tsx scripts/docs/generate-openapi.ts), ci:security (tsx scripts/ci/scan-secrets.ts && tsx scripts/ci/scan-bundle.ts), ci:test:ui, test:e2e:prototype, verify. Stage B adds its own scripts later.
   - tsconfig.json (brief §4.1). tsconfig.server.json includes api/**, src/server/**, src/contracts/**, src/mock-api/**, scripts/**/*.ts, vitest.config.ts. eslint.config.js (brief §4.2; process.env banned everywhere except src/server/lib/config/index.ts and the Vite config). vitest.config.ts with a unit project (src/server/tests/unit/**, src/contracts/**/*.test.ts, src/mock-api/**/*.test.ts, scripts/**/*.test.ts) and an integration project (src/server/tests/integration/**, passWithNoTests until Stage B).
   - src/ui: package.json "@tenderiq/ui" (react 18, react-dom, @reduxjs/toolkit, react-redux, react-router v7, recharts, @supabase/supabase-js; dev: vite, @vitejs/plugin-react, typescript, vitest, jsdom, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, eslint + react-hooks + react-refresh plugins, prettier; scripts dev/build/typecheck/lint/test). tsconfig.app.json (brief §4.1 SPA settings plus a path alias @contracts/* → ../contracts/*, which is included in compilation). vite.config.ts (envDir = repo root, alias @contracts, /api proxied to VITE_API_PROXY_TARGET or http://127.0.0.1:3001, outDir dist). index.html (title TenderIQ; no external font requests: ui-shell self-hosts fonts, DD-35).
   - e2e_tests: package.json (@playwright/test, @axe-core/playwright). playwright.config.ts with project "prototype" (webServer = mock API + Vite on PROTOTYPE ports from env, default 4180/5280) and projects "smoke"/"full" reserved for Stage B.
   - .nvmrc containing 24. supabase/config.toml per brief §7.3 (project_id "tenderiq", major_version 17, pooler off, seed sql_paths, realtime/edge/analytics off, storage on, [inbucket] enabled with smtp_port = 54325 for the app email channel (DD-44), [auth] site_url http://localhost:5173 with redirect URLs incl. /reset-password and /invite, jwt_expiry 3600, signing_keys_path ./signing_keys.json, refresh rotation on, enable_signup = false, anonymous sign-ins off, MFA off, external providers off, [auth.email] enable_confirmations = false). supabase/.gitignore (signing_keys.json, .branches, .temp). scripts/db/ensure-signing-keys.mjs (generates an ES256 JWK set with node:crypto if missing).
   - .gitignore (brief §8.2 + .qa-scratch/, dist, playwright output, supabase/signing_keys.json; NOT .build/), .gitattributes (LF, *.ps1 CRLF), vercel.json (brief §3.1 verbatim; the mock API is never deployed), run.ps1 (-Prototype runs dev:prototype), .github/workflows/ci.yml (Stage A verify job on Node 24: install, supabase start, auth:personas, typecheck, lint, unit + UI tests, build, ci:security, prototype E2E; the Stage B migrate job is commented as reserved), CLAUDE.md (conventions, pointer to docs/plan and docs/technical, the stage rules, "agents never run git except checkpoint steps"), README.md (Stage A accurate: what the prototype is, how to run it, personas, commands that exist), docs/local-development.md (Stage A).
2. npm install at the root. npx playwright install chromium in e2e_tests. Verify npx tsc --version and npx vitest --version.
3. Run npm run supabase:start (the first run pulls Docker images; run it in the background and wait). Leave the stack RUNNING. Write .env.local (git-ignored) from npx supabase status -o env: APP_ENV=local, LOG_LEVEL=info, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY. Confirm Mailpit answers at http://127.0.0.1:54324.
Do NOT write src/contracts, src/mock-api or src/ui/src code.`, { label: 'scaffold', phase: 'A1 Foundation', schema: REPORT })
    if (!scaffold) return { status: 'failed', phase: 'A1 Foundation', step: 'scaffold' }

    const contractsCore = await run(RULES + `

TASK: CONTRACTS-CORE. You own: ${ownedPaths('contracts-core')}.
Implement architecture-plan §3.10:
- decimal.ts: BigInt-based decimal arithmetic on strings (add, sub, mul, div with explicit scale, compare, round half-up to N places, sum, format with currency), pure and shared by the SPA, the mock API and later the server (DD-32). Exhaustive unit tests, including the PRD §9.2 numbers.
- common.ts: branded id helpers, Money { amount: decimal string, currency: 3 letters }, DecimalString, Instant (ISO 8601 UTC), OfficialDeadline { at, timeZone }, Page<T> { items, total, page, pageSize }, a ListQuery schema (q, page, pageSize, sort, dir), Problem (problem+json incl. errors[{field, code, message}], code, correlationId), and audience literals.
- enums.ts: EVERY enumeration/state from docs/plan/schema-blueprint.md CHECK lists (tenant kind, all lifecycle states, classifications, check types, outcomes…), as const arrays + zod enums + TS types, with a label map for display (the UI uses these labels and StatusChip tones). Name each after its table.column. Write endpoints never offer 'framework_calloff' (DD-40). Provide separate write-enum variants where needed.
- endpoint.ts: defineEndpoint({ id, method, path, audience, permission?, params?, query?, body?, response, errors: string[], screens: string[], idempotent?: boolean }) (idempotent commands accept an Idempotency-Key header, DD-39), a typed path builder, and inferred request/response helper types. Paths must start with /api/v1/{public|me|buyer|supplier|ops} (or /api/v1/health).
- permissions.ts: the full permission catalog (including the DD-23 additions) and the role-template → permission matrix from schema-blueprint §P, honoring PRD §4.1 restrictions (org_admin has no tender content/bid/evaluation permissions; auditor is read-only without sealed access; support.view only via grants). Stage B's seed.sql is checked against this file.
- Shared-surface contracts, complete for the shell and the shared widgets: session.ts (GET /api/v1/me/context → user, theme, memberships [tenant id/kind/name/slug/capacity/status], active tenant permissions when ?tenantId= is given, and environment { mode: "prototype" | "live", appEnv } (the mock API reports "prototype", and the Stage B session domain will report "live"; DD-43); PUT /api/v1/me/theme), approvals.ts (approval status for a subject, request approval, decide, authority check hint), tasks.ts (list, summary {open, overdue}, complete/return/reassign), notifications.ts (list, summary {unread, requiresAcknowledgment}, read, acknowledge, preferences). The /me lists return the caller's OWN rows across all active memberships, each labelled with organization id/name/kind. Actions require X-Tenant-Id equal to the row's tenant (DD-21). documents.ts (metadata, versions, upload envelope create/confirm, download URL, redacted copy), audit.ts (entity history), calendars.ts.
- Unit tests: enums match the blueprint lists (parse the markdown blueprint in the test), and every endpoint path, audience and permission is valid (permission exists in permissions.ts).
Run npm run typecheck (filtered to src/contracts) and npx vitest run --project unit src/contracts.`, { label: 'contracts-core', phase: 'A1 Foundation', schema: REPORT })
    if (!contractsCore) return { status: 'failed', phase: 'A1 Foundation', step: 'contracts-core' }

    const parts = await parallel([
      () => run(RULES + `

TASK: MOCK-PLATFORM. You own: ${ownedPaths('mock-platform')}. Your port pair: 4101/5201.
Implement architecture-plan §3.11 (mock API) with hono + zod only:
- app.ts createMockApp(): the /api/v1 surface; middleware mirroring brief §5.1 order (security headers, correlation id echo, request log to stdout as JSON, problem+json error boundary, REAL Supabase JWT verification via src/server/lib/auth/verify.ts (then map the verified email to its fixture persona; an unknown account gets 401), tenant header validation with ONE identical 403 for every failure, tenant kind enforced by prefix (/buyer buyer, /supplier supplier, /ops operator; /me and /public exempt), permission enforcement from the endpoint's declared permission against the persona's effective permissions for that tenant); GET /api/v1/health.
- mockRoute(app, endpoint, handler): registers the method+path from the contract, parses params/query/body with the contract's schemas (422 problem with errors[] on failure, same CODE|message convention as the brief), calls the handler with { persona, tenant, params, query, body, fixtures helpers }, and VALIDATES the response against the contract schema (a mismatch is a 500 with the details logged, to catch fixture drift). Handlers are pure functions over static fixtures. NOTHING IS PERSISTED between requests.
- persona.ts + fixtures/platform.ts: every tenant and persona from docs/plan/demo-storyline.md with memberships and role templates. Effective permissions are computed from src/contracts/permissions.ts.
- REAL platform modules (Stage B extends them; follow brief §5.4 and §5.7 exactly): src/server/lib/config (zod schema for the Stage A variables APP_ENV, LOG_LEVEL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY; loadConfig/getConfig; ConfigurationError listing every bad variable; blankAsAbsent; the only process.env reader), src/server/lib/supabase (memoized verification and admin clients, JWKS cache), and src/server/lib/auth/verify.ts (decode header → algorithm allow-list (asymmetric only) → kid against the cached JWKS → getClaims → pin iss). Unit tests with forged, expired and none/HS256 tokens. .env.example and .env.local.example (Stage A subset, placeholders only).
- scripts/dev/seed-auth-personas.ts (npm run auth:personas): creates or updates every persona from fixtures/platform.ts in LOCAL Supabase Auth via the Admin API (email confirmed, password test1234). Idempotent; refuses when SUPABASE_URL is not local.
- handlers/session.ts (the session.ts contract; context includes environment { mode: "prototype", appEnv }).
- registry.ts: auto-discovers src/mock-api/handlers/*.ts (and handlers/*/index.ts) at startup with fs + dynamic import. Each module exports 'register(app)'. Load each module in isolation: a failing module is logged and skipped, never crashing the server. The mock API is dev/test only and never bundled.
- testing/: helpers for handler tests (createTestMockApp, signInAs(personaEmail), requestAs(...)).
- scripts/dev/serve-mock-api.ts (node:http bridge, --port) and scripts/dev/dev-prototype.mjs (mock API :3001 + Vite :5173, prefixed output, shared shutdown). scripts/docs/generate-openapi.ts (auto-discovers endpoint maps exported from src/contracts/*.ts; builds OpenAPI 3.1 with z.toJSONSchema into docs/technical/api/openapi.json; fails on duplicate ids or paths). scripts/ci/scan-secrets.ts, scan-bundle.ts (fails if src/ui/dist contains mock-api fixtures, src/server code, server variable names, the service-role key, or the dev-only demo-accounts marker string, DD-43), assert-test-run.ts.
- Tests: real JWT verification against the local stack (a valid persona token passes; forged, expired, alg none/HS256, unknown kid and unknown account are rejected), identical 403s, prefix/kind enforcement, permission 403, 422 shape, response validation, registry isolation, and that a supplier persona never gets another supplier's data through the session contract.`, { label: 'mock-platform', phase: 'A1 Foundation', schema: REPORT }),
      () => run(RULES + `

TASK: UI-SHELL. You own: ${ownedPaths('ui-shell')}. Your port pair: 4102/5202.
Open and study every image in docs/screenshots and all of docs/css. Build the SPA foundation (brief §10, architecture-plan §3.11, §4, §7):
- theme/: port tokens.css, components.css and index.css with --qiq-/.qiq- renamed to --tiq-/.tiq-. Keep light/dark via html[data-theme]. Apply DD-34 during the port: literal pixel gaps become spacing tokens; QuoteIQ-only tokens and chips (series-*, quadrant-*, quoted/won/lost) are dropped; chip tones are generated from the TenderIQ enums; in dark mode the brand and nav-hover text use a sidebar-legible token. Keep the reference footer bar (currency basis + data-as-of + refresh) for dashboards and reports. Self-host Inter and JetBrains Mono woff2 (OFL; download once from the official releases) in src/ui/public/fonts with @font-face; no external font requests (DD-35). Add a CSP meta tag to index.html (DD-30). Add token-only classes for tabs, stepper, timeline, readiness checklist, deadline block, prototype banner, and public header/footer.
- components/ui: Icon (a hand-rolled inline-SVG set, lucide-style 24px stroke, 60+ icons), Button, IconButton, Card, PageHeader (actions rendered into the topbar), FilterBar, DataTable (sortable, selectable, monospace accent refs, numeric alignment, pagination, empty/restricted states, keyboard accessible), KpiCard, StatusChip (tone map for EVERY enum in src/contracts/enums.ts), Dialog, ConfirmActionDialog (acting organization + capacity + scope + consequence; COM-02), Tabs, Stepper, Timeline, Banner (info/success/warning/error, visually distinct), EmptyState, RestrictedState, DetailList, form fields (TextField, TextArea, Select, MultiSelect, Checkbox, RadioGroup, DateInput, DateTimeInput with explicit zone, MoneyInput on decimal strings, NumberInput), problem+json fieldErrors wiring, FileUpload (drag/drop, progress, SHA-256 via WebCrypto, calls a supplied function), OfficialDeadline (official zone + UTC offset + local hint; never a countdown alone), ReadinessChecklist (blocking vs warning vs passed), UnsavedChangesGuard, Pagination, Skeleton.
- components/charts: Recharts wrappers styled with tokens (bar list, donut, line/area, stacked bar).
- components/approvals (ApprovalStatusPanel, RequestApprovalDialog), components/documents (DocumentUploader, DocumentList, DocumentVersionHistory, ClassificationBadge), components/audit (HistoryTimeline). All call the contracts-core contracts via the client.
- components/shell: AppShell (sidebar exactly in the screenshots' style: tenant label "<ORG NAME> (PILOT)", wordmark Tender + accent IQ, "Tender Intelligence", nav from featureRegistry filtered by active tenant kind and permissions, grouped sections, separator before the admin group, user card with switch organization / profile / theme / sign out), Topbar (title, global search → /me/search?q=, notifications bell badge from /me/notifications/summary, tasks badge from /me/tasks/summary (tolerate 404 until those handlers exist), help → /me/help, primary action slot), SelectOrganizationPage (COM-02: memberships incl. pending/suspended with explanations), PublicShell (Opportunities, Awards, Plans, Guidance, Sign in, Register; footer), PrototypeBanner ("Prototype — static demo data", shown when /me/context reports environment.mode = "prototype").
- lib/i18n.ts: t(key, params) over per-feature catalogs collected by import.meta.glob('../features/*/i18n/en.ts') plus a shell catalog. English only, but every UI string goes through t() (DD-37). Document the convention in foundation-contract.md.
- Responsive shell (DD-36): below 1280px the sidebar collapses to an icon rail; below 768px it becomes a drawer. Tables scroll inside their card. The active tenant is remembered per user in localStorage and re-validated by /me/context.
- app/: store, hooks, slices (session, filters, badges; switching tenant clears tenant-scoped state), featureRegistry.ts (import.meta.glob('../features/*/routes.tsx', { eager: true }) collecting 'features: FeatureModule[]'; exported FeatureModule/NavItem/NavSection types), router.tsx (public, auth, /select-organization, /buyer /supplier /ops /me layouts with RouteGuard), RouteGuard.tsx.
- api/client.ts: call(endpoint, { params, query, body }) built on the contract (bearer per request from the supabase-js session, X-Tenant-Id from the store except /me and /public, problem+json normalization, 401 → sign-out, response validation with the contract schema in development). api/session.ts.
- auth/: supabase.ts (the one browser Supabase client, auth only, from VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY; brief §10). There is NO mock auth and NO VITE_AUTH_MODE (DD-43). DemoAccounts (sign-in page quick-pick listing the demo personas grouped by organization; it fills email + password test1234 and signs in for real) is rendered ONLY under import.meta.env.DEV, so Vite strips it from production builds. It contains a unique marker string that scan-bundle checks for. AuthProvider (session, refresh, loads /me/context), SignInPage (one generic error message), ForgotPasswordPage, ResetPasswordPage, permissions.ts (usePermission).
- pages/: NotFound, Forbidden, ContextRequired. lib/format.ts (money from decimal strings, official-time formatting with offset via Intl, relative ages like "38d"), lib/download.ts.
- test/setup.ts + tests for every shared component, the client, RouteGuard, featureRegistry, OfficialDeadline and StatusChip coverage. e2e_tests/specs/prototype/shell.spec.ts: sign in as tebogo.officer, switch org, sign out, shell renders, axe on the shell.
- Verify: npm run typecheck:ui, npm run lint:ui, npm run test:ui and npm run build:ui pass. Start the mock API (4102) + Vite (5202), sign in and screenshot the shell, then compare it with docs/screenshots/overview.png (layout, colors, spacing, typography) and iterate until it matches.`, { label: 'ui-shell', phase: 'A1 Foundation', schema: REPORT }),
    ])
    const fi = await run(RULES + `

TASK: FOUNDATION INTEGRATE (Stage A). Reports:
${JSON.stringify([scaffold, contractsCore].concat(parts).map(p => p && { summary: p.summary, followUps: p.followUps, openIssues: p.openIssues }), null, 1)}
Make fix-only edits anywhere in Stage A foundation paths so the pieces fit. Resolve the foundation followUps. Then make all of these pass: ${A_GATE_BASE.join(' | ')} | npm run test:e2e:prototype (shell spec).
Then write docs/plan/foundation-contract.md: the exact verified API every domain agent must use, with import paths, signatures and ONE real usage example each. Cover defineEndpoint and the common/enums/permissions modules; mockRoute, handler context and fixture conventions (per-tenant filtering, persona helpers, static command responses, error codes); the handler module shape for auto-discovery; handler test helpers; call() and the domain client pattern; FeatureModule/NavItem and routes.tsx conventions; every shared component and its props; format helpers; the URL map; the persona list with ports; and how to screenshot a page with Playwright against the mock API.`, { label: 'foundation-integrate', phase: 'A1 Foundation', schema: REPORT })
    g1 = await gateLoop('A1', 'A1 Foundation', A_GATE_BASE.concat(['npm run test:e2e:prototype']), 4)
    if (!g1.passed) return { status: 'failed', phase: 'A1 Foundation', gate: g1.last, integrate: fi && fi.summary }
    await checkpoint('phase-A1-foundation', 'prototype: foundation (scaffold, contracts core, mock API platform, SPA shell)', 'A1 Foundation', { integrate: fi && fi.summary })
  }
  if (!g1.passed) return { status: 'failed', phase: 'A1 Foundation (resume check)', gate: g1.last }

  // ── A2 Domains ──
  phase('A2 Domains')
  const todo = DOMAINS.filter(d => SKIP_UNITS.indexOf(d.id) < 0)
  if (todo.length < DOMAINS.length) log('Resume: skipping completed domains ' + DOMAINS.filter(d => SKIP_UNITS.indexOf(d.id) >= 0).map(d => d.id).join(', '))
  const head = d => RULES + `

DOMAIN ${d.num} — ${d.title} (id: ${d.id}). Your port pair: 41${d.num}/52${d.num}.
Scope: ${d.fr}. Screens: ${d.screens}. Acceptance scenarios to make demonstrable: ${d.ac}.
Read in full: docs/PRD.md sections ${d.prd}, docs/plan/foundation-contract.md, and the blueprint tables for this domain.
Domain rules (binding for the contract design, the fixtures and the UI behaviour; enforcement code comes in Stage B): ${d.notes}
You own (write): ${ownedPaths('domain:' + d.id)}.`
  const domainResults = await pipeline(todo,
    d => run(head(d) + `

TASK (1/4): CONTRACT + FIXTURES + MOCK HANDLERS for this domain.
- src/contracts/${d.contracts.join('.ts, src/contracts/')}.ts: an endpoint for EVERY list, detail and principal action behind the screens above, using defineEndpoint with correct audience prefix, permission (from src/contracts/permissions.ts; request missing codes via followUps and use the closest existing one meanwhile), request/response zod schemas whose field names mirror the blueprint columns, enums from src/contracts/enums.ts, stable UPPER_SNAKE error codes for every business rule the UI must show (Stage B must honor them), and screen IDs. Lists support search, filters, status, owner, dates, sorting and pagination.
- src/mock-api/fixtures/…: typed static data implementing your part of docs/plan/demo-storyline.md for EVERY relevant tenant and persona (buyer kwu and odc, each supplier, operator). Use the storyline's natural keys (T-2026-000N, PR-2026-000N, C-2026-000N, slugs, persona emails). Data must be realistic, internally consistent and rich enough that every screen, filter and state is visible.
- src/mock-api/handlers/…: register every endpoint via mockRoute. Filter and paginate fixtures per tenant, persona and query. Enforce audience visibility exactly as PRD §4.3 requires (a supplier sees only its own records; a buyer never sees drafts or sealed content before opening; public sees only public records). Commands validate input and return a contract-valid STATIC response representing the outcome (or the business error the fixture state implies, e.g. a blocking readiness error). Nothing is persisted.
- src/ui/src/api/…: thin typed client functions over call().
- Tests: fixtures parse against their schemas, and handler tests cover tenant filtering, 403 for wrong kind/permission, and audience isolation. Run npx vitest run --project unit src/mock-api/handlers src/mock-api/fixtures src/contracts (filtered to yours) and the filtered typecheck and lint.
Return the REPORT (endpoints = number of contract endpoints).`, { label: 'contract:' + d.id, phase: 'A2 Domains', schema: REPORT }),
    (c, d) => run(head(d) + `

TASK (2/4): FRONTEND for this domain. The contract, fixtures and mock handlers are done (report: ${JSON.stringify(c && { summary: c.summary, endpoints: c.endpoints, openIssues: c.openIssues })}). You may fix your own contract/handler files if the UI reveals a gap, but keep them consistent.
- src/ui/src/features/${d.ui.join(', src/ui/src/features/')}: each has a routes.tsx exporting 'features: FeatureModule[]' (area, routes, nav with section/order/icon/permission), pages/ and components/.
- One page (or workspace tab) per screen ID, showing EVERY "Required information" item and offering EVERY "Principal action" from the PRD screen tables. Each action calls the real client, and consequential actions go through ConfirmActionDialog. Handle problem+json fieldErrors and business error codes with clear messages.
- Lists: search, filters, status chips, owner, dates, sort, pagination, EmptyState/RestrictedState. Forms: validation, UnsavedChangesGuard, and a clear saved vs submitted vs approved distinction. Readiness views distinguish blocking errors from warnings. Deadlines always render through OfficialDeadline. PRD §19: show the current organization, record, stage, deadline and next required action.
- Visual fidelity: PageHeader → FilterBar → KPI cards → Cards/DataTable, matching docs/screenshots. Everything is keyboard and screen-reader accessible.
- Tests: an RTL test per page (mock the client module), plus nav/permission visibility tests. Run npm run test:ui -- src/features/<yours>, then the filtered typecheck:ui and eslint.
- Visual check: start the mock API and Vite on your port pair, sign in as the relevant personas, screenshot each of your pages with a small Playwright script under .qa-scratch/${d.id}/, open the screenshots, compare them with docs/screenshots, and fix any discrepancies.
Return the REPORT (screensCovered = the screen IDs you implemented).`, { label: 'ui:' + d.id, phase: 'A2 Domains', schema: REPORT }).then(ui => ({ c, ui })),
    (r, d) => run(head(d) + `

TASK (3/4): ADVERSARIAL REVIEW of this domain's prototype. You are READ-ONLY except .qa-scratch/${d.id}-review/ and your progress marker.
For every screen ID, verify with the running prototype (your port pair) and the code: the route exists and is reachable from nav for the right tenant kind and persona; every "Required information" item is shown; every "Principal action" is wired UI → client → contract → mock handler with a realistic response; states render (loading/empty/error/restricted); PRD wording is right (e.g. preferred bidder never shown as award; receipt ≠ compliance); official deadlines show zone and offset; the audience rules of PRD §4.3 hold for every persona; fixtures match the storyline; there is no hard-coded data in UI code and no dead buttons; the style matches docs/screenshots. Also check the contract is implementable for Stage B: fields mirror the blueprint, permissions and error codes make sense.
If there are NO gaps (verdict = pass), write .build/progress/A/${d.id}.json = {"stage":"A","unit":"${d.id}","status":"done","review":"pass"}.`, { label: 'review:' + d.id, phase: 'A2 Domains', schema: REVIEW }).then(review => Object.assign({}, r, { review })),
    (r, d) => {
      const gaps = (r.review && r.review.gaps) || []
      if (!gaps.length) return Object.assign({}, r, { fix: null, domain: d.id })
      return run(head(d) + `

TASK (4/4): Close ALL of these review gaps in your owned paths, with tests:
${JSON.stringify(gaps, null, 1)}
Re-run the filtered typecheck, lint and tests, and re-screenshot the affected pages. Finally write .build/progress/A/${d.id}.json with {"stage":"A","unit":"${d.id}","status":"done","gapsFixed":<n>,"followUps":[...]} and return the REPORT.`, { label: 'fix:' + d.id, phase: 'A2 Domains', schema: REPORT }).then(fix => Object.assign({}, r, { fix, domain: d.id }))
    },
  )
  if (HALTED) throw new Error('halted by circuit breaker')
  const doneDomains = todo.filter((d, i) => domainResults[i] && domainResults[i].ui).map(d => d.id)
  doneDomains.forEach(id => COMPLETED.push(id))
  const failedDomains = todo.filter((d, i) => !domainResults[i] || !domainResults[i].ui).map(d => d.id)
  if (failedDomains.length) log('Domains incomplete (Integration will finish them): ' + failedDomains.join(', '))

  // ── A3 Integration ──
  phase('A3 Integration')
  const wiring = todo.map((d, i) => {
    const r = domainResults[i] || {}
    const reps = [r.c, r.ui, r.fix].filter(Boolean)
    return { domain: d.id, screens: d.screens, followUps: reps.flatMap(x => x.followUps || []), openIssues: reps.flatMap(x => x.openIssues || []), incomplete: failedDomains.indexOf(d.id) >= 0 }
  })
  let g3 = { passed: true }
  if (SKIP_PHASES.indexOf('A3 Integration') < 0) {
    const integ = await run(RULES + `

TASK: INTEGRATION (Stage A). You own: ${ownedPaths('integration')}. Domain data:
${JSON.stringify(wiring, null, 1)}
(Domains skipped on resume have their reports in .build/progress/A/<domain>.json.)
1. Apply every followUp. Permission/enum/common-contract additions go into src/contracts core files (backward compatible). Requested shared components go into src/ui/src/components (no duplicates). Wire CustomFieldsSection into the request, tender, qualification application and contract forms.
2. For any domain marked incomplete, or open issues that leave a screen missing or half-built: finish that work yourself.
3. Write src/contracts/catalog.ts (aggregating every endpoint map, with unique ids/paths checked by a test) and confirm src/mock-api/registry.ts loads EVERY handler module without skips.
4. Write src/mock-api/fixtures/consistency.test.ts: every cross-domain reference (tender refs, lot ids, supplier slugs, persona emails, contract refs, request refs) resolves; storyline states agree across domains (e.g. T-2026-0003 evaluation vs awards vs bids); AC-19 numbers are exact.
5. Nav coherence: sections, ordering and icons across all features for every tenant kind form a sensible sidebar like the screenshots. Fix in the owning routes.tsx files.
6. Run npm run docs:api to generate docs/technical/api/openapi.json. Set the ci:test:ui and unit test-count floors just below the current counts.
Then make all of these pass: ${A_GATE_FULL.join(' | ')}.`, { label: 'integrate', phase: 'A3 Integration', schema: REPORT })
    g3 = await gateLoop('A3', 'A3 Integration', A_GATE_FULL, 5)
    await checkpoint('phase-A3-integration', 'prototype: all domains integrated (contracts catalog, mock handlers, fixtures)', 'A3 Integration', { integrate: integ && integ.summary, gate: g3.passed })
  }

  // ── A4 QA ──
  phase('A4 QA')
  let qa = { raw: 0, unique: 0, confirmed: [] }
  let g4 = { passed: true }
  if (SKIP_PHASES.indexOf('A4 QA') < 0) {
    const QA_BASE = RULES + `

QA AUDIT OF THE PROTOTYPE. You are READ-ONLY for source files. You may run commands, start the mock API + Vite on your port pair, and write scratch files only under .qa-scratch/<your-label>/. Personas and password: docs/plan/demo-storyline.md / test1234. Report only real, specific, reproducible findings with file:line, the violated requirement, concrete evidence (screenshot path, code excerpt, HTTP response) and a precise fix. Set 'area' to the owning area, one of: ${AREAS.join(', ')}.`
    const AUD = [
      { key: 'style', ports: '4301/5301', task: 'Visual fidelity: with Playwright, sign in as tebogo.officer, boitumelo.chair, tsodilo.bidmanager, masego.contracts, admin.kwu and ops.admin (plus anonymous public pages). Visit EVERY nav destination, take full-page screenshots in light AND dark theme, open them and compare against docs/screenshots/*.png (sidebar, topbar, filter card, KPI cards, tables, chips, spacing, typography, charts). Report broken layouts, inconsistencies between features, non-token colors, overflow and truncation, and console errors.' },
      { key: 'a11y', ports: '4302/5302', task: 'Accessibility (PRD §19): run axe on every page for the key personas (serious/critical are findings), keyboard-only traversal of sign-in, org switch, submit response, approve, and score, plus focus management in dialogs, labels, aria-live progress, color contrast in both themes, and deadline text.' },
      { key: 'completeness', ports: '4303/5303', task: 'Completeness: build a matrix of EVERY in-scope screen ID (architecture-plan §2) → route → nav entry (tenant kind + persona) → contract endpoints → mock handler → non-empty fixture data. Report missing or unreachable screens, dead buttons, actions not calling the API, hard-coded data in UI code, TODO/FIXME/lorem/placeholder text, and skipped tests.' },
      { key: 'prd-a', ports: '4304/5304', task: 'PRD screen content for COM-01..09, PUB-01..07 and SUP-01..11: every "Required information" item is displayed and every "Principal action/Actions" exists and behaves per the business boundaries column.' },
      { key: 'prd-b', ports: '4305/5305', task: 'PRD screen content for SUP-12..24 and EVA-01..06, same method.' },
      { key: 'prd-c', ports: '4306/5306', task: 'PRD screen content for BUY-01..18 and BUY-31..35, same method.' },
      { key: 'prd-d', ports: '4307/5307', task: 'PRD screen content for BUY-19..30, CON-01..11, ADM-01..17, OPS-01..07 and REP-01..02, same method.' },
      { key: 'contracts', ports: '4308/5308', task: 'Contract quality for Stage B: every UI call goes through a contract; every principal action has an endpoint; field names/types mirror the blueprint (money as decimal strings, instants, official deadlines); enums come from enums.ts and match the blueprint; permissions exist and are the right ones per PRD §4.1; error codes cover the business rules the UI displays; ids and paths are unique and consistent across domains; the OpenAPI is valid. Flag anything Stage B could not implement as specified.' },
      { key: 'confidentiality', ports: '4309/5309', task: 'Confidentiality as shown by the prototype: for each persona, walk the PRD §4.3 audience matrix row by row through the UI and direct mock API calls. Suppliers never see other suppliers\' data. Buyers never see drafts or sealed content before opening. admin.kwu/support/auditor see no sealed content (AC-15). Public sees no invitation-only tenders (AC-01). Evaluators never see others\' scores before their own submission. Search/counts/exports/notifications leak nothing (BR-43).' },
      { key: 'journeys', ports: '4310/5310', task: 'End-to-end journeys and UX: walk the PRD 16-step lifecycle (§6) and each in-scope acceptance scenario (AC-01..36, AC-39) through the prototype as the storyline personas. Report broken links between screens, a next required action that is not shown, confusing or incorrect status wording, missing context (organization, stage, deadline), scenarios that cannot be demonstrated with the fixtures, and places where the saved/submitted/approved distinction is unclear.' },
    ]
    const audits = await parallel(AUD.map(a => () => run(QA_BASE + '\nYour port pair: ' + a.ports + '.\nAUDIT FOCUS (' + a.key + '): ' + a.task, { label: 'audit:' + a.key, phase: 'A4 QA', schema: FINDINGS })))
    const all = []
    audits.forEach((r, i) => { if (r) r.findings.forEach(f => all.push(Object.assign({ auditor: AUD[i].key }, f))) })
    const seen = {}
    const unique = []
    for (const f of all) {
      const k = (f.file + '|' + String(f.title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()).slice(0, 240)
      if (!seen[k]) { seen[k] = true; unique.push(f) }
    }
    log('QA: ' + all.length + ' raw findings, ' + unique.length + ' after dedup')
    const VOTES = { blocker: 3, major: 2, minor: 1 }
    const judged = await parallel(unique.map((f, idx) => () => {
      const n = VOTES[f.severity] || 1
      return parallel(Array.from({ length: n }, (_, v) => () => run(RULES + `

ADVERSARIAL VERIFICATION (voter ${v + 1}/${n}). READ-ONLY; scratch only under .qa-scratch/verify-${idx}-${v}/; ports 44${String(idx % 100).padStart(2, '0')}/55${String(idx % 100).padStart(2, '0')}. Try to REFUTE this finding by checking the code and reproducing it in the running prototype. If you cannot confirm it with concrete evidence, set refuted = true.
Finding: ${JSON.stringify(f)}`, { label: 'verify:' + idx + ':' + v, phase: 'A4 QA', schema: VERDICT, effort: 'high' })))
        .then(vs => { const ok = vs.filter(Boolean).filter(x => !x.refuted).length; return Object.assign({}, f, { confirmed: ok >= Math.ceil(n / 2) }) })
    }))
    const confirmed = judged.filter(Boolean).filter(f => f.confirmed)
    log('QA: ' + confirmed.length + ' confirmed of ' + unique.length)
    const byArea = {}
    for (const f of confirmed) { const k = AREAS.indexOf(f.area) >= 0 ? f.area : 'integration'; (byArea[k] = byArea[k] || []).push(f) }
    const qf = await parallel(Object.keys(byArea).map(area => () => run(RULES + `

TASK: Fix these CONFIRMED prototype QA findings for area "${area}". You own: ${ownedPaths(area)}.
${JSON.stringify(byArea[area], null, 1)}
Fix each root cause and add or extend a test (or a Playwright check) that would catch it. Re-run the affected checks. Put anything outside your paths into 'remaining' with the exact file and change.`, { label: 'qafix:' + area, phase: 'A4 QA', schema: FIX })))
    const cross = qf.filter(Boolean).flatMap(x => x.remaining || [])
    if (cross.length) await run(fixPrompt('integration', cross.map(c => ({ area: 'integration', command: 'qa cross-area', files: [], errorExcerpt: c })), 'A4'), { label: 'qafix:cross', phase: 'A4 QA', schema: FIX })
    g4 = await gateLoop('A4', 'A4 QA', A_GATE_FULL, 4)
    qa = { raw: all.length, unique: unique.length, confirmed: confirmed.map(f => ({ severity: f.severity, area: f.area, title: f.title })) }
    await checkpoint('phase-A4-qa', 'prototype: QA fixes (style, accessibility, completeness, PRD screens, contracts, confidentiality, journeys)', 'A4 QA', { qa: { raw: qa.raw, unique: qa.unique, confirmed: qa.confirmed.length }, gate: g4.passed })
  }

  // ── A5 Handoff ──
  phase('A5 Handoff')
  const handoff = await parallel([
    () => run(RULES + `

TASK: PROTOTYPE WALKTHROUGH for the owner's approval review. Ports 4400/5400. You own docs/prototype/** and e2e_tests/specs/prototype/walkthrough.spec.ts.
1. Write a Playwright walkthrough spec that signs in as the right persona for EVERY in-scope screen ID and captures a screenshot (JPEG, quality 70, 1600px wide viewport) to docs/prototype/screens/<SCREEN-ID>--<persona>.jpg. Where it helps, also capture dark theme and key states (for example a readiness check with blocking errors, the sealed restricted state, the complaint hold). Run it.
2. docs/prototype/walkthrough.md: grouped by audience (Public, Supplier, Buyer, Evaluator, Contracts, Administration, Operations). For each screen ID: title, persona to use, URL, what it demonstrates (PRD requirements and AC scenarios), what to evaluate, and the embedded screenshot.
3. docs/prototype/README.md: how to run (Docker running; npm run supabase:start, npm run auth:personas, then npm run dev:prototype and http://localhost:5173; password-reset emails appear in Mailpit at http://127.0.0.1:54324), the persona table (email, org, role, what to try), what is static and what is not (nothing persists; commands return realistic static outcomes), a guided tour of the 16-step lifecycle, the acceptance scenarios demonstrable in the prototype and where, known limitations, and an approval checklist + feedback template for the owner.`, { label: 'walkthrough', phase: 'A5 Handoff', schema: FIX }),
    () => run(RULES + `

TASK: DOCS SYNC to as-built (Stage A). You own docs/technical/**. Update the technical documentation to match what was actually built: 07-api.md endpoint catalog from src/contracts (regenerate docs/technical/api/openapi.json with npm run docs:api, then summarize per domain with ids, methods, paths, permissions and screens), 09-frontend.md (actual components, routes, feature modules, nav structure, authentication (supabase-js sign-in and the dev-only DemoAccounts quick-pick, DD-43)), 12-traceability.md (screen → route → contract endpoints), 02-architecture.md prototype-mode details, and 13-delivery-and-resilience.md (Stage A complete, awaiting approval). Set each touched document's status line to "As-built (Stage A prototype); backend sections as-designed". Keep Mermaid diagrams valid.`, { label: 'docs-sync', phase: 'A5 Handoff', schema: FIX }),
  ])
  const g5 = await gateLoop('A5', 'A5 Handoff', A_GATE_FULL.concat(['npx playwright test -c e2e_tests/playwright.config.ts --project prototype e2e_tests/specs/prototype/walkthrough.spec.ts']), 3)
  await checkpoint('stage-A-complete', 'prototype: walkthrough, review guide, technical docs synced (Stage A complete — awaiting approval)', 'A5 Handoff', { gate: g5.passed })

  return {
    status: g5.passed ? 'awaiting-approval' : 'needs-attention',
    message: 'Stage A prototype complete. STOP: Stage B (tenderiq-backend) requires explicit owner approval.',
    branch: BRANCH,
    gates: { A1: g1.passed, A3: g3.passed, A4: g4.passed, A5: g5.passed },
    finalGateFailures: g5.passed ? [] : (g5.last ? g5.last.failures : []),
    domainsIncompleteBeforeIntegration: failedDomains,
    qa,
    handoff: handoff.map(h => h && h.summary),
    completedUnits: COMPLETED,
  }
}

try {
  return await main()
} catch (e) {
  if (HALTED) return { status: 'interrupted', reason: String(e && e.message), completedUnits: COMPLETED, resumeHint: 'Relaunch with args.resume = { skipPhases: [completed phases], skipUnits: [completed domain ids] } after checking .build/progress/A/*.json, or use resumeFromRunId in the same session.' }
  throw e
}
