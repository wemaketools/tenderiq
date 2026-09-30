/**
 * Tender authoring and release approval contract (domain 06 `tenders`; FR-07; BR-01, BR-09, BR-10, BR-11, BR-12,
 * BR-16; screens BUY-07..BUY-13; acceptance AC-06).
 *
 * Every endpoint is buyer-audience and tenant-scoped (`X-Tenant-Id` = the active buyer):
 * - Visibility: holders of `tender.create` or `audit.view` see every tender of their organization; other
 *   `tender.view` holders (evaluators, chairs, opening officers, approvers) see only tenders where they are on the
 *   team. Another organization's tender is simply not found (404). Operators and suppliers have no access here.
 * - Authoring edits are allowed while the tender is `draft`, `awaiting_release_approval` or `ready`. A released
 *   tender cannot be edited in place: changes go through an addendum (BR-16) → `TENDER_NOT_EDITABLE`.
 * - A material edit bumps `draftRevision`, changes `contentHash` and invalidates a pending or approved release
 *   approval (BR-10, AC-06). Every command reports this in `change: ChangeImpact`.
 * - Publication stays blocked while any readiness item is blocking or the release approval does not cover the
 *   current revision (`gate.publicationBlocked`). Publishing itself is the publication domain (BUY-14).
 * - The approval decision itself is taken on COM-05 (`me.approvals.decide`, subject type `tender_release`); the
 *   approval panel uses `buyer.approvals.forSubject` with `subjectVersion = draftRevision` and `contentHash`.
 *
 * Schemas live in `./tenders/schemas.ts`, pure rules in `./tenders/rules.ts`.
 */
import { defineEndpoint } from './endpoint.js';
import {
  ApproveEvaluationPlanBody,
  AssignTeamMemberBody,
  ConditionMutationResult,
  ConditionParams,
  CorrectionRequest,
  CreateConditionBody,
  CreateCorrectionBody,
  CreateLotBody,
  CreatePricingItemBody,
  CreatePricingScheduleBody,
  CreateRequirementBody,
  CreateTenderBody,
  CreatedTender,
  CreationSources,
  CreationSourcesQuery,
  EvaluationPlanMutationResult,
  ItemParams,
  LinkTenderBody,
  LotMutationResult,
  LotParams,
  MemberParams,
  PackagePreview,
  PlanParams,
  PreviewQuery,
  PricingItemMutationResult,
  PricingScheduleMutationResult,
  RecordReleaseCheckBody,
  ReleaseApprovalRequested,
  ReleaseCheckParams,
  ReleaseCheckResult,
  ReleaseReview,
  RemovalResult,
  RemoveTeamMemberBody,
  RequestReleaseApprovalBody,
  RequirementListQuery,
  RequirementMutationResult,
  RequirementPage,
  RequirementParams,
  SaveAsTemplateBody,
  SavedTemplate,
  ScheduleParams,
  TeamCandidates,
  TeamCandidatesQuery,
  TeamChangeResult,
  TenderDetail,
  TenderEvaluationPlans,
  TenderLinkState,
  TenderListQuery,
  TenderLots,
  TenderPage,
  TenderParams,
  TenderPricing,
  TenderReadiness,
  TenderTeam,
  TenderTimetable,
  TermMutationResult,
  TermParams,
  TimetableMutationResult,
  UpdateConditionBody,
  UpdateEnvelopesBody,
  UpdateEvaluationPlanBody,
  UpdateLotBody,
  UpdatePricingItemBody,
  UpdatePricingScheduleBody,
  UpdateRequirementBody,
  UpdateTenderBody,
  UpdateTimetableBody,
  UpsertTermBody,
  TenderUpdateResult,
} from './tenders/schemas.js';

export * from './tenders/schemas.js';
export * from './tenders/rules.js';

const BASE = '/api/v1/buyer/tenders';

/** Business errors of every in-place authoring edit. */
const EDIT_ERRORS = ['TENDER_NOT_EDITABLE', 'REVISION_CONFLICT'] as const;

