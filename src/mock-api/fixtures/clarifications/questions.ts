/**
 * `questions` rows of the demo world (FR-10; BUY-16, SUP-10, PUB-04). Every status of `questions.status` and every
 * audience appears. Row tenant = the buyer; `supplierTenantId` = the asking supplier. `questionText` is private to
 * the asker and the buyer team; shared answers expose only `sanitizedQuestion` and `answerText`. Requirement,
 * lot and document ids are the bids and documents domains' ids; submission times lie between the tender's release
 * and its questions deadline, except the flagged late questions. Q-208 is in review with a cleared confidentiality
 * review by a colleague of the owner, so publishing it to the chosen audience succeeds (BUY-16).
 */
import type { QuestionsAudience, QuestionsLateDisposition, QuestionsStatus } from '../../../contracts/enums.js';
import { TENANT_IDS } from '../platform.js';

export interface HistoryFixture {
  readonly at: string;
  readonly action: string;
  readonly actorUserId: number | null;
  readonly note: string | null;
}

export interface QuestionFixture {
  readonly id: number;
  readonly tenantId: number;
  readonly tenderId: number;
  readonly supplierTenantId: number;
  readonly lotId: number | null;
  readonly requirementId: number | null;
  readonly documentId: number | null;
  readonly askedByUserId: number;
  readonly questionText: string;
  readonly submittedAt: string;
  readonly afterDeadline: boolean;
  readonly lateDisposition: QuestionsLateDisposition | null;
  readonly lateDispositionReason: string | null;
  readonly ownerUserId: number | null;
  readonly status: QuestionsStatus;
  readonly audience: QuestionsAudience;
  readonly sanitizedQuestion: string | null;
  readonly answerText: string | null;
  readonly confidentialityReviewedBy: number | null;
  /** Release time of the answer (shared publication or private reply). */
  readonly publishedAt: string | null;
  readonly addendumId: number | null;
  /** Raised at this briefing or site visit and recorded from its minutes. */
  readonly sessionId: number | null;
  /** Target date for the answer under the buyer's question-handling policy; null once closed. */
  readonly responseDueAt: string | null;
  readonly history: readonly HistoryFixture[];
}

const KWU = TENANT_IDS.kwu;

/** Defaults of a question row; each fixture states only what differs. */
function question(
  spec: Omit<
    QuestionFixture,
    'afterDeadline' | 'lateDisposition' | 'lateDispositionReason' | 'sanitizedQuestion' | 'answerText' | 'confidentialityReviewedBy' | 'publishedAt' | 'addendumId' | 'sessionId' | 'responseDueAt'
  > &
    Partial<QuestionFixture>,
): QuestionFixture {
  return {
    afterDeadline: false,
    lateDisposition: null,
    lateDispositionReason: null,
    sanitizedQuestion: null,
    answerText: null,
    confidentialityReviewedBy: null,
    publishedAt: null,
    addendumId: null,
    sessionId: null,
    responseDueAt: null,
    ...spec,
  };
}

