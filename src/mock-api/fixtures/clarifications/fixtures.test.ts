/**
 * The clarifications fixtures: internal consistency with the storyline (tenders, lots, requirements, personas,
 * tenants), cross-fixture consistency with the owning domains (bids receipts, requirements and deadlines; tenders
 * timetable; documents; approvals), coverage of every state the screens show, and contract validity of every
 * projection per audience.
 */
import { describe, expect, it } from 'vitest';

import {
  BuyerAddendumDetail,
  BuyerClarificationTender,
  BuyerQuestionDetail,
  BuyerSessionDetail,
  SharedAnswer,
  SupplierAddendumDetail,
  SupplierClarificationTender,
  SupplierQuestionDetail,
  SupplierSessionDetail,
} from '../../../contracts/clarifications.js';
import {
  ADDENDA_STATUS,
  QUESTIONS_AUDIENCE,
  QUESTIONS_STATUS,
  SESSIONS_STATUS,
  SESSION_REGISTRATIONS_STATUS,
} from '../../../contracts/enums.js';
import {
  buyerAddendumDetail,
  buyerQuestionDetail,
  buyerSessionDetail,
  buyerTenderRow,
  isSharedAnswer,
  sharedAnswer,
  supplierAddendumDetail,
  supplierQuestionDetail,
  supplierSessionDetail,
  supplierTenderRow,
} from '../../handlers/clarifications/projections.js';
import { findPersonaById, findTenantById } from '../../persona.js';
import { APPROVALS } from '../approvals.js';
import { BID_ACKNOWLEDGMENTS, BID_ADDENDA, BID_REQUIREMENTS, BID_TENDERS, BIDS, SUBMISSION_RECEIPTS } from '../bids/index.js';
import { DOCUMENTS } from '../documents.js';
import { TENANT_IDS } from '../platform.js';
import { MILESTONES, TENDERS } from '../tenders/index.js';
import { ADDENDA, CLARIFICATION_TENDERS, QUESTIONS, SESSIONS, sessionMinutesDocuments } from './index.js';

const NOW = new Date('2026-09-30T12:00:00Z');

function tender(id: number) {
  const found = CLARIFICATION_TENDERS.find((row) => row.id === id);
  if (found === undefined) {
    throw new Error(`tender ${id}`);
  }
  return found;
}

describe('clarification tenders', () => {
  it('use the storyline references with tender id N for T-2026-000N and the right buyer', () => {
    for (const row of CLARIFICATION_TENDERS) {
      expect(row.reference).toBe(`T-2026-${String(row.id).padStart(4, '0')}`);
      expect(findTenantById(row.tenantId)?.kind).toBe('buyer');
      expect(findPersonaById(row.ownerUserId)).toBeDefined();
      for (const participant of row.participants) {
        expect(findTenantById(participant.supplierTenantId)?.kind).toBe('supplier');
      }
    }
    expect(tender(11).tenantId).toBe(TENANT_IDS.odc);
    expect(tender(6).participation).toBe('invitation_only');
    expect(tender(6).onPublicPortal).toBe(false);
  });

  it('invite only Tsodilo and Chobe to T-2026-0006 (AC-01)', () => {
    expect(tender(6).participants.map((row) => row.supplierTenantId)).toEqual([TENANT_IDS.tsodilo, TENANT_IDS['chobe-pipe']]);
  });
});

