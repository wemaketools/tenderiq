/**
 * Supplier routes of the bids contract (SUP-12..SUP-17). A supplier sees only its own responses: another supplier's
 * bid is simply not found. Commands validate against the fixture state and return a static, contract-valid outcome;
 * nothing is persisted (architecture-plan §3.11).
 */
import type {
  AnswerPage,
  BidAnswerDetail,
  BidDeclarations,
  BidDetail,
  BidRevision,
  InternalReview,
  Receipt,
  ReceiptDownload,
  SaveAnswerResult,
  SaveDeclarationsResult,
  SubmissionResult,
  SupplierReceiptRow,
  WithdrawalResult,
} from '../../../contracts/bids.js';
import { bidEndpoints } from '../../../contracts/bids.js';
import type { BidAnswersProgress } from '../../../contracts/enums.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import { mockRoute } from '../../app.js';
import type { MockApp, MockHandlerContext } from '../../app.js';
import {
  BIDS,
  BID_ANSWERS,
  BID_ANSWER_ATTACHMENTS,
  BID_EVIDENCE,
  BID_EVIDENCE_ITEMS,
  BID_INTERNAL_APPROVALS,
  BID_REQUIREMENTS,
  BID_REVISIONS,
  BID_TENDERS,
  BID_WITHDRAWALS,
  RELEASED_TENDER_STATUSES,
  SUBMISSION_RECEIPTS,
  fixtureHash,
  requirementsForLots,
} from '../../fixtures/bids/index.js';
import type { FixtureAnswer, FixtureBid, FixtureBidTender, FixtureInternalApproval, FixtureRevision } from '../../fixtures/bids/index.js';
import type { TenantAccess } from '../../persona.js';
import { personRef } from '../../persona.js';
import { buildPricing, fixturePrices, pricingOf, tenderPricingItems } from './pricing.js';
import type { PriceInput } from './pricing.js';
import {
  answerOf,
  answerRowsOf,
  attachmentsOf,
  commentsOf,
  declarationsPackOf,
  lotRefs,
  progressOf,
  sectionsOf,
  tenderRef,
  toAnswerDetail,
  toAnswerRow,
  toAttachment,
  toAttempt,
  toBidDetail,
  toBidSummary,
  toReceipt,
  toReceiptSummary,
  toRevision,
  toWithdrawal,
} from './project.js';
import { internalReviewOf, readinessOf, submissionPreviewOf } from './readiness.js';
import {
  attemptsOf,
  currentRound,
  defaultRevision,
  effectiveReceipt,
  isEditable,
  isoOf,
  legalNameOf,
  receiptsOf,
  requireTender,
  revisionsOf,
  supplierBid,
  supplierTeam,
  windowOpen,
  withdrawalsOf,
  workingRevision,
} from './state.js';
import { formatOfficialInstant } from './time.js';

// Minimal context surface used by the helpers below.
interface Ctx {
  requireTenant(): TenantAccess;
  fail(status: number, code: string, detail?: string): never;
}

/** First id handed out by a static command (fixture ids stay below it). */
const COMMAND_ID = 900;

function compare(a: string | number, b: string | number): number {
  return typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b));
}

function sortRows<T>(rows: T[], key: (row: T) => string | number, dir: 'asc' | 'desc'): T[] {
  const sign = dir === 'desc' ? -1 : 1;
  return rows.sort((a, b) => sign * compare(key(a), key(b)));
}

function matches(q: string | undefined, ...values: Array<string | null | undefined>): boolean {
  if (q === undefined || q === '') {
    return true;
  }
  const needle = q.toLowerCase();
  return values.some((value) => value !== null && value !== undefined && value.toLowerCase().includes(needle));
}

function ownBid(ctx: Ctx, bidId: number): { bid: FixtureBid; tender: FixtureBidTender; access: TenantAccess } {
  const access = ctx.requireTenant();
  const bid = supplierBid(access.tenant.id, bidId);
  if (bid === undefined) {
    return ctx.fail(404, 'BID_NOT_FOUND', 'No response with this id exists in your organization.');
  }
  return { bid, tender: requireTender(bid), access };
}

function revisionOf(ctx: Ctx, bid: FixtureBid, revisionId: number | undefined): FixtureRevision {
  if (revisionId !== undefined) {
    const revision = BID_REVISIONS.find((row) => row.id === revisionId && row.bidId === bid.id);
    if (revision === undefined) {
      return ctx.fail(404, 'REVISION_NOT_FOUND', 'This revision does not belong to the response.');
    }
    return revision;
  }
  const revision = defaultRevision(bid);
  if (revision === null) {
    return ctx.fail(404, 'REVISION_NOT_FOUND', 'The response has no revision yet.');
  }
  return revision;
}

/** The revision a command edits: it must belong to the bid and still be editable. */
function editableRevision(ctx: Ctx, bid: FixtureBid, tender: FixtureBidTender, revisionId: number, now: Date): FixtureRevision {
  const revision = revisionOf(ctx, bid, revisionId);
  if (!isEditable(revision, bid, tender, now)) {
    return ctx.fail(
      409,
      'REVISION_NOT_EDITABLE',
      windowOpen(tender, bid.roundType, now)
        ? `Revision ${revision.revisionNo} is ${revision.status.replace('_', ' ')} and can no longer be edited; prepare a replacement instead.`
        : 'The submission deadline has passed: the response can no longer be edited.',
    );
  }
  return revision;
}

function requirementOf(ctx: Ctx, tender: FixtureBidTender, requirementId: number) {
  const requirement = BID_REQUIREMENTS.find((row) => row.id === requirementId && row.tenderId === tender.id);
  if (requirement === undefined) {
    return ctx.fail(404, 'REQUIREMENT_NOT_FOUND', 'This requirement is not part of the tender.');
  }
  return requirement;
}

/** Approvals of the revision that a content change invalidates (BR-10). */
function invalidatedBy(revision: FixtureRevision): number[] {
  return BID_INTERNAL_APPROVALS.filter(
    (row) => row.revisionId === revision.id && (row.status === 'pending' || (row.status === 'approved' && row.contentHashAtDecision === revision.contentHash)),
  ).map((row) => row.id);
}

function nextHash(revision: FixtureRevision, now: Date): string {
  return fixtureHash(`${revision.contentHash}:${now.toISOString()}`);
}

/** A contributor (without `supplier.pursuit.manage`) may only change answers assigned to them (AC-03). */
function assertAssigned(ctx: Ctx, access: TenantAccess, userId: number, answer: FixtureAnswer | undefined): void {
  if (access.permissions.includes('supplier.pursuit.manage')) {
    return;
  }
  if (answer?.assignedUserId !== userId) {
    return ctx.fail(403, 'ANSWER_NOT_ASSIGNED', 'This answer is assigned to another team member. Ask the bid manager to reassign it.');
  }
}

function capacityOf(access: TenantAccess): string {
  return access.capacity ?? 'Member';
}

function nextReceiptNo(buyerTenantId: number): string {
  const numbers = SUBMISSION_RECEIPTS.filter((row) => row.buyerTenantId === buyerTenantId).map((row) => Number(row.receiptNo.slice(-6)));
  return `RCPT-2026-${String(Math.max(0, ...numbers) + 1).padStart(6, '0')}`;
}

function answerSaveResult(
  tender: FixtureBidTender,
  requirement: (typeof BID_REQUIREMENTS)[number],
  revision: FixtureRevision,
  patch: Partial<FixtureAnswer>,
  attachments: BidAnswerDetail['attachments'],
  now: Date,
): SaveAnswerResult {
  const current = answerOf(revision.id, requirement.id);
  const base: FixtureAnswer = current ?? {
    id: COMMAND_ID,
    revisionId: revision.id,
    requirementId: requirement.id,
    answerText: null,
    answerNumber: null,
    answerChoice: null,
    answerBool: null,
    isDeviation: false,
    deviationNote: null,
    assignedUserId: null,
    dueAt: null,
    progress: 'not_started',
    reuse: null,
    updatedBy: null,
    updatedAt: null,
  };
  const updated: FixtureAnswer = { ...base, ...patch };
  const row = toAnswerRow(tender, requirement, updated, revision.id);
  return {
    answer: {
      ...row,
      documentCount: attachments.length,
      revisionId: revision.id,
      revisionNo: revision.revisionNo,
      editable: true,
      attachments,
      comments: commentsOf(revision.id, requirement.id),
    },
    contentHash: nextHash(revision, now),
    invalidatedApprovalIds: invalidatedBy(revision),
  };
}

