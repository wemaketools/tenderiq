/**
 * Mock handlers of the selection contract (`src/contracts/selection.ts`; BUY-22..BUY-25, BUY-27, SUP-18, SUP-19).
 *
 * - Buyer lists and details show only the active buyer tenant's records; another tenant's record is a 404.
 * - Supplier endpoints show only the supplier's own invitations, negotiations (once mandated, rounds marked
 *   supplier-visible) and final-offer rounds it is invited to (DD-03, PRD §4.3).
 * - Commands validate the business state the fixtures imply and answer with a static outcome (new ids from 9001);
 *   nothing is persisted.
 */
import { sha256Hex } from '../../sha256.js';

import type { Money } from '../../../contracts/common.js';
import { gt } from '../../../contracts/decimal.js';
import { isEffectAllowed, selectionEndpoints as E } from '../../../contracts/selection.js';
import type {
  AssessmentFinding,
  DueDiligenceCaseDetail,
  NegotiationDetail,
  SelectionBlocker,
} from '../../../contracts/selection.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import {
  ASSESSMENT_INVITES,
  ASSESSMENT_SESSIONS,
  DUE_DILIGENCE_CASES,
  FINAL_OFFER_ROUNDS,
  NEGOTIATIONS,
  PREFERRED_BIDDERS,
  PROCESS_DECISIONS,
  REFERENCE_CHECKS,
  SELECTION_TENDERS,
  SHORTLISTS,
} from '../../fixtures/selection/index.js';
import type {
  FixtureAssessmentSession,
  FixtureDiligenceCase,
  FixtureDiligenceFinding,
  FixtureNegotiation,
  FixturePreferredBidder,
  FixtureProcessDecision,
  FixtureSelectionTender,
  FixtureShortlist,
  FixtureShortlistEntry,
} from '../../fixtures/selection/index.js';
import { personRef } from '../../persona.js';
import {
  approvedPreferredOf,
  awardBlockers,
  bidOf,
  bidRef,
  bidsOfTender,
  diligenceDetail,
  diligenceFindingView,
  diligencePassBlockers,
  diligenceRow,
  equalTreatmentChecks,
  fallbackBlockers,
  finalOfferBlockers,
  finalOfferDetail,
  finalOfferIssueBlockers,
  finalOfferRow,
  invitesOf,
  isEligibleBid,
  isEligibleFor,
  isSupplierVisibleNegotiation,
  isSupplierVisibleRound,
  negotiationBlockers,
  negotiationDetail,
  negotiationRoundBlockers,
  negotiationRow,
  preferredDetail,
  preferredOfCase,
  preferredRow,
  processDecisionView,
  referenceCheckView,
  sessionDetail,
  sessionOfInvite,
  sessionRow,
  sessionScopeBids,
  shortlistDetail,
  shortlistNotifyBlockers,
  shortlistRow,
  supplierFinalOfferView,
  supplierInviteBlockers,
  supplierInviteView,
  supplierNegotiationDetail,
  supplierNegotiationRow,
  supplierRoundOf,
  supplierRoundView,
  tenderOf,
  tenderRow,
  tenderSummary,
} from './build.js';

/** First id of records created by commands (never persisted). */
const NEW_ID = 9001;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Tender states in which selection steps are recorded (a partially awarded event may still assess other lots). */
const ASSESSMENT_STATES = new Set(['under_assessment', 'partially_awarded']);

// ---------------------------------------------------------------------------------------------------------
// List helpers
// ---------------------------------------------------------------------------------------------------------

type SortValue = string | number | null;

function sortRows<T>(rows: T[], key: ((row: T) => SortValue) | undefined, dir: 'asc' | 'desc'): T[] {
  if (key === undefined) {
    return rows;
  }
  const factor = dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const left = key(a);
    const right = key(b);
    if (left === right) {
      return 0;
    }
    if (left === null) {
      return 1;
    }
    if (right === null) {
      return -1;
    }
    return (left < right ? -1 : 1) * factor;
  });
}

function matchesText(q: string | undefined, ...values: ReadonlyArray<string | null>): boolean {
  if (q === undefined || q === '') {
    return true;
  }
  const needle = q.toLowerCase();
  return values.some((value) => value !== null && value.toLowerCase().includes(needle));
}

function inList<T>(filter: readonly T[] | undefined, value: T): boolean {
  return filter === undefined || filter.length === 0 || filter.includes(value);
}

function officialDate(at: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
}

function hashOf(...parts: ReadonlyArray<string | number>): string {
  return sha256Hex(parts.join('|'));
}

function firstBlocker(blockers: readonly SelectionBlocker[]): SelectionBlocker | undefined {
  return blockers[0];
}

function describe(blockers: readonly SelectionBlocker[]): string {
  return blockers.map((row) => row.message).join(' ');
}

/** True when the user may own findings of this case: on the tender team and holding `diligence.manage`. */
function isEligibleFindingOwner(diligence: FixtureDiligenceCase, userId: number): boolean {
  const preferred = preferredOfCase(diligence);
  const tender = tenderOf(diligence.tenantId, preferred.tenderId);
  return tender !== undefined && isEligibleFor(tender, userId, 'findingOwner');
}

function assessmentTender(tenantId: number, tenderId: number): FixtureSelectionTender | undefined {
  const tender = tenderOf(tenantId, tenderId);
  return tender !== undefined && ASSESSMENT_STATES.has(tender.status) ? tender : undefined;
}

// ---------------------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------------------

export function register(app: MockApp): void {
  registerTenders(app);
  registerSessions(app);
  registerReferences(app);
  registerShortlists(app);
  registerProcessDecisions(app);
  registerPreferredBidders(app);
  registerDiligence(app);
  registerNegotiations(app);
  registerFinalOffers(app);
  registerSupplier(app);
}

function registerTenders(app: MockApp): void {
  mockRoute(app, E.listTenders, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = SELECTION_TENDERS.filter((row) => row.tenantId === tenant.id)
      .filter((row) => matchesText(query.q, row.reference, row.title))
      .filter((row) => inList(query.status, row.status))
      .filter((row) => inList(query.procedure, row.procedure))
      .filter((row) => query.ownerUserId === undefined || row.ownerUserId === query.ownerUserId)
      .map(tenderRow)
      .filter((row) => query.hasBlockers === undefined || (row.blockerCount > 0) === query.hasBlockers);
    const keys = {
      reference: (row: (typeof rows)[number]) => row.reference,
      updatedAt: (row: (typeof rows)[number]) => row.updatedAt,
      status: (row: (typeof rows)[number]) => row.status,
    };
    const sorted = sortRows(rows, query.sort === undefined ? keys.updatedAt : keys[query.sort], query.sort === undefined ? 'desc' : query.dir);
    return fixtures.page(sorted);
  });

  mockRoute(app, E.getTender, ({ requireTenant, params, notFound }) => {
    const { tenant } = requireTenant();
    const tender = tenderOf(tenant.id, params.tenderId);
    if (tender === undefined) {
      return notFound('No selection record for this tender.');
    }
    return tenderSummary(tender);
  });
}

// ---------------------------------------------------------------------------------------------------------
// Assessment sessions (AC-21)
// ---------------------------------------------------------------------------------------------------------

function canReadConfidential(permissions: readonly string[]): boolean {
  return permissions.includes('selection.manage');
}

