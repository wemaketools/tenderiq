/**
 * CON-03 — Signature and commencement: signatories and their authority, the issued version, signature status (in-app
 * or recorded from external evidence — never fabricated), preconditions, and the SEPARATE milestones of signature,
 * effective date, notice to proceed and delivery start (BR-35). Request or record signatures, resolve a refusal and
 * authorize commencement when ready. A contract that differs from the award cannot be signed or started until its
 * difference approval is approved (AC-28).
 */
import { useState } from 'react';

import { contractsEndpoints } from '@contracts/contracts';
import type { ContractDetail, ContractSignatory, ContractSignature } from '@contracts/contracts';
import { CONTRACT_SIGNATORIES_PARTY } from '@contracts/enums';
import type { ConfirmedUpload } from '@contracts/documents';

import { useApiQuery } from '../../../api/hooks';
import { useAppSelector } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import { DocumentUploader } from '../../../components/documents';
import {
  Banner,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DateInput,
  DateTimeInput,
  DetailList,
  EmptyState,
  MoneyText,
  OrDash,
  QueryView,
  Select,
  StatusChip,
  TextArea,
  TextField,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatDateTime, formatMoney } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useAssigneeOptions } from '../lib/assignees';
import { ContractWorkspace } from '../components/ContractWorkspace';
import { FormDialog } from '../components/FormDialog';
import { ApprovalSummary, ChecksPanel, InstantText, MilestoneTrack } from '../components/shared';
import { splitCommandError } from '../lib/errors';
import { useContractCommand, useDialog } from '../lib/hooks';
import { idOf, optionalText, pick } from '../lib/lists';
import { CONTRACT_MANAGE_OR_PREPARE, CONTRACT_PREPARE, CONTRACT_SIGN } from '../lib/permissions';

function AddSignatoryDialog({
  contract,
  onClose,
}: {
  readonly contract: ContractDetail;
  readonly onClose: () => void;
}) {
  const signers = useAssigneeOptions('signatory');
  const [party, setParty] = useState('buyer');
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [authorityNote, setAuthorityNote] = useState('');
  const [local, setLocal] = useState<{ name?: string }>({});
  const command = useContractCommand(contractsEndpoints.addSignatory, (row) =>
    t('contracts.signature.added', { name: row.name }),
  );
  const { dialogError, fieldErrors } = splitCommandError(command.error, [
    'party',
    'userId',
    'name',
    'authorityNote',
  ]);

  const pickUser = (value: string): void => {
    setUserId(value);
    const person = signers.items.find((item) => String(item.userId) === value);
    if (person !== undefined) setName(person.fullName);
  };

  const submit = async (): Promise<void> => {
    if (name.trim().length < 2) {
      setLocal({ name: t('contracts.signature.nameRequired') });
      return;
    }
    setLocal({});
    const chosenParty = pick(party, CONTRACT_SIGNATORIES_PARTY) ?? 'buyer';
    const user = chosenParty === 'buyer' ? idOf(userId) : undefined;
    const note = optionalText(authorityNote);
    const result = await command.run({
      params: { contractId: contract.id },
      body: {
        party: chosenParty,
        name: name.trim(),
        ...(user === undefined ? {} : { userId: user }),
        ...(note === undefined ? {} : { authorityNote: note }),
      },
    });
    if (result !== null) onClose();
  };

  const selected = signers.items.find((item) => String(item.userId) === userId);

  return (
    <FormDialog
      open
      title={t('contracts.signature.addTitle')}
      description={t('contracts.signature.addHint')}
      submitLabel={t('contracts.signature.add')}
      onSubmit={() => void submit()}
      onClose={onClose}
      pending={command.pending}
      error={dialogError}
      otherErrors={fieldErrors.other}
    >
      <Select
        label={t('contracts.signature.party')}
        required
        value={party}
        options={CONTRACT_SIGNATORIES_PARTY.map((value) => ({
          value,
          label: tEnum('contract_signatories.party', value),
        }))}
        onChange={setParty}
        error={fieldErrors.forField('party')}
      />
      {party === 'buyer' && (
        <Select
          label={t('contracts.signature.member')}
          hint={t('contracts.signature.memberHint')}
          placeholder={t('contracts.common.select')}
          value={userId}
          options={signers.options}
          onChange={pickUser}
          error={fieldErrors.forField('userId')}
        />
      )}
      {selected !== undefined && (
        <Banner
          tone={selected.canSign ? 'info' : 'warning'}
          title={
            selected.authorityLimit === null
              ? t('contracts.signature.noLimit')
              : t('contracts.signature.limit', {
                  limit: formatMoney(selected.authorityLimit),
                })
          }
        >
          {t('contracts.signature.limitHint')}
        </Banner>
      )}
      <TextField
        label={t('contracts.signature.name')}
        required
        value={name}
        onChange={setName}
        error={local.name ?? fieldErrors.forField('name')}
      />
      <TextArea
        label={t('contracts.signature.authorityNote')}
        hint={t('contracts.signature.authorityNoteHint')}
        value={authorityNote}
        onChange={setAuthorityNote}
        rows={2}
        error={fieldErrors.forField('authorityNote')}
      />
    </FormDialog>
  );
}

