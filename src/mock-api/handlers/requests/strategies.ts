/**
 * Requests domain handlers (05): market research and procurement strategy (BUY-06, FR-05, AC-39).
 * Nothing is persisted: commands return the static outcome of the action.
 */
import type { Money } from '../../../contracts/common.js';
import { gt } from '../../../contracts/decimal.js';
import type { ProcurementStrategiesProcedure, ProcurementStrategiesStatus } from '../../../contracts/enums.js';
import { STRATEGY_ACTIONS, STRATEGY_ACTION_PERMISSIONS, createTenderPath, requestEndpoints } from '../../../contracts/requests.js';
import type {
  FairnessReview,
  MarketResearchEntry,
  PolicyProcedureCheck,
  ProcedureDistinction,
  ReadinessItem,
  StrategyAction,
  StrategyDetail,
  StrategyRow,
} from '../../../contracts/requests.js';
import type { AnyEndpoint } from '../../../contracts/endpoint.js';
import { mockRoute } from '../../app.js';
import type { MockApp, MockHandlerContext } from '../../app.js';
import {
  FAIRNESS_REVIEWS,
  MARKET_RESEARCH,
  POLICIES,
  PROCEDURE_GUIDANCE,
  PROJECTS,
  REQUESTS,
  STRATEGIES,
} from '../../fixtures/requests/index.js';
import type { FixtureFairnessReview, FixtureMarketResearch, FixtureStrategy } from '../../fixtures/requests/index.js';
import { personRef } from '../../persona.js';
import {
  NEW_ID,
  actorRef,
  authorityCheck,
  categoryRef,
  matchesSearch,
  personOrNull,
  projectRef,
  requestRef,
  sortRows,
  supplierRef,
  tenderRef,
} from './lookup.js';
import type { SortValue } from './lookup.js';
import { approvalValue, viewerOf } from './requests.js';
import type { Viewer } from './requests.js';

const EDITABLE: readonly ProcurementStrategiesStatus[] = ['draft', 'returned'];

function nowIso(now: Date): string {
  return `${now.toISOString().slice(0, 19)}Z`;
}

function estimatedValueOf(strategy: FixtureStrategy): Money | null {
  if (strategy.estimatedValue !== null) {
    return { amount: strategy.estimatedValue, currency: 'BWP' };
  }
  const request = REQUESTS.find((candidate) => candidate.id === strategy.requestId && candidate.tenantId === strategy.tenantId);
  if (request !== undefined) {
    return approvalValue(request);
  }
  const project = PROJECTS.find((candidate) => candidate.id === strategy.projectId && candidate.tenantId === strategy.tenantId);
  return project?.estimatedValue ?? null;
}

function policyCheck(tenantId: number, procedure: ProcurementStrategiesProcedure, value: Money | null): PolicyProcedureCheck {
  const policy = POLICIES.find((candidate) => candidate.tenantId === tenantId);
  if (policy === undefined) {
    return {
      policyProfileVersion: null,
      permittedProcedures: [],
      procedurePermitted: false,
      withinThreshold: null,
      thresholdNote: 'No approved policy profile applies.',
      requiresPublicNotice: false,
    };
  }
  const max = policy.maxValue[procedure];
  const withinThreshold = max === undefined || value === null ? null : !gt(value.amount, max);
  return {
    policyProfileVersion: { id: policy.profileVersionId, name: policy.name, versionNo: policy.versionNo },
    permittedProcedures: [...policy.permittedProcedures],
    procedurePermitted: policy.permittedProcedures.includes(procedure),
    withinThreshold,
    thresholdNote: max === undefined ? null : `Up to BWP ${Number(max).toLocaleString('en-US', { minimumFractionDigits: 2 })} under ${policy.name}.`,
    requiresPublicNotice: policy.publicNoticeProcedures.includes(procedure),
  };
}

function fieldText(value: string | null): string | null {
  return value === null ? null : value.length > 140 ? `${value.slice(0, 137)}…` : value;
}

