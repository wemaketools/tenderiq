/**
 * Contract-valid response bodies for the clarifications page tests (test data only: the application's data always
 * comes from the API). Every builder parses its result with the contract schema so a drift fails loudly.
 */
import {
  BuyerAddendumDetail,
  BuyerClarificationTender,
  BuyerQuestionDetail,
  BuyerSessionDetail,
  BuyerTenderContext,
  PublicClarifications,
  SupplierAddendumDetail,
  SupplierClarificationTender,
  SupplierQuestionDetail,
  SupplierSessionDetail,
  SupplierTenderContext,
} from '@contracts/clarifications';
import type { PermissionCode } from '@contracts/permissions';

import { makeMembership, makeTenant, signedInSession, stateWith } from '../../test/fixtures';

const TZ = 'Africa/Gaborone';
const TENDER = { tenderId: 2, reference: 'T-2026-0002', title: 'Smart water meter supply' };
const PERSON = { userId: 5, fullName: 'Tebogo Molefe' };
const KWU = { tenantId: 2, name: 'Kalahari Water Utilities (Pilot)' };
const GABORONE = { tenantId: 9, name: 'Gaborone Metering Co.' };

export function pageOf<T>(items: readonly T[]) {
  return { items, total: items.length, page: 1, pageSize: 25 };
}

export function buyerState(permissions: readonly PermissionCode[]) {
  return stateWith(signedInSession({ activeTenant: makeTenant({}, permissions) }));
}

export function supplierState(permissions: readonly PermissionCode[]) {
  return stateWith(
    signedInSession({
      authUserEmail: 'gaborone-meter.bidmanager@tenderiq.local',
      memberships: [
        makeMembership({
          tenantId: 9,
          tenantKind: 'supplier',
          tenantName: 'Gaborone Metering Co.',
          tenantSlug: 'gaborone-meter',
          capacity: 'Bid Manager',
        }),
      ],
      activeTenant: makeTenant(
        {
          tenantId: 9,
          kind: 'supplier',
          name: 'Gaborone Metering Co.',
          slug: 'gaborone-meter',
          capacity: 'Bid Manager',
        },
        permissions,
      ),
    }),
  );
}

export const BUYER_ALL: readonly PermissionCode[] = [
  'tender.view',
  'tender.publish',
  'tender.clarifications.manage',
  'tender.addenda.approve',
  'tender.sessions.manage',
];
export const SUPPLIER_ALL: readonly PermissionCode[] = [
  'supplier.opportunities.view',
  'supplier.pursuit.manage',
  'supplier.response.edit',
  'supplier.notices.acknowledge',
];

export function buyerTender(overrides: Partial<BuyerClarificationTender> = {}) {
  return BuyerClarificationTender.parse({
    ...TENDER,
    status: 'open',
    eventType: 'rfq',
    participation: 'open',
    officialTimeZone: TZ,
    currentVersionNo: 2,
    questionsDeadline: { at: '2026-10-07T10:00:00Z', timeZone: TZ },
    submissionDeadline: { at: '2026-10-21T10:00:00Z', timeZone: TZ },
    owner: PERSON,
    openQuestions: 4,
    unassignedQuestions: 1,
    lateQuestionsAwaitingDisposition: 1,
    addendaInProgress: 2,
    issuedAddenda: 1,
    pendingAcknowledgments: 2,
    upcomingSessions: 1,
    ...overrides,
  });
}

export function tenderContext(overrides: Partial<BuyerTenderContext> = {}) {
  return BuyerTenderContext.parse({
    ...buyerTender(),
    lots: [
      {
        lotId: 21,
        lotNo: 1,
        title: 'Smart meters',
        stage: 'open',
        submissionDeadline: null,
      },
    ],
    requirements: [
      {
        requirementId: 501,
        lotId: null,
        section: 'Quality',
        refCode: 'REQ-Q-01',
        text: 'ISO 9001 certification',
        treatment: 'mandatory_gate',
      },
    ],
    documents: [{ documentId: 71, title: 'Briefing minutes' }],
    participants: [
      {
        supplier: GABORONE,
        hasEffectiveSubmission: true,
        effectiveReceiptNo: 'RCPT-2026-0002-001',
        receivedAt: '2026-10-05T09:00:00Z',
      },
    ],
    amendable: true,
    ...overrides,
  });
}

