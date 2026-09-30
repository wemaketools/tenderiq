/**
 * Buyer award handlers: register, award overview, recommendations, final award, outcome notices, standstill and
 * the public award notice (BUY-26, BUY-28). Every lookup is scoped to the active buyer tenant; another tenant's
 * record is a 404. Commands check the state the fixtures imply and answer with a static outcome (nothing persists).
 */
import {
  AWARD_CLOSEOUT_NEXT_STEPS,
  createOutcomeNotice,
  createRecommendation,
  decideRecommendation,
  extendStandstill,
  finalAwardLotOutcome,
  getAwardOverview,
  getOutcomeNotice,
  getPublicNotice,
  getRecommendation,
  getStandstill,
  issueOutcomeNotice,
  listAwards,
  listOutcomeNotices,
  publishPublicNotice,
  resendOutcomeNotice,
  reviewPublicNotice,
  savePublicNotice,
  submitRecommendation,
  updateRecommendation,
} from '../../../contracts/awards.js';
import type {
  AwardNextStep,
  AwardReconciliation,
  AwardRegisterRow,
  GateCheck,
  LotOutcome,
  OutcomeNoticeDetail,
  RecommendationDecision,
  RecommendationDetail,
  RecommendationHistoryAction,
} from '../../../contracts/awards.js';
import { gt, sub, sum } from '../../../contracts/decimal.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import {
  AWARD_FILES,
  LOT_OUTCOMES,
  OUTCOME_NOTICES,
  PUBLIC_NOTICES,
  RECOMMENDATIONS,
  STANDSTILL_PERIODS,
  awardTender,
} from '../../fixtures/awards/index.js';
import {
  activeHoldsOfTender,
  awardFileIn,
  awardOverview,
  inDateRange,
  isStandstillActive,
  isoInstant,
  matchesText,
  noticeSummary,
  noticesOfTender,
  recipientCounts,
  registerRow,
  sortRows,
  standstillOverview,
  standstillsOfTender,
  tenderIn,
} from './shared.js';

/** The first blocking submission check, mapped to its declared error code. */
const SUBMISSION_ERRORS: Partial<Record<GateCheck['code'], string>> = {
  evaluation_signed_off: 'EVALUATION_NOT_SIGNED_OFF',
  every_lot_has_outcome: 'LOT_OUTCOME_MISSING',
  totals_reconcile: 'TOTALS_DO_NOT_RECONCILE',
  diligence: 'DILIGENCE_BLOCKING',
  conflicts: 'CONFLICT_UNRESOLVED',
  funding: 'FUNDING_NOT_CONFIRMED',
};

const HISTORY_ACTION = {
  approve: 'approved',
  approve_with_conditions: 'approved_with_conditions',
  reject: 'rejected',
  return: 'returned',
} as const satisfies Record<RecommendationDecision, RecommendationHistoryAction>;

const AWARDING = new Set(['award', 'partial_award', 'conditional_award']);
const DECIDED_OUTCOME_STATUSES = new Set(['approved', 'intent_notified', 'final_awarded']);

function recommendationIn(tenantId: number, recommendationId: number): RecommendationDetail | undefined {
  return RECOMMENDATIONS.find((row) => row.tenantId === tenantId && row.detail.recommendationId === recommendationId)?.detail;
}

function noticeIn(tenantId: number, noticeId: number): OutcomeNoticeDetail | undefined {
  return OUTCOME_NOTICES.find((row) => row.tenantId === tenantId && row.detail.noticeId === noticeId)?.detail;
}

/** The reconciliation of a draft: every value is only recommended (BR-31), nothing is allocated yet. */
function reconcile(tenderLots: readonly { lotId: number; lotNo: number }[], outcomes: readonly LotOutcome[], currency: string): AwardReconciliation {
  const awarded = outcomes.filter((row) => row.awardedValue !== null).map((row) => row.awardedValue?.amount ?? '0');
  const total = awarded.length === 0 ? '0.00' : sum(awarded);
  return {
    currency,
    value: { basis: 'recommended', total: { amount: total, currency }, finalAwardedTotal: { amount: '0.00', currency } },
    lotTotals: tenderLots.map((lot) => {
      const outcome = outcomes.find((row) => row.lot.lotId === lot.lotId);
      return {
        lotId: lot.lotId,
        lotNo: lot.lotNo,
        outcome: outcome?.outcome ?? null,
        status: outcome?.status ?? null,
        awardedValue: outcome?.awardedValue ?? null,
      };
    }),
    contractAllocations: [],
    allocatedTotal: { amount: '0.00', currency },
    unallocated: { amount: sub(total, '0.00'), currency },
    reconciles: true,
    note: 'A draft recommendation is not an award. No contract is allocated until the award is final.',
  };
}