function registerSessions(app: MockApp): void {
  mockRoute(app, E.listSessions, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = ASSESSMENT_SESSIONS.filter((row) => row.tenantId === tenant.id)
      .filter((row) => query.tenderId === undefined || row.tenderId === query.tenderId)
      .filter((row) => inList(query.sessionType, row.sessionType))
      .filter((row) => inList(query.assessmentBasis, row.assessmentBasis))
      .filter((row) => inList(query.status, row.status))
      .filter((row) => query.createdByUserId === undefined || row.createdBy === query.createdByUserId)
      .map(sessionRow)
      .filter((row) => matchesText(query.q, row.purpose, row.tender.reference, row.tender.title, row.criterion?.name ?? null))
      .filter((row) => {
        if (query.from === undefined && query.to === undefined) {
          return true;
        }
        if (row.firstScheduledAt === null) {
          return false;
        }
        const day = officialDate(row.firstScheduledAt, row.tender.officialTimeZone);
        return (query.from === undefined || day >= query.from) && (query.to === undefined || day <= query.to);
      });
    type Row = (typeof rows)[number];
    const keys = {
      firstScheduledAt: (row: Row) => row.firstScheduledAt,
      tenderReference: (row: Row) => row.tender.reference,
      status: (row: Row) => row.status,
      updatedAt: (row: Row) => row.updatedAt,
    };
    const sorted = sortRows(rows, query.sort === undefined ? keys.updatedAt : keys[query.sort], query.sort === undefined ? 'desc' : query.dir);
    return fixtures.page(sorted);
  });

  function sessionFor(tenantId: number, sessionId: number): FixtureAssessmentSession | undefined {
    return ASSESSMENT_SESSIONS.find((row) => row.tenantId === tenantId && row.sessionId === sessionId);
  }

  mockRoute(app, E.getSession, ({ requireTenant, params, notFound }) => {
    const access = requireTenant();
    const session = sessionFor(access.tenant.id, params.sessionId);
    if (session === undefined) {
      return notFound();
    }
    return sessionDetail(session, canReadConfidential(access.permissions));
  });

  mockRoute(app, E.createSession, ({ requireTenant, requirePersona, body, now, fail }) => {
    const access = requireTenant();
    const tender = assessmentTender(access.tenant.id, body.tenderId);
    if (tender === undefined) {
      return fail(409, 'TENDER_NOT_IN_ASSESSMENT', 'Assessment sessions are planned only for events under assessment.');
    }
    const permitted =
      body.sessionType === 'reference_check' ? tender.conditions.referencesPermitted : tender.conditions.demonstrationsPermitted;
    if (!permitted) {
      return fail(409, 'SESSION_TYPE_NOT_PERMITTED', `The announced procedure does not include this kind of session. ${tender.conditions.conditionsNote}`);
    }
    const lotId = body.lotId ?? null;
    if (lotId !== null && !tender.lots.some((lot) => lot.lotId === lotId)) {
      return fail(422, 'LOT_NOT_IN_TENDER', 'The lot does not belong to this tender.');
    }
    const criterionId = body.criterionId ?? null;
    if (criterionId !== null && !tender.criteria.some((row) => row.criterionId === criterionId)) {
      return fail(422, 'CRITERION_NOT_IN_PLAN', 'A scored session must feed a criterion of the approved evaluation plan.');
    }
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const session: FixtureAssessmentSession = {
      tenantId: access.tenant.id,
      sessionId: NEW_ID,
      tenderId: tender.tenderId,
      lotId,
      sessionType: body.sessionType,
      purpose: body.purpose,
      agenda: body.agenda,
      assessmentBasis: body.assessmentBasis,
      criterionId,
      instructions: body.instructions,
      preparationDays: body.preparationDays,
      equalTreatmentConfirmedBy: null,
      equalTreatmentConfirmedAt: null,
      status: 'planned',
      createdBy: requirePersona().userId,
      createdAt: at,
      updatedAt: at,
      completionSummary: null,
      cancellationReason: null,
    };
    return sessionDetail(session, canReadConfidential(access.permissions));
  });

  mockRoute(app, E.confirmEqualTreatment, ({ requireTenant, requirePersona, params, now, fail, notFound }) => {
    const access = requireTenant();
    const session = sessionFor(access.tenant.id, params.sessionId);
    if (session === undefined) {
      return notFound();
    }
    if (session.status !== 'planned' && session.status !== 'scheduled') {
      return fail(409, 'SESSION_NOT_EDITABLE', `The session is ${session.status}.`);
    }
    if (session.equalTreatmentConfirmedAt !== null) {
      return fail(409, 'EQUAL_TREATMENT_ALREADY_CONFIRMED', 'Equal treatment was already confirmed for this session.');
    }
    const failed = equalTreatmentChecks(session).filter((row) => !row.satisfied);
    if (failed.length > 0) {
      return fail(409, 'EQUAL_TREATMENT_CHECK_FAILED', failed.map((row) => row.detail).join(' '));
    }
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    return sessionDetail(
      { ...session, equalTreatmentConfirmedBy: requirePersona().userId, equalTreatmentConfirmedAt: at, updatedAt: at },
      canReadConfidential(access.permissions),
    );
  });

  mockRoute(app, E.issueInvites, ({ requireTenant, params, body, now, fail, notFound }) => {
    const access = requireTenant();
    const session = sessionFor(access.tenant.id, params.sessionId);
    if (session === undefined) {
      return notFound();
    }
    if (session.status !== 'planned' && session.status !== 'scheduled') {
      return fail(409, 'SESSION_NOT_EDITABLE', `The session is ${session.status}.`);
    }
    if (session.equalTreatmentConfirmedAt === null) {
      return fail(409, 'EQUAL_TREATMENT_NOT_CONFIRMED', 'Confirm equal treatment before inviting candidates.');
    }
    const scope = new Set(sessionScopeBids(session).map((bid) => bid.bidId));
    const invited = new Set(invitesOf(session).map((row) => row.bidId));
    for (const invite of body.invites) {
      if (!scope.has(invite.bidId)) {
        return fail(409, 'BID_NOT_ELIGIBLE', `Bid ${invite.bidId} is not an eligible candidate in the session’s scope.`);
      }
      if (invited.has(invite.bidId)) {
        return fail(409, 'ALREADY_INVITED', `Bid ${invite.bidId} is already invited to this session.`);
      }
      if (Date.parse(invite.scheduledAt) - now.getTime() < session.preparationDays * DAY_MS) {
        return fail(
          409,
          'PREPARATION_TIME_TOO_SHORT',
          `Every invitee must have at least ${session.preparationDays} day(s) to prepare.`,
        );
      }
    }
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const detail = sessionDetail({ ...session, status: 'scheduled', updatedAt: at }, canReadConfidential(access.permissions));
    const added = body.invites.map((invite, index) => {
      const bid = bidOf(access.tenant.id, invite.bidId);
      if (bid === undefined) {
        return fail(409, 'BID_NOT_ELIGIBLE');
      }
      return {
        inviteId: NEW_ID + index,
        bid: bidRef(bid),
        scheduledAt: invite.scheduledAt,
        status: 'invited' as const,
        invitedAt: at,
        supplierConfirmedAt: null,
        supplierConfirmedBy: null,
      };
    });
    const invites = [...detail.invites, ...added];
    const addedIds = new Set(body.invites.map((row) => row.bidId));
    const scheduled = invites.map((row) => row.scheduledAt).filter((value): value is string => value !== null).sort();
    return {
      ...detail,
      invites,
      inviteCount: invites.length,
      firstScheduledAt: scheduled[0] ?? null,
      invitableBids: detail.invitableBids.filter((bid) => !addedIds.has(bid.bidId)),
    };
  });

  mockRoute(app, E.recordFinding, ({ requireTenant, requirePersona, params, body, now, fail, notFound }): AssessmentFinding => {
    const access = requireTenant();
    const session = sessionFor(access.tenant.id, params.sessionId);
    if (session === undefined) {
      return notFound();
    }
    if (session.status !== 'scheduled') {
      return fail(409, 'SESSION_NOT_OPEN_FOR_FINDINGS', `Findings are recorded while the session is scheduled; it is ${session.status}.`);
    }
    const invite = invitesOf(session).find((row) => row.bidId === body.bidId);
    const bid = bidOf(access.tenant.id, body.bidId);
    if (invite === undefined || bid === undefined || (invite.status !== 'confirmed' && invite.status !== 'attended')) {
      return fail(409, 'BID_NOT_INVITED', 'Findings are recorded only for candidates who confirmed or attended this session.');
    }
    if (!isEffectAllowed(session.assessmentBasis, body.effect)) {
      return fail(
        422,
        'FINDING_EFFECT_NOT_ALLOWED',
        `A ${session.assessmentBasis.replace(/_/g, ' ')} session cannot record the effect "${body.effect.replace(/_/g, ' ')}".`,
      );
    }
    return {
      findingId: NEW_ID,
      bid: bidRef(bid),
      assessor: personRef(requirePersona().userId),
      finding: body.finding,
      effect: body.effect,
      evidenceDocumentId: body.evidenceDocumentId ?? null,
      evidenceTitle: null,
      recordedAt: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    };
  });

  mockRoute(app, E.completeSession, ({ requireTenant, params, body, now, fail, notFound }) => {
    const access = requireTenant();
    const session = sessionFor(access.tenant.id, params.sessionId);
    if (session === undefined) {
      return notFound();
    }
    if (session.status !== 'scheduled') {
      return fail(409, 'SESSION_NOT_EDITABLE', `Only a scheduled session can be completed; it is ${session.status}.`);
    }
    const detail = sessionDetail(session, canReadConfidential(access.permissions));
    const present = detail.invites.filter((row) => row.status === 'confirmed' || row.status === 'attended');
    const missing = present.filter((invite) => !detail.findings.some((finding) => finding.bid.bidId === invite.bid.bidId));
    if (present.length === 0 || missing.length > 0) {
      return fail(
        409,
        'FINDINGS_INCOMPLETE',
        present.length === 0
          ? 'No candidate has attended yet; record attendance and findings first.'
          : `No finding is recorded for: ${missing.map((row) => row.bid.supplierName).join(', ')}.`,
      );
    }
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    return sessionDetail({ ...session, status: 'completed', completionSummary: body.summary, updatedAt: at }, canReadConfidential(access.permissions));
  });

  mockRoute(app, E.cancelSession, ({ requireTenant, params, body, now, fail, notFound }) => {
    const access = requireTenant();
    const session = sessionFor(access.tenant.id, params.sessionId);
    if (session === undefined) {
      return notFound();
    }
    if (session.status !== 'planned' && session.status !== 'scheduled') {
      return fail(409, 'SESSION_NOT_EDITABLE', `The session is ${session.status}.`);
    }
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    return sessionDetail(
      { ...session, status: 'cancelled', cancellationReason: body.reason, updatedAt: at },
      canReadConfidential(access.permissions),
    );
  });
}

