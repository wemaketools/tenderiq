/**
 * Awards fixtures, part 5: award-file metadata, final-award gates, public award notices and event closeouts
 * (BUY-26, BUY-28, BUY-30, PUB-05; BR-33, BR-34; AC-26, AC-29, AC-39).
 *
 * - The award register lists the KWU tenders with award work: T-2026-0001, -0003, -0004, -0007, -0009 and -0010.
 *   ODC has no award file yet (its only tender is open), so its register is empty.
 * - Public award notices: T-2026-0001 and T-2026-0010 are published; T-2026-0007 is a draft with the personal
 *   information review still missing.
 * - Closeouts: T-2026-0001 is blocked (lot 3 has no outcome; none of the three lot 1 contracts C-2026-0002,
 *   C-2026-0003 and C-2026-0004 is signed and none of their handovers is accepted: AC-29; statuses as in the
 *   contracts fixtures `CONTRACTS` and `CONTRACT_HANDOVERS`); T-2026-0004 (RFI) is closed with market findings and a linked next event, T-2026-0009 (AC-39);
 *   T-2026-0010 passes the gate and can be closed; T-2026-0003, -0007 and -0009 are in progress.
 */
import type {
  AwardNextStep,
  BuyerPublicAwardNotice,
  CloseoutState,
  GateCheck,
  PublicAwardDetail,
} from '../../../contracts/awards.js';
import { TENANT_IDS } from '../platform.js';
import { USERS, awardTender, bwp, lotRef, person, supplier, tenderBrief } from './base.js';

export interface AwardFileFixture {
  readonly tenantId: number;
  readonly tenderId: number;
  readonly nextStep: AwardNextStep;
  readonly updatedAt: string;
  /** Final-award gate per lot id (lots without an outcome have none). */
  readonly lotGates: Readonly<Record<number, readonly GateCheck[]>>;
}

const PASSED = (code: GateCheck['code'], detail: string | null = null): GateCheck => ({ code, status: 'passed', detail });

const FINAL_AWARD_DONE: readonly GateCheck[] = [
  PASSED('intent_approval'),
  PASSED('intent_notice'),
  PASSED('final_award_approval'),
  PASSED('diligence'),
  PASSED('blocking_complaint'),
  PASSED('standstill'),
  PASSED('award_conditions'),
];

