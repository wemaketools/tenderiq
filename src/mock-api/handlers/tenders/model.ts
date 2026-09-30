/**
 * Projections of the tender fixtures onto the tenders contract, plus the derived authoring state (issues,
 * readiness, publication gate, change impact). Pure functions over static fixtures: nothing is persisted.
 *
 * Commands build a modified copy of a fixture row (a "draft state") and project it with the same functions, so a
 * command response shows exactly what the next GET would show if the prototype persisted.
 */
import type { Money, PersonRef } from '../../../contracts/common.js';
import { gt, sub } from '../../../contracts/decimal.js';
import type { ReleaseChecksCheckArea, TenderTeamMembersTeamRole, TendersStatus } from '../../../contracts/enums.js';
import { RELEASE_CHECKS_CHECK_AREA, enumLabel } from '../../../contracts/enums.js';
import type {
  Affordability,
  ChangeImpact,
  CorrectionRequest,
  Editability,
  EvaluationPlan,
  Lot,
  LotRef,
  MaterialChange,
  Milestone,
  OutstandingDecision,
  PackageDocument,
  PricingSchedule,
  PublicationGate,
  ReadinessCounts,
  ReadinessItem,
  ReleaseApprovalState,
  ReleaseCheck,
  Requirement,
  TeamMember,
  TenderDetail,
  TenderIssue,
  TenderReadiness,
  TenderRow,
  TenderSection,
  TenderTimetable,
} from '../../../contracts/tenders.js';
import {
  REQUIRED_TEAM_ROLES,
  TENDER_AUTHORING_STATUSES,
  duplicateRefCodes,
  planIssues,
  requirementIssues,
  tenderSectionPath,
  timetableIssues,
  weightsTotal,
  workingDayHint,
  workingDaysBetween,
  daysBetween,
  localDateOf,
} from '../../../contracts/tenders.js';
import {
  CALENDARS,
  CATEGORIES,
  CORRECTIONS,
  DEPARTMENTS,
  ENVELOPES,
  EVALUATION_PLANS,
  LEGAL_ENTITIES,
  LOTS,
  MATERIAL_CHANGES,
  MILESTONES,
  PACKAGE_DOCUMENTS,
  PARTICIPATION_CONDITIONS,
  POLICY_VERSIONS,
  PRICING_SCHEDULES,
  PROJECTS,
  QUALIFICATION_PROGRAMS,
  RELEASE_APPROVALS,
  RELEASE_CHECKS,
  REQUESTS,
  REQUIREMENTS,
  STRATEGIES,
  TEAM_MEMBERS,
  TENDERS,
  TENDER_TERMS,
  TENDER_VERSIONS,
  revisionHash,
} from '../../fixtures/tenders/index.js';
import type {
  FxCondition,
  FxEnvelope,
  FxEvaluationPlan,
  FxLot,
  FxMilestone,
  FxPricingSchedule,
  FxReleaseApproval,
  FxReleaseCheck,
  FxRequirement,
  FxTeamMember,
  FxTender,
} from '../../fixtures/tenders/index.js';
import { findPersonaById, findTenantById, personRef } from '../../persona.js';
import { valueBandOf } from '../../../contracts/policy.js';
import type { CustomFieldContext, CustomFieldValues } from '../../../contracts/policy.js';
import { customFieldValuesOf } from '../../custom-fields.js';
import { formatOfficialInstant } from '../bids/time.js';

// ---------------------------------------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------------------------------------

/**
 * The children of one tender. Commands pass a modified set (a draft state) to the same projections.
 */
export interface TenderState {
  readonly tender: FxTender;
  readonly lots: readonly FxLot[];
  readonly team: readonly FxTeamMember[];
  readonly requirements: readonly FxRequirement[];
  readonly schedules: readonly FxPricingSchedule[];
  readonly plans: readonly FxEvaluationPlan[];
  readonly milestones: readonly FxMilestone[];
  readonly envelopes: readonly FxEnvelope[];
  readonly conditions: readonly FxCondition[];
  readonly checks: readonly FxReleaseCheck[];
  readonly approvals: readonly FxReleaseApproval[];
}

/** The fixture state of a tender. */
export function stateOf(tender: FxTender): TenderState {
  const id = tender.id;
  return {
    tender,
    lots: LOTS.filter((row) => row.tenderId === id),
    team: TEAM_MEMBERS.filter((row) => row.tenderId === id),
    requirements: REQUIREMENTS.filter((row) => row.tenderId === id),
    schedules: PRICING_SCHEDULES.filter((row) => row.tenderId === id),
    plans: EVALUATION_PLANS.filter((row) => row.tenderId === id),
    milestones: MILESTONES.filter((row) => row.tenderId === id),
    envelopes: ENVELOPES.filter((row) => row.tenderId === id),
    conditions: PARTICIPATION_CONDITIONS.filter((row) => row.tenderId === id),
    checks: RELEASE_CHECKS.filter((row) => row.tenderId === id),
    approvals: RELEASE_APPROVALS.filter((row) => row.tenderId === id),
  };
}

/** Holders of these permissions see every tender of the organization; others only the tenders they are on. */
export function seesAllTenders(permissions: readonly string[]): boolean {
  return permissions.includes('tender.create') || permissions.includes('audit.view');
}

export function isActiveMember(tenderId: number, userId: number): boolean {
  return TEAM_MEMBERS.some((row) => row.tenderId === tenderId && row.userId === userId && row.removedAt === null);
}

/** The register tenders of a tenant the caller may see (templates excluded). */
export function visibleTenders(tenantId: number, userId: number, permissions: readonly string[]): FxTender[] {
  const all = seesAllTenders(permissions);
  return TENDERS.filter(
    (tender) => tender.tenantId === tenantId && !tender.isTemplate && (all || isActiveMember(tender.id, userId)),
  );
}

export function isAuthoring(status: TendersStatus): boolean {
  return (TENDER_AUTHORING_STATUSES as readonly TendersStatus[]).includes(status);
}

function money(amount: string | null, currency: string): Money | null {
  return amount === null ? null : { amount, currency };
}

function formatMoney(amount: string, currency: string): string {
  const [whole = '0', fraction = '00'] = amount.split('.');
  return `${currency} ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0').slice(0, 2)}`;
}

function personOrNull(userId: number | null): PersonRef | null {
  return userId === null ? null : personRef(userId);
}

function lotRef(lot: FxLot): LotRef {
  return { id: lot.id, lotNo: lot.lotNo, title: lot.title };
}

function lotRefById(state: TenderState, lotId: number | null): LotRef | null {
  if (lotId === null) {
    return null;
  }
  const lot = state.lots.find((row) => row.id === lotId);
  return lot === undefined ? null : lotRef(lot);
}