// ---------------------------------------------------------------------------------------------------------
// Reference checks
// ---------------------------------------------------------------------------------------------------------

function registerReferences(app: MockApp): void {
  mockRoute(app, E.listReferenceChecks, ({ requireTenant, query, fixtures }) => {
    const access = requireTenant();
    const readable = canReadConfidential(access.permissions);
    const rows = REFERENCE_CHECKS.filter((row) => row.tenantId === access.tenant.id)
      .map((row) => referenceCheckView(row, readable))
      .filter((row) => query.tenderId === undefined || row.tender.tenderId === query.tenderId)
      .filter((row) => query.bidId === undefined || row.bid.bidId === query.bidId)
      .filter((row) => query.consentConfirmed === undefined || row.consentConfirmed === query.consentConfirmed)
      .filter((row) => query.recorded === undefined || (row.outcome !== null) === query.recorded)
      .filter((row) => matchesText(query.q, row.refereeName, row.refereeOrganization, row.bid.supplierName, row.tender.reference));
    type Row = (typeof rows)[number];
    const keys = {
      refereeName: (row: Row) => row.refereeName,
      contactedAt: (row: Row) => row.contactedAt,
      updatedAt: (row: Row) => row.updatedAt,
    };
    return fixtures.page(sortRows(rows, query.sort === undefined ? undefined : keys[query.sort], query.dir));
  });

  mockRoute(app, E.createReferenceCheck, ({ requireTenant, body, now, fail }) => {
    const access = requireTenant();
    const bid = bidOf(access.tenant.id, body.bidId);
    const tender = bid === undefined ? undefined : assessmentTender(access.tenant.id, bid.tenderId);
    if (bid === undefined || tender === undefined) {
      return fail(409, 'BID_NOT_ELIGIBLE', 'The bid is not a candidate of an event under assessment.');
    }
    if (!tender.conditions.referencesPermitted) {
      return fail(409, 'REFERENCES_NOT_PERMITTED', `Reference checks are not part of the announced procedure. ${tender.conditions.conditionsNote}`);
    }
    if (!isEligibleBid(bid)) {
      return fail(409, 'BID_NOT_ELIGIBLE', 'The candidate is excluded from this stage.');
    }
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    return referenceCheckView(
      {
        tenantId: access.tenant.id,
        referenceCheckId: NEW_ID,
        bidId: bid.bidId,
        refereeName: body.refereeName,
        refereeOrganization: body.refereeOrganization,
        consentConfirmed: body.consentConfirmed,
        contactedAt: null,
        feedback: null,
        confidential: body.confidential,
        assessorUserId: null,
        outcome: null,
        updatedAt: at,
      },
      canReadConfidential(access.permissions),
    );
  });

  mockRoute(app, E.recordReferenceFeedback, ({ requireTenant, requirePersona, params, body, now, fail, notFound }) => {
    const access = requireTenant();
    const check = REFERENCE_CHECKS.find((row) => row.tenantId === access.tenant.id && row.referenceCheckId === params.referenceCheckId);
    if (check === undefined) {
      return notFound();
    }
    if (!check.consentConfirmed) {
      return fail(409, 'REFERENCE_CONSENT_REQUIRED', 'The referee has not consented to be contacted; no feedback can be recorded.');
    }
    if (check.feedback !== null) {
      return fail(409, 'REFERENCE_FEEDBACK_RECORDED', 'Feedback is already recorded for this referee.');
    }
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    return referenceCheckView(
      {
        ...check,
        contactedAt: body.contactedAt,
        feedback: body.feedback,
        outcome: body.outcome,
        assessorUserId: requirePersona().userId,
        updatedAt: at,
      },
      canReadConfidential(access.permissions),
    );
  });
}

// ---------------------------------------------------------------------------------------------------------
// Shortlists (AC-22)
// ---------------------------------------------------------------------------------------------------------

interface EntryInput {
  readonly bidId: number;
  readonly included: boolean;
  readonly rank?: number | null | undefined;
  readonly reason: string;
  readonly conditions?: string | null | undefined;
}

type ShortlistFail = (status: number, code: string, detail?: string) => never;

function validateEntries(
  shortlist: FixtureShortlist,
  entries: readonly EntryInput[],
  threshold: string | null,
  fail: ShortlistFail,
): FixtureShortlistEntry[] {
  const tender = tenderOf(shortlist.tenantId, shortlist.tenderId);
  const candidates =
    tender === undefined
      ? []
      : bidsOfTender(tender).filter((bid) => !bid.isAlternative && (shortlist.lotId === null || bid.lotId === shortlist.lotId));
  const candidateIds = new Set(candidates.map((bid) => bid.bidId));
  for (const entry of entries) {
    if (!candidateIds.has(entry.bidId)) {
      fail(422, 'ENTRY_BID_UNKNOWN', `Bid ${entry.bidId} is not a candidate of this stage.`);
    }
  }
  const listed = new Set(entries.map((entry) => entry.bidId));
  const missing = candidates.filter((bid) => !listed.has(bid.bidId));
  if (missing.length > 0) {
    fail(422, 'CANDIDATE_MISSING', `Record a decision and reason for: ${missing.map((bid) => bid.supplierName).join(', ')}.`);
  }
  for (const entry of entries) {
    const bid = candidates.find((row) => row.bidId === entry.bidId);
    if (!entry.included || bid === undefined) {
      continue;
    }
    if (!bid.passesGates || (threshold !== null && (bid.nonPriceScore === null || gt(threshold, bid.nonPriceScore)))) {
      fail(
        422,
        'INCLUDED_BELOW_THRESHOLD',
        `${bid.supplierName} (non-price ${bid.nonPriceScore ?? 'not scored'}) does not meet the ${threshold ?? 'announced'} threshold or its gates.`,
      );
    }
  }
  return entries.map((entry, index) => ({
    entryId: NEW_ID + index,
    bidId: entry.bidId,
    included: entry.included,
    rank: entry.included ? (entry.rank ?? null) : null,
    reason: entry.reason,
    conditions: entry.conditions ?? null,
    notifiedAt: null,
    notice: null,
  }));
}