function distinctions(strategy: FixtureStrategy, policy: PolicyProcedureCheck): ProcedureDistinction[] {
  const guidance = PROCEDURE_GUIDANCE.find((candidate) => candidate.procedure === strategy.procedure);
  if (guidance === undefined) {
    return [];
  }
  const source: Record<string, string | null> = {
    no_award_entitlement: strategy.competitionRationale,
    information_use: strategy.risks,
    public_discovery: policy.requiresPublicNotice ? 'A public notice is required by policy.' : null,
    consistent_access: strategy.qualificationApproach,
    objective_eligibility: strategy.qualificationApproach,
    linked_selection: strategy.qualificationApproach,
    selection_reasons: strategy.competitionRationale,
    approved_invite_list: strategy.competitionRationale,
    sufficient_competition: strategy.competitionRationale,
    stage_rules: strategy.competitionRationale,
    stage_deadlines: strategy.timetableSummary,
    stage_submissions: strategy.evaluationApproach,
    exception_grounds: strategy.directAwardGrounds,
    exception_approver: strategy.approval === null ? null : `Approval request ${strategy.approval.approvalId} (${strategy.approval.status}).`,
    disclosure: strategy.externalOversight,
  };
  return guidance.requiredDistinctions.map((distinction) => {
    const text = source[distinction.id] ?? null;
    return { id: distinction.id, label: distinction.label, satisfied: text !== null, detail: text === null ? 'Not recorded yet.' : fieldText(text) };
  });
}

function reviewsOf(strategy: FixtureStrategy): FixtureFairnessReview[] {
  return FAIRNESS_REVIEWS.filter((review) => review.strategyId === strategy.id && review.tenantId === strategy.tenantId);
}

function readiness(strategy: FixtureStrategy, policy: PolicyProcedureCheck): ReadinessItem[] {
  const fields: [string, string, string | null][] = [
    ['intendedOutcome', 'Intended procurement outcome', strategy.intendedOutcome],
    ['competitionRationale', 'Competition rationale', strategy.competitionRationale],
    ['risks', 'Risks', strategy.risks],
    ['qualificationApproach', 'Qualification approach', strategy.qualificationApproach],
    ['lotStrategy', 'Lot structure', strategy.lotStrategy],
    ['evaluationApproach', 'Evaluation method', strategy.evaluationApproach],
    ['timetableSummary', 'Timetable', strategy.timetableSummary],
  ];
  const items: ReadinessItem[] = fields.map(([id, label, value]) => ({
    id,
    label,
    status: value === null ? 'blocking' : 'passed',
    detail: value === null ? 'Required before submission.' : null,
  }));
  items.push({
    id: 'procedure',
    label: 'Procedure permitted by policy',
    status: policy.procedurePermitted ? 'passed' : 'blocking',
    detail: policy.procedurePermitted ? null : `${strategy.procedure} is not permitted by ${policy.policyProfileVersion?.name ?? 'the policy'}.`,
  });
  if (policy.withinThreshold === false) {
    const direct = strategy.procedure === 'direct';
    items.push({
      id: 'threshold',
      label: 'Value within the procedure threshold',
      status: direct ? 'warning' : 'blocking',
      detail: direct
        ? `Above the direct-procurement threshold: the exception needs approval at the level the value requires. ${policy.thresholdNote ?? ''}`.trim()
        : `The estimate exceeds the threshold for this procedure. ${policy.thresholdNote ?? ''}`.trim(),
    });
  }
  if (strategy.procedure === 'direct') {
    items.push({
      id: 'directAwardGrounds',
      label: 'Exception grounds',
      status: strategy.directAwardGrounds === null ? 'blocking' : 'passed',
      detail: strategy.directAwardGrounds === null ? 'A direct procurement needs approved exception grounds.' : null,
    });
  }
  const pending = reviewsOf(strategy).filter((review) => review.outcome === 'pending');
  items.push({
    id: 'fairness',
    label: 'Fairness reviews concluded',
    status: pending.length === 0 ? 'passed' : 'blocking',
    detail: pending.length === 0 ? null : `${pending.length} fairness review(s) on prior supplier involvement still pending.`,
  });
  const unverified = MARKET_RESEARCH.filter((entry) => entry.strategyId === strategy.id && !entry.isSupplierCommitment).length;
  items.push({
    id: 'research',
    label: 'Market research recorded',
    status: MARKET_RESEARCH.some((entry) => entry.strategyId === strategy.id) ? 'passed' : 'warning',
    detail: unverified > 0 ? `${unverified} finding(s) are unverified estimates, not supplier commitments.` : null,
  });
  return items;
}