/** The award files of the register. */
export const AWARD_FILES: readonly AwardFileFixture[] = Object.freeze([
  {
    tenantId: TENANT_IDS.kwu,
    tenderId: 1,
    nextStep: 'prepare_recommendation',
    updatedAt: '2026-09-15T09:00:00Z',
    lotGates: {
      101: [
        ...FINAL_AWARD_DONE.slice(0, 4),
        PASSED('blocking_complaint', 'Hold on CMP-2026-0001 released on 28 Aug 2026.'),
        PASSED('standstill', 'Completed on 24 Aug 2026 after a two-day extension.'),
        PASSED('award_conditions'),
      ],
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    tenderId: 3,
    nextStep: 'submit_recommendation',
    updatedAt: '2026-09-29T14:30:00Z',
    lotGates: {
      301: [
        { code: 'intent_approval', status: 'blocking', detail: 'The recommendation is a draft.' },
        { code: 'intent_notice', status: 'blocking', detail: 'No intention-to-award notice yet.' },
        { code: 'final_award_approval', status: 'blocking', detail: 'Not requested.' },
        PASSED('diligence', 'Not required by the tender.'),
        PASSED('blocking_complaint'),
        { code: 'standstill', status: 'blocking', detail: 'Starts with the intention-to-award notice.' },
        PASSED('award_conditions'),
      ],
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    tenderId: 4,
    nextStep: 'archive',
    updatedAt: '2026-07-15T12:00:00Z',
    lotGates: {},
  },
  {
    tenantId: TENANT_IDS.kwu,
    tenderId: 7,
    nextStep: 'resolve_complaint',
    updatedAt: '2026-09-29T10:30:00Z',
    lotGates: {
      701: [
        PASSED('intent_approval', 'Approved by Keabetswe Nkwe on 18 Sep 2026.'),
        PASSED('intent_notice', 'Issued on 22 Sep 2026; one e-mail delivery failed and awaits a resend.'),
        { code: 'final_award_approval', status: 'blocking', detail: 'Cannot be requested while the complaint hold is active.' },
        PASSED('diligence'),
        {
          code: 'blocking_complaint',
          status: 'blocking',
          detail: 'Complaint CMP-2026-0002 holds the final award and contract signature (hold owner: Dineo Masire).',
        },
        {
          code: 'standstill',
          status: 'blocking',
          detail: 'Running until 8 Oct 2026, 17:00 (UTC+02:00) Africa/Gaborone (10 working days; 30 Sep and 1 Oct are public holidays).',
        },
        PASSED('award_conditions'),
      ],
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    tenderId: 9,
    nextStep: 'await_recommendation_approval',
    updatedAt: '2026-09-25T08:15:00Z',
    lotGates: {
      901: [
        { code: 'intent_approval', status: 'blocking', detail: 'Awaiting approval by Keabetswe Nkwe.' },
        { code: 'intent_notice', status: 'blocking', detail: 'No intention-to-award notice yet.' },
        { code: 'final_award_approval', status: 'blocking', detail: 'Not requested.' },
        {
          code: 'diligence',
          status: 'blocking',
          detail: 'Limpopo Environmental Services: professional indemnity insurance finding unresolved (award-blocking).',
        },
        PASSED('blocking_complaint'),
        { code: 'standstill', status: 'blocking', detail: 'Starts with the intention-to-award notice.' },
        { code: 'award_conditions', status: 'warning', detail: 'Conditional award: diligence conditions must be met.' },
      ],
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    tenderId: 10,
    nextStep: 'close_event',
    updatedAt: '2026-09-10T08:00:00Z',
    lotGates: { 1001: FINAL_AWARD_DONE },
  },
]);

// ---------------------------------------------------------------------------------------------------------
// Public award notices
// ---------------------------------------------------------------------------------------------------------

export interface PublicNoticeFixture {
  readonly tenantId: number;
  readonly notice: BuyerPublicAwardNotice;
  /** The public projection, present once published (DD-13 v_public_awards). */
  readonly publicDetail: PublicAwardDetail | null;
}

const T1_PUBLIC_CONTENT =
  'Kalahari Water Utilities awarded lot 1 (Submersible borehole pumps — Central District) of tender T-2026-0001 to Tsodilo Engineering (Pty) Ltd on 4 Sep 2026 for BWP 5,340,000.00, as the highest-ranked compliant offer under the published evaluation method. Lot 2 was cancelled because no compliant offer was received; it will be re-tendered. Lot 3 is still under evaluation and will be reported separately. Publication of this award does not mean that a contract has been signed or that work has started.';

const T10_PUBLIC_CONTENT =
  'Kalahari Water Utilities awarded tender T-2026-0010 (fleet vehicle maintenance, three-year term) to Tsodilo Engineering (Pty) Ltd on 6 Mar 2026 for BWP 1,850,000.00, as the highest-ranked compliant quotation. Two quotations were received. Publication of this award does not mean that a contract has been signed or that work has started.';

/** Every public award notice. */
export const PUBLIC_NOTICES: readonly PublicNoticeFixture[] = Object.freeze([
  {
    tenantId: TENANT_IDS.kwu,
    notice: {
      publicNoticeId: 61,
      tenderId: 1,
      status: 'published',
      content: T1_PUBLIC_CONTENT,
      disclosedValues: true,
      reviewConfidentialityBy: person(USERS.dineo),
      reviewPersonalInfoBy: person(USERS.mpho),
      publishedAt: '2026-09-07T08:00:00Z',
      updatedAt: '2026-09-07T08:00:00Z',
    },
    publicDetail: {
      buyer: { name: 'Kalahari Water Utilities (Pilot)', slug: 'kwu' },
      reference: 'T-2026-0001',
      title: 'Borehole pump replacement programme (3 lots)',
      eventType: 'tender',
      tenderStatus: 'partially_awarded',
      publishedAt: '2026-09-07T08:00:00Z',
      lots: [
        {
          lotNo: 1,
          title: 'Submersible borehole pumps — Central District',
          outcome: 'award',
          supplierName: 'Tsodilo Engineering',
          awardedValue: bwp('5340000.00'),
          finalAwardedAt: '2026-09-04T09:00:00Z',
        },
        {
          lotNo: 2,
          title: 'Solar pumping systems — Kgalagadi',
          outcome: 'cancelled',
          supplierName: null,
          awardedValue: null,
          finalAwardedAt: null,
        },
        {
          lotNo: 3,
          title: 'Pump controls and telemetry panels',
          outcome: null,
          supplierName: null,
          awardedValue: null,
          finalAwardedAt: null,
        },
      ],
      disclosedValues: true,
      totalAwardedValue: bwp('5340000.00'),
      officialTimeZone: 'Africa/Gaborone',
      content: T1_PUBLIC_CONTENT,
      noticeFileName: 'kwu-T-2026-0001-award-notice.txt',
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    notice: {
      publicNoticeId: 62,
      tenderId: 7,
      status: 'draft',
      content:
        'Kalahari Water Utilities awarded tender T-2026-0007 (reservoir rehabilitation works) to Makgadikgadi Civil Works for BWP 7,850,000.00. Publication of this award does not mean that a contract has been signed or that work has started.',
      disclosedValues: true,
      reviewConfidentialityBy: person(USERS.dineo),
      reviewPersonalInfoBy: null,
      publishedAt: null,
      updatedAt: '2026-09-23T10:00:00Z',
    },
    publicDetail: null,
  },
  {
    tenantId: TENANT_IDS.kwu,
    notice: {
      publicNoticeId: 63,
      tenderId: 10,
      status: 'published',
      content: T10_PUBLIC_CONTENT,
      disclosedValues: true,
      reviewConfidentialityBy: person(USERS.dineo),
      reviewPersonalInfoBy: person(USERS.mpho),
      publishedAt: '2026-03-09T08:00:00Z',
      updatedAt: '2026-03-09T08:00:00Z',
    },
    publicDetail: {
      buyer: { name: 'Kalahari Water Utilities (Pilot)', slug: 'kwu' },
      reference: 'T-2026-0010',
      title: 'Fleet vehicle maintenance',
      eventType: 'rfq',
      tenderStatus: 'awarded',
      publishedAt: '2026-03-09T08:00:00Z',
      lots: [
        {
          lotNo: 1,
          title: 'Fleet vehicle maintenance (light and heavy vehicles)',
          outcome: 'award',
          supplierName: 'Tsodilo Engineering',
          awardedValue: bwp('1850000.00'),
          finalAwardedAt: '2026-03-06T10:00:00Z',
        },
      ],
      disclosedValues: true,
      totalAwardedValue: bwp('1850000.00'),
      officialTimeZone: 'Africa/Gaborone',
      content: T10_PUBLIC_CONTENT,
      noticeFileName: 'kwu-T-2026-0010-award-notice.txt',
    },
  },
]);

// ---------------------------------------------------------------------------------------------------------
// Event closeouts
// ---------------------------------------------------------------------------------------------------------

export interface CloseoutFixture {
  readonly tenantId: number;
  readonly state: CloseoutState;
}

const IN_PROGRESS_COMMON = {
  closeoutId: null,
  status: 'in_progress' as const,
  isInformationOnly: false,
  contracts: [],
  securitiesNote: null,
  lessonsLearned: null,
  retentionClass: null,
  marketFindings: null,
  nextStepDecision: null,
  linkedNextTender: null,
  closedBy: null,
  closedAt: null,
  archivedAt: null,
  evidencePacks: [],
};

/** Every closeout view. */
export const CLOSEOUTS: readonly CloseoutFixture[] = Object.freeze([
  {
    tenantId: TENANT_IDS.kwu,
    state: {
      tender: awardTender(1).ref,
      closeoutId: 71,
      status: 'blocked',
      isInformationOnly: false,
      lots: [
        { lot: lotRef(101), stage: 'awarded', outcome: 'award', outcomeStatus: 'final_awarded' },
        { lot: lotRef(102), stage: 'cancelled', outcome: 'cancelled', outcomeStatus: 'approved' },
        { lot: lotRef(103), stage: 'under_assessment', outcome: null, outcomeStatus: null },
      ],
      contracts: [
        {
          contractId: 2,
          reference: 'C-2026-0002',
          status: 'awaiting_signature',
          supplier: supplier('tsodilo'),
          lotNos: [1],
          handoverStatus: 'draft',
        },
        {
          contractId: 3,
          reference: 'C-2026-0003',
          status: 'under_review',
          supplier: supplier('tsodilo'),
          lotNos: [1],
          handoverStatus: 'returned',
        },
        {
          contractId: 8,
          reference: 'C-2026-0004',
          status: 'draft',
          supplier: supplier('tsodilo'),
          lotNos: [1],
          handoverStatus: 'submitted',
        },
      ],
      outstandingComplaints: [],
      openDebriefCount: 0,
      securitiesNote: 'Tsodilo’s bid security (BWP 50,000.00) is held until the performance security is lodged at signature.',
      lessonsLearned: 'Publish the solar array sizing template with the tender to avoid lot-level non-compliance.',
      retentionClass: 'tender',
      marketFindings: null,
      nextStepDecision: 'Re-tender lot 2 after the scope redesign.',
      linkedNextTender: null,
      gate: [
        { code: 'lot_outcomes', status: 'blocking', detail: 'Lot 3 is still under evaluation and has no outcome.' },
        {
          code: 'contracts_signed',
          status: 'blocking',
          detail: 'None of the lot 1 contracts is signed: C-2026-0002 is awaiting signature, C-2026-0003 is under review and C-2026-0004 is a draft.',
        },
        {
          code: 'handover_accepted',
          status: 'blocking',
          detail:
            'No handover is accepted: C-2026-0002 is still a draft, C-2026-0003 was returned for missing information and C-2026-0004 is submitted and awaits the contract manager.',
        },
        PASSED('complaints_closed', 'CMP-2026-0001 closed on 14 Sep 2026.'),
        PASSED('debriefs_closed'),
        { code: 'securities_resolved', status: 'warning', detail: 'Bid security held until signature.' },
        PASSED('retention_class'),
      ],
      blockingReasons: [
        'Lot 3 has no outcome.',
        'Contracts C-2026-0002, C-2026-0003 and C-2026-0004 are not signed.',
        'The handovers of C-2026-0002, C-2026-0003 and C-2026-0004 are not accepted.',
      ],
      closedBy: null,
      closedAt: null,
      archivedAt: null,
      evidencePacks: [],
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    state: {
      ...IN_PROGRESS_COMMON,
      tender: awardTender(3).ref,
      lots: [{ lot: lotRef(301), stage: 'under_assessment', outcome: 'award', outcomeStatus: 'recommended' }],
      openDebriefCount: 0,
      outstandingComplaints: [],
      gate: [
        { code: 'lot_outcomes', status: 'blocking', detail: 'The recommendation for lot 1 is a draft.' },
        { code: 'contracts_signed', status: 'blocking', detail: 'No contract yet.' },
        { code: 'handover_accepted', status: 'blocking', detail: 'No handover yet.' },
        PASSED('complaints_closed'),
        PASSED('debriefs_closed'),
        PASSED('securities_resolved'),
        { code: 'retention_class', status: 'warning', detail: 'Not set.' },
      ],
      blockingReasons: ['Lot 1 has no approved outcome.', 'No contract has been signed.', 'No handover has been accepted.'],
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    state: {
      tender: awardTender(4).ref,
      closeoutId: 72,
      status: 'closed',
      isInformationOnly: true,
      lots: [],
      contracts: [],
      outstandingComplaints: [],
      openDebriefCount: 0,
      securitiesNote: null,
      lessonsLearned: 'A two-week response window was enough for an RFI; the structured questionnaire made responses comparable.',
      retentionClass: 'tender',
      marketFindings:
        'Five responses (two local, three regional). Acoustic correlators with permanent loggers are mature; three providers offer detection as a service with guaranteed leak-location accuracy. Typical pricing is per kilometre surveyed per year. Local capacity for data analysis is limited.',
      nextStepDecision:
        'Proceed with a restricted, multi-stage request for proposals for acoustic leak detection services with a demonstration stage (approved by the procurement manager on 14 Jul 2026).',
      linkedNextTender: tenderBrief(9),
      gate: [
        PASSED('lot_outcomes', 'Information-only event: no award is required.'),
        PASSED('contracts_signed', 'No contract is required.'),
        PASSED('handover_accepted', 'No handover is required.'),
        PASSED('complaints_closed'),
        PASSED('debriefs_closed'),
        PASSED('securities_resolved'),
        PASSED('retention_class'),
        PASSED('rfi_findings', 'Findings reviewed and next step linked to T-2026-0009.'),
      ],
      blockingReasons: [],
      closedBy: person(USERS.tebogo),
      closedAt: '2026-07-15T12:00:00Z',
      archivedAt: null,
      evidencePacks: [
        {
          exportId: 801,
          exportType: 'evidence_pack',
          status: 'ready',
          scopeDescription: 'RFI responses summary, market findings and next-step decision',
          requestedBy: person(USERS.tebogo),
          requestedAt: '2026-07-15T12:05:00Z',
          completedAt: '2026-07-15T12:07:00Z',
        },
      ],
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    state: {
      ...IN_PROGRESS_COMMON,
      tender: awardTender(7).ref,
      lots: [{ lot: lotRef(701), stage: 'award_pending', outcome: 'award', outcomeStatus: 'intent_notified' }],
      outstandingComplaints: [{ complaintId: 92, reference: 'CMP-2026-0002', status: 'under_investigation' }],
      openDebriefCount: 1,
      gate: [
        { code: 'lot_outcomes', status: 'blocking', detail: 'Lot 1 is not finally awarded.' },
        { code: 'contracts_signed', status: 'blocking', detail: 'No contract yet (signature is on hold).' },
        { code: 'handover_accepted', status: 'blocking', detail: 'No handover yet.' },
        { code: 'complaints_closed', status: 'blocking', detail: 'CMP-2026-0002 is under investigation.' },
        { code: 'debriefs_closed', status: 'blocking', detail: 'One debrief is still open.' },
        PASSED('securities_resolved'),
        { code: 'retention_class', status: 'warning', detail: 'Not set.' },
      ],
      blockingReasons: [
        'Lot 1 is not finally awarded.',
        'No contract has been signed.',
        'No handover has been accepted.',
        'Complaint CMP-2026-0002 is open.',
        'One debrief is open.',
      ],
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    state: {
      ...IN_PROGRESS_COMMON,
      tender: awardTender(9).ref,
      lots: [{ lot: lotRef(901), stage: 'under_assessment', outcome: 'conditional_award', outcomeStatus: 'recommended' }],
      outstandingComplaints: [],
      openDebriefCount: 0,
      gate: [
        { code: 'lot_outcomes', status: 'blocking', detail: 'The recommendation awaits approval.' },
        { code: 'contracts_signed', status: 'blocking', detail: 'No contract yet.' },
        { code: 'handover_accepted', status: 'blocking', detail: 'No handover yet.' },
        PASSED('complaints_closed'),
        PASSED('debriefs_closed'),
        PASSED('securities_resolved'),
        { code: 'retention_class', status: 'warning', detail: 'Not set.' },
      ],
      blockingReasons: ['Lot 1 has no approved outcome.', 'No contract has been signed.', 'No handover has been accepted.'],
    },
  },
  {
    tenantId: TENANT_IDS.kwu,
    state: {
      tender: awardTender(10).ref,
      closeoutId: 73,
      status: 'in_progress',
      isInformationOnly: false,
      lots: [{ lot: lotRef(1001), stage: 'awarded', outcome: 'award', outcomeStatus: 'final_awarded' }],
      contracts: [
        {
          contractId: 1,
          reference: 'C-2026-0001',
          status: 'active',
          supplier: supplier('tsodilo'),
          lotNos: [1],
          handoverStatus: 'accepted',
        },
      ],
      outstandingComplaints: [],
      openDebriefCount: 0,
      securitiesNote: 'Bid securities returned on 9 Mar 2026; the performance security is managed on C-2026-0001.',
      lessonsLearned: 'State breakdown response times as a scored criterion from the start; it separated the quotations.',
      retentionClass: 'tender',
      marketFindings: null,
      nextStepDecision: null,
      linkedNextTender: null,
      gate: [
        PASSED('lot_outcomes'),
        PASSED('contracts_signed', 'C-2026-0001 is active (signed in March 2026).'),
        PASSED('handover_accepted', 'Accepted by Masego Rakgosi on 24 Mar 2026.'),
        PASSED('complaints_closed'),
        PASSED('debriefs_closed', 'One late debrief request was declined with reasons.'),
        PASSED('securities_resolved'),
        PASSED('retention_class'),
      ],
      blockingReasons: [],
      closedBy: null,
      closedAt: null,
      archivedAt: null,
      evidencePacks: [
        {
          exportId: 802,
          exportType: 'evidence_pack',
          status: 'ready',
          scopeDescription: 'Award decision, notices, standstill record and contract handover',
          requestedBy: person(USERS.tebogo),
          requestedAt: '2026-09-10T08:00:00Z',
          completedAt: '2026-09-10T08:03:00Z',
        },
      ],
    },
  },
]);