function registerShortlists(app: MockApp): void {
  function shortlistFor(tenantId: number, shortlistId: number): FixtureShortlist | undefined {
    return SHORTLISTS.find((row) => row.tenantId === tenantId && row.shortlistId === shortlistId);
  }

  mockRoute(app, E.listShortlists, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = SHORTLISTS.filter((row) => row.tenantId === tenant.id)
      .filter((row) => query.tenderId === undefined || row.tenderId === query.tenderId)
      .filter((row) => inList(query.status, row.status))
      .map(shortlistRow)
      .filter((row) => matchesText(query.q, row.tender.reference, row.tender.title, row.selectionRule));
    type Row = (typeof rows)[number];
    const keys = {
      tenderReference: (row: Row) => row.tender.reference,
      status: (row: Row) => row.status,
      updatedAt: (row: Row) => row.updatedAt,
    };
    return fixtures.page(sortRows(rows, query.sort === undefined ? keys.updatedAt : keys[query.sort], query.sort === undefined ? 'desc' : query.dir));
  });

  mockRoute(app, E.getShortlist, ({ requireTenant, params, notFound }) => {
    const { tenant } = requireTenant();
    const shortlist = shortlistFor(tenant.id, params.shortlistId);
    return shortlist === undefined ? notFound() : shortlistDetail(shortlist);
  });

  mockRoute(app, E.createShortlist, ({ requireTenant, body, now, fail }) => {
    const { tenant } = requireTenant();
    const tender = assessmentTender(tenant.id, body.tenderId);
    if (tender === undefined) {
      return fail(409, 'TENDER_NOT_IN_ASSESSMENT', 'Shortlists are prepared only for events under assessment.');
    }
    const lotId = body.lotId ?? null;
    if (lotId !== null && !tender.lots.some((lot) => lot.lotId === lotId)) {
      return fail(422, 'LOT_NOT_IN_TENDER', 'The lot does not belong to this tender.');
    }
    const existing = SHORTLISTS.find(
      (row) => row.tenantId === tenant.id && row.tenderId === tender.tenderId && row.lotId === lotId && row.stageNo === body.stageNo,
    );
    if (existing !== undefined) {
      return fail(409, 'SHORTLIST_EXISTS', `Shortlist ${existing.shortlistId} already covers stage ${body.stageNo}; change it instead.`);
    }
    const threshold = body.threshold ?? null;
    const candidates = bidsOfTender(tender).filter((bid) => !bid.isAlternative && (lotId === null || bid.lotId === lotId));
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const shortlist: FixtureShortlist = {
      tenantId: tenant.id,
      shortlistId: NEW_ID,
      tenderId: tender.tenderId,
      lotId,
      stageNo: body.stageNo,
      selectionRule: body.selectionRule,
      threshold,
      rationale: body.rationale,
      status: 'draft',
      approval: null,
      approvedAt: null,
      changeReason: null,
      version: 1,
      contentHash: hashOf('shortlist', NEW_ID, 1, body.selectionRule, threshold ?? '', body.rationale),
      nextStageTender: null,
      entries: candidates.map((bid, index) => {
        const score = bid.nonPriceScore;
        const meets = bid.passesGates && score !== null && (threshold === null || !gt(threshold, score));
        return {
          entryId: NEW_ID + index,
          bidId: bid.bidId,
          included: meets,
          rank: meets ? bid.rank : null,
          reason:
            score === null
              ? 'Not yet evaluated; decide once the evaluation is signed off.'
              : threshold === null
                ? `Non-price score ${score}.`
                : meets
                  ? `Non-price score ${score} meets the ${threshold} threshold.`
                  : `Non-price score ${score} does not meet the ${threshold} threshold.`,
          conditions: null,
          notifiedAt: null,
          notice: null,
        };
      }),
      updatedAt: at,
    };
    return shortlistDetail(shortlist);
  });

  mockRoute(app, E.updateShortlist, ({ requireTenant, params, body, now, fail, notFound }) => {
    const { tenant } = requireTenant();
    const shortlist = shortlistFor(tenant.id, params.shortlistId);
    if (shortlist === undefined) {
      return notFound();
    }
    if (shortlist.status !== 'draft') {
      return fail(409, 'SHORTLIST_NOT_EDITABLE', `The shortlist is ${shortlist.status.replace(/_/g, ' ')}; an approved shortlist is changed with a recorded reason.`);
    }
    const threshold = body.threshold ?? null;
    const entries = validateEntries(shortlist, body.entries, threshold, fail);
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    return shortlistDetail({
      ...shortlist,
      selectionRule: body.selectionRule,
      threshold,
      rationale: body.rationale,
      entries,
      version: shortlist.version + 1,
      contentHash: hashOf('shortlist', shortlist.shortlistId, shortlist.version + 1, body.selectionRule, body.rationale),
      updatedAt: at,
    });
  });

  mockRoute(app, E.changeShortlist, ({ requireTenant, params, body, now, fail, notFound }) => {
    const { tenant } = requireTenant();
    const shortlist = shortlistFor(tenant.id, params.shortlistId);
    if (shortlist === undefined) {
      return notFound();
    }
    if (shortlist.status !== 'approved') {
      return fail(409, 'SHORTLIST_NOT_APPROVED', 'Only an approved shortlist is changed through a recorded decision; edit the draft instead.');
    }
    const threshold = body.threshold ?? null;
    const entries = validateEntries(shortlist, body.entries, threshold, fail);
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    return shortlistDetail({
      ...shortlist,
      selectionRule: body.selectionRule,
      threshold,
      rationale: body.rationale,
      entries,
      status: 'changed',
      approval: null,
      approvedAt: null,
      changeReason: body.changeReason,
      version: shortlist.version + 1,
      contentHash: hashOf('shortlist', shortlist.shortlistId, shortlist.version + 1, body.changeReason),
      updatedAt: at,
    });
  });

  mockRoute(app, E.notifyShortlist, ({ requireTenant, params, now, fail, notFound }) => {
    const { tenant } = requireTenant();
    const shortlist = shortlistFor(tenant.id, params.shortlistId);
    if (shortlist === undefined) {
      return notFound();
    }
    const blocker = firstBlocker(shortlistNotifyBlockers(shortlist));
    if (blocker !== undefined) {
      return fail(409, blocker.code, blocker.message);
    }
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const tender = tenderOf(tenant.id, shortlist.tenderId);
    const reference = tender?.reference ?? '';
    const pending = shortlist.entries.filter((entry) => entry.notifiedAt === null);
    const notified = shortlist.entries.map((entry, index) =>
      entry.notifiedAt !== null
        ? entry
        : {
            ...entry,
            notifiedAt: at,
            notice: {
              noticeId: NEW_ID + index,
              noticeType: 'shortlist_outcome' as const,
              status: 'issued' as const,
              title: entry.included ? `Stage outcome and next-stage invitation: ${reference}` : `Stage outcome: ${reference}`,
              issuedAt: at,
            },
          },
    );
    return {
      shortlist: shortlistDetail({ ...shortlist, entries: notified, updatedAt: at }),
      outcomeNoticesIssued: pending.length,
      nextStageInvitationsIssued: pending.filter((entry) => entry.included).length,
    };
  });
}

// ---------------------------------------------------------------------------------------------------------
// Process decisions
// ---------------------------------------------------------------------------------------------------------

function registerProcessDecisions(app: MockApp): void {
  mockRoute(app, E.listProcessDecisions, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = PROCESS_DECISIONS.filter((row) => row.tenantId === tenant.id)
      .filter((row) => query.tenderId === undefined || row.tenderId === query.tenderId)
      .filter((row) => inList(query.decisionType, row.decisionType))
      .filter((row) => inList(query.status, row.status))
      .map(processDecisionView)
      .filter((row) => matchesText(query.q, row.reason, row.tender.reference, row.tender.title));
    type Row = (typeof rows)[number];
    const keys = { createdAt: (row: Row) => row.createdAt, status: (row: Row) => row.status };
    return fixtures.page(sortRows(rows, query.sort === undefined ? keys.createdAt : keys[query.sort], query.sort === undefined ? 'desc' : query.dir));
  });

  mockRoute(app, E.proposeProcessDecision, ({ requireTenant, requirePersona, body, now, fail }) => {
    const { tenant } = requireTenant();
    const tender = assessmentTender(tenant.id, body.tenderId);
    if (tender === undefined) {
      return fail(409, 'TENDER_NOT_IN_ASSESSMENT', 'Process decisions are recorded here only for events under assessment.');
    }
    const pending = PROCESS_DECISIONS.find(
      (row) =>
        row.tenantId === tenant.id && row.tenderId === tender.tenderId && row.decisionType === body.decisionType && row.status === 'proposed',
    );
    if (pending !== undefined) {
      return fail(409, 'PROCESS_DECISION_PENDING', 'A process decision of the same type is still awaiting a decision on this event.');
    }
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const decision: FixtureProcessDecision = {
      tenantId: tenant.id,
      processDecisionId: NEW_ID,
      tenderId: tender.tenderId,
      lotId: body.lotId ?? null,
      decisionType: body.decisionType,
      reason: body.reason,
      status: 'proposed',
      proposedBy: requirePersona().userId,
      decidedBy: null,
      approval: null,
      version: 1,
      contentHash: hashOf('process_decision', NEW_ID, body.reason),
      createdAt: at,
      updatedAt: at,
    };
    return processDecisionView(decision);
  });
}

