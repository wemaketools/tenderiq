/**
 * The fields of an evidence edition (SUP-05): type and sensitivity (on a new item), title, issuer, reference, the
 * reporting period and currency (financial statements), coverage (insurance), validity, and the document itself.
 */
import { EVIDENCE_ITEMS_EVIDENCE_TYPE, EVIDENCE_ITEMS_SENSITIVITY } from '@contracts/enums';
import type { EvidenceItemsEvidenceType, EvidenceItemsSensitivity } from '@contracts/enums';

import { DateInput, MoneyInput, Select, TextField } from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { effectiveCurrency, isFinancial } from '../lib/evidenceForm';
import type { EvidenceDraft } from '../lib/evidenceForm';
import { EvidenceUploadField } from './EvidenceUploadField';

export interface EvidenceFieldsProps {
  readonly draft: EvidenceDraft;
  readonly onChange: (patch: Partial<EvidenceDraft>) => void;
  readonly errorFor: (field: string) => string | undefined;
  /** Type and sensitivity are chosen once, when the item is added. */
  readonly editableKind: boolean;
  /** Whether the member may hold financial evidence (`supplier.financial.view`). */
  readonly canHoldFinancial: boolean;
  readonly upload: {
    readonly relatedType: 'supplier_profile' | 'evidence_item';
    readonly relatedId: number;
  };
  /** Currencies served by the API (`useEvidenceCurrencies`). */
  readonly currencies: readonly string[];
  /** The currency a coverage amount uses until another is chosen. */
  readonly defaultCurrency: string;
}

export function EvidenceFields({
  draft,
  onChange,
  errorFor,
  editableKind,
  canHoldFinancial,
  upload,
  currencies,
  defaultCurrency,
}: EvidenceFieldsProps) {
  const financialType = draft.evidenceType === 'financial_statement';
  const insurance = draft.evidenceType === 'insurance';
  return (
    <div className="tiq-stack">
      <div className="tiq-form-grid">
        {editableKind && (
          <>
            <Select
              label={t('supplier-org.evidenceForm.type')}
              required
              value={draft.evidenceType}
              options={EVIDENCE_ITEMS_EVIDENCE_TYPE.map((value) => ({
                value,
                label: tEnum('evidence_items.evidence_type', value),
                disabled: !canHoldFinancial && isFinancial(value, 'general'),
              }))}
              onChange={(value) => onChange({ evidenceType: value as EvidenceItemsEvidenceType })}
              hint={canHoldFinancial ? undefined : t('supplier-org.evidenceForm.financialHint')}
              error={errorFor('evidenceType')}
            />
            <Select
              label={t('supplier-org.evidenceForm.sensitivity')}
              required
              value={draft.sensitivity}
              options={EVIDENCE_ITEMS_SENSITIVITY.map((value) => ({
                value,
                label: tEnum('evidence_items.sensitivity', value),
                disabled: !canHoldFinancial && value === 'financial',
              }))}
              onChange={(value) => onChange({ sensitivity: value as EvidenceItemsSensitivity })}
              hint={t('supplier-org.evidenceForm.sensitivityHint')}
              error={errorFor('sensitivity')}
            />
          </>
        )}
        <TextField
          label={t('supplier-org.evidenceForm.title')}
          required
          fieldClassName="tiq-form-full"
          value={draft.title}
          onChange={(title) => onChange({ title })}
          error={errorFor('title')}
        />
        <TextField
          label={t('supplier-org.evidenceForm.issuer')}
          value={draft.issuer}
          onChange={(issuer) => onChange({ issuer })}
          error={errorFor('issuer')}
        />
        <TextField
          label={t('supplier-org.evidenceForm.reference')}
          value={draft.referenceNumber}
          onChange={(referenceNumber) => onChange({ referenceNumber })}
          error={errorFor('referenceNumber')}
        />
        <DateInput
          label={t('supplier-org.evidenceForm.periodStart')}
          required={financialType}
          value={draft.periodStart}
          onChange={(periodStart) => onChange({ periodStart })}
          error={errorFor('periodStart')}
        />
        <DateInput
          label={t('supplier-org.evidenceForm.periodEnd')}
          required={financialType}
          value={draft.periodEnd}
          onChange={(periodEnd) => onChange({ periodEnd })}
          error={errorFor('periodEnd')}
        />
        {financialType && (
          <>
            <Select
              label={t('supplier-org.evidenceForm.currency')}
              required
              placeholder={t('supplier-org.evidenceForm.chooseCurrency')}
              value={draft.reportingCurrency}
              options={currencies.map((code) => ({ value: code, label: code }))}
              onChange={(reportingCurrency) => onChange({ reportingCurrency })}
              error={errorFor('reportingCurrency')}
            />
            <Select
              label={t('supplier-org.evidenceForm.consolidated')}
              placeholder={t('supplier-org.evidenceForm.notStated')}
              value={draft.isConsolidated}
              options={[
                { value: 'yes', label: t('supplier-org.evidenceForm.consolidatedYes') },
                { value: 'no', label: t('supplier-org.evidenceForm.consolidatedNo') },
              ]}
              onChange={(isConsolidated) => onChange({ isConsolidated })}
              error={errorFor('isConsolidated')}
            />
          </>
        )}
        <MoneyInput
          label={t('supplier-org.evidenceForm.coverage')}
          hint={insurance ? t('supplier-org.evidenceForm.coverageHint') : undefined}
          required={insurance}
          value={{
            amount: draft.coverage.amount,
            currency: effectiveCurrency(draft.coverage.currency, defaultCurrency),
          }}
          currencies={currencies}
          onChange={(coverage) => onChange({ coverage: { ...coverage } })}
          error={errorFor('coverage')}
        />
        <DateInput
          label={t('supplier-org.evidenceForm.validFrom')}
          value={draft.validFrom}
          onChange={(validFrom) => onChange({ validFrom })}
          error={errorFor('validFrom')}
        />
        <DateInput
          label={t('supplier-org.evidenceForm.expiresAt')}
          required={insurance}
          value={draft.expiresAt}
          onChange={(expiresAt) => onChange({ expiresAt })}
          error={errorFor('expiresAt')}
        />
      </div>
      <EvidenceUploadField
        relatedType={upload.relatedType}
        relatedId={upload.relatedId}
        title={draft.title.trim() === '' ? t('supplier-org.evidenceForm.document') : draft.title}
        value={draft.document}
        onChange={(document) => onChange({ document })}
        error={errorFor('documentId')}
      />
    </div>
  );
}