// ---------------------------------------------------------------------------------------------------------
// Register and creation (BUY-07)
// ---------------------------------------------------------------------------------------------------------

export const listTenders = defineEndpoint({
  id: 'buyer.tenders.list',
  method: 'GET',
  path: BASE,
  audience: 'buyer',
  permission: 'tender.view',
  query: TenderListQuery,
  response: TenderPage,
  errors: [],
  screens: ['BUY-07'],
  summary: 'The tender register of the active buyer, filtered to the tenders the caller may see (templates excluded).',
});

export const getCreationSources = defineEndpoint({
  id: 'buyer.tenders.creationSources',
  method: 'GET',
  path: '/api/v1/buyer/tender-sources',
  audience: 'buyer',
  permission: 'tender.create',
  query: CreationSourcesQuery,
  response: CreationSources,
  errors: [],
  screens: ['BUY-07'],
  summary: 'Approved templates, prior events, approved requests and approved strategies a new tender can start from.',
});

export const createTender = defineEndpoint({
  id: 'buyer.tenders.create',
  method: 'POST',
  path: BASE,
  audience: 'buyer',
  permission: 'tender.create',
  body: CreateTenderBody,
  response: CreatedTender,
  idempotent: true,
  errors: [
    'SOURCE_NOT_FOUND',
    'TEMPLATE_NOT_APPROVED',
    'REQUEST_NOT_APPROVED',
    'REQUEST_ALREADY_CONVERTED',
    'STRATEGY_NOT_APPROVED',
    'STRATEGY_ALREADY_USED',
    'PROCEDURE_NOT_PERMITTED',
    'EVENT_TYPE_PROCEDURE_MISMATCH',
    'OWNER_NOT_ELIGIBLE',
  ],
  screens: ['BUY-07'],
  summary:
    'Creates a draft tender from a template, a prior event, a blank form or an approved request/strategy. Reuse copies structure only: never bids, deliberations, approvals or supplier outcomes.',
});

export const saveTenderAsTemplate = defineEndpoint({
  id: 'buyer.tenders.saveAsTemplate',
  method: 'POST',
  path: `${BASE}/:tenderId/templates`,
  audience: 'buyer',
  permission: 'tender.create',
  params: TenderParams,
  body: SaveAsTemplateBody,
  response: SavedTemplate,
  idempotent: true,
  errors: ['TEMPLATE_NAME_TAKEN'],
  screens: ['BUY-07', 'BUY-08'],
  summary: 'Saves the tender structure as a draft tender-package template; it needs template approval before use.',
});

export const linkTender = defineEndpoint({
  id: 'buyer.tenders.link',
  method: 'POST',
  path: `${BASE}/:tenderId/link`,
  audience: 'buyer',
  permission: 'tender.edit',
  params: TenderParams,
  body: LinkTenderBody,
  response: TenderLinkState,
  errors: ['LINK_TO_SELF', 'LINK_CYCLE', 'LINK_TARGET_NOT_ELIGIBLE', 'TENDER_ALREADY_LINKED', 'TENDER_NOT_EDITABLE'],
  screens: ['BUY-07', 'BUY-08'],
  summary: 'Links the tender to an earlier stage (next stage, re-tender, follow-on, from an RFI).',
});

// ---------------------------------------------------------------------------------------------------------
// Overview, team and readiness (BUY-08)
// ---------------------------------------------------------------------------------------------------------

export const getTender = defineEndpoint({
  id: 'buyer.tenders.get',
  method: 'GET',
  path: `${BASE}/:tenderId`,
  audience: 'buyer',
  permission: 'tender.view',
  params: TenderParams,
  response: TenderDetail,
  errors: [],
  screens: ['BUY-08', 'BUY-09', 'BUY-10', 'BUY-11', 'BUY-12', 'BUY-13'],
  summary: 'The tender overview: summary, current version and revision, stage, lots, dates, approval, team and readiness.',
});

