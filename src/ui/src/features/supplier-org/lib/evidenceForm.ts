/**
 * The evidence edition form (SUP-05 add and replace): the draft held by the page and its mapping to the contract
 * bodies. Financial statements need their reporting period and currency; insurance needs coverage and expiry (the
 * contract's rules, checked before sending). Currencies come from the reference endpoint; a coverage left without a
 * currency uses the organization's default currency (`useEvidenceCurrencies`).
 */
import type { FieldError } from '@contracts/common';
import type { EvidenceItemsEvidenceType, EvidenceItemsSensitivity } from '@contracts/enums';
import type { EvidenceItem } from '@contracts/suppliers';

import { t } from '../../../lib/i18n';
import type { UploadedDocument } from '../components/EvidenceUploadField';
import { textOrNull } from './lists';
import { validateWith } from './validation';

export interface EvidenceDraft {
  evidenceType: EvidenceItemsEvidenceType;
  sensitivity: EvidenceItemsSensitivity;
  title: string;
  issuer: string;
  referenceNumber: string;
  periodStart: string;
  periodEnd: string;
  reportingCurrency: string;
  isConsolidated: string;
  coverage: { amount: string; currency: string };
  validFrom: string;
  expiresAt: string;
  document: UploadedDocument | null;
}

/** Evidence that only `supplier.financial.view` members may hold (PRD §4.3). */
export function isFinancial(
  type: EvidenceItemsEvidenceType,
  sensitivity: EvidenceItemsSensitivity,
): boolean {
  return sensitivity === 'financial' || type === 'financial_statement' || type === 'credit_report';
}

/** The chosen coverage currency, or the default while none is chosen. */
export function effectiveCurrency(value: string, defaultCurrency: string): string {
  return value === '' ? defaultCurrency : value;
}

export function emptyEvidenceDraft(): EvidenceDraft {
  return {
    evidenceType: 'certificate',
    sensitivity: 'general',
    title: '',
    issuer: '',
    referenceNumber: '',
    periodStart: '',
    periodEnd: '',
    reportingCurrency: '',
    isConsolidated: '',
    coverage: { amount: '', currency: '' },
    validFrom: '',
    expiresAt: '',
    document: null,
  };
}

/** A replacement draft starts from the current edition (a new document is always required). */
export function draftFromItem(item: EvidenceItem): EvidenceDraft {
  return {
    evidenceType: item.evidenceType,
    sensitivity: item.sensitivity,
    title: item.title,
    issuer: item.issuer ?? '',
    referenceNumber: item.referenceNumber ?? '',
    periodStart: item.periodStart ?? '',
    periodEnd: item.periodEnd ?? '',
    reportingCurrency: item.reportingCurrency ?? '',
    isConsolidated: item.isConsolidated === null ? '' : item.isConsolidated ? 'yes' : 'no',
    coverage: item.coverage === null ? { amount: '', currency: '' } : { ...item.coverage },
    validFrom: item.validFrom ?? '',
    expiresAt: item.expiresAt ?? '',
    document: null,
  };
}

function dateOrNull(value: string): string | null {
  return value === '' ? null : value;
}

/** The fields shared by the create and replace bodies (`documentId` 0 when missing, so validation reports it). */
export function evidenceFields(draft: EvidenceDraft, defaultCurrency: string) {
  return {
    title: draft.title.trim(),
    issuer: textOrNull(draft.issuer),
    referenceNumber: textOrNull(draft.referenceNumber),
    periodStart: dateOrNull(draft.periodStart),
    periodEnd: dateOrNull(draft.periodEnd),
    reportingCurrency: draft.reportingCurrency === '' ? null : draft.reportingCurrency,
    isConsolidated: draft.isConsolidated === '' ? null : draft.isConsolidated === 'yes',
    coverage:
      draft.coverage.amount.trim() === ''
        ? null
        : {
            amount: draft.coverage.amount,
            currency: effectiveCurrency(draft.coverage.currency, defaultCurrency),
          },
    validFrom: dateOrNull(draft.validFrom),
    expiresAt: dateOrNull(draft.expiresAt),
    documentId: draft.document?.documentId ?? 0,
  };
}

/** Contract validation plus the "upload the document first" rule, with one message per missing document. */
export function evidenceErrors(
  schema: Parameters<typeof validateWith>[0],
  body: unknown,
  hasDocument: boolean,
): FieldError[] {
  const found = validateWith(schema, body).filter((item) => item.field !== 'documentId');
  return hasDocument
    ? found
    : [
        ...found,
        {
          field: 'documentId',
          code: 'DOCUMENT_REQUIRED',
          message: t('supplier-org.evidenceForm.documentRequired'),
        },
      ];
}
