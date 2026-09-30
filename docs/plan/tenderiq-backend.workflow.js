export const meta = {
  name: 'tenderiq-backend',
  description: 'Stage B (ONLY after the owner approves the Stage A prototype): build the real backend behind the approved contracts — schema, platform, shared services, 16 domain backends, integration, adversarial QA, final npm run build gate',
  whenToUse: 'Only after explicit written approval of the Stage A prototype. DRAFT: revise against the as-built Stage A contracts before launch.',
  phases: [
    { title: 'B1 Foundation', detail: 'scaffold-b → (schema writers → apply) ∥ platform-http ∥ platform-data-auth ∥ ui-live-api → integrate → gate' },
    { title: 'B2 Shared services', detail: 'approvals ∥ notifications ∥ documents ∥ core (audit/lifecycle/sealing/time) → integrate → gate' },
    { title: 'B3 Domain backends', detail: '16 domains pipelined: API implementing contracts → UI hardening → adversarial review → fix' },
    { title: 'B4 Integration', detail: 'registries, contract conformance, follow-ups, reset DB, demo seed, gate' },
    { title: 'B5 QA', detail: '10 auditors → dedup → adversarial verification → fixers → gate' },
    { title: 'B6 Final gate', detail: 'completeness critic → fixes → docs sync → npm run build + verify + e2e' },
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
if (A.prototypeApproved !== true) {
  return { status: 'refused', reason: 'Stage B requires explicit owner approval of the Stage A prototype. Relaunch with args.prototypeApproved = true only after the owner approves.' }
}

const RULES = `You are one agent in a multi-agent build of the TenderIQ web application in ${REPO}
(Windows 11. Use the Bash tool (Git Bash, path /c/Code/Brittany/TenderIQ) or PowerShell. Docker Desktop is running. Node 24 (pinned runtime, DD-45) and npm 11 are installed.)

THIS IS STAGE B: THE REAL BACKEND. Stage A delivered, and the owner APPROVED, a complete UI prototype on typed API contracts (src/contracts) with a static mock API (src/mock-api) and REAL Supabase Auth in the local Docker stack (DD-43; lib/config, lib/supabase and lib/auth/verify.ts already exist and are extended here, never rewritten from scratch). Stage B implements those SAME contracts for real: Postgres schema, Supabase Auth/Storage, business logic, jobs and seeds. The mock API stays as a dev/test tool, and the SPA keeps working in both modes.

BINDING DOCUMENTS. Read the parts relevant to your task before writing anything:
- docs/plan/design-decisions.md (decision log DD-01 … DD-45 (DD-38 withdrawn, superseded by DD-43); it amends the plan and the blueprint and WINS on conflict; read it in full)
- docs/plan/architecture-plan.md (Stage B rows of §5, decisions §3, layout, registries, cross-domain write rules)
- docs/plan/schema-blueprint.md (database contract)
- docs/plan/demo-storyline.md (the demo world; the same one the prototype fixtures show)
- docs/architecture-brief.md (technical rules; follow literally)
- docs/PRD.md (always §4, §8, §10 plus your task's sections)
- docs/technical/** (design + as-built Stage A docs) and docs/prototype/** (the approved prototype)
- src/contracts/** (THE API CONTRACT: endpoints, schemas, permissions, error codes)
- docs/plan/foundation-contract.md and docs/plan/shared-services-contract.md (real APIs of already-built layers)

HARD RULES:
1. No placeholders. No TODO/FIXME, lorem ipsum, stub handlers, fake data in production code, or dead buttons. Everything is complete, with real queries, zod validation, permission checks, audit, states and tests.
2. Write ONLY the paths you own. Read anything. Others are writing in parallel. Report needed changes elsewhere in followUps.
3. Contract changes: only in your own domain's contract file, only when strictly necessary, backward compatible where possible. Record the reason in followUps (kind "contract_change"), and update the mock handler, fixtures and UI in the same unit so both modes keep working.
4. No new npm dependencies. Do not edit package.json unless your task says so.
5. No state-changing git commands unless your task says so. Never run 'supabase db reset' / 'npm run supabase:reset' unless your task says so; integration tests create uniquely named tenants and never truncate shared data.
6. TypeScript strict per the brief. No 'any'. .js import extensions on the backend. Consistent type imports. Zod v4. Result<T,E> for expected failures. problem+json. Money and scores stay decimal strings (lib/decimal).
7. UI: design system only (tokens, shared components). Keep docs/screenshots fidelity. The prototype-approved UX must not regress.
8. Filter typecheck output to your own paths while others work. Your files must be error-free.
9. Your final message is data for an orchestrator.`

// ───────────────────────────── schemas ─────────────────────────────
const S = (props, req) => ({ type: 'object', properties: props, required: req || Object.keys(props) })
const STR = { type: 'string' }
const STRS = { type: 'array', items: STR }
const REG = (props) => ({ type: 'array', items: S(props) })
const FOLLOWUP_KINDS = ['permission', 'lib_change', 'shared_component', 'schema_change', 'contract_change', 'dependency', 'wiring', 'seed', 'other']
const REPORT = S({
  summary: STR, filesWritten: STRS,
  checks: S({ typecheck: STR, lint: STR, tests: STR }),
  routers: REG({ mountPath: STR, importPath: STR, routesExport: STR, depsExport: STR }),
  cronJobs: REG({ name: STR, schedule: STR, importPath: STR, exportName: STR }),
  queueHandlers: REG({ messageType: STR, importPath: STR, exportName: STR }),
  approvalHandlers: REG({ subjectType: STR, importPath: STR, exportName: STR }),
  documentPolicies: REG({ relatedType: STR, importPath: STR, exportName: STR }),
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
const CRITIC = S({ complete: { type: 'boolean' }, missing: { type: 'array', items: S({ area: STR, description: STR, evidence: STR }) } })

// ───────────────────────────── domains (backend notes; contracts come from Stage A) ─────────────────────────────
const DOMAINS = [
  { id: 'org-admin', num: '01', title: 'Identity & organization administration',
    server: ['identity', 'org-admin'], ui: ['account', 'admin-org', 'admin-access'],
    fr: 'FR-01, FR-03, PRD §5.4, BR-02, BR-06, BR-07, BR-38', screens: 'COM-01 (invitation acceptance /invite/:token), COM-02 (org list/pending memberships view beyond the shell picker), COM-03, ADM-01, ADM-02, ADM-03, ADM-04, ADM-05, SUP-04',
    ac: 'AC-02, AC-03, AC-04', prd: '§4, §5.1, §5.3, §5.4, §11.1, §13.2',
    notes: `The routers serve both /buyer/admin/* and /supplier/admin/* (tenant kind decides which role templates are grantable; a supplier admin can never grant buyer privileges). Users are invited through the Supabase Auth Admin API (inviteUserByEmail). Expired invitations are reissued without creating a duplicate identity. Suspend/deactivate never touches submissions, approvals, contracts or audit (BR-38). Deactivation offers reassignment of open tasks via the approvals/tasks service and a delegation review. Access review shows effective permissions (roles via membership and groups, direct grants, restrictions winning), flags grants expiring soon, and flags excessive or incompatible authority per sod_policies. Nobody can grant a permission or delegate authority they do not hold (delegation max ≤ own limit). Direct grants need owner, reason, start and expiry. Conflict-declaration review queue: dual buyer/supplier memberships are visible to the conflict reviewer (AC-02) without exposing unrelated personal info. Structure values (departments, categories…) are deactivated, never deleted, and still display on history. Supplier-side SUP-04: members, groups, tender assignments, signing limits (authority_limits decision_type contract_signature) and submission authority (permission supplier.response.submit). A contributor cannot submit or self-grant (AC-03). Profile COM-03: language, display time zone, contact changes (email change goes through Supabase Auth confirmation). Export the expire-access cron handler (display-status expiry of grants, restrictions, delegations and invitations; request-time checks always compare timestamps, DD-18).` },
  { id: 'policy', num: '02', title: 'Policy profiles, forms, templates, public portal policy',
    server: ['policy'], ui: ['admin-policy'],
    fr: 'FR-22, PRD §17, BR-09', screens: 'ADM-06, ADM-07, ADM-08, ADM-11', ac: 'supports AC-06 (issued tenders keep their profile version)', prd: '§13.2, §17, §18.1',
    notes: `Policy profiles are versioned: draft → in_review → approved (via approvals service subject_type policy_profile) → retired. An approved version is immutable. Edits create a new version. The page shows which tenders use each version. Changing policy never alters an issued tender (tenders.policy_profile_version_id is frozen at release). Custom fields (ADM-07): definitions with conditional required rules, plus a reusable <CustomFieldsSection entityType entityId readOnly?> component and API (get/put values with validation). Export the component from src/ui/src/features/admin-policy/components/CustomFieldsSection.tsx and report a wiring followUp for the requests/tenders/qualification/contracts forms. Templates library (ADM-08): kinds tender_package (points at a tenders row with is_template = true; the "save as template"/"create from template" copy is done by the tenders domain), questionnaire, criteria_set, clause, letter, checklist, contract. Each has versions, owner, review date, approval (subject_type template), and retirement. Retired templates cannot be selected for new work. ADM-11 portal_settings: disclosure settings with approval. Mandatory controls cannot be hidden by customization (§17.3).` },
  { id: 'suppliers', num: '03', title: 'Supplier registration, profile, evidence library, directory and relationships',
    server: ['suppliers'], ui: ['supplier-org', 'supplier-directory'],
    fr: 'FR-02, BR-03, BR-44, BR-45', screens: 'SUP-02 (public /register + membership request), SUP-03, SUP-05, BUY-31, BUY-32, plus ops duplicate review (/ops/supplier-duplicates) and legal-identity change review',
    ac: 'AC-07 (registration is not qualification)', prd: '§2.1, §3, §5.2, §11.3, §12.1 (BUY-31/32), §18.1',
    notes: `Open registration goes through a PUBLIC endpoint, because Supabase self-signup stays disabled. The service creates a pending supplier tenant plus user via the Auth Admin API invite (email confirmation = contact verification). It enforces one pending registration per email and uses zod-validated identity fields. Contact verification, membership approval, identity verification and qualification are separate statuses. Possible duplicates (same registration number, similar normalized name) produce duplicate_candidates reviewed by operators. The registrant only sees "an organization with similar details exists — request membership or continue". Nothing is ever disclosed about the other org, and nothing auto-merges (BR-44). Membership requests to an existing supplier are approved by that supplier admin. Legal-identity changes are requests with evidence, reviewed by operators, with supplier_legal_names history kept. Historic submissions keep their original representations. Evidence library: add, replace prospectively (the new item points back and the old item stays), renew, withdraw future sharing per buyer (evidence_shares.withdrawn_at). It shows where each edition was formally submitted (evidence_submissions). Financial evidence is only visible to supplier users with supplier.financial.view. Buyer-created provisional supplier records (tenants.is_provisional). BUY-31 directory: platform supplier identities + categories, the buyer relationship, qualification scope from v_qualification_status, evidence freshness from shared evidence only. BUY-32 relationship record is buyer-specific and never shows other buyers' assessments (BR-45). Payment/banking onboarding is not collected (supplier_profiles.banking_collected stays false with an explanation).` },
  { id: 'qualification', num: '04', title: 'Supplier qualification programs, applications, assessment, decisions, monitoring',
    server: ['qualification'], ui: ['qualification'],
    fr: 'FR-06, BR-03, BR-23, BR-24, BR-25, BR-48', screens: 'ADM-09, SUP-20, SUP-24, BUY-33, BUY-34, BUY-35', ac: 'AC-07, AC-08, AC-09', prd: '§7.3, §8.3, §11.3, §12.1 (BUY-33..35)',
    notes: `Programs are versioned, with criteria per assessment area (PRD §7.3 table). Applications are draft (supplier-private; buyer queries exclude drafts) → submitted → under_review → more_info_required → decision_pending → decided/withdrawn. Evidence attaches through evidence_submissions snapshots, so later profile updates never change a submitted application. "Not applicable" requires a reason where the criterion says so. Missing evidence is never a pass. Screening/ratio flags only prompt review (BR-48). The financial review (financial_reviews) is visible only to the assigned financial reviewer and qualification deciders. It records period, currency, consolidated flag, source and review date. The reviewer can raise info requests to the supplier (AC-08). A parent company cannot qualify a subsidiary without explicit support evidence. Decisions go through the approvals service when the program requires independent approval. Every decision has an outcome, scope, dates, conditions with allowed activities and a blocked gate, reasons, a supplier-facing explanation and an appeal route. Supersede, never overwrite. Monitoring: cron jobs evidence-expiry and qualification-expiry create reassessment_triggers, notifications and tasks. New information never rewrites eligibility at an earlier deadline. BUY-35 lists active bids/contracts impacted by a trigger and records an explicit disposition (AC-09). SUP-24 distinguishes buyer-specific decisions. AC-07: expose v_qualification_status reads so the publication domain can apply the participation gate. This domain shows "Registered — not qualified for <category>" clearly.` },
  { id: 'requests', num: '05', title: 'Procurement requests, funding decisions, planning, advance notices, strategy',
    server: ['requests'], ui: ['requests', 'planning'],
    fr: 'FR-04, FR-05, BR-06, BR-10', screens: 'BUY-02, BUY-03, BUY-04, BUY-05, BUY-06, PUB-06 (public page + public endpoint)', ac: 'AC-05, AC-39 (strategy/RFI side)', prd: '§6, §7.1, §7.2, §8.1, §11.2 (PUB-06), §12.1 (BUY-02..06)',
    notes: `Request lifecycle per PRD §8.1 as a legality matrix. The business case form covers every FR-04 field and distinguishes the funding statuses indicative / approved_budget / firm_commitment. Info requests to the requester. Combine (keeps original requesters, funding interests and requirements via request_links; the approval value is the aggregate) and split (the total value used for policy stays visible). Route to an existing contract. Defer with a date. Reject with reasons. A material change (scope, amount, funding, risk, contracting entity) bumps the revision and invalidates approvals. Approval goes through the approvals service with amount/currency/entity/category. If the reviewer lacks authority, the UI shows the correct route to a higher approver (AC-05). "Create tender" links to /buyer/tenders/new?fromRequest=ID (the tenders domain performs the conversion). Planning: plan items, calendar view (month grid), dependencies, resource demand, owners; publish advance notices (PUB-06 public page says forecasts are not invitations). Strategy (BUY-06): procedure per the FR-05 table, direct-award grounds (no fabricated competition), market research entries flagged unverified vs supplier commitment, prior specification involvement → fairness_reviews, strategy approval. An RFI strategy can conclude with market findings.` },
  { id: 'tenders', num: '06', title: 'Tender authoring and release approval',
    server: ['tenders'], ui: ['tender-authoring'],
    fr: 'FR-07, BR-01, BR-09, BR-10, BR-11, BR-12, BR-16', screens: 'BUY-07, BUY-08, BUY-09, BUY-10, BUY-11, BUY-12, BUY-13', ac: 'AC-06', prd: '§7.4, §8.2, §9.1, §12.1 (BUY-07..13)',
    notes: `Create a tender from an approved template (copy the template tender structure), from a prior event (copy lots/requirements/pricing/eval plan/terms only; never bids, deliberations, approvals or outcomes), from blank, or from an approved request/strategy (allowed cross-write: set procurement_requests.status=converted in the same transaction). "Save as template" too. The overview shows readiness. The team tab assigns tender_team_members roles. Lots and requirements have owner, applicability, response type, treatment (mandatory_gate vs rated vs information), envelope, and missing-item consequence (eligibility is not a completeness warning). There are contradiction/missing-owner checks. Pricing schedules: one-time vs recurring, optional, provisional, and evaluation periods. The evaluation plan validates that weights total 100 (or an equivalent point total), declares threshold scope, price method, zero/missing price treatment, decimals, anchors and tie rules, and is approved before release. Timetable: official time zone + calendar; validation (questions deadline < submission deadline, etc.; working-day math through the time service); envelopes (single vs staged); participation conditions. Release review (BUY-13): checklist by area, supplier/public preview of the package, and release approval via the approvals service with subject_version = draft_revision and a content hash. A material edit after approval bumps draft_revision and invalidates the approval (AC-06). Publication is blocked while approvals or material info are incomplete. Status draft → awaiting_release_approval → ready only via the lifecycle service. The policy profile version is frozen at release. Documents are uploaded via the documents service with classification.` },
  { id: 'publication', num: '07', title: 'Publication, participants and access, public portal, supplier discovery and pursuit',
    server: ['publication'], ui: ['publication', 'public-portal', 'opportunities'],
    fr: 'FR-08, FR-09, BR-14, BR-15, BR-46', screens: 'BUY-14, BUY-15, PUB-01, PUB-02, PUB-03, PUB-07, SUP-06, SUP-07, SUP-08, SUP-09', ac: 'AC-01', prd: '§7.5, §7.6, §11.2, §11.3 (SUP-06..09), §12.1 (BUY-14, BUY-15), §17.2',
    notes: `Publish now or schedule (cron publish-scheduled): creates tender_versions v1 (lifecycle snapshot), notice tender_issued via the notifications service, lifecycle ready → open. External notice channel: record the publication → awaiting_confirmation → confirm or fail. A failure creates integration_exceptions (allowed cross-write) and leaves the event visibly unconfirmed (AC-33). Participants: invite approved suppliers (legal supplier + intended contact; replacing the contact never changes the invited legal supplier), register interest, access requests with decisions, confidentiality acceptance, acknowledgments, delivery status, and the qualification gate computed from v_qualification_status and participation_conditions. The buyer never sees supplier drafts or pursuits. Public portal (no auth, /api/v1/public/*): home per buyer (/b/:slug) and global, search with filters/sort (closed and cancelled clearly labelled), notice page with lots, deadlines in official tz + offset, documents classified public, amendment history prominent, and register-interest / request-access / start-participation CTAs. Guidance page reads published help_articles. Invitation-only and restricted events never appear publicly, and their identities never leak through counts or search (AC-01). Supplier: discovery with matches as suggestions only, saved searches, subscriptions, watchlist, invitations inbox (accept/decline by an authorized rep; decline reason optionally shared), opportunity workspace (package, versions, addenda with ack status, sessions, readiness, lot selection), and bid/no-bid + pursuit team + private notes (pursuits in the supplier tenant; only a shared decline reason reaches the buyer). A subscription tier never changes access (BR-46).` },
  { id: 'clarifications', num: '08', title: 'Questions, addenda and date changes, briefings and site visits',
    server: ['clarifications'], ui: ['clarifications'],
    fr: 'FR-10, BR-13, BR-14, BR-16, BR-41', screens: 'BUY-16, BUY-17, BUY-18, SUP-10, SUP-11, PUB-04', ac: 'AC-10', prd: '§7.7, §11.2 (PUB-04), §11.3 (SUP-10, SUP-11), §12.1 (BUY-16..18), §14.2',
    notes: `Questions: supplier asks against a tender, lot, requirement or document. Questions after the deadline need an explicit disposition. Buyer assigns an owner, drafts an answer, reviews confidentiality (sanitized question, no questioner identity), and publishes to all_participants/public, answers privately where legitimate, or escalates to an addendum. Suppliers never see other suppliers private cases. Addenda: materiality, affected lots/requirements (addendum_requirement_changes), response-time assessment, new deadline, and existing-submission action (none/acknowledge/supplement/replace). Approval via the approvals service when material or required by policy. On issue (allowed cross-write via the lifecycle snapshot API): apply requirement/date changes, bump tenders.current_version_no with a new tender_versions snapshot, and issue a notice to all affected eligible participants with required acknowledgment. Later registrants see the full current package plus amendment history. A deadline change happens ONLY through an addendum (BR-13, BR-16). Sessions: briefing/site visit, registration with capacity, accessibility needs, alternative sessions, attendance recording, minutes published as shared answers. Mandatory attendance is declared in advance and feeds participation readiness. PUB-04 is the public edition for public tenders only. AC-10: an addendum after submissions shows affected suppliers the required action. Prior receipts stay intact.` },
  { id: 'bids', num: '09', title: 'Supplier response preparation, submission, receipts, revisions, withdrawal, closing',
    server: ['bids'], ui: ['responses', 'submission-monitoring'],
    fr: 'FR-11, FR-12, BR-17, BR-18, BR-19, BR-20, BR-21', screens: 'SUP-12, SUP-13, SUP-14, SUP-15, SUP-16, SUP-17, BUY-19', ac: 'AC-03, AC-11, AC-12, AC-13, AC-14', prd: '§7.8, §7.9, §8.3, §11.3 (SUP-12..17), §12.1 (BUY-19), §20',
    notes: `Responses support initial, next_stage and bafo rounds (final_offer_round_id must be in final_offer_invitees). Lot selection. Assignment of answers to contributors with section scope. Progress. Private internal comments (supplier tenant). Reuse of prior content, flagged as needing review. Deviations and alternatives where allowed. Pricing entry is restricted to users with supplier.pricing.edit or pursuit can_view_pricing. price_status priced/included/not_offered are distinct from a zero price. Totals use lib/decimal. Declarations, subcontractors, key personnel, consortium members and contract exceptions. Evidence attaches via evidence_submissions snapshots. Internal approval per revision with content_hash; a material change invalidates approvals (SUP-15). The readiness check separates BLOCKING errors (missing mandatory answers, unacknowledged mandatory addenda, missing authority, unmet participation conditions/qualification gate, expired mandatory evidence, inconsistent pricing) from WARNINGS. Submission: only users with supplier.response.submit (AC-03). A context-confirmation dialog. In ONE transaction: lock the tender FOR SHARE, take official receipt time = clock_timestamp(), compare to the current deadline (lot-specific if set), write submission_attempts every time; on success write submission_receipts + inventory, mark the revision submitted, supersede the previous effective receipt/revision, and set bids.effective_revision_id. A failed replacement leaves the earlier effective submission intact with no false receipt (AC-12). Late → failed_late + revision late_rejected with the true time recorded (AC-13). Withdrawal is explicit, with a confirmation number (AC-14). Receipts are downloadable (print-styled HTML + XLSX via exports). The UI never displays draft readiness as submission (AC-11) and announces progress through aria-live. BUY-19: only v_bid_receipt_metadata (counts of unique suppliers, not revisions), closing status and incidents. Closing happens via cron close-tenders (lifecycle open → closed) or manual close with tender.close. Bid content is SEALED: no buyer read path here at all.` },
  { id: 'opening', num: '10', title: 'Opening sessions, compliance review, exclusions, bid clarifications',
    server: ['opening'], ui: ['opening'],
    fr: 'FR-13, BR-05, BR-17, BR-22, BR-23, BR-26', screens: 'BUY-20, BUY-21, SUP-18, EVA-03', ac: 'AC-15, AC-16, AC-17', prd: '§7.10, §11.3 (SUP-18), §12.1 (BUY-20, BUY-21), §12.2 (EVA-03)',
    notes: `Opening session: the assigned opening officer (tender_team_members role opening_officer + permission bid.open) plus a second person/witness or quorum confirmation per policy version. Select the stage (single-stage all, or staged qualification → technical → commercial in tender_envelopes order). The commercial envelope requires a price_gate_releases row (written by the evaluation domain) when staged (AC-16). Opening writes envelope_openings for eligible (non-withdrawn, non-late) effective revisions only, records participants/time/irregularities/minutes, and records an optional public opening summary. Org admins, auditors and support without assignment can never open or read (AC-15). Enforce via the sealing service and add explicit tests. Compliance checklist per bid: check types, finding class (administrative omission vs substantive noncompliance vs clarifiable), result with evidence reference and reason (N/A needs a reason). Allowed column write: bids.compliance_status. Clarification requests (bid_clarifications) with permitted scope and deadline. A supplier response is text/documents attached to the clarification, never a new revision (BR-22). EVA-03: the chair consolidates evaluator questions and distributes answers to affected assessors. Exclusions need grounds citing checks plus approval (approvals service subject_type exclusion). Then a notice with the challenge route. Excluded bids stay on record but are not ranked. Unopened price envelopes of failed bids stay sealed (AC-17). The tender moves closed → under_assessment via the lifecycle service on first opening.` },
  { id: 'evaluation', num: '11', title: 'Evaluation, commercial comparison, moderation, ranking and report',
    server: ['evaluation'], ui: ['evaluation'],
    fr: 'FR-14, PRD §9, BR-26, BR-27, BR-28, BR-29', screens: 'EVA-01, EVA-02, EVA-04, EVA-05, EVA-06', ac: 'AC-18, AC-19, AC-20', prd: '§7.11, §9 (all), §12.2',
    notes: `The scoring engine lives in domains/evaluation/scoring as pure functions over decimal strings. It covers the weighted points (rating/scale_max × max_points), lowest-ratio price score (lowest eligible evaluated cost / this cost × price weight), reference-set exclusion with recorded reason, threshold scopes, declared decimals for calc vs display vs tie, the tie sequence, and gate failures. Unit tests MUST reproduce PRD §9.2 exactly: A = 86.00, B = 88.00, and B (120,000) ranks first (AC-19). A missing score is null, never 0; the assessment stays incomplete (AC-18). Assignments: the chair assigns evaluators per lot/criteria/bids with due dates. The evaluator accepts, signs the confidentiality undertaking and declares conflicts (BR-08) before seeing any content (content comes through the sealing service). Recusal/reassignment preserves prior work. Independent evaluation: no view of others' scores until own submission and the moderation stage. Price is hidden until price_gate_releases, which the chair writes after non-price moderation is finalized. Submitted scores are formal. Corrections need a reason and keep history (score_corrections). Commercial comparison (EVA-04): submitted totals from bid_prices, arithmetic corrections kept separate with approval and supplier acknowledgment, FX via exchange_rates with source/date (original amount stays visible), evaluated cost, abnormally-low flag for review (never auto-reject), and affordability displayed separately from rank. Private sensitivity scenarios never alter official scores. Moderation (EVA-05): divergence view, consensus or declared aggregation with reasons, return to evaluator, finalize. Originals stay available to oversight (AC-20). Ranking and report (EVA-06): committee sign-off, report export, and recommendation hand-off (the awards domain reads evaluation_results). Allowed column write: bids.evaluation_status.` },
  { id: 'selection', num: '12', title: 'Demonstrations and references, shortlist, preferred bidder, due diligence, negotiation and BAFO',
    server: ['selection'], ui: ['selection'],
    fr: 'FR-15, FR-16, BR-30, BR-31', screens: 'BUY-22, BUY-23, BUY-24, BUY-25, BUY-27, SUP-19 (+ supplier view of assessment invites)', ac: 'AC-21, AC-22, AC-23, AC-24', prd: '§7.12, §7.13, §11.3 (SUP-18, SUP-19), §12.1 (BUY-22..25, BUY-27), §20',
    notes: `Assessment sessions have purpose, agenda, a basis (scored criterion / claim verification / eligibility gate — no double counting), equal-treatment confirmation, invitations and findings with declared effect (AC-21). Reference checks require consent. Shortlist: built from evaluation_results, with rule/threshold, include/exclude reasons, approval, and notices to included and excluded suppliers (only the authorized audience gets next-stage instructions, AC-22). "Create next-stage event" links to the tender-authoring route with fromTender and next-stage parameters. A change after approval needs a recorded decision. Preferred bidder: conditional. It records scope, value, rationale, remaining checks, negotiation topics, owner, contingency and fallback, and needs approval. All wording avoids "award" (BR-31). Due diligence: findings by area with disposition/owner/due date. A failure blocks award (the awards domain reads it) and requires a recorded, approved fallback process_decision before approaching the next bidder (AC-24). Negotiation is only possible when tenders.negotiation_permitted AND the policy version permits it; otherwise the action is blocked and the user must record a process decision (AC-23). Mandate approval, rounds, minutes, concessions and unresolved issues. Competitors' data is never exposed. BAFO rounds need procedural authority, eligible invitees, instructions and a deadline. Supplier BAFO submission happens in the bids workspace (bids round_type bafo); SUP-19 links there. A clarification can never act as a hidden negotiation round.` },
  { id: 'awards', num: '13', title: 'Award recommendation and approval, notices and standstill, debriefs and complaints, closeout',
    server: ['awards'], ui: ['awards', 'outcomes'],
    fr: 'FR-17, BR-31, BR-32, BR-33, BR-34, BR-35', screens: 'BUY-26, BUY-28, BUY-29, BUY-30, SUP-21, SUP-22, PUB-05', ac: 'AC-25, AC-26, AC-27, AC-29, AC-39', prd: '§7.14, §8.2, §8.3 (complaint), §11.2 (PUB-05), §11.3 (SUP-21, SUP-22), §12.1 (BUY-26, BUY-28..30), §20',
    notes: `The recommendation assembles evaluation results, commercial comparison, affordability, qualification status, diligence, negotiation outcomes, conflicts, exceptions and unresolved conditions. Per-lot outcomes cover award, partial, conditional, no award and cancelled, and each lot has an explicit outcome (BR-33). Totals reconcile with selected offers plus approved negotiation changes. Approval goes through the approvals service with authority limits. A departure from rank requires a process decision. The intent-to-award notice is distinct from the final award. The standstill is computed from the frozen policy version (calendar or working days via the time service), with extensions and a blocked-actions display. Final award requires all approvals, satisfied conditions, no blocking complaint hold (lifecycle holds with blocked_actions award_final/contract_sign) and a completed waiting period (AC-25). Never automatic: cron standstill-monitor only creates a task. Debriefs: request, schedule, written response limited to the recipient's own result (AC-27). Complaints: standing, acknowledgment, an independent case owner (not the challenged person when policy requires), a blocking hold, investigation, response, appeal, closure, remedy, and complaint_events history. The public award notice is redacted and reviewed before publishing (PUB-05 public search/detail). Tender/lot status changes go through the lifecycle service only. The overall status stays accurate when lots differ (awarded / partially_awarded, AC-26). Closeout (BUY-30): the gate checks lot outcomes, signed-contract links, ACCEPTED handovers (AC-29: blocked while a handover is unaccepted), outstanding complaints, securities and retention class. RFI path: information_collected with market findings and a linked next-step decision (AC-39). Then archive.` },
  { id: 'contracts', num: '14', title: 'Contract formation, handover, obligations, performance, finance, changes, renewal, closeout',
    server: ['contracts'], ui: ['contracts'],
    fr: 'FR-18, FR-19, BR-04, BR-33, BR-35, BR-36, BR-37', screens: 'CON-01..CON-11, SUP-23', ac: 'AC-28, AC-29 (handover side), AC-30, AC-31, AC-32', prd: '§7.15, §7.16, §8.3 (contract, obligation, change request), §13.1, §11.3 (SUP-23)',
    notes: `Create from final-awarded lot outcomes (allocations reconcile: the sum per lot outcome is ≤ the awarded value, no double counting). The legal entity + supplier legal party are mandatory (BR-04). A difference from the award (value/scope/terms) is flagged and requires approval before signature or start (AC-28). Signatures: authority checked. In-app signature records, or externally signed with recorded evidence and verification (never fabricate in-app signing evidence). A refusal leaves the contract unexecuted. Signed, effective, notice-to-proceed and delivery start are separate milestones with prerequisites (BR-35). "Active" is not possible merely because a draft was sent. Handover package; the named contract manager accepts or returns it with omissions; losing bids are never shared. Obligations and milestones: owners, dependencies, evidence, acceptance criteria. The supplier submits evidence. The buyer accepts or rejects with reasons, remediation owner and due date. Payment readiness is never implied (AC-30). Performance: measures, reviews shared with the supplier for a response before finalization, incidents, improvement actions. Financial view: ceiling, approved changes, committed, accepted milestones, invoices, payments, each labelled with source and as-of date. Estimates or disputed figures are never shown as paid. Change requests: cumulative value is computed and the authority check uses the CUMULATIVE exposure (AC-31). Supplier agreement is recorded. Affects-procurement-basis is flagged. Disputes/remedies only with an authorized decision. Renewal options: notice windows, decision with approval and justification. Cron renewal-windows ONLY alerts; nothing auto-renews and supplier consent is never assumed (AC-32). Cron obligation-status marks overdue and escalates. Closeout: final acceptance, reconciliation, security release with approval, surviving obligations stay tracked. SUP-23: the supplier sees only its own contracts and shared records. Export the contract-dates cron handler (signed_not_effective → active on the effective date; active → expired after term end with obligations kept; securities expiring/expired; DD-19).` },
  { id: 'reporting', num: '15', title: 'Dashboards, management reports, exports, global search, audit/retention/legal holds',
    server: ['reporting', 'records'], ui: ['dashboard', 'reports', 'records', 'search'],
    fr: 'FR-21, FR-22, PRD §15, §18, BR-39, BR-40, BR-43', screens: 'BUY-01, SUP-01, REP-01, REP-02, ADM-13, ADM-14, COM-08', ac: 'AC-34, AC-35', prd: '§13.2 (ADM-13, ADM-14), §13.4, §15, §18',
    notes: `BUY-01 dashboard is modelled on docs/screenshots/overview.png: quick-range chips + filter bar (entity, department, owner, category, value, stage), KPI cards (active events, pending approvals, closing ≤ 7 days, open complaints, contracts renewing ≤ 90 days, overdue obligations), pipeline-by-stage bar list, deadlines, workload by owner (Recharts), "Requires attention" list, and drill-through links. SUP-01: invitations, pursuits, submission status, deadlines, qualifications, expiring evidence, awards, contract tasks — current supplier only. REP-01 report families from §15.1 with §15.2 safeguards: count unique organizations, never revisions (AC-34); event vs lot level labelled; no whole-event + lot double counting; currency basis and conversion date stated; unlike currencies never summed without conversion; completeness/missing-data indicators; drill-through to permitted records only. REP-02/ADM-13: report definitions, preview of scope and redactions before sharing, scheduled delivery that re-checks recipient authorization at issue time, exports via the exports pgmq queue producing XLSX/CSV (exceljs) with a manifest (contents, versions, omissions, redactions, creator, date). COM-08: search across tenders, suppliers, tasks, contracts and documents the user is authorized to see; counts never reveal restricted records (BR-43); saved views. ADM-14 (records): audit viewer with filters, retention classes, legal/investigation holds via the lifecycle holds API (blocked_actions include disposal), cron retention-eligibility, disposal requests blocked while held (AC-35), approval, disposition record, and evidence packs. Export the report-schedules cron handler (runs due report definitions and re-checks each recipient's authorization at issue time, DD-19) and the retention-eligibility handler.` },
  { id: 'operations', num: '16', title: 'Platform operations, integrations, imports, subscription/offboarding, help and service cases',
    server: ['operations'], ui: ['ops', 'help', 'admin-integrations'],
    fr: 'FR-22, PRD §21, BR-46, BR-47', screens: 'OPS-01..OPS-07, ADM-15, ADM-16, ADM-17, COM-09', ac: 'AC-33, AC-36', prd: '§13.2 (ADM-15..17), §13.3, §16, §19, §20, §21',
    notes: `Operator area (/ops/*, operator tenant). Customer register without any tender content. Onboarding creates a buyer tenant + first admin via the Auth Admin API (allowed cross-write to tenants, partitions created by trigger) and tracks the onboarding stage. Offboarding plans show live events/contracts counts, export request, continuity, supplier access, retention and disposal timetable (AC-36). Nothing is silently destroyed (BR-47). Plans/entitlements: usage limits create a service task and NEVER block an invited supplier submission. Support cases, and temporary access that requires customer-admin authorization (the buyer-side approval page lives in this feature). Access is time-limited and audited, never impersonation or submit/score/approve/sign. The tenancy middleware already enforces grants (foundation), so this domain manages the grant lifecycle. Service incidents with impacts on tenders; buyers record their own deadline decisions. Platform oversight: privileged access reviews and aggregate usage only. Announcements and help content (help_articles) management. Buyer-side ADM-15 integration register and exceptions with reconciliation and manual fallback; the publication domain writes exceptions for failed external publication (AC-33). ADM-16 imports: CSV/XLSX upload (exceljs) → import_records with quality issues and duplicate candidates → review and accept → create provisional suppliers or historical contracts (allowed cross-writes) with origin, original dates and provenance; imports never certify controls that were not in use. ADM-17 buyer subscription view and offboarding request. COM-09 help center (articles by audience/topic), accessibility accommodation requests and service cases. Support can never become a bid-submission channel. Export the expire-support-access cron handler (with audit; request-time grant checks compare timestamps directly, DD-18).` },
]

const contractsOf = d => (d.id === 'reporting' ? ['reporting', 'records'] : [d.id])

// ───────────────────────────── ownership ─────────────────────────────
const SHARED_AREAS = ['svc-approvals', 'svc-notifications', 'svc-documents', 'svc-core']
const AREAS = ['scaffold-b', 'schema', 'platform-http', 'platform-data-auth', 'ui-live-api'].concat(SHARED_AREAS, ['integration'], DOMAINS.map(d => 'domain:' + d.id))
function ownedPaths(area) {
  if (area.indexOf('domain:') === 0) {
    const d = DOMAINS.find(x => 'domain:' + x.id === area)
    if (!d) return 'nothing (unknown area) — report instead of editing'
    const c = contractsOf(d)
    return d.server.map(s => 'src/server/domains/' + s + '/**').concat(
      d.ui.map(u => 'src/ui/src/features/' + u + '/**'),
      c.map(x => 'src/contracts/' + x + '.ts (contract changes per rule 3), src/mock-api/{handlers,fixtures}/' + x + '* (keep in sync), src/ui/src/api/' + x + '.ts'),
      ['src/server/tests/unit/' + d.id + '/**', 'src/server/tests/integration/' + d.id + '/**', 'src/server/tests/types/' + d.id + '/**',
        'scripts/db/demo/' + d.num + '-' + d.id + '.ts', 'supabase/migrations/2026100310' + d.num + '*_' + d.id.replace(/-/g, '_') + '_*.sql', '.build/progress/B/' + d.id + '.json']).join(', ')
  }
  const M = {
    'scaffold-b': 'root package.json scripts (no dependency changes), supabase/config.toml, supabase/.gitignore, scripts/db/ensure-signing-keys.mjs (adjust only), .github/workflows/ci.yml (enable verify-with-stack + migrate jobs), .env.local (local only; add Stage B variables), run.ps1, README.md, docs/local-development.md, docs/deployment.md, docs/background-jobs.md, e2e_tests/playwright.config.ts (smoke/full projects)',
    'schema': 'supabase/migrations/** (Wave B1 files), supabase/seed.sql, supabase/schema.expected.sql, src/server/lib/db/generated/**, scripts/db/generate-types.ts, scripts/db/validate-migrations.ts',
    'platform-http': 'src/server/lib/{config,logging,errors,validation,router}/**, src/server/lib/result.ts, src/server/lib/decimal.ts, api/**, scripts/dev/{serve-api.ts,dev.mjs}, scripts/ci/**, .env.example, .env.local.example, docs/environment-variables.md, src/server/tests/**/platform-http/**',
    'platform-data-auth': 'src/server/lib/{db (except generated),supabase,auth,tenancy,permissions,storage,audit}/**, src/server/domains/session/**, src/server/jobs/**, scripts/db/** (except generate-types.ts, validate-migrations.ts, ensure-signing-keys.mjs, demo modules 01+), scripts/db/demo/00-platform.ts, scripts/db/seed-demo.ts, scripts/jobs/**, src/server/tests/{helpers,fixtures}/**, src/server/tests/**/platform-data/**, src/server/tests/unit/platform-auth/**',
    'ui-live-api': 'src/ui/src/{auth,api,app,components,lib}/** (no features/**), e2e_tests/specs/{smoke,full}/**',
    'svc-approvals': 'src/server/domains/approvals/**, src/contracts/{approvals,tasks}.ts, src/mock-api/{handlers,fixtures}/{approvals,tasks}*, src/ui/src/features/{approvals,tasks}/**, src/ui/src/components/approvals/**, src/server/tests/**/approvals/**',
    'svc-notifications': 'src/server/domains/notifications/**, src/contracts/{notifications,notification-rules}.ts, their mock handlers/fixtures, src/ui/src/features/notifications/**, src/server/tests/**/notifications/**',
    'svc-documents': 'src/server/domains/documents/**, src/contracts/documents.ts, its mock handler/fixtures, src/ui/src/features/documents/**, src/ui/src/components/documents/**, src/server/tests/**/documents/**',
    'svc-core': 'src/server/domains/{audit,lifecycle,sealing,time}/**, src/contracts/{audit,calendars}.ts, their mock handlers/fixtures, src/ui/src/features/calendars/**, src/ui/src/components/audit/**, src/server/tests/**/{audit,lifecycle,sealing,time}/**',
    'integration': 'src/server/domains/registry.ts, src/server/jobs/cron/registry.ts, src/server/jobs/queue/handlers.ts, src/server/domains/approvals/outcome-registry.ts, src/server/domains/documents/access-registry.ts, src/server/domains/documents/export-registry.ts, api/cron/*.ts, supabase/seed.sql, migrations 20261005*, supabase/schema.expected.sql, src/server/lib/db/generated/**, src/server/tests/integration/contract-conformance/**, docs/background-jobs.md, README.md, package.json test floors; fix-only edits anywhere',
  }
  return M[area] || 'nothing (unknown area) — report instead of editing'
}

// ───────────────────────────── helpers ─────────────────────────────
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

TASK: Verification gate "${name}". READ-ONLY for source files; only run commands (generous timeouts; long ones in background). If the local Supabase stack is not running (e.g. after a reboot), start it with 'npm run supabase:start' first. You MAY run supabase:reset and the demo seed in a gate (no other agent runs during a gate).
${commands.map((c, i) => (i + 1) + '. ' + c).join('\n')}
passed = true only if EVERY command succeeded. For each failure, find the ROOT-CAUSE file(s) and set area to one of: ${AREAS.join(', ')} (ownership: architecture-plan §5 Stage B). Registries, seed.sql, cron/queue wiring and cross-domain glue belong to 'integration'. Give the real error text, trimmed.`
}
function fixPrompt(area, failures, stage) {
  return RULES + `

TASK: Fix verification failures from gate "${stage}" for area "${area}". You own ONLY: ${ownedPaths(area)}.
Failures:
${JSON.stringify(failures, null, 1)}
Fix root causes properly (no suppression, no skipped tests, no loosened types, no eslint-disable). Re-run the failing commands until they pass. Put anything outside your paths into 'remaining' with the exact file and change.`
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
1. Write .build/progress/B/${unit}.json containing exactly this JSON (pretty-printed): ${JSON.stringify({ stage: 'B', unit, message, report: report || null })}
2. ${COMMITS ? `Create a git checkpoint commit on branch ${BRANCH}. Run git status --short and confirm that .env.local, supabase/signing_keys.json, node_modules, dist and .qa-scratch are ignored (fix .gitignore if not). Then git add -A and git commit with this message (use a heredoc so the trailer is on its own line):
${message}

${TRAILER}
Never push. If there is nothing to commit, say so.` : 'Do not commit (checkpointCommits disabled).'}
Return the short commit hash or "no commit".`, { label: 'checkpoint:' + unit, phase: phaseTitle, effort: 'low' })
}

const BASE_GATE = [
  'npm run typecheck', 'npm run typecheck:ui', 'npm run lint', 'npm run lint:ui',
  'npm run supabase:reset', 'npm run db:types:check', 'npm run test', 'npm run test:ui', 'npm run build', 'npm run ci:security',
  'Runtime smoke: start "npm run dev:api" in the background, then GET http://127.0.0.1:3001/api/v1/health must return 200 {"status":"ok","version":"v1"} with x-correlation-id. Create an admin (npm run db:admin:create -- --email smoke@tenderiq.local), sign in against local Supabase Auth (password grant at http://127.0.0.1:54321/auth/v1/token), and GET /api/v1/me/context with the bearer must return 200 and validate against src/contracts/session.ts. Stop the API.',
  'npm run test:e2e:prototype (the prototype must still work in mock mode)',
]
const INT_GATE = BASE_GATE.concat(['npm run db:validate', 'npm run db:seed:demo (run twice; the second run is a no-op)', 'npm run test:e2e:smoke', 'npm run test:contracts (every contract endpoint implemented and conformant)'])
const FINAL_GATE = INT_GATE.concat(['npm run verify', 'npm run test:e2e (full suite incl. axe)', 'npm run ci:test', 'npm run ci:test:ui', 'npm run docs:api'])

// ═════════════════════════════ main ═════════════════════════════
async function main() {
  // ── B1 Foundation ──
  phase('B1 Foundation')
  let g1 = { passed: true }
  let foundationParts = []
  if (SKIP_PHASES.indexOf('B1 Foundation') >= 0) {
    log('Skipping B1 (resume); verifying state')
    g1 = await gateLoop('B1-resume', 'B1 Foundation', BASE_GATE, 3)
  } else {
    const sb = await run(RULES + `

TASK: SCAFFOLD-B (you are the only agent running right now). You own: ${ownedPaths('scaffold-b')}. Branch ${BRANCH} is checked out; run no git commands.
1. Add the Stage B npm scripts from brief §4.3 plus: build (keep), verify, db:migrate (supabase migration up --local --include-all), db:sql:check, db:types:check, test:unit, test:integration, test:contracts (vitest integration project filtered to src/server/tests/integration/contract-conformance), ci:test, ci:test:ui, test:e2e, test:e2e:smoke, cron:*, queue:*, jobs:status, dev (node scripts/dev/dev.mjs: real API + Vite), dev:api, dev:vercel. Keep every Stage A script (dev:prototype, dev:mock-api, docs:api, test:e2e:prototype). Wire them to the files the brief names (other agents implement them): scripts/db/{seed.ts, seed-demo.ts, seed-target.ts, configure-job-cron.ts, create-admin.ts, generate-types.ts, validate-migrations.ts, sql-check.ts}, scripts/jobs/{run-cron.ts, local-queue-worker.ts, enqueue-test.ts, job-status.ts}, scripts/dev/{serve-api.ts, dev.mjs}. NO dependency changes.
2. supabase/config.toml, supabase/.gitignore and scripts/db/ensure-signing-keys.mjs already exist from Stage A. Adjust only if Stage B needs it (the storage buckets come by migration). Keep [inbucket] smtp_port = 54325 (DD-44).
3. CI: enable the Stage B verify steps (supabase start/reset, integration tests, db:validate) and the migrate job per brief §12. Playwright: smoke + full projects against the real app (webServer = npm run dev) with the demo seed.
4. Update README.md and docs/local-development.md for both modes. Write docs/deployment.md and docs/background-jobs.md (initial, from plan §3.9).
5. Ensure the local Supabase stack from Stage A runs ('npm run supabase:start'). Extend .env.local with SUPABASE_DATABASE_URL, SUPABASE_DIRECT_DATABASE_URL, distinct random CRON_SECRET and INTERNAL_JOB_SECRET, STORAGE_ADAPTER=supabase, and EMAIL_ENABLED=true, SMTP_HOST=127.0.0.1, SMTP_PORT=54325, EMAIL_FROM=notices@tenderiq.local (Mailpit, DD-44).`, { label: 'scaffold-b', phase: 'B1 Foundation', schema: REPORT })
    if (!sb) return { status: 'failed', phase: 'B1 Foundation', step: 'scaffold-b' }

    const SCHEMA_PARTS = [
      { id: 'w1', files: 'Migrations 00–04 (extensions; platform_core incl. partition function, job platform, pgmq queues, storage buckets, audit_log; org_structure; policy_templates; shared_services)' },
      { id: 'w2', files: 'Migrations 05–08 (suppliers_qualification incl. v_qualification_status; requests_planning; tenders incl. templates.source_tender_id FK; participation_clarifications)' },
      { id: 'w3', files: 'Migrations 09–13 (bids incl. v_bid_receipt_metadata; opening_evaluation; selection_award; contracts; records_reporting_ops)' },
    ]
    const schemaChain = async () => {
      await parallel(SCHEMA_PARTS.map(p => () => run(RULES + `

TASK: SCHEMA WRITER ${p.id}. Write ONLY these migration files in supabase/migrations/ with the exact filenames from docs/plan/schema-blueprint.md: ${p.files}.
Translate the blueprint faithfully and completely, applying design-decisions.md DD-01 … DD-15 (forward FKs added by the later migration, NULLS NOT DISTINCT, [S] vs [R] tags, renamed customer_tenant_id columns, envelope CHECKs, added unique keys and currency columns, reference formats, identity defaults on tenants, view shapes): every table, column, named CHECK, FK plus its index, unique constraint and listed index, set_updated_at triggers on "mut" tables, and COMMENT ON TABLE with the PRD reference. Each file starts with the brief §6.1 header. Every CHECK list must equal the corresponding array in src/contracts/enums.ts; if the contract and the blueprint differ, the approved contract wins and you record the deviation. Tables with [P] use PARTITION BY LIST (tenant_id) with PK (tenant_id, id). Tables with [S] get supplier_tenant_id. Do not apply the migrations. Reference other writers' tables by blueprint names and rely on filename order.`,
        { label: 'schema-' + p.id, phase: 'B1 Foundation', schema: REPORT })))
      return run(RULES + `

TASK: SCHEMA APPLY. You own: ${ownedPaths('schema')}.
1. Write Migration 14 (views, final revoke from anon/authenticated incl. default privileges, cron.schedule for every job in architecture-plan §3.9 plus queue-drain every minute).
2. Run 'npm run supabase:reset' and fix every SQL error until it applies cleanly from empty TWICE with no error markers. Verify tenant_id on [T]/[P] tables, the revokes, and partition creation on tenant insert.
3. supabase/seed.sql: the permission catalog and role templates GENERATED FROM src/contracts/permissions.ts (write a unit test that fails if seed.sql and permissions.ts disagree), category_catalog (30–60 water/utility/ICT/facilities codes), conflict-tolerant, in a -- BEGIN BASELINE / -- END BASELINE block, with no users and no tenant data.
4. scripts/db/generate-types.ts per brief §5.6 (+ supplier-scoped-tables.ts generated from the blueprint [S] tags, NOT from column presence, plus a guard test that no [R] table is on it (DD-03); --check mode), then run it. Add a unit test that every enum in src/contracts/enums.ts equals the live CHECK constraint lists.
5. scripts/db/validate-migrations.ts per brief §6.5; produce supabase/schema.expected.sql.`, { label: 'schema-apply', phase: 'B1 Foundation', schema: REPORT })
    }
    foundationParts = await parallel([
      () => schemaChain(),
      () => run(RULES + `

TASK: PLATFORM-HTTP. You own: ${ownedPaths('platform-http')}.
Implement per brief §3.2, §3.3, §4, §5.1, §5.3–§5.5, §8, §9.2, §13:
- lib/config: EXTEND the Stage A module to every server variable, including the DD-44 email variables (loadConfig/getConfig/tryGetConfig; ConfigurationError listing every bad variable; blankAsAbsent; deep freeze; the only process.env reader).
- lib/logging (JSON + child + redactor).
- lib/errors (AppError subclasses + problem+json whose shape is IDENTICAL to src/contracts/common.ts Problem).
- lib/result.ts. lib/validation.
- lib/decimal.ts re-exports src/contracts/decimal.ts (DD-32); add server-side tests for money edge cases.
- Public-write rate limiting middleware over rate_limit_buckets (per IP hash and per email hash; applied to public POSTs) (DD-28), and Idempotency-Key handling over request_idempotency for endpoints declared idempotent in the contracts (DD-39).
- lib/router: env.ts, app.ts buildApp(deps) in the exact brief §5.1 order (HSTS only when APP_ENV !== local; public allow-list /api/v1/health and /api/v1/public/*; 404 for unknown routes; health route), and contractRoute(app, endpoint, handler), the real-API twin of the mock's mockRoute. contractRoute registers method+path from the src/contracts endpoint, parses params/query/body with the contract schemas (422 CODE|message errors[]), applies requirePermission(endpoint.permission), calls the handler with typed context, and in non-production validates the response against the contract schema.
- api/v1/index.ts (lazy cached app, sanitized 500 on config failure, named method exports, runtime nodejs) importing src/server/domains/registry.ts: create it now exporting an EMPTY typed 'domainMounts' list (Integration fills it). api/cron/<job>.ts for every job in plan §3.9 and api/queue/drain.ts (thin; delegate to src/server/jobs).
- scripts/dev/serve-api.ts (node:http bridge, port 3001) and scripts/dev/dev.mjs (API + Vite).
- scripts/ci: extend scan-secrets and scan-bundle for Stage B (server variable names, service-role literals, src/server fragments, mock fixtures) while keeping the Stage A behaviour. assert-test-run.
- .env.example, .env.local.example, docs/environment-variables.md.
- Tests: config, redactor with fake secrets, problem+json parity with the contract, decimal, the process.env guard, the vercel.json guard, env examples ↔ schema with no inline passwords, security headers, and contractRoute behaviour.`, { label: 'platform-http', phase: 'B1 Foundation', schema: REPORT }),
      () => run(RULES + `

TASK: PLATFORM-DATA-AUTH. You own: ${ownedPaths('platform-data-auth')}.
Implement brief §5.1 (steps 6–8), §5.6–§5.9, §6.4, §9 and architecture-plan §3.1–§3.3:
- lib/db: pool.ts (max 2, timeouts, allowExitOnIdle, error listener, int8 → number with overflow throw, numeric as string), client.ts, transactions.ts, kyselify.ts (over generated types from schema-apply; wait/retry if not yet present), tenant.ts (branded TenantId, forTenant, tenantPredicate), supplier.ts (forSupplier over supplier-scoped-tables).
- lib/supabase and lib/auth/verify.ts exist from Stage A: extend them. Add the auth middleware that resolves an ACTIVE users row, plus the invited-user exception for POST /me/invitations/:token/accept (DD-27).
- lib/tenancy: X-Tenant-Id with one identical 403 and tenant kind per prefix (/buyer, /supplier, /ops; /me and /public exempt). The OPERATOR SUPPORT ACCESS path uses an active authorized support_access_grants row, gets the fixed support.view set, and is audited BEFORE the handler.
- lib/permissions (effective set from roles via membership and groups, scoped with validity and DD-26 scope matching, grants with expiry compared at request time (DD-18), restrictions win; requirePermission). lib/audit (recordAudit writer choosing the partition tenant per DD-11; no sealed content or scores in before/after, DD-31). lib/storage (StorageAdapter, Supabase + Fake adapters, conformance suite).
- domains/session: implement src/contracts/session.ts exactly (GET /api/v1/me/context, PUT /api/v1/me/theme) via contractRoute.
- jobs/: cron registry type + run-cron-job.ts (job_run; unknown → failed + 501), secret check (constant-time SHA-256, before DB), tenant-iterator, queue adapters (pgmq + in-memory), drain.ts (25s budget; idempotency claim + handler + ack in ONE transaction; 5 attempts → archive; unparseable → archive; unknown type → retry), empty typed handler maps for Integration.
- scripts/db: seed.ts (+ seed-target.ts env guard), create-admin.ts (operator tenant 'tenderiq-ops' + super-admin via the Auth Admin API; prints the password once), configure-job-cron.ts, sql-check.ts, seed-demo.ts (refuses production; runs scripts/db/demo/NN-*.ts in order via fs discovery), and demo/00-platform.ts (every tenant and persona in docs/plan/demo-storyline.md with the SAME emails, slugs and memberships as src/mock-api/fixtures/platform.ts; it links the existing local Supabase Auth accounts created by npm run auth:personas, or creates them, then creates users/memberships/role assignments) exporting DemoContext helpers.
- scripts/jobs: run-cron, local-queue-worker, enqueue-test, job-status.
- src/server/tests/helpers: createTestApp({ mount }) with the full chain, auth/tenant fixtures with unique names and real tokens, and a global-setup that cleans only test tenants older than 2h.
- Tests: JWT cases, 401/403 matrix, kind enforcement, identical 403s, the support grant path audited, permission resolution, forTenant type tests, pool max ≤ 2, no prepared statements, no session-state SQL scan, Data API lockdown, job secret checks, SECURITY DEFINER helpers EXECUTED, queue idempotency/retry/archive, and storage conformance.`, { label: 'platform-data-auth', phase: 'B1 Foundation', schema: REPORT }),
      () => run(RULES + `

TASK: UI-LIVE-API. You own: ${ownedPaths('ui-live-api')}.
Make the SPA run against the real backend while keeping prototype mode intact. Auth is already real supabase-js from Stage A (DD-43):
- 'npm run dev' proxies to the real API (:3001 via dev:api). 'npm run dev:prototype' keeps the mock API. The PrototypeBanner shows only when /me/context reports environment.mode = "prototype". Complete the invitation set-password flow (/invite/:token via the Supabase invite link, emails in Mailpit) against the real /me/invitations accept endpoint.
- api/client.ts: keep contract validation in development, handle real 401/403/409/422 flows, and add retry-safe GETs.
- Shared document widgets: implement the real two-step upload envelope (create → PUT to the signed URL → confirm) against src/contracts/documents.ts, keeping the mock path working.
- e2e_tests/specs/smoke (login, org switch, logout, shell, axe) and full-journey spec skeletons ARE NOT ALLOWED as placeholders: write the smoke specs now; the full journeys are written by Integration once the domains exist.
- Verify both modes build and the prototype E2E still passes.`, { label: 'ui-live-api', phase: 'B1 Foundation', schema: REPORT }),
    ])
    if (!foundationParts[0]) return { status: 'failed', phase: 'B1 Foundation', step: 'schema' }
    const fi = await run(RULES + `

TASK: FOUNDATION INTEGRATE (Stage B). Reports:
${JSON.stringify([sb].concat(foundationParts).map(p => p && { summary: p.summary, followUps: p.followUps, openIssues: p.openIssues }), null, 1)}
Make fix-only edits anywhere in foundation paths so the pieces fit, and resolve the foundation followUps. Then make these pass: ${BASE_GATE.join(' | ')}.
Then UPDATE docs/plan/foundation-contract.md with a Stage B section: exact verified APIs, with import paths, signatures and one real usage example each, for config, logger, errors, Result, validation, decimal, db (getDb, withTransaction, forTenant, forSupplier, tenantPredicate), auth/tenancy context, requirePermission, contractRoute, audit writer, storage, job/queue registries, test helpers, DomainMount, and demo seed module conventions.`, { label: 'foundation-integrate', phase: 'B1 Foundation', schema: REPORT })
    g1 = await gateLoop('B1', 'B1 Foundation', BASE_GATE, 4)
    if (!g1.passed) return { status: 'failed', phase: 'B1 Foundation', gate: g1.last, integrate: fi && fi.summary }
    await checkpoint('phase-B1-foundation', 'backend: foundation (schema, platform, auth, jobs, live UI mode)', 'B1 Foundation', { integrate: fi && fi.summary })
  }
  if (!g1.passed) return { status: 'failed', phase: 'B1 Foundation (resume check)', gate: g1.last }

  // ── B2 Shared services ──
  phase('B2 Shared services')
  let g2 = { passed: true }
  if (SKIP_PHASES.indexOf('B2 Shared services') < 0) {
    const SHARED = [
      { area: 'svc-approvals', task: `APPROVALS + TASKS (PRD §4.2, §5.3, FR-04, BR-06, BR-07, BR-10, COM-04, COM-05; AC-05/AC-06 mechanics). Implement src/contracts/{approvals,tasks}.ts exactly via contractRoute. requestApproval(tx, ctx, {...subject, version, contentHash, amount, currency, legalEntityId, categoryId, route}) builds steps, where each approver must hold authority (authority_limits + active delegations; value/currency/entity/category/date aware). SoD blocks self-approval when enforced. A conflicted approver is blocked. It creates tasks and notifications. decide(...) records acting-for/delegation, finalizes the status, and runs outcome-registry handlers (export an EMPTY typed registry) in the same transaction. invalidateApprovals(...) handles material change. checkAuthority is pure and exposed for UI hints. Tasks: create, complete, return, reassignOpenTasks (AC-04), escalation, summary. Export the expire-approvals cron handler (DD-18). The existing UI pages and components/approvals must work against the real API unchanged or with minimal fixes.` },
      { area: 'svc-notifications', task: `NOTIFICATIONS + NOTICES (PRD §14.2, §14.3, BR-41, BR-42, COM-06, ADM-12). Implement src/contracts/{notifications,notification-rules}.ts. notify(...) respects preferences except for mandatory notices. issueNotice(...) writes notices + notice_recipients and enqueues fan-out on pgmq 'notifications' (export the handler). Delivered, opened, acknowledged and terms accepted are distinct. An undeliverable recipient org creates a delivery-exception task and never alters a deadline. The DeliveryChannel port has an in_app AND an email implementation (DD-44): email uses nodemailer over SMTP (locally Mailpit at 127.0.0.1:54325; a message accepted by Mailpit is recorded as delivered), is used only when EMAIL_ENABLED, and carries only the title, official deadline and link, never confidential content. Integration tests read Mailpit's API (http://127.0.0.1:54324/api/v1/messages) to assert delivery. The hosted provider webhook is deferred. The deadline-reminders, notification-digests and notice-reconciliation cron handlers are exported (DD-19; alerts deduplicated with <job>:<entity>:<window> idempotency keys).` },
      { area: 'svc-documents', task: `DOCUMENTS + EXPORTS (PRD §14.1, COM-07, brief §5.9, DD-12, DD-16). Implement src/contracts/documents.ts. Also own exports: requestExport(tx, ctx, {type, subject}) writing exports rows, plus the pgmq 'exports' queue handler (the Storage write stays outside the per-message transaction, with a deterministic key; an archived message marks the export failed) and documents/export-registry.ts (an EMPTY typed registry of per-type generators that domains export and Integration wires). Storage keys follow DD-12. createDocument, createUploadUrl (pending version, bucket by classification, tenant-prefixed key), confirmUpload (stat, size, sha256, supersede chain), createDownloadUrl via access-registry.ts policies (EMPTY typed registry exported; unregistered types DENIED; sealed never downloadable here), createRedactedCopy, history, withdraw/supersede. The upload-reaper cron handler is exported. The UI widgets use the real envelope.` },
      { area: 'svc-core', task: `CORE (also owns comments, holds, record_snapshots and process_decisions with recordProcessDecision(), DD-16): domains/time (pure official-deadline formatting with offset, working days with calendars; exhaustive tests incl. DST), domains/lifecycle (PRD §8.2 tender + lot legality matrices with guards; transitionTender/transitionLot that respect holds; deriveTenderStatusFromLots (AC-26); holds API createHold/releaseHold/isActionBlocked that never changes dates; snapshotRecord and issueTenderVersion), domains/sealing (assertEnvelopeReadable/readableEnvelopes with ALL four conditions of plan §3.3, readSealedContent helpers as the ONLY sealed read path, receiptMetadata; an architecture guard test forbidding sealed-table reads elsewhere; AC-15/AC-16 integration tests), domains/audit (entity history per src/contracts/audit.ts), and calendars (src/contracts/calendars.ts, including impact review, BR-12).` },
    ]
    const sharedReports = await parallel(SHARED.map(s => () => run(RULES + `

TASK: SHARED SERVICE — ${s.area}. You own: ${ownedPaths(s.area)}.
Read docs/plan/foundation-contract.md first.
${s.task}
Zod, permission guards, tenant scoping, audit, and unit + integration tests (401/403/isolation). Keep the mock handlers for your contracts in sync. When the same function names are mentioned in another service's description, code against them and report mismatches.`,
      { label: s.area, phase: 'B2 Shared services', schema: REPORT })))
    const si = await run(RULES + `

TASK: SHARED-SERVICES INTEGRATE. Reports:
${JSON.stringify(sharedReports.map((r, i) => r && { area: SHARED[i].area, summary: r.summary, followUps: r.followUps, routers: r.routers, cronJobs: r.cronJobs, queueHandlers: r.queueHandlers, openIssues: r.openIssues }), null, 1)}
Fix-only edits anywhere. Reconcile the cross-service interfaces, wire the shared routers into domains/registry.ts, wire cron and queue handlers into the registries, and add permissions to seed.sql AND src/contracts/permissions.ts. Make these pass: ${BASE_GATE.join(' | ')}.
Write docs/plan/shared-services-contract.md: exact import paths, signatures, error codes and one real example each for requestApproval/decide/invalidateApprovals/checkAuthority/outcome handlers, tasks, notify/issueNotice/acknowledgment, documents + access policies, lifecycle transitions/holds/snapshots/issueTenderVersion, sealing, time, audit, and the registry conventions.`, { label: 'shared-integrate', phase: 'B2 Shared services', schema: REPORT })
    g2 = await gateLoop('B2', 'B2 Shared services', BASE_GATE, 4)
    if (!g2.passed) return { status: 'failed', phase: 'B2 Shared services', gate: g2.last, integrate: si && si.summary }
    await checkpoint('phase-B2-shared', 'backend: shared services (approvals, tasks, notifications, documents, lifecycle, sealing, time, audit)', 'B2 Shared services', { integrate: si && si.summary })
  }

  // ── B3 Domain backends ──
  phase('B3 Domain backends')
  const todo = DOMAINS.filter(d => SKIP_UNITS.indexOf(d.id) < 0)
  const head = d => RULES + `

DOMAIN ${d.num} — ${d.title} (id: ${d.id}).
Scope: ${d.fr}. Screens: ${d.screens}. Acceptance scenarios (must be TRUE and tested): ${d.ac}.
Read in full: docs/PRD.md sections ${d.prd}, docs/plan/foundation-contract.md, docs/plan/shared-services-contract.md, src/contracts/${contractsOf(d).join('.ts, src/contracts/')}.ts (the approved contract), and the mock handlers/fixtures for the same contract (they show the intended behaviour).
Domain rules (binding): ${d.notes}
You own (write): ${ownedPaths('domain:' + d.id)}.
Schema changes: ADDITIVE ONLY, and only if strictly necessary. One file supabase/migrations/2026100310${d.num}NN_${d.id.replace(/-/g, '_')}_<desc>.sql, validated with 'npm run db:sql:check -- <file>', then 'npm run db:migrate' and 'npm run db:types'. Never reset the DB.`
  const results = await pipeline(todo,
    d => run(head(d) + `

TASK (1/4): Implement the BACKEND for EVERY endpoint in this domain's contract.
- Module per brief §5.2 under src/server/domains/${d.server.join(', src/server/domains/')}. Routes use contractRoute(endpoint, handler), so every endpoint's path, permission, input and output come from the contract. Services use Result with the contract's error codes; repositories use Kysely with forTenant/forSupplier; workflow/ holds legality matrices; jobs/ holds handlers.
- Every business rule in the domain rules is enforced server-side, using shared services for approvals, tasks, notifications/notices, documents, lifecycle, sealing and audit on every consequential action.
- Export (do NOT register) approval outcome handlers, document access policies, and cron and queue handlers.
- Tests: unit tests for every legality row and calculator; integration tests (createTestApp + local DB) for every endpoint covering 401, 403 (kind, permission, assignment) and isolation; at least one test named 'AC-xx …' per acceptance scenario; and contract-conformance tests showing responses validate against the contract.
- Demo seed module scripts/db/demo/${d.num}-${d.id}.ts implementing the same storyline data as src/mock-api/fixtures for this domain (idempotent, natural keys, own tables only; executed during Integration).
Done means: filtered typecheck and lint are clean, and your tests pass. Return the REPORT with routers and handler exports.`, { label: 'api:' + d.id, phase: 'B3 Domain backends', schema: REPORT }),
    (api, d) => run(head(d) + `

TASK (2/4): UI HARDENING against the real backend (report: ${JSON.stringify(api && { summary: api.summary, openIssues: api.openIssues, followUps: api.followUps })}).
Run this domain's pages against the real API (npm run dev with the local stack and the demo seed modules loaded so far, or createTestApp-backed checks) and against the mock (prototype mode). Fix everything the prototype hid:
- real error codes and fieldErrors;
- real document uploads;
- empty or edge data;
- refresh after commands (static mock responses never needed it);
- concurrency conflicts (409);
- permission-driven states.
Keep the approved UX and visual fidelity. Keep the mock fixtures and handlers in sync with any contract change. Update the RTL tests. Return the REPORT.`, { label: 'ui:' + d.id, phase: 'B3 Domain backends', schema: REPORT }).then(ui => ({ api, ui })),
    (r, d) => run(head(d) + `

TASK (3/4): ADVERSARIAL REVIEW. You are READ-ONLY except .qa-scratch/${d.id}-review/ and your progress marker. For every screen, FR, BR and AC in scope, find the enforcing server code and the proving test. Then try to break it: missing permission or assignment checks, cross-tenant or cross-supplier leaks, buyer access to drafts or sealed content, unguarded transitions, overwritten history, float money, missing AC tests, contract non-conformance, placeholders, UI/real-API mismatches, and PRD wording violations. If verdict = pass, write .build/progress/B/${d.id}.json = {"stage":"B","unit":"${d.id}","status":"done","review":"pass"}.`, { label: 'review:' + d.id, phase: 'B3 Domain backends', schema: REVIEW }).then(review => Object.assign({}, r, { review })),
    (r, d) => {
      const gaps = (r.review && r.review.gaps) || []
      if (!gaps.length) return Object.assign({}, r, { fix: null, domain: d.id })
      return run(head(d) + `

TASK (4/4): Close ALL of these gaps, with tests:
${JSON.stringify(gaps, null, 1)}
Re-run the filtered typecheck, lint and tests. Then write .build/progress/B/${d.id}.json = {"stage":"B","unit":"${d.id}","status":"done","gapsFixed":<n>,"report":<your REPORT incl. routers/handlers>} and return the REPORT.`, { label: 'fix:' + d.id, phase: 'B3 Domain backends', schema: REPORT }).then(fix => Object.assign({}, r, { fix, domain: d.id }))
    },
  )
  if (HALTED) throw new Error('halted by circuit breaker')
  const failedDomains = todo.filter((d, i) => !results[i] || !results[i].api || !results[i].ui).map(d => d.id)
  todo.filter(d => failedDomains.indexOf(d.id) < 0).forEach(d => COMPLETED.push(d.id))

  // ── B4 Integration ──
  phase('B4 Integration')
  const wiring = todo.map((d, i) => {
    const r = results[i] || {}
    const reps = [r.api, r.ui, r.fix].filter(Boolean)
    const cat = k => reps.flatMap(x => x[k] || [])
    return { domain: d.id, num: d.num, routers: cat('routers'), cronJobs: cat('cronJobs'), queueHandlers: cat('queueHandlers'), approvalHandlers: cat('approvalHandlers'), documentPolicies: cat('documentPolicies'), followUps: cat('followUps'), openIssues: cat('openIssues'), incomplete: failedDomains.indexOf(d.id) >= 0 }
  })
  let g3 = { passed: true }
  if (SKIP_PHASES.indexOf('B4 Integration') < 0) {
    const integ = await run(RULES + `

TASK: INTEGRATION (Stage B). You own: ${ownedPaths('integration')}; fix-only edits anywhere. Wiring data (domains skipped on resume have their reports in .build/progress/B/<id>.json):
${JSON.stringify(wiring, null, 1)}
1. Wire EVERY router into domains/registry.ts, every export generator into documents/export-registry.ts, every cron handler into jobs/cron/registry.ts (matching cron.schedule rows and api/cron files; add forward migration 20261005000100_integration_schedules.sql for any gaps), queue handlers, approval outcome handlers and document policies.
2. Apply every followUp. Permissions go into seed.sql + src/contracts/permissions.ts. schema_change items go into forward migration 20261005000200_integration_schema.sql. Record contract_change items in docs/technical/07-api.md.
3. Finish any domain marked incomplete.
4. Write src/server/tests/integration/contract-conformance/: a test that EVERY endpoint in src/contracts/catalog.ts is registered in the real app (no missing or extra routes), plus a persona-driven conformance run calling each GET for its screen personas against the demo seed and validating responses with the contract.
5. Run supabase:reset, db:types, db:validate --update-snapshot, and db:seed:demo twice (the second run is a no-op). Fix the seed modules until the storyline matches the prototype fixtures.
6. Write the Playwright full journeys (request → approval; authoring → release; submit → receipt → replace; opening → evaluation → award; contract milestone rejection) against the real app.
7. Update docs/background-jobs.md, the README (demo users; both modes), and the test-count floors.
Then make these pass: ${INT_GATE.join(' | ')}.`, { label: 'integrate', phase: 'B4 Integration', schema: REPORT })
    g3 = await gateLoop('B4', 'B4 Integration', INT_GATE, 5)
    await checkpoint('phase-B4-integration', 'backend: domains integrated (registries, contract conformance, demo seed)', 'B4 Integration', { integrate: integ && integ.summary, gate: g3.passed })
  }

  // ── B5 QA ──
  phase('B5 QA')
  let qa = { raw: 0, unique: 0, confirmed: [] }
  let g4 = { passed: true }
  if (SKIP_PHASES.indexOf('B5 QA') < 0) {
    const QA_BASE = RULES + `

QA AUDIT. READ-ONLY for source files; you may run commands, the app on a port of your choosing, and Playwright; scratch only under .qa-scratch/<your-label>/. The demo seed is loaded (password test1234). Report only real, reproducible findings with file:line, requirement, evidence and a precise fix. Set 'area' to one of: ${AREAS.join(', ')}.`
    const AUD = [
      { key: 'types', task: 'TypeScript types: strictness, casts, exactOptionalPropertyTypes, Kysely generated-type usage, contract ↔ route ↔ UI type flow (no parallel hand-written DTOs), Result/error codes matching the contract.' },
      { key: 'acc-a', task: 'AC-01 … AC-09: trace end to end through the running app and code, find and run the test, and try to break each via alternative paths (other persona, tenant, direct API).' },
      { key: 'acc-b', task: 'AC-10 … AC-18, same method.' },
      { key: 'acc-c', task: 'AC-19 … AC-27, same method (recompute PRD §9.2 yourself).' },
      { key: 'acc-d', task: 'AC-28 … AC-36 and AC-39, same method.' },
      { key: 'confidentiality', task: 'PRD §4.3 matrix row by row with real API calls per persona; sealed content (BR-17, BR-26); drafts; other suppliers\' cases; cross-buyer assessments (BR-45); leaks via search/counts/exports/notifications/dashboards/public (BR-43); support access limits; tenant header spoofing; missing requirePermission; anon/authenticated grants; secrets in the bundle; problem+json leakage.' },
      { key: 'brief', task: 'Architecture brief §1–§16 as a checklist, including all guard tests present AND passing, forbidden technologies absent, and SECURITY DEFINER helpers executed in tests.' },
      { key: 'ui', task: 'UI against the REAL backend: Playwright screenshots of every nav destination for the key personas in both themes, compared with docs/prototype/screens (the approved prototype) and docs/screenshots; axe (serious/critical); console errors; regressions from the approved prototype.' },
      { key: 'completeness', task: 'Screen ID → route → nav → contract → real route → test matrix; no mock-only behaviour left in live mode; TODO/FIXME/placeholder/skip scan; every PRD principal action wired end to end.' },
      { key: 'rules', task: 'BR-01 … BR-48 (in scope) and every PRD §8 lifecycle (legal and illegal transitions via direct API, history preserved), §9.3 calculation rules, and §15.2 metric safeguards.' },
    ]
    const audits = await parallel(AUD.map(a => () => run(QA_BASE + '\n\nAUDIT FOCUS (' + a.key + '): ' + a.task, { label: 'audit:' + a.key, phase: 'B5 QA', schema: FINDINGS })))
    const all = []
    audits.forEach((r, i) => { if (r) r.findings.forEach(f => all.push(Object.assign({ auditor: AUD[i].key }, f))) })
    const seen = {}
    const unique = []
    for (const f of all) {
      const k = (f.file + '|' + String(f.title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()).slice(0, 240)
      if (!seen[k]) { seen[k] = true; unique.push(f) }
    }
    log('QA: ' + all.length + ' raw, ' + unique.length + ' unique')
    const VOTES = { blocker: 3, major: 2, minor: 1 }
    const judged = await parallel(unique.map((f, idx) => () => {
      const n = VOTES[f.severity] || 1
      return parallel(Array.from({ length: n }, (_, v) => () => run(RULES + `

ADVERSARIAL VERIFICATION (voter ${v + 1}/${n}). READ-ONLY; scratch only under .qa-scratch/verify-${idx}-${v}/. Try to REFUTE this finding with the code and a reproduction. If you cannot confirm it with concrete evidence, set refuted = true.
Finding: ${JSON.stringify(f)}`, { label: 'verify:' + idx + ':' + v, phase: 'B5 QA', schema: VERDICT, effort: 'high' })))
        .then(vs => { const ok = vs.filter(Boolean).filter(x => !x.refuted).length; return Object.assign({}, f, { confirmed: ok >= Math.ceil(n / 2) }) })
    }))
    const confirmed = judged.filter(Boolean).filter(f => f.confirmed)
    const byArea = {}
    for (const f of confirmed) { const k = AREAS.indexOf(f.area) >= 0 ? f.area : 'integration'; (byArea[k] = byArea[k] || []).push(f) }
    const qf = await parallel(Object.keys(byArea).map(area => () => run(RULES + `

TASK: Fix these CONFIRMED QA findings for area "${area}". You own: ${ownedPaths(area)}.
${JSON.stringify(byArea[area], null, 1)}
Fix root causes and add a test that would have caught each one. Re-run the affected checks. Put anything outside your paths into 'remaining'.`, { label: 'qafix:' + area, phase: 'B5 QA', schema: FIX })))
    const cross = qf.filter(Boolean).flatMap(x => x.remaining || [])
    if (cross.length) await run(fixPrompt('integration', cross.map(c => ({ area: 'integration', command: 'qa cross-area', files: [], errorExcerpt: c })), 'B5'), { label: 'qafix:cross', phase: 'B5 QA', schema: FIX })
    g4 = await gateLoop('B5', 'B5 QA', INT_GATE, 4)
    qa = { raw: all.length, unique: unique.length, confirmed: confirmed.map(f => ({ severity: f.severity, area: f.area, title: f.title })) }
    await checkpoint('phase-B5-qa', 'backend: QA fixes', 'B5 QA', { qa: { raw: qa.raw, unique: qa.unique, confirmed: qa.confirmed.length }, gate: g4.passed })
  }

  // ── B6 Final gate ──
  phase('B6 Final gate')
  const critic = await run(RULES + `

COMPLETENESS CRITIC (read-only; scratch in .qa-scratch/critic/). What is still missing or unproven? Look for in-scope screens not fully functional against the real backend, acceptance scenarios without a passing test, principal actions without an end-to-end path, docs that do not match reality (README, local-development, deployment, background-jobs, environment-variables, docs/technical), demo data gaps, CI steps that would fail, and 'npm run build' / 'npm run verify' failing on a clean checkout. complete = true only if nothing material is missing. Set area to one of: ${AREAS.join(', ')}.`, { label: 'critic', phase: 'B6 Final gate', schema: CRITIC })
  if (critic && !critic.complete && critic.missing.length) {
    const byArea = {}
    for (const m of critic.missing) { const k = AREAS.indexOf(m.area) >= 0 ? m.area : 'integration'; (byArea[k] = byArea[k] || []).push(m) }
    await parallel(Object.keys(byArea).map(area => () => run(RULES + `

TASK: Close these completeness gaps for area "${area}". You own: ${ownedPaths(area)}.
${JSON.stringify(byArea[area], null, 1)}
Complete them properly with tests. Put anything outside your paths into 'remaining'.`, { label: 'final-fix:' + area, phase: 'B6 Final gate', schema: FIX })))
  }
  await run(RULES + `

TASK: DOCS SYNC to as-built (Stage B). You own docs/technical/**. Update every document to the as-built system: data model (from the applied migrations and the generated types; regenerate ERDs where tables or columns changed), API (npm run docs:api + catalog), security, lifecycles, flows, jobs, deployment, testing and traceability (with actual test names for every AC). Set status lines to "As-built (Stage B)". Keep Mermaid valid.`, { label: 'docs-sync', phase: 'B6 Final gate', schema: FIX })
  const g5 = await gateLoop('B6', 'B6 Final gate', FINAL_GATE, 4)
  await checkpoint('stage-B-complete', 'backend: final verification pass (Stage B complete)', 'B6 Final gate', { gate: g5.passed })
  return {
    status: g5.passed ? 'complete' : 'needs-attention', branch: BRANCH,
    gates: { B1: g1.passed, B2: g2.passed, B4: g3.passed, B5: g4.passed, B6: g5.passed },
    finalGateFailures: g5.passed ? [] : (g5.last ? g5.last.failures : []),
    domainsIncompleteBeforeIntegration: failedDomains, qa, criticMissing: critic ? critic.missing : null, completedUnits: COMPLETED,
  }
}

try {
  return await main()
} catch (e) {
  if (HALTED) return { status: 'interrupted', reason: String(e && e.message), completedUnits: COMPLETED, resumeHint: 'Relaunch with args.prototypeApproved = true and args.resume = { skipPhases, skipUnits } from .build/progress/B/*.json, or resumeFromRunId in the same session.' }
  throw e
}