// ---------------------------------------------------------------------------------------------------------
// Preferred bidders (BR-31, AC-24)
// ---------------------------------------------------------------------------------------------------------

function registerPreferredBidders(app: MockApp): void {
  function preferredFor(tenantId: number, id: number): FixturePreferredBidder | undefined {
    return PREFERRED_BIDDERS.find((row) => row.tenantId === tenantId && row.preferredBidderId === id);
  }

  mockRoute(app, E.listPreferredBidders, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = PREFERRED_BIDDERS.filter((row) => row.tenantId === tenant.id)
      .filter((row) => query.tenderId === undefined || row.tenderId === query.tenderId)
      .filter((row) => inList(query.status, row.status))
      .filter((row) => query.decisionOwnerUserId === undefined || row.decisionOwnerUserId === query.decisionOwnerUserId)
      .map(preferredRow)
      .filter((row) => matchesText(query.q, row.tender.reference, row.tender.title, row.bid.supplierName, row.scope));
    type Row = (typeof rows)[number];
    const keys = {
      tenderReference: (row: Row) => row.tender.reference,
      status: (row: Row) => row.status,
      updatedAt: (row: Row) => row.updatedAt,
    };
    return fixtures.page(sortRows(rows, query.sort === undefined ? keys.updatedAt : keys[query.sort], query.sort === undefined ? 'desc' : query.dir));
  });

  mockRoute(app, E.getPreferredBidder, ({ requireTenant, params, notFound }) => {
    const { tenant } = requireTenant();
    const preferred = preferredFor(tenant.id, params.preferredBidderId);
    return preferred === undefined ? notFound() : preferredDetail(preferred);
  });

  mockRoute(app, E.recommendPreferredBidder, ({ requireTenant, body, now, fail }) => {
    const { tenant } = requireTenant();
    const tender = assessmentTender(tenant.id, body.tenderId);
    if (tender === undefined) {
      return fail(409, 'TENDER_NOT_IN_ASSESSMENT', 'A preferred bidder is recommended only for an event under assessment.');
    }
    const lotId = body.lotId ?? null;
    const active = PREFERRED_BIDDERS.find(
      (row) =>
        row.tenantId === tenant.id &&
        row.tenderId === tender.tenderId &&
        row.lotId === lotId &&
        (row.status === 'proposed' || row.status === 'awaiting_approval' || row.status === 'approved'),
    );
    if (active !== undefined) {
      const activeName = bidOf(tenant.id, active.bidId)?.supplierName ?? 'Another bidder';
      return fail(409, 'PREFERRED_BIDDER_ACTIVE', `${activeName} is already the ${active.status.replace(/_/g, ' ')} preferred bidder for this scope.`);
    }
    const bid = bidOf(tenant.id, body.bidId);
    if (bid === undefined || bid.tenderId !== tender.tenderId || !isEligibleBid(bid) || (lotId !== null && bid.lotId !== lotId)) {
      return fail(409, 'BID_NOT_ELIGIBLE', 'The bid is not an eligible candidate for this scope.');
    }
    if (body.fallbackBidId !== null) {
      const fallback = bidOf(tenant.id, body.fallbackBidId);
      if (fallback === undefined || fallback.tenderId !== tender.tenderId || !isEligibleBid(fallback)) {
        return fail(409, 'FALLBACK_BID_NOT_ELIGIBLE', 'The fallback must be another eligible candidate of this event.');
      }
    }
    if (!isEligibleFor(tender, body.decisionOwnerUserId, 'decisionOwner')) {
      return fail(422, 'DECISION_OWNER_NOT_ELIGIBLE', 'The decision owner must be a member of the tender team who manages selection.');
    }
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const preferred: FixturePreferredBidder = {
      tenantId: tenant.id,
      preferredBidderId: NEW_ID,
      tenderId: tender.tenderId,
      lotId,
      bidId: bid.bidId,
      scope: body.scope,
      proposedValue: { ...body.proposedValue },
      rationale: body.rationale,
      remainingChecks: body.remainingChecks,
      negotiationTopics: [...body.negotiationTopics],
      decisionOwnerUserId: body.decisionOwnerUserId,
      contingencyPlan: body.contingencyPlan,
      fallbackBidId: body.fallbackBidId,
      status: 'proposed',
      statusReason: null,
      approval: null,
      fallbackProcessDecisionId: null,
      version: 1,
      contentHash: hashOf('preferred_bidder', NEW_ID, body.bidId, body.proposedValue.amount, body.scope),
      updatedAt: at,
    };
    return preferredDetail(preferred);
  });

  mockRoute(app, E.withdrawPreferredBidder, ({ requireTenant, params, body, now, fail, notFound }) => {
    const { tenant } = requireTenant();
    const preferred = preferredFor(tenant.id, params.preferredBidderId);
    if (preferred === undefined) {
      return notFound();
    }
    if (preferred.status !== 'proposed' && preferred.status !== 'awaiting_approval' && preferred.status !== 'approved') {
      return fail(409, 'PREFERRED_BIDDER_NOT_ACTIVE', `The preferred bidder is ${preferred.status.replace(/_/g, ' ')}.`);
    }
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    return preferredDetail({ ...preferred, status: 'withdrawn', statusReason: body.reason, updatedAt: at });
  });

  mockRoute(app, E.recordFallback, ({ requireTenant, requirePersona, params, body, now, fail, notFound }) => {
    const { tenant } = requireTenant();
    const preferred = preferredFor(tenant.id, params.preferredBidderId);
    if (preferred === undefined) {
      return notFound();
    }
    const blocker = firstBlocker(fallbackBlockers(preferred));
    if (blocker !== undefined) {
      return fail(409, blocker.code, blocker.message);
    }
    const fallback = bidOf(tenant.id, body.fallbackBidId);
    if (fallback === undefined || fallback.tenderId !== preferred.tenderId || fallback.bidId === preferred.bidId || !isEligibleBid(fallback)) {
      return fail(409, 'FALLBACK_BID_NOT_ELIGIBLE', 'The fallback must be another eligible candidate of this event.');
    }
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const decision: FixtureProcessDecision = {
      tenantId: tenant.id,
      processDecisionId: NEW_ID,
      tenderId: preferred.tenderId,
      lotId: preferred.lotId,
      decisionType: 'fallback_to_next_bidder',
      reason: body.reason,
      status: 'proposed',
      proposedBy: requirePersona().userId,
      decidedBy: null,
      approval: null,
      version: 1,
      contentHash: hashOf('process_decision', NEW_ID, body.reason),
      createdAt: at,
      updatedAt: at,
    };
    const detail = preferredDetail({ ...preferred, fallbackBidId: fallback.bidId, updatedAt: at });
    const view = processDecisionView(decision);
    return {
      processDecision: view,
      preferredBidder: {
        ...detail,
        fallbackBid: bidRef(fallback),
        processDecisions: [...detail.processDecisions, view],
        fallbackGate: {
          allowed: false,
          blockers: [{ code: 'FALLBACK_ALREADY_RECORDED', message: `Fallback decision ${NEW_ID} is recorded and awaits approval.` }],
        },
      },
    };
  });
}

// ---------------------------------------------------------------------------------------------------------
// Due diligence (AC-24)
// ---------------------------------------------------------------------------------------------------------