export function categoryRef(categoryId: number | null): TenderRow['category'] {
  const category = CATEGORIES.find((row) => row.id === categoryId);
  return category === undefined ? null : { id: category.id, code: category.code, name: category.name };
}

function namedRef(rows: readonly { id: number; name: string }[], id: number | null): { id: number; name: string } | null {
  const row = rows.find((candidate) => candidate.id === id);
  return row === undefined ? null : { id: row.id, name: row.name };
}

export function requestRef(requestId: number | null): TenderRow['sourceRequest'] {
  const request = REQUESTS.find((row) => row.id === requestId);
  return request === undefined ? null : { id: request.id, reference: request.reference, title: request.title };
}

export function tenderLinkRef(tenderId: number | null): TenderRow['linkedFrom'] {
  const tender = TENDERS.find((row) => row.id === tenderId);
  return tender === undefined ? null : { id: tender.id, reference: tender.reference, title: tender.title, status: tender.status };
}

export function policyOf(tender: FxTender) {
  return POLICY_VERSIONS.find((row) => row.id === tender.policyVersionId) ?? null;
}

export function calendarOf(tender: FxTender) {
  return CALENDARS.find((row) => row.id === tender.calendarId) ?? null;
}

function submissionDeadlineOf(state: TenderState): FxMilestone | undefined {
  return state.milestones.find((row) => row.milestone === 'submission_deadline' && row.lotId === null);
}

// ---------------------------------------------------------------------------------------------------------
// Approvals and checks
// ---------------------------------------------------------------------------------------------------------

export function approvalState(approval: FxReleaseApproval, tender: FxTender): ReleaseApprovalState {
  return {
    approvalId: approval.approvalId,
    status: approval.status,
    subjectVersion: approval.subjectVersion,
    contentHash: approval.contentHash,
    requestedBy: personRef(approval.requestedBy),
    requestedAt: approval.requestedAt,
    decidedBy: personOrNull(approval.decidedBy),
    decidedAt: approval.decidedAt,
    invalidatedAt: approval.invalidatedAt,
    invalidationReason: approval.invalidationReason,
    coversCurrentRevision:
      approval.subjectVersion === tender.draftRevision && (approval.status === 'pending' || approval.status === 'approved'),
  };
}

/** The newest release approval of a tender. */
export function latestApproval(state: TenderState): FxReleaseApproval | null {
  const sorted = [...state.approvals].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  return sorted[0] ?? null;
}

/** The approval that covers the current revision and is still live (pending or approved). */
function liveApproval(state: TenderState): FxReleaseApproval | null {
  const latest = latestApproval(state);
  return latest !== null &&
    latest.subjectVersion === state.tender.draftRevision &&
    (latest.status === 'pending' || latest.status === 'approved')
    ? latest
    : null;
}

/** One check per area: the newest recorded row, shown as pending when it predates the current revision. */
export function releaseChecksOf(state: TenderState): ReleaseCheck[] {
  const revision = state.tender.draftRevision;
  const authoring = isAuthoring(state.tender.status);
  return RELEASE_CHECKS_CHECK_AREA.map((checkArea) => {
    const rows = state.checks.filter((row) => row.checkArea === checkArea).sort((a, b) => b.draftRevision - a.draftRevision);
    const row = rows[0];
    if (row === undefined) {
      return {
        id: null,
        checkArea,
        status: 'pending',
        reviewer: null,
        note: null,
        draftRevision: revision,
        checkedAt: null,
        coversCurrentRevision: false,
      } satisfies ReleaseCheck;
    }
    const current = row.draftRevision === revision;
    return {
      id: row.id,
      checkArea,
      status: current || !authoring ? row.status : 'pending',
      reviewer: personOrNull(row.reviewerUserId),
      note: row.note,
      draftRevision: row.draftRevision,
      checkedAt: row.checkedAt,
      coversCurrentRevision: current,
    } satisfies ReleaseCheck;
  });
}

// ---------------------------------------------------------------------------------------------------------
// Section issues
// ---------------------------------------------------------------------------------------------------------

function criterionFacts(state: TenderState, criterionId: number | null): { envelope: FxRequirement['envelope']; isPrice: boolean } | null {
  for (const plan of state.plans) {
    const criterion = plan.criteria.find((row) => row.id === criterionId);
    if (criterion !== undefined) {
      return { envelope: criterion.envelope, isPrice: criterion.isPrice };
    }
  }
  return null;
}

export function issuesOfRequirement(state: TenderState, requirement: FxRequirement): TenderIssue[] {
  return requirementIssues(
    {
      ...requirement,
      criterion: criterionFacts(state, requirement.criterionId),
    },
    {
      envelopes: state.envelopes.map((row) => row.envelope),
      duplicateRefCodes: duplicateRefCodes(state.requirements.map((row) => row.refCode)),
    },
  );
}

export function lotIssues(lot: FxLot): TenderIssue[] {
  return lot.ownerUserId === null
    ? [
        {
          code: 'LOT_OWNER_MISSING',
          severity: 'blocking',
          message: `Lot ${lot.lotNo} has no accountable owner.`,
          field: `lots.${lot.lotNo}`,
          relatedId: lot.id,
        },
      ]
    : [];
}

function activeTeam(state: TenderState): FxTeamMember[] {
  return state.team.filter((row) => row.removedAt === null);
}

export function missingRoles(state: TenderState): TenderTeamMembersTeamRole[] {
  const roles = new Set(activeTeam(state).map((row) => row.teamRole));
  if (state.tender.eventType === 'rfi') {
    return roles.has('owner') ? [] : ['owner'];
  }
  return REQUIRED_TEAM_ROLES.filter((role) => !roles.has(role));
}

export function teamIssues(state: TenderState): TenderIssue[] {
  const issues: TenderIssue[] = [];
  const codes: Record<(typeof REQUIRED_TEAM_ROLES)[number], TenderIssue['code']> = {
    owner: 'TENDER_OWNER_MISSING',
    evaluation_chair: 'EVALUATION_CHAIR_NOT_ASSIGNED',
    evaluator: 'EVALUATORS_NOT_ASSIGNED',
    opening_officer: 'OPENING_OFFICER_NOT_ASSIGNED',
  };
  for (const role of missingRoles(state)) {
    const code = codes[role as keyof typeof codes];
    issues.push({
      code,
      severity: role === 'opening_officer' ? 'warning' : 'blocking',
      message: `No ${enumLabel('tender_team_members.team_role', role).toLowerCase()} is assigned.`,
      field: `team.${role}`,
      relatedId: null,
    });
  }
  for (const member of activeTeam(state).filter((row) => row.conflictReviewPending)) {
    issues.push({
      code: 'CONFLICT_REVIEW_PENDING',
      severity: 'warning',
      message: `${personRef(member.userId).fullName} has a declared conflict awaiting review; restricted access stays blocked.`,
      field: `team.${member.teamRole}`,
      relatedId: member.id,
    });
  }
  return issues;
}

