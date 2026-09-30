/**
 * BUY-31 / BUY-32 commands, each confirmed with the acting organization, capacity, scope and result (COM-02):
 * invite a supplier (a provisional record whose contact is invited to claim it, FR-02), request qualification under
 * one of this buyer's programmes, and flag two records as possible duplicates for the platform operator (BR-44).
 */
import { useState } from 'react';

import type { FieldError } from '@contracts/common';
import { DUPLICATE_CANDIDATES_DETECTED_REASON } from '@contracts/enums';
import type { DuplicateCandidatesDetectedReason } from '@contracts/enums';
import {
  CreateProvisionalSupplierBody,
  FlagDuplicateBody,
  RequestQualificationBody,
  suppliersEndpoints,
} from '@contracts/suppliers';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  ConfirmActionDialog,
  DateInput,
  ErrorState,
  Select,
  SkeletonBlock,
  TextArea,
  TextField,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { CategoryPicker } from '../../supplier-org/components/OrganizationFields';
import { withSupplierMessage } from '../../supplier-org/lib/errors';
import { countryOptions, effectiveCountry } from '../../supplier-org/lib/organizationForm';
import { errorLookup, validateWith } from '../../supplier-org/lib/validation';

export interface SupplierRef {
  readonly supplierTenantId: number;
  readonly legalName: string;
}

// ---------------------------------------------------------------------------------------------------------
// Invite (provisional supplier)
// ---------------------------------------------------------------------------------------------------------