function registerDiligence(app: MockApp): void {
  function caseFor(tenantId: number, caseId: number): FixtureDiligenceCase | undefined {
    return DUE_DILIGENCE_CASES.find((row) => row.tenantId === tenantId && row.caseId === caseId);
  }

  mockRoute(app, E.listDiligenceCases, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = DUE_DILIGENCE_CASES.filter((row) => row.tenantId === tenant.id)
      .filter((row) => inList(query.status, row.status))
      .filter((row) => query.ownerUserId === undefined || row.ownerUserId === query.ownerUserId)
      .filter((row) => query.area === undefined || row.findings.some((finding) => inList(query.area, finding.area)))
      .map(diligenceRow)
      .filter((row) => query.tenderId === undefined || row.tender.tenderId === query.tenderId)
      .filter((row) => query.awardBlocking === undefined || (row.awardBlockingCount > 0) === query.awardBlocking)
      .filter((row) => matchesText(query.q, row.tender.reference, row.tender.title, row.bid.supplierName));
    type Row = (typeof rows)[number];
    const keys = {
      tenderReference: (row: Row) => row.tender.reference,
      status: (row: Row) => row.status,
      nextDueAt: (row: Row) => row.nextDueAt,
      updatedAt: (row: Row) => row.updatedAt,
    };
    return fixtures.page(sortRows(rows, query.sort === undefined ? keys.updatedAt : keys[query.sort], query.sort === undefined ? 'desc' : query.dir));
  });

  mockRoute(app, E.getDiligenceCase, ({ requireTenant, params, notFound }) => {
    const { tenant } = requireTenant();
    const diligence = caseFor(tenant.id, params.caseId);
    return diligence === undefined ? notFound() : diligenceDetail(diligence);
  });

  type FindingBody = {
    readonly area: FixtureDiligenceFinding['area'];
    readonly finding: string;
    readonly disposition: FixtureDiligenceFinding['disposition'];
    readonly ownerUserId?: number | null | undefined;
    readonly dueAt?: string | null | undefined;
    readonly evidenceDocumentId?: number | null | undefined;
    readonly isAwardBlocking: boolean;
  };

  function findingFrom(findingId: number, body: FindingBody, at: string): FixtureDiligenceFinding {
    return {
      findingId,
      area: body.area,
      finding: body.finding,
      disposition: body.disposition,
      ownerUserId: body.ownerUserId ?? null,
      dueAt: body.dueAt ?? null,
      evidenceDocumentId: body.evidenceDocumentId ?? null,
      evidenceTitle: null,
      isAwardBlocking: body.isAwardBlocking,
      updatedAt: at,
    };
  }

  mockRoute(app, E.recordDiligenceFinding, ({ requireTenant, params, body, now, fail, notFound }) => {
    const { tenant } = requireTenant();
    const diligence = caseFor(tenant.id, params.caseId);
    if (diligence === undefined) {
      return notFound();
    }
    if (diligence.status === 'passed' || diligence.status === 'failed') {
      return fail(409, 'CASE_DECIDED', `The case was decided as ${diligence.status}; findings can no longer be added.`);
    }
    const ownerUserId = body.ownerUserId ?? null;
    if (ownerUserId !== null && !isEligibleFindingOwner(diligence, ownerUserId)) {
      return fail(422, 'FINDING_OWNER_NOT_ELIGIBLE', 'The owner must be a member of the tender team who manages due diligence.');
    }
    return diligenceFindingView(findingFrom(NEW_ID, body, now.toISOString().replace(/\.\d{3}Z$/, 'Z')));
  });

  mockRoute(app, E.updateDiligenceFinding, ({ requireTenant, params, body, now, fail, notFound }) => {
    const { tenant } = requireTenant();
    const diligence = caseFor(tenant.id, params.caseId);
    const existing = diligence?.findings.find((row) => row.findingId === params.findingId);
    if (diligence === undefined || existing === undefined) {
      return notFound();
    }
    if (diligence.status === 'passed' || diligence.status === 'failed') {
      return fail(409, 'CASE_DECIDED', `The case was decided as ${diligence.status}; its findings are final.`);
    }
    const ownerUserId = body.ownerUserId ?? null;
    if (ownerUserId !== null && !isEligibleFindingOwner(diligence, ownerUserId)) {
      return fail(422, 'FINDING_OWNER_NOT_ELIGIBLE', 'The owner must be a member of the tender team who manages due diligence.');
    }
    const updated = findingFrom(existing.findingId, body, now.toISOString().replace(/\.\d{3}Z$/, 'Z'));
    return diligenceFindingView({ ...updated, evidenceTitle: updated.evidenceDocumentId === existing.evidenceDocumentId ? existing.evidenceTitle : null });
  });

  mockRoute(app, E.requestDiligenceEvidence, ({ requireTenant, params, body, now, fail, notFound }) => {
    const { tenant } = requireTenant();
    const diligence = caseFor(tenant.id, params.caseId);
    if (diligence === undefined) {
      return notFound();
    }
    if (diligence.status === 'passed' || diligence.status === 'failed') {
      return fail(409, 'CASE_DECIDED', `The case was decided as ${diligence.status}.`);
    }
    if (Date.parse(body.dueAt) <= now.getTime()) {
      return fail(422, 'DUE_DATE_IN_PAST', 'The response date must be in the future.');
    }
    return {
      clarificationId: NEW_ID,
      question: body.question,
      permittedScope: body.permittedScope,
      dueAt: body.dueAt,
      status: 'issued' as const,
      respondedAt: null,
    };
  });

  mockRoute(app, E.decideDiligenceCase, ({ requireTenant, requirePersona, params, body, now, fail, notFound }): DueDiligenceCaseDetail => {
    const { tenant } = requireTenant();
    const diligence = caseFor(tenant.id, params.caseId);
    if (diligence === undefined) {
      return notFound();
    }
    const blockers = diligencePassBlockers(diligence);
    const decided = blockers.find((row) => row.code === 'CASE_DECIDED');
    if (decided !== undefined) {
      return fail(409, decided.code, decided.message);
    }
    if (body.outcome === 'passed') {
      const blocker = firstBlocker(blockers);
      if (blocker !== undefined) {
        return fail(409, blocker.code, describe(blockers));
      }
    }
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const detail = diligenceDetail({
      ...diligence,
      status: body.outcome,
      decidedBy: requirePersona().userId,
      decidedAt: at,
      decisionNote: body.decisionNote,
      updatedAt: at,
    });
    const preferred = preferredOfCase(diligence);
    const tender = tenderOf(tenant.id, preferred.tenderId);
    const remaining = tender === undefined ? [] : awardBlockers(tender).filter((row) => row.code !== 'DILIGENCE_NOT_PASSED');
    const awardGateBlockers: SelectionBlocker[] =
      body.outcome === 'failed'
        ? [
            {
              code: 'DILIGENCE_FAILED',
              message: `${bidOf(tenant.id, preferred.bidId)?.supplierName ?? 'The bidder'} failed due diligence; no award can be made to this bidder.`,
            },
            {
              code: 'FALLBACK_DECISION_REQUIRED',
              message: 'Record the fallback decision under the declared contingency before approaching another bidder.',
            },
          ]
        : remaining;
    return {
      ...detail,
      preferredBidder: {
        preferredBidderId: preferred.preferredBidderId,
        status: body.outcome === 'failed' ? 'failed_diligence' : preferred.status,
      },
      passGate: { allowed: false, blockers: [{ code: 'CASE_DECIDED', message: `The case was decided as ${body.outcome}.` }] },
      awardGate: { allowed: awardGateBlockers.length === 0, blockers: awardGateBlockers },
    };
  });
}

// ---------------------------------------------------------------------------------------------------------
// Negotiations (BR-30, AC-23)
// ---------------------------------------------------------------------------------------------------------

