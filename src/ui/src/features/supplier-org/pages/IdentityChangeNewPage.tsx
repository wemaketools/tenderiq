/**
 * SUP-03 — request a reviewed legal-identity change (legal name, registration, ownership, merger, succession,
 * transfer of representation, administrator recovery) with evidence (FR-02). Submitting sends it for operator review;
 * nothing changes until it is approved, and historical submissions keep their original representation.
 */
import { useState } from 'react';

import type { FieldError } from '@contracts/common';
import { SUPPLIER_IDENTITY_CHANGES_CHANGE_TYPE } from '@contracts/enums';
import type { SupplierIdentityChangesChangeType } from '@contracts/enums';
import { CreateIdentityChangeBody, suppliersEndpoints } from '@contracts/suppliers';
import type { SupplierProfile } from '@contracts/suppliers';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  ConfirmActionDialog,
  DateInput,
  DetailList,
  FormErrorSummary,
  PageHeader,
  QueryView,
  Select,
  TextArea,
  UnsavedChangesGuard,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { EvidenceUploadField } from '../components/EvidenceUploadField';
import type { UploadedDocument } from '../components/EvidenceUploadField';
import { supplierErrorMessage, withSupplierMessage } from '../lib/errors';
import { useDeferredNavigate } from '../lib/hooks';
import { supplierOrgPaths } from '../lib/paths';
import { errorLookup, validateWith } from '../lib/validation';

const FIELDS = [
  'changeType',
  'proposedValue',
  'reason',
  'evidenceDocumentId',
  'requestedEffectiveDate',
] as const;

export default function IdentityChangeNewPage() {
  const query = useApiQuery(suppliersEndpoints.getProfile, {});
  return (
    <div className="tiq-page">
      <PageHeader
        title={t('supplier-org.change.newTitle')}
        subtitle={t('supplier-org.change.newIntro')}
        back={{
          to: `${supplierOrgPaths.profile}?tab=identity`,
          label: t('supplier-org.edit.back'),
        }}
      />
      <QueryView query={query}>{(profile) => <ChangeForm profile={profile} />}</QueryView>
    </div>
  );
}

function currentValueOf(
  profile: SupplierProfile,
  type: SupplierIdentityChangesChangeType,
): string | null {
  switch (type) {
    case 'legal_name':
      return profile.legalName;
    case 'registration':
      return [profile.registrationNumber, profile.registrationJurisdiction]
        .filter((part) => part !== null)
        .join(' · ');
    case 'ownership':
      return profile.ownershipDisclosure;
    case 'admin_recovery':
    case 'representation_transfer':
      return profile.primaryContact?.fullName ?? null;
    default:
      return null;
  }
}