describe('questions', () => {
  it('have unique ids and reference existing tenders, lots, requirements, documents, personas and suppliers', () => {
    expect(new Set(QUESTIONS.map((row) => row.id)).size).toBe(QUESTIONS.length);
    for (const question of QUESTIONS) {
      const owner = tender(question.tenderId);
      expect(question.tenantId).toBe(owner.tenantId);
      expect(owner.participants.some((row) => row.supplierTenantId === question.supplierTenantId), `question ${question.id}`).toBe(true);
      expect(findPersonaById(question.askedByUserId)?.memberships.some((row) => row.tenantId === question.supplierTenantId)).toBe(true);
      if (question.lotId !== null) {
        expect(owner.lots.some((lot) => lot.lotId === question.lotId)).toBe(true);
      }
      if (question.requirementId !== null) {
        expect(owner.requirements.some((row) => row.requirementId === question.requirementId)).toBe(true);
      }
      if (question.documentId !== null) {
        expect(owner.documents.some((row) => row.documentId === question.documentId)).toBe(true);
      }
      if (question.sessionId !== null) {
        expect(SESSIONS.find((row) => row.id === question.sessionId)?.tenderId).toBe(question.tenderId);
      }
      if (question.addendumId !== null) {
        expect(ADDENDA.find((row) => row.id === question.addendumId)?.tenderId).toBe(question.tenderId);
      }
    }
  });

  it('cover every question status and audience', () => {
    expect(new Set(QUESTIONS.map((row) => row.status))).toEqual(new Set(QUESTIONS_STATUS));
    expect(new Set(QUESTIONS.map((row) => row.audience))).toEqual(new Set(QUESTIONS_AUDIENCE));
  });

  it('never share a published answer without a cleared sanitized wording, and keep private answers private', () => {
    for (const question of QUESTIONS.filter((row) => row.status === 'published')) {
      expect(question.audience).not.toBe('private');
      expect(question.sanitizedQuestion).not.toBeNull();
      expect(question.answerText).not.toBeNull();
      expect(question.publishedAt).not.toBeNull();
    }
    for (const question of QUESTIONS.filter((row) => row.status === 'answered_privately')) {
      expect(question.audience).toBe('private');
    }
  });

  it('flag the late questions and require a disposition before handling (FR-10)', () => {
    const late = QUESTIONS.filter((row) => row.afterDeadline);
    expect(late.length).toBeGreaterThanOrEqual(2);
    expect(late.some((row) => row.lateDisposition === null)).toBe(true);
    expect(late.some((row) => row.lateDisposition === 'declined' && row.lateDispositionReason !== null)).toBe(true);
  });

  it('project to contract-valid buyer, supplier and shared shapes', () => {
    for (const question of QUESTIONS) {
      expect(() => BuyerQuestionDetail.parse(buyerQuestionDetail(question))).not.toThrow();
      expect(() => SupplierQuestionDetail.parse(supplierQuestionDetail(question))).not.toThrow();
      if (isSharedAnswer(question)) {
        expect(() => SharedAnswer.parse(sharedAnswer(question))).not.toThrow();
      }
    }
  });
});

describe('addenda', () => {
  it('cover every addendum status and number addenda per tender without gaps', () => {
    expect(new Set(ADDENDA.map((row) => row.status))).toEqual(new Set(ADDENDA_STATUS));
    for (const tenderRow of CLARIFICATION_TENDERS) {
      const numbers = ADDENDA.filter((row) => row.tenderId === tenderRow.id).map((row) => row.number).sort((a, b) => a - b);
      expect(numbers).toEqual(numbers.map((_value, index) => index + 1));
    }
  });

  it('address issued addenda to exactly the tender participants, and only issued addenda have recipients', () => {
    for (const addendum of ADDENDA) {
      const owner = tender(addendum.tenderId);
      expect(addendum.tenantId).toBe(owner.tenantId);
      if (addendum.status === 'issued') {
        expect(addendum.recipients.map((row) => row.supplierTenantId).sort()).toEqual(
          owner.participants.map((row) => row.supplierTenantId).sort(),
        );
        expect(addendum.issuedAt).not.toBeNull();
        expect(addendum.resultingVersionNo).not.toBeNull();
      } else {
        expect(addendum.recipients).toEqual([]);
      }
      for (const lotId of addendum.lotIds) {
        expect(owner.lots.some((lot) => lot.lotId === lotId)).toBe(true);
      }
      for (const change of addendum.requirementChanges) {
        expect(owner.requirements.some((row) => row.requirementId === change.requirementId)).toBe(true);
      }
    }
  });

  it('change a deadline only together with a submission change and keep the tender deadline in step (BR-13, BR-16)', () => {
    for (const addendum of ADDENDA.filter((row) => row.newSubmissionDeadline !== null)) {
      expect(addendum.changesSubmission || addendum.changesScope).toBe(true);
      if (addendum.status === 'issued') {
        expect(tender(addendum.tenderId).submissionDeadline).toBe(addendum.newSubmissionDeadline);
      }
    }
  });

  it('implement AC-10 on T-2026-0002: a new mandatory requirement after two submissions, receipts intact', () => {
    const addendum = ADDENDA.find((row) => row.tenderId === 2 && row.number === 1);
    expect(addendum).toMatchObject({ status: 'issued', materiality: 'material', existingSubmissionAction: 'supplement' });
    expect(addendum?.requirementChanges).toEqual([
      expect.objectContaining({ requirementId: 2008, changeType: 'added', newTreatment: 'mandatory_gate' }),
    ]);
    const submitted = addendum?.recipients.filter((row) => row.hadSubmissionAtIssue) ?? [];
    expect(submitted.map((row) => [row.supplierTenantId, row.priorReceiptNo, row.requiredAction, row.requiredActionCompleted])).toEqual([
      // Gaborone Metering's supplement failed (AC-12): its first receipt stays effective and the supplement is due.
      [TENANT_IDS['gaborone-meter'], 'RCPT-2026-000021', 'supplement', false],
      // Tsodilo supplemented on 25 Sep: its own new receipt superseded the prior one.
      [TENANT_IDS.tsodilo, 'RCPT-2026-000023', 'supplement', true],
    ]);
    expect(submitted.map((row) => row.priorReceiptStillEffective)).toEqual([true, false]);
  });

  it('project to contract-valid buyer and supplier shapes', () => {
    for (const addendum of ADDENDA) {
      expect(() => BuyerAddendumDetail.parse(buyerAddendumDetail(addendum, NOW))).not.toThrow();
      for (const recipient of addendum.recipients) {
        expect(() => SupplierAddendumDetail.parse(supplierAddendumDetail(addendum, recipient))).not.toThrow();
      }
    }
  });
});

