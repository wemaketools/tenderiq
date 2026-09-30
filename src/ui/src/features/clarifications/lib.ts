/**
 * Shared helpers of the clarifications feature (FR-10): paths, enum options, business error messages and the
 * derived "next required action" of each record (PRD §19).
 */
import { enumValues } from '@contracts/enums';
import type { EnumName, QuestionsStatus } from '@contracts/enums';
import type {
  BuyerAddendumDetail,
  BuyerQuestionDetail,
  LotRef,
  RequirementRef,
  DocumentRef,
  QuestionSubjectType,
} from '@contracts/clarifications';

import { ApiError } from '../../api/client';
import { hasTranslation, t, tEnum } from '../../lib/i18n';

export const QUESTION_PERMISSION = 'tender.clarifications.manage' as const;
export const ADDENDUM_READ_PERMISSION = [
  'tender.clarifications.manage',
  'tender.addenda.approve',
] as const;
export const SESSION_PERMISSION = 'tender.sessions.manage' as const;
export const BUYER_AREA_PERMISSION = [
  'tender.clarifications.manage',
  'tender.addenda.approve',
  'tender.sessions.manage',
] as const;
export const SUPPLIER_READ_PERMISSION = 'supplier.opportunities.view' as const;
export const SUPPLIER_PARTICIPATE_PERMISSION = [
  'supplier.pursuit.manage',
  'supplier.response.edit',
] as const;

export const BUYER_BASE = '/buyer/clarifications';
export const SUPPLIER_BASE = '/supplier/clarifications';
export const SUPPLIER_SESSIONS_BASE = '/supplier/briefings';

export const buyerPaths = {
  questions: `${BUYER_BASE}/questions`,
  question: (id: number) => `${BUYER_BASE}/questions/${id}`,
  addenda: `${BUYER_BASE}/addenda`,
  newAddendum: `${BUYER_BASE}/addenda/new`,
  addendum: (id: number) => `${BUYER_BASE}/addenda/${id}`,
  editAddendum: (id: number) => `${BUYER_BASE}/addenda/${id}/edit`,
  sessions: `${BUYER_BASE}/sessions`,
  newSession: `${BUYER_BASE}/sessions/new`,
  session: (id: number) => `${BUYER_BASE}/sessions/${id}`,
  editSession: (id: number) => `${BUYER_BASE}/sessions/${id}/edit`,
};

export const supplierPaths = {
  overview: SUPPLIER_BASE,
  tender: (id: number) => `${SUPPLIER_BASE}/tenders/${id}`,
  question: (id: number) => `${SUPPLIER_BASE}/questions/${id}`,
  addendum: (id: number) => `${SUPPLIER_BASE}/addenda/${id}`,
  sessions: SUPPLIER_SESSIONS_BASE,
  session: (id: number) => `${SUPPLIER_SESSIONS_BASE}/${id}`,
};

export const publicPath = (buyerSlug: string, reference: string) =>
  `/clarifications/${buyerSlug}/${reference}`;

/** Questions that no longer accept handling actions. */
export const CLOSED_QUESTION_STATUSES: readonly QuestionsStatus[] = [
  'published',
  'answered_privately',
  'escalated_to_addendum',
  'declined',
  'withdrawn',
];

export function isQuestionClosed(status: QuestionsStatus): boolean {
  return CLOSED_QUESTION_STATUSES.includes(status);
}

/** Select options of an enumeration, labelled through the catalog. */
export function enumOptions<N extends EnumName>(name: N, only?: readonly string[]) {
  const values: readonly string[] = enumValues(name);
  return values
    .filter((value) => only === undefined || only.includes(value))
    .map((value) => ({ value, label: tEnum(name, value) }));
}

/**
 * The same failure with a clear business message: a declared error code (`LATE_DISPOSITION_REQUIRED`) is explained
 * through the feature catalog; anything else keeps the server's problem detail.
 */
export function explainError(error: ApiError | null): ApiError | null {
  if (error === null || error.code === null) {
    return error;
  }
  const key = `clarifications.errors.${error.code}`;
  if (!hasTranslation(key)) {
    return error;
  }
  return new ApiError({
    kind: error.kind,
    status: error.status,
    title: error.title,
    code: error.code,
    detail: t(key),
    fieldErrors: error.fieldErrors,
    correlationId: error.correlationId,
    endpointId: error.endpointId,
  });
}

/** The message of a failure for a toast. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const explained = explainError(error);
    return explained?.detail ?? explained?.title ?? t('clarifications.common.failed');
  }
  return t('clarifications.common.failed');
}

/** "Lot 2 · Pump sets", "REQ-Q-05", the document title or "Whole tender" (BUY-16 category). */
export function subjectLabel(subject: {
  readonly subjectType: QuestionSubjectType;
  readonly lot: LotRef | null;
  readonly requirement: RequirementRef | null;
  readonly document: DocumentRef | null;
}): string {
  const parts: string[] = [];
  if (subject.lot !== null) {
    parts.push(
      t('clarifications.common.lotLabel', { no: subject.lot.lotNo, title: subject.lot.title }),
    );
  }
  if (subject.requirement !== null) {
    parts.push(subject.requirement.refCode);
  }
  if (subject.document !== null) {
    parts.push(subject.document.title);
  }
  return parts.length === 0 ? t('clarifications.subject.tender') : parts.join(' · ');
}

export function lotsLabel(lots: readonly LotRef[]): string {
  if (lots.length === 0) {
    return t('clarifications.common.allLots');
  }
  return lots.map((lot) => t('clarifications.common.lotShort', { no: lot.lotNo })).join(', ');
}

/** The next required action on a question (PRD §19). */
export function questionNextAction(question: BuyerQuestionDetail): string {
  if (
    question.afterDeadline &&
    question.lateDisposition === null &&
    !isQuestionClosed(question.status)
  ) {
    return t('clarifications.next.question.lateDisposition');
  }
  switch (question.status) {
    case 'received':
      return t('clarifications.next.question.assign');
    case 'assigned':
      return t('clarifications.next.question.draft');
    case 'draft_answer':
      return t('clarifications.next.question.review');
    case 'in_review':
      return t('clarifications.next.question.inReview');
    default:
      return t('clarifications.next.none');
  }
}

/** The next required action on an addendum (PRD §19). */
export function addendumNextAction(addendum: BuyerAddendumDetail): string {
  switch (addendum.status) {
    case 'draft':
      return addendum.blockingIssues.length > 0
        ? t('clarifications.next.addendum.resolve')
        : t('clarifications.next.addendum.submit');
    case 'awaiting_approval':
      return t('clarifications.next.addendum.approval');
    case 'approved':
      return t('clarifications.next.addendum.issue');
    case 'issued':
      return (addendum.acknowledgments?.actionOutstanding ?? 0) > 0
        ? t('clarifications.next.addendum.followUp')
        : t('clarifications.next.none');
    default:
      return t('clarifications.next.none');
  }
}

/** Split multi-line attendee input into names. */
export function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** A one-line excerpt of a long text for table cells (the full text stays in the title and on the record page). */
export function excerpt(text: string, max = 110): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