function ChangeForm({ profile }: { readonly profile: SupplierProfile }) {
  const leave = useDeferredNavigate();
  const create = useApiMutation(suppliersEndpoints.createIdentityChange);
  const [changeType, setChangeType] = useState<SupplierIdentityChangesChangeType>('legal_name');
  const [proposedValue, setProposedValue] = useState('');
  const [reason, setReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [document, setDocument] = useState<UploadedDocument | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const errors = errorLookup(clientErrors, create.error, FIELDS);

  const body = {
    changeType,
    proposedValue: proposedValue.trim(),
    reason: reason.trim(),
    evidenceDocumentId: document?.documentId ?? null,
    ...(effectiveDate === '' ? {} : { requestedEffectiveDate: effectiveDate }),
  };

  const review = (): void => {
    const found = validateWith(CreateIdentityChangeBody, body).concat(
      document === null
        ? [
            {
              field: 'evidenceDocumentId',
              code: 'EVIDENCE_REQUIRED',
              message: t('supplier-org.change.evidenceRequired'),
            },
          ]
        : [],
    );
    setClientErrors(found);
    if (found.length === 0) setConfirming(true);
  };

  const touch =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setDirty(true);
    };
  const current = currentValueOf(profile, changeType);

  return (
    <div className="tiq-stack">
      <UnsavedChangesGuard when={dirty && !create.pending} />
      {create.error !== null && !confirming && (
        <FormErrorSummary title={supplierErrorMessage(create.error)} errors={errors.other} />
      )}
      <Banner tone="info" title={t('supplier-org.change.reviewedTitle')}>
        <p>{t('supplier-org.change.reviewed')}</p>
      </Banner>
      <Card title={t('supplier-org.change.formTitle')}>
        <div className="tiq-form-grid">
          <Select
            label={t('supplier-org.change.type')}
            required
            value={changeType}
            options={SUPPLIER_IDENTITY_CHANGES_CHANGE_TYPE.map((value) => ({
              value,
              label: tEnum('supplier_identity_changes.change_type', value),
            }))}
            onChange={touch((value: string) =>
              setChangeType(value as SupplierIdentityChangesChangeType),
            )}
            error={errors.forField('changeType')}
          />
          <DateInput
            label={t('supplier-org.change.effectiveDate')}
            hint={t('supplier-org.change.effectiveDateHint')}
            value={effectiveDate}
            onChange={touch(setEffectiveDate)}
            error={errors.forField('requestedEffectiveDate')}
          />
          <div className="tiq-form-full">
            <DetailList
              items={[
                {
                  key: 'current',
                  label: t('supplier-org.change.currentValue'),
                  value: current,
                },
              ]}
            />
          </div>
          <TextArea
            label={t('supplier-org.change.proposedValue')}
            hint={t(`supplier-org.change.proposedHint.${changeType}`)}
            required
            rows={2}
            fieldClassName="tiq-form-full"
            value={proposedValue}
            onChange={touch(setProposedValue)}
            error={errors.forField('proposedValue')}
          />
          <TextArea
            label={t('supplier-org.change.reason')}
            hint={t('supplier-org.change.reasonHint')}
            required
            rows={3}
            fieldClassName="tiq-form-full"
            value={reason}
            onChange={touch(setReason)}
            error={errors.forField('reason')}
          />
        </div>
      </Card>
      <Card
        title={t('supplier-org.change.evidenceTitle')}
        subtitle={t('supplier-org.change.evidenceHint')}
      >
        <EvidenceUploadField
          relatedType="supplier_profile"
          relatedId={profile.tenantId}
          title={t('supplier-org.change.evidenceDocTitle', {
            type: tEnum('supplier_identity_changes.change_type', changeType),
          })}
          value={document}
          onChange={touch(setDocument)}
          error={errors.forField('evidenceDocumentId')}
        />
      </Card>
      <div className="tiq-inline">
        <Button onClick={() => leave(`${supplierOrgPaths.profile}?tab=identity`)}>
          {t('supplier-org.edit.cancel')}
        </Button>
        <Button variant="primary" icon="send" onClick={review}>
          {t('supplier-org.change.submit')}
        </Button>
      </div>
      <ConfirmActionDialog
        open={confirming}
        title={t('supplier-org.change.confirmTitle')}
        scope={t('supplier-org.change.confirmScope', {
          type: tEnum('supplier_identity_changes.change_type', changeType),
          name: profile.legalName,
        })}
        consequence={t('supplier-org.change.confirmResult')}
        confirmLabel={t('supplier-org.change.submit')}
        pending={create.pending}
        error={withSupplierMessage(create.error)}
        onCancel={() => {
          create.reset();
          setConfirming(false);
        }}
        onConfirm={async () => {
          try {
            const created = await create.mutate({ body });
            setDirty(false);
            setConfirming(false);
            invalidateApiQueries('supplier.suppliers.');
            leave(supplierOrgPaths.identityChange(created.id), {
              record: created,
              submitted: true,
            });
          } catch {
            // The dialog shows the error.
          }
        }}
      />
    </div>
  );
}