describe('sessions', () => {
  it('cover every session and registration status, alternatives and attendance exceptions', () => {
    expect(new Set(SESSIONS.map((row) => row.status))).toEqual(new Set(SESSIONS_STATUS));
    expect(new Set(SESSIONS.flatMap((row) => row.registrations.map((registration) => registration.status)))).toEqual(
      new Set(SESSION_REGISTRATIONS_STATUS),
    );
    expect(SESSIONS.some((row) => row.alternativeOfId !== null)).toBe(true);
    const exceptions = SESSIONS.flatMap((row) => (row.mandatory ? row.registrations.filter((registration) => registration.status === 'absent') : []));
    expect(exceptions.some((registration) => registration.exceptionResolution === null)).toBe(true);
    expect(exceptions.some((registration) => registration.exceptionResolution !== null)).toBe(true);
  });

  it('register only participants within capacity, with one live registration per supplier (DD-07)', () => {
    expect(new Set(SESSIONS.flatMap((row) => row.registrations.map((registration) => registration.id))).size).toBe(
      SESSIONS.reduce((count, row) => count + row.registrations.length, 0),
    );
    for (const session of SESSIONS) {
      const owner = tender(session.tenderId);
      expect(session.tenantId).toBe(owner.tenantId);
      const live = session.registrations.filter((registration) => registration.status !== 'cancelled');
      expect(live.length).toBeLessThanOrEqual(session.capacity);
      expect(new Set(live.map((registration) => registration.supplierTenantId)).size).toBe(live.length);
      for (const registration of session.registrations) {
        expect(owner.participants.some((row) => row.supplierTenantId === registration.supplierTenantId)).toBe(true);
      }
      expect(Date.parse(session.endsAt)).toBeGreaterThan(Date.parse(session.startsAt));
    }
  });

  it('project to contract-valid buyer and supplier shapes', () => {
    for (const session of SESSIONS) {
      expect(() => BuyerSessionDetail.parse(buyerSessionDetail(session))).not.toThrow();
      for (const participant of tender(session.tenderId).participants) {
        expect(() => SupplierSessionDetail.parse(supplierSessionDetail(session, participant.supplierTenantId, NOW))).not.toThrow();
      }
    }
  });
});