export const updateTender = defineEndpoint({
  id: 'buyer.tenders.update',
  method: 'PATCH',
  path: `${BASE}/:tenderId`,
  audience: 'buyer',
  permission: 'tender.edit',
  params: TenderParams,
  body: UpdateTenderBody,
  response: TenderUpdateResult,
  errors: [
    ...EDIT_ERRORS,
    'PROCEDURE_NOT_PERMITTED',
    'NEGOTIATION_NOT_PERMITTED_BY_POLICY',
    'BAFO_NOT_PERMITTED_BY_POLICY',
    'REFERENCE_NOT_FOUND',
  ],
  screens: ['BUY-08', 'BUY-10', 'BUY-12'],
  summary: 'Edits the tender’s general, commercial and participation fields. Material fields invalidate the release approval.',
});

export const getTenderTeam = defineEndpoint({
  id: 'buyer.tenders.team',
  method: 'GET',
  path: `${BASE}/:tenderId/team`,
  audience: 'buyer',
  permission: 'tender.view',
  params: TenderParams,
  response: TenderTeam,
  errors: [],
  screens: ['BUY-08'],
});

export const getTeamCandidates = defineEndpoint({
  id: 'buyer.tenders.teamCandidates',
  method: 'GET',
  path: `${BASE}/:tenderId/team-candidates`,
  audience: 'buyer',
  permission: 'tender.edit',
  params: TenderParams,
  query: TeamCandidatesQuery,
  response: TeamCandidates,
  errors: [],
  screens: ['BUY-08'],
  summary: 'Organization members who may hold a team role (they need the role’s permission).',
});

export const assignTeamMember = defineEndpoint({
  id: 'buyer.tenders.assignTeamMember',
  method: 'POST',
  path: `${BASE}/:tenderId/team`,
  audience: 'buyer',
  permission: 'tender.edit',
  params: TenderParams,
  body: AssignTeamMemberBody,
  response: TeamChangeResult,
  idempotent: true,
  errors: [
    'TENDER_LOCKED',
    'USER_NOT_MEMBER',
    'TEAM_ROLE_NOT_PERMITTED',
    'TEAM_MEMBER_ALREADY_ASSIGNED',
    'SEGREGATION_OF_DUTIES',
    'LOT_NOT_FOUND',
  ],
  screens: ['BUY-08'],
  summary: 'Assigns a responsibility. Assigning the `owner` role replaces the accountable owner (BR-01).',
});

export const removeTeamMember = defineEndpoint({
  id: 'buyer.tenders.removeTeamMember',
  method: 'POST',
  path: `${BASE}/:tenderId/team/:memberId/remove`,
  audience: 'buyer',
  permission: 'tender.edit',
  params: MemberParams,
  body: RemoveTeamMemberBody,
  response: TeamChangeResult,
  errors: ['TENDER_LOCKED', 'OWNER_REQUIRED', 'TEAM_MEMBER_ALREADY_REMOVED'],
  screens: ['BUY-08'],
  summary: 'Removes a team member with a reason; the history is kept. The accountable owner cannot be removed.',
});

export const getTenderReadiness = defineEndpoint({
  id: 'buyer.tenders.readiness',
  method: 'GET',
  path: `${BASE}/:tenderId/readiness`,
  audience: 'buyer',
  permission: 'tender.view',
  params: TenderParams,
  response: TenderReadiness,
  errors: [],
  screens: ['BUY-08', 'BUY-13'],
  summary: 'Readiness by section (blocking, warning, passed) and whether release approval and publication are possible.',
});

// ---------------------------------------------------------------------------------------------------------
// Lots and requirements (BUY-09)
// ---------------------------------------------------------------------------------------------------------

export const listLots = defineEndpoint({
  id: 'buyer.tenders.lots',
  method: 'GET',
  path: `${BASE}/:tenderId/lots`,
  audience: 'buyer',
  permission: 'tender.view',
  params: TenderParams,
  response: TenderLots,
  errors: [],
  screens: ['BUY-09'],
});