export function InviteSupplierDialog({
  onClose,
  onDone,
}: {
  readonly onClose: () => void;
  readonly onDone: (message: string) => void;
}) {
  const categories = useApiQuery(suppliersEndpoints.categoryOptions, {});
  const reference = useApiQuery(suppliersEndpoints.referenceOptions, {});
  const create = useApiMutation(suppliersEndpoints.createProvisionalSupplier);
  const [legalName, setLegalName] = useState('');
  const [chosenCountry, setCountry] = useState('');
  const country = effectiveCountry(chosenCountry, reference.data);
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const errors = errorLookup(clientErrors, create.error, [
    'legalName',
    'country',
    'registrationNumber',
    'contactName',
    'contactEmail',
    'categories',
    'message',
  ]);

  return (
    <ConfirmActionDialog
      open
      title={t('supplier-directory.invite.title')}
      scope={t('supplier-directory.invite.scope', {
        name:
          legalName.trim() === '' ? t('supplier-directory.invite.newSupplier') : legalName.trim(),
        email: contactEmail.trim() === '' ? '—' : contactEmail.trim(),
      })}
      consequence={t('supplier-directory.invite.result')}
      confirmLabel={t('supplier-directory.invite.confirm')}
      pending={create.pending}
      error={withSupplierMessage(create.error)}
      onCancel={() => {
        create.reset();
        onClose();
      }}
      onConfirm={async () => {
        const body = {
          legalName: legalName.trim(),
          country,
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim(),
          categories: codes,
          ...(registrationNumber.trim() === ''
            ? {}
            : { registrationNumber: registrationNumber.trim() }),
          ...(message.trim() === '' ? {} : { message: message.trim() }),
        };
        const found = validateWith(CreateProvisionalSupplierBody, body);
        setClientErrors(found);
        if (found.length > 0) return;
        try {
          const result = await create.mutate({ body });
          onDone(
            t('supplier-directory.invite.done', {
              name: result.legalName,
              status: tEnum('invitations.status', result.invitationStatus),
              message: result.message,
            }),
          );
        } catch {
          // The dialog shows the error.
        }
      }}
    >
      <div className="tiq-form-grid">
        <TextField
          label={t('supplier-directory.invite.legalName')}
          required
          fieldClassName="tiq-form-full"
          value={legalName}
          onChange={setLegalName}
          error={errors.forField('legalName')}
        />
        <Select
          label={t('supplier-directory.invite.country')}
          required
          value={country}
          options={countryOptions(reference.data)}
          onChange={setCountry}
          error={errors.forField('country')}
        />
        <TextField
          label={t('supplier-directory.invite.registrationNumber')}
          value={registrationNumber}
          onChange={setRegistrationNumber}
          error={errors.forField('registrationNumber')}
        />
        <TextField
          label={t('supplier-directory.invite.contactName')}
          required
          value={contactName}
          onChange={setContactName}
          error={errors.forField('contactName')}
        />
        <TextField
          label={t('supplier-directory.invite.contactEmail')}
          type="email"
          required
          value={contactEmail}
          onChange={setContactEmail}
          error={errors.forField('contactEmail')}
        />
        <CategoryPicker
          options={categories.data?.items}
          loadFailed={categories.status === 'error'}
          value={codes}
          onChange={setCodes}
          error={errors.forField('categories')}
        />
        <TextArea
          label={t('supplier-directory.invite.message')}
          hint={t('supplier-directory.invite.messageHint')}
          fieldClassName="tiq-form-full"
          rows={3}
          value={message}
          onChange={setMessage}
          error={errors.forField('message')}
        />
      </div>
    </ConfirmActionDialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Request qualification
// ---------------------------------------------------------------------------------------------------------

export function RequestQualificationDialog({
  supplier,
  onClose,
  onDone,
}: {
  readonly supplier: SupplierRef;
  readonly onClose: () => void;
  readonly onDone: (message: string) => void;
}) {
  const record = useApiQuery(suppliersEndpoints.getRelationshipRecord, {
    params: { supplierTenantId: supplier.supplierTenantId },
  });
  const request = useApiMutation(suppliersEndpoints.requestQualification);
  const [programId, setProgramId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [message, setMessage] = useState('');
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const errors = errorLookup(clientErrors, request.error, ['programId', 'dueDate', 'message']);
  const programs = record.data?.requestablePrograms ?? [];
  const chosen = programs.find((program) => String(program.programId) === programId);

  return (
    <ConfirmActionDialog
      open
      title={t('supplier-directory.qualify.title')}
      scope={t('supplier-directory.qualify.scope', {
        name: supplier.legalName,
        program: chosen?.name ?? t('supplier-directory.qualify.chooseProgram'),
      })}
      consequence={t('supplier-directory.qualify.result')}
      confirmLabel={t('supplier-directory.qualify.confirm')}
      pending={request.pending}
      error={withSupplierMessage(request.error)}
      onCancel={() => {
        request.reset();
        onClose();
      }}
      onConfirm={async () => {
        const body = {
          programId: chosen?.programId ?? 0,
          ...(dueDate === '' ? {} : { dueDate }),
          ...(message.trim() === '' ? {} : { message: message.trim() }),
        };
        const found =
          chosen === undefined
            ? [
                {
                  field: 'programId',
                  code: 'PROGRAM_REQUIRED',
                  message: t('supplier-directory.qualify.programRequired'),
                },
              ]
            : validateWith(RequestQualificationBody, body);
        setClientErrors(found);
        if (found.length > 0) return;
        try {
          const result = await request.mutate({
            params: { supplierTenantId: supplier.supplierTenantId },
            body,
          });
          onDone(result.message);
        } catch {
          // The dialog shows the error.
        }
      }}
    >
      {record.error !== null && record.data === undefined ? (
        <ErrorState error={record.error} onRetry={record.reload} />
      ) : record.data === undefined ? (
        <SkeletonBlock lines={3} label={t('supplier-directory.qualify.loading')} />
      ) : (
        <div className="tiq-form-grid">
          <Select
            label={t('supplier-directory.qualify.program')}
            required
            fieldClassName="tiq-form-full"
            placeholder={t('supplier-directory.qualify.chooseProgram')}
            value={programId}
            options={programs.map((program) => ({
              value: String(program.programId),
              label:
                program.category === null
                  ? program.name
                  : `${program.name} (${program.category.name})`,
            }))}
            onChange={setProgramId}
            error={errors.forField('programId')}
          />
          <DateInput
            label={t('supplier-directory.qualify.dueDate')}
            hint={t('supplier-directory.qualify.dueDateHint')}
            value={dueDate}
            onChange={setDueDate}
            error={errors.forField('dueDate')}
          />
          <TextArea
            label={t('supplier-directory.qualify.message')}
            fieldClassName="tiq-form-full"
            rows={3}
            value={message}
            onChange={setMessage}
            error={errors.forField('message')}
          />
        </div>
      )}
    </ConfirmActionDialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Flag duplicate
// ---------------------------------------------------------------------------------------------------------

export function FlagDuplicateDialog({
  supplier,
  onClose,
  onDone,
}: {
  readonly supplier: SupplierRef;
  readonly onClose: () => void;
  readonly onDone: (message: string) => void;
}) {
  const others = useApiQuery(suppliersEndpoints.listDirectory, {
    query: { pageSize: 100, sort: 'legalName', dir: 'asc' },
  });
  const flag = useApiMutation(suppliersEndpoints.flagDuplicate);
  const [otherId, setOtherId] = useState('');
  const [reason, setReason] = useState<DuplicateCandidatesDetectedReason>('similar_name');
  const [note, setNote] = useState('');
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const errors = errorLookup(clientErrors, flag.error, [
    'otherSupplierTenantId',
    'detectedReason',
    'note',
  ]);
  const options = (others.data?.items ?? []).filter(
    (row) => row.supplierTenantId !== supplier.supplierTenantId,
  );
  const chosen = options.find((row) => String(row.supplierTenantId) === otherId);

  return (
    <ConfirmActionDialog
      open
      title={t('supplier-directory.flag.title')}
      scope={t('supplier-directory.flag.scope', {
        name: supplier.legalName,
        other: chosen?.legalName ?? t('supplier-directory.flag.chooseOther'),
      })}
      consequence={t('supplier-directory.flag.result')}
      confirmLabel={t('supplier-directory.flag.confirm')}
      pending={flag.pending}
      error={withSupplierMessage(flag.error)}
      onCancel={() => {
        flag.reset();
        onClose();
      }}
      onConfirm={async () => {
        const body = {
          otherSupplierTenantId: chosen?.supplierTenantId ?? 0,
          detectedReason: reason,
          note: note.trim(),
        };
        const found = validateWith(FlagDuplicateBody, body)
          .filter((item) => item.field !== 'otherSupplierTenantId')
          .concat(
            chosen === undefined
              ? [
                  {
                    field: 'otherSupplierTenantId',
                    code: 'OTHER_REQUIRED',
                    message: t('supplier-directory.flag.otherRequired'),
                  },
                ]
              : [],
          );
        setClientErrors(found);
        if (found.length > 0) return;
        try {
          const result = await flag.mutate({
            params: { supplierTenantId: supplier.supplierTenantId },
            body,
          });
          onDone(result.message);
        } catch {
          // The dialog shows the error.
        }
      }}
    >
      {others.error !== null && others.data === undefined ? (
        <ErrorState error={others.error} onRetry={others.reload} />
      ) : (
        <div className="tiq-form-grid">
          <Select
            label={t('supplier-directory.flag.other')}
            required
            fieldClassName="tiq-form-full"
            placeholder={t('supplier-directory.flag.chooseOther')}
            value={otherId}
            options={options.map((row) => ({
              value: String(row.supplierTenantId),
              label: row.isProvisional
                ? t('supplier-directory.flag.provisionalOption', { name: row.legalName })
                : row.legalName,
            }))}
            onChange={setOtherId}
            error={errors.forField('otherSupplierTenantId')}
          />
          <Select
            label={t('supplier-directory.flag.reason')}
            required
            value={reason}
            options={DUPLICATE_CANDIDATES_DETECTED_REASON.map((value) => ({
              value,
              label: tEnum('duplicate_candidates.detected_reason', value),
            }))}
            onChange={(value) => setReason(value as DuplicateCandidatesDetectedReason)}
            error={errors.forField('detectedReason')}
          />
          <TextArea
            label={t('supplier-directory.flag.note')}
            hint={t('supplier-directory.flag.noteHint')}
            required
            fieldClassName="tiq-form-full"
            rows={3}
            value={note}
            onChange={setNote}
            error={errors.forField('note')}
          />
        </div>
      )}
    </ConfirmActionDialog>
  );
}