describe('cross-fixture consistency (one demo world)', () => {
  it('take tenders, lots, requirements and submission deadlines from the bids projections', () => {
    for (const row of CLARIFICATION_TENDERS) {
      const bidTender = BID_TENDERS.find((candidate) => candidate.id === row.id);
      expect(bidTender, row.reference).toBeDefined();
      expect(row.reference).toBe(bidTender?.reference);
      expect(row.submissionDeadline).toBe(bidTender?.rounds[bidTender.rounds.length - 1]?.deadline);
      expect(row.lots.map((lot) => lot.lotId)).toEqual(bidTender?.lots.map((lot) => lot.id));
      expect(row.requirements.map((requirement) => [requirement.requirementId, requirement.refCode])).toEqual(
        BID_REQUIREMENTS.filter((requirement) => requirement.tenderId === row.id).map((requirement) => [requirement.id, requirement.refCode]),
      );
      expect(TENDERS.find((candidate) => candidate.id === row.id)?.reference).toBe(row.reference);
    }
    expect(tender(2).requirements.find((row) => row.refCode === 'Q-05')).toMatchObject({ requirementId: 2008, addedByAddendumId: 21 });
  });

  it('take the questions deadline from the tenders timetable', () => {
    for (const row of CLARIFICATION_TENDERS) {
      const milestone = MILESTONES.find((candidate) => candidate.tenderId === row.id && candidate.lotId === null && candidate.milestone === 'questions_deadline');
      expect(row.questionsDeadline, row.reference).toBe(milestone?.at ?? null);
    }
    expect(tender(1).questionsDeadline).toBe('2026-07-10T13:00:00Z');
    expect(tender(6).questionsDeadline).toBe('2026-10-05T13:00:00Z');
    expect(tender(8).questionsDeadline).toBe('2026-09-11T13:00:00Z');
  });

  it('list the bids domain effective receipts of every participant', () => {
    for (const row of CLARIFICATION_TENDERS) {
      for (const participant of row.participants) {
        const bidIds = BIDS.filter((bid) => bid.tenderId === row.id && bid.supplierTenantId === participant.supplierTenantId).map((bid) => bid.id);
        const effective = SUBMISSION_RECEIPTS.filter(
          (receipt) => bidIds.includes(receipt.bidId) && (receipt.status === 'received' || receipt.status === 'selected_for_evaluation'),
        ).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
        expect(participant.effectiveReceiptNo, `${row.reference} ${participant.supplierTenantId}`).toBe(effective[effective.length - 1]?.receiptNo ?? null);
      }
    }
    const t2 = tender(2).participants.find((row) => row.supplierTenantId === TENANT_IDS.tsodilo);
    expect(t2).toMatchObject({ effectiveReceiptNo: 'RCPT-2026-000027', receivedAt: '2026-09-25T09:20:00Z' });
    const chobe = tender(6).participants.find((row) => row.supplierTenantId === TENANT_IDS['chobe-pipe']);
    expect(chobe).toMatchObject({ hasEffectiveSubmission: true, effectiveReceiptNo: 'RCPT-2026-000025' });
  });

  it('match the issued addenda and acknowledgments of the bids projections', () => {
    for (const projected of BID_ADDENDA) {
      const own = ADDENDA.find((row) => row.id === projected.id);
      expect(own, `addendum ${projected.id}`).toMatchObject({
        tenderId: projected.tenderId,
        number: projected.number,
        status: 'issued',
        existingSubmissionAction: projected.existingSubmissionAction,
        acknowledgmentRequired: projected.acknowledgmentRequired,
        resultingVersionNo: projected.resultingVersionNo,
      });
    }
    const addendum21 = ADDENDA.find((row) => row.id === 21);
    expect(addendum21).toMatchObject({ title: BID_ADDENDA.find((row) => row.id === 21)?.title, issuedAt: BID_ADDENDA.find((row) => row.id === 21)?.issuedAt });
    for (const addendumId of [21, 31, 111]) {
      const acknowledged = ADDENDA.find((row) => row.id === addendumId)?.recipients.filter((row) => row.acknowledgedAt !== null) ?? [];
      expect(acknowledged.map((row) => [row.supplierTenantId, row.acknowledgedAt]).sort()).toEqual(
        BID_ACKNOWLEDGMENTS.filter((row) => row.addendumId === addendumId)
          .map((row) => [row.supplierTenantId, row.acknowledgedAt])
          .sort(),
      );
    }
  });

  it('reference only documents that the documents domain publishes for the tender or the session', () => {
    for (const row of CLARIFICATION_TENDERS) {
      for (const document of row.documents) {
        expect(DOCUMENTS.find((candidate) => candidate.id === document.documentId)).toMatchObject({ relatedType: 'tender', relatedId: row.id, status: 'published' });
      }
    }
    expect(tender(2).documents.map((row) => row.documentId)).toEqual([201]);
    for (const question of QUESTIONS.filter((row) => row.documentId !== null)) {
      expect(DOCUMENTS.some((candidate) => candidate.id === question.documentId), `question ${question.id}`).toBe(true);
    }
    for (const session of SESSIONS) {
      for (const document of sessionMinutesDocuments(session.id)) {
        expect(DOCUMENTS.find((candidate) => candidate.id === document.documentId)).toMatchObject({ relatedType: 'session', relatedId: session.id });
      }
    }
  });

  it('link an addendum only to an approval request that exists for that addendum', () => {
    for (const addendum of ADDENDA.filter((row) => row.approvalRequestId !== null)) {
      const request = APPROVALS.find((row) => row.id === addendum.approvalRequestId);
      expect(request, `addendum ${addendum.id}`).toMatchObject({ subjectType: 'addendum', subjectId: addendum.id, tenantId: addendum.tenantId });
      expect(request?.subjectReference).toBe(`${tender(addendum.tenderId).reference} Addendum ${addendum.number}`);
    }
    expect(ADDENDA.find((row) => row.status === 'awaiting_approval')?.approvalRequestId).toBe(44);
  });

  it('place questions and sessions between the tender release and its deadline, except the flagged late questions', () => {
    for (const question of QUESTIONS) {
      const released = TENDERS.find((row) => row.id === question.tenderId)?.releasedAt ?? null;
      const owner = tender(question.tenderId);
      expect(released, `question ${question.id}`).not.toBeNull();
      expect(question.submittedAt >= (released ?? ''), `question ${question.id} before release`).toBe(true);
      const late = owner.questionsDeadline !== null && question.submittedAt > owner.questionsDeadline;
      expect(question.afterDeadline, `question ${question.id}`).toBe(late);
    }
    for (const session of SESSIONS) {
      const released = TENDERS.find((row) => row.id === session.tenderId)?.releasedAt ?? '';
      expect(session.startsAt >= released, `session ${session.id}`).toBe(true);
      expect(session.startsAt <= (tender(session.tenderId).submissionDeadline ?? ''), `session ${session.id}`).toBe(true);
    }
  });

  it('match the site-visit and briefing milestones of the tenders timetable', () => {
    for (const milestone of MILESTONES.filter((row) => row.milestone === 'site_visit' || row.milestone === 'briefing')) {
      if (CLARIFICATION_TENDERS.some((row) => row.id === milestone.tenderId)) {
        expect(
          SESSIONS.some((session) => session.tenderId === milestone.tenderId && session.startsAt === milestone.at),
          `${milestone.milestone} of tender ${milestone.tenderId}`,
        ).toBe(true);
      }
    }
    expect(SESSIONS.find((row) => row.id === 46)).toMatchObject({ mandatory: false, startsAt: '2026-07-01T07:00:00Z' });
  });
});