export function scheduleIssues(schedule: FxPricingSchedule): TenderIssue[] {
  const issues: TenderIssue[] = [];
  if (schedule.items.length === 0) {
    issues.push({
      code: 'PRICING_SCHEDULE_EMPTY',
      severity: 'blocking',
      message: `The schedule “${schedule.name}” has no items.`,
      field: `pricing.${schedule.id}`,
      relatedId: schedule.id,
    });
  }
  if (schedule.evaluationPeriods === null && schedule.items.some((item) => item.chargeType === 'recurring' && item.includeInEvaluation)) {
    issues.push({
      code: 'RECURRING_WITHOUT_EVALUATION_PERIODS',
      severity: 'warning',
      message: `“${schedule.name}” has recurring charges but no evaluation periods, so their evaluated total is undefined.`,
      field: `pricing.${schedule.id}.evaluationPeriods`,
      relatedId: schedule.id,
    });
  }
  if (schedule.discountsAccepted.length > 0 && (schedule.discountEvaluationNote === null || schedule.discountEvaluationNote.trim() === '')) {
    issues.push({
      code: 'DISCOUNT_BASIS_MISSING',
      severity: 'warning',
      message: `“${schedule.name}” accepts discounts but does not state how they enter comparison.`,
      field: `pricing.${schedule.id}.discountEvaluationNote`,
      relatedId: schedule.id,
    });
  }
  for (const item of schedule.items.filter((row) => row.isProvisional && row.includeInEvaluation)) {
    issues.push({
      code: 'PROVISIONAL_ITEM_IN_EVALUATION',
      severity: 'warning',
      message: `Provisional item ${item.itemCode} is included in the evaluated price.`,
      field: `pricing.${schedule.id}.items.${item.itemCode}`,
      relatedId: item.id,
    });
  }
  return issues;
}

export function pricingIssues(state: TenderState): TenderIssue[] {
  const { tender } = state;
  const issues: TenderIssue[] = [];
  if (tender.eventType !== 'rfi') {
    if (state.schedules.length === 0) {
      issues.push({ code: 'PRICING_SCHEDULE_MISSING', severity: 'blocking', message: 'Add a pricing schedule.', field: 'pricing', relatedId: null });
    }
    for (const lot of state.lots) {
      if (!state.schedules.some((schedule) => schedule.lotId === lot.id) && !state.schedules.some((schedule) => schedule.lotId === null)) {
        issues.push({
          code: 'PRICING_SCHEDULE_MISSING',
          severity: 'blocking',
          message: `Lot ${lot.lotNo} has no pricing schedule.`,
          field: `lots.${lot.lotNo}`,
          relatedId: lot.id,
        });
      }
    }
    if (!TENDER_TERMS.some((term) => term.tenderId === tender.id && term.termType === 'draft_contract')) {
      issues.push({
        code: 'DRAFT_CONTRACT_TERMS_MISSING',
        severity: 'blocking',
        message: 'The package has no draft contract terms.',
        field: 'terms.draft_contract',
        relatedId: null,
      });
    }
  }
  if (tender.estimatedValue !== null && tender.budgetAmount !== null && gt(tender.estimatedValue, tender.budgetAmount)) {
    issues.push({
      code: 'ESTIMATE_EXCEEDS_BUDGET',
      severity: 'warning',
      message: `The estimate (${formatMoney(tender.estimatedValue, tender.currency)}) exceeds the budget (${formatMoney(tender.budgetAmount, tender.currency)}).`,
      field: 'estimatedValue',
      relatedId: null,
    });
  }
  return issues;
}

export function issuesOfPlan(plan: FxEvaluationPlan): TenderIssue[] {
  return planIssues({
    ...plan,
    anchorValues: plan.anchors.map((anchor) => anchor.value),
    tieBreakRuleCount: plan.tieBreakRules.length,
  }).map((issue) => ({ ...issue, relatedId: issue.relatedId ?? plan.id }));
}

export function timetableIssuesOf(state: TenderState): TenderIssue[] {
  const { tender } = state;
  const policy = policyOf(tender);
  return timetableIssues({
    timeZone: tender.officialTimeZone,
    holidays: calendarOf(tender)?.holidays ?? [],
    calendarId: tender.calendarId,
    releaseAt: tender.releasedAt ?? tender.scheduledReleaseAt,
    milestones: state.milestones.map((row) => ({
      id: row.id,
      milestone: row.milestone,
      lotId: row.lotId,
      lotNo: state.lots.find((lot) => lot.id === row.lotId)?.lotNo ?? null,
      at: row.at,
    })),
    policy: policy === null ? null : { minResponseDays: policy.minResponseDays, questionDeadlineDaysBeforeClose: policy.questionDeadlineDaysBeforeClose },
    openingMode: tender.openingMode,
    envelopeCount: state.envelopes.length,
  });
}

export function packageDocumentsOf(tenderId: number): PackageDocument[] {
  return PACKAGE_DOCUMENTS.filter((doc) => doc.tenderId === tenderId).map((doc) => ({
    documentId: doc.documentId,
    title: doc.title,
    fileName: doc.fileName,
    classification: doc.classification,
    language: doc.language,
    precedence: doc.precedence,
    versionNo: doc.versionNo,
    relatedTo: doc.relatedTo,
    lot: doc.lotId === null ? null : (() => {
      const lot = LOTS.find((row) => row.id === doc.lotId);
      return lot === undefined ? null : lotRef(lot);
    })(),
    supplierVisible: doc.classification === 'public' || doc.classification === 'participating_suppliers',
    publicVisible: doc.classification === 'public',
    updatedAt: doc.updatedAt,
  }));
}

export function missingLanguageEditions(tender: FxTender): { documentId: number; title: string; language: string }[] {
  const docs = PACKAGE_DOCUMENTS.filter((doc) => doc.tenderId === tender.id);
  const missing: { documentId: number; title: string; language: string }[] = [];
  for (const doc of docs.filter((row) => row.classification === 'public' && row.editionOf === null)) {
    for (const language of tender.acceptedLanguages.filter((code) => code !== doc.language)) {
      if (!docs.some((row) => row.editionOf === doc.documentId && row.language === language)) {
        missing.push({ documentId: doc.documentId, title: doc.title, language });
      }
    }
  }
  return missing;
}