function registerNegotiations(app: MockApp): void {
  function negotiationFor(tenantId: number, id: number): FixtureNegotiation | undefined {
    return NEGOTIATIONS.find((row) => row.tenantId === tenantId && row.negotiationId === id);
  }

  mockRoute(app, E.listNegotiations, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = NEGOTIATIONS.filter((row) => row.tenantId === tenant.id)
      .filter((row) => query.tenderId === undefined || row.tenderId === query.tenderId)
      .filter((row) => inList(query.status, row.status))
      .filter((row) => query.negotiatorUserId === undefined || row.authorizedNegotiatorIds.includes(query.negotiatorUserId))
      .map(negotiationRow)
      .filter((row) => matchesText(query.q, row.tender.reference, row.tender.title, row.bid.supplierName, ...row.allowedTopics));
    type Row = (typeof rows)[number];
    const keys = {
      tenderReference: (row: Row) => row.tender.reference,
      status: (row: Row) => row.status,
      lastMeetingAt: (row: Row) => row.lastMeetingAt,
      updatedAt: (row: Row) => row.updatedAt,
    };
    return fixtures.page(sortRows(rows, query.sort === undefined ? keys.updatedAt : keys[query.sort], query.sort === undefined ? 'desc' : query.dir));
  });

  mockRoute(app, E.getNegotiation, ({ requireTenant, params, notFound }) => {
    const { tenant } = requireTenant();
    const negotiation = negotiationFor(tenant.id, params.negotiationId);
    return negotiation === undefined ? notFound() : negotiationDetail(negotiation);
  });

  mockRoute(app, E.openNegotiation, ({ requireTenant, body, now, fail }): NegotiationDetail => {
    const { tenant } = requireTenant();
    const tender = assessmentTender(tenant.id, body.tenderId);
    if (tender === undefined) {
      return fail(409, 'TENDER_NOT_IN_ASSESSMENT', 'Negotiation is recorded only for events under assessment.');
    }
    const bid = bidOf(tenant.id, body.bidId);
    if (bid === undefined || bid.tenderId !== tender.tenderId) {
      return fail(409, 'BID_NOT_PREFERRED', 'The bid is not a candidate of this event.');
    }
    const blockers = negotiationBlockers(tender, bid);
    const blocker = firstBlocker(blockers);
    if (blocker !== undefined) {
      return fail(409, blocker.code, describe(blockers));
    }
    const outsider = body.authorizedNegotiatorIds.find((userId) => !isEligibleFor(tender, userId, 'negotiator'));
    if (outsider !== undefined) {
      return fail(422, 'NEGOTIATOR_NOT_ELIGIBLE', 'Every negotiator must be a member of the tender team who conducts negotiations.');
    }
    const existing = NEGOTIATIONS.find(
      (row) => row.tenantId === tenant.id && row.bidId === bid.bidId && row.status !== 'concluded' && row.status !== 'aborted',
    );
    if (existing !== undefined) {
      return fail(409, 'NEGOTIATION_EXISTS', `A negotiation with this bidder is already ${existing.status.replace(/_/g, ' ')}.`);
    }
    const preferred = approvedPreferredOf(tender);
    if (preferred !== undefined && gt(body.commercialAuthority.amount, preferred.proposedValue.amount)) {
      return fail(
        422,
        'AUTHORITY_EXCEEDS_PROPOSED_VALUE',
        'The commercial authority cannot exceed the approved preferred-bidder value; a higher value needs a new approval.',
      );
    }
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const authority: Money = { ...body.commercialAuthority };
    return negotiationDetail({
      tenantId: tenant.id,
      negotiationId: NEW_ID,
      tenderId: tender.tenderId,
      lotId: body.lotId ?? null,
      bidId: bid.bidId,
      supplierTenantId: bid.supplierTenantId,
      allowedTopics: [...body.allowedTopics],
      authorizedNegotiatorIds: [...body.authorizedNegotiatorIds],
      commercialAuthority: authority,
      status: 'awaiting_mandate',
      approval: null,
      outcomeSummary: null,
      affectsCompetitionBasis: false,
      processDecisionId: null,
      version: 1,
      contentHash: hashOf('negotiation_mandate', NEW_ID, bid.bidId, authority.amount, body.allowedTopics.join(',')),
      rounds: [],
      updatedAt: at,
    });
  });

  mockRoute(app, E.recordNegotiationRound, ({ requireTenant, requirePersona, params, body, fail, notFound }) => {
    const { tenant } = requireTenant();
    const negotiation = negotiationFor(tenant.id, params.negotiationId);
    if (negotiation === undefined) {
      return notFound();
    }
    const blockers = negotiationRoundBlockers(negotiation);
    const ordered = [
      ...blockers.filter((row) => row.code === 'NEGOTIATION_NOT_ACTIVE'),
      ...blockers.filter((row) => row.code === 'MANDATE_NOT_APPROVED'),
      ...blockers.filter((row) => row.code !== 'NEGOTIATION_NOT_ACTIVE' && row.code !== 'MANDATE_NOT_APPROVED'),
    ];
    const blocker = firstBlocker(ordered);
    if (blocker !== undefined) {
      const code = blocker.code === 'NEGOTIATION_NOT_ACTIVE' || blocker.code === 'MANDATE_NOT_APPROVED' ? blocker.code : 'NEGOTIATION_NOT_ACTIVE';
      return fail(409, code, describe(ordered));
    }
    const outside = body.topics.filter((topic) => !negotiation.allowedTopics.includes(topic));
    if (outside.length > 0) {
      return fail(422, 'TOPIC_NOT_AUTHORIZED', `Not in the approved mandate: ${outside.join(', ')}.`);
    }
    if (!negotiation.authorizedNegotiatorIds.includes(requirePersona().userId)) {
      return fail(403, 'NEGOTIATOR_NOT_AUTHORIZED', 'Only the negotiators named in the approved mandate may record rounds.');
    }
    return {
      roundId: NEW_ID,
      roundNo: negotiation.rounds.length + 1,
      meetingAt: body.meetingAt,
      participants: body.participants,
      topics: [...body.topics],
      minutes: body.minutes,
      buyerProposal: body.buyerProposal ?? null,
      supplierProposal: body.supplierProposal ?? null,
      concessions: body.concessions ?? null,
      unresolvedIssues: body.unresolvedIssues ?? null,
      supplierResponseAt: null,
      supplierVisible: body.supplierVisible,
    };
  });

  mockRoute(app, E.concludeNegotiation, ({ requireTenant, params, body, now, fail, notFound }) => {
    const { tenant } = requireTenant();
    const negotiation = negotiationFor(tenant.id, params.negotiationId);
    if (negotiation === undefined) {
      return notFound();
    }
    if (negotiation.status !== 'active') {
      return fail(409, 'NEGOTIATION_NOT_ACTIVE', `The negotiation is ${negotiation.status.replace(/_/g, ' ')}.`);
    }
    const decision = PROCESS_DECISIONS.find((row) => row.tenantId === tenant.id && row.processDecisionId === negotiation.processDecisionId);
    if (body.affectsCompetitionBasis && decision?.status !== 'approved') {
      return fail(
        409,
        'PROCESS_DECISION_REQUIRED',
        'The outcome changes the basis of competition; an approved process decision (which may require a new competition) is needed first.',
      );
    }
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    return negotiationDetail({
      ...negotiation,
      status: 'concluded',
      outcomeSummary: body.outcomeSummary,
      affectsCompetitionBasis: body.affectsCompetitionBasis,
      updatedAt: at,
    });
  });
}

// ---------------------------------------------------------------------------------------------------------
// Final-offer rounds (AC-23)
// ---------------------------------------------------------------------------------------------------------

