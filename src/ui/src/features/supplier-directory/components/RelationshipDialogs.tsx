/**
 * BUY-32 commands on this buyer's relationship: update status, risk, owner, restriction and internal notes (with the
 * reason recorded in the history), and add or edit relationship contacts. These records are buyer-internal: the
 * supplier and other buyers never see them (BR-45, DD-03).
 */
import { useState } from 'react';

import type { FieldError, PersonRef } from '@contracts/common';
import {
  BUYER_SUPPLIER_RELATIONSHIPS_RISK_RATING,
  BUYER_SUPPLIER_RELATIONSHIPS_STATUS,
} from '@contracts/enums';
import type {
  BuyerSupplierRelationshipsRiskRating,
  BuyerSupplierRelationshipsStatus,
} from '@contracts/enums';
import {
  RelationshipContactBody,
  UpdateRelationshipBody,
  suppliersEndpoints,
} from '@contracts/suppliers';
import type { Relationship, RelationshipContact } from '@contracts/suppliers';

import { useApiMutation } from '../../../api/hooks';
import {
  Button,
  Checkbox,
  ConfirmActionDialog,
  Dialog,
  FormErrorSummary,
  Select,
  TextArea,
  TextField,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { supplierErrorMessage, withSupplierMessage } from '../../supplier-org/lib/errors';
import { textOrNull } from '../../supplier-org/lib/lists';
import { errorLookup, validateWith } from '../../supplier-org/lib/validation';

export function UpdateRelationshipDialog({
  supplierTenantId,
  supplierName,
  relationship,
  ownerOptions,
  onClose,
  onDone,
}: {
  readonly supplierTenantId: number;
  readonly supplierName: string;
  readonly relationship: Relationship | null;
  readonly ownerOptions: readonly PersonRef[];
  readonly onClose: () => void;
  readonly onDone: (relationship: Relationship) => void;
}) {
  const update = useApiMutation(suppliersEndpoints.updateRelationship);
  const [status, setStatus] = useState<BuyerSupplierRelationshipsStatus>(
    relationship?.status ?? 'prospective',
  );
  const [risk, setRisk] = useState<BuyerSupplierRelationshipsRiskRating>(
    relationship?.riskRating ?? 'not_assessed',
  );
  const [owner, setOwner] = useState(
    relationship?.owner === null || relationship?.owner === undefined
      ? ''
      : String(relationship.owner.userId),
  );
  const [restriction, setRestriction] = useState(relationship?.restrictionNote ?? '');
  const [notes, setNotes] = useState(relationship?.internalNotes ?? '');
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const errors = errorLookup(clientErrors, update.error, [
    'status',
    'riskRating',
    'relationshipOwnerUserId',
    'restrictionNote',
    'internalNotes',
    'changeReason',
  ]);
  const restricting = status === 'restricted' || status === 'suspended';

  return (
    <ConfirmActionDialog
      open
      title={t('supplier-directory.relationship.updateTitle')}
      scope={t('supplier-directory.relationship.updateScope', { name: supplierName })}
      consequence={
        restricting
          ? t('supplier-directory.relationship.restrictResult')
          : t('supplier-directory.relationship.updateResult')
      }
      confirmLabel={t('supplier-directory.relationship.save')}
      tone={restricting ? 'danger' : 'primary'}
      reason={{ label: t('supplier-directory.relationship.changeReason'), required: true }}
      pending={update.pending}
      error={withSupplierMessage(update.error)}
      onCancel={() => {
        update.reset();
        onClose();
      }}
      onConfirm={async ({ reason }) => {
        const body = {
          status,
          riskRating: risk,
          relationshipOwnerUserId: owner === '' ? null : Number(owner),
          restrictionNote: textOrNull(restriction),
          internalNotes: textOrNull(notes),
          changeReason: reason,
        };
        const found = validateWith(UpdateRelationshipBody, body);
        setClientErrors(found);
        if (found.length > 0) return;
        try {
          const result = await update.mutate({ params: { supplierTenantId }, body });
          onDone(result);
        } catch {
          // The dialog shows the error.
        }
      }}
    >
      <div className="tiq-form-grid">
        <Select
          label={t('supplier-directory.relationship.status')}
          required
          value={status}
          options={BUYER_SUPPLIER_RELATIONSHIPS_STATUS.map((value) => ({
            value,
            label: tEnum('buyer_supplier_relationships.status', value),
          }))}
          onChange={(value) => setStatus(value as BuyerSupplierRelationshipsStatus)}
          error={errors.forField('status')}
        />
        <Select
          label={t('supplier-directory.relationship.risk')}
          required
          value={risk}
          options={BUYER_SUPPLIER_RELATIONSHIPS_RISK_RATING.map((value) => ({
            value,
            label: tEnum('buyer_supplier_relationships.risk_rating', value),
          }))}
          onChange={(value) => setRisk(value as BuyerSupplierRelationshipsRiskRating)}
          error={errors.forField('riskRating')}
        />
        <Select
          label={t('supplier-directory.relationship.owner')}
          placeholder={t('supplier-directory.list.unassigned')}
          value={owner}
          options={ownerOptions.map((person) => ({
            value: String(person.userId),
            label: person.fullName,
          }))}
          onChange={setOwner}
          error={errors.forField('relationshipOwnerUserId')}
        />
        <TextArea
          label={t('supplier-directory.relationship.restriction')}
          hint={t('supplier-directory.relationship.restrictionHint')}
          required={restricting}
          fieldClassName="tiq-form-full"
          rows={2}
          value={restriction}
          onChange={setRestriction}
          error={errors.forField('restrictionNote')}
        />
        <TextArea
          label={t('supplier-directory.relationship.internalNotes')}
          hint={t('supplier-directory.relationship.internalNotesHint')}
          fieldClassName="tiq-form-full"
          rows={3}
          value={notes}
          onChange={setNotes}
          error={errors.forField('internalNotes')}
        />
      </div>
      {errors.forField('changeReason') !== undefined && (
        <p className="tiq-field-error" role="alert">
          {errors.forField('changeReason')}
        </p>
      )}
    </ConfirmActionDialog>
  );
}

export function ContactDialog({
  supplierTenantId,
  contact,
  onClose,
  onDone,
}: {
  readonly supplierTenantId: number;
  /** The contact to edit, or null to add one. */
  readonly contact: RelationshipContact | null;
  readonly onClose: () => void;
  readonly onDone: (contact: RelationshipContact) => void;
}) {
  const create = useApiMutation(suppliersEndpoints.createContact);
  const update = useApiMutation(suppliersEndpoints.updateContact);
  const [name, setName] = useState(contact?.name ?? '');
  const [email, setEmail] = useState(contact?.email ?? '');
  const [phone, setPhone] = useState(contact?.phone ?? '');
  const [role, setRole] = useState(contact?.roleLabel ?? '');
  const [primary, setPrimary] = useState(contact?.isPrimary ?? false);
  const [active, setActive] = useState(contact?.active ?? true);
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const serverError = contact === null ? create.error : update.error;
  const pending = create.pending || update.pending;
  const errors = errorLookup(clientErrors, serverError, [
    'name',
    'email',
    'phone',
    'roleLabel',
    'isPrimary',
    'active',
  ]);

  const save = async (): Promise<void> => {
    const body = {
      name: name.trim(),
      email: textOrNull(email),
      phone: textOrNull(phone),
      roleLabel: textOrNull(role),
      isPrimary: primary,
      active,
    };
    const found = validateWith(RelationshipContactBody, body);
    setClientErrors(found);
    if (found.length > 0) return;
    try {
      const result =
        contact === null
          ? await create.mutate({ params: { supplierTenantId }, body })
          : await update.mutate({ params: { supplierTenantId, contactId: contact.id }, body });
      onDone(result);
    } catch {
      // The summary shows the error.
    }
  };

  return (
    <Dialog
      open
      title={
        contact === null
          ? t('supplier-directory.contacts.addTitle')
          : t('supplier-directory.contacts.editTitle', { name: contact.name })
      }
      description={t('supplier-directory.contacts.internal')}
      onClose={onClose}
      dismissible={!pending}
      footer={
        <>
          <Button onClick={onClose} disabled={pending}>
            {t('ui.action.cancel')}
          </Button>
          <Button variant="primary" loading={pending} onClick={() => void save()}>
            {t('supplier-directory.contacts.save')}
          </Button>
        </>
      }
    >
      <div className="tiq-stack">
        {serverError !== null && (
          <FormErrorSummary title={supplierErrorMessage(serverError)} errors={errors.other} />
        )}
        <div className="tiq-form-grid">
          <TextField
            label={t('supplier-directory.contacts.name')}
            required
            value={name}
            onChange={setName}
            error={errors.forField('name')}
          />
          <TextField
            label={t('supplier-directory.contacts.role')}
            value={role}
            onChange={setRole}
            error={errors.forField('roleLabel')}
          />
          <TextField
            label={t('supplier-directory.contacts.email')}
            type="email"
            value={email}
            onChange={setEmail}
            error={errors.forField('email')}
          />
          <TextField
            label={t('supplier-directory.contacts.phone')}
            type="tel"
            value={phone}
            onChange={setPhone}
            error={errors.forField('phone')}
          />
          <Checkbox
            label={t('supplier-directory.contacts.primary')}
            checked={primary}
            onChange={setPrimary}
          />
          <Checkbox
            label={t('supplier-directory.contacts.active')}
            checked={active}
            onChange={setActive}
          />
        </div>
      </div>
    </Dialog>
  );
}
