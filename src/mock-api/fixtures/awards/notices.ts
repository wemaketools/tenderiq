/**
 * Awards fixtures, part 3: outcome notices, recipients, standstill periods and holds (BUY-28; FR-17, BR-32, BR-41,
 * BR-42; AC-25, AC-26).
 *
 * - T-2026-0001: intent (lot 1), unsuccessful (Chobe, lot 1), cancellation (lot 2), a standstill change (extension
 *   while Chobe's complaint was answered), a complaint update and the final award notice. The lot 1 standstill
 *   completed after its extension; Chobe's complaint hold was released before the final award.
 * - T-2026-0007: intent and unsuccessful notices (the e-mail delivery of the intent notice to Tsodilo failed and awaits a resend), a
 *   complaint update announcing the hold, and a DRAFT final award notice that cannot be issued while the hold is
 *   active. The standstill is running; Limpopo's complaint hold blocks final award and contract signature (AC-25).
 * - T-2026-0009: preferred-bidder notices (selection domain): Serowe ICT selected, then withdrawn after failed due
 *   diligence; Limpopo selected under the declared contingency. Each states that it is NOT an award (BR-31).
 * - T-2026-0010: intent, unsuccessful and final award notices; the standstill completed.
 *
 * The T-2026-0007 standstill counts 10 working days on the Botswana Public Holidays 2026 calendar from transmission
 * on Tue 22 Sep 2026: 23, 24, 25, 28, 29 Sep, (30 Sep and 1 Oct are holidays), 2, 5, 6, 7, 8 Oct → ends on
 * 8 Oct 2026, 17:00 Africa/Gaborone (15:00 UTC). The debrief window (5 working days) ends on 29 Sep 2026, 17:00.
 */
import type { Hold, OutcomeNoticeDetail, StandstillPeriod } from '../../../contracts/awards.js';
import { TENANT_IDS } from '../platform.js';
import { USERS, deadline, lotRef, person, supplier } from './base.js';

export interface OutcomeNoticeFixture {
  readonly tenantId: number;
  /** Supplier-facing: the notice asks the recipient to accept terms (for example the final award terms). */
  readonly hasTerms: boolean;
  readonly detail: OutcomeNoticeDetail;
}

type Recipient = OutcomeNoticeDetail['recipients'][number];

function recipient(
  recipientId: number,
  slug: Parameters<typeof supplier>[0],
  userId: number,
  state: Partial<Omit<Recipient, 'recipientId' | 'supplier' | 'recipientUser'>> & { deliveredAt: string | null },
): Recipient {
  return {
    recipientId,
    supplier: supplier(slug),
    recipientUser: person(userId),
    deliveryStatus: state.deliveryStatus ?? (state.deliveredAt === null ? 'pending' : 'delivered'),
    deliveredAt: state.deliveredAt,
    openedAt: state.openedAt ?? null,
    acknowledgedAt: state.acknowledgedAt ?? null,
    acknowledgedBy: state.acknowledgedBy ?? null,
    termsAcceptedAt: state.termsAcceptedAt ?? null,
    failureReason: state.failureReason ?? null,
  };
}

function counts(recipients: readonly Recipient[]) {
  return {
    recipientCount: recipients.length,
    deliveredCount: recipients.filter((row) => row.deliveryStatus === 'delivered').length,
    failedCount: recipients.filter((row) => row.deliveryStatus === 'failed').length,
    acknowledgedCount: recipients.filter((row) => row.acknowledgedAt !== null).length,
  };
}

const REVIEWED = (userId: number, at: string, note: string | null): OutcomeNoticeDetail['disclosureReview'] => ({
  status: 'completed',
  reviewedBy: person(userId),
  reviewedAt: at,
  note,
});

function notice(
  base: Omit<OutcomeNoticeDetail, 'recipientCount' | 'deliveredCount' | 'failedCount' | 'acknowledgedCount'>,
): OutcomeNoticeDetail {
  return { ...base, ...counts(base.recipients) };
}

// ---------------------------------------------------------------------------------------------------------
// T-2026-0001
// ---------------------------------------------------------------------------------------------------------