function registerFinalOffers(app: MockApp): void {
  mockRoute(app, E.listFinalOfferRounds, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = FINAL_OFFER_ROUNDS.filter((row) => row.tenantId === tenant.id)
      .filter((row) => query.tenderId === undefined || row.tenderId === query.tenderId)
      .filter((row) => inList(query.status, row.status))
      .filter((row) => matchesText(query.q, row.instructions, row.proceduralAuthorityRef))
      .map(finalOfferRow);
    type Row = (typeof rows)[number];
    const keys = {
      tenderReference: (row: Row) => row.tender.reference,
      status: (row: Row) => row.status,
      deadline: (row: Row) => row.deadline?.at ?? null,
      updatedAt: (row: Row) => row.updatedAt,
    };
    return fixtures.page(sortRows(rows, query.sort === undefined ? keys.updatedAt : keys[query.sort], query.sort === undefined ? 'desc' : query.dir));
  });

  mockRoute(app, E.getFinalOfferRound, ({ requireTenant, params, now, notFound }) => {
    const { tenant } = requireTenant();
    const round = FINAL_OFFER_ROUNDS.find((row) => row.tenantId === tenant.id && row.roundId === params.roundId);
    return round === undefined ? notFound() : finalOfferDetail(round, now);
  });

  mockRoute(app, E.createFinalOfferRound, ({ requireTenant, body, now, fail }) => {
    const { tenant } = requireTenant();
    const tender = assessmentTender(tenant.id, body.tenderId);
    if (tender === undefined) {
      return fail(409, 'TENDER_NOT_IN_ASSESSMENT', 'Final-offer rounds are requested only for events under assessment.');
    }
    const blockers = finalOfferBlockers(tender);
    const blocker = firstBlocker(blockers);
    if (blocker !== undefined) {
      return fail(409, blocker.code, describe(blockers));
    }
    const bids = body.inviteeBidIds.map((bidId) => bidOf(tenant.id, bidId));
    if (bids.some((bid) => bid === undefined || bid.tenderId !== tender.tenderId || !isEligibleBid(bid))) {
      return fail(409, 'INVITEE_NOT_ELIGIBLE', 'Every invitee must be an eligible candidate of this event.');
    }
    if (Date.parse(body.deadline) <= now.getTime()) {
      return fail(422, 'DEADLINE_IN_PAST', 'The submission deadline must be in the future.');
    }
    const open = FINAL_OFFER_ROUNDS.find((row) => row.tenantId === tenant.id && row.tenderId === tender.tenderId && row.status === 'issued');
    if (open !== undefined) {
      return fail(409, 'FINAL_OFFER_ROUND_OPEN', 'An issued final-offer round on this event is still open.');
    }
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    return finalOfferDetail(
      {
        tenantId: tenant.id,
        roundId: NEW_ID,
        tenderId: tender.tenderId,
        lotId: body.lotId ?? null,
        instructions: body.instructions,
        permittedChanges: body.permittedChanges,
        deadline: body.deadline,
        openingRules: body.openingRules,
        evaluationTreatment: body.evaluationTreatment,
        proceduralAuthorityRef: body.proceduralAuthorityRef,
        status: 'draft',
        approval: null,
        version: 1,
        contentHash: hashOf('final_offer_round', NEW_ID, body.instructions, body.deadline),
        invitees: bids.flatMap((bid) =>
          bid === undefined
            ? []
            : [
                {
                  bidId: bid.bidId,
                  supplierTenantId: bid.supplierTenantId,
                  responseBidId: null,
                  notifiedAt: null,
                  finalOfferReceivedAt: null,
                  finalOffer: null,
                },
              ],
        ),
        updatedAt: at,
      },
      now,
    );
  });

  mockRoute(app, E.issueFinalOfferRound, ({ requireTenant, params, now, fail, notFound }) => {
    const { tenant } = requireTenant();
    const round = FINAL_OFFER_ROUNDS.find((row) => row.tenantId === tenant.id && row.roundId === params.roundId);
    if (round === undefined) {
      return notFound();
    }
    const blockers = finalOfferIssueBlockers(round, now);
    const blocker = firstBlocker(blockers);
    if (blocker !== undefined) {
      return fail(409, blocker.code, describe(blockers));
    }
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    return finalOfferDetail(
      { ...round, status: 'issued', invitees: round.invitees.map((row) => ({ ...row, notifiedAt: at })), updatedAt: at },
      now,
    );
  });

  mockRoute(app, E.cancelFinalOfferRound, ({ requireTenant, params, body, now, fail, notFound }) => {
    const { tenant } = requireTenant();
    const round = FINAL_OFFER_ROUNDS.find((row) => row.tenantId === tenant.id && row.roundId === params.roundId);
    if (round === undefined) {
      return notFound();
    }
    if (round.status !== 'draft' && round.status !== 'awaiting_approval' && round.status !== 'issued') {
      return fail(409, 'ROUND_NOT_CANCELLABLE', `The round is ${round.status}; it can no longer be cancelled.`);
    }
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    return finalOfferDetail(
      { ...round, status: 'cancelled', proceduralAuthorityRef: `${round.proceduralAuthorityRef} (cancelled: ${body.reason})`, updatedAt: at },
      now,
    );
  });
}

// ---------------------------------------------------------------------------------------------------------
// Supplier (SUP-18, SUP-19)
// ---------------------------------------------------------------------------------------------------------

function registerSupplier(app: MockApp): void {
  mockRoute(app, E.listSupplierInvites, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = ASSESSMENT_INVITES.filter((row) => row.supplierTenantId === tenant.id)
      .map(supplierInviteView)
      .filter((row) => inList(query.status, row.status))
      .filter((row) => query.tenderId === undefined || row.tender.tenderId === query.tenderId)
      .filter((row) => matchesText(query.q, row.tender.reference, row.tender.title, row.purpose, row.buyer.name));
    type Row = (typeof rows)[number];
    const keys = {
      scheduledAt: (row: Row) => row.scheduledAt,
      invitedAt: (row: Row) => row.invitedAt,
      status: (row: Row) => row.status,
    };
    return fixtures.page(sortRows(rows, query.sort === undefined ? keys.invitedAt : keys[query.sort], query.sort === undefined ? 'desc' : query.dir));
  });

  mockRoute(app, E.respondToInvite, ({ requireTenant, requirePersona, params, body, now, fail, notFound }) => {
    const { tenant } = requireTenant();
    const invite = ASSESSMENT_INVITES.find((row) => row.supplierTenantId === tenant.id && row.inviteId === params.inviteId);
    if (invite === undefined) {
      return notFound();
    }
    const blocker = firstBlocker(supplierInviteBlockers(invite, sessionOfInvite(invite)));
    if (blocker !== undefined) {
      return fail(409, blocker.code, blocker.message);
    }
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const view = supplierInviteView({ ...invite, status: body.response, supplierConfirmedAt: at, supplierConfirmedBy: requirePersona().userId });
    return {
      ...view,
      respondGate: { allowed: false, blockers: [{ code: 'INVITE_NOT_OPEN', message: 'Your organization has responded to this invitation.' }] },
    };
  });

  function supplierNegotiation(tenantId: number, negotiationId: number): FixtureNegotiation | undefined {
    return NEGOTIATIONS.find(
      (row) => row.supplierTenantId === tenantId && row.negotiationId === negotiationId && isSupplierVisibleNegotiation(row),
    );
  }

  mockRoute(app, E.listSupplierNegotiations, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = NEGOTIATIONS.filter((row) => row.supplierTenantId === tenant.id && isSupplierVisibleNegotiation(row))
      .map(supplierNegotiationRow)
      .filter((row) => inList(query.status, row.status))
      .filter((row) => query.awaitingResponse === undefined || row.awaitingResponse === query.awaitingResponse)
      .filter((row) => matchesText(query.q, row.tender.reference, row.tender.title, row.buyer.name));
    type Row = (typeof rows)[number];
    const keys = {
      updatedAt: (row: Row) => row.updatedAt,
      lastMeetingAt: (row: Row) => row.lastMeetingAt,
      status: (row: Row) => row.status,
    };
    return fixtures.page(sortRows(rows, query.sort === undefined ? keys.updatedAt : keys[query.sort], query.sort === undefined ? 'desc' : query.dir));
  });

  mockRoute(app, E.getSupplierNegotiation, ({ requireTenant, params, notFound }) => {
    const { tenant } = requireTenant();
    const negotiation = supplierNegotiation(tenant.id, params.negotiationId);
    return negotiation === undefined ? notFound() : supplierNegotiationDetail(negotiation);
  });

  mockRoute(app, E.respondToRound, ({ requireTenant, params, body, now, fail, notFound }) => {
    const { tenant } = requireTenant();
    const negotiation = supplierNegotiation(tenant.id, params.negotiationId);
    const round = negotiation === undefined ? undefined : supplierRoundOf(negotiation, params.roundId);
    if (negotiation === undefined || round === undefined) {
      return notFound();
    }
    if (negotiation.status !== 'active') {
      return fail(409, 'NEGOTIATION_NOT_ACTIVE', `The negotiation is ${negotiation.status}.`);
    }
    if (!supplierRoundView(round, negotiation).awaitingResponse) {
      return fail(409, 'ROUND_NOT_AWAITING_RESPONSE', 'This round is not awaiting a response from your organization.');
    }
    const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    return supplierRoundView(
      { ...round, supplierProposal: body.supplierProposal, concessions: body.concessions ?? round.concessions, supplierResponseAt: at },
      negotiation,
    );
  });

  mockRoute(app, E.listSupplierFinalOffers, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = FINAL_OFFER_ROUNDS.filter((row) => isSupplierVisibleRound(row, tenant.id))
      .map((row) => supplierFinalOfferView(row, tenant.id))
      .filter((row) => inList(query.status, row.status))
      .filter((row) => matchesText(query.q, row.tender.reference, row.tender.title, row.buyer.name));
    type Row = (typeof rows)[number];
    const keys = { deadline: (row: Row) => row.deadline?.at ?? null, status: (row: Row) => row.status };
    return fixtures.page(sortRows(rows, query.sort === undefined ? keys.deadline : keys[query.sort], query.dir));
  });

  mockRoute(app, E.getSupplierFinalOffer, ({ requireTenant, params, notFound }) => {
    const { tenant } = requireTenant();
    const round = FINAL_OFFER_ROUNDS.find((row) => row.roundId === params.roundId && isSupplierVisibleRound(row, tenant.id));
    return round === undefined ? notFound() : supplierFinalOfferView(round, tenant.id);
  });
}