function declarationsResult(pack: BidDeclarations, revision: FixtureRevision, now: Date): SaveDeclarationsResult {
  return { declarations: pack, contentHash: nextHash(revision, now), invalidatedApprovalIds: invalidatedBy(revision) };
}

function revisionMap(bid: FixtureBid): Map<number, FixtureRevision> {
  return new Map(revisionsOf(bid.id).map((row) => [row.id, row]));
}

function reviewWith(
  bid: FixtureBid,
  tender: FixtureBidTender,
  revision: FixtureRevision,
  permissions: readonly PermissionCode[],
  now: Date,
  approvals: readonly FixtureInternalApproval[],
): InternalReview {
  return internalReviewOf(bid, tender, revision, revisionMap(bid), permissions, now, approvals);
}

// ---------------------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------------------

export function registerSupplierRoutes(app: MockApp): void {
  // ---- list and workspace -------------------------------------------------------------------------------

  mockRoute(app, bidEndpoints.listBids, ({ requireTenant, requirePersona, query, fixtures }) => {
    const { tenant } = requireTenant();
    const persona = requirePersona();
    const rows = BIDS.filter((bid) => bid.supplierTenantId === tenant.id)
      .filter((bid) => {
        const tender = requireTender(bid);
        const working = workingRevision(bid);
        const latest = revisionsOf(bid.id).at(-1);
        const revisionStatus = working?.status ?? latest?.status;
        const deadline = tender.rounds.find((round) => round.roundType === bid.roundType)?.deadline ?? '';
        if (!matches(query.q, tender.reference, tender.title, legalNameOf(tender.buyerTenantId))) return false;
        if (query.submissionState !== undefined && !query.submissionState.includes(bid.submissionState)) return false;
        if (query.revisionStatus !== undefined && (revisionStatus === undefined || !query.revisionStatus.includes(revisionStatus))) return false;
        if (query.roundType !== undefined && !query.roundType.includes(bid.roundType)) return false;
        if (query.tenderStatus !== undefined && !query.tenderStatus.includes(tender.status)) return false;
        if (query.tenderId !== undefined && tender.id !== query.tenderId) return false;
        if (query.buyerTenantId !== undefined && tender.buyerTenantId !== query.buyerTenantId) return false;
        if (query.bidManagerUserId !== undefined && bid.bidManagerUserId !== query.bidManagerUserId) return false;
        if (query.deadlineFrom !== undefined && deadline < query.deadlineFrom) return false;
        if (query.deadlineTo !== undefined && deadline > query.deadlineTo) return false;
        if (query.assignedToMe === true) {
          const shown = defaultRevision(bid);
          if (shown === null || !BID_ANSWERS.some((answer) => answer.revisionId === shown.id && answer.assignedUserId === persona.userId)) {
            return false;
          }
        }
        return true;
      })
      .map(toBidSummary);
    const sort = query.sort ?? 'updatedAt';
    const dir = query.sort === undefined ? 'desc' : query.dir;
    const key = (row: (typeof rows)[number]): string =>
      sort === 'deadline' ? row.deadline.at : sort === 'reference' ? row.tender.reference : sort === 'submissionState' ? row.submissionState : row.updatedAt;
    return fixtures.page(sortRows(rows, key, dir));
  });

  mockRoute(app, bidEndpoints.startBid, ({ requireTenant, requirePersona, body, fail, now }) => {
    const access = requireTenant();
    const persona = requirePersona();
    const tender = BID_TENDERS.find((row) => row.id === body.tenderId);
    const visible =
      tender !== undefined &&
      RELEASED_TENDER_STATUSES.includes(tender.status) &&
      (tender.invitedSupplierTenantIds === null || tender.invitedSupplierTenantIds.includes(access.tenant.id));
    if (!visible) {
      return fail(404, 'TENDER_NOT_FOUND', 'No tender with this id is available to your organization.');
    }
    if (body.isAlternative && !tender.alternativesAllowed) {
      return fail(422, 'ALTERNATIVES_NOT_ALLOWED', 'This tender does not accept alternative offers.');
    }
    if (tender.status !== 'open') {
      return fail(409, 'TENDER_NOT_OPEN', `${tender.reference} is not open for responses.`);
    }
    if (currentRound(tender) !== body.roundType) {
      return fail(409, 'ROUND_NOT_OPEN', `The ${body.roundType.replace('_', ' ')} round of ${tender.reference} is not open.`);
    }
    if (!windowOpen(tender, body.roundType, now)) {
      return fail(409, 'TENDER_NOT_OPEN', `The submission deadline of ${tender.reference} has passed.`);
    }
    const existing = BIDS.find(
      (row) =>
        row.supplierTenantId === access.tenant.id &&
        row.tenderId === tender.id &&
        row.roundType === body.roundType &&
        row.isAlternative === body.isAlternative,
    );
    if (existing !== undefined) {
      return fail(409, 'BID_ALREADY_EXISTS', `Your organization already has a response workspace for ${tender.reference}.`);
    }
    const bid: FixtureBid = {
      id: COMMAND_ID,
      supplierTenantId: access.tenant.id,
      buyerTenantId: tender.buyerTenantId,
      tenderId: tender.id,
      roundType: body.roundType,
      lotIds: tender.lots.length === 1 ? tender.lots.map((lot) => lot.id) : [],
      isAlternative: body.isAlternative,
      isConsortium: false,
      leadMemberName: null,
      submissionState: 'not_submitted',
      bidManagerUserId: persona.userId,
      createdAt: isoOf(now),
    };
    const detail: BidDetail = toBidDetail(bid, access.permissions, now);
    const rows = requirementsForLots(tender.id, bid.lotIds).map((requirement) => toAnswerRow(tender, requirement, undefined, 0));
    return {
      ...detail,
      workingRevision: { id: COMMAND_ID * 10 + 1, revisionNo: 1, status: 'draft' },
      progress: progressOf(rows),
      sections: sectionsOf(rows),
      updatedAt: isoOf(now),
    };
  });

  mockRoute(app, bidEndpoints.getBid, (ctx) => {
    const { bid, access } = ownBid(ctx, ctx.params.bidId);
    return toBidDetail(bid, access.permissions, ctx.now);
  });

  mockRoute(app, bidEndpoints.updateBidLots, (ctx) => {
    const { bid, tender, access } = ownBid(ctx, ctx.params.bidId);
    editableRevision(ctx, bid, tender, ctx.body.revisionId, ctx.now);
    const lotIds = [...new Set(ctx.body.lotIds)];
    for (const lotId of lotIds) {
      const lot = tender.lots.find((row) => row.id === lotId);
      if (lot === undefined || lot.stage === 'cancelled' || lot.stage === 'no_award' || lot.stage === 'draft') {
        return ctx.fail(422, 'LOT_NOT_ELIGIBLE', 'One of the selected lots is not part of the tender or cannot be offered.');
      }
    }
    if (tender.maxLotsPerSupplier !== null && lotIds.length > tender.maxLotsPerSupplier) {
      return ctx.fail(422, 'MAX_LOTS_EXCEEDED', `A supplier may offer at most ${tender.maxLotsPerSupplier} lots.`);
    }
    if (!tender.partialBidsAllowed && lotIds.length !== tender.lots.length) {
      return ctx.fail(422, 'PARTIAL_BIDS_NOT_ALLOWED', 'This tender requires an offer for every lot.');
    }
    const updated: FixtureBid = { ...bid, lotIds };
    const detail = toBidDetail(updated, access.permissions, ctx.now);
    return { ...detail, lots: lotRefs(tender, lotIds), updatedAt: isoOf(ctx.now) };
  });

  // ---- answers --------------------------------------------------------------------------------------------

  mockRoute(app, bidEndpoints.listAnswers, (ctx) => {
    const { bid, tender } = ownBid(ctx, ctx.params.bidId);
    const { query } = ctx;
    const persona = ctx.requirePersona();
    const revision = revisionOf(ctx, bid, query.revisionId);
    const all = answerRowsOf(bid, tender, revision);
    const rows = all.filter((row) => {
      if (!matches(query.q, row.refCode, row.text, row.answerText)) return false;
      if (query.section !== undefined && row.section !== query.section) return false;
      if (query.lotId !== undefined && row.lot?.lotId !== query.lotId) return false;
      if (query.envelope !== undefined && !query.envelope.includes(row.envelope)) return false;
      if (query.progress !== undefined && !query.progress.includes(row.progress)) return false;
      if (query.treatment !== undefined && !query.treatment.includes(row.treatment)) return false;
      if (query.assignedUserId !== undefined && row.assignedUser?.userId !== query.assignedUserId) return false;
      if (query.assignedToMe === true && row.assignedUser?.userId !== persona.userId) return false;
      if (query.deviationsOnly === true && !row.isDeviation) return false;
      if (query.reuseToReview === true && (row.reuse === null || row.reuse.reviewedAt !== null)) return false;
      if (query.dueFrom !== undefined && (row.dueAt === null || row.dueAt < query.dueFrom)) return false;
      if (query.dueTo !== undefined && (row.dueAt === null || row.dueAt > query.dueTo)) return false;
      return true;
    });
    const progressRank: Record<BidAnswersProgress, number> = { not_started: 0, in_progress: 1, ready_for_review: 2, complete: 3 };
    const sort = query.sort;
    const sorted =
      sort === undefined
        ? rows
        : sortRows(
            rows,
            (row) =>
              sort === 'progress'
                ? progressRank[row.progress]
                : sort === 'section'
                  ? row.section
                  : sort === 'dueAt'
                    ? (row.dueAt ?? '9999')
                    : sort === 'updatedAt'
                      ? (row.updatedAt ?? '')
                      : row.refCode,
            query.dir,
          );
    const page = ctx.fixtures.page(sorted);
    const result: AnswerPage = {
      ...page,
      revisionId: revision.id,
      revisionNo: revision.revisionNo,
      revisionStatus: revision.status,
      editable: isEditable(revision, bid, tender, ctx.now),
      sections: sectionsOf(all),
    };
    return result;
  });

  mockRoute(app, bidEndpoints.getAnswer, (ctx) => {
    const { bid, tender } = ownBid(ctx, ctx.params.bidId);
    const revision = revisionOf(ctx, bid, ctx.query.revisionId);
    const requirement = requirementOf(ctx, tender, ctx.params.requirementId);
    if (requirement.lotId !== null && !bid.lotIds.includes(requirement.lotId)) {
      return ctx.fail(404, 'REQUIREMENT_NOT_FOUND', 'This requirement belongs to a lot the response does not offer.');
    }
    return toAnswerDetail(tender, requirement, revision, isEditable(revision, bid, tender, ctx.now));
  });

  mockRoute(app, bidEndpoints.saveAnswer, (ctx) => {
    const { bid, tender, access } = ownBid(ctx, ctx.params.bidId);
    const persona = ctx.requirePersona();
    const { body } = ctx;
    const revision = editableRevision(ctx, bid, tender, body.revisionId, ctx.now);
    const requirement = requirementOf(ctx, tender, ctx.params.requirementId);
    if (requirement.lotId !== null && !bid.lotIds.includes(requirement.lotId)) {
      return ctx.fail(409, 'REQUIREMENT_LOT_NOT_SELECTED', 'Select the lot before answering its requirements.');
    }
    const current = answerOf(revision.id, requirement.id);
    assertAssigned(ctx, access, persona.userId, current);
    const type = requirement.responseType;
    const given = (value: unknown): boolean => value !== undefined && value !== null;
    const mismatch =
      (given(body.answerNumber) && type !== 'number' && type !== 'quantity') ||
      (given(body.answerChoice) && type !== 'choice') ||
      (given(body.answerBool) && type !== 'yes_no');
    if (mismatch) {
      return ctx.fail(422, 'ANSWER_TYPE_MISMATCH', `This requirement expects a ${type.replace('_', '/')} answer.`);
    }
    if (given(body.answerChoice) && !requirement.choices.includes(body.answerChoice as string)) {
      return ctx.fail(422, 'CHOICE_NOT_ALLOWED', `Choose one of: ${requirement.choices.join(', ')}.`);
    }
    const patch: { -readonly [K in keyof FixtureAnswer]?: FixtureAnswer[K] } = {
      isDeviation: body.isDeviation,
      deviationNote: body.isDeviation ? (body.deviationNote ?? null) : null,
      progress: body.progress,
      updatedBy: persona.userId,
      updatedAt: isoOf(ctx.now),
    };
    if (body.answerText !== undefined) patch.answerText = body.answerText;
    if (body.answerNumber !== undefined) patch.answerNumber = body.answerNumber;
    if (body.answerChoice !== undefined) patch.answerChoice = body.answerChoice;
    if (body.answerBool !== undefined) patch.answerBool = body.answerBool;
    if (body.reuseReviewed === true && current?.reuse !== null && current?.reuse !== undefined) {
      patch.reuse = { ...current.reuse, reviewedAt: isoOf(ctx.now), reviewedBy: persona.userId };
    }
    return answerSaveResult(tender, requirement, revision, patch, attachmentsOf(current?.id).map(toAttachment), ctx.now);
  });

  mockRoute(app, bidEndpoints.assignAnswer, (ctx) => {
    const { bid, tender } = ownBid(ctx, ctx.params.bidId);
    const revision = editableRevision(ctx, bid, tender, ctx.body.revisionId, ctx.now);
    const requirement = requirementOf(ctx, tender, ctx.params.requirementId);
    const current = answerOf(revision.id, requirement.id);
    const { assigneeUserId } = ctx.body;
    if (assigneeUserId !== null) {
      const member = supplierTeam(bid.supplierTenantId).find((row) => row.member.userId === assigneeUserId);
      if (member === undefined || !member.permissions.includes('supplier.response.edit')) {
        return ctx.fail(422, 'ASSIGNEE_NOT_ON_TEAM', 'The assignee must be a member of your response team who can edit answers.');
      }
      if (requirement.envelope === 'commercial' && !member.member.canViewPricing) {
        return ctx.fail(422, 'ASSIGNEE_CANNOT_VIEW_PRICING', 'Commercial answers can only be assigned to people with pricing access.');
      }
    }
    const updated: FixtureAnswer | undefined =
      current === undefined ? undefined : { ...current, assignedUserId: assigneeUserId, dueAt: ctx.body.dueAt ?? current.dueAt };
    const row = toAnswerRow(tender, requirement, updated, revision.id);
    return {
      ...row,
      assignedUser: assigneeUserId === null ? null : personRef(assigneeUserId),
      dueAt: ctx.body.dueAt === undefined ? row.dueAt : ctx.body.dueAt,
    };
  });

  mockRoute(app, bidEndpoints.addAnswerComment, (ctx) => {
    const { bid, tender } = ownBid(ctx, ctx.params.bidId);
    const revision = revisionOf(ctx, bid, ctx.body.revisionId);
    const requirement = requirementOf(ctx, tender, ctx.params.requirementId);
    const persona = ctx.requirePersona();
    return {
      id: COMMAND_ID,
      requirementId: requirement.id,
      revisionId: revision.id,
      author: personRef(persona.userId),
      body: ctx.body.body,
      createdAt: isoOf(ctx.now),
    };
  });

  mockRoute(app, bidEndpoints.listReuseCandidates, (ctx) => {
    const { bid, tender } = ownBid(ctx, ctx.params.bidId);
    const requirement = requirementOf(ctx, tender, ctx.params.requirementId);
    const rows = reuseCandidates(bid, requirement.section).filter((row) =>
      matches(ctx.query.q, row.tenderReference, row.tenderTitle, row.answerText, row.requirementText),
    );
    const sort = ctx.query.sort ?? 'submittedAt';
    const dir = ctx.query.sort === undefined ? 'desc' : ctx.query.dir;
    return ctx.fixtures.page(sortRows(rows, (row) => (sort === 'tenderReference' ? row.tenderReference : (row.submittedAt ?? '')), dir));
  });

  mockRoute(app, bidEndpoints.reuseAnswer, (ctx) => {
    const { bid, tender, access } = ownBid(ctx, ctx.params.bidId);
    const persona = ctx.requirePersona();
    const revision = editableRevision(ctx, bid, tender, ctx.body.revisionId, ctx.now);
    const requirement = requirementOf(ctx, tender, ctx.params.requirementId);
    const current = answerOf(revision.id, requirement.id);
    assertAssigned(ctx, access, persona.userId, current);
    const source = reuseCandidates(bid, requirement.section).find((row) => row.sourceAnswerId === ctx.body.sourceAnswerId);
    if (source === undefined) {
      return ctx.fail(404, 'REUSE_SOURCE_NOT_FOUND', 'The selected content is not available for reuse in this response.');
    }
    const at = isoOf(ctx.now);
    return answerSaveResult(
      tender,
      requirement,
      revision,
      {
        answerText: source.answerText,
        progress: 'in_progress',
        reuse: { sourceAnswerId: source.sourceAnswerId, reusedAt: at, reusedBy: persona.userId, reviewedAt: null, reviewedBy: null },
        updatedBy: persona.userId,
        updatedAt: at,
      },
      attachmentsOf(current?.id).map(toAttachment),
      ctx.now,
    );
  });

  mockRoute(app, bidEndpoints.attachAnswerDocument, (ctx) => {
    const { bid, tender, access } = ownBid(ctx, ctx.params.bidId);
    const persona = ctx.requirePersona();
    const revision = editableRevision(ctx, bid, tender, ctx.body.revisionId, ctx.now);
    const requirement = requirementOf(ctx, tender, ctx.params.requirementId);
    const current = answerOf(revision.id, requirement.id);
    assertAssigned(ctx, access, persona.userId, current);
    const existing = attachmentsOf(current?.id).map(toAttachment);
    const at = isoOf(ctx.now);
    let added: BidAnswerDetail['attachments'][number];
    if (ctx.body.evidenceItemId !== undefined) {
      const item = BID_EVIDENCE_ITEMS.find((row) => row.id === ctx.body.evidenceItemId && row.supplierTenantId === access.tenant.id);
      if (item === undefined) {
        return ctx.fail(404, 'EVIDENCE_NOT_FOUND', 'No evidence item with this id exists in your library.');
      }
      if (item.status === 'expired' || (item.expiresAt !== null && Date.parse(item.expiresAt) <= ctx.now.getTime())) {
        return ctx.fail(409, 'EVIDENCE_EXPIRED', `${item.title} expired; renew it in the evidence library first.`);
      }
      if (item.status !== 'current') {
        return ctx.fail(409, 'EVIDENCE_NOT_CURRENT', `${item.title} was ${item.status}; attach its current edition.`);
      }
      added = {
        id: COMMAND_ID,
        documentId: item.documentId,
        documentVersionId: item.documentVersionId,
        fileName: item.fileName,
        sizeBytes: 180_000,
        sha256: fixtureHash(`evidence:${item.id}:${item.versionNo}`),
        envelope: requirement.envelope,
        evidenceSubmissionId: null,
        evidenceTitle: item.title,
        attachedAt: at,
        attachedBy: personRef(persona.userId),
      };
    } else {
      const versionId = ctx.body.documentVersionId as number;
      const known = BID_ANSWER_ATTACHMENTS.find((row) => row.documentVersionId === versionId && row.revisionId === revision.id);
      added = {
        id: COMMAND_ID,
        documentId: known?.documentId ?? versionId,
        documentVersionId: versionId,
        fileName: known?.fileName ?? `uploaded-document-${versionId}.pdf`,
        sizeBytes: known?.sizeBytes ?? 0,
        sha256: known?.sha256 ?? fixtureHash(`upload:${versionId}`),
        envelope: requirement.envelope,
        evidenceSubmissionId: null,
        evidenceTitle: null,
        attachedAt: at,
        attachedBy: personRef(persona.userId),
      };
    }
    return answerSaveResult(tender, requirement, revision, { updatedBy: persona.userId, updatedAt: at }, [...existing, added], ctx.now);
  });

  mockRoute(app, bidEndpoints.detachAnswerDocument, (ctx) => {
    const { bid, tender, access } = ownBid(ctx, ctx.params.bidId);
    const persona = ctx.requirePersona();
    const revision = editableRevision(ctx, bid, tender, ctx.query.revisionId, ctx.now);
    const requirement = requirementOf(ctx, tender, ctx.params.requirementId);
    const current = answerOf(revision.id, requirement.id);
    assertAssigned(ctx, access, persona.userId, current);
    const existing = attachmentsOf(current?.id);
    if (!existing.some((row) => row.id === ctx.params.attachmentId)) {
      return ctx.fail(404, 'ATTACHMENT_NOT_FOUND', 'This file is not attached to the answer.');
    }
    return answerSaveResult(
      tender,
      requirement,
      revision,
      { updatedBy: persona.userId, updatedAt: isoOf(ctx.now) },
      existing.filter((row) => row.id !== ctx.params.attachmentId).map(toAttachment),
      ctx.now,
    );
  });

  // ---- pricing ------------------------------------------------------------------------------------------

  mockRoute(app, bidEndpoints.getPricing, (ctx) => {
    const { bid, tender } = ownBid(ctx, ctx.params.bidId);
    const revision = revisionOf(ctx, bid, ctx.query.revisionId);
    return pricingOf(bid, tender, revision, isEditable(revision, bid, tender, ctx.now));
  });

  mockRoute(app, bidEndpoints.savePricing, (ctx) => {
    const { bid, tender } = ownBid(ctx, ctx.params.bidId);
    const revision = editableRevision(ctx, bid, tender, ctx.body.revisionId, ctx.now);
    const items = tenderPricingItems(tender);
    const lines = new Map<number, PriceInput>(fixturePrices(revision.id).map((row) => [row.pricingItemId, row]));
    for (const line of ctx.body.lines) {
      const known = items.find((row) => row.item.id === line.pricingItemId);
      if (known === undefined) {
        return ctx.fail(404, 'PRICING_ITEM_NOT_FOUND', `Pricing item ${line.pricingItemId} is not part of the tender.`);
      }
      if (known.lotId !== null && !bid.lotIds.includes(known.lotId)) {
        return ctx.fail(409, 'LOT_NOT_SELECTED', `${known.item.itemCode} belongs to a lot the response does not offer.`);
      }
      const currency = line.priceStatus === 'priced' ? (line.currency ?? null) : null;
      if (currency !== null && !tender.acceptedCurrencies.includes(currency)) {
        return ctx.fail(422, 'CURRENCY_NOT_ACCEPTED', `${currency} is not accepted; use ${tender.acceptedCurrencies.join(' or ')}.`);
      }
      const priced = line.priceStatus === 'priced';
      lines.set(line.pricingItemId, {
        pricingItemId: line.pricingItemId,
        priceStatus: line.priceStatus,
        unitPrice: priced ? (line.unitPrice ?? null) : null,
        quantity: priced ? (line.quantity ?? null) : null,
        currency,
        taxRate: priced ? (line.taxRate ?? null) : null,
        discountAmount: priced ? (line.discountAmount ?? null) : null,
        notes: line.notes ?? null,
      });
    }
    const terms = ctx.body.commercialTerms;
    const pricing = buildPricing(bid, tender, revision, true, [...lines.values()], {
      validityDays: terms.validityDays,
      paymentTerms: terms.paymentTerms,
      conditionalDiscounts: terms.conditionalDiscounts,
      assumptions: terms.assumptions,
    });
    return { pricing, contentHash: nextHash(revision, ctx.now), invalidatedApprovalIds: invalidatedBy(revision) };
  });

  // ---- declarations, parties, exceptions, evidence ------------------------------------------------------

  mockRoute(app, bidEndpoints.getDeclarations, (ctx) => {
    const { bid, tender } = ownBid(ctx, ctx.params.bidId);
    const revision = revisionOf(ctx, bid, ctx.query.revisionId);
    return declarationsPackOf(bid, tender, revision, isEditable(revision, bid, tender, ctx.now));
  });

  mockRoute(app, bidEndpoints.saveDeclarations, (ctx) => {
    const { bid, tender } = ownBid(ctx, ctx.params.bidId);
    const persona = ctx.requirePersona();
    const revision = editableRevision(ctx, bid, tender, ctx.body.revisionId, ctx.now);
    if (ctx.body.declarations.some((row) => row.declarationType === 'other')) {
      return ctx.fail(422, 'DECLARATION_NOT_REQUIRED', 'Only the declarations the tender requires can be confirmed here.');
    }
    const pack = declarationsPackOf(bid, tender, revision, true);
    const at = isoOf(ctx.now);
    const declarations = pack.declarations.map((row) => {
      const input = ctx.body.declarations.find((value) => value.declarationType === row.declarationType);
      return input === undefined
        ? row
        : { ...row, accepted: input.accepted, explanation: input.explanation ?? null, declaredBy: personRef(persona.userId), declaredAt: at };
    });
    return declarationsResult({ ...pack, declarations }, revision, ctx.now);
  });

  mockRoute(app, bidEndpoints.saveSubcontractors, (ctx) => {
    const { bid, tender } = ownBid(ctx, ctx.params.bidId);
    const revision = editableRevision(ctx, bid, tender, ctx.body.revisionId, ctx.now);
    const pack = declarationsPackOf(bid, tender, revision, true);
    const subcontractors = ctx.body.subcontractors.map((row, index) => ({
      id: COMMAND_ID + index,
      name: row.name,
      scope: row.scope,
      sharePercent: row.sharePercent,
      qualificationEvidenceDocumentId: row.qualificationEvidenceDocumentId ?? null,
      qualificationEvidenceFileName: row.qualificationEvidenceDocumentId === undefined || row.qualificationEvidenceDocumentId === null ? null : `document-${row.qualificationEvidenceDocumentId}.pdf`,
    }));
    return declarationsResult({ ...pack, subcontractors }, revision, ctx.now);
  });

  mockRoute(app, bidEndpoints.saveKeyPersonnel, (ctx) => {
    const { bid, tender } = ownBid(ctx, ctx.params.bidId);
    const revision = editableRevision(ctx, bid, tender, ctx.body.revisionId, ctx.now);
    const pack = declarationsPackOf(bid, tender, revision, true);
    const keyPersonnel = ctx.body.keyPersonnel.map((row, index) => ({
      id: COMMAND_ID + index,
      name: row.name,
      role: row.role,
      qualifications: row.qualifications ?? null,
      cvDocumentId: row.cvDocumentId ?? null,
      cvFileName: row.cvDocumentId === undefined || row.cvDocumentId === null ? null : `cv-${row.cvDocumentId}.pdf`,
    }));
    return declarationsResult({ ...pack, keyPersonnel }, revision, ctx.now);
  });

  mockRoute(app, bidEndpoints.saveConsortium, (ctx) => {
    const { bid, tender, access } = ownBid(ctx, ctx.params.bidId);
    const revision = editableRevision(ctx, bid, tender, ctx.body.revisionId, ctx.now);
    const lead = ctx.body.members.find((member) => member.isLead);
    if (ctx.body.isConsortium && lead !== undefined && lead.memberTenantId !== access.tenant.id) {
      return ctx.fail(422, 'LEAD_MUST_BE_SUPPLIER', 'The responding organization must be the lead member of its consortium.');
    }
    const pack = declarationsPackOf(bid, tender, revision, true);
    const consortiumMembers = ctx.body.members.map((member, index) => ({
      id: COMMAND_ID + index,
      memberTenantId: member.memberTenantId ?? null,
      memberName: member.memberName,
      isLead: member.isLead,
      responsibilities: member.responsibilities ?? null,
      authorityEvidenceDocumentId: member.authorityEvidenceDocumentId ?? null,
    }));
    return declarationsResult(
      { ...pack, isConsortium: ctx.body.isConsortium, leadMemberName: lead?.memberName ?? null, consortiumMembers },
      revision,
      ctx.now,
    );
  });

  mockRoute(app, bidEndpoints.saveExceptions, (ctx) => {
    const { bid, tender } = ownBid(ctx, ctx.params.bidId);
    const revision = editableRevision(ctx, bid, tender, ctx.body.revisionId, ctx.now);
    const pack = declarationsPackOf(bid, tender, revision, true);
    const exceptions = ctx.body.exceptions.map((row, index) => ({
      id: COMMAND_ID + index,
      clauseRef: row.clauseRef,
      proposedChange: row.proposedChange,
      rationale: row.rationale ?? null,
    }));
    return declarationsResult({ ...pack, exceptions }, revision, ctx.now);
  });

  mockRoute(app, bidEndpoints.attachEvidence, (ctx) => {
    const { bid, tender, access } = ownBid(ctx, ctx.params.bidId);
    const persona = ctx.requirePersona();
    const revision = editableRevision(ctx, bid, tender, ctx.body.revisionId, ctx.now);
    const item = BID_EVIDENCE_ITEMS.find((row) => row.id === ctx.body.evidenceItemId && row.supplierTenantId === access.tenant.id);
    if (item === undefined) {
      return ctx.fail(404, 'EVIDENCE_NOT_FOUND', 'No evidence item with this id exists in your library.');
    }
    if (item.status === 'expired' || (item.expiresAt !== null && Date.parse(item.expiresAt) <= ctx.now.getTime())) {
      return ctx.fail(409, 'EVIDENCE_EXPIRED', `${item.title} expired; renew it in the evidence library first.`);
    }
    if (item.status !== 'current') {
      return ctx.fail(409, 'EVIDENCE_NOT_CURRENT', `${item.title} was ${item.status}; attach its current edition.`);
    }
    if (BID_EVIDENCE.some((row) => row.revisionId === revision.id && row.evidenceItemId === item.id)) {
      return ctx.fail(409, 'EVIDENCE_ALREADY_ATTACHED', `${item.title} is already attached to this revision.`);
    }
    const pack = declarationsPackOf(bid, tender, revision, true);
    const validityEnd = Date.parse(tender.rounds.at(-1)?.deadline ?? isoOf(ctx.now)) + tender.bidValidityDays * 86_400_000;
    const evidence = [
      ...pack.evidence,
      {
        evidenceItemId: item.id,
        evidenceSubmissionId: null,
        documentVersionId: item.documentVersionId,
        title: item.title,
        evidenceType: item.evidenceType,
        issuer: item.issuer,
        fileName: item.fileName,
        versionNo: item.versionNo,
        validFrom: item.validFrom,
        expiresAt: item.expiresAt,
        status: item.status,
        verificationStatus: item.verificationStatus,
        attachedAt: isoOf(ctx.now),
        attachedBy: personRef(persona.userId),
        expiresDuringValidity: item.expiresAt !== null && Date.parse(item.expiresAt) < validityEnd,
      },
    ];
    const evidenceOptions = pack.evidenceOptions.map((row) => (row.evidenceItemId === item.id ? { ...row, attached: true } : row));
    return declarationsResult({ ...pack, evidence, evidenceOptions }, revision, ctx.now);
  });

  mockRoute(app, bidEndpoints.detachEvidence, (ctx) => {
    const { bid, tender } = ownBid(ctx, ctx.params.bidId);
    const revision = editableRevision(ctx, bid, tender, ctx.query.revisionId, ctx.now);
    if (!BID_EVIDENCE.some((row) => row.revisionId === revision.id && row.evidenceItemId === ctx.params.evidenceItemId)) {
      return ctx.fail(404, 'EVIDENCE_NOT_ATTACHED', 'This evidence item is not attached to the revision.');
    }
    const pack = declarationsPackOf(bid, tender, revision, true);
    return declarationsResult(
      {
        ...pack,
        evidence: pack.evidence.filter((row) => row.evidenceItemId !== ctx.params.evidenceItemId),
        evidenceOptions: pack.evidenceOptions.map((row) => (row.evidenceItemId === ctx.params.evidenceItemId ? { ...row, attached: false } : row)),
      },
      revision,
      ctx.now,
    );
  });

  // ---- readiness, revisions, internal approval -------------------------------------------------------------

  mockRoute(app, bidEndpoints.getReadiness, (ctx) => {
    const { bid, tender, access } = ownBid(ctx, ctx.params.bidId);
    const revision = revisionOf(ctx, bid, ctx.query.revisionId);
    return readinessOf(bid, tender, revision, access.permissions, ctx.now);
  });

  mockRoute(app, bidEndpoints.listRevisions, (ctx) => {
    const { bid } = ownBid(ctx, ctx.params.bidId);
    const rows = revisionsOf(bid.id)
      .map((row) => toRevision(row, bid))
      .filter((row) => ctx.query.status === undefined || ctx.query.status.includes(row.status));
    const sort = ctx.query.sort ?? 'revisionNo';
    const dir = ctx.query.sort === undefined ? 'desc' : ctx.query.dir;
    return ctx.fixtures.page(sortRows(rows, (row) => (sort === 'createdAt' ? row.createdAt : row.revisionNo), dir));
  });

  mockRoute(app, bidEndpoints.createRevision, (ctx) => {
    const { bid, tender } = ownBid(ctx, ctx.params.bidId);
    const persona = ctx.requirePersona();
    const basedOn = revisionOf(ctx, bid, ctx.body.basedOnRevisionId);
    if (bid.submissionState === 'withdrawn') {
      return ctx.fail(409, 'BID_WITHDRAWN', 'The response was withdrawn; it cannot be replaced.');
    }
    if (!windowOpen(tender, bid.roundType, ctx.now)) {
      return ctx.fail(409, 'SUBMISSION_WINDOW_CLOSED', 'The submission deadline has passed: no replacement can be prepared.');
    }
    const working = workingRevision(bid);
    if (working !== null) {
      return ctx.fail(409, 'WORKING_REVISION_EXISTS', `Revision ${working.revisionNo} is already being prepared.`);
    }
    const at = isoOf(ctx.now);
    const revisionNo = (revisionsOf(bid.id).at(-1)?.revisionNo ?? 0) + 1;
    const created: BidRevision = {
      id: COMMAND_ID,
      bidId: bid.id,
      revisionNo,
      status: 'draft',
      basedOnRevisionId: basedOn.id,
      basedOnRevisionNo: basedOn.revisionNo,
      contentHash: fixtureHash(`${basedOn.contentHash}:replacement:${at}`),
      acknowledgedTenderVersion: tender.currentVersionNo,
      internallyApprovedAt: null,
      submittedAt: null,
      receiptId: null,
      receiptNo: null,
      createdBy: personRef(persona.userId),
      createdAt: at,
      updatedAt: at,
      isEffective: false,
      isWorking: true,
    };
    return created;
  });

  mockRoute(app, bidEndpoints.getInternalReview, (ctx) => {
    const { bid, tender, access } = ownBid(ctx, ctx.params.bidId);
    const revision = revisionOf(ctx, bid, ctx.query.revisionId);
    return internalReviewOf(bid, tender, revision, revisionMap(bid), access.permissions, ctx.now);
  });

  mockRoute(app, bidEndpoints.requestInternalApproval, (ctx) => {
    const { bid, tender, access } = ownBid(ctx, ctx.params.bidId);
    const persona = ctx.requirePersona();
    const revision = editableRevision(ctx, bid, tender, ctx.body.revisionId, ctx.now);
    if (ctx.body.contentHash !== revision.contentHash) {
      return ctx.fail(409, 'CONTENT_HASH_MISMATCH', 'The response changed since you opened it; reload and request approval of the current content.');
    }
    const team = supplierTeam(bid.supplierTenantId);
    const current = BID_INTERNAL_APPROVALS.filter((row) => row.bidId === bid.id);
    const created: FixtureInternalApproval[] = ctx.body.approvers.map((approver, index) => {
      const member = team.find((row) => row.member.userId === approver.approverUserId);
      if (member === undefined || !member.member.canApprove) {
        return ctx.fail(422, 'APPROVER_NOT_AUTHORIZED', 'Each approver must hold internal approval authority in your organization.');
      }
      if (approver.approverUserId === persona.userId) {
        return ctx.fail(422, 'SELF_APPROVAL_NOT_ALLOWED', 'You cannot approve a request you made yourself.');
      }
      if (current.some((row) => row.revisionId === revision.id && row.approvalType === approver.approvalType && row.status === 'pending')) {
        return ctx.fail(409, 'APPROVAL_ALREADY_PENDING', `A ${approver.approvalType} approval is already pending for this revision.`);
      }
      return {
        id: COMMAND_ID + index,
        bidId: bid.id,
        revisionId: revision.id,
        supplierTenantId: bid.supplierTenantId,
        approvalType: approver.approvalType,
        approverUserId: approver.approverUserId,
        status: 'pending',
        requestedBy: persona.userId,
        requestedAt: isoOf(ctx.now),
        contentHashAtDecision: null,
        decidedAt: null,
        note: ctx.body.note ?? null,
        invalidatedAt: null,
      };
    });
    return reviewWith(bid, tender, revision, access.permissions, ctx.now, [...current, ...created]);
  });

  mockRoute(app, bidEndpoints.decideInternalApproval, (ctx) => {
    const { bid, tender, access } = ownBid(ctx, ctx.params.bidId);
    const persona = ctx.requirePersona();
    const approval = BID_INTERNAL_APPROVALS.find((row) => row.id === ctx.params.approvalId && row.bidId === bid.id);
    if (approval === undefined) {
      return ctx.fail(404, 'APPROVAL_NOT_FOUND', 'No internal approval with this id exists for the response.');
    }
    if (approval.approverUserId !== persona.userId) {
      return ctx.fail(403, 'NOT_ASSIGNED_APPROVER', 'This approval is assigned to another approver.');
    }
    if (approval.status === 'invalidated') {
      return ctx.fail(409, 'APPROVAL_INVALIDATED', 'A later change invalidated this approval; a new request is needed.');
    }
    if (approval.status !== 'pending') {
      return ctx.fail(409, 'APPROVAL_NOT_PENDING', `This approval was already ${approval.status}.`);
    }
    const revision = BID_REVISIONS.find((row) => row.id === approval.revisionId);
    if (revision === undefined) {
      return ctx.fail(404, 'APPROVAL_NOT_FOUND', 'The approved revision no longer exists.');
    }
    if (ctx.body.contentHash !== revision.contentHash) {
      return ctx.fail(409, 'CONTENT_HASH_MISMATCH', 'The response changed after you opened it (material change); review the current content.');
    }
    const at = isoOf(ctx.now);
    let updated: FixtureInternalApproval[];
    if (ctx.body.decision === 'delegate') {
      const delegate = supplierTeam(bid.supplierTenantId).find((row) => row.member.userId === ctx.body.delegateToUserId);
      if (delegate === undefined || !delegate.member.canApprove || delegate.member.userId === persona.userId) {
        return ctx.fail(422, 'DELEGATE_NOT_AUTHORIZED', 'The delegate must be another person with internal approval authority.');
      }
      updated = BID_INTERNAL_APPROVALS.filter((row) => row.bidId === bid.id).map((row) =>
        row.id === approval.id ? { ...row, status: 'returned' as const, decidedAt: at, note: ctx.body.note ?? `Delegated to ${delegate.member.fullName}.` } : row,
      );
      updated.push({
        ...approval,
        id: COMMAND_ID,
        approverUserId: delegate.member.userId,
        requestedBy: persona.userId,
        requestedAt: at,
        note: ctx.body.note ?? null,
      });
    } else {
      const status = ctx.body.decision === 'approve' ? 'approved' : ctx.body.decision === 'reject' ? 'rejected' : 'returned';
      updated = BID_INTERNAL_APPROVALS.filter((row) => row.bidId === bid.id).map((row) =>
        row.id === approval.id
          ? { ...row, status, decidedAt: at, note: ctx.body.note ?? null, contentHashAtDecision: status === 'approved' ? revision.contentHash : null }
          : row,
      );
    }
    return reviewWith(bid, tender, revision, access.permissions, ctx.now, updated);
  });

  // ---- submission -----------------------------------------------------------------------------------------

  mockRoute(app, bidEndpoints.getSubmissionPreview, (ctx) => {
    const { bid, tender, access } = ownBid(ctx, ctx.params.bidId);
    const persona = ctx.requirePersona();
    return submissionPreviewOf(bid, tender, persona.userId, access.capacity, access.permissions, ctx.now);
  });

  mockRoute(app, bidEndpoints.submitBid, (ctx) => {
    const { bid, tender, access } = ownBid(ctx, ctx.params.bidId);
    const persona = ctx.requirePersona();
    const { body } = ctx;
    const revision = revisionOf(ctx, bid, body.revisionId);
    if (workingRevision(bid)?.id !== revision.id) {
      return ctx.fail(409, 'REVISION_NOT_SUBMITTABLE', `Revision ${revision.revisionNo} is ${revision.status.replace('_', ' ')} and cannot be submitted.`);
    }
    if (body.confirmation.tenantId !== access.tenant.id) {
      return ctx.fail(409, 'CONTEXT_MISMATCH', 'The confirmed organization is not the one you are acting for. Switch organization and try again.');
    }
    if (body.contentHash !== revision.contentHash) {
      return ctx.fail(409, 'CONTENT_HASH_MISMATCH', 'The response changed after you reviewed it; review the current revision before submitting.');
    }
    if (tender.status !== 'open' && tender.status !== 'closed') {
      return ctx.fail(409, 'TENDER_NOT_OPEN', `${tender.reference} does not accept submissions.`);
    }
    const deadline = tender.rounds.find((round) => round.roundType === bid.roundType)?.deadline ?? '';
    if (!windowOpen(tender, bid.roundType, ctx.now)) {
      return ctx.fail(
        409,
        'SUBMISSION_LATE',
        `Final receipt would complete at ${isoOf(ctx.now)}, after the official deadline ${deadline} (${tender.officialTimeZone}). The attempt is recorded with its true time and rejected; any earlier receipt stays effective.`,
      );
    }
    const effective = effectiveReceipt(bid);
    if (effective !== null && body.replacementAcknowledged !== true) {
      return ctx.fail(
        422,
        'REPLACEMENT_NOT_ACKNOWLEDGED',
        `Confirm that this revision replaces receipt ${effective.receiptNo} only if the submission succeeds.`,
      );
    }
    const readiness = readinessOf(bid, tender, revision, access.permissions, ctx.now);
    const blocking = readiness.items.filter((item) => item.severity === 'blocking');
    if (blocking.some((item) => item.category !== 'approval')) {
      return ctx.fail(409, 'READINESS_BLOCKING', `${blocking.length} blocking readiness finding(s) must be resolved before submission.`);
    }
    if (blocking.length > 0) {
      return ctx.fail(409, 'INTERNAL_APPROVAL_REQUIRED', 'The required internal approvals of this exact revision are not complete.');
    }
    const at = isoOf(ctx.now);
    const receiptNo = nextReceiptNo(tender.buyerTenantId);
    const lots = lotRefs(tender, bid.lotIds);
    const answerFiles = BID_ANSWER_ATTACHMENTS.filter((row) => row.revisionId === revision.id);
    const inventory = [
      { fileName: '01 Qualification response.pdf', envelope: 'qualification' as const },
      { fileName: '02 Technical proposal.pdf', envelope: 'technical' as const },
      { fileName: '03 Price schedule.xlsx', envelope: 'commercial' as const },
      ...answerFiles.map((row) => ({ fileName: row.fileName, envelope: row.envelope })),
    ].map((file, index) => ({
      id: COMMAND_ID + index,
      documentVersionId: 200_000 + index,
      fileName: file.fileName,
      sha256: fixtureHash(`submit:${revision.id}:${file.fileName}`),
      sizeBytes: 150_000 + index * 64_000,
      envelope: file.envelope,
    }));
    const result: SubmissionResult = {
      attempt: {
        id: COMMAND_ID,
        bidId: bid.id,
        revisionId: revision.id,
        revisionNo: revision.revisionNo,
        attemptedBy: personRef(persona.userId),
        startedAt: at,
        completedAt: at,
        outcome: 'succeeded',
        failureReason: null,
        deadlineAtAttempt: { at: deadline, timeZone: tender.officialTimeZone },
        lateBySeconds: null,
        receiptId: COMMAND_ID,
        receiptNo,
      },
      receipt: {
        id: COMMAND_ID,
        receiptNo,
        bidId: bid.id,
        revisionId: revision.id,
        revisionNo: revision.revisionNo,
        receivedAt: at,
        status: 'received',
        statusChangedAt: at,
        documentCount: inventory.length,
        isEffective: true,
        tender: tenderRef(tender),
        legalParty: { tenantId: bid.supplierTenantId, legalName: legalNameOf(bid.supplierTenantId) },
        submittedBy: { ...personRef(persona.userId), capacity: capacityOf(access) },
        submitterAuthorityNote: `Submitted as ${capacityOf(access)}; organization and capacity confirmed before submission.`,
        lotsSummary: lots.map((lot) => `Lot ${lot.lotNo}`).join(', ') || 'All lots',
        lots,
        tenderVersionNo: tender.currentVersionNo,
        deadline: { at: deadline, timeZone: tender.officialTimeZone },
        inventory,
        roundType: bid.roundType,
        lateRejection: null,
      },
      supersededReceiptId: effective?.id ?? null,
    };
    return result;
  });

  // ---- receipts, attempts, withdrawal ---------------------------------------------------------------------

  mockRoute(app, bidEndpoints.listBidReceipts, (ctx) => {
    const { bid } = ownBid(ctx, ctx.params.bidId);
    const effective = effectiveReceipt(bid);
    const rows = receiptsOf(bid.id)
      .map((row) => toReceiptSummary(row, effective?.id ?? null))
      .filter((row) => ctx.query.status === undefined || ctx.query.status.includes(row.status));
    const sort = ctx.query.sort ?? 'receivedAt';
    const dir = ctx.query.sort === undefined ? 'desc' : ctx.query.dir;
    return ctx.fixtures.page(sortRows(rows, (row) => (sort === 'receiptNo' ? row.receiptNo : row.receivedAt), dir));
  });

  mockRoute(app, bidEndpoints.listSubmissionAttempts, (ctx) => {
    const { bid, tender } = ownBid(ctx, ctx.params.bidId);
    const rows = attemptsOf(bid.id)
      .map((row) => toAttempt(row, tender))
      .filter((row) => ctx.query.outcome === undefined || ctx.query.outcome.includes(row.outcome));
    const dir = ctx.query.sort === undefined ? 'desc' : ctx.query.dir;
    return ctx.fixtures.page(sortRows(rows, (row) => row.startedAt, dir));
  });

  mockRoute(app, bidEndpoints.listWithdrawals, (ctx) => {
    const { bid } = ownBid(ctx, ctx.params.bidId);
    const rows = withdrawalsOf(bid.id).map((row) => toWithdrawal(row, bid));
    const dir = ctx.query.sort === undefined ? 'desc' : ctx.query.dir;
    return ctx.fixtures.page(sortRows(rows, (row) => row.withdrawnAt, dir));
  });

  mockRoute(app, bidEndpoints.withdrawBid, (ctx) => {
    const { bid, tender, access } = ownBid(ctx, ctx.params.bidId);
    const persona = ctx.requirePersona();
    if (ctx.body.confirmation.tenantId !== access.tenant.id) {
      return ctx.fail(409, 'CONTEXT_MISMATCH', 'The confirmed organization is not the one you are acting for.');
    }
    const effective = effectiveReceipt(bid);
    if (effective === null) {
      return ctx.fail(409, 'NO_EFFECTIVE_SUBMISSION', 'There is no effective submission to withdraw.');
    }
    if (effective.id !== ctx.body.receiptId) {
      return ctx.fail(409, 'RECEIPT_NOT_EFFECTIVE', `Only the effective receipt ${effective.receiptNo} can be withdrawn.`);
    }
    if (!windowOpen(tender, bid.roundType, ctx.now)) {
      return ctx.fail(409, 'SUBMISSION_WINDOW_CLOSED', 'The submission deadline has passed: the response can no longer be withdrawn.');
    }
    const at = isoOf(ctx.now);
    const numbers = BID_WITHDRAWALS.map((row) => Number(row.confirmationNo.slice(-6)));
    const summary = toReceiptSummary(effective, effective.id);
    const result: WithdrawalResult = {
      withdrawal: {
        id: COMMAND_ID,
        bidId: bid.id,
        revisionId: effective.revisionId,
        revisionNo: summary.revisionNo,
        receiptId: effective.id,
        receiptNo: effective.receiptNo,
        confirmationNo: `WDR-2026-${String(Math.max(0, ...numbers) + 1).padStart(6, '0')}`,
        withdrawnAt: at,
        withdrawnBy: { ...personRef(persona.userId), capacity: capacityOf(access) },
        reason: ctx.body.reason,
      },
      receipt: { ...summary, status: 'withdrawn', statusChangedAt: at, isEffective: false },
      submissionState: 'withdrawn',
    };
    return result;
  });

  mockRoute(app, bidEndpoints.listSupplierReceipts, ({ requireTenant, query, fixtures }) => {
    const { tenant } = requireTenant();
    const rows: SupplierReceiptRow[] = SUBMISSION_RECEIPTS.filter((row) => row.supplierTenantId === tenant.id).flatMap((receipt) => {
      const bid = BIDS.find((row) => row.id === receipt.bidId);
      if (bid === undefined) {
        return [];
      }
      const tender = requireTender(bid);
      const effective = effectiveReceipt(bid);
      const lots = lotRefs(tender, bid.lotIds);
      return [
        {
          ...toReceiptSummary(receipt, effective?.id ?? null),
          tender: tenderRef(tender),
          roundType: bid.roundType,
          lotsSummary: lots.map((lot) => `Lot ${lot.lotNo}`).join(', ') || 'All lots',
        },
      ];
    });
    const filtered = rows.filter((row) => {
      if (!matches(query.q, row.receiptNo, row.tender.reference, row.tender.title, row.tender.buyer.name)) return false;
      if (query.status !== undefined && !query.status.includes(row.status)) return false;
      if (query.tenderId !== undefined && row.tender.tenderId !== query.tenderId) return false;
      if (query.buyerTenantId !== undefined && row.tender.buyer.tenantId !== query.buyerTenantId) return false;
      if (query.receivedFrom !== undefined && row.receivedAt < query.receivedFrom) return false;
      if (query.receivedTo !== undefined && row.receivedAt > query.receivedTo) return false;
      if (query.effectiveOnly === true && !row.isEffective) return false;
      return true;
    });
    const sort = query.sort ?? 'receivedAt';
    const dir = query.sort === undefined ? 'desc' : query.dir;
    return fixtures.page(
      sortRows(filtered, (row) => (sort === 'receiptNo' ? `${row.tender.buyer.slug}:${row.receiptNo}` : sort === 'reference' ? row.tender.reference : row.receivedAt), dir),
    );
  });

  mockRoute(app, bidEndpoints.getReceipt, (ctx) => {
    const { receipt, bid, tender } = ownReceipt(ctx, ctx.params.receiptId);
    return toReceipt(receipt, bid, tender);
  });

  mockRoute(app, bidEndpoints.downloadReceipt, (ctx) => {
    const { receipt, bid, tender } = ownReceipt(ctx, ctx.params.receiptId);
    return receiptDownload(toReceipt(receipt, bid, tender));
  });
}