export function documentIssues(state: TenderState): TenderIssue[] {
  const { tender } = state;
  const docs = PACKAGE_DOCUMENTS.filter((doc) => doc.tenderId === tender.id);
  const issues: TenderIssue[] = [];
  const issued = docs.filter((doc) => doc.classification !== 'buyer_internal' && doc.title !== 'Notice summary');
  if (issued.length === 0) {
    issues.push({
      code: 'PACKAGE_DOCUMENT_MISSING',
      severity: 'blocking',
      message: 'The package has no documents for suppliers beyond the notice.',
      field: 'documents',
      relatedId: null,
    });
  }
  for (const doc of docs.filter((row) => row.classification === 'buyer_internal' && row.precedence !== null)) {
    issues.push({
      code: 'DOCUMENT_CLASSIFICATION_CONFLICT',
      severity: 'blocking',
      message: `“${doc.title}” is buyer-internal but ranked in the issued package; reclassify it or remove it from the package.`,
      field: `documents.${doc.documentId}`,
      relatedId: doc.documentId,
    });
  }
  for (const missing of missingLanguageEditions(tender)) {
    issues.push({
      code: 'LANGUAGE_EDITION_MISSING',
      severity: 'warning',
      message: `“${missing.title}” has no ${missing.language === 'tn' ? 'Setswana' : missing.language} edition.`,
      field: `documents.${missing.documentId}`,
      relatedId: missing.documentId,
    });
  }
  return issues;
}

// ---------------------------------------------------------------------------------------------------------
// Readiness and gate
// ---------------------------------------------------------------------------------------------------------

function itemsFromIssues(tenderId: number, section: TenderSection, issues: readonly TenderIssue[], passedTitle: string): ReadinessItem[] {
  if (issues.length === 0) {
    return [{ id: `${section}.ok`, section, code: null, status: 'passed', title: passedTitle, detail: null, link: tenderSectionPath(tenderId, section) }];
  }
  const byCode = new Map<string, TenderIssue[]>();
  for (const issue of issues) {
    byCode.set(issue.code, [...(byCode.get(issue.code) ?? []), issue]);
  }
  return [...byCode.entries()].map(([code, group]) => {
    const first = group[0] as TenderIssue;
    const blocking = group.some((issue) => issue.severity === 'blocking');
    return {
      id: `${section}.${code}`,
      section,
      code: first.code,
      status: blocking ? 'blocking' : 'warning',
      title: group.length === 1 ? first.message : `${first.message} (and ${group.length - 1} more)`,
      detail: group.length > 1 ? group.map((issue) => issue.message).join(' ') : null,
      link: tenderSectionPath(tenderId, section),
    } satisfies ReadinessItem;
  });
}

function approvalItems(state: TenderState): ReadinessItem[] {
  const { tender } = state;
  const link = tenderSectionPath(tender.id, 'release_approval');
  if (!isAuthoring(tender.status)) {
    const approval = [...state.approvals].filter((row) => row.status === 'approved').sort((a, b) => b.subjectVersion - a.subjectVersion)[0];
    return [
      {
        id: 'release_approval.released',
        section: 'release_approval',
        code: null,
        status: 'passed',
        title: tender.releasedAt === null ? 'The package was not released.' : `Released on ${formatOfficialInstant(tender.releasedAt, tender.officialTimeZone, false)}.`,
        detail: approval === undefined ? null : `Release approval #${approval.approvalId} covered revision ${approval.subjectVersion}.`,
        link,
      },
    ];
  }
  const items: ReadinessItem[] = [];
  const checks = releaseChecksOf(state);
  const failed = checks.filter((check) => check.status === 'failed');
  const pending = checks.filter((check) => check.status === 'pending');
  if (failed.length > 0) {
    items.push({
      id: 'release_approval.RELEASE_CHECK_FAILED',
      section: 'release_approval',
      code: 'RELEASE_CHECK_FAILED',
      status: 'blocking',
      title: `Failed release checks: ${failed.map((check) => enumLabel('release_checks.check_area', check.checkArea)).join(', ')}.`,
      detail: failed.map((check) => check.note ?? '').filter((note) => note !== '').join(' ') || null,
      link,
    });
  }
  if (pending.length > 0) {
    items.push({
      id: 'release_approval.RELEASE_CHECK_PENDING',
      section: 'release_approval',
      code: 'RELEASE_CHECK_PENDING',
      status: 'warning',
      title: `Release checks to review for revision ${tender.draftRevision}: ${pending
        .map((check) => enumLabel('release_checks.check_area', check.checkArea))
        .join(', ')}.`,
      detail:
        'Pending checks do not stop the release approval request, but publication stays blocked until every check passes (or is marked not applicable).',
      link,
    });
  }
  const policy = policyOf(tender);
  const latest = latestApproval(state);
  const live = liveApproval(state);
  if (live !== null && live.status === 'approved') {
    items.push({
      id: 'release_approval.approved',
      section: 'release_approval',
      code: null,
      status: 'passed',
      title: `Release approval #${live.approvalId} covers revision ${live.subjectVersion}.`,
      detail: null,
      link,
    });
  } else if (live !== null) {
    items.push({
      id: 'release_approval.RELEASE_APPROVAL_PENDING',
      section: 'release_approval',
      code: 'RELEASE_APPROVAL_PENDING',
      status: 'warning',
      title: `Release approval #${live.approvalId} for revision ${live.subjectVersion} is pending.`,
      detail: null,
      link,
    });
  } else if (latest !== null && (latest.status === 'invalidated' || latest.subjectVersion !== tender.draftRevision)) {
    items.push({
      id: 'release_approval.RELEASE_APPROVAL_INVALIDATED',
      section: 'release_approval',
      code: 'RELEASE_APPROVAL_INVALIDATED',
      status: 'warning',
      title: `Release approval #${latest.approvalId} (revision ${latest.subjectVersion}) no longer covers the package; request approval for revision ${tender.draftRevision}.`,
      detail: latest.invalidationReason,
      link,
    });
  } else if (policy?.requiresReleaseApproval ?? true) {
    items.push({
      id: 'release_approval.RELEASE_APPROVAL_MISSING',
      section: 'release_approval',
      code: 'RELEASE_APPROVAL_MISSING',
      status: 'warning',
      title:
        latest === null
          ? 'Release approval has not been requested.'
          : `Release approval #${latest.approvalId} was ${enumLabel('approval_requests.status', latest.status).toLowerCase()}; request it again.`,
      detail: null,
      link,
    });
  }
  return items;
}

function correctionItems(state: TenderState): ReadinessItem[] {
  return CORRECTIONS.filter((row) => row.tenderId === state.tender.id && row.status === 'open').map((row) => ({
    id: `correction.${row.id}`,
    section: row.section,
    code: 'CORRECTION_OPEN',
    status: 'warning',
    title: `Correction requested by ${personRef(row.requestedBy).fullName}: ${row.note}`,
    detail: `Assigned to ${personRef(row.assigneeUserId).fullName}.`,
    link: tenderSectionPath(state.tender.id, row.section),
  }));
}

