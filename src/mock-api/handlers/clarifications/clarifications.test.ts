/**
 * The clarifications mock handlers with REAL authentication (DD-43): tenant filtering, permission and tenant-kind
 * denials, supplier isolation (own questions, own registrations, no other supplier's private case), the public
 * edition, AC-10, and the declared business errors of the commands. The clock is fixed at 2026-09-30 12:00 UTC.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  AcknowledgmentResult,
  BuyerAddendumDetail,
  BuyerQuestionDetail,
  BuyerSessionDetail,
  EscalateQuestionResult,
  PublicClarifications,
  SupplierQuestionDetail,
  SupplierSessionDetail,
  SupplierTenderContext,
  clarificationsEndpoints as api,
} from '../../../contracts/clarifications.js';
import { Problem } from '../../../contracts/common.js';
import type { AnyEndpoint } from '../../../contracts/endpoint.js';
import { createTestMockApp } from '../../testing/index.js';
import type { TestMockApp, TestResponse } from '../../testing/index.js';

const NOW = new Date('2026-09-30T12:00:00Z');

const TEBOGO = 'tebogo.officer@tenderiq.local';
const MPHO = 'mpho.manager@tenderiq.local';
const ODC_OFFICER = 'officer.odc@tenderiq.local';
const CHOBE = 'chobe-pipe.bidmanager@tenderiq.local';
const TSODILO = 'tsodilo.bidmanager@tenderiq.local';
const GABORONE = 'gaborone-meter.bidmanager@tenderiq.local';
const MAKGADIKGADI = 'makgadikgadi.admin@tenderiq.local';

let app: TestMockApp;

beforeAll(async () => {
  app = await createTestMockApp({ now: () => NOW });
});

interface Page<T> {
  items: T[];
  total: number;
}

function page<T>(response: TestResponse): Page<T> {
  expect(response.status, response.text).toBe(200);
  return response.body as Page<T>;
}

function codeOf(response: TestResponse): string | undefined {
  return Problem.parse(response.body).code;
}

async function call(
  email: string,
  endpoint: AnyEndpoint,
  tenant: string | undefined,
  options: { params?: Record<string, string | number>; query?: Record<string, string | number | boolean | string[]>; body?: unknown } = {},
): Promise<TestResponse> {
  return app.callAs(email, endpoint, { ...options, ...(tenant === undefined ? {} : { tenant }) });
}

describe('module', () => {
  it('is auto-discovered and serves every endpoint of the contract', () => {
    expect(app.failed.filter((failure) => failure.module.startsWith('clarifications'))).toEqual([]);
    expect(app.loaded).toContain('clarifications/index');
    expect(app.endpointIds).toEqual(expect.arrayContaining(Object.values(api).map((endpoint) => endpoint.id)));
  });
});

describe('buyer questions (BUY-16)', () => {
  it('lists only the active buyer tenant’s questions', async () => {
    const kwu = page<{ id: number; tender: { reference: string } }>(await call(TEBOGO, api.questionsList, 'kwu', { query: { pageSize: 100 } }));
    expect(kwu.total).toBe(22);
    expect(kwu.items.every((row) => row.tender.reference !== 'T-2026-0011')).toBe(true);

    const odc = page<{ id: number }>(await call(ODC_OFFICER, api.questionsList, 'odc'));
    expect(odc.items.map((row) => row.id).sort()).toEqual([301, 302]);
  });

  it('filters by status, unassigned and late questions', async () => {
    const received = page<{ id: number }>(await call(TEBOGO, api.questionsList, 'kwu', { query: { status: 'received' } }));
    expect(received.items.map((row) => row.id).sort()).toEqual([206, 211, 222]);

    const late = page<{ id: number }>(await call(TEBOGO, api.questionsList, 'kwu', { query: { afterDeadline: true } }));
    expect(late.items.map((row) => row.id).sort()).toEqual([215, 222]);

    const unassigned = page<{ id: number }>(await call(TEBOGO, api.questionsList, 'kwu', { query: { unassigned: true, tenderId: 2 } }));
    expect(unassigned.items.map((row) => row.id)).toEqual([206]);
  });

  it('returns 404 for another buyer’s question', async () => {
    const response = await call(ODC_OFFICER, api.questionsGet, 'odc', { params: { questionId: 201 } });
    expect(response.status).toBe(404);
  });

  it('denies personas without clarification rights and other tenant kinds', async () => {
    expect((await call('admin.kwu@tenderiq.local', api.questionsList, 'kwu')).status).toBe(403);
    expect((await call('pule.auditor@tenderiq.local', api.questionsList, 'kwu')).status).toBe(403);
    expect((await call('support.agent@tenderiq.local', api.questionsList, 'kwu')).status).toBe(403);
    expect((await call(TEBOGO, api.questionsList, 'odc')).status).toBe(403);
    expect((await call(CHOBE, api.questionsList, 'chobe-pipe')).status).toBe(403);
  });

  it('requires a late disposition before assigning a late question, then accepts it', async () => {
    const blocked = await call(TEBOGO, api.questionsAssign, 'kwu', { params: { questionId: 222 }, body: { ownerUserId: 5 } });
    expect(blocked.status).toBe(409);
    expect(codeOf(blocked)).toBe('LATE_DISPOSITION_REQUIRED');

    const accepted = await call(TEBOGO, api.questionsLateDisposition, 'kwu', {
      params: { questionId: 222 },
      body: { lateDisposition: 'accepted', lateDispositionReason: 'Received three days late; the answer helps every bidder equally.' },
    });
    expect(accepted.status).toBe(200);
    expect(BuyerQuestionDetail.parse(accepted.body).lateDisposition).toBe('accepted');

    const notLate = await call(TEBOGO, api.questionsLateDisposition, 'kwu', {
      params: { questionId: 201 },
      body: { lateDisposition: 'accepted', lateDispositionReason: 'n/a' },
    });
    expect(codeOf(notLate)).toBe('QUESTION_NOT_LATE');
  });

  it('refuses an owner without clarification rights', async () => {
    const response = await call(TEBOGO, api.questionsAssign, 'kwu', { params: { questionId: 206 }, body: { ownerUserId: 3 } });
    expect(response.status).toBe(422);
    expect(codeOf(response)).toBe('OWNER_NOT_ELIGIBLE');
  });

  it('keeps the confidentiality review with someone other than the owner', async () => {
    const self = await call(TEBOGO, api.questionsReview, 'kwu', { params: { questionId: 204 }, body: { outcome: 'cleared' } });
    expect(codeOf(self)).toBe('SELF_REVIEW_NOT_ALLOWED');

    const cleared = await call(MPHO, api.questionsReview, 'kwu', { params: { questionId: 204 }, body: { outcome: 'cleared' } });
    expect(cleared.status).toBe(200);
    expect(BuyerQuestionDetail.parse(cleared.body).confidentialityReviewedBy?.fullName).toBe('Mpho Dikgang');
  });

  it('publishes a cleared answer to the chosen audience with status 200 (BUY-16)', async () => {
    const detail = BuyerQuestionDetail.parse((await call(TEBOGO, api.questionsGet, 'kwu', { params: { questionId: 208 } })).body);
    expect(detail).toMatchObject({ status: 'in_review', owner: { userId: 5 }, confidentialityReviewedBy: { userId: 4 } });

    const participants = await call(TEBOGO, api.questionsPublish, 'kwu', { params: { questionId: 208 }, body: { audience: 'all_participants' } });
    expect(participants.status).toBe(200);
    expect(BuyerQuestionDetail.parse(participants.body)).toMatchObject({
      status: 'published',
      audience: 'all_participants',
      publishedAt: '2026-09-30T12:00:00Z',
    });

    const publicly = await call(TEBOGO, api.questionsPublish, 'kwu', { params: { questionId: 208 }, body: { audience: 'public' } });
    expect(publicly.status).toBe(200);
    expect(BuyerQuestionDetail.parse(publicly.body)).toMatchObject({ status: 'published', audience: 'public' });
  });

  it('refuses to publish without a cleared review, and to edit a closed question', async () => {
    const unreviewed = await call(TEBOGO, api.questionsPublish, 'kwu', { params: { questionId: 204 }, body: { audience: 'public' } });
    expect(codeOf(unreviewed)).toBe('CONFIDENTIALITY_REVIEW_REQUIRED');

    const closed = await call(TEBOGO, api.questionsSaveAnswer, 'kwu', {
      params: { questionId: 210 },
      body: { sanitizedQuestion: 'x', answerText: 'y', audience: 'all_participants' },
    });
    expect(codeOf(closed)).toBe('QUESTION_CLOSED');
  });

  it('escalates a material answer to a new draft addendum', async () => {
    const response = await call(TEBOGO, api.questionsEscalate, 'kwu', {
      params: { questionId: 206 },
      body: { reason: 'Changing the delivery location changes the scope.' },
    });
    expect(response.status).toBe(200);
    const result = EscalateQuestionResult.parse(response.body);
    expect(result.question.status).toBe('escalated_to_addendum');
    expect(result.addendum).toMatchObject({ id: 900, number: 4, status: 'draft' });
  });
});

describe('buyer addenda (BUY-17)', () => {
  it('lists the tenant’s addenda with their statuses', async () => {
    const kwu = page<{ id: number; status: string }>(await call(TEBOGO, api.addendaList, 'kwu', { query: { tenderId: 2 } }));
    expect(kwu.items.map((row) => [row.id, row.status])).toEqual([
      [22, 'draft'],
      [23, 'awaiting_approval'],
      [21, 'issued'],
    ]);
    const odc = page<{ id: number }>(await call(ODC_OFFICER, api.addendaList, 'odc'));
    expect(odc.items.map((row) => row.id)).toEqual([111]);
  });

  it('shows recipients, acknowledgments and the untouched prior receipts of AC-10', async () => {
    const detail = BuyerAddendumDetail.parse((await call(TEBOGO, api.addendaGet, 'kwu', { params: { addendumId: 21 } })).body);
    expect(detail.acknowledgments).toMatchObject({ recipients: 4, acknowledged: 3, actionOutstanding: 2 });
    expect(detail.recipients.filter((row) => row.hadSubmissionAtIssue).map((row) => row.priorReceiptNo)).toEqual([
      'RCPT-2026-000021',
      'RCPT-2026-000023',
    ]);
    // The addendum left both receipts intact; Tsodilo's own supplement of 25 Sep later superseded its receipt.
    expect(detail.recipients.filter((row) => row.hadSubmissionAtIssue).map((row) => row.priorReceiptStillEffective)).toEqual([true, false]);
    expect(detail.newSubmissionDeadline).toEqual({ at: '2026-10-21T10:00:00Z', timeZone: 'Africa/Gaborone' });
    expect(detail.currentSubmissionDeadline).toEqual({ at: '2026-10-14T10:00:00Z', timeZone: 'Africa/Gaborone' });
  });

  it('links the addendum awaiting approval to its approval request (BUY-17)', async () => {
    const detail = BuyerAddendumDetail.parse((await call(MPHO, api.addendaGet, 'kwu', { params: { addendumId: 23 } })).body);
    expect(detail).toMatchObject({
      status: 'awaiting_approval',
      approvalRequestId: 44,
      approvalStatus: 'pending',
      blockingIssues: ['APPROVAL_PENDING'],
    });
  });

  it('blocks submitting a material addendum without a response-time assessment', async () => {
    const response = await call(TEBOGO, api.addendaSubmit, 'kwu', { params: { addendumId: 22 }, body: {} });
    expect(response.status).toBe(422);
    expect(codeOf(response)).toBe('RESPONSE_TIME_ASSESSMENT_REQUIRED');
  });

  it('issues only approved addenda, to every participant', async () => {
    expect(codeOf(await call(TEBOGO, api.addendaIssue, 'kwu', { params: { addendumId: 23 }, body: { confirmed: true } }))).toBe(
      'ADDENDUM_NOT_APPROVED',
    );
    expect(codeOf(await call(TEBOGO, api.addendaIssue, 'kwu', { params: { addendumId: 21 }, body: { confirmed: true } }))).toBe(
      'ADDENDUM_ALREADY_ISSUED',
    );
    const issued = await call(TEBOGO, api.addendaIssue, 'kwu', { params: { addendumId: 61 }, body: { confirmed: true } });
    expect(issued.status).toBe(200);
    const detail = BuyerAddendumDetail.parse(issued.body);
    expect(detail).toMatchObject({ status: 'issued', resultingVersionNo: 2 });
    // Chobe's effective receipt on T-2026-0006 (bids fixtures) is the prior submission it acknowledges against.
    expect(detail.recipients.map((row) => [row.supplier.name, row.requiredAction, row.priorReceiptNo])).toEqual([
      ['Tsodilo Engineering', 'acknowledge', null],
      ['Chobe Pipe & Valve Supplies', 'acknowledge', 'RCPT-2026-000025'],
    ]);
  });

  it('never withdraws an issued addendum', async () => {
    const response = await call(TEBOGO, api.addendaWithdraw, 'kwu', { params: { addendumId: 21 }, body: { reason: 'Mistake.' } });
    expect(codeOf(response)).toBe('ADDENDUM_ALREADY_ISSUED');
  });

  it('drafts an addendum with status 201 and refuses one on a tender that can no longer be amended', async () => {
    const body = {
      tenderId: 2,
      title: 'Meter box dimensions',
      changeDescription: 'Adds the meter box drawing.',
      reason: 'Several suppliers asked for it.',
      materiality: 'non_material',
      changesScope: false,
      changesTerms: false,
      changesSubmission: false,
      changesEvaluation: false,
      newSubmissionDeadline: null,
      responseTimeAssessment: 'No additional time needed.',
      existingSubmissionAction: 'acknowledge',
      lotIds: [201],
      requirementChanges: [],
      sourceQuestionIds: [206],
    };
    const created = await call(TEBOGO, api.addendaCreate, 'kwu', { body });
    expect(created.status).toBe(201);
    expect(BuyerAddendumDetail.parse(created.body)).toMatchObject({ id: 900, number: 4, status: 'draft' });

    const closed = await call(TEBOGO, api.addendaCreate, 'kwu', { body: { ...body, tenderId: 3, lotIds: [], sourceQuestionIds: [] } });
    expect(codeOf(closed)).toBe('TENDER_NOT_AMENDABLE');

    const past = await call(TEBOGO, api.addendaCreate, 'kwu', {
      body: { ...body, changesSubmission: true, newSubmissionDeadline: '2026-09-01T10:00:00Z' },
    });
    expect(codeOf(past)).toBe('NEW_DEADLINE_IN_PAST');

    const otherBuyer = await call(ODC_OFFICER, api.addendaCreate, 'odc', { body });
    expect(otherBuyer.status).toBe(404);
  });

  it('reminds only recipients with an outstanding action', async () => {
    const reminded = await call(TEBOGO, api.addendaRemind, 'kwu', { params: { addendumId: 21 }, body: {} });
    expect(reminded.status).toBe(200);
    expect((reminded.body as { reminded: Array<{ name: string }> }).reminded.map((row) => row.name)).toEqual([
      'Gaborone Metering Co.',
      'Chobe Pipe & Valve Supplies',
    ]);
    expect(codeOf(await call(TEBOGO, api.addendaRemind, 'kwu', { params: { addendumId: 11 }, body: {} }))).toBe(
      'NO_OUTSTANDING_ACKNOWLEDGMENTS',
    );
  });
});

describe('buyer sessions (BUY-18)', () => {
  it('lists sessions with registrations and open attendance exceptions', async () => {
    const rows = page<{ id: number; openAttendanceExceptions: number }>(await call(TEBOGO, api.sessionsList, 'kwu', { query: { pageSize: 50 } }));
    expect(rows.items.map((row) => row.id).sort((a, b) => a - b)).toEqual([41, 42, 43, 44, 45, 46, 47, 49, 71, 72]);
    expect(rows.items.find((row) => row.id === 45)?.openAttendanceExceptions).toBe(1);
  });

  it('resolves an attendance exception once, the same way for every supplier', async () => {
    const resolved = await call(TEBOGO, api.sessionsResolveException, 'kwu', {
      params: { sessionId: 45, registrationId: 511 },
      body: { resolution: 'confirm_not_met', alternativeSessionId: null, note: 'No alternative date was announced.' },
    });
    expect(resolved.status).toBe(200);
    const detail = BuyerSessionDetail.parse(resolved.body);
    expect(detail.registrations.find((row) => row.id === 511)?.exceptionResolution?.resolution).toBe('confirm_not_met');

    const again = await call(TEBOGO, api.sessionsResolveException, 'kwu', {
      params: { sessionId: 71, registrationId: 533 },
      body: { resolution: 'confirm_not_met', alternativeSessionId: null, note: 'x' },
    });
    expect(codeOf(again)).toBe('EXCEPTION_ALREADY_RESOLVED');
  });

  it('refuses attendance before the session and a new mandatory session after release', async () => {
    const early = await call(TEBOGO, api.sessionsRecordAttendance, 'kwu', {
      params: { sessionId: 43 },
      body: { entries: [{ registrationId: 507, status: 'attended' }] },
    });
    expect(codeOf(early)).toBe('SESSION_NOT_STARTED');

    const session = {
      tenderId: 2,
      lotId: null,
      sessionType: 'site_visit',
      title: 'Meter test bench visit',
      startsAt: '2026-10-12T08:00:00Z',
      endsAt: '2026-10-12T10:00:00Z',
      venue: 'KWU meter workshop, Gaborone',
      instructions: null,
      capacity: 10,
      mandatory: true,
      alternativeOfId: null,
      accessibilityInfo: null,
      registrationDeadline: '2026-10-09T13:00:00Z',
    };
    expect(codeOf(await call(TEBOGO, api.sessionsCreate, 'kwu', { body: session }))).toBe('MANDATORY_REQUIRES_ADDENDUM');
    const created = await call(TEBOGO, api.sessionsCreate, 'kwu', { body: { ...session, mandatory: false } });
    expect(created.status).toBe(201);
    expect(BuyerSessionDetail.parse(created.body)).toMatchObject({ id: 900, status: 'scheduled', placesAvailable: 10 });
  });

  it('records attendance at a held site visit, then publishes its minutes with shared answers (BUY-18)', async () => {
    const held = BuyerSessionDetail.parse((await call(TEBOGO, api.sessionsGet, 'kwu', { params: { sessionId: 49 } })).body);
    expect(held).toMatchObject({ status: 'scheduled', minutesPublishedAt: null, minutesDocument: null, minutesDocumentOptions: [] });
    expect(held.registrations.map((row) => row.status)).toEqual(['registered', 'registered', 'registered']);

    const recorded = await call(TEBOGO, api.sessionsRecordAttendance, 'kwu', {
      params: { sessionId: 49 },
      body: {
        entries: [
          { registrationId: 517, status: 'attended' },
          { registrationId: 518, status: 'attended' },
          { registrationId: 519, status: 'absent' },
        ],
      },
    });
    expect(recorded.status).toBe(200);
    expect(BuyerSessionDetail.parse(recorded.body)).toMatchObject({ status: 'completed', attended: 2, absent: 1, openAttendanceExceptions: 0 });

    const published = await call(TEBOGO, api.sessionsPublishMinutes, 'kwu', {
      params: { sessionId: 49 },
      body: {
        minutesDocumentId: null,
        audience: 'public',
        sharedAnswers: [
          {
            supplierTenantId: 7,
            sanitizedQuestion: 'Are the meters tested at the KWU bench before acceptance?',
            answerText: 'Yes. A 2% sample of each batch is tested on the bench to ISO 4064 before acceptance.',
          },
        ],
      },
    });
    expect(published.status).toBe(200);
    const minutes = BuyerSessionDetail.parse(published.body);
    expect(minutes).toMatchObject({ minutesPublishedAt: '2026-09-30T12:00:00Z', minutesDocument: null });
    expect(minutes.sharedAnswers).toEqual([expect.objectContaining({ audience: 'public', sessionId: 49 })]);
    expect(JSON.stringify(minutes.sharedAnswers)).not.toContain('Serowe');
  });

  it('refuses minutes whose document is not a document of the session, and minutes published twice', async () => {
    const foreign = await call(TEBOGO, api.sessionsPublishMinutes, 'kwu', {
      params: { sessionId: 49 },
      body: { minutesDocumentId: 201, audience: 'all_participants', sharedAnswers: [] },
    });
    expect(foreign.status).toBe(422);
    expect(codeOf(foreign)).toBe('MINUTES_DOCUMENT_NOT_OF_SESSION');
    const twice = await call(TEBOGO, api.sessionsPublishMinutes, 'kwu', {
      params: { sessionId: 41 },
      body: { minutesDocumentId: null, audience: 'all_participants', sharedAnswers: [] },
    });
    expect(codeOf(twice)).toBe('MINUTES_ALREADY_PUBLISHED');
  });

  it('denies the session screens to an evaluator', async () => {
    expect((await call('thato.eval@tenderiq.local', api.sessionsList, 'kwu')).status).toBe(403);
  });
});

describe('supplier questions (SUP-10)', () => {
  it('lists only the supplier’s own questions', async () => {
    const own = page<{ id: number }>(await call(CHOBE, api.supplierQuestionsList, 'chobe-pipe', { query: { pageSize: 50 } }));
    expect(own.items.map((row) => row.id).sort()).toEqual([203, 206, 211, 215, 216, 219, 222]);
  });

  it('never reveals another supplier’s private case', async () => {
    expect((await call(CHOBE, api.supplierQuestionsGet, 'chobe-pipe', { params: { questionId: 212 } })).status).toBe(404);
    const answers = page<{ questionId: number }>(await call(CHOBE, api.supplierPublishedAnswers, 'chobe-pipe', { params: { tenderId: 6 } }));
    expect(answers.items.map((row) => row.questionId)).toEqual([210]);
    expect(JSON.stringify(answers.items)).not.toContain('Tsodilo');
  });

  it('shows the own private answer, but never a draft answer', async () => {
    const privateAnswer = SupplierQuestionDetail.parse(
      (await call(CHOBE, api.supplierQuestionsGet, 'chobe-pipe', { params: { questionId: 203 } })).body,
    );
    expect(privateAnswer).toMatchObject({ status: 'answered_privately', answerAudience: 'private' });
    expect(privateAnswer.answerText).not.toBeNull();

    const draft = SupplierQuestionDetail.parse((await call(GABORONE, api.supplierQuestionsGet, 'gaborone-meter', { params: { questionId: 205 } })).body);
    expect(draft).toMatchObject({ status: 'draft_answer', answerText: null, sanitizedQuestion: null });
  });

  it('limits tenders to those the supplier participates in', async () => {
    const tenders = page<{ reference: string }>(await call(MAKGADIKGADI, api.supplierTenders, 'makgadikgadi'));
    expect(tenders.items.map((row) => row.reference).sort()).toEqual(['T-2026-0001', 'T-2026-0003', 'T-2026-0007', 'T-2026-0008', 'T-2026-0011']);
    expect((await call(MAKGADIKGADI, api.supplierTenderContext, 'makgadikgadi', { params: { tenderId: 6 } })).status).toBe(404);
  });

  it('asks a question with status 201 and flags one after the question deadline', async () => {
    const onTime = await call(TSODILO, api.supplierQuestionsAsk, 'tsodilo', {
      body: { tenderId: 2, lotId: 201, requirementId: 2004, documentId: 201, questionText: 'Is LoRaWAN 1.0.4 acceptable?' },
    });
    expect(onTime.status).toBe(201);
    expect(SupplierQuestionDetail.parse(onTime.body)).toMatchObject({ status: 'received', afterDeadline: false });

    // After the T-2026-0006 question deadline (5 Oct 2026, 15:00) the question is still recorded, and flagged.
    const afterDeadline = await createTestMockApp({ now: () => new Date('2026-10-06T08:00:00Z') });
    const late = await afterDeadline.callAs(CHOBE, api.supplierQuestionsAsk, {
      tenant: 'chobe-pipe',
      body: { tenderId: 6, lotId: null, requirementId: null, documentId: null, questionText: 'Is a spare regulator required?' },
    });
    expect(late.status).toBe(201);
    expect(SupplierQuestionDetail.parse(late.body).afterDeadline).toBe(true);

    const closed = await call(TSODILO, api.supplierQuestionsAsk, 'tsodilo', {
      body: { tenderId: 3, lotId: null, requirementId: null, documentId: null, questionText: 'Late question.' },
    });
    expect(codeOf(closed)).toBe('TENDER_NOT_ACCEPTING_QUESTIONS');

    const invalid = await call(TSODILO, api.supplierQuestionsAsk, 'tsodilo', {
      body: { tenderId: 2, lotId: null, requirementId: null, documentId: null, questionText: '' },
    });
    expect(invalid.status).toBe(422);
  });

  it('refuses to withdraw an answered question', async () => {
    expect(codeOf(await call(CHOBE, api.supplierQuestionsWithdraw, 'chobe-pipe', { params: { questionId: 203 }, body: {} }))).toBe(
      'QUESTION_ALREADY_ANSWERED',
    );
  });
});

describe('supplier addenda (AC-10)', () => {
  it('shows the supplement required of a supplier that had already submitted, with its receipt intact', async () => {
    const rows = page<{ id: number; requiredAction: string; priorSubmission: { receiptNo: string; remainsValid: boolean } | null }>(
      await call(GABORONE, api.supplierAddendaList, 'gaborone-meter'),
    );
    expect(rows.items).toEqual([
      expect.objectContaining({ id: 21, requiredAction: 'supplement', priorSubmission: expect.objectContaining({ receiptNo: 'RCPT-2026-000021', remainsValid: true }) }),
    ]);
  });

  it('keeps an acknowledged addendum on the action list while its supplement is outstanding (AC-10, SUP-10)', async () => {
    const unacknowledged = page<{ id: number }>(await call(GABORONE, api.supplierAddendaList, 'gaborone-meter', { query: { acknowledged: false } }));
    expect(unacknowledged.items).toEqual([]);

    const outstanding = page<{ id: number; acknowledgedAt: string | null; requiredActionCompleted: boolean; actionOutstanding: boolean }>(
      await call(GABORONE, api.supplierAddendaList, 'gaborone-meter', { query: { actionOutstanding: true } }),
    );
    expect(outstanding.items).toEqual([
      expect.objectContaining({ id: 21, acknowledgedAt: '2026-09-24T10:05:00Z', requiredActionCompleted: false, actionOutstanding: true }),
    ]);

    const tender = SupplierTenderContext.parse((await call(GABORONE, api.supplierTenderContext, 'gaborone-meter', { params: { tenderId: 2 } })).body);
    expect(tender).toMatchObject({
      addendaToAcknowledge: 0,
      addendaActionOutstanding: 1,
      nextAddendumAction: {
        addendumId: 21,
        number: 1,
        requiredAction: 'supplement',
        acknowledgmentOutstanding: false,
        submissionActionOutstanding: true,
        dueBy: { at: '2026-10-21T10:00:00Z', timeZone: 'Africa/Gaborone' },
      },
    });
  });

  it('clears the action of a supplier whose supplement was received, and shows its prior receipt as superseded', async () => {
    const rows = page<{ id: number; actionOutstanding: boolean; priorSubmission: { receiptNo: string; remainsValid: boolean } | null }>(
      await call(TSODILO, api.supplierAddendaList, 'tsodilo', { query: { tenderId: 2 } }),
    );
    expect(rows.items).toEqual([
      expect.objectContaining({
        id: 21,
        actionOutstanding: false,
        priorSubmission: { receiptNo: 'RCPT-2026-000023', receivedAt: '2026-09-21T14:03:10Z', remainsValid: false },
      }),
    ]);
    const chobe = SupplierTenderContext.parse((await call(CHOBE, api.supplierTenderContext, 'chobe-pipe', { params: { tenderId: 2 } })).body);
    expect(chobe).toMatchObject({
      addendaToAcknowledge: 1,
      addendaActionOutstanding: 1,
      nextAddendumAction: { requiredAction: 'acknowledge', acknowledgmentOutstanding: true, submissionActionOutstanding: false },
    });
  });

  it('never shows an unissued addendum to a supplier', async () => {
    expect((await call(TSODILO, api.supplierAddendaGet, 'tsodilo', { params: { addendumId: 23 } })).status).toBe(404);
    expect((await call(TSODILO, api.supplierAddendaGet, 'tsodilo', { params: { addendumId: 61 } })).status).toBe(404);
  });

  it('acknowledges once and completes an acknowledge-only action', async () => {
    const acknowledged = await call(CHOBE, api.supplierAddendaAcknowledge, 'chobe-pipe', { params: { addendumId: 21 }, body: { confirmed: true } });
    expect(acknowledged.status).toBe(201);
    expect(AcknowledgmentResult.parse(acknowledged.body)).toMatchObject({ requiredAction: 'acknowledge', requiredActionCompleted: true });

    const again = await call(GABORONE, api.supplierAddendaAcknowledge, 'gaborone-meter', { params: { addendumId: 21 }, body: { confirmed: true } });
    expect(codeOf(again)).toBe('ALREADY_ACKNOWLEDGED');
  });

  it('denies acknowledgment to a contributor without the notices permission', async () => {
    const response = await call('tsodilo.contributor@tenderiq.local', api.supplierAddendaAcknowledge, 'tsodilo', {
      params: { addendumId: 31 },
      body: { confirmed: true },
    });
    expect(response.status).toBe(403);
  });
});

describe('supplier sessions (SUP-11)', () => {
  it('lists the sessions of participating tenders with the own registration only', async () => {
    const rows = page<{ id: number; ownRegistration: { id: number } | null }>(
      await call(GABORONE, api.supplierSessionsList, 'gaborone-meter', { query: { pageSize: 50 } }),
    );
    expect(rows.items.map((row) => row.id).sort()).toEqual([41, 42, 49]);
    expect(rows.items.find((row) => row.id === 42)?.ownRegistration?.id).toBe(505);
    expect((await call(GABORONE, api.supplierSessionsGet, 'gaborone-meter', { params: { sessionId: 43 } })).status).toBe(404);
  });

  it('registers for an alternative date and refuses a second registration', async () => {
    expect(
      codeOf(
        await call(CHOBE, api.supplierSessionsRegister, 'chobe-pipe', {
          params: { sessionId: 43 },
          body: { attendeeNames: ['Bakang Chobe'], accessibilityNeeds: null },
        }),
      ),
    ).toBe('ALREADY_REGISTERED');
    const registered = await call(CHOBE, api.supplierSessionsRegister, 'chobe-pipe', {
      params: { sessionId: 44 },
      body: { attendeeNames: ['Thabo Maano'], accessibilityNeeds: 'Step-free route for one attendee.' },
    });
    expect(registered.status).toBe(201);
    expect(SupplierSessionDetail.parse(registered.body).ownRegistration).toMatchObject({ id: 900, status: 'registered' });
  });

  it('cancels only its own active booking', async () => {
    const cancelled = await call(TSODILO, api.supplierRegistrationCancel, 'tsodilo', { params: { registrationId: 507 }, body: {} });
    expect(SupplierSessionDetail.parse(cancelled.body).ownRegistration?.status).toBe('cancelled');
    expect((await call(CHOBE, api.supplierRegistrationCancel, 'chobe-pipe', { params: { registrationId: 507 }, body: {} })).status).toBe(404);
    expect(
      codeOf(
        await call(TSODILO, api.supplierRegistrationUpdate, 'tsodilo', {
          params: { registrationId: 510 },
          body: { attendeeNames: ['Boago Moremi'], accessibilityNeeds: null },
        }),
      ),
    ).toBe('REGISTRATION_NOT_ACTIVE');
  });
});

describe('public edition (PUB-04)', () => {
  it('shows only public answers and issued addenda, without supplier identities', async () => {
    const response = await app.request('GET', '/api/v1/public/clarifications/kwu/T-2026-0002');
    expect(response.status).toBe(200);
    const edition = PublicClarifications.parse(response.body);
    expect(edition.questions.map((row) => row.questionId).sort()).toEqual([201, 220]);
    expect(edition.addenda.map((row) => row.number)).toEqual([1]);
    const text = JSON.stringify(edition);
    for (const name of ['Gaborone Metering', 'Serowe', 'Chobe', 'Tsodilo']) {
      expect(text).not.toContain(name);
    }
  });

  it('hides invitation-only tenders and references of another buyer', async () => {
    expect((await app.request('GET', '/api/v1/public/clarifications/kwu/T-2026-0006')).status).toBe(404);
    expect((await app.request('GET', '/api/v1/public/clarifications/odc/T-2026-0002')).status).toBe(404);
    expect((await app.request('GET', '/api/v1/public/clarifications/odc/T-2026-0011')).status).toBe(200);
  });
});