function ownReceipt(ctx: MockHandlerContext<typeof bidEndpoints.getReceipt> | MockHandlerContext<typeof bidEndpoints.downloadReceipt>, receiptId: number) {
  const { tenant } = ctx.requireTenant();
  const receipt = SUBMISSION_RECEIPTS.find((row) => row.id === receiptId && row.supplierTenantId === tenant.id);
  const bid = receipt === undefined ? undefined : BIDS.find((row) => row.id === receipt.bidId);
  if (receipt === undefined || bid === undefined) {
    return ctx.fail(404, 'RECEIPT_NOT_FOUND', 'No receipt with this id exists in your organization.');
  }
  return { receipt, bid, tender: requireTender(bid) };
}

/** Earlier submitted answers of the same supplier in the same section (reuse candidates). */
function reuseCandidates(bid: FixtureBid, section: string) {
  const submittedRevisionIds = new Set(
    SUBMISSION_RECEIPTS.filter((row) => row.supplierTenantId === bid.supplierTenantId && row.bidId !== bid.id).map((row) => row.revisionId),
  );
  return BID_ANSWERS.filter((answer) => submittedRevisionIds.has(answer.revisionId) && answer.answerText !== null).flatMap((answer) => {
    const requirement = BID_REQUIREMENTS.find((row) => row.id === answer.requirementId);
    const revision = BID_REVISIONS.find((row) => row.id === answer.revisionId);
    const sourceBid = revision === undefined ? undefined : BIDS.find((row) => row.id === revision.bidId);
    if (requirement === undefined || revision === undefined || sourceBid === undefined || requirement.section !== section || requirement.responseType !== 'text') {
      return [];
    }
    const tender = requireTender(sourceBid);
    return [
      {
        sourceAnswerId: answer.id,
        tenderReference: tender.reference,
        tenderTitle: tender.title,
        revisionNo: revision.revisionNo,
        submittedAt: revision.submittedAt,
        refCode: requirement.refCode,
        requirementText: requirement.text,
        answerText: answer.answerText as string,
      },
    ];
  });
}