export function readinessItems(state: TenderState): ReadinessItem[] {
  const { tender } = state;
  const id = tender.id;
  const requirementIssueList = state.requirements.flatMap((row) => issuesOfRequirement(state, row));
  const planIssueList =
    tender.eventType === 'rfi'
      ? []
      : state.plans.length === 0
        ? [
            {
              code: 'PLAN_NOT_APPROVED',
              severity: 'blocking',
              message: 'Define and approve an evaluation plan.',
              field: 'evaluationPlan',
              relatedId: null,
            } satisfies TenderIssue,
          ]
        : state.plans.flatMap(issuesOfPlan);
  const overviewIssues: TenderIssue[] =
    tender.summary === null || tender.summary.trim() === ''
      ? [{ code: 'SUMMARY_MISSING', severity: 'warning', message: 'Write the tender summary shown in the notice.', field: 'summary', relatedId: null }]
      : [];
  return [
    ...itemsFromIssues(id, 'overview', overviewIssues, 'Summary, owner and organization details are complete.'),
    ...itemsFromIssues(id, 'team', teamIssues(state), 'Owner, evaluation chair, evaluators and opening officer are assigned.'),
    ...(state.lots.length > 0 ? itemsFromIssues(id, 'lots', state.lots.flatMap(lotIssues), 'Every lot has an accountable owner.') : []),
    ...itemsFromIssues(id, 'requirements', requirementIssueList, `${state.requirements.length} requirements are owned and consistent.`),
    ...itemsFromIssues(id, 'pricing', [...pricingIssues(state), ...state.schedules.flatMap(scheduleIssues)], 'Pricing schedules and commercial terms are complete.'),
    ...(tender.eventType === 'rfi' ? [] : itemsFromIssues(id, 'evaluation_plan', planIssueList, 'The evaluation plan is complete and approved.')),
    ...itemsFromIssues(id, 'timetable', timetableIssuesOf(state), 'The timetable is coherent with the policy and the working-day calendar.'),
    ...itemsFromIssues(id, 'documents', documentIssues(state), 'The document package is complete and correctly classified.'),
    ...correctionItems(state),
    ...approvalItems(state),
  ];
}

export function countsOf(items: readonly ReadinessItem[]): ReadinessCounts {
  return {
    blocking: items.filter((item) => item.status === 'blocking').length,
    warnings: items.filter((item) => item.status === 'warning').length,
    passed: items.filter((item) => item.status === 'passed').length,
  };
}

export function gateOf(state: TenderState, items: readonly ReadinessItem[]): PublicationGate {
  const { tender } = state;
  if (!isAuthoring(tender.status)) {
    return { canRequestReleaseApproval: false, publicationBlocked: false, blockedReasons: [] };
  }
  const reasons: string[] = [];
  const blocking = items.filter((item) => item.status === 'blocking');
  if (blocking.length > 0) {
    reasons.push(`${blocking.length} blocking readiness ${blocking.length === 1 ? 'item' : 'items'} must be resolved.`);
  }
  const checks = releaseChecksOf(state).filter((check) => check.status === 'pending' || check.status === 'failed');
  if (checks.length > 0) {
    reasons.push(`${checks.length} release ${checks.length === 1 ? 'check is' : 'checks are'} not passed for revision ${tender.draftRevision}.`);
  }
  const live = liveApproval(state);
  const requiresApproval = policyOf(tender)?.requiresReleaseApproval ?? true;
  if (requiresApproval && live !== null && live.status === 'pending') {
    reasons.push(`Release approval #${live.approvalId} for revision ${live.subjectVersion} is awaiting a decision.`);
  } else if (requiresApproval && (live === null || live.status !== 'approved')) {
    reasons.push(`No release approval covers revision ${tender.draftRevision}.`);
  }
  return {
    canRequestReleaseApproval: blocking.length === 0 && tender.status !== 'ready' && live === null,
    publicationBlocked: reasons.length > 0,
    blockedReasons: reasons,
  };
}

export function readinessOf(state: TenderState): TenderReadiness {
  const items = readinessItems(state);
  return { tenderId: state.tender.id, draftRevision: state.tender.draftRevision, items, summary: countsOf(items), gate: gateOf(state, items) };
}

export function editabilityOf(state: TenderState): Editability {
  const { status } = state.tender;
  const editable = isAuthoring(status);
  return {
    editable,
    editInvalidatesApproval: editable && liveApproval(state) !== null,
    lockedReason: editable ? null : status === 'cancelled' ? 'cancelled' : status === 'archived' ? 'archived' : 'released_use_addendum',
  };
}

// ---------------------------------------------------------------------------------------------------------
// Rows and detail
// ---------------------------------------------------------------------------------------------------------

function deadlineOf(state: TenderState): TenderRow['submissionDeadline'] {
  const row = submissionDeadlineOf(state);
  return row === undefined ? null : { at: row.at, timeZone: state.tender.officialTimeZone };
}

export function tenderRow(state: TenderState): TenderRow {
  const { tender } = state;
  const latest = latestApproval(state);
  return {
    id: tender.id,
    reference: tender.reference,
    title: tender.title,
    eventType: tender.eventType,
    procedure: tender.procedure,
    participation: tender.participation,
    status: tender.status,
    owner: personRef(tender.ownerUserId),
    category: categoryRef(tender.categoryId),
    department: namedRef(DEPARTMENTS, tender.departmentId),
    estimatedValue: money(tender.estimatedValue, tender.currency),
    lotCount: state.lots.length,
    submissionDeadline: deadlineOf(state),
    scheduledReleaseAt: tender.scheduledReleaseAt,
    releasedAt: tender.releasedAt,
    sourceRequest: requestRef(tender.sourceRequestId),
    linkedFrom: tenderLinkRef(tender.linkedFromTenderId),
    linkType: tender.linkType,
    stageNo: tender.stageNo,
    releaseApprovalStatus: latest?.status ?? null,
    readiness: isAuthoring(tender.status) ? countsOf(readinessItems(state)) : null,
    updatedAt: tender.updatedAt,
  };
}

export function teamMemberOf(member: FxTeamMember, state: TenderState): TeamMember {
  const persona = findPersonaById(member.userId);
  const membership = persona?.memberships.find((row) => row.tenantId === member.tenantId) ?? null;
  return {
    id: member.id,
    user: personRef(member.userId),
    capacity: membership?.capacity ?? null,
    teamRole: member.teamRole,
    lot: lotRefById(state, member.lotId),
    assignedBy: personOrNull(member.assignedBy),
    assignedAt: member.assignedAt,
    removedAt: member.removedAt,
    removalReason: member.removalReason,
    conflictReviewPending: member.conflictReviewPending,
  };
}