export const createLot = defineEndpoint({
  id: 'buyer.tenders.createLot',
  method: 'POST',
  path: `${BASE}/:tenderId/lots`,
  audience: 'buyer',
  permission: 'tender.edit',
  params: TenderParams,
  body: CreateLotBody,
  response: LotMutationResult,
  idempotent: true,
  errors: [...EDIT_ERRORS, 'OWNER_NOT_ELIGIBLE', 'LOT_DEADLINE_BEFORE_RELEASE'],
  screens: ['BUY-09'],
});

export const updateLot = defineEndpoint({
  id: 'buyer.tenders.updateLot',
  method: 'PATCH',
  path: `${BASE}/:tenderId/lots/:lotId`,
  audience: 'buyer',
  permission: 'tender.edit',
  params: LotParams,
  body: UpdateLotBody,
  response: LotMutationResult,
  errors: [...EDIT_ERRORS, 'OWNER_NOT_ELIGIBLE', 'LOT_DEADLINE_BEFORE_RELEASE'],
  screens: ['BUY-09'],
});

export const listRequirements = defineEndpoint({
  id: 'buyer.tenders.requirements',
  method: 'GET',
  path: `${BASE}/:tenderId/requirements`,
  audience: 'buyer',
  permission: 'tender.view',
  params: TenderParams,
  query: RequirementListQuery,
  response: RequirementPage,
  errors: [],
  screens: ['BUY-09'],
  summary: 'Requirements with owner, applicability, response type, treatment, envelope, consequence and issues.',
});

export const createRequirement = defineEndpoint({
  id: 'buyer.tenders.createRequirement',
  method: 'POST',
  path: `${BASE}/:tenderId/requirements`,
  audience: 'buyer',
  permission: 'tender.edit',
  params: TenderParams,
  body: CreateRequirementBody,
  response: RequirementMutationResult,
  idempotent: true,
  errors: [...EDIT_ERRORS, 'REF_CODE_TAKEN', 'LOT_NOT_FOUND', 'CRITERION_NOT_FOUND', 'OWNER_NOT_ELIGIBLE'],
  screens: ['BUY-09'],
});

export const updateRequirement = defineEndpoint({
  id: 'buyer.tenders.updateRequirement',
  method: 'PATCH',
  path: `${BASE}/:tenderId/requirements/:requirementId`,
  audience: 'buyer',
  permission: 'tender.edit',
  params: RequirementParams,
  body: UpdateRequirementBody,
  response: RequirementMutationResult,
  errors: [...EDIT_ERRORS, 'REF_CODE_TAKEN', 'LOT_NOT_FOUND', 'CRITERION_NOT_FOUND', 'OWNER_NOT_ELIGIBLE'],
  screens: ['BUY-09'],
});

export const removeRequirement = defineEndpoint({
  id: 'buyer.tenders.removeRequirement',
  method: 'DELETE',
  path: `${BASE}/:tenderId/requirements/:requirementId`,
  audience: 'buyer',
  permission: 'tender.edit',
  params: RequirementParams,
  response: RemovalResult,
  errors: [...EDIT_ERRORS],
  screens: ['BUY-09'],
  summary: 'Removes a requirement from an unreleased package (a released requirement changes only by addendum).',
});

// ---------------------------------------------------------------------------------------------------------
// Pricing and commercial terms (BUY-10)
// ---------------------------------------------------------------------------------------------------------

export const getPricing = defineEndpoint({
  id: 'buyer.tenders.pricing',
  method: 'GET',
  path: `${BASE}/:tenderId/pricing`,
  audience: 'buyer',
  permission: 'tender.view',
  params: TenderParams,
  response: TenderPricing,
  errors: [],
  screens: ['BUY-10'],
});

export const createPricingSchedule = defineEndpoint({
  id: 'buyer.tenders.createPricingSchedule',
  method: 'POST',
  path: `${BASE}/:tenderId/pricing-schedules`,
  audience: 'buyer',
  permission: 'tender.edit',
  params: TenderParams,
  body: CreatePricingScheduleBody,
  response: PricingScheduleMutationResult,
  idempotent: true,
  errors: [...EDIT_ERRORS, 'LOT_NOT_FOUND'],
  screens: ['BUY-10'],
});