export const QUESTIONS: readonly QuestionFixture[] = Object.freeze([
  // T-2026-0002 Smart water meter supply (released 14 Sep; questions until 7 Oct 2026, 15:00) ---------------
  question({
    id: 201,
    tenantId: KWU,
    tenderId: 2,
    supplierTenantId: TENANT_IDS['gaborone-meter'],
    lotId: 201,
    requirementId: 2003,
    documentId: null,
    askedByUserId: 37,
    questionText:
      'Our GMC-15 meters are certified R400 horizontally and R250 vertically. Does Gaborone Metering Co. need R400 in the vertical orientation as well?',
    submittedAt: '2026-09-15T08:40:00Z',
    ownerUserId: 5,
    status: 'published',
    audience: 'public',
    sanitizedQuestion: 'Is accuracy class R400 required for vertical installation as well as horizontal installation?',
    answerText:
      'No. T-01 applies to horizontal installation, which is the only installation used on the KWU network. Vertical certification is not evaluated.',
    confidentialityReviewedBy: 4,
    publishedAt: '2026-09-18T12:00:00Z',
    history: [
      { at: '2026-09-15T08:40:00Z', action: 'submitted', actorUserId: 37, note: null },
      { at: '2026-09-15T11:02:00Z', action: 'assigned', actorUserId: 4, note: 'Assigned to the tender owner.' },
      { at: '2026-09-16T14:30:00Z', action: 'review_requested', actorUserId: 5, note: null },
      { at: '2026-09-17T09:12:00Z', action: 'review_cleared', actorUserId: 4, note: 'Supplier product name removed from the shared wording.' },
      { at: '2026-09-18T12:00:00Z', action: 'published', actorUserId: 5, note: 'Audience: public.' },
    ],
  }),
  question({
    id: 202,
    tenantId: KWU,
    tenderId: 2,
    supplierTenantId: TENANT_IDS.tsodilo,
    lotId: 201,
    requirementId: 2004,
    documentId: 201,
    askedByUserId: 25,
    questionText:
      'Section 4.3 of the package requires a CSV export. Tsodilo’s head-end partner exports DLMS/COSEM natively. Can DLMS/COSEM be accepted instead of CSV?',
    submittedAt: '2026-09-22T09:15:00Z',
    ownerUserId: 5,
    status: 'escalated_to_addendum',
    audience: 'all_participants',
    sanitizedQuestion: 'Can the meter reading export use DLMS/COSEM instead of the CSV format in section 4.3?',
    answerText: 'The export requirement will be amended by an addendum to accept DLMS/COSEM as an alternative to CSV.',
    addendumId: 22,
    history: [
      { at: '2026-09-22T09:15:00Z', action: 'submitted', actorUserId: 25, note: null },
      { at: '2026-09-22T10:40:00Z', action: 'assigned', actorUserId: 5, note: null },
      {
        at: '2026-09-28T08:20:00Z',
        action: 'escalated_to_addendum',
        actorUserId: 5,
        note: 'Accepting DLMS/COSEM changes a rated requirement, so the answer becomes Addendum 2.',
      },
    ],
  }),
  question({
    id: 203,
    tenantId: KWU,
    tenderId: 2,
    supplierTenantId: TENANT_IDS['chobe-pipe'],
    lotId: 201,
    requirementId: 2009,
    documentId: null,
    askedByUserId: 29,
    questionText:
      'Chobe holds 4,000 Aqualine DN15 meters in its Francistown warehouse at a landed cost of BWP 612.00 each. May we offer these with a 1-year warranty instead of the 2-year minimum?',
    submittedAt: '2026-09-15T13:05:00Z',
    ownerUserId: 5,
    status: 'answered_privately',
    audience: 'private',
    answerText:
      'The warranty choices in C-01 start at 2 years and apply to every offer; a shorter warranty cannot be offered. The origin of the stock is not restricted.',
    confidentialityReviewedBy: 4,
    publishedAt: '2026-09-17T10:30:00Z',
    history: [
      { at: '2026-09-15T13:05:00Z', action: 'submitted', actorUserId: 29, note: null },
      { at: '2026-09-15T15:00:00Z', action: 'assigned', actorUserId: 5, note: null },
      {
        at: '2026-09-17T10:30:00Z',
        action: 'answered_privately',
        actorUserId: 5,
        note: 'Contains the supplier’s stock and cost position; the answer restates C-01 and changes nothing.',
      },
    ],
  }),
  question({
    id: 204,
    tenantId: KWU,
    tenderId: 2,
    supplierTenantId: TENANT_IDS['serowe-ict'],
    lotId: 201,
    requirementId: 2004,
    documentId: null,
    askedByUserId: 33,
    questionText:
      'Serowe ICT integrates LoRaWAN modules with several head-end systems. Which head-end version does KWU run, and which LoRaWAN class is expected?',
    submittedAt: '2026-09-25T07:50:00Z',
    ownerUserId: 5,
    status: 'in_review',
    audience: 'public',
    sanitizedQuestion: 'Which head-end system version and LoRaWAN device class must the communication modules support?',
    answerText: 'The KWU head-end runs AMI platform version 5.2. Modules must support LoRaWAN 1.0.3, device class A.',
    responseDueAt: '2026-10-02T15:00:00Z',
    history: [
      { at: '2026-09-25T07:50:00Z', action: 'submitted', actorUserId: 33, note: null },
      { at: '2026-09-25T09:10:00Z', action: 'assigned', actorUserId: 5, note: null },
      { at: '2026-09-29T12:45:00Z', action: 'review_requested', actorUserId: 5, note: 'Please check the wording is neutral.' },
    ],
  }),
  question({
    id: 208,
    tenantId: KWU,
    tenderId: 2,
    supplierTenantId: TENANT_IDS['gaborone-meter'],
    lotId: 201,
    requirementId: 2004,
    documentId: null,
    askedByUserId: 37,
    questionText:
      'Gaborone Metering Co. can fit a pulse output next to the LoRaWAN module on the GMC-15. Does KWU require a pulse output as a fallback for manual reading?',
    submittedAt: '2026-09-23T07:20:00Z',
    ownerUserId: 5,
    status: 'in_review',
    audience: 'all_participants',
    sanitizedQuestion: 'Is a pulse output required in addition to the LoRaWAN module as a fallback for manual reading?',
    answerText:
      'No. A pulse output is not required and is not evaluated. Manual reading uses the register display; T-02 describes the only communication path KWU needs.',
    confidentialityReviewedBy: 4,
    responseDueAt: '2026-10-01T15:00:00Z',
    history: [
      { at: '2026-09-23T07:20:00Z', action: 'submitted', actorUserId: 37, note: null },
      { at: '2026-09-23T09:00:00Z', action: 'assigned', actorUserId: 5, note: null },
      { at: '2026-09-28T10:15:00Z', action: 'answer_drafted', actorUserId: 5, note: null },
      { at: '2026-09-28T10:20:00Z', action: 'review_requested', actorUserId: 5, note: null },
      { at: '2026-09-29T08:40:00Z', action: 'review_cleared', actorUserId: 4, note: 'Product name removed; the wording is neutral.' },
    ],
  }),
  question({
    id: 205,
    tenantId: KWU,
    tenderId: 2,
    supplierTenantId: TENANT_IDS['gaborone-meter'],
    lotId: 201,
    requirementId: 2008,
    documentId: null,
    askedByUserId: 37,
    questionText:
      'Gaborone Metering Co. submitted its quotation on 18 September. Does the OIML R49 certificate requirement introduced by Addendum 1 apply to our offer, and must we resubmit?',
    submittedAt: '2026-09-26T08:30:00Z',
    ownerUserId: 5,
    status: 'draft_answer',
    audience: 'all_participants',
    sanitizedQuestion: 'Does the OIML R49 requirement of Addendum 1 apply to offers submitted before the addendum?',
    answerText:
      'Yes. Suppliers who submitted before Addendum 1 supplement their offer with the certificate before the new deadline. The original receipt remains valid; no full resubmission is needed.',
    responseDueAt: '2026-10-01T15:00:00Z',
    history: [
      { at: '2026-09-26T08:30:00Z', action: 'submitted', actorUserId: 37, note: null },
      { at: '2026-09-26T09:00:00Z', action: 'assigned', actorUserId: 5, note: null },
      { at: '2026-09-29T16:10:00Z', action: 'answer_drafted', actorUserId: 5, note: null },
    ],
  }),
  question({
    id: 206,
    tenantId: KWU,
    tenderId: 2,
    supplierTenantId: TENANT_IDS['chobe-pipe'],
    lotId: 201,
    requirementId: 2006,
    documentId: null,
    askedByUserId: 29,
    questionText: 'Is delivery of part of the domestic meters to the Maun depot acceptable instead of the Gaborone central stores?',
    submittedAt: '2026-09-29T11:20:00Z',
    ownerUserId: null,
    status: 'received',
    audience: 'all_participants',
    responseDueAt: '2026-10-05T15:00:00Z',
    history: [{ at: '2026-09-29T11:20:00Z', action: 'submitted', actorUserId: 29, note: null }],
  }),
  question({
    id: 207,
    tenantId: KWU,
    tenderId: 2,
    supplierTenantId: TENANT_IDS.tsodilo,
    lotId: 201,
    requirementId: 2008,
    documentId: null,
    askedByUserId: 26,
    questionText:
      'The manufacturer of the meters Tsodilo offers has an OIML R49 application in progress. Will a certificate application be accepted in place of the certificate?',
    submittedAt: '2026-09-28T14:05:00Z',
    ownerUserId: 4,
    status: 'assigned',
    audience: 'all_participants',
    responseDueAt: '2026-10-03T15:00:00Z',
    history: [
      { at: '2026-09-28T14:05:00Z', action: 'submitted', actorUserId: 26, note: null },
      { at: '2026-09-28T15:30:00Z', action: 'assigned', actorUserId: 5, note: 'Policy question for the procurement manager.' },
    ],
  }),
  question({
    id: 220,
    tenantId: KWU,
    tenderId: 2,
    supplierTenantId: TENANT_IDS['serowe-ict'],
    lotId: 201,
    requirementId: 2006,
    documentId: null,
    askedByUserId: 33,
    questionText: 'Asked at the briefing: is the pilot quantity of 500 meters included in the 12,000 domestic meters?',
    submittedAt: '2026-09-16T08:45:00Z',
    ownerUserId: 5,
    status: 'published',
    audience: 'public',
    sanitizedQuestion: 'Is the pilot quantity of 500 meters included in the 12,000 domestic meters?',
    answerText: 'Yes. The 500 pilot meters form part of the 12,000 domestic meters in the pricing schedule.',
    confidentialityReviewedBy: 4,
    publishedAt: '2026-09-17T14:00:00Z',
    sessionId: 41,
    history: [
      { at: '2026-09-16T08:45:00Z', action: 'recorded_at_session', actorUserId: 5, note: 'Pre-quotation briefing.' },
      { at: '2026-09-17T14:00:00Z', action: 'published', actorUserId: 5, note: 'Shared with the briefing minutes.' },
    ],
  }),

  // T-2026-0006 Chlorine dosing equipment (invitation only; released 21 Sep; questions until 5 Oct 2026) -----
  question({
    id: 210,
    tenantId: KWU,
    tenderId: 6,
    supplierTenantId: TENANT_IDS.tsodilo,
    lotId: 601,
    requirementId: 6003,
    documentId: null,
    askedByUserId: 25,
    questionText: 'Should the dosing skid be supplied in a container, or will KWU provide a building at Mmashoro?',
    submittedAt: '2026-09-22T10:20:00Z',
    ownerUserId: 5,
    status: 'published',
    audience: 'all_participants',
    sanitizedQuestion: 'Should the dosing skid be supplied in a container, or is a building provided?',
    answerText: 'KWU provides the existing dosing building. The skid is supplied without a container.',
    confidentialityReviewedBy: 4,
    publishedAt: '2026-09-24T10:00:00Z',
    history: [
      { at: '2026-09-22T10:20:00Z', action: 'submitted', actorUserId: 25, note: null },
      { at: '2026-09-23T15:00:00Z', action: 'review_cleared', actorUserId: 4, note: null },
      { at: '2026-09-24T10:00:00Z', action: 'published', actorUserId: 5, note: 'Audience: all participants (invitation-only tender).' },
    ],
  }),
  question({
    id: 211,
    tenantId: KWU,
    tenderId: 6,
    supplierTenantId: TENANT_IDS['chobe-pipe'],
    lotId: 601,
    requirementId: 6005,
    documentId: null,
    askedByUserId: 29,
    questionText: 'May the chlorine gas detectors come from a different manufacturer than the dosing equipment?',
    submittedAt: '2026-09-29T08:05:00Z',
    ownerUserId: null,
    status: 'received',
    audience: 'all_participants',
    responseDueAt: '2026-10-02T15:00:00Z',
    history: [{ at: '2026-09-29T08:05:00Z', action: 'submitted', actorUserId: 29, note: null }],
  }),
  question({
    id: 212,
    tenantId: KWU,
    tenderId: 6,
    supplierTenantId: TENANT_IDS.tsodilo,
    lotId: null,
    requirementId: null,
    documentId: 219,
    askedByUserId: 25,
    questionText:
      'Tsodilo will offer its ProDose skid, assembled in Gaborone with imported pumps. Does local assembly count towards the local content requirement?',
    submittedAt: '2026-09-21T09:40:00Z',
    ownerUserId: 5,
    status: 'answered_privately',
    audience: 'private',
    answerText: 'Local assembly in Botswana counts towards local content as defined in section 3.4, with the evidence listed there.',
    confidentialityReviewedBy: 4,
    publishedAt: '2026-09-25T09:00:00Z',
    history: [
      { at: '2026-09-21T09:40:00Z', action: 'submitted', actorUserId: 25, note: null },
      { at: '2026-09-25T09:00:00Z', action: 'answered_privately', actorUserId: 5, note: 'Restates section 3.4; reveals the supplier’s solution.' },
    ],
  }),

  // T-2026-0001 Borehole pump replacement programme (released 15 Jun; questions until 10 Jul 2026) ---------
  question({
    id: 213,
    tenantId: KWU,
    tenderId: 1,
    supplierTenantId: TENANT_IDS.tsodilo,
    lotId: 101,
    requirementId: 1002,
    documentId: null,
    askedByUserId: 25,
    questionText: 'Must the lot 1 submersible pumps be supplied with variable speed drives?',
    submittedAt: '2026-06-22T09:00:00Z',
    ownerUserId: 5,
    status: 'published',
    audience: 'public',
    sanitizedQuestion: 'Must the lot 1 submersible pumps be supplied with variable speed drives?',
    answerText: 'No. Lot 1 pumps are fixed speed; drives and control panels are part of lot 3.',
    confidentialityReviewedBy: 4,
    publishedAt: '2026-06-26T09:00:00Z',
    history: [
      { at: '2026-06-22T09:00:00Z', action: 'submitted', actorUserId: 25, note: null },
      { at: '2026-06-25T15:00:00Z', action: 'review_cleared', actorUserId: 4, note: null },
      { at: '2026-06-26T09:00:00Z', action: 'published', actorUserId: 5, note: 'Audience: public.' },
    ],
  }),
  question({
    id: 214,
    tenantId: KWU,
    tenderId: 1,
    supplierTenantId: TENANT_IDS.makgadikgadi,
    lotId: 103,
    requirementId: 1002,
    documentId: null,
    askedByUserId: 40,
    questionText: 'Must the lot 3 control panels provide a telemetry interface for the existing KWU SCADA outstations?',
    submittedAt: '2026-06-24T11:30:00Z',
    ownerUserId: 5,
    status: 'published',
    audience: 'public',
    sanitizedQuestion: 'Must the lot 3 control panels provide a telemetry interface for the existing SCADA outstations?',
    answerText: 'Yes. Each panel provides Modbus RTU terminals for the existing outstation; the outstations themselves are not in scope.',
    confidentialityReviewedBy: 4,
    publishedAt: '2026-06-29T08:00:00Z',
    history: [
      { at: '2026-06-24T11:30:00Z', action: 'submitted', actorUserId: 40, note: null },
      { at: '2026-06-26T10:00:00Z', action: 'review_cleared', actorUserId: 4, note: null },
      { at: '2026-06-29T08:00:00Z', action: 'published', actorUserId: 5, note: 'Audience: public.' },
    ],
  }),
  question({
    id: 215,
    tenantId: KWU,
    tenderId: 1,
    supplierTenantId: TENANT_IDS['chobe-pipe'],
    lotId: 103,
    requirementId: null,
    documentId: null,
    askedByUserId: 29,
    questionText: 'Can the lot 3 control panels be supplied in painted mild steel instead of stainless steel enclosures?',
    submittedAt: '2026-07-13T07:15:00Z',
    afterDeadline: true,
    lateDisposition: 'declined',
    lateDispositionReason: 'Received after the question deadline of 10 July; the enclosure material is fixed in the specification.',
    ownerUserId: 5,
    status: 'declined',
    audience: 'private',
    history: [
      { at: '2026-07-13T07:15:00Z', action: 'submitted', actorUserId: 29, note: 'After the question deadline.' },
      { at: '2026-07-13T12:00:00Z', action: 'late_declined', actorUserId: 5, note: null },
    ],
  }),
  question({
    id: 216,
    tenantId: KWU,
    tenderId: 1,
    supplierTenantId: TENANT_IDS['chobe-pipe'],
    lotId: 103,
    requirementId: null,
    documentId: null,
    askedByUserId: 29,
    questionText: 'Are the lot 3 control panels to be wall-mounted or free-standing?',
    submittedAt: '2026-06-23T14:00:00Z',
    ownerUserId: null,
    status: 'withdrawn',
    audience: 'all_participants',
    history: [
      { at: '2026-06-23T14:00:00Z', action: 'submitted', actorUserId: 29, note: null },
      { at: '2026-06-23T16:20:00Z', action: 'withdrawn', actorUserId: 29, note: 'Found in drawing 4 of the tender document.' },
    ],
  }),
  question({
    id: 223,
    tenantId: KWU,
    tenderId: 1,
    supplierTenantId: TENANT_IDS.makgadikgadi,
    lotId: 101,
    requirementId: null,
    documentId: null,
    askedByUserId: 40,
    questionText: 'Asked at the site visit: are the existing borehole headworks reused, or must lot 1 supply new headworks?',
    submittedAt: '2026-07-01T09:40:00Z',
    ownerUserId: 5,
    status: 'published',
    audience: 'public',
    sanitizedQuestion: 'Are the existing borehole headworks reused, or must lot 1 supply new headworks?',
    answerText: 'The existing headworks are reused. Lot 1 supplies the pump, motor, cable and the column pipe only.',
    confidentialityReviewedBy: 4,
    publishedAt: '2026-07-02T10:00:00Z',
    sessionId: 46,
    history: [
      { at: '2026-07-01T09:40:00Z', action: 'recorded_at_session', actorUserId: 5, note: 'Site visit — Serowe wellfield.' },
      { at: '2026-07-02T10:00:00Z', action: 'published', actorUserId: 5, note: 'Shared with the site visit minutes.' },
    ],
  }),

  // T-2026-0003 SCADA telemetry upgrade (released 20 Jul; questions until 14 Aug 2026) ---------------------
  question({
    id: 217,
    tenantId: KWU,
    tenderId: 3,
    supplierTenantId: TENANT_IDS['serowe-ict'],
    lotId: 301,
    requirementId: 3002,
    documentId: null,
    askedByUserId: 33,
    questionText: 'Must every RTU support both DNP3 and IEC 60870-5-104, or is one protocol enough?',
    submittedAt: '2026-07-28T10:00:00Z',
    ownerUserId: 5,
    status: 'published',
    audience: 'public',
    sanitizedQuestion: 'Must every RTU support both DNP3 and IEC 60870-5-104?',
    answerText: 'Yes, both protocols are required. Addendum 1 lists the sites where IEC 60870-5-104 is used today.',
    confidentialityReviewedBy: 4,
    publishedAt: '2026-08-05T09:30:00Z',
    addendumId: 31,
    history: [
      { at: '2026-07-28T10:00:00Z', action: 'submitted', actorUserId: 33, note: null },
      { at: '2026-08-04T16:10:00Z', action: 'review_cleared', actorUserId: 4, note: null },
      { at: '2026-08-05T09:30:00Z', action: 'published', actorUserId: 5, note: 'Audience: public, with Addendum 1.' },
    ],
  }),
  question({
    id: 218,
    tenantId: KWU,
    tenderId: 3,
    supplierTenantId: TENANT_IDS.tsodilo,
    lotId: null,
    requirementId: null,
    documentId: null,
    askedByUserId: 25,
    questionText: 'May Tsodilo quote imported RTU hardware in USD?',
    submittedAt: '2026-08-03T12:10:00Z',
    ownerUserId: 5,
    status: 'published',
    audience: 'public',
    sanitizedQuestion: 'May imported hardware be quoted in a foreign currency?',
    answerText: 'No. All prices are quoted in BWP, the only accepted currency of this tender.',
    confidentialityReviewedBy: 4,
    publishedAt: '2026-08-06T08:00:00Z',
    history: [
      { at: '2026-08-03T12:10:00Z', action: 'submitted', actorUserId: 25, note: null },
      { at: '2026-08-05T14:00:00Z', action: 'review_cleared', actorUserId: 4, note: 'Supplier name removed.' },
      { at: '2026-08-06T08:00:00Z', action: 'published', actorUserId: 5, note: 'Audience: public.' },
    ],
  }),

  // T-2026-0007 Reservoir rehabilitation works (released 11 May; questions until 12 Jun 2026) -------------
  question({
    id: 221,
    tenantId: KWU,
    tenderId: 7,
    supplierTenantId: TENANT_IDS['limpopo-env'],
    lotId: null,
    requirementId: null,
    documentId: null,
    askedByUserId: 41,
    questionText: 'Asked at the briefing: may the reservoir stay out of service for longer than eight months if the roof is replaced in one piece?',
    submittedAt: '2026-05-22T08:10:00Z',
    ownerUserId: 5,
    status: 'published',
    audience: 'public',
    sanitizedQuestion: 'May the reservoir stay out of service for longer than eight months if the roof is replaced in one piece?',
    answerText: 'No. The reservoir must be back in service by the end of month 8; the roof may be replaced in sections to meet that date.',
    confidentialityReviewedBy: 4,
    publishedAt: '2026-05-25T09:00:00Z',
    sessionId: 71,
    history: [
      { at: '2026-05-22T08:10:00Z', action: 'recorded_at_session', actorUserId: 5, note: 'Mandatory briefing.' },
      { at: '2026-05-25T09:00:00Z', action: 'published', actorUserId: 5, note: 'Shared with the briefing minutes.' },
    ],
  }),

  // T-2026-0008 Pipeline valves bulk supply (released 24 Aug; questions until 11 Sep 2026; closed 25 Sep) -
  question({
    id: 219,
    tenantId: KWU,
    tenderId: 8,
    supplierTenantId: TENANT_IDS['chobe-pipe'],
    lotId: 801,
    requirementId: null,
    documentId: null,
    askedByUserId: 29,
    questionText: 'Asked at the site visit: are the Boteti valve chambers accessible to a 10-tonne delivery truck?',
    submittedAt: '2026-09-03T09:10:00Z',
    ownerUserId: 5,
    status: 'published',
    audience: 'public',
    sanitizedQuestion: 'Are the valve chambers accessible to a 10-tonne delivery truck?',
    answerText: 'Chambers 1 to 6 are accessible; chambers 7 and 8 need offloading at the pump station, 400 m away.',
    confidentialityReviewedBy: 4,
    publishedAt: '2026-09-04T12:00:00Z',
    sessionId: 45,
    history: [
      { at: '2026-09-03T09:10:00Z', action: 'recorded_at_session', actorUserId: 5, note: 'Mandatory site visit.' },
      { at: '2026-09-04T12:00:00Z', action: 'published', actorUserId: 5, note: 'Shared with the site visit minutes.' },
    ],
  }),
  question({
    id: 222,
    tenantId: KWU,
    tenderId: 8,
    supplierTenantId: TENANT_IDS['chobe-pipe'],
    lotId: 802,
    requirementId: 8002,
    documentId: null,
    askedByUserId: 29,
    questionText: 'May the air-release valves be offered with ductile iron bodies instead of the cast iron bodies in the schedule?',
    submittedAt: '2026-09-14T09:30:00Z',
    afterDeadline: true,
    ownerUserId: null,
    status: 'received',
    audience: 'all_participants',
    responseDueAt: '2026-09-18T15:00:00Z',
    history: [{ at: '2026-09-14T09:30:00Z', action: 'submitted', actorUserId: 29, note: 'After the question deadline of 11 September.' }],
  }),

  // T-2026-0011 Office cleaning services (ODC; released 16 Sep; questions until 9 Oct 2026) ----------------
  question({
    id: 301,
    tenantId: TENANT_IDS.odc,
    tenderId: 11,
    supplierTenantId: TENANT_IDS['limpopo-env'],
    lotId: 1101,
    requirementId: null,
    documentId: 217,
    askedByUserId: 41,
    questionText: 'How many square metres does the revised floor plan cover, and does it include the library annex?',
    submittedAt: '2026-09-21T08:00:00Z',
    ownerUserId: 23,
    status: 'published',
    audience: 'public',
    sanitizedQuestion: 'How many square metres does the revised floor plan cover, and does it include the library annex?',
    answerText: 'The revised plan covers 3,850 m² and includes the library annex.',
    confidentialityReviewedBy: 22,
    publishedAt: '2026-09-23T09:00:00Z',
    history: [
      { at: '2026-09-21T08:00:00Z', action: 'submitted', actorUserId: 41, note: null },
      { at: '2026-09-22T15:00:00Z', action: 'review_cleared', actorUserId: 22, note: null },
      { at: '2026-09-23T09:00:00Z', action: 'published', actorUserId: 23, note: 'Audience: public.' },
    ],
  }),
  question({
    id: 302,
    tenantId: TENANT_IDS.odc,
    tenderId: 11,
    supplierTenantId: TENANT_IDS.makgadikgadi,
    lotId: 1101,
    requirementId: null,
    documentId: null,
    askedByUserId: 40,
    questionText: 'Is weekend cleaning required at the Maun council chambers during council sessions?',
    submittedAt: '2026-09-28T10:30:00Z',
    ownerUserId: null,
    status: 'received',
    audience: 'all_participants',
    responseDueAt: '2026-10-05T15:00:00Z',
    history: [{ at: '2026-09-28T10:30:00Z', action: 'submitted', actorUserId: 40, note: null }],
  }),
]);

/** Question statuses after which nothing more can happen to the question. */
export const CLOSED_QUESTION_STATUSES = ['published', 'answered_privately', 'escalated_to_addendum', 'declined', 'withdrawn'] as const;