const T1_INTENT_RECIPIENTS = [
  recipient(5101, 'tsodilo', USERS.tsodiloBidManager, {
    deliveredAt: '2026-08-06T08:00:05Z',
    openedAt: '2026-08-06T08:40:00Z',
    acknowledgedAt: '2026-08-06T09:02:00Z',
    acknowledgedBy: person(USERS.tsodiloBidManager),
  }),
  recipient(5102, 'chobe-pipe', USERS.chobeBidManager, {
    deliveredAt: '2026-08-06T08:00:06Z',
    openedAt: '2026-08-06T10:15:00Z',
    acknowledgedAt: '2026-08-06T10:20:00Z',
    acknowledgedBy: person(USERS.chobeBidManager),
  }),
];

const T1_FINAL_RECIPIENTS = [
  recipient(5601, 'tsodilo', USERS.tsodiloSignatory, {
    deliveredAt: '2026-09-04T08:00:04Z',
    openedAt: '2026-09-04T09:10:00Z',
    acknowledgedAt: '2026-09-04T09:12:00Z',
    acknowledgedBy: person(USERS.tsodiloSignatory),
    termsAcceptedAt: '2026-09-05T07:30:00Z',
  }),
  recipient(5602, 'chobe-pipe', USERS.chobeBidManager, {
    deliveredAt: '2026-09-04T08:00:05Z',
    openedAt: '2026-09-04T11:00:00Z',
    acknowledgedAt: '2026-09-04T11:05:00Z',
    acknowledgedBy: person(USERS.chobeBidManager),
  }),
];

// ---------------------------------------------------------------------------------------------------------
// T-2026-0007
// ---------------------------------------------------------------------------------------------------------

const T7_INTENT_RECIPIENTS = [
  recipient(5701, 'makgadikgadi', USERS.makgadikgadiAdmin, {
    deliveredAt: '2026-09-22T08:00:05Z',
    openedAt: '2026-09-22T08:30:00Z',
    acknowledgedAt: '2026-09-22T08:35:00Z',
    acknowledgedBy: person(USERS.makgadikgadiAdmin),
  }),
  recipient(5702, 'tsodilo', USERS.tsodiloBidManager, {
    deliveredAt: null,
    deliveryStatus: 'failed',
    failureReason: 'The recipient mail server rejected the message (mailbox full). The in-app notice is available.',
  }),
  recipient(5703, 'limpopo-env', USERS.limpopoAdmin, {
    deliveredAt: '2026-09-22T08:00:06Z',
    openedAt: '2026-09-22T09:45:00Z',
    acknowledgedAt: '2026-09-22T09:50:00Z',
    acknowledgedBy: person(USERS.limpopoAdmin),
  }),
];

const T7_UNSUCCESSFUL_RECIPIENTS = [
  recipient(5801, 'tsodilo', USERS.tsodiloBidManager, { deliveredAt: '2026-09-22T08:05:04Z', openedAt: '2026-09-22T12:02:00Z' }),
  recipient(5802, 'limpopo-env', USERS.limpopoAdmin, {
    deliveredAt: '2026-09-22T08:05:05Z',
    openedAt: '2026-09-22T09:46:00Z',
    acknowledgedAt: '2026-09-22T09:52:00Z',
    acknowledgedBy: person(USERS.limpopoAdmin),
  }),
];

const T7_COMPLAINT_UPDATE_RECIPIENTS = [
  recipient(5901, 'makgadikgadi', USERS.makgadikgadiAdmin, { deliveredAt: '2026-09-25T12:30:05Z', openedAt: '2026-09-25T13:00:00Z' }),
  recipient(5902, 'tsodilo', USERS.tsodiloBidManager, { deliveredAt: '2026-09-25T12:30:05Z' }),
  recipient(5903, 'limpopo-env', USERS.limpopoAdmin, { deliveredAt: '2026-09-25T12:30:06Z', openedAt: '2026-09-25T12:45:00Z' }),
];

// ---------------------------------------------------------------------------------------------------------
// T-2026-0009 (preferred-bidder notices, issued by the selection domain; never an award: BR-31)
// ---------------------------------------------------------------------------------------------------------

const T9_SEROWE_PREFERRED_RECIPIENTS = [
  recipient(6801, 'serowe-ict', USERS.seroweBidManager, {
    deliveredAt: '2026-09-08T10:00:04Z',
    openedAt: '2026-09-08T10:40:00Z',
    acknowledgedAt: '2026-09-08T10:45:00Z',
    acknowledgedBy: person(USERS.seroweBidManager),
  }),
];