export const updatePricingSchedule = defineEndpoint({
  id: 'buyer.tenders.updatePricingSchedule',
  method: 'PATCH',
  path: `${BASE}/:tenderId/pricing-schedules/:scheduleId`,
  audience: 'buyer',
  permission: 'tender.edit',
  params: ScheduleParams,
  body: UpdatePricingScheduleBody,
  response: PricingScheduleMutationResult,
  errors: [...EDIT_ERRORS, 'LOT_NOT_FOUND'],
  screens: ['BUY-10'],
});

export const createPricingItem = defineEndpoint({
  id: 'buyer.tenders.createPricingItem',
  method: 'POST',
  path: `${BASE}/:tenderId/pricing-schedules/:scheduleId/items`,
  audience: 'buyer',
  permission: 'tender.edit',
  params: ScheduleParams,
  body: CreatePricingItemBody,
  response: PricingItemMutationResult,
  idempotent: true,
  errors: [...EDIT_ERRORS, 'ITEM_CODE_TAKEN'],
  screens: ['BUY-10'],
});

export const updatePricingItem = defineEndpoint({
  id: 'buyer.tenders.updatePricingItem',
  method: 'PATCH',
  path: `${BASE}/:tenderId/pricing-schedules/:scheduleId/items/:itemId`,
  audience: 'buyer',
  permission: 'tender.edit',
  params: ItemParams,
  body: UpdatePricingItemBody,
  response: PricingItemMutationResult,
  errors: [...EDIT_ERRORS, 'ITEM_CODE_TAKEN'],
  screens: ['BUY-10'],
});

export const upsertTenderTerm = defineEndpoint({
  id: 'buyer.tenders.upsertTerm',
  method: 'PUT',
  path: `${BASE}/:tenderId/terms/:termType`,
  audience: 'buyer',
  permission: 'tender.edit',
  params: TermParams,
  body: UpsertTermBody,
  response: TermMutationResult,
  errors: [...EDIT_ERRORS, 'DOCUMENT_NOT_FOUND'],
  screens: ['BUY-10'],
  summary: 'Writes one commercial term (draft contract, insurance, security, confidentiality, complaints, payment, precedence).',
});

// ---------------------------------------------------------------------------------------------------------
// Evaluation plan (BUY-11)
// ---------------------------------------------------------------------------------------------------------

export const getEvaluationPlans = defineEndpoint({
  id: 'buyer.tenders.evaluationPlans',
  method: 'GET',
  path: `${BASE}/:tenderId/evaluation-plans`,
  audience: 'buyer',
  permission: 'tender.view',
  params: TenderParams,
  response: TenderEvaluationPlans,
  errors: [],
  screens: ['BUY-11'],
});

export const updateEvaluationPlan = defineEndpoint({
  id: 'buyer.tenders.updateEvaluationPlan',
  method: 'PUT',
  path: `${BASE}/:tenderId/evaluation-plans/:planId`,
  audience: 'buyer',
  permission: 'tender.edit',
  params: PlanParams,
  body: UpdateEvaluationPlanBody,
  response: EvaluationPlanMutationResult,
  errors: [...EDIT_ERRORS, 'PLAN_VERSION_CONFLICT', 'AMENDMENT_NOTE_REQUIRED'],
  screens: ['BUY-11'],
  summary:
    'Replaces the plan settings, criteria, anchors and tie rules. Weights must total 100 (422 WEIGHTS_TOTAL_NOT_100). Editing an approved plan records an explicit amendment.',
});

export const approveEvaluationPlan = defineEndpoint({
  id: 'buyer.tenders.approveEvaluationPlan',
  method: 'POST',
  path: `${BASE}/:tenderId/evaluation-plans/:planId/approve`,
  audience: 'buyer',
  permission: 'tender.release_approve',
  params: PlanParams,
  body: ApproveEvaluationPlanBody,
  response: EvaluationPlanMutationResult,
  errors: ['TENDER_NOT_EDITABLE', 'PLAN_VERSION_CONFLICT', 'PLAN_HAS_BLOCKING_ISSUES', 'PLAN_ALREADY_APPROVED', 'SELF_APPROVAL_NOT_PERMITTED'],
  screens: ['BUY-11'],
});