describe('demonstrable principal actions', () => {
  it('hold a question in review with a cleared confidentiality review by a colleague of the owner (BUY-16 publish)', () => {
    const ready = QUESTIONS.filter((row) => row.status === 'in_review' && row.confidentialityReviewedBy !== null);
    expect(ready.map((row) => row.id)).toEqual([208]);
    for (const question of ready) {
      expect(question.confidentialityReviewedBy).not.toBe(question.ownerUserId);
      expect(question.history.some((entry) => entry.action === 'review_cleared' && entry.actorUserId === question.confidentialityReviewedBy)).toBe(true);
    }
  });

  it('hold a session that took place with attendance and minutes still to record (BUY-18)', () => {
    const held = SESSIONS.filter(
      (row) => row.status === 'scheduled' && Date.parse(row.startsAt) < NOW.getTime() && row.minutesPublishedAt === null,
    );
    expect(held.map((row) => row.id)).toEqual([49]);
    expect(held[0]?.registrations.every((row) => row.status === 'registered')).toBe(true);
  });
});

describe('tender overviews', () => {
  it('project every tender for its buyer and every participant', () => {
    for (const row of CLARIFICATION_TENDERS) {
      expect(() => BuyerClarificationTender.parse(buyerTenderRow(row, NOW))).not.toThrow();
      for (const participant of row.participants) {
        expect(() => SupplierClarificationTender.parse(supplierTenderRow(row, participant.supplierTenantId, NOW))).not.toThrow();
      }
    }
  });
});