const T9_SEROWE_WITHDRAWN_RECIPIENTS = [
  recipient(6901, 'serowe-ict', USERS.seroweBidManager, {
    deliveredAt: '2026-09-18T12:00:04Z',
    openedAt: '2026-09-18T12:30:00Z',
    acknowledgedAt: '2026-09-18T12:32:00Z',
    acknowledgedBy: person(USERS.seroweBidManager),
  }),
];

const T9_LIMPOPO_PREFERRED_RECIPIENTS = [
  recipient(7001, 'limpopo-env', USERS.limpopoAdmin, {
    deliveredAt: '2026-09-21T12:00:05Z',
    openedAt: '2026-09-21T13:10:00Z',
    acknowledgedAt: '2026-09-21T13:15:00Z',
    acknowledgedBy: person(USERS.limpopoAdmin),
  }),
];

// ---------------------------------------------------------------------------------------------------------
// T-2026-0010
// ---------------------------------------------------------------------------------------------------------

const T10_INTENT_RECIPIENTS = [
  recipient(6501, 'tsodilo', USERS.tsodiloBidManager, {
    deliveredAt: '2026-02-16T08:00:04Z',
    openedAt: '2026-02-16T08:20:00Z',
    acknowledgedAt: '2026-02-16T08:25:00Z',
    acknowledgedBy: person(USERS.tsodiloBidManager),
  }),
  recipient(6502, 'makgadikgadi', USERS.makgadikgadiAdmin, {
    deliveredAt: '2026-02-16T08:00:05Z',
    openedAt: '2026-02-17T07:00:00Z',
    acknowledgedAt: '2026-02-17T07:05:00Z',
    acknowledgedBy: person(USERS.makgadikgadiAdmin),
  }),
];