// ---------------------------------------------------------------------------------------------------------
// Timetable and participation rules (BUY-12)
// ---------------------------------------------------------------------------------------------------------

export const getTimetable = defineEndpoint({
  id: 'buyer.tenders.timetable',
  method: 'GET',
  path: `${BASE}/:tenderId/timetable`,
  audience: 'buyer',
  permission: 'tender.view',
  params: TenderParams,
  response: TenderTimetable,
  errors: [],
  screens: ['BUY-12'],
  summary: 'Milestones in the official zone with working-day hints, envelopes, participation conditions and coherence issues.',
});

export const updateTimetable = defineEndpoint({
  id: 'buyer.tenders.updateTimetable',
  method: 'PUT',
  path: `${BASE}/:tenderId/timetable`,
  audience: 'buyer',
  permission: 'tender.edit',
  params: TenderParams,
  body: UpdateTimetableBody,
  response: TimetableMutationResult,
  errors: [...EDIT_ERRORS, 'CALENDAR_NOT_FOUND', 'LOT_NOT_FOUND'],
  screens: ['BUY-12'],
  summary: 'Replaces the milestones, official zone, calendar and planned release. Ordering errors are 422 field errors; policy periods and working-day hints come back as issues.',
});

export const updateEnvelopes = defineEndpoint({
  id: 'buyer.tenders.updateEnvelopes',
  method: 'PUT',
  path: `${BASE}/:tenderId/envelopes`,
  audience: 'buyer',
  permission: 'tender.edit',
  params: TenderParams,
  body: UpdateEnvelopesBody,
  response: TimetableMutationResult,
  errors: [...EDIT_ERRORS, 'ENVELOPE_IN_USE'],
  screens: ['BUY-12'],
});

export const createParticipationCondition = defineEndpoint({
  id: 'buyer.tenders.createCondition',
  method: 'POST',
  path: `${BASE}/:tenderId/participation-conditions`,
  audience: 'buyer',
  permission: 'tender.edit',
  params: TenderParams,
  body: CreateConditionBody,
  response: ConditionMutationResult,
  idempotent: true,
  errors: [...EDIT_ERRORS, 'QUALIFICATION_PROGRAM_NOT_FOUND', 'CONDITION_DUPLICATE'],
  screens: ['BUY-12'],
});

export const updateParticipationCondition = defineEndpoint({
  id: 'buyer.tenders.updateCondition',
  method: 'PATCH',
  path: `${BASE}/:tenderId/participation-conditions/:conditionId`,
  audience: 'buyer',
  permission: 'tender.edit',
  params: ConditionParams,
  body: UpdateConditionBody,
  response: ConditionMutationResult,
  errors: [...EDIT_ERRORS, 'QUALIFICATION_PROGRAM_NOT_FOUND'],
  screens: ['BUY-12'],
});

export const removeParticipationCondition = defineEndpoint({
  id: 'buyer.tenders.removeCondition',
  method: 'DELETE',
  path: `${BASE}/:tenderId/participation-conditions/:conditionId`,
  audience: 'buyer',
  permission: 'tender.edit',
  params: ConditionParams,
  response: RemovalResult,
  errors: [...EDIT_ERRORS],
  screens: ['BUY-12'],
});

// ---------------------------------------------------------------------------------------------------------
// Release review (BUY-13)
// ---------------------------------------------------------------------------------------------------------

export const getReleaseReview = defineEndpoint({
  id: 'buyer.tenders.releaseReview',
  method: 'GET',
  path: `${BASE}/:tenderId/release-review`,
  audience: 'buyer',
  permission: 'tender.view',
  params: TenderParams,
  response: ReleaseReview,
  errors: [],
  screens: ['BUY-13'],
  summary:
    'Release checklist by area, readiness, package documents with classification, language and precedence, the release approval with its invalidation history (AC-06), material changes and corrections.',
});