function outstandingOf(state: TenderState, items: readonly ReadinessItem[]): OutstandingDecision[] {
  const { tender } = state;
  return items
    .filter((item) => item.status !== 'passed')
    .map((item) => {
      const correction = item.id.startsWith('correction.')
        ? CORRECTIONS.find((row) => `correction.${row.id}` === item.id)
        : undefined;
      return {
        id: item.id,
        section: item.section,
        severity: item.status === 'blocking' ? 'blocking' : 'warning',
        title: item.title,
        detail: item.detail,
        owner: personRef(correction?.assigneeUserId ?? tender.ownerUserId),
        dueAt: isAuthoring(tender.status) ? tender.scheduledReleaseAt : null,
        link: item.link,
      } satisfies OutstandingDecision;
    });
}

/** The custom field values of a tender (this command's values, else the recorded ones). */
export function tenderCustomValues(tender: FxTender): CustomFieldValues {
  return { ...(tender.customFields ?? customFieldValuesOf(tender.tenantId, 'tender', tender.id)) };
}

/** The core values the tender form's conditional custom fields read. */
export function tenderCustomContext(tender: FxTender): CustomFieldContext {
  return {
    category_code: CATEGORIES.find((category) => category.id === tender.categoryId)?.code ?? null,
    procedure: tender.procedure,
    event_type: tender.eventType,
    participation: tender.participation,
    value_band: tender.estimatedValue === null ? null : valueBandOf(tender.estimatedValue),
  };
}