/**
 * A file belongs to the closeout register when its closure is blocked, closed or archived, or when its next step is
 * closing or archiving: exactly the files the closeout KPIs count (AC-29).
 */
function inCloseoutStage(row: AwardRegisterRow): boolean {
  return (
    (row.closeoutStatus !== null && row.closeoutStatus !== 'in_progress') ||
    (AWARD_CLOSEOUT_NEXT_STEPS as readonly AwardNextStep[]).includes(row.nextStep)
  );
}

export function registerBuyerAwardRoutes(app: MockApp): void {
  // ---------------------------------------------------------------------------------------------------
  // Register and overview
  // ---------------------------------------------------------------------------------------------------

  mockRoute(app, listAwards, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = AWARD_FILES.filter((file) => file.tenantId === tenant.id).map((file) => {
      const tender = awardTender(file.tenderId);
      return registerRow(awardOverview(tender, file, fixtures.personRef(tender.ownerUserId)), file.updatedAt);
    });
    const filtered = rows.filter(
      (row) =>
        matchesText(query.q, row.tender.reference, row.tender.title, row.owner.fullName) &&
        (query.status === undefined || query.status.includes(row.tender.status)) &&
        (query.recommendationStatus === undefined ||
          (row.latestRecommendation !== null && query.recommendationStatus.includes(row.latestRecommendation.status))) &&
        (query.nextStep === undefined || query.nextStep.includes(row.nextStep)) &&
        (query.closeoutStatus === undefined ||
          (row.closeoutStatus !== null && query.closeoutStatus.includes(row.closeoutStatus))) &&
        (query.view !== 'closeout' || inCloseoutStage(row)) &&
        (query.ownerUserId === undefined || row.owner.userId === query.ownerUserId) &&
        (query.hasActiveHold === undefined || (row.activeHoldCount > 0) === query.hasActiveHold) &&
        inDateRange(row.updatedAt, query.updatedFrom, query.updatedTo),
    );
    const sorted = sortRows(
      filtered,
      {
        reference: (row) => row.tender.reference,
        title: (row) => row.tender.title,
        status: (row) => row.tender.status,
        updatedAt: (row) => row.updatedAt,
        standstillEndsAt: (row) => row.standstillEndsAt?.at ?? null,
      },
      query.sort,
      query.dir,
      'reference',
    );
    return fixtures.page(sorted);
  });

  mockRoute(app, getAwardOverview, ({ requireTenant, params, fixtures, notFound }) => {
    const { tenant } = requireTenant();
    const tender = tenderIn(tenant.id, params.tenderId);
    const file = awardFileIn(tenant.id, params.tenderId);
    if (tender === undefined || file === undefined) {
      return notFound();
    }
    return awardOverview(tender, file, fixtures.personRef(tender.ownerUserId));
  });

  // ---------------------------------------------------------------------------------------------------
  // Recommendations
  // ---------------------------------------------------------------------------------------------------

  mockRoute(app, getRecommendation, ({ requireTenant, params, notFound }) => {
    const { tenant } = requireTenant();
    return recommendationIn(tenant.id, params.recommendationId) ?? notFound();
  });

  mockRoute(app, createRecommendation, ({ requireTenant, requirePersona, params, body, now, fail, notFound, fixtures }) => {
    const { tenant } = requireTenant();
    const tender = tenderIn(tenant.id, params.tenderId);
    if (tender === undefined || awardFileIn(tenant.id, params.tenderId) === undefined) {
      return notFound();
    }
    if (!['under_assessment', 'award_pending', 'partially_awarded'].includes(tender.ref.status)) {
      return fail(409, 'TENDER_NOT_AT_AWARD_STAGE', `${tender.ref.reference} is ${tender.ref.status}; no new recommendation can be prepared.`);
    }
    const unknown = body.lotIds.find((lotId) => !tender.lots.some((lot) => lot.lotId === lotId));
    if (unknown !== undefined) {
      return fail(422, 'LOT_NOT_IN_TENDER', `Lot ${unknown} is not a lot of ${tender.ref.reference}.`);
    }
    const open = RECOMMENDATIONS.find(
      (row) => row.detail.tender.tenderId === tender.ref.tenderId && ['draft', 'awaiting_approval'].includes(row.detail.status),
    );
    if (open !== undefined) {
      return fail(409, 'RECOMMENDATION_ALREADY_OPEN', `Version ${open.detail.version} is ${open.detail.status}; finish or withdraw it first.`);
    }
    const decided = body.lotIds.find((lotId) =>
      LOT_OUTCOMES.some((row) => row.lot.lotId === lotId && DECIDED_OUTCOME_STATUSES.has(row.status)),
    );
    if (decided !== undefined) {
      return fail(409, 'LOT_ALREADY_DECIDED', `Lot ${decided} already has an approved outcome.`);
    }
    const persona = requirePersona();
    const at = isoInstant(now);
    const versions = RECOMMENDATIONS.filter((row) => row.detail.tender.tenderId === tender.ref.tenderId).map((row) => row.detail.version);
    const version = versions.length === 0 ? 1 : Math.max(...versions) + 1;
    const lots = tender.lots.filter((lot) => body.lotIds.includes(lot.lotId));
    const detail: RecommendationDetail = {
      recommendationId: 900,
      tender: tender.ref,
      version,
      status: 'draft',
      summary: body.summary ?? '',
      compliantOffersSummary: '',
      affordabilitySummary: '',
      conflictsSummary: '',
      exceptionsSummary: '',
      negotiationSummary: '',
      unresolvedConditions: '',
      offers: [],
      affordability: { budgetAmount: null, fundingConfirmed: false, withinBudget: false },
      qualification: [],
      diligence: [],
      unresolvedConflictCount: 0,
      lotOutcomes: [],
      reconciliation: reconcile(lots, [], tender.ref.currency),
      proposedContracts: [],
      submissionChecks: [
        {
          code: 'evaluation_signed_off',
          status: lots.every((lot) => lot.stage === 'under_assessment') ? 'blocking' : 'passed',
          detail: `Evaluation of lot ${lots.map((lot) => lot.lotNo).join(', ')} is not signed off yet.`,
        },
        { code: 'every_lot_has_outcome', status: 'blocking', detail: 'Record an explicit outcome for every lot in the recommendation.' },
        { code: 'totals_reconcile', status: 'passed', detail: null },
        { code: 'diligence', status: 'passed', detail: null },
        { code: 'conflicts', status: 'passed', detail: null },
        { code: 'funding', status: 'warning', detail: 'Funding confirmation not yet attached.' },
      ],
      approval: { approvalRequestId: null, status: null, approver: null, decidedAt: null, conditions: null, rationale: null },
      history: [{ at, action: 'created', actor: fixtures.personRef(persona.userId), version, note: null }],
      snapshotId: null,
      createdBy: fixtures.personRef(persona.userId),
      createdAt: at,
      updatedAt: at,
    };
    return detail;
  });

  mockRoute(app, updateRecommendation, ({ requireTenant, requirePersona, params, body, now, fail, notFound, fixtures }) => {
    const { tenant } = requireTenant();
    const current = recommendationIn(tenant.id, params.recommendationId);
    if (current === undefined) {
      return notFound();
    }
    if (current.status !== 'draft' && current.status !== 'returned') {
      return fail(409, 'RECOMMENDATION_NOT_EDITABLE', `Version ${current.version} is ${current.status} and can no longer be edited.`);
    }
    const tender = awardTender(current.tender.tenderId);
    const scopeLotIds = current.lotOutcomes.map((row) => row.lot.lotId);
    for (const input of body.lotOutcomes) {
      if (!tender.lots.some((lot) => lot.lotId === input.lotId)) {
        return fail(422, 'LOT_NOT_IN_TENDER', `Lot ${input.lotId} is not a lot of ${tender.ref.reference}.`);
      }
      if (input.awardedValue !== null && input.awardedValue.currency !== tender.ref.currency) {
        return fail(422, 'CURRENCY_MISMATCH', `Awarded values must be in ${tender.ref.currency}.`);
      }
      if (input.bidId !== null && !current.offers.some((offer) => offer.bidId === input.bidId && offer.complianceStatus === 'compliant')) {
        return fail(409, 'BID_NOT_ELIGIBLE', `Offer ${input.bidId} is not a compliant offer in this recommendation.`);
      }
    }
    const missing = scopeLotIds.find((lotId) => !body.lotOutcomes.some((row) => row.lotId === lotId));
    if (missing !== undefined) {
      return fail(422, 'LOT_OUTCOME_MISSING', `Lot ${missing} needs an explicit outcome.`);
    }
    const lotOutcomes: LotOutcome[] = body.lotOutcomes.map((input, index) => {
      const lot = tender.lots.find((row) => row.lotId === input.lotId);
      const offer = current.offers.find((row) => row.bidId === input.bidId);
      const existing = current.lotOutcomes.find((row) => row.lot.lotId === input.lotId);
      return {
        lotOutcomeId: existing?.lotOutcomeId ?? 900 + index,
        recommendationId: current.recommendationId,
        lot: { lotId: input.lotId, lotNo: lot?.lotNo ?? 1, title: lot?.title ?? tender.ref.title },
        outcome: input.outcome,
        supplier: AWARDING.has(input.outcome) ? (offer?.supplier ?? null) : null,
        bidId: input.bidId,
        awardedValue: input.awardedValue,
        conditions: input.conditions,
        reason: input.reason,
        status: 'recommended',
        finalAwardedAt: null,
        finalAwardApprovalId: null,
        finalAwardApprovedBy: null,
      };
    });
    const reconciliation = reconcile(
      tender.lots.filter((lot) => lotOutcomes.some((row) => row.lot.lotId === lot.lotId)),
      lotOutcomes,
      tender.ref.currency,
    );
    const budget = current.affordability.budgetAmount;
    const at = isoInstant(now);
    return {
      ...current,
      summary: body.summary,
      compliantOffersSummary: body.compliantOffersSummary,
      affordabilitySummary: body.affordabilitySummary,
      conflictsSummary: body.conflictsSummary,
      exceptionsSummary: body.exceptionsSummary,
      negotiationSummary: body.negotiationSummary,
      unresolvedConditions: body.unresolvedConditions,
      lotOutcomes,
      reconciliation,
      affordability: {
        ...current.affordability,
        withinBudget: budget === null ? false : !gt(reconciliation.value.total.amount, budget.amount),
      },
      history: [
        ...current.history,
        { at, action: 'edited' as const, actor: fixtures.personRef(requirePersona().userId), version: current.version, note: null },
      ],
      updatedAt: at,
    };
  });

  mockRoute(app, submitRecommendation, ({ requireTenant, requirePersona, params, body, now, fail, notFound, fixtures }) => {
    const { tenant } = requireTenant();
    const current = recommendationIn(tenant.id, params.recommendationId);
    if (current === undefined) {
      return notFound();
    }
    if (current.status !== 'draft' && current.status !== 'returned') {
      return fail(409, 'RECOMMENDATION_NOT_EDITABLE', `Version ${current.version} is ${current.status}.`);
    }
    const blocking = current.submissionChecks.find((check) => check.status === 'blocking');
    if (blocking !== undefined) {
      return fail(409, SUBMISSION_ERRORS[blocking.code] ?? 'LOT_OUTCOME_MISSING', blocking.detail ?? undefined);
    }
    const at = isoInstant(now);
    return {
      ...current,
      status: 'awaiting_approval' as const,
      approval: { ...current.approval, approvalRequestId: 900, status: 'pending' as const },
      history: [
        ...current.history,
        { at, action: 'submitted' as const, actor: fixtures.personRef(requirePersona().userId), version: current.version, note: body.note ?? null },
      ],
      updatedAt: at,
    };
  });

  mockRoute(app, decideRecommendation, ({ requireTenant, requirePersona, params, body, now, fail, notFound, fixtures }) => {
    const access = requireTenant();
    const current = recommendationIn(access.tenant.id, params.recommendationId);
    if (current === undefined) {
      return notFound();
    }
    if (current.status !== 'awaiting_approval') {
      return fail(409, 'RECOMMENDATION_NOT_AWAITING_APPROVAL', `Version ${current.version} is ${current.status}.`);
    }
    const persona = requirePersona();
    if (current.createdBy.userId === persona.userId) {
      return fail(403, 'SELF_APPROVAL_BLOCKED', 'You prepared this recommendation and cannot approve it.');
    }
    const approving = body.decision === 'approve' || body.decision === 'approve_with_conditions';
    if (approving) {
      const limit = access.membership?.authorityLimit ?? null;
      const total = current.reconciliation.value.total;
      if (limit === null || limit.currency !== total.currency || gt(total.amount, limit.amount)) {
        return fail(403, 'AUTHORITY_EXCEEDED', 'The recommended total exceeds your delegated award authority; the approval routes to the next level.');
      }
      if (current.unresolvedConflictCount > 0) {
        return fail(409, 'CONFLICT_UNRESOLVED', 'A conflict declaration is pending review.');
      }
      const diligence = current.submissionChecks.find((check) => check.code === 'diligence' && check.status === 'blocking');
      if (diligence !== undefined) {
        return fail(409, 'DILIGENCE_BLOCKING', diligence.detail ?? 'An award-blocking due diligence finding is unresolved.');
      }
    }
    const status =
      body.decision === 'reject' ? ('rejected' as const) : body.decision === 'return' ? ('returned' as const) : ('approved' as const);
    const approvalStatus =
      body.decision === 'approve_with_conditions'
        ? ('approved_with_conditions' as const)
        : body.decision === 'approve'
          ? ('approved' as const)
          : body.decision === 'reject'
            ? ('rejected' as const)
            : ('returned' as const);
    const at = isoInstant(now);
    const actor = fixtures.personRef(persona.userId);
    return {
      ...current,
      status,
      lotOutcomes: approving ? current.lotOutcomes.map((row) => ({ ...row, status: 'approved' as const })) : current.lotOutcomes,
      reconciliation: approving
        ? {
            ...current.reconciliation,
            value: { ...current.reconciliation.value, basis: 'approved' as const },
            lotTotals: current.reconciliation.lotTotals.map((row) => (row.status === null ? row : { ...row, status: 'approved' as const })),
          }
        : current.reconciliation,
      approval: {
        approvalRequestId: current.approval.approvalRequestId,
        status: approvalStatus,
        approver: actor,
        decidedAt: at,
        conditions: body.conditions ?? null,
        rationale: body.rationale,
      },
      history: [...current.history, { at, action: HISTORY_ACTION[body.decision], actor, version: current.version, note: body.rationale }],
      updatedAt: at,
    };
  });

  mockRoute(app, finalAwardLotOutcome, ({ requireTenant, requirePersona, params, now, fail, notFound, fixtures }) => {
    const { tenant } = requireTenant();
    const fixture = LOT_OUTCOMES.find((row) => row.tenantId === tenant.id && row.lotOutcomeId === params.lotOutcomeId);
    if (fixture === undefined) {
      return notFound();
    }
    const { tenantId: _tenantId, tenderId, ...outcome } = fixture;
    if (!AWARDING.has(outcome.outcome)) {
      return fail(409, 'LOT_OUTCOME_NOT_AWARDABLE', `Lot ${outcome.lot.lotNo} has the outcome ${outcome.outcome}.`);
    }
    if (outcome.status === 'final_awarded') {
      return fail(409, 'ALREADY_FINAL_AWARDED', `Lot ${outcome.lot.lotNo} was finally awarded on ${outcome.finalAwardedAt ?? ''}.`);
    }
    if (outcome.status !== 'intent_notified') {
      return fail(409, 'INTENT_NOT_NOTIFIED', 'The intention to award has not been notified for this lot.');
    }
    const hold = activeHoldsOfTender(tenderId).find((row) => row.blockedActions.includes('award_final'));
    if (hold !== undefined) {
      return fail(409, 'FINAL_AWARD_BLOCKED_BY_HOLD', `${hold.reason} Final award is blocked until the hold is released.`);
    }
    const period = standstillsOfTender(tenderId).find((row) => row.lot === null || row.lot.lotId === outcome.lot.lotId);
    if (period !== undefined && isStandstillActive(period.status)) {
      return fail(409, 'STANDSTILL_NOT_COMPLETE', `The standstill runs until ${period.effectiveEndsAt.at}.`);
    }
    if (outcome.finalAwardApprovalId === null) {
      return fail(409, 'FINAL_AWARD_APPROVAL_MISSING', 'The final award approval (subject type final_award) is not approved.');
    }
    if (outcome.conditions !== null && outcome.outcome === 'conditional_award') {
      return fail(409, 'AWARD_CONDITIONS_UNMET', outcome.conditions);
    }
    return {
      ...outcome,
      status: 'final_awarded' as const,
      finalAwardedAt: isoInstant(now),
      finalAwardApprovedBy: outcome.finalAwardApprovedBy ?? fixtures.personRef(requirePersona().userId),
    };
  });

  // ---------------------------------------------------------------------------------------------------
  // Outcome notices
  // ---------------------------------------------------------------------------------------------------

  mockRoute(app, listOutcomeNotices, ({ requireTenant, params, query, fixtures, notFound }) => {
    const { tenant } = requireTenant();
    if (tenderIn(tenant.id, params.tenderId) === undefined || awardFileIn(tenant.id, params.tenderId) === undefined) {
      return notFound();
    }
    const rows = noticesOfTender(params.tenderId)
      .filter(
        (row) =>
          matchesText(query.q, row.title, row.body) &&
          (query.noticeType === undefined || query.noticeType.includes(row.noticeType)) &&
          (query.status === undefined || query.status.includes(row.status)) &&
          inDateRange(row.issuedAt, query.issuedFrom, query.issuedTo),
      )
      .map(noticeSummary);
    return fixtures.page(
      sortRows(
        rows,
        { issuedAt: (row) => row.issuedAt, title: (row) => row.title, noticeType: (row) => row.noticeType, status: (row) => row.status },
        query.sort,
        query.dir,
        'issuedAt',
      ),
    );
  });

  mockRoute(app, getOutcomeNotice, ({ requireTenant, params, notFound }) => {
    const { tenant } = requireTenant();
    return noticeIn(tenant.id, params.noticeId) ?? notFound();
  });

  mockRoute(app, createOutcomeNotice, ({ requireTenant, params, body, fail, notFound }) => {
    const { tenant } = requireTenant();
    const tender = tenderIn(tenant.id, params.tenderId);
    if (tender === undefined || awardFileIn(tenant.id, params.tenderId) === undefined) {
      return notFound();
    }
    const unknown = body.lotIds.find((lotId) => !tender.lots.some((lot) => lot.lotId === lotId));
    if (unknown !== undefined) {
      return fail(422, 'LOT_NOT_IN_TENDER', `Lot ${unknown} is not a lot of ${tender.ref.reference}.`);
    }
    const outcomes = body.lotIds.map((lotId) => LOT_OUTCOMES.find((row) => row.lot.lotId === lotId && row.status !== 'withdrawn'));
    const holds = activeHoldsOfTender(tender.ref.tenderId);
    const periods = standstillsOfTender(tender.ref.tenderId).filter((row) => row.lot === null || body.lotIds.includes(row.lot.lotId));
    switch (body.noticeType) {
      case 'intent_to_award':
        if (outcomes.some((row) => row !== undefined && (row.status === 'intent_notified' || row.status === 'final_awarded'))) {
          return fail(409, 'INTENT_ALREADY_ISSUED', 'An intention to award was already issued for these lots.');
        }
        if (outcomes.some((row) => row === undefined || row.status !== 'approved')) {
          return fail(409, 'RECOMMENDATION_NOT_APPROVED', 'Every lot in the notice needs an approved recommendation.');
        }
        break;
      case 'unsuccessful_outcome':
        if (outcomes.some((row) => row === undefined || !DECIDED_OUTCOME_STATUSES.has(row.status))) {
          return fail(409, 'RECOMMENDATION_NOT_APPROVED', 'Every lot in the notice needs an approved recommendation.');
        }
        break;
      case 'final_award':
        if (holds.some((hold) => hold.blockedActions.includes('award_final'))) {
          return fail(409, 'FINAL_AWARD_BLOCKED_BY_HOLD', 'A complaint hold blocks the final award.');
        }
        if (periods.some((row) => isStandstillActive(row.status))) {
          return fail(409, 'STANDSTILL_NOT_COMPLETE', 'The standstill has not ended.');
        }
        if (outcomes.some((row) => row === undefined || row.status !== 'intent_notified')) {
          return fail(409, 'RECOMMENDATION_NOT_APPROVED', 'Final award follows an approved and notified intention to award.');
        }
        break;
      case 'standstill_change':
        if (!periods.some((row) => isStandstillActive(row.status))) {
          return fail(409, 'STANDSTILL_NOT_ACTIVE', 'No standstill is running for these lots.');
        }
        break;
    }
    const lotNos = tender.lots.filter((lot) => body.lotIds.includes(lot.lotId)).map((lot) => lot.lotNo);
    const detail: OutcomeNoticeDetail = {
      noticeId: 900,
      tenderId: tender.ref.tenderId,
      noticeType: body.noticeType,
      version: 1,
      title: body.title,
      status: 'draft',
      lotNos,
      requiresAcknowledgment: body.requiresAcknowledgment,
      periodStartBasis: body.periodStartBasis ?? null,
      recipientCount: 0,
      deliveredCount: 0,
      failedCount: 0,
      acknowledgedCount: 0,
      issuedAt: null,
      issuedBy: null,
      body: body.body,
      audienceDescription:
        body.noticeType === 'unsuccessful_outcome'
          ? 'Each unsuccessful supplier receives its own result.'
          : `Every supplier with an effective offer on lot ${lotNos.join(', ')}.`,
      approvalRequestId: null,
      disclosureReview: { status: 'pending', reviewedBy: null, reviewedAt: null, note: null },
      recipients: [],
    };
    return detail;
  });

  mockRoute(app, issueOutcomeNotice, ({ requireTenant, requirePersona, params, body, now, fail, notFound, fixtures }) => {
    const { tenant } = requireTenant();
    const current = noticeIn(tenant.id, params.noticeId);
    if (current === undefined) {
      return notFound();
    }
    if (current.status !== 'draft') {
      return fail(409, 'NOTICE_NOT_DRAFT', `The notice is ${current.status}.`);
    }
    if (current.noticeType === 'final_award') {
      const hold = activeHoldsOfTender(current.tenderId).find((row) => row.blockedActions.includes('award_final'));
      if (hold !== undefined) {
        return fail(409, 'FINAL_AWARD_BLOCKED_BY_HOLD', `${hold.reason} The final award notice cannot be issued while the hold is active.`);
      }
      if (standstillsOfTender(current.tenderId).some((row) => isStandstillActive(row.status))) {
        return fail(409, 'STANDSTILL_NOT_COMPLETE', 'The standstill has not ended.');
      }
    }
    const tender = awardTender(current.tenderId);
    const at = isoInstant(now);
    const persona = requirePersona();
    const recipients = tender.bidders
      .filter((bidder) => bidder.lotNos.some((lotNo) => current.lotNos.includes(lotNo)))
      .map((bidder, index) => ({
        recipientId: 9000 + index,
        supplier: { supplierTenantId: fixtures.tenantBySlug(bidder.supplierSlug)?.id ?? 0, name: fixtures.tenantBySlug(bidder.supplierSlug)?.name ?? bidder.supplierSlug },
        recipientUser: null,
        deliveryStatus: 'pending' as const,
        deliveredAt: null,
        openedAt: null,
        acknowledgedAt: null,
        acknowledgedBy: null,
        termsAcceptedAt: null,
        failureReason: null,
      }));
    return {
      ...current,
      status: 'issued' as const,
      issuedAt: at,
      issuedBy: fixtures.personRef(persona.userId),
      disclosureReview: { status: 'completed' as const, reviewedBy: fixtures.personRef(persona.userId), reviewedAt: at, note: body.note ?? null },
      recipients,
      ...recipientCounts(recipients),
    };
  });

  mockRoute(app, resendOutcomeNotice, ({ requireTenant, params, fail, notFound }) => {
    const { tenant } = requireTenant();
    const current = noticeIn(tenant.id, params.noticeId);
    if (current === undefined) {
      return notFound();
    }
    const recipient = current.recipients.find((row) => row.recipientId === params.recipientId);
    if (recipient === undefined) {
      return notFound();
    }
    if (current.status !== 'issued') {
      return fail(409, 'NOTICE_NOT_ISSUED', 'Only an issued notice can be re-sent.');
    }
    if (recipient.deliveryStatus !== 'failed') {
      return fail(409, 'RECIPIENT_NOT_FAILED', `The delivery to ${recipient.supplier.name} is ${recipient.deliveryStatus}.`);
    }
    return { noticeId: current.noticeId, recipient: { ...recipient, deliveryStatus: 'pending' as const, failureReason: null } };
  });

  // ---------------------------------------------------------------------------------------------------
  // Standstill
  // ---------------------------------------------------------------------------------------------------

  mockRoute(app, getStandstill, ({ requireTenant, params, notFound }) => {
    const { tenant } = requireTenant();
    const tender = tenderIn(tenant.id, params.tenderId);
    const file = awardFileIn(tenant.id, params.tenderId);
    if (tender === undefined || file === undefined) {
      return notFound();
    }
    return standstillOverview(tender, file);
  });

  mockRoute(app, extendStandstill, ({ requireTenant, params, body, fail, notFound }) => {
    const { tenant } = requireTenant();
    const fixture = STANDSTILL_PERIODS.find((row) => row.tenantId === tenant.id && row.period.standstillId === params.standstillId);
    if (fixture === undefined) {
      return notFound();
    }
    const period = fixture.period;
    if (!isStandstillActive(period.status)) {
      return fail(409, 'STANDSTILL_NOT_ACTIVE', `The standstill is ${period.status}.`);
    }
    if (body.extendedTo <= period.effectiveEndsAt.at) {
      return fail(422, 'EXTENSION_NOT_LATER', `The new end must be after ${period.effectiveEndsAt.at}.`);
    }
    const extended = { at: body.extendedTo, timeZone: period.endsAt.timeZone };
    return { ...period, extendedTo: extended, effectiveEndsAt: extended, extensionReason: body.reason, status: 'extended' as const };
  });

  // ---------------------------------------------------------------------------------------------------
  // Public award notice
  // ---------------------------------------------------------------------------------------------------

  mockRoute(app, getPublicNotice, ({ requireTenant, params, notFound }) => {
    const { tenant } = requireTenant();
    const tender = tenderIn(tenant.id, params.tenderId);
    if (tender === undefined || awardFileIn(tenant.id, params.tenderId) === undefined) {
      return notFound();
    }
    const fixture = PUBLIC_NOTICES.find((row) => row.tenantId === tenant.id && row.notice.tenderId === params.tenderId);
    return {
      tender: tender.ref,
      notice: fixture?.notice ?? null,
      finalAwardedLotCount: LOT_OUTCOMES.filter((row) => row.tenderId === params.tenderId && row.status === 'final_awarded').length,
    };
  });

  mockRoute(app, savePublicNotice, ({ requireTenant, params, body, now, fail, notFound }) => {
    const { tenant } = requireTenant();
    const tender = tenderIn(tenant.id, params.tenderId);
    if (tender === undefined || awardFileIn(tenant.id, params.tenderId) === undefined) {
      return notFound();
    }
    const existing = PUBLIC_NOTICES.find((row) => row.tenantId === tenant.id && row.notice.tenderId === params.tenderId)?.notice;
    if (existing !== undefined && existing.status !== 'draft') {
      return fail(409, 'PUBLIC_NOTICE_NOT_EDITABLE', `The public notice is ${existing.status}.`);
    }
    if (!LOT_OUTCOMES.some((row) => row.tenderId === params.tenderId && DECIDED_OUTCOME_STATUSES.has(row.status))) {
      return fail(409, 'NO_APPROVED_OUTCOME', 'A public award notice needs at least one approved lot outcome.');
    }
    return {
      publicNoticeId: existing?.publicNoticeId ?? 900,
      tenderId: params.tenderId,
      status: 'draft' as const,
      content: body.content,
      disclosedValues: body.disclosedValues,
      reviewConfidentialityBy: null,
      reviewPersonalInfoBy: null,
      publishedAt: null,
      updatedAt: isoInstant(now),
    };
  });

  mockRoute(app, reviewPublicNotice, ({ requireTenant, requirePersona, params, body, now, fail, notFound, fixtures }) => {
    const { tenant } = requireTenant();
    const notice = PUBLIC_NOTICES.find((row) => row.tenantId === tenant.id && row.notice.publicNoticeId === params.publicNoticeId)?.notice;
    if (notice === undefined) {
      return notFound();
    }
    if (notice.status !== 'draft') {
      return fail(409, 'PUBLIC_NOTICE_NOT_EDITABLE', `The public notice is ${notice.status}.`);
    }
    const already = body.area === 'confidentiality' ? notice.reviewConfidentialityBy : notice.reviewPersonalInfoBy;
    if (already !== null) {
      return fail(409, 'REVIEW_ALREADY_RECORDED', `The ${body.area.replace('_', ' ')} review was recorded by ${already.fullName}.`);
    }
    const reviewer = fixtures.personRef(requirePersona().userId);
    return {
      ...notice,
      reviewConfidentialityBy: body.area === 'confidentiality' ? reviewer : notice.reviewConfidentialityBy,
      reviewPersonalInfoBy: body.area === 'personal_information' ? reviewer : notice.reviewPersonalInfoBy,
      updatedAt: isoInstant(now),
    };
  });

  mockRoute(app, publishPublicNotice, ({ requireTenant, params, now, fail, notFound }) => {
    const { tenant } = requireTenant();
    const notice = PUBLIC_NOTICES.find((row) => row.tenantId === tenant.id && row.notice.publicNoticeId === params.publicNoticeId)?.notice;
    if (notice === undefined) {
      return notFound();
    }
    if (notice.status === 'published') {
      return fail(409, 'PUBLIC_NOTICE_ALREADY_PUBLISHED', `Published on ${notice.publishedAt ?? ''}.`);
    }
    if (notice.reviewConfidentialityBy === null || notice.reviewPersonalInfoBy === null) {
      return fail(
        409,
        'PUBLIC_NOTICE_REVIEW_INCOMPLETE',
        notice.reviewConfidentialityBy === null ? 'The confidentiality review is missing.' : 'The personal-information review is missing.',
      );
    }
    if (!LOT_OUTCOMES.some((row) => row.tenderId === notice.tenderId && row.status === 'final_awarded')) {
      return fail(409, 'NO_FINAL_AWARD', 'No lot of this tender is finally awarded yet.');
    }
    const at = isoInstant(now);
    return { ...notice, status: 'published' as const, publishedAt: at, updatedAt: at };
  });
}