export const recordReleaseCheck = defineEndpoint({
  id: 'buyer.tenders.recordReleaseCheck',
  method: 'PUT',
  path: `${BASE}/:tenderId/release-checks/:checkArea`,
  audience: 'buyer',
  permission: ['tender.edit', 'tender.release_approve'],
  params: ReleaseCheckParams,
  body: RecordReleaseCheckBody,
  response: ReleaseCheckResult,
  errors: ['TENDER_NOT_EDITABLE', 'CHECK_REVISION_STALE'],
  screens: ['BUY-13'],
});

export const previewPackage = defineEndpoint({
  id: 'buyer.tenders.preview',
  method: 'GET',
  path: `${BASE}/:tenderId/preview`,
  audience: 'buyer',
  permission: 'tender.view',
  params: TenderParams,
  query: PreviewQuery,
  response: PackagePreview,
  errors: [],
  screens: ['BUY-13'],
  summary: 'The package exactly as a participating supplier or the public would see it once released (internal content withheld).',
});

export const requestCorrection = defineEndpoint({
  id: 'buyer.tenders.requestCorrection',
  method: 'POST',
  path: `${BASE}/:tenderId/corrections`,
  audience: 'buyer',
  permission: ['tender.edit', 'tender.release_approve'],
  params: TenderParams,
  body: CreateCorrectionBody,
  response: CorrectionRequest,
  idempotent: true,
  errors: ['TENDER_NOT_EDITABLE', 'ASSIGNEE_NOT_ON_TEAM', 'LOT_NOT_FOUND'],
  screens: ['BUY-13'],
});

export const requestReleaseApproval = defineEndpoint({
  id: 'buyer.tenders.requestReleaseApproval',
  method: 'POST',
  path: `${BASE}/:tenderId/release-approval`,
  audience: 'buyer',
  permission: 'tender.edit',
  params: TenderParams,
  body: RequestReleaseApprovalBody,
  response: ReleaseApprovalRequested,
  idempotent: true,
  errors: ['TENDER_NOT_EDITABLE', 'REVISION_CONFLICT', 'RELEASE_NOT_READY', 'RELEASE_APPROVAL_PENDING', 'RELEASE_ALREADY_APPROVED'],
  screens: ['BUY-13'],
  summary:
    'Requests release approval of the exact package revision (subject `tender_release`, version = draftRevision). Refused while any readiness item is blocking.',
});

/** Every endpoint of the tenders domain. */
export const tenderEndpoints = {
  list: listTenders,
  creationSources: getCreationSources,
  create: createTender,
  saveAsTemplate: saveTenderAsTemplate,
  link: linkTender,
  get: getTender,
  update: updateTender,
  team: getTenderTeam,
  teamCandidates: getTeamCandidates,
  assignTeamMember,
  removeTeamMember,
  readiness: getTenderReadiness,
  lots: listLots,
  createLot,
  updateLot,
  requirements: listRequirements,
  createRequirement,
  updateRequirement,
  removeRequirement,
  pricing: getPricing,
  createPricingSchedule,
  updatePricingSchedule,
  createPricingItem,
  updatePricingItem,
  upsertTerm: upsertTenderTerm,
  evaluationPlans: getEvaluationPlans,
  updateEvaluationPlan,
  approveEvaluationPlan,
  timetable: getTimetable,
  updateTimetable,
  updateEnvelopes,
  createCondition: createParticipationCondition,
  updateCondition: updateParticipationCondition,
  removeCondition: removeParticipationCondition,
  releaseReview: getReleaseReview,
  recordReleaseCheck,
  preview: previewPackage,
  requestCorrection,
  requestReleaseApproval,
} as const;

/** The number of endpoints (reported to the orchestrator; asserted by the contract test). */
export const TENDER_ENDPOINT_COUNT = Object.keys(tenderEndpoints).length;