export function questionDetail(overrides: Partial<BuyerQuestionDetail> = {}) {
  return BuyerQuestionDetail.parse({
    id: 204,
    tender: TENDER,
    supplier: GABORONE,
    askedBy: { userId: 37, fullName: 'Kagiso Metsi' },
    subjectType: 'requirement',
    lot: null,
    requirement: { requirementId: 501, refCode: 'REQ-Q-01' },
    document: null,
    questionText: 'Is an ISO 9001 certificate from our parent company acceptable?',
    submittedAt: '2026-09-28T08:00:00Z',
    afterDeadline: false,
    lateDisposition: null,
    owner: PERSON,
    status: 'draft_answer',
    audience: 'all_participants',
    responseDueAt: '2026-10-02T10:00:00Z',
    publishedAt: null,
    addendumId: null,
    addendumNumber: null,
    sessionId: null,
    lateDispositionReason: null,
    sanitizedQuestion: 'Is a parent company certificate acceptable?',
    answerText: 'Yes, when the certificate scope covers the bidding entity.',
    confidentialityReviewedBy: null,
    timeZone: TZ,
    history: [{ at: '2026-09-28T08:00:00Z', action: 'submitted', actor: null, note: null }],
    ...overrides,
  });
}

export function addendumDetail(overrides: Partial<BuyerAddendumDetail> = {}) {
  return BuyerAddendumDetail.parse({
    id: 21,
    tender: TENDER,
    number: 1,
    title: 'New mandatory requirement REQ-Q-05 and deadline extension',
    materiality: 'material',
    status: 'issued',
    newSubmissionDeadline: { at: '2026-10-21T10:00:00Z', timeZone: TZ },
    existingSubmissionAction: 'supplement',
    affectedLots: [{ lotId: 21, lotNo: 1, title: 'Smart meters' }],
    issuedAt: '2026-10-08T09:00:00Z',
    resultingVersionNo: 2,
    approvalRequestId: 77,
    approvalStatus: 'approved',
    acknowledgments: {
      recipients: 1,
      delivered: 1,
      failed: 0,
      acknowledged: 0,
      actionOutstanding: 1,
    },
    createdAt: '2026-10-06T09:00:00Z',
    createdBy: PERSON,
    changesScope: false,
    changesTerms: false,
    changesSubmission: true,
    changesEvaluation: true,
    changeDescription: 'Adds REQ-Q-05 (meter accuracy certificate) and moves the deadline.',
    reason: 'Clarification question 202 showed the accuracy class was unspecified.',
    responseTimeAssessment: 'One extra week lets suppliers obtain the certificate.',
    currentSubmissionDeadline: { at: '2026-10-14T10:00:00Z', timeZone: TZ },
    requirementChanges: [
      {
        id: 1,
        requirementId: 505,
        refCode: 'REQ-Q-05',
        lotId: 21,
        changeType: 'added',
        previousText: null,
        newText: 'Provide a class B accuracy certificate.',
        previousTreatment: null,
        newTreatment: 'mandatory_gate',
      },
    ],
    notice: {
      noticeId: 3,
      noticeType: 'addendum',
      title: 'Addendum 1',
      issuedAt: '2026-10-08T09:00:00Z',
      requiresAcknowledgment: true,
    },
    recipients: [
      {
        supplier: GABORONE,
        deliveryStatus: 'delivered',
        deliveredAt: '2026-10-08T09:01:00Z',
        openedAt: null,
        acknowledgedAt: null,
        acknowledgedBy: null,
        failureReason: null,
        hadSubmissionAtIssue: true,
        priorReceiptNo: 'RCPT-2026-0002-001',
        priorReceiptStillEffective: true,
        requiredAction: 'supplement',
        requiredActionCompleted: false,
      },
    ],
    sourceQuestions: [],
    blockingIssues: [],
    withdrawnReason: null,
    history: [],
    ...overrides,
  });
}