/** Every outcome notice. */
export const OUTCOME_NOTICES: readonly OutcomeNoticeFixture[] = Object.freeze([
  {
    tenantId: TENANT_IDS.kwu,
    hasTerms: false,
    detail: notice({
      noticeId: 51,
      tenderId: 1,
      noticeType: 'intent_to_award',
      version: 1,
      title: 'Intention to award — T-2026-0001 lot 1',
      status: 'issued',
      lotNos: [1],
      requiresAcknowledgment: true,
      periodStartBasis: 'transmission',
      issuedAt: '2026-08-06T08:00:00Z',
      issuedBy: person(USERS.tebogo),
      body:
        'Kalahari Water Utilities intends to award lot 1 (Submersible borehole pumps — Central District) to Tsodilo Engineering (Pty) Ltd at BWP 5,340,000.00. This is not a final award. A standstill period of 10 working days (Botswana Public Holidays 2026 calendar) starts on transmission of this notice and ends on 20 Aug 2026, 17:00 (UTC+02:00) Africa/Gaborone.',
      audienceDescription: 'Every supplier with an effective offer on lot 1.',
      approvalRequestId: 35,
      disclosureReview: REVIEWED(USERS.dineo, '2026-08-05T15:00:00Z', 'Values disclosed as permitted by the notice policy.'),
      recipients: T1_INTENT_RECIPIENTS,
    }),
  },
  {
    tenantId: TENANT_IDS.kwu,
    hasTerms: false,
    detail: notice({
      noticeId: 52,
      tenderId: 1,
      noticeType: 'unsuccessful_outcome',
      version: 1,
      title: 'Outcome of your offer — T-2026-0001 lot 1',
      status: 'issued',
      lotNos: [1],
      requiresAcknowledgment: false,
      periodStartBasis: null,
      issuedAt: '2026-08-06T08:05:00Z',
      issuedBy: person(USERS.tebogo),
      body:
        'Your offer for lot 1 was compliant and ranked second (78.25 points). It was not successful because the successful offer scored higher on technical merit (pump efficiency and service network). You may request a debriefing within 5 working days and lodge a complaint within 10 working days of this notice.',
      audienceDescription: 'Each unsuccessful lot 1 supplier receives its own result.',
      approvalRequestId: 35,
      disclosureReview: REVIEWED(USERS.dineo, '2026-08-05T15:05:00Z', null),
      recipients: [
        recipient(5201, 'chobe-pipe', USERS.chobeBidManager, {
          deliveredAt: '2026-08-06T08:05:04Z',
          openedAt: '2026-08-06T10:16:00Z',
        }),
      ],
    }),
  },
  {
    tenantId: TENANT_IDS.kwu,
    hasTerms: false,
    detail: notice({
      noticeId: 53,
      tenderId: 1,
      noticeType: 'cancellation',
      version: 1,
      title: 'Cancellation of lot 2 — T-2026-0001',
      status: 'issued',
      lotNos: [2],
      requiresAcknowledgment: true,
      periodStartBasis: null,
      issuedAt: '2026-08-06T08:10:00Z',
      issuedBy: person(USERS.tebogo),
      body:
        'Lot 2 (Solar pumping systems — Kgalagadi) is cancelled because no compliant offer was received. Both offers failed mandatory requirement REQ-T-02 (solar array sizing for each site). The lot will be re-tendered after a scope redesign.',
      audienceDescription: 'Every supplier with an offer on lot 2.',
      approvalRequestId: 35,
      disclosureReview: REVIEWED(USERS.dineo, '2026-08-05T15:10:00Z', null),
      recipients: [
        recipient(5301, 'chobe-pipe', USERS.chobeBidManager, {
          deliveredAt: '2026-08-06T08:10:04Z',
          openedAt: '2026-08-06T10:18:00Z',
          acknowledgedAt: '2026-08-06T10:21:00Z',
          acknowledgedBy: person(USERS.chobeBidManager),
        }),
      ],
    }),
  },
  {
    tenantId: TENANT_IDS.kwu,
    hasTerms: false,
    detail: notice({
      noticeId: 54,
      tenderId: 1,
      noticeType: 'standstill_change',
      version: 1,
      title: 'Standstill extended — T-2026-0001 lot 1',
      status: 'issued',
      lotNos: [1],
      requiresAcknowledgment: false,
      periodStartBasis: null,
      issuedAt: '2026-08-17T08:00:00Z',
      issuedBy: person(USERS.tebogo),
      body:
        'The standstill for lot 1 is extended to 24 Aug 2026, 17:00 (UTC+02:00) Africa/Gaborone so that the complaint received on 14 Aug 2026 can be answered before it ends. No other date changes.',
      audienceDescription: 'Every supplier with an effective offer on lot 1.',
      approvalRequestId: null,
      disclosureReview: REVIEWED(USERS.dineo, '2026-08-14T16:00:00Z', null),
      recipients: [
        recipient(5401, 'tsodilo', USERS.tsodiloBidManager, { deliveredAt: '2026-08-17T08:00:04Z', openedAt: '2026-08-17T09:00:00Z' }),
        recipient(5402, 'chobe-pipe', USERS.chobeBidManager, { deliveredAt: '2026-08-17T08:00:05Z', openedAt: '2026-08-17T09:30:00Z' }),
      ],
    }),
  },
  {
    tenantId: TENANT_IDS.kwu,
    hasTerms: false,
    detail: notice({
      noticeId: 55,
      tenderId: 1,
      noticeType: 'complaint_update',
      version: 1,
      title: 'Complaint CMP-2026-0001 — decision',
      status: 'issued',
      lotNos: [1],
      requiresAcknowledgment: false,
      periodStartBasis: null,
      issuedAt: '2026-08-21T14:00:00Z',
      issuedBy: person(USERS.dineo),
      body:
        'The complaint about the lot 1 evaluation has been investigated by an independent case owner and is dismissed. The reasons are set out in the case response. An appeal may be lodged within 5 working days.',
      audienceDescription: 'The complainant.',
      approvalRequestId: null,
      disclosureReview: REVIEWED(USERS.mpho, '2026-08-21T12:00:00Z', null),
      recipients: [
        recipient(5501, 'chobe-pipe', USERS.chobeBidManager, { deliveredAt: '2026-08-21T14:00:04Z', openedAt: '2026-08-21T15:00:00Z' }),
      ],
    }),
  },
  {
    tenantId: TENANT_IDS.kwu,
    hasTerms: true,
    detail: notice({
      noticeId: 56,
      tenderId: 1,
      noticeType: 'final_award',
      version: 1,
      title: 'Final award — T-2026-0001 lot 1',
      status: 'issued',
      lotNos: [1],
      requiresAcknowledgment: true,
      periodStartBasis: null,
      issuedAt: '2026-09-04T09:00:00Z',
      issuedBy: person(USERS.tebogo),
      body:
        'Lot 1 is finally awarded to Tsodilo Engineering (Pty) Ltd at BWP 5,340,000.00. This notice does not form the contract: the contract is prepared separately and binds only once signed. The successful supplier is asked to accept the award terms and nominate its signatory.',
      audienceDescription: 'Every supplier with an effective offer on lot 1.',
      approvalRequestId: null,
      disclosureReview: REVIEWED(USERS.dineo, '2026-09-03T15:00:00Z', null),
      recipients: T1_FINAL_RECIPIENTS,
    }),
  },
  {
    tenantId: TENANT_IDS.kwu,
    hasTerms: false,
    detail: notice({
      noticeId: 57,
      tenderId: 7,
      noticeType: 'intent_to_award',
      version: 1,
      title: 'Intention to award — T-2026-0007',
      status: 'issued',
      lotNos: [1],
      requiresAcknowledgment: true,
      periodStartBasis: 'transmission',
      issuedAt: '2026-09-22T08:00:00Z',
      issuedBy: person(USERS.tebogo),
      body:
        'Kalahari Water Utilities intends to award the reservoir rehabilitation works to Makgadikgadi Civil Works at BWP 7,850,000.00. This is not a final award and no contract is formed. A standstill period of 10 working days (Botswana Public Holidays 2026 calendar; 30 Sep and 1 Oct are public holidays) starts on transmission and ends on 8 Oct 2026, 17:00 (UTC+02:00) Africa/Gaborone.',
      audienceDescription: 'Every supplier with an effective offer.',
      approvalRequestId: 38,
      disclosureReview: REVIEWED(USERS.dineo, '2026-09-21T14:00:00Z', null),
      recipients: T7_INTENT_RECIPIENTS,
    }),
  },
  {
    tenantId: TENANT_IDS.kwu,
    hasTerms: false,
    detail: notice({
      noticeId: 58,
      tenderId: 7,
      noticeType: 'unsuccessful_outcome',
      version: 1,
      title: 'Outcome of your offer — T-2026-0007',
      status: 'issued',
      lotNos: [1],
      requiresAcknowledgment: true,
      periodStartBasis: null,
      issuedAt: '2026-09-22T08:05:00Z',
      issuedBy: person(USERS.tebogo),
      body:
        'Your offer was compliant but not successful. Each recipient receives its own score and rank in this notice. You may request a debriefing within 5 working days of this notice (by 29 Sep 2026, 17:00 (UTC+02:00) Africa/Gaborone) and lodge a complaint within 10 working days (by 8 Oct 2026, 17:00 (UTC+02:00) Africa/Gaborone).',
      audienceDescription: 'Each unsuccessful supplier receives its own result.',
      approvalRequestId: 38,
      disclosureReview: REVIEWED(USERS.dineo, '2026-09-21T14:10:00Z', 'Each notice shows the recipient’s own score only.'),
      recipients: T7_UNSUCCESSFUL_RECIPIENTS,
    }),
  },
  {
    tenantId: TENANT_IDS.kwu,
    hasTerms: false,
    detail: notice({
      noticeId: 59,
      tenderId: 7,
      noticeType: 'complaint_update',
      version: 1,
      title: 'Complaint received — award of T-2026-0007 on hold',
      status: 'issued',
      lotNos: [1],
      requiresAcknowledgment: false,
      periodStartBasis: null,
      issuedAt: '2026-09-25T12:30:00Z',
      issuedBy: person(USERS.dineo),
      body:
        'A complaint about the evaluation has been received within the complaint window. The final award and contract signature are on hold until the complaint is decided. The standstill end date is not changed by the hold.',
      audienceDescription: 'Every supplier with an effective offer.',
      approvalRequestId: null,
      disclosureReview: REVIEWED(USERS.mpho, '2026-09-25T12:00:00Z', 'The complainant is not named.'),
      recipients: T7_COMPLAINT_UPDATE_RECIPIENTS,
    }),
  },
  {
    tenantId: TENANT_IDS.kwu,
    hasTerms: true,
    detail: notice({
      noticeId: 60,
      tenderId: 7,
      noticeType: 'final_award',
      version: 1,
      title: 'Final award — T-2026-0007',
      status: 'draft',
      lotNos: [1],
      requiresAcknowledgment: true,
      periodStartBasis: null,
      issuedAt: null,
      issuedBy: null,
      body:
        'The reservoir rehabilitation works are finally awarded to Makgadikgadi Civil Works at BWP 7,850,000.00. This notice does not form the contract.',
      audienceDescription: 'Every supplier with an effective offer.',
      approvalRequestId: null,
      disclosureReview: { status: 'pending', reviewedBy: null, reviewedAt: null, note: null },
      recipients: [],
    }),
  },
  {
    tenantId: TENANT_IDS.kwu,
    hasTerms: false,
    detail: notice({
      noticeId: 68,
      tenderId: 9,
      noticeType: 'preferred_bidder',
      version: 1,
      title: 'Preferred bidder selection — T-2026-0009',
      status: 'issued',
      lotNos: [1],
      requiresAcknowledgment: true,
      periodStartBasis: null,
      issuedAt: '2026-09-08T10:00:00Z',
      issuedBy: person(USERS.tebogo),
      body:
        'Kalahari Water Utilities has selected Serowe ICT Solutions as the preferred bidder for the acoustic leak detection services. This is not an award and no contract is formed. The selection is conditional on due diligence (financial position, professional indemnity insurance and key personnel). An award, if any, will follow only after an approved recommendation and an intention-to-award notice.',
      audienceDescription: 'The preferred bidder only.',
      approvalRequestId: null,
      disclosureReview: REVIEWED(USERS.dineo, '2026-09-08T09:00:00Z', 'Only the recipient’s own status is stated.'),
      recipients: T9_SEROWE_PREFERRED_RECIPIENTS,
    }),
  },
  {
    tenantId: TENANT_IDS.kwu,
    hasTerms: false,
    detail: notice({
      noticeId: 69,
      tenderId: 9,
      noticeType: 'preferred_bidder',
      version: 1,
      title: 'Preferred bidder status withdrawn — T-2026-0009',
      status: 'issued',
      lotNos: [1],
      requiresAcknowledgment: true,
      periodStartBasis: null,
      issuedAt: '2026-09-18T12:00:00Z',
      issuedBy: person(USERS.tebogo),
      body:
        'Your preferred-bidder status for the acoustic leak detection services is withdrawn because due diligence on your financial position was not satisfied (audited 2025 statements and the parent guarantee required by clause 4.3). No award was made to you. Kalahari Water Utilities has applied the contingency declared in the stage-two conditions.',
      audienceDescription: 'The former preferred bidder only.',
      approvalRequestId: null,
      disclosureReview: REVIEWED(USERS.dineo, '2026-09-18T11:00:00Z', 'The fallback supplier is not named.'),
      recipients: T9_SEROWE_WITHDRAWN_RECIPIENTS,
    }),
  },
  {
    tenantId: TENANT_IDS.kwu,
    hasTerms: false,
    detail: notice({
      noticeId: 70,
      tenderId: 9,
      noticeType: 'preferred_bidder',
      version: 1,
      title: 'Preferred bidder selection — T-2026-0009',
      status: 'issued',
      lotNos: [1],
      requiresAcknowledgment: true,
      periodStartBasis: null,
      issuedAt: '2026-09-21T12:00:00Z',
      issuedBy: person(USERS.tebogo),
      body:
        'Kalahari Water Utilities has selected Limpopo Environmental Services as the preferred bidder for the acoustic leak detection services, under the contingency declared in the stage-two conditions. This is not an award and no contract is formed. The selection is conditional on due diligence (professional indemnity insurance verified with the insurer) and on the key-personnel interview of 7 Oct 2026. An award, if any, will follow only after an approved recommendation and an intention-to-award notice.',
      audienceDescription: 'The preferred bidder only.',
      approvalRequestId: null,
      disclosureReview: REVIEWED(USERS.dineo, '2026-09-21T11:00:00Z', 'Only the recipient’s own status is stated.'),
      recipients: T9_LIMPOPO_PREFERRED_RECIPIENTS,
    }),
  },
  {
    tenantId: TENANT_IDS.kwu,
    hasTerms: false,
    detail: notice({
      noticeId: 65,
      tenderId: 10,
      noticeType: 'intent_to_award',
      version: 1,
      title: 'Intention to award — T-2026-0010',
      status: 'issued',
      lotNos: [1],
      requiresAcknowledgment: true,
      periodStartBasis: 'transmission',
      issuedAt: '2026-02-16T08:00:00Z',
      issuedBy: person(USERS.tebogo),
      body:
        'Kalahari Water Utilities intends to award fleet vehicle maintenance to Tsodilo Engineering (Pty) Ltd at BWP 1,850,000.00 for twelve months (with renewal and extension options). This is not a final award. A standstill of 10 calendar days ends on 26 Feb 2026, 17:00 (UTC+02:00) Africa/Gaborone.',
      audienceDescription: 'Every supplier with an effective quotation.',
      approvalRequestId: null,
      disclosureReview: REVIEWED(USERS.dineo, '2026-02-13T14:00:00Z', null),
      recipients: T10_INTENT_RECIPIENTS,
    }),
  },
  {
    tenantId: TENANT_IDS.kwu,
    hasTerms: false,
    detail: notice({
      noticeId: 66,
      tenderId: 10,
      noticeType: 'unsuccessful_outcome',
      version: 1,
      title: 'Outcome of your quotation — T-2026-0010',
      status: 'issued',
      lotNos: [1],
      requiresAcknowledgment: false,
      periodStartBasis: null,
      issuedAt: '2026-02-16T08:05:00Z',
      issuedBy: person(USERS.tebogo),
      body:
        'Your quotation was compliant and ranked second (74.80 points). The successful quotation scored higher on workshop capacity and response times. You may request a debriefing within 10 working days of this notice (by 2 Mar 2026).',
      audienceDescription: 'Each unsuccessful supplier receives its own result.',
      approvalRequestId: null,
      disclosureReview: REVIEWED(USERS.dineo, '2026-02-13T14:05:00Z', null),
      recipients: [
        recipient(6601, 'makgadikgadi', USERS.makgadikgadiAdmin, { deliveredAt: '2026-02-16T08:05:04Z', openedAt: '2026-02-17T07:01:00Z' }),
      ],
    }),
  },
  {
    tenantId: TENANT_IDS.kwu,
    hasTerms: true,
    detail: notice({
      noticeId: 67,
      tenderId: 10,
      noticeType: 'final_award',
      version: 1,
      title: 'Final award — T-2026-0010',
      status: 'issued',
      lotNos: [1],
      requiresAcknowledgment: true,
      periodStartBasis: null,
      issuedAt: '2026-03-06T10:00:00Z',
      issuedBy: person(USERS.tebogo),
      body:
        'Fleet vehicle maintenance is finally awarded to Tsodilo Engineering (Pty) Ltd at BWP 1,850,000.00. The contract (C-2026-0001) is prepared separately and binds only once signed.',
      audienceDescription: 'Every supplier with an effective quotation.',
      approvalRequestId: null,
      disclosureReview: REVIEWED(USERS.dineo, '2026-03-05T14:00:00Z', null),
      recipients: [
        recipient(6701, 'tsodilo', USERS.tsodiloSignatory, {
          deliveredAt: '2026-03-06T08:00:04Z',
          openedAt: '2026-03-06T08:30:00Z',
          acknowledgedAt: '2026-03-06T08:32:00Z',
          acknowledgedBy: person(USERS.tsodiloSignatory),
          termsAcceptedAt: '2026-03-06T08:40:00Z',
        }),
        recipient(6702, 'makgadikgadi', USERS.makgadikgadiAdmin, { deliveredAt: '2026-03-06T08:00:05Z', openedAt: '2026-03-07T06:00:00Z' }),
      ],
    }),
  },
]);