function researchOf(entry: FixtureMarketResearch): MarketResearchEntry {
  return {
    id: entry.id,
    sourceType: entry.sourceType,
    source: entry.source,
    finding: entry.finding,
    isSupplierCommitment: entry.isSupplierCommitment,
    supplier: supplierRef(entry.supplierTenantId),
    priorSpecificationInvolvement: entry.priorSpecificationInvolvement,
    recordedAt: entry.recordedAt,
    recordedBy: personRef(entry.recordedByUserId),
  };
}

function reviewOf(review: FixtureFairnessReview): FairnessReview {
  return {
    id: review.id,
    subjectType: 'strategy',
    subjectId: review.strategyId,
    supplier: supplierRef(review.supplierTenantId) ?? { tenantId: review.supplierTenantId, name: 'Supplier' },
    reason: review.reason,
    reviewer: personOrNull(review.reviewerUserId),
    outcome: review.outcome,
    note: review.note,
    createdAt: review.createdAt,
    decidedAt: review.decidedAt,
  };
}

function strategyRowOf(strategy: FixtureStrategy): StrategyRow {
  return {
    id: strategy.id,
    title: strategy.title,
    project: projectRef(strategy.tenantId, strategy.projectId),
    request: requestRef(strategy.tenantId, strategy.requestId),
    revision: strategy.revision,
    eventType: strategy.eventType,
    procedure: strategy.procedure,
    awardModel: strategy.awardModel,
    status: strategy.status,
    owner: personRef(strategy.ownerUserId),
    category: categoryRef(strategy.tenantId, strategy.categoryId),
    estimatedValue: estimatedValueOf(strategy),
    pendingFairnessReviews: reviewsOf(strategy).filter((review) => review.outcome === 'pending').length,
    tenders: strategy.tenderIds.map((id) => tenderRef(strategy.tenantId, id)).filter((tender) => tender !== null),
    updatedAt: strategy.updatedAt,
  };
}

function strategyActions(strategy: FixtureStrategy, viewer: Viewer): StrategyAction[] {
  const value = estimatedValueOf(strategy);
  const authority = authorityCheck(viewer.authorityLimit, 'strategy_approval', value);
  return STRATEGY_ACTIONS.filter((action) => {
    if (!viewer.permissions.has(STRATEGY_ACTION_PERMISSIONS[action])) {
      return false;
    }
    switch (action) {
      case 'edit':
      case 'add_research':
      case 'submit':
        return EDITABLE.includes(strategy.status);
      case 'decide_fairness':
        return reviewsOf(strategy).some((review) => review.outcome === 'pending');
      case 'decide':
        return strategy.status === 'awaiting_approval' && strategy.ownerUserId !== viewer.userId && authority.sufficient;
      case 'create_tender':
        return strategy.status === 'approved' && strategy.tenderIds.length === 0 && strategy.requestId !== null;
      default:
        return false;
    }
  });
}