function RecordExternalDialog({
  signature,
  signatory,
  onClose,
}: {
  readonly signature: ContractSignature;
  readonly signatory: ContractSignatory;
  readonly onClose: () => void;
}) {
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [evidence, setEvidence] = useState<ConfirmedUpload | null>(null);
  const [local, setLocal] = useState<{ signedAt?: string; note?: string; evidence?: string }>({});
  const command = useContractCommand(
    contractsEndpoints.recordExternalSignature,
    (result) => result.message,
  );
  const { dialogError, fieldErrors } = splitCommandError(command.error, [
    'signedAt',
    'verificationNote',
    'evidenceDocumentId',
  ]);

  const confirm = async (): Promise<void> => {
    const errors: typeof local = {};
    if (signedAt === null) errors.signedAt = t('contracts.signature.signedAtRequired');
    if (note.trim() === '') errors.note = t('contracts.signature.verificationRequired');
    if (evidence === null) errors.evidence = t('contracts.signature.evidenceRequired');
    setLocal(errors);
    if (signedAt === null || evidence === null || note.trim() === '') return;
    const result = await command.run({
      params: { contractId: signature.contractId, signatoryId: signatory.id },
      body: { signedAt, verificationNote: note.trim(), evidenceDocumentId: evidence.document.id },
    });
    if (result !== null) onClose();
  };

  return (
    <ConfirmActionDialog
      open
      title={t('contracts.signature.recordTitle')}
      scope={`${signature.reference} · ${signatory.name} (${signatory.organizationName})`}
      consequence={t('contracts.signature.recordConsequence')}
      confirmLabel={t('contracts.signature.record')}
      onConfirm={confirm}
      onCancel={onClose}
      pending={command.pending}
      error={dialogError}
    >
      <DateTimeInput
        label={t('contracts.signature.signedAt')}
        required
        value={signedAt}
        onChange={setSignedAt}
        timeZone={signature.timeZone}
        error={local.signedAt ?? fieldErrors.forField('signedAt')}
      />
      <TextArea
        label={t('contracts.signature.verification')}
        hint={t('contracts.signature.verificationHint')}
        required
        value={note}
        onChange={setNote}
        rows={3}
        error={local.note ?? fieldErrors.forField('verificationNote')}
      />
      {evidence === null ? (
        <DocumentUploader
          audience="buyer"
          relatedType="contract"
          relatedId={signature.contractId}
          defaultTitle={t('contracts.signature.evidenceTitle', { name: signatory.name })}
          defaultClassification="buyer_internal"
          classifications={['buyer_internal']}
          onUploaded={setEvidence}
        />
      ) : (
        <Banner tone="success" title={t('contracts.evidence.uploaded')}>
          {evidence.version.fileName}
        </Banner>
      )}
      {(local.evidence ?? fieldErrors.forField('evidenceDocumentId')) !== undefined && (
        <p className="tiq-field-error" role="alert">
          {local.evidence ?? fieldErrors.forField('evidenceDocumentId')}
        </p>
      )}
    </ConfirmActionDialog>
  );
}