// ---------------------------------------------------------------------------------------------------------
// Standstill periods
// ---------------------------------------------------------------------------------------------------------

export interface StandstillFixture {
  readonly tenantId: number;
  readonly period: StandstillPeriod;
}

/** Every standstill period. */
export const STANDSTILL_PERIODS: readonly StandstillFixture[] = Object.freeze([
  {
    tenantId: TENANT_IDS.kwu,
    period: {
      standstillId: 31,
      tenderId: 1,
      lot: lotRef(101),
      intentNoticeId: 51,
      startsAt: deadline('2026-08-06T08:00:00Z'),
      endsAt: deadline('2026-08-20T15:00:00Z'),
      dayType: 'working',
      extendedTo: deadline('2026-08-24T15:00:00Z'),
      extensionReason: 'Extended by two working days so that complaint CMP-2026-0001 could be answered before the period ended.',
      effectiveEndsAt: deadline('2026-08-24T15:00:00Z'),
      status: 'completed',
      notApplicableReason: null,
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    period: {
      standstillId: 32,
      tenderId: 7,
      lot: lotRef(701),
      intentNoticeId: 57,
      startsAt: deadline('2026-09-22T08:00:00Z'),
      endsAt: deadline('2026-10-08T15:00:00Z'),
      dayType: 'working',
      extendedTo: null,
      extensionReason: null,
      effectiveEndsAt: deadline('2026-10-08T15:00:00Z'),
      status: 'running',
      notApplicableReason: null,
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    period: {
      standstillId: 33,
      tenderId: 10,
      lot: lotRef(1001),
      intentNoticeId: 65,
      startsAt: deadline('2026-02-16T08:00:00Z'),
      endsAt: deadline('2026-02-26T15:00:00Z'),
      dayType: 'calendar',
      extendedTo: null,
      extensionReason: null,
      effectiveEndsAt: deadline('2026-02-26T15:00:00Z'),
      status: 'completed',
      notApplicableReason: null,
    },
  },
]);

// ---------------------------------------------------------------------------------------------------------
// Holds
// ---------------------------------------------------------------------------------------------------------

export interface HoldFixture {
  readonly tenantId: number;
  readonly tenderId: number;
  readonly hold: Hold;
}

/** Complaint holds on award files (`holds`, hold_type complaint_hold). */
export const AWARD_HOLDS: readonly HoldFixture[] = Object.freeze([
  {
    tenantId: TENANT_IDS.kwu,
    tenderId: 1,
    hold: {
      holdId: 41,
      subjectType: 'lot',
      subjectLabel: 'T-2026-0001 lot 1 — Submersible borehole pumps — Central District',
      holdType: 'complaint_hold',
      reason: 'Complaint CMP-2026-0001 challenges the lot 1 evaluation.',
      owner: person(USERS.dineo),
      authorityNote: 'Placed under policy clause 7.3 (timely complaint during standstill).',
      blockedActions: ['award_final', 'contract_sign'],
      scopeDescription: 'Final award and contract signature for lot 1 only. Lots 2 and 3 are not affected.',
      startedAt: '2026-08-14T13:30:00Z',
      reviewDate: '2026-08-28',
      releasedAt: '2026-08-28T10:00:00Z',
      releasedBy: person(USERS.mpho),
      releaseReason:
        'Complaint dismissed on 21 Aug 2026. Under policy clause 7.6 an appeal does not suspend the award; hold release approved by the procurement manager.',
      complaintId: 91,
      complaintReference: 'CMP-2026-0001',
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    tenderId: 7,
    hold: {
      holdId: 42,
      subjectType: 'tender',
      subjectLabel: 'T-2026-0007 — Reservoir rehabilitation works',
      holdType: 'complaint_hold',
      reason: 'Complaint CMP-2026-0002 challenges the technical evaluation (methodology criterion).',
      owner: person(USERS.dineo),
      authorityNote: 'Placed under policy clause 7.3 (timely complaint during standstill).',
      blockedActions: ['award_final', 'contract_sign'],
      scopeDescription: 'Final award and contract signature. The standstill dates and supplier obligations are unchanged.',
      startedAt: '2026-09-25T10:00:00Z',
      reviewDate: '2026-10-09',
      releasedAt: null,
      releasedBy: null,
      releaseReason: null,
      complaintId: 92,
      complaintReference: 'CMP-2026-0002',
    },
  },
]);

/** Whether a hold is still in force. */
export function isHoldActive(hold: Hold): boolean {
  return hold.releasedAt === null;
}