function strategyDetailOf(strategy: FixtureStrategy, viewer: Viewer, extras: { research?: MarketResearchEntry[]; reviews?: FairnessReview[] } = {}): StrategyDetail {
  const value = estimatedValueOf(strategy);
  const policy = policyCheck(strategy.tenantId, strategy.procedure, value);
  const actions = strategyActions(strategy, viewer);
  const outcome = strategy.rfiOutcome;
  const rfiTender = outcome === null ? null : tenderRef(strategy.tenantId, outcome.rfiTenderId);
  return {
    ...strategyRowOf(strategy),
    intendedOutcome: strategy.intendedOutcome,
    competitionRationale: strategy.competitionRationale,
    directAwardGrounds: strategy.directAwardGrounds,
    risks: strategy.risks,
    qualificationApproach: strategy.qualificationApproach,
    lotStrategy: strategy.lotStrategy,
    evaluationApproach: strategy.evaluationApproach,
    negotiationPermitted: strategy.negotiationPermitted,
    timetableSummary: strategy.timetableSummary,
    externalOversight: strategy.externalOversight,
    policy,
    procedureDistinctions: distinctions(strategy, policy),
    marketResearch: [
      ...MARKET_RESEARCH.filter((entry) => entry.strategyId === strategy.id && entry.tenantId === strategy.tenantId).map(researchOf),
      ...(extras.research ?? []),
    ],
    fairnessReviews: extras.reviews ?? reviewsOf(strategy).map(reviewOf),
    approval:
      strategy.approval === null
        ? null
        : {
            approvalId: strategy.approval.approvalId,
            status: strategy.approval.status,
            approvedRevision: strategy.approval.approvedRevision,
            decidedBy: strategy.approval.decidedByUserId === null ? null : actorRef(strategy.tenantId, strategy.approval.decidedByUserId),
            decidedAt: strategy.approval.decidedAt,
            conditions: strategy.approval.conditions,
            reason: strategy.approval.reason,
          },
    callerAuthority: viewer.permissions.has('strategy.approve') ? authorityCheck(viewer.authorityLimit, 'strategy_approval', value) : null,
    rfiOutcome:
      outcome === null || rfiTender === null
        ? null
        : {
            rfiTender,
            findingsSummary: outcome.findingsSummary,
            reviewedBy: personRef(outcome.reviewedByUserId),
            reviewedAt: outcome.reviewedAt,
            nextStepDecision: outcome.nextStepDecision,
            nextEvent: tenderRef(strategy.tenantId, outcome.nextTenderId),
            participationNote:
              'Taking part in the RFI creates no award entitlement, and RFI participants are neither favoured nor excluded in the next event.',
          },
    submissionReadiness: readiness(strategy, policy),
    allowedActions: actions,
    createTenderPath: actions.includes('create_tender') && strategy.requestId !== null ? createTenderPath(strategy.requestId) : null,
  };
}

function findStrategy<E extends AnyEndpoint>(ctx: MockHandlerContext<E>, viewer: Viewer, strategyId: number): FixtureStrategy {
  const strategy = STRATEGIES.find((candidate) => candidate.id === strategyId && candidate.tenantId === viewer.tenantId);
  return strategy ?? ctx.notFound('No such strategy.');
}

const SORT_KEYS: Record<string, (row: StrategyRow) => SortValue> = {
  title: (row) => row.title,
  status: (row) => row.status,
  procedure: (row) => row.procedure,
  updatedAt: (row) => row.updatedAt,
  estimatedValue: (row) => row.estimatedValue,
};

interface StrategyInput {
  readonly eventType: FixtureStrategy['eventType'];
  readonly procedure: ProcurementStrategiesProcedure;
  readonly awardModel: FixtureStrategy['awardModel'];
  readonly intendedOutcome?: string | null | undefined;
  readonly competitionRationale?: string | null | undefined;
  readonly directAwardGrounds?: string | null | undefined;
  readonly risks?: string | null | undefined;
  readonly qualificationApproach?: string | null | undefined;
  readonly lotStrategy?: string | null | undefined;
  readonly evaluationApproach?: string | null | undefined;
  readonly negotiationPermitted: boolean;
  readonly timetableSummary?: string | null | undefined;
  readonly externalOversight?: string | null | undefined;
}

function text(value: string | null | undefined): string | null {
  return value === undefined || value === '' ? null : value;
}

function applyStrategyInput(strategy: FixtureStrategy, body: StrategyInput): FixtureStrategy {
  return {
    ...strategy,
    eventType: body.eventType,
    procedure: body.procedure,
    awardModel: body.awardModel,
    intendedOutcome: text(body.intendedOutcome),
    competitionRationale: text(body.competitionRationale),
    directAwardGrounds: text(body.directAwardGrounds),
    risks: text(body.risks),
    qualificationApproach: text(body.qualificationApproach),
    lotStrategy: text(body.lotStrategy),
    evaluationApproach: text(body.evaluationApproach),
    negotiationPermitted: body.negotiationPermitted,
    timetableSummary: text(body.timetableSummary),
    externalOversight: text(body.externalOversight),
  };
}