function CommencementDialog({
  signature,
  onClose,
}: {
  readonly signature: ContractSignature;
  readonly onClose: () => void;
}) {
  const [effectiveDate, setEffectiveDate] = useState('');
  const [noticeAt, setNoticeAt] = useState<string | null>(null);
  const [deliveryAt, setDeliveryAt] = useState<string | null>(null);
  const [local, setLocal] = useState<{ effectiveDate?: string; deliveryStartAt?: string }>({});
  const command = useContractCommand(contractsEndpoints.authorizeCommencement, (r) => r.message);
  const { dialogError, fieldErrors } = splitCommandError(command.error, [
    'effectiveDate',
    'noticeToProceedAt',
    'deliveryStartAt',
  ]);
  const blocking = [...signature.commencementChecks, ...signature.signatureChecks].some(
    (check) => check.state === 'blocking',
  );

  const confirm = async (): Promise<void> => {
    const errors: typeof local = {};
    if (effectiveDate === '') errors.effectiveDate = t('contracts.signature.effectiveRequired');
    if (noticeAt !== null && deliveryAt !== null && deliveryAt < noticeAt) {
      errors.deliveryStartAt = t('contracts.signature.deliveryBeforeNotice');
    }
    setLocal(errors);
    if (Object.keys(errors).length > 0) return;
    const result = await command.run({
      params: { contractId: signature.contractId },
      body: {
        effectiveDate,
        ...(noticeAt === null ? {} : { noticeToProceedAt: noticeAt }),
        ...(deliveryAt === null ? {} : { deliveryStartAt: deliveryAt }),
      },
    });
    if (result !== null) onClose();
  };

  return (
    <ConfirmActionDialog
      open
      title={t('contracts.signature.commenceTitle')}
      scope={signature.reference}
      consequence={t('contracts.signature.commenceConsequence')}
      confirmLabel={t('contracts.signature.commence')}
      onConfirm={confirm}
      onCancel={onClose}
      pending={command.pending}
      error={dialogError}
    >
      {blocking && (
        <Banner tone="error" title={t('contracts.signature.preconditionsOpen')}>
          {t('contracts.signature.preconditionsOpenDetail')}
        </Banner>
      )}
      <DateInput
        label={t('contracts.signature.effectiveDate')}
        required
        value={effectiveDate}
        onChange={setEffectiveDate}
        error={local.effectiveDate ?? fieldErrors.forField('effectiveDate')}
      />
      <DateTimeInput
        label={t('contracts.signature.noticeToProceed')}
        value={noticeAt}
        onChange={setNoticeAt}
        timeZone={signature.timeZone}
        error={fieldErrors.forField('noticeToProceedAt')}
      />
      <DateTimeInput
        label={t('contracts.signature.deliveryStart')}
        value={deliveryAt}
        onChange={setDeliveryAt}
        timeZone={signature.timeZone}
        error={local.deliveryStartAt ?? fieldErrors.forField('deliveryStartAt')}
      />
    </ConfirmActionDialog>
  );
}

type DialogKind = 'add' | 'sign' | 'record' | 'return' | 'commence';