function receiptDownload(receipt: Receipt): ReceiptDownload {
  const lines = [
    'OFFICIAL SUBMISSION RECEIPT',
    '',
    `Receipt number:     ${receipt.receiptNo}`,
    `Status:             ${receipt.status.replace(/_/g, ' ')}`,
    `Received:           ${formatOfficialInstant(receipt.receivedAt, receipt.deadline.timeZone, true)}`,
    `Official deadline:  ${formatOfficialInstant(receipt.deadline.at, receipt.deadline.timeZone, false)}`,
    ...(receipt.lateRejection === null
      ? []
      : [
          `Late:               ${receipt.lateRejection.lateBySeconds} s after the deadline of ${formatOfficialInstant(receipt.lateRejection.deadlineAtAttempt.at, receipt.lateRejection.deadlineAtAttempt.timeZone, false)}; rejected with the true time recorded`,
        ]),
    '',
    `Buyer:              ${receipt.tender.buyer.name}`,
    `Tender:             ${receipt.tender.reference} — ${receipt.tender.title}`,
    `Tender version:     ${receipt.tenderVersionNo}`,
    `Round:              ${receipt.roundType.replace('_', ' ')}`,
    `Lots:               ${receipt.lotsSummary}`,
    '',
    `Supplier:           ${receipt.legalParty.legalName}`,
    `Submitted by:       ${receipt.submittedBy.fullName}${receipt.submittedBy.capacity === null ? '' : `, ${receipt.submittedBy.capacity}`}`,
    `Revision:           ${receipt.revisionNo}`,
    '',
    `Document inventory (${receipt.inventory.length} files):`,
    ...receipt.inventory.map((item) => `  - [${item.envelope}] ${item.fileName}  ${item.sizeBytes} bytes  sha256 ${item.sha256}`),
    '',
    'This receipt confirms receipt only. It does not confirm compliance, qualification, evaluation success or award.',
  ];
  return { fileName: `${receipt.receiptNo}.txt`, contentType: 'text/plain', content: `${lines.join('\n')}\n` };
}