export function registerStrategies(app: MockApp): void {
  const e = requestEndpoints;

  mockRoute(app, e.listStrategies, (ctx) => {
    const viewer = viewerOf(ctx);
    const { query } = ctx;
    const rows = STRATEGIES.filter((strategy) => strategy.tenantId === viewer.tenantId)
      .filter((strategy) => query.status === undefined || query.status.includes(strategy.status))
      .filter((strategy) => query.procedure === undefined || query.procedure.includes(strategy.procedure))
      .filter((strategy) => query.eventType === undefined || query.eventType.includes(strategy.eventType))
      .filter((strategy) => query.ownerUserId === undefined || strategy.ownerUserId === query.ownerUserId)
      .filter((strategy) => matchesSearch(query.q, [strategy.title, strategy.intendedOutcome]))
      .map(strategyRowOf);
    const key = query.sort === undefined ? SORT_KEYS.updatedAt : SORT_KEYS[query.sort];
    return ctx.fixtures.page(sortRows(rows, key ?? null, query.sort === undefined ? 'desc' : query.dir));
  });

  mockRoute(app, e.getStrategy, (ctx) => {
    const viewer = viewerOf(ctx);
    return strategyDetailOf(findStrategy(ctx, viewer, ctx.params.strategyId), viewer);
  });

  mockRoute(app, e.createStrategy, (ctx) => {
    const viewer = viewerOf(ctx);
    const requestId = ctx.body.requestId ?? null;
    const projectId = ctx.body.projectId ?? null;
    const request = requestId === null ? undefined : REQUESTS.find((row) => row.id === requestId && row.tenantId === viewer.tenantId);
    if (requestId !== null && request === undefined) {
      ctx.fail(422, 'REFERENCE_NOT_FOUND', 'requestId does not name a request of this organization.');
    }
    if (projectId !== null && !PROJECTS.some((row) => row.id === projectId && row.tenantId === viewer.tenantId)) {
      ctx.fail(422, 'REFERENCE_NOT_FOUND', 'projectId does not name a project of this organization.');
    }
    if (request !== undefined && request.status !== 'approved') {
      ctx.fail(409, 'REQUEST_NOT_APPROVED', `${request.reference} is ${request.status}; a strategy needs an approved request.`);
    }
    if (request !== undefined && STRATEGIES.some((row) => row.requestId === request.id && row.status !== 'superseded')) {
      ctx.fail(409, 'STRATEGY_EXISTS', `${request.reference} already has a strategy; revise it instead.`);
    }
    const policy = policyCheck(viewer.tenantId, ctx.body.procedure, null);
    if (!policy.procedurePermitted) {
      ctx.fail(409, 'PROCEDURE_NOT_PERMITTED', `${ctx.body.procedure} is not permitted by the organization’s policy.`);
    }
    const project = PROJECTS.find((row) => row.id === (projectId ?? request?.projectId) && row.tenantId === viewer.tenantId);
    const base: FixtureStrategy = {
      id: NEW_ID,
      tenantId: viewer.tenantId,
      title: request?.title ?? project?.title ?? 'New strategy',
      projectId: projectId ?? request?.projectId ?? null,
      requestId,
      revision: 1,
      intendedOutcome: null,
      eventType: ctx.body.eventType,
      procedure: ctx.body.procedure,
      competitionRationale: null,
      directAwardGrounds: null,
      risks: null,
      qualificationApproach: null,
      lotStrategy: null,
      awardModel: ctx.body.awardModel,
      evaluationApproach: null,
      negotiationPermitted: false,
      timetableSummary: null,
      externalOversight: null,
      status: 'draft',
      ownerUserId: viewer.userId,
      estimatedValue: null,
      categoryId: request?.categoryId ?? project?.categoryId ?? null,
      tenderIds: [],
      approval: null,
      rfiOutcome: null,
      updatedAt: nowIso(ctx.now),
    };
    return strategyDetailOf(applyStrategyInput(base, ctx.body), viewer);
  });

  mockRoute(app, e.updateStrategy, (ctx) => {
    const viewer = viewerOf(ctx);
    const strategy = findStrategy(ctx, viewer, ctx.params.strategyId);
    if (!EDITABLE.includes(strategy.status)) {
      ctx.fail(409, 'STRATEGY_NOT_EDITABLE', `A ${strategy.status} strategy cannot be edited.`);
    }
    if (ctx.body.expectedRevision !== strategy.revision) {
      ctx.fail(409, 'REVISION_CONFLICT', `The strategy is now at revision ${strategy.revision}; reload before saving.`);
    }
    if (!policyCheck(viewer.tenantId, ctx.body.procedure, null).procedurePermitted) {
      ctx.fail(409, 'PROCEDURE_NOT_PERMITTED', `${ctx.body.procedure} is not permitted by the organization’s policy.`);
    }
    return strategyDetailOf(
      { ...applyStrategyInput(strategy, ctx.body), revision: strategy.revision + 1, status: 'draft', updatedAt: nowIso(ctx.now) },
      viewer,
    );
  });

  mockRoute(app, e.getProcedureOptions, (ctx) => {
    const viewer = viewerOf(ctx);
    const strategy = findStrategy(ctx, viewer, ctx.params.strategyId);
    const value = estimatedValueOf(strategy);
    return {
      strategyId: strategy.id,
      estimatedValue: value,
      options: PROCEDURE_GUIDANCE.flatMap((guidance) => {
        if (guidance.procedure === 'framework_calloff') {
          return [];
        }
        const policy = policyCheck(strategy.tenantId, guidance.procedure, value);
        return [
          {
            procedure: guidance.procedure,
            eventTypes: [...guidance.eventTypes],
            purpose: guidance.purpose,
            requiredDistinctions: guidance.requiredDistinctions.map((distinction) => distinction.label),
            permittedByPolicy: policy.procedurePermitted,
            withinThreshold: policy.withinThreshold,
            thresholdNote: policy.thresholdNote,
            requiresExceptionApproval: guidance.requiresExceptionApproval,
            typicalDurationDays: guidance.typicalDurationDays,
            selected: guidance.procedure === strategy.procedure,
          },
        ];
      }),
    };
  });

  mockRoute(app, e.addMarketResearch, (ctx) => {
    const viewer = viewerOf(ctx);
    const strategy = findStrategy(ctx, viewer, ctx.params.strategyId);
    if (!EDITABLE.includes(strategy.status)) {
      ctx.fail(409, 'STRATEGY_NOT_EDITABLE', `Research cannot be added to a ${strategy.status} strategy.`);
    }
    const supplierTenantId = ctx.body.supplierTenantId ?? null;
    const supplier = supplierRef(supplierTenantId);
    if (supplierTenantId !== null && supplier === null) {
      ctx.fail(422, 'REFERENCE_NOT_FOUND', 'supplierTenantId does not name a supplier organization.');
    }
    const now = nowIso(ctx.now);
    const entry: MarketResearchEntry = {
      id: NEW_ID,
      sourceType: ctx.body.sourceType,
      source: ctx.body.source,
      finding: ctx.body.finding,
      isSupplierCommitment: ctx.body.isSupplierCommitment,
      supplier,
      priorSpecificationInvolvement: ctx.body.priorSpecificationInvolvement,
      recordedAt: now,
      recordedBy: personRef(viewer.userId),
    };
    const review: FairnessReview | null =
      ctx.body.priorSpecificationInvolvement && supplier !== null
        ? {
            id: NEW_ID + 1,
            subjectType: 'strategy',
            subjectId: strategy.id,
            supplier,
            reason: `${supplier.name} was involved in shaping the specification: ${ctx.body.source}.`,
            reviewer: null,
            outcome: 'pending',
            note: null,
            createdAt: now,
            decidedAt: null,
          }
        : null;
    return { entry, fairnessReview: review };
  });

  mockRoute(app, e.decideFairnessReview, (ctx) => {
    const viewer = viewerOf(ctx);
    const strategy = findStrategy(ctx, viewer, ctx.params.strategyId);
    const review = reviewsOf(strategy).find((candidate) => candidate.id === ctx.params.reviewId);
    if (review === undefined) {
      return ctx.notFound('No such fairness review.');
    }
    if (review.outcome !== 'pending') {
      ctx.fail(409, 'FAIRNESS_REVIEW_CLOSED', `This review is already concluded (${review.outcome}).`);
    }
    return reviewOf({ ...review, outcome: ctx.body.outcome, note: ctx.body.note, reviewerUserId: viewer.userId, decidedAt: nowIso(ctx.now) });
  });

  mockRoute(app, e.submitStrategy, (ctx) => {
    const viewer = viewerOf(ctx);
    const strategy = findStrategy(ctx, viewer, ctx.params.strategyId);
    if (!EDITABLE.includes(strategy.status)) {
      ctx.fail(409, 'INVALID_TRANSITION', `A ${strategy.status} strategy cannot be submitted.`);
    }
    if (ctx.body.expectedRevision !== strategy.revision) {
      ctx.fail(409, 'REVISION_CONFLICT', `The strategy is now at revision ${strategy.revision}; reload before submitting.`);
    }
    const policy = policyCheck(strategy.tenantId, strategy.procedure, estimatedValueOf(strategy));
    const items = readiness(strategy, policy);
    const blocking = (id: string): boolean => items.some((item) => item.id === id && item.status === 'blocking');
    if (blocking('fairness')) {
      ctx.fail(409, 'FAIRNESS_REVIEW_PENDING', 'Conclude the fairness review on prior supplier involvement first.');
    }
    if (blocking('procedure')) {
      ctx.fail(409, 'PROCEDURE_NOT_PERMITTED', `${strategy.procedure} is not permitted by the organization’s policy.`);
    }
    if (blocking('directAwardGrounds')) {
      ctx.fail(422, 'DIRECT_AWARD_GROUNDS_REQUIRED', 'State the approved exception grounds for a direct procurement.');
    }
    if (blocking('threshold')) {
      ctx.fail(409, 'PROCEDURE_THRESHOLD_EXCEEDED', `The estimate exceeds the threshold for ${strategy.procedure}. ${policy.thresholdNote ?? ''}`.trim());
    }
    const missing = items.filter((item) => item.status === 'blocking');
    if (missing.length > 0) {
      ctx.fail(422, 'STRATEGY_INCOMPLETE', `Complete before submitting: ${missing.map((item) => item.label).join(', ')}.`);
    }
    const now = nowIso(ctx.now);
    return strategyDetailOf(
      {
        ...strategy,
        status: 'awaiting_approval',
        updatedAt: now,
        approval: { approvalId: NEW_ID, status: 'pending', approvedRevision: null, decidedByUserId: null, decidedAt: null, conditions: null, reason: null },
      },
      viewer,
    );
  });

  mockRoute(app, e.decideStrategy, (ctx) => {
    const viewer = viewerOf(ctx);
    const strategy = findStrategy(ctx, viewer, ctx.params.strategyId);
    if (strategy.status !== 'awaiting_approval') {
      ctx.fail(409, 'INVALID_TRANSITION', `A ${strategy.status} strategy is not awaiting approval.`);
    }
    if (ctx.body.subjectRevision !== strategy.revision) {
      ctx.fail(409, 'REVISION_CONFLICT', `The strategy changed to revision ${strategy.revision}; review it before deciding.`);
    }
    if (strategy.ownerUserId === viewer.userId) {
      ctx.fail(403, 'SELF_APPROVAL_BLOCKED', 'You prepared this strategy, so another approver must decide it.');
    }
    const approving = ctx.body.decision === 'approve' || ctx.body.decision === 'approve_with_conditions';
    if (approving && !authorityCheck(viewer.authorityLimit, 'strategy_approval', estimatedValueOf(strategy)).sufficient) {
      ctx.fail(403, 'AUTHORITY_EXCEEDED', 'The estimated value exceeds your delegated authority for strategy approval.');
    }
    const now = nowIso(ctx.now);
    const status: ProcurementStrategiesStatus = approving ? 'approved' : 'returned';
    const approvalStatus = ctx.body.decision === 'approve' ? 'approved' : ctx.body.decision === 'approve_with_conditions' ? 'approved_with_conditions' : ctx.body.decision === 'reject' ? 'rejected' : 'returned';
    return strategyDetailOf(
      {
        ...strategy,
        status,
        updatedAt: now,
        approval: {
          approvalId: strategy.approval?.approvalId ?? NEW_ID,
          status: approvalStatus,
          approvedRevision: approving ? strategy.revision : null,
          decidedByUserId: viewer.userId,
          decidedAt: now,
          conditions: ctx.body.conditions ?? null,
          reason: ctx.body.reason,
        },
      },
      viewer,
    );
  });
}