function SignatureBody({ contract }: { readonly contract: ContractDetail }) {
  const myUserId = useAppSelector((state) => state.session.user?.id ?? null);
  const canPrepare = usePermission(CONTRACT_PREPARE);
  const canSign = usePermission(CONTRACT_SIGN);
  const canCommence = usePermission(CONTRACT_MANAGE_OR_PREPARE);
  const dialog = useDialog<DialogKind, ContractSignatory>();
  const query = useApiQuery(contractsEndpoints.signature, { params: { contractId: contract.id } });
  const sign = useContractCommand(contractsEndpoints.sign, (result) => result.message);
  const returnToReview = useContractCommand(contractsEndpoints.returnToReview, (r) => r.message);

  return (
    <QueryView query={query}>
      {(signature) => {
        const awaiting = signature.status === 'awaiting_signature';
        const refused = signature.signatories.filter((item) => item.status === 'refused');
        const differenceOpen =
          signature.differsFromAward && signature.differenceApproval?.status !== 'approved';
        const columns: DataTableColumn<ContractSignatory>[] = [
          {
            id: 'name',
            header: t('contracts.signature.col.signatory'),
            cell: (row) => (
              <>
                <span>{row.name}</span>
                <span className="tiq-cell-sub">
                  {tEnum('contract_signatories.party', row.party)} · {row.organizationName}
                </span>
              </>
            ),
          },
          {
            id: 'authority',
            header: t('contracts.signature.col.authority'),
            cell: (row) => (
              <>
                {row.authoritySufficient === null ? (
                  <span>{t('contracts.signature.supplierAuthority')}</span>
                ) : (
                  <Chip tone={row.authoritySufficient ? 'success' : 'danger'} size="sm">
                    {row.authoritySufficient
                      ? t('contracts.signature.authorityOk')
                      : t('contracts.signature.authorityShort')}
                  </Chip>
                )}
                {row.authorityLimit !== null && (
                  <span className="tiq-cell-sub">
                    {t('contracts.signature.limitShort')} <MoneyText value={row.authorityLimit} />
                  </span>
                )}
                {row.authorityNote !== null && (
                  <span className="tiq-cell-sub">{row.authorityNote}</span>
                )}
              </>
            ),
          },
          {
            id: 'status',
            header: t('contracts.signature.col.status'),
            cell: (row) => (
              <>
                <StatusChip enum="contract_signatories.status" value={row.status} size="sm" />
                {row.refusalReason !== null && (
                  <span className="tiq-cell-sub tiq-text-danger">{row.refusalReason}</span>
                )}
              </>
            ),
          },
          {
            id: 'method',
            header: t('contracts.signature.col.method'),
            cell: (row) =>
              row.method === null ? (
                <OrDash>{null}</OrDash>
              ) : (
                <>
                  <span>{tEnum('contract_signatories.method', row.method)}</span>
                  {row.verificationNote !== null && (
                    <span className="tiq-cell-sub">{row.verificationNote}</span>
                  )}
                </>
              ),
          },
          {
            id: 'signedAt',
            header: t('contracts.signature.col.signedAt'),
            cell: (row) => <InstantText at={row.signedAt} timeZone={signature.timeZone} />,
          },
          {
            id: 'actions',
            header: t('contracts.register.col.actions'),
            cell: (row) =>
              row.status !== 'pending' || !awaiting ? null : (
                <span className="tiq-inline">
                  {canSign && row.party === 'buyer' && row.user?.userId === myUserId && (
                    <Button
                      size="sm"
                      variant="primary"
                      icon="fileSignature"
                      onClick={() => {
                        sign.reset();
                        dialog.show('sign', row);
                      }}
                    >
                      {t('contracts.signature.sign')}
                    </Button>
                  )}
                  {canPrepare && (
                    <Button
                      size="sm"
                      onClick={() => dialog.show('record', row)}
                      aria-label={t('contracts.signature.recordFor', { name: row.name })}
                    >
                      {t('contracts.signature.record')}
                    </Button>
                  )}
                </span>
              ),
          },
        ];

        return (
          <div className="tiq-stack">
            {differenceOpen && (
              <Banner tone="error" title={t('contracts.preparation.differenceBlocks')}>
                <ApprovalSummary
                  approval={signature.differenceApproval}
                  timeZone={signature.timeZone}
                />
              </Banner>
            )}
            {refused.length > 0 && (
              <Banner
                tone="error"
                title={t('contracts.signature.refused')}
                actions={
                  canPrepare && awaiting ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        returnToReview.reset();
                        dialog.show('return');
                      }}
                    >
                      {t('contracts.signature.resolve')}
                    </Button>
                  ) : undefined
                }
              >
                {refused.map((item) => (
                  <p key={item.id}>
                    {item.name}: {item.refusalReason ?? t('contracts.common.notRecorded')}
                  </p>
                ))}
              </Banner>
            )}
            <div className="tiq-stack">
              <Card title={t('contracts.signature.issued')}>
                <DetailList
                  items={[
                    {
                      label: t('contracts.signature.issuedVersion'),
                      value:
                        signature.issuedVersion === null
                          ? t('contracts.signature.notIssued')
                          : (signature.issuedVersion.fileName ?? signature.issuedVersion.title),
                    },
                    {
                      label: t('contracts.signature.issuedAt'),
                      value: <InstantText at={signature.issuedAt} timeZone={signature.timeZone} />,
                    },
                    {
                      label: t('contracts.signature.value'),
                      value: <MoneyText value={signature.contractValue} />,
                    },
                    {
                      label: t('contracts.signature.status'),
                      value: <StatusChip enum="contracts.status" value={signature.status} />,
                    },
                    {
                      label: t('contracts.signature.outsideApp'),
                      value: signature.signedOutsideApp
                        ? t('contracts.signature.outsideAppYes')
                        : t('contracts.signature.outsideAppNo'),
                    },
                    {
                      label: t('contracts.signature.externalEvidence'),
                      value: signature.externalSignatureEvidence,
                    },
                    {
                      label: t('contracts.signature.differenceApproval'),
                      value: signature.differsFromAward ? (
                        <ApprovalSummary
                          approval={signature.differenceApproval}
                          timeZone={signature.timeZone}
                        />
                      ) : (
                        t('contracts.signature.noDifference')
                      ),
                    },
                  ]}
                />
              </Card>
              <Card
                title={t('contracts.milestone.label')}
                subtitle={t('contracts.signature.separate')}
              >
                <MilestoneTrack milestones={signature.milestones} timeZone={signature.timeZone} />
              </Card>
            </div>
            <Card
              flush
              title={t('contracts.signature.signatories')}
              actions={
                canPrepare && signature.signedAt === null ? (
                  <Button icon="userPlus" onClick={() => dialog.show('add')}>
                    {t('contracts.signature.add')}
                  </Button>
                ) : undefined
              }
            >
              <DataTable
                caption={t('contracts.signature.signatories')}
                columns={columns}
                rows={signature.signatories}
                rowKey={(row) => String(row.id)}
                empty={<EmptyState compact title={t('contracts.signature.noSignatories')} />}
              />
            </Card>
            <div className="tiq-grid tiq-grid--2">
              <Card title={t('contracts.signature.signatureChecks')}>
                <ChecksPanel
                  checks={signature.signatureChecks}
                  label={t('contracts.signature.signatureChecks')}
                />
              </Card>
              <Card
                title={t('contracts.signature.commencementChecks')}
                actions={
                  canCommence && signature.status === 'signed_not_effective' ? (
                    <Button variant="primary" icon="play" onClick={() => dialog.show('commence')}>
                      {t('contracts.signature.commence')}
                    </Button>
                  ) : undefined
                }
              >
                <ChecksPanel
                  checks={signature.commencementChecks}
                  label={t('contracts.signature.commencementChecks')}
                />
                {signature.status !== 'signed_not_effective' &&
                  signature.effectiveDate === null && (
                    <p className="tiq-text-muted">{t('contracts.signature.commenceWhen')}</p>
                  )}
              </Card>
            </div>
            {dialog.open === 'add' && (
              <AddSignatoryDialog contract={contract} onClose={dialog.close} />
            )}
            {dialog.open === 'record' && dialog.target !== null && (
              <RecordExternalDialog
                signature={signature}
                signatory={dialog.target}
                onClose={dialog.close}
              />
            )}
            {dialog.open === 'commence' && (
              <CommencementDialog signature={signature} onClose={dialog.close} />
            )}
            <ConfirmActionDialog
              open={dialog.open === 'sign'}
              title={t('contracts.signature.signTitle')}
              scope={`${signature.reference} · ${contract.title}`}
              consequence={t('contracts.signature.signConsequence', {
                value: formatMoney(signature.contractValue),
              })}
              confirmLabel={t('contracts.signature.sign')}
              acknowledgement={t('contracts.signature.signAck')}
              onConfirm={async () => {
                const target = dialog.target;
                if (target === null) return;
                const result = await sign.run({
                  params: { contractId: contract.id, signatoryId: target.id },
                  body: { confirm: true },
                });
                if (result !== null) dialog.close();
              }}
              onCancel={dialog.close}
              pending={sign.pending}
              error={sign.error}
            >
              {differenceOpen && (
                <Banner tone="error" title={t('contracts.preparation.differenceBlocks')}>
                  {t('contracts.preparation.differenceBlocksDetail')}
                </Banner>
              )}
            </ConfirmActionDialog>
            <ConfirmActionDialog
              open={dialog.open === 'return'}
              tone="danger"
              title={t('contracts.signature.returnTitle')}
              scope={`${signature.reference} · ${contract.title}`}
              consequence={t('contracts.signature.returnConsequence')}
              confirmLabel={t('contracts.signature.resolve')}
              reason={{ label: t('contracts.common.reason'), required: true }}
              onConfirm={async ({ reason }) => {
                const result = await returnToReview.run({
                  params: { contractId: contract.id },
                  body: { reason },
                });
                if (result !== null) dialog.close();
              }}
              onCancel={dialog.close}
              pending={returnToReview.pending}
              error={returnToReview.error}
            />
            <p className="tiq-text-muted">
              {t('contracts.signature.created', {
                at: formatDateTime(contract.createdAt, contract.timeZone),
              })}
            </p>
          </div>
        );
      }}
    </QueryView>
  );
}

export default function SignaturePage() {
  return (
    <ContractWorkspace screen="CON-03">
      {(contract) => <SignatureBody contract={contract} />}
    </ContractWorkspace>
  );
}
