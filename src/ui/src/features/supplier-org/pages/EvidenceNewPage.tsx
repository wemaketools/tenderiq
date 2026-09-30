/**
 * SUP-05 — add an evidence item to the library. Adding saves it to the library only: nothing is shared with a buyer
 * until the supplier shares it, and nothing is submitted until it is attached to an application or a response.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import type { FieldError } from '@contracts/common';
import { EVIDENCE_ITEMS_EVIDENCE_TYPE } from '@contracts/enums';
import { CreateEvidenceBody, suppliersEndpoints } from '@contracts/suppliers';

import { invalidateApiQueries, useApiMutation } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  FormErrorSummary,
  PageHeader,
  UnsavedChangesGuard,
  useToast,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { EvidenceFields } from '../components/EvidenceFields';
import { supplierErrorMessage } from '../lib/errors';
import {
  emptyEvidenceDraft,
  evidenceErrors,
  evidenceFields,
  isFinancial,
} from '../lib/evidenceForm';
import type { EvidenceDraft } from '../lib/evidenceForm';
import { useDeferredNavigate, useEvidenceCurrencies } from '../lib/hooks';
import { supplierOrgPaths } from '../lib/paths';
import { errorLookup } from '../lib/validation';

const FIELDS = [
  'evidenceType',
  'sensitivity',
  'title',
  'issuer',
  'referenceNumber',
  'periodStart',
  'periodEnd',
  'reportingCurrency',
  'isConsolidated',
  'coverage',
  'validFrom',
  'expiresAt',
  'documentId',
] as const;

/**
 * An empty draft, preset to the evidence kind named by `?type=` (the "Resolve missing evidence" links), when it is a
 * known kind this member may hold.
 */
function draftForType(type: string | null, canHoldFinancial: boolean): EvidenceDraft {
  const draft = emptyEvidenceDraft();
  const known = EVIDENCE_ITEMS_EVIDENCE_TYPE.find((value) => value === type);
  if (known === undefined || (!canHoldFinancial && isFinancial(known, 'general'))) return draft;
  return { ...draft, evidenceType: known };
}

export default function EvidenceNewPage() {
  const tenant = useActiveTenant();
  const toast = useToast();
  const leave = useDeferredNavigate();
  const canHoldFinancial = usePermission('supplier.financial.view');
  const create = useApiMutation(suppliersEndpoints.createEvidence);
  const currencies = useEvidenceCurrencies();
  const [search] = useSearchParams();
  const [draft, setDraft] = useState<EvidenceDraft>(() =>
    draftForType(search.get('type'), canHoldFinancial),
  );
  const [dirty, setDirty] = useState(false);
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const errors = errorLookup(clientErrors, create.error, FIELDS);

  const submit = async (): Promise<void> => {
    const body = {
      evidenceType: draft.evidenceType,
      sensitivity: draft.sensitivity,
      ...evidenceFields(draft, currencies.defaultCurrency),
    };
    const found = evidenceErrors(CreateEvidenceBody, body, draft.document !== null);
    setClientErrors(found);
    if (found.length > 0) return;
    try {
      const created = await create.mutate({ body });
      setDirty(false);
      invalidateApiQueries('supplier.suppliers.evidence.');
      toast.show(t('supplier-org.evidenceForm.added'), 'success');
      leave(supplierOrgPaths.evidenceItem(created.id), { record: created, added: true });
    } catch {
      // The summary shows the error.
    }
  };

  return (
    <div className="tiq-page">
      <UnsavedChangesGuard when={dirty && !create.pending} />
      <PageHeader
        title={t('supplier-org.evidenceForm.newTitle')}
        subtitle={t('supplier-org.evidenceForm.newIntro')}
        back={{ to: supplierOrgPaths.evidence, label: t('supplier-org.evidenceForm.back') }}
      />
      {create.error !== null && (
        <FormErrorSummary title={supplierErrorMessage(create.error)} errors={errors.other} />
      )}
      {create.error === null && errors.other.length > 0 && (
        <FormErrorSummary errors={errors.other} />
      )}
      <Card title={t('supplier-org.evidenceForm.cardTitle')}>
        <EvidenceFields
          draft={draft}
          onChange={(patch) => {
            setDraft((current) => ({ ...current, ...patch }));
            setDirty(true);
          }}
          errorFor={errors.forField}
          editableKind
          canHoldFinancial={canHoldFinancial}
          upload={{ relatedType: 'supplier_profile', relatedId: tenant?.tenantId ?? 1 }}
          currencies={currencies.codes}
          defaultCurrency={currencies.defaultCurrency}
        />
      </Card>
      <Banner tone="info" title={t('supplier-org.evidenceForm.savedNotSharedTitle')}>
        <p>{t('supplier-org.evidenceForm.savedNotShared')}</p>
      </Banner>
      <div className="tiq-inline">
        <Button onClick={() => leave(supplierOrgPaths.evidence)} disabled={create.pending}>
          {t('supplier-org.edit.cancel')}
        </Button>
        <Button
          variant="primary"
          icon="plus"
          loading={create.pending}
          onClick={() => void submit()}
        >
          {t('supplier-org.evidenceForm.save')}
        </Button>
      </div>
    </div>
  );
}