export function sessionDetail(overrides: Partial<BuyerSessionDetail> = {}) {
  return BuyerSessionDetail.parse({
    id: 41,
    tender: TENDER,
    lot: null,
    sessionType: 'briefing',
    title: 'Pre-bid briefing',
    startsAt: '2026-09-20T08:00:00Z',
    endsAt: '2026-09-20T10:00:00Z',
    timeZone: TZ,
    venue: 'KWU head office, Gaborone',
    instructions: 'Bring identification.',
    capacity: 20,
    placesAvailable: 18,
    mandatory: true,
    alternativeOf: null,
    alternatives: [
      {
        id: 42,
        title: 'Alternative briefing',
        startsAt: '2026-10-09T08:00:00Z',
        placesAvailable: 5,
      },
    ],
    accessibilityInfo: 'Step-free access.',
    registrationDeadline: { at: '2026-09-18T10:00:00Z', timeZone: TZ },
    minutesDocument: null,
    minutesPublishedAt: null,
    status: 'completed',
    registered: 2,
    attended: 1,
    absent: 1,
    accessibilityRequests: 1,
    openAttendanceExceptions: 1,
    registrations: [
      {
        id: 61,
        supplier: GABORONE,
        registeredBy: { userId: 37, fullName: 'Kagiso Metsi' },
        attendeeNames: ['Kagiso Metsi'],
        accessibilityNeeds: 'Wheelchair access',
        status: 'absent',
        attendanceRecordedBy: PERSON,
        attendanceRecordedAt: '2026-09-20T10:30:00Z',
        createdAt: '2026-09-10T08:00:00Z',
        attendanceException: true,
        exceptionResolution: null,
      },
    ],
    minutesDocumentOptions: [],
    sharedAnswers: [],
    cancellationReason: null,
    history: [],
    ...overrides,
  });
}

export function supplierTender(overrides: Partial<SupplierClarificationTender> = {}) {
  return SupplierClarificationTender.parse({
    ...TENDER,
    buyer: KWU,
    status: 'open',
    officialTimeZone: TZ,
    currentVersionNo: 2,
    questionsDeadline: { at: '2026-12-07T10:00:00Z', timeZone: TZ },
    submissionDeadline: { at: '2026-12-21T10:00:00Z', timeZone: TZ },
    acceptingQuestions: true,
    ownQuestions: 2,
    awaitingAnswer: 1,
    publishedAnswers: 3,
    addendaToAcknowledge: 1,
    addendaActionOutstanding: 1,
    nextAddendumAction: {
      addendumId: 21,
      number: 1,
      requiredAction: 'supplement',
      acknowledgmentOutstanding: true,
      submissionActionOutstanding: true,
      dueBy: { at: '2026-12-21T10:00:00Z', timeZone: TZ },
    },
    upcomingSessions: 1,
    ...overrides,
  });
}

export function supplierContext(overrides: Partial<SupplierTenderContext> = {}) {
  return SupplierTenderContext.parse({
    ...supplierTender(),
    lots: [{ lotId: 21, lotNo: 1, title: 'Smart meters' }],
    requirements: tenderContext().requirements,
    documents: [{ documentId: 70, title: 'Tender document' }],
    ...overrides,
  });
}

export function supplierQuestion(overrides: Partial<SupplierQuestionDetail> = {}) {
  return SupplierQuestionDetail.parse({
    id: 206,
    tender: TENDER,
    buyer: KWU,
    askedBy: { userId: 37, fullName: 'Kagiso Metsi' },
    subjectType: 'tender',
    lot: null,
    requirement: null,
    document: null,
    questionText: 'Can meters be delivered in two batches?',
    submittedAt: '2026-09-29T08:00:00Z',
    afterDeadline: false,
    lateDisposition: null,
    status: 'received',
    answerAudience: null,
    answerText: null,
    sanitizedQuestion: null,
    answeredAt: null,
    addendumNumber: null,
    lateDispositionReason: null,
    timeZone: TZ,
    ...overrides,
  });
}