export function tenderDetail(state: TenderState): TenderDetail {
  const { tender } = state;
  const items = readinessItems(state);
  const policy = policyOf(tender);
  const team = activeTeam(state);
  const strategy = STRATEGIES.find((row) => row.id === tender.strategyId);
  const project = PROJECTS.find((row) => row.id === tender.projectId);
  const latest = latestApproval(state);
  return {
    ...tenderRow(state),
    summary: tender.summary,
    legalEntity: namedRef(LEGAL_ENTITIES, tender.legalEntityId),
    project: project === undefined ? null : { id: project.id, reference: project.reference, title: project.title },
    strategy: strategy === undefined ? null : { id: strategy.id, title: strategy.title, status: strategy.status },
    policyProfileVersion:
      policy === null
        ? null
        : {
            id: policy.id,
            profileName: policy.profileName,
            versionNo: policy.versionNo,
            minResponseDays: policy.minResponseDays,
            questionDeadlineDaysBeforeClose: policy.questionDeadlineDaysBeforeClose,
            requiresReleaseApproval: policy.requiresReleaseApproval,
            frozenAt: tender.policyFrozenAt,
          },
    calendar: namedRef(CALENDARS, tender.calendarId),
    officialTimeZone: tender.officialTimeZone,
    currency: tender.currency,
    acceptedCurrencies: [...tender.acceptedCurrencies],
    acceptedLanguages: [...tender.acceptedLanguages],
    bidValidityDays: tender.bidValidityDays,
    budgetAmount: money(tender.budgetAmount, tender.currency),
    awardModel: tender.awardModel,
    maxLotsPerSupplier: tender.maxLotsPerSupplier,
    eligibilitySummary: tender.eligibilitySummary,
    deliveryRequirements: tender.deliveryRequirements,
    partialBidsAllowed: tender.partialBidsAllowed,
    alternativesAllowed: tender.alternativesAllowed,
    negotiationPermitted: tender.negotiationPermitted,
    demonstrationsPermitted: tender.demonstrationsPermitted,
    referencesPermitted: tender.referencesPermitted,
    bafoPermitted: tender.bafoPermitted,
    openingMode: tender.openingMode,
    independentEvaluation: tender.independentEvaluation,
    anonymizedEvaluation: tender.anonymizedEvaluation,
    anonymizationLimitations: tender.anonymizationLimitations,
    submissionRules: tender.submissionRules,
    lateMaterialRule: tender.lateMaterialRule,
    communicationChannelNote: tender.communicationChannelNote,
    draftRevision: tender.draftRevision,
    currentVersionNo: tender.currentVersionNo,
    contentHash: revisionHash(tender.id, tender.draftRevision),
    closedAt: tender.closedAt,
    cancelledAt: tender.cancelledAt,
    cancellationReason: tender.cancellationReason,
    linkedTo: TENDERS.filter((row) => row.linkedFromTenderId === tender.id && row.linkType !== null).map((row) => ({
      id: row.id,
      reference: row.reference,
      title: row.title,
      status: row.status,
      linkType: row.linkType ?? 'next_stage',
    })),
    provenance: { ...tender.provenance },
    lots: state.lots.map((lot) => ({
      id: lot.id,
      lotNo: lot.lotNo,
      title: lot.title,
      stage: lot.stage,
      owner: personOrNull(lot.ownerUserId),
      estimatedValue: money(lot.estimatedValue, tender.currency),
      submissionDeadline: lot.submissionDeadline === null ? null : { at: lot.submissionDeadline, timeZone: tender.officialTimeZone },
    })),
    keyDates: [...state.milestones]
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((row) => ({
        milestone: row.milestone,
        lot: lotRefById(state, row.lotId),
        deadline: { at: row.at, timeZone: tender.officialTimeZone },
        isDisclosed: row.isDisclosed,
      })),
    versions: TENDER_VERSIONS.filter((row) => row.tenderId === tender.id).map((row) => ({
      versionNo: row.versionNo,
      issuedAt: row.issuedAt,
      issuedBy: personRef(row.issuedBy),
      changeSummary: row.changeSummary,
      addendumId: row.addendumId,
    })),
    team: {
      memberCount: team.length,
      evaluators: team.filter((row) => row.teamRole === 'evaluator').map((row) => personRef(row.userId)),
      evaluationChair: personOrNull(team.find((row) => row.teamRole === 'evaluation_chair')?.userId ?? null),
      missingRoles: missingRoles(state),
    },
    releaseApproval: latest === null ? null : approvalState(latest, tender),
    readiness: countsOf(items),
    gate: gateOf(state, items),
    outstandingDecisions: outstandingOf(state, items),
    editability: editabilityOf(state),
    createdBy: personOrNull(tender.createdBy),
    createdAt: tender.createdAt,
    customFields: tenderCustomValues(tender),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Section projections
// ---------------------------------------------------------------------------------------------------------

export function lotOf(state: TenderState, lot: FxLot): Lot {
  const { tender } = state;
  return {
    id: lot.id,
    lotNo: lot.lotNo,
    title: lot.title,
    description: lot.description,
    quantityDescription: lot.quantityDescription,
    estimatedValue: money(lot.estimatedValue, tender.currency),
    deliveryLocation: lot.deliveryLocation,
    deliveryDate: lot.deliveryDate,
    submissionDeadline: lot.submissionDeadline === null ? null : { at: lot.submissionDeadline, timeZone: tender.officialTimeZone },
    owner: personOrNull(lot.ownerUserId),
    stage: lot.stage,
    outcomeReason: lot.outcomeReason,
    requirementCount: state.requirements.filter((row) => row.lotId === lot.id).length,
    pricingScheduleCount: state.schedules.filter((row) => row.lotId === lot.id).length,
    issues: lotIssues(lot),
  };
}

function criterionRefOf(state: TenderState, criterionId: number | null): Requirement['criterion'] {
  for (const plan of state.plans) {
    const criterion = plan.criteria.find((row) => row.id === criterionId);
    if (criterion !== undefined) {
      return { id: criterion.id, code: criterion.code, name: criterion.name };
    }
  }
  return null;
}

export function requirementOf(state: TenderState, requirement: FxRequirement): Requirement {
  return {
    id: requirement.id,
    lot: lotRefById(state, requirement.lotId),
    section: requirement.section,
    refCode: requirement.refCode,
    text: requirement.text,
    owner: personOrNull(requirement.ownerUserId),
    applicability: requirement.applicability,
    responseType: requirement.responseType,
    choices: [...requirement.choices],
    responseInstructions: requirement.responseInstructions,
    evidenceRequired: requirement.evidenceRequired,
    treatment: requirement.treatment,
    envelope: requirement.envelope,
    missingConsequence: requirement.missingConsequence,
    criterion: criterionRefOf(state, requirement.criterionId),
    sortOrder: requirement.sortOrder,
    issues: issuesOfRequirement(state, requirement),
  };
}

export function scheduleOf(state: TenderState, schedule: FxPricingSchedule): PricingSchedule {
  return {
    id: schedule.id,
    lot: lotRefById(state, schedule.lotId),
    name: schedule.name,
    instructions: schedule.instructions,
    taxTreatment: schedule.taxTreatment,
    evaluationPeriods: schedule.evaluationPeriods,
    discountsAccepted: [...schedule.discountsAccepted],
    discountEvaluationNote: schedule.discountEvaluationNote,
    priceEntries: [...schedule.priceEntries],
    items: schedule.items.map((item) => ({ ...item })),
    issues: scheduleIssues(schedule),
  };
}

export function affordabilityOf(state: TenderState): Affordability {
  const { tender } = state;
  const status =
    tender.estimatedValue === null || tender.budgetAmount === null
      ? 'not_assessed'
      : gt(tender.estimatedValue, tender.budgetAmount)
        ? 'exceeds_budget'
        : 'within_budget';
  return {
    estimatedValue: money(tender.estimatedValue, tender.currency),
    budgetAmount: money(tender.budgetAmount, tender.currency),
    headroom:
      tender.estimatedValue === null || tender.budgetAmount === null
        ? null
        : { amount: sub(tender.budgetAmount, tender.estimatedValue), currency: tender.currency },
    status,
    lots: state.lots.map((lot) => ({ lot: lotRef(lot), estimatedValue: money(lot.estimatedValue, tender.currency) })),
    assumptions: tender.affordabilityAssumptions,
  };
}

export function termsOf(tenderId: number) {
  return TENDER_TERMS.filter((row) => row.tenderId === tenderId).map((row) => {
    const doc = PACKAGE_DOCUMENTS.find((candidate) => candidate.documentId === row.documentId);
    return {
      id: row.id,
      termType: row.termType,
      content: row.content,
      document: doc === undefined ? null : { documentId: doc.documentId, title: doc.title },
      updatedAt: row.updatedAt,
    };
  });
}

export function planOf(state: TenderState, plan: FxEvaluationPlan): EvaluationPlan {
  const criterionName = new Map(plan.criteria.map((row) => [row.id, row] as const));
  return {
    id: plan.id,
    lot: lotRefById(state, plan.lotId),
    status: plan.status,
    version: plan.version,
    scaleMax: plan.scaleMax,
    aggregationMethod: plan.aggregationMethod,
    priceMethod: plan.priceMethod,
    priceWeight: plan.priceWeight,
    priceFormulaNote: plan.priceFormulaNote,
    zeroPriceTreatment: plan.zeroPriceTreatment,
    missingPriceTreatment: plan.missingPriceTreatment,
    thresholdScope: plan.thresholdScope,
    nonPriceThreshold: plan.nonPriceThreshold,
    decimalPlacesCalc: plan.decimalPlacesCalc,
    decimalPlacesDisplay: plan.decimalPlacesDisplay,
    comparisonCurrency: plan.comparisonCurrency,
    fxSource: plan.fxSource,
    fxDate: plan.fxDate,
    approvedAt: plan.approvedAt,
    approvedBy: personOrNull(plan.approvedBy),
    approvalRequestId: plan.approvalRequestId,
    criteria: plan.criteria.map((row) => ({
      ...row,
      linkedRequirementCount: state.requirements.filter((requirement) => requirement.criterionId === row.id).length,
    })),
    anchors: plan.anchors.map((anchor) => ({ ...anchor })),
    tieBreakRules: plan.tieBreakRules.map((rule) => {
      const criterion = rule.criterionId === null ? undefined : criterionName.get(rule.criterionId);
      return {
        sequence: rule.sequence,
        rule: rule.rule,
        criterion: criterion === undefined ? null : { id: criterion.id, code: criterion.code, name: criterion.name },
      };
    }),
    weightsTotal: weightsTotal(plan.criteria),
    amendments: plan.amendments.map((row) => ({ version: row.version, amendedAt: row.amendedAt, amendedBy: personRef(row.amendedBy), note: row.note })),
    issues: issuesOfPlan(plan),
  };
}

export function milestoneOf(state: TenderState, row: FxMilestone): Milestone {
  const { tender } = state;
  return {
    id: row.id,
    milestone: row.milestone,
    lot: lotRefById(state, row.lotId),
    deadline: { at: row.at, timeZone: tender.officialTimeZone },
    isDisclosed: row.isDisclosed,
    note: row.note,
    workingDay: workingDayHint(row.at, tender.officialTimeZone, calendarOf(tender)?.holidays ?? []),
  };
}

export function timetableOf(state: TenderState): TenderTimetable {
  const { tender } = state;
  const calendar = calendarOf(tender);
  const policy = policyOf(tender);
  const submission = submissionDeadlineOf(state);
  const releaseAt = tender.releasedAt ?? tender.scheduledReleaseAt;
  const sorted = [...state.milestones].sort((a, b) => a.at.localeCompare(b.at));
  const first = sorted[0]?.at ?? releaseAt;
  const last = sorted[sorted.length - 1]?.at ?? releaseAt;
  const windowStart = releaseAt !== null && first !== null && releaseAt < first ? releaseAt : first;
  const holidays =
    calendar === null || windowStart === null || last === null
      ? []
      : calendar.holidays.filter(
          (holiday) =>
            holiday.date >= localDateOf(windowStart, tender.officialTimeZone) && holiday.date <= localDateOf(last, tender.officialTimeZone),
        );
  const detailPolicy = tenderDetailPolicy(tender);
  return {
    tenderId: tender.id,
    officialTimeZone: tender.officialTimeZone,
    calendar: calendar === null ? null : { id: calendar.id, name: calendar.name },
    holidays: holidays.map((holiday) => ({ ...holiday })),
    scheduledReleaseAt: tender.scheduledReleaseAt,
    openingMode: tender.openingMode,
    milestones: sorted.map((row) => milestoneOf(state, row)),
    envelopes: [...state.envelopes]
      .sort((a, b) => a.openOrder - b.openOrder)
      .map((row) => ({
        envelope: row.envelope,
        openOrder: row.openOrder,
        requirementCount: state.requirements.filter((requirement) => requirement.envelope === row.envelope).length,
      })),
    participationConditions: state.conditions.map((row) => ({
      id: row.id,
      conditionType: row.conditionType,
      description: row.description,
      qualificationProgram: namedRef(QUALIFICATION_PROGRAMS, row.qualificationProgramId),
      sessionId: row.sessionId,
      blocking: row.blocking,
    })),
    qualificationPrograms: QUALIFICATION_PROGRAMS.filter((row) => row.tenantId === tender.tenantId).map((row) => ({ id: row.id, name: row.name })),
    responsePeriod: {
      releaseAt,
      submissionDeadline: submission === undefined ? null : { at: submission.at, timeZone: tender.officialTimeZone },
      calendarDays:
        releaseAt === null || submission === undefined
          ? null
          : Math.max(0, daysBetween(localDateOf(releaseAt, tender.officialTimeZone), localDateOf(submission.at, tender.officialTimeZone))),
      workingDays:
        releaseAt === null || submission === undefined
          ? null
          : workingDaysBetween(releaseAt, submission.at, tender.officialTimeZone, calendar?.holidays ?? []),
      policyMinimumDays: policy?.minResponseDays ?? null,
    },
    policy: detailPolicy,
    submissionRules: tender.submissionRules,
    lateMaterialRule: tender.lateMaterialRule,
    issues: timetableIssuesOf(state),
  };
}

function tenderDetailPolicy(tender: FxTender): TenderTimetable['policy'] {
  const policy = policyOf(tender);
  return policy === null
    ? null
    : {
        id: policy.id,
        profileName: policy.profileName,
        versionNo: policy.versionNo,
        minResponseDays: policy.minResponseDays,
        questionDeadlineDaysBeforeClose: policy.questionDeadlineDaysBeforeClose,
        requiresReleaseApproval: policy.requiresReleaseApproval,
        frozenAt: tender.policyFrozenAt,
      };
}

export function materialChangesOf(tenderId: number): MaterialChange[] {
  return MATERIAL_CHANGES.filter((row) => row.tenderId === tenderId)
    .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
    .map((row) => ({
      id: row.id,
      changedAt: row.changedAt,
      changedBy: personRef(row.changedBy),
      section: row.section,
      summary: row.summary,
      fromValue: row.fromValue,
      toValue: row.toValue,
      draftRevision: row.draftRevision,
      invalidatedApprovalId: row.invalidatedApprovalId,
    }));
}

export function correctionsOf(state: TenderState): CorrectionRequest[] {
  return CORRECTIONS.filter((row) => row.tenderId === state.tender.id)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
    .map((row) => ({
      id: row.id,
      section: row.section,
      lot: lotRefById(state, row.lotId),
      note: row.note,
      assignee: personRef(row.assigneeUserId),
      requestedBy: personRef(row.requestedBy),
      requestedAt: row.requestedAt,
      status: row.status,
      resolvedAt: row.resolvedAt,
    }));
}

// ---------------------------------------------------------------------------------------------------------
// Change impact (BR-10, AC-06)
// ---------------------------------------------------------------------------------------------------------

/** Release-check areas a material change in each section sends back for review. */
const SECTION_CHECK_AREAS: Record<TenderSection, readonly ReleaseChecksCheckArea[]> = {
  overview: ['scope', 'funding'],
  team: [],
  lots: ['scope', 'funding'],
  requirements: ['scope', 'supplier_burden', 'evaluation_readiness'],
  pricing: ['funding', 'terms'],
  terms: ['terms'],
  evaluation_plan: ['evaluation_readiness'],
  timetable: ['dates'],
  participation: ['supplier_burden', 'permissions'],
  documents: ['languages', 'accessibility'],
  release_approval: [],
};

/**
 * What a command did to the package: a material change bumps the revision, changes the content hash, sends the
 * affected release checks back for review and invalidates a pending or approved release approval.
 */
export function changeImpactOf(state: TenderState, material: boolean, section: TenderSection, summary: string, now: Date): ChangeImpact {
  const { tender } = state;
  if (!material) {
    return {
      material: false,
      draftRevision: tender.draftRevision,
      contentHash: revisionHash(tender.id, tender.draftRevision),
      tenderStatus: tender.status,
      invalidatedApproval: null,
      releaseChecksReset: [],
    };
  }
  const nextRevision = tender.draftRevision + 1;
  const live = liveApproval(state);
  const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  return {
    material: true,
    draftRevision: nextRevision,
    contentHash: revisionHash(tender.id, nextRevision),
    tenderStatus: tender.status === 'ready' ? 'awaiting_release_approval' : tender.status,
    invalidatedApproval:
      live === null
        ? null
        : {
            ...approvalState(live, tender),
            status: 'invalidated',
            invalidatedAt: at,
            invalidationReason: `Material change in revision ${nextRevision}: ${summary}`,
            coversCurrentRevision: false,
          },
    releaseChecksReset: [...SECTION_CHECK_AREAS[section]],
  };
}

/** The tender after a material change (revision bumped), for projecting a command result. */
export function bumped(state: TenderState, material: boolean, now: Date): TenderState {
  if (!material) {
    return state;
  }
  const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const live = liveApproval(state);
  return {
    ...state,
    tender: {
      ...state.tender,
      draftRevision: state.tender.draftRevision + 1,
      status: state.tender.status === 'ready' ? 'awaiting_release_approval' : state.tender.status,
      updatedAt: at,
    },
    approvals: state.approvals.map((row) =>
      live !== null && row.approvalId === live.approvalId
        ? { ...row, status: 'invalidated' as const, invalidatedAt: at, invalidationReason: 'Material change.' }
        : row,
    ),
  };
}

export function tenantName(tenantId: number): string {
  return findTenantById(tenantId)?.name ?? '';
}