export function supplierAddendum(overrides: Partial<SupplierAddendumDetail> = {}) {
  return SupplierAddendumDetail.parse({
    id: 21,
    tender: TENDER,
    buyer: KWU,
    number: 1,
    title: 'New mandatory requirement REQ-Q-05 and deadline extension',
    materiality: 'material',
    issuedAt: '2026-10-08T09:00:00Z',
    resultingVersionNo: 2,
    newSubmissionDeadline: { at: '2026-10-21T10:00:00Z', timeZone: TZ },
    affectedLots: [{ lotId: 21, lotNo: 1, title: 'Smart meters' }],
    acknowledgmentRequired: true,
    requiredAction: 'supplement',
    requiredActionCompleted: false,
    actionOutstanding: true,
    deliveredAt: '2026-10-08T09:01:00Z',
    openedAt: null,
    acknowledgedAt: null,
    acknowledgedBy: null,
    priorSubmission: {
      receiptNo: 'RCPT-2026-0002-001',
      receivedAt: '2026-10-05T09:00:00Z',
      remainsValid: true,
    },
    changesScope: false,
    changesTerms: false,
    changesSubmission: true,
    changesEvaluation: true,
    changeDescription: 'Adds REQ-Q-05 (meter accuracy certificate) and moves the deadline.',
    reason: 'The accuracy class was unspecified.',
    existingSubmissionAction: 'supplement',
    previousSubmissionDeadline: { at: '2026-10-14T10:00:00Z', timeZone: TZ },
    requirementChanges: addendumDetail().requirementChanges,
    ...overrides,
  });
}

export function supplierSession(overrides: Partial<SupplierSessionDetail> = {}) {
  const core = sessionDetail({
    status: 'scheduled',
    startsAt: '2026-12-09T08:00:00Z',
    endsAt: '2026-12-09T10:00:00Z',
    registrationDeadline: { at: '2026-12-08T10:00:00Z', timeZone: TZ },
  });
  return SupplierSessionDetail.parse({
    ...core,
    buyer: KWU,
    ownRegistration: null,
    registrationOpen: true,
    ...overrides,
  });
}

export function publicEditionBody(overrides: Partial<PublicClarifications> = {}) {
  return PublicClarifications.parse({
    tender: {
      reference: 'T-2026-0002',
      title: 'Smart water meter supply',
      buyer: { slug: 'kwu', name: 'Kalahari Water Utilities (Pilot)' },
      status: 'open',
      officialTimeZone: TZ,
      currentVersionNo: 2,
      submissionDeadline: { at: '2026-10-21T10:00:00Z', timeZone: TZ },
      lots: [{ lotId: 21, lotNo: 1, title: 'Smart meters' }],
    },
    questions: [
      {
        questionId: 201,
        sanitizedQuestion: 'Are prepaid meters in scope?',
        answerText: 'Yes, lot 1 includes prepaid meters.',
        audience: 'public',
        publishedAt: '2026-10-01T09:00:00Z',
        lot: null,
        requirement: null,
        sessionId: null,
      },
    ],
    addenda: [
      {
        addendumId: 21,
        number: 1,
        title: 'New mandatory requirement REQ-Q-05 and deadline extension',
        changeDescription: 'Adds REQ-Q-05 and moves the deadline.',
        materiality: 'material',
        issuedAt: '2026-10-08T09:00:00Z',
        resultingVersionNo: 2,
        newSubmissionDeadline: { at: '2026-10-21T10:00:00Z', timeZone: TZ },
        affectedLots: [{ lotId: 21, lotNo: 1, title: 'Smart meters' }],
        changesScope: false,
        changesTerms: false,
        changesSubmission: true,
        changesEvaluation: true,
        requirementChanges: [
          {
            refCode: 'REQ-Q-05',
            lotId: 21,
            changeType: 'added',
            previousText: null,
            newText: 'Provide a class B accuracy certificate.',
            previousTreatment: null,
            newTreatment: 'mandatory_gate',
          },
        ],
      },
    ],
    editionAt: '2026-10-08T09:00:00Z',
    ...overrides,
  });
}
