/**
 * CON-02 — Contract preparation and review: awarded scope, final terms, parties, schedules (agreed documents in order
 * of precedence), exceptions, approval history and differences from the award. Prepare and edit the terms, submit
 * for review, and approve or return the final agreement. A contract that differs from the award needs its
 * difference approval before signature or start (AC-28, BR-35).
 */
import { useMemo, useState } from 'react';

import { contractsEndpoints } from '@contracts/contracts';
import type {
  AwardDifference,
  ContractAgreedDocument,
  ContractApprovalRef,
  ContractDetail,
  ContractException,
  ContractPreparation,
  UpdateContractBody,
} from '@contracts/contracts';
import { isDecimal } from '@contracts/decimal';
import { valueBandOf } from '@contracts/policy';
import type { CustomFieldIssue, CustomFieldValues } from '@contracts/policy';

import { useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DateInput,
  DetailList,
  EmptyState,
  MoneyInput,
  MoneyText,
  QueryView,
  Stepper,
  StatusChip,
  TextArea,
  TextField,
  UnsavedChangesGuard,
} from '../../../components/ui';
import type { DataTableColumn, StepItem } from '../../../components/ui';
import { formatCalendarDate, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { CustomFieldsSection } from '../../admin-policy/components/CustomFieldsSection';
import { AllocationsTable } from '../components/ContractTables';
import { ContractWorkspace } from '../components/ContractWorkspace';
import { FormDialog } from '../components/FormDialog';
import { ApprovalSummary, ApprovalTitle, ChecksPanel } from '../components/shared';
import { splitCommandError } from '../lib/errors';
import { useContractCommand } from '../lib/hooks';
import { CONTRACT_APPROVE, CONTRACT_PREPARE } from '../lib/permissions';

const EDITABLE: readonly string[] = ['draft', 'under_review'];

function reviewSteps(status: ContractDetail['status']): StepItem[] {
  const order = ['draft', 'under_review', 'awaiting_signature'];
  const index = order.indexOf(status);
  const reached = index === -1 ? order.length : index;
  return order.map((id, position) => ({
    id,
    label: t(`contracts.preparation.step.${id}`),
    description: t(`contracts.preparation.stepHint.${id}`),
    state: position < reached ? 'complete' : position === reached ? 'current' : 'upcoming',
  }));
}

const EDIT_FIELDS = [
  'title',
  'scope',
  'value',
  'ceiling',
  'termStart',
  'termEnd',
  'paymentTerms',
  'serviceLocations',
  'optionsSummary',
  'securitiesSummary',
  'differenceExplanation',
] as const;

type EditField = (typeof EDIT_FIELDS)[number];

const DECIMAL_AMOUNT = /^\d+(\.\d+)?$/;

function sameCustomValues(a: Readonly<CustomFieldValues>, b: Readonly<CustomFieldValues>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => (a[key] ?? null) === (b[key] ?? null));
}

function EditTermsDialog({
  contract,
  onClose,
  onSaved,
}: {
  readonly contract: ContractDetail;
  readonly onClose: () => void;
  readonly onSaved: (message: string) => void;
}) {
  const currency = contract.value.currency;
  const initial = {
    title: contract.title,
    scope: contract.scope,
    value: contract.value.amount,
    ceiling: contract.ceiling?.amount ?? '',
    termStart: contract.termStart ?? '',
    termEnd: contract.termEnd ?? '',
    paymentTerms: contract.paymentTerms ?? '',
    serviceLocations: contract.serviceLocations ?? '',
    optionsSummary: contract.optionsSummary ?? '',
    securitiesSummary: contract.securitiesSummary ?? '',
    differenceExplanation: contract.differenceExplanation ?? '',
  };
  const [draft, setDraft] = useState(initial);
  const [local, setLocal] = useState<Partial<Record<EditField, string>>>({});
  const initialCustom = useMemo(
    () => ({ ...(contract.customFields ?? {}) }),
    [contract.customFields],
  );
  const [custom, setCustom] = useState<CustomFieldValues>(initialCustom);
  const [customIssues, setCustomIssues] = useState<readonly CustomFieldIssue[]>([]);
  const [tried, setTried] = useState(false);
  const customChanged = !sameCustomValues(custom, initialCustom);
  const customContext = useMemo(
    () => ({ value_band: DECIMAL_AMOUNT.test(draft.value) ? valueBandOf(draft.value) : null }),
    [draft.value],
  );
  const command = useContractCommand(contractsEndpoints.update, (result) =>
    t('contracts.preparation.saved', { version: result.version }),
  );
  const { dialogError, fieldErrors } = splitCommandError(command.error, EDIT_FIELDS);
  const changed = (Object.keys(initial) as EditField[]).filter(
    (key) => draft[key] !== initial[key],
  );
  const errorFor = (field: EditField): string | undefined =>
    local[field] ?? fieldErrors.forField(field);
  const set = (values: Partial<typeof draft>): void =>
    setDraft((current) => ({ ...current, ...values }));

  const save = async (): Promise<void> => {
    setTried(true);
    const errors: Partial<Record<EditField, string>> = {};
    if (changed.length === 0 && !customChanged) {
      errors.title = t('contracts.preparation.nothingChanged');
    }
    if (draft.title.trim().length < 3) errors.title = t('contracts.create.errors.title');
    if (!isDecimal(draft.value)) errors.value = t('contracts.create.errors.value');
    if (draft.ceiling !== '' && !isDecimal(draft.ceiling)) {
      errors.ceiling = t('contracts.create.errors.ceiling');
    }
    if (draft.termStart !== '' && draft.termEnd !== '' && draft.termEnd < draft.termStart) {
      errors.termEnd = t('contracts.create.errors.termEnd');
    }
    setLocal(errors);
    if (Object.keys(errors).length > 0) return;
    // Required additional fields are checked when the draft is submitted for review; wrong values block the save.
    if (customIssues.some((issue) => issue.code !== 'CUSTOM_FIELD_REQUIRED')) return;
    const body: UpdateContractBody = customChanged ? { customFields: custom } : {};
    for (const key of changed) {
      const value = draft[key].trim();
      switch (key) {
        case 'value':
          body.value = { amount: value, currency };
          break;
        case 'ceiling':
          body.ceiling = value === '' ? null : { amount: value, currency };
          break;
        case 'title':
          body.title = value;
          break;
        case 'scope':
          body.scope = value;
          break;
        case 'termStart':
        case 'termEnd':
        case 'paymentTerms':
        case 'serviceLocations':
        case 'optionsSummary':
        case 'securitiesSummary':
        case 'differenceExplanation':
          body[key] = value === '' ? null : value;
          break;
      }
    }
    const result = await command.run({ params: { contractId: contract.id }, body });
    if (result !== null) {
      onSaved(
        result.approvalsInvalidated
          ? t('contracts.preparation.savedInvalidated', { version: result.version })
          : t('contracts.preparation.saved', { version: result.version }),
      );
      onClose();
    }
  };

  return (
    <FormDialog
      open
      size="lg"
      title={t('contracts.preparation.editTitle')}
      description={t('contracts.preparation.editHint')}
      submitLabel={t('contracts.preparation.saveTerms')}
      onSubmit={() => void save()}
      onClose={onClose}
      pending={command.pending}
      error={dialogError}
      otherErrors={fieldErrors.other}
    >
      <UnsavedChangesGuard when={changed.length > 0 || customChanged} />
      <div className="tiq-form-grid">
        <TextField
          label={t('contracts.create.titleField')}
          required
          value={draft.title}
          onChange={(title) => set({ title })}
          error={errorFor('title')}
          fieldClassName="tiq-form-full"
        />
        <TextArea
          label={t('contracts.create.scope')}
          value={draft.scope}
          onChange={(scope) => set({ scope })}
          error={errorFor('scope')}
          fieldClassName="tiq-form-full"
        />
        <MoneyInput
          label={t('contracts.create.value')}
          required
          value={{ amount: draft.value, currency }}
          currencies={[currency]}
          onChange={(value) => set({ value: value.amount })}
          error={errorFor('value')}
        />
        <MoneyInput
          label={t('contracts.create.ceiling')}
          value={{ amount: draft.ceiling, currency }}
          currencies={[currency]}
          onChange={(value) => set({ ceiling: value.amount })}
          error={errorFor('ceiling')}
        />
        <DateInput
          label={t('contracts.create.termStart')}
          value={draft.termStart}
          onChange={(termStart) => set({ termStart })}
          error={errorFor('termStart')}
        />
        <DateInput
          label={t('contracts.create.termEnd')}
          value={draft.termEnd}
          onChange={(termEnd) => set({ termEnd })}
          error={errorFor('termEnd')}
        />
        <TextArea
          label={t('contracts.create.paymentTerms')}
          value={draft.paymentTerms}
          onChange={(paymentTerms) => set({ paymentTerms })}
          error={errorFor('paymentTerms')}
        />
        <TextArea
          label={t('contracts.create.serviceLocations')}
          value={draft.serviceLocations}
          onChange={(serviceLocations) => set({ serviceLocations })}
          error={errorFor('serviceLocations')}
        />
        <TextArea
          label={t('contracts.create.options')}
          value={draft.optionsSummary}
          onChange={(optionsSummary) => set({ optionsSummary })}
          error={errorFor('optionsSummary')}
        />
        <TextArea
          label={t('contracts.overview.securitiesSummary')}
          value={draft.securitiesSummary}
          onChange={(securitiesSummary) => set({ securitiesSummary })}
          error={errorFor('securitiesSummary')}
        />
        <TextArea
          label={t('contracts.create.explanation')}
          hint={t('contracts.create.explanationHint')}
          value={draft.differenceExplanation}
          onChange={(differenceExplanation) => set({ differenceExplanation })}
          error={errorFor('differenceExplanation')}
          fieldClassName="tiq-form-full"
        />
      </div>
      <CustomFieldsSection
        entityType="contract"
        values={custom}
        onChange={setCustom}
        context={customContext}
        showErrors={tried}
        serverErrors={command.error?.fieldErrors}
        onValidationChange={setCustomIssues}
      />
      <p className="tiq-text-muted">{t('contracts.preparation.materialEdit')}</p>
    </FormDialog>
  );
}

function DifferencesCard({
  preparation,
  timeZone,
}: {
  readonly preparation: ContractPreparation;
  readonly timeZone: string;
}) {
  const columns: DataTableColumn<AwardDifference>[] = [
    { id: 'label', header: t('contracts.preparation.diff.field'), cell: (row) => row.label },
    { id: 'awarded', header: t('contracts.preparation.diff.awarded'), cell: (row) => row.awarded },
    {
      id: 'proposed',
      header: t('contracts.preparation.diff.proposed'),
      cell: (row) => row.proposed,
    },
    {
      id: 'delta',
      header: t('contracts.preparation.diff.delta'),
      numeric: true,
      cell: (row) => <MoneyText value={row.amountDelta} />,
    },
    {
      id: 'material',
      header: t('contracts.preparation.diff.material'),
      cell: (row) => (
        <Chip tone={row.material ? 'warning' : 'neutral'} size="sm">
          {row.material
            ? t('contracts.preparation.diff.materialYes')
            : t('contracts.preparation.diff.materialNo')}
        </Chip>
      ),
    },
  ];
  return (
    <Card title={t('contracts.preparation.differences')} flush>
      {preparation.differsFromAward && (
        <Banner
          tone={preparation.differenceApproval?.status === 'approved' ? 'success' : 'warning'}
          title={
            preparation.differenceApproval?.status === 'approved'
              ? t('contracts.preparation.differenceApproved')
              : t('contracts.preparation.differenceBlocks')
          }
        >
          <DetailList
            items={[
              {
                label: t('contracts.preparation.explanation'),
                value: preparation.differenceExplanation,
              },
              {
                label: t('contracts.preparation.differenceApproval'),
                value: (
                  <ApprovalSummary approval={preparation.differenceApproval} timeZone={timeZone} />
                ),
              },
            ]}
          />
        </Banner>
      )}
      <DataTable
        caption={t('contracts.preparation.differences')}
        columns={columns}
        rows={preparation.differences}
        rowKey={(row) => row.field}
        empty={<EmptyState compact title={t('contracts.preparation.noDifferences')} />}
      />
    </Card>
  );
}

function DocumentsCard({ documents }: { readonly documents: readonly ContractAgreedDocument[] }) {
  const columns: DataTableColumn<ContractAgreedDocument>[] = [
    {
      id: 'precedence',
      header: t('contracts.preparation.doc.precedence'),
      numeric: true,
      cell: (row) => row.precedence,
    },
    {
      id: 'title',
      header: t('contracts.preparation.doc.title'),
      cell: (row) => (
        <>
          <span>{row.title}</span>
          <span className="tiq-cell-sub">{row.kind}</span>
        </>
      ),
    },
    {
      id: 'file',
      header: t('contracts.preparation.doc.file'),
      cell: (row) =>
        row.document === null ? (
          <span className="tiq-text-muted">{t('contracts.preparation.doc.noFile')}</span>
        ) : (
          (row.document.fileName ?? row.document.title)
        ),
    },
    {
      id: 'signed',
      header: t('contracts.preparation.doc.edition'),
      cell: (row) => (
        <Chip tone={row.isSigned ? 'success' : 'neutral'} size="sm">
          {row.isSigned
            ? t('contracts.preparation.doc.signed')
            : t('contracts.preparation.doc.draft')}
        </Chip>
      ),
    },
  ];
  return (
    <Card
      flush
      title={t('contracts.preparation.documents')}
      subtitle={t('contracts.preparation.documentsHint')}
    >
      <DataTable
        caption={t('contracts.preparation.documents')}
        columns={columns}
        rows={documents}
        rowKey={(row) => String(row.id)}
        empty={<EmptyState compact title={t('contracts.preparation.noDocuments')} />}
      />
    </Card>
  );
}

function ExceptionsCard({ exceptions }: { readonly exceptions: readonly ContractException[] }) {
  const columns: DataTableColumn<ContractException>[] = [
    { id: 'clause', header: t('contracts.preparation.exc.clause'), cell: (row) => row.clause },
    {
      id: 'description',
      header: t('contracts.preparation.exc.description'),
      cell: (row) => row.description,
    },
    {
      id: 'agreed',
      header: t('contracts.preparation.exc.agreed'),
      cell: (row) => row.agreedPosition,
    },
  ];
  return (
    <Card flush title={t('contracts.preparation.exceptions')}>
      <DataTable
        caption={t('contracts.preparation.exceptions')}
        columns={columns}
        rows={exceptions}
        rowKey={(row) => String(row.id)}
        empty={<EmptyState compact title={t('contracts.preparation.noExceptions')} />}
      />
    </Card>
  );
}

function ApprovalHistoryCard({
  approvals,
  timeZone,
}: {
  readonly approvals: readonly ContractApprovalRef[];
  readonly timeZone: string;
}) {
  const columns: DataTableColumn<ContractApprovalRef>[] = [
    {
      id: 'title',
      header: t('contracts.preparation.hist.approval'),
      cell: (row) => (
        <>
          <ApprovalTitle approval={row} />
          <span className="tiq-cell-sub">
            {tEnum('approval_requests.subject_type', row.subjectType)}
          </span>
        </>
      ),
    },
    {
      id: 'status',
      header: t('contracts.preparation.hist.status'),
      cell: (row) => <StatusChip enum="approval_requests.status" value={row.status} size="sm" />,
    },
    {
      id: 'requested',
      header: t('contracts.preparation.hist.requested'),
      cell: (row) => (
        <>
          <span>{row.requestedBy.fullName}</span>
          <span className="tiq-cell-sub">{formatDateTime(row.requestedAt, timeZone)}</span>
        </>
      ),
    },
    {
      id: 'approver',
      header: t('contracts.preparation.hist.approver'),
      cell: (row) =>
        row.decidedAt !== null
          ? t('contracts.approval.decidedAt', { at: formatDateTime(row.decidedAt, timeZone) })
          : (row.currentApprover?.fullName ?? t('contracts.common.none')),
    },
    {
      id: 'amount',
      header: t('contracts.preparation.hist.amount'),
      numeric: true,
      cell: (row) => <MoneyText value={row.amount} />,
    },
  ];
  return (
    <Card flush title={t('contracts.preparation.history')}>
      <DataTable
        caption={t('contracts.preparation.history')}
        columns={columns}
        rows={approvals}
        rowKey={(row) => String(row.approvalId)}
        rowLabel={(row) => row.title}
        empty={<EmptyState compact title={t('contracts.preparation.noHistory')} />}
      />
    </Card>
  );
}

type Dialog = 'edit' | 'submit' | 'approve' | 'return' | null;

function PreparationBody({ contract }: { readonly contract: ContractDetail }) {
  const canPrepare = usePermission(CONTRACT_PREPARE);
  const canApprove = usePermission(CONTRACT_APPROVE);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const query = useApiQuery(contractsEndpoints.preparation, {
    params: { contractId: contract.id },
  });
  const submit = useContractCommand(contractsEndpoints.submitForReview, (result) => result.message);
  const decide = useContractCommand(contractsEndpoints.reviewDecision, (result) => result.message);
  const editable = EDITABLE.includes(contract.status);
  const scope = `${contract.reference} ${contract.title}`;

  return (
    <QueryView query={query}>
      {(preparation) => (
        <div className="tiq-stack">
          {notice !== null && (
            <Banner tone="success" title={t('contracts.preparation.result')}>
              {notice}
            </Banner>
          )}
          <Card
            title={t('contracts.preparation.stage')}
            subtitle={t('contracts.preparation.version', { version: preparation.version })}
            actions={
              <span className="tiq-inline">
                {canPrepare && editable && (
                  <Button icon="edit" onClick={() => setDialog('edit')}>
                    {t('contracts.preparation.edit')}
                  </Button>
                )}
                {canPrepare && contract.status === 'draft' && (
                  <Button
                    variant="primary"
                    icon="send"
                    onClick={() => {
                      submit.reset();
                      setDialog('submit');
                    }}
                  >
                    {t('contracts.preparation.submit')}
                  </Button>
                )}
                {canApprove && contract.status === 'under_review' && (
                  <>
                    <Button
                      onClick={() => {
                        decide.reset();
                        setDialog('return');
                      }}
                    >
                      {t('contracts.preparation.return')}
                    </Button>
                    <Button
                      variant="primary"
                      icon="checkCircle"
                      onClick={() => {
                        decide.reset();
                        setDialog('approve');
                      }}
                    >
                      {t('contracts.preparation.approve')}
                    </Button>
                  </>
                )}
              </span>
            }
          >
            <Stepper
              label={t('contracts.preparation.stage')}
              steps={reviewSteps(contract.status)}
            />
            <ChecksPanel checks={preparation.checks} label={t('contracts.preparation.checks')} />
          </Card>
          <DifferencesCard preparation={preparation} timeZone={contract.timeZone} />
          <div className="tiq-stack">
            <Card title={t('contracts.preparation.terms')}>
              <DetailList
                items={[
                  { label: t('contracts.overview.supplier'), value: contract.supplier.name },
                  { label: t('contracts.overview.legalEntity'), value: contract.legalEntity.name },
                  {
                    label: t('contracts.overview.value'),
                    value: <MoneyText value={contract.value} />,
                  },
                  {
                    label: t('contracts.overview.ceiling'),
                    value: <MoneyText value={contract.ceiling} />,
                  },
                  {
                    label: t('contracts.overview.term'),
                    value:
                      contract.termStart === null && contract.termEnd === null
                        ? null
                        : `${contract.termStart === null ? '…' : formatCalendarDate(contract.termStart)} – ${
                            contract.termEnd === null ? '…' : formatCalendarDate(contract.termEnd)
                          }`,
                  },
                  { label: t('contracts.overview.paymentTerms'), value: contract.paymentTerms },
                  { label: t('contracts.overview.locations'), value: contract.serviceLocations },
                  { label: t('contracts.overview.options'), value: contract.optionsSummary },
                  {
                    label: t('contracts.overview.securitiesSummary'),
                    value: contract.securitiesSummary,
                  },
                ]}
              />
            </Card>
            <Card flush title={t('contracts.preparation.awardedScope')}>
              <AllocationsTable allocations={preparation.awardedScope} />
            </Card>
          </div>
          <DocumentsCard documents={preparation.agreedDocuments} />
          <ExceptionsCard exceptions={preparation.exceptions} />
          <ApprovalHistoryCard
            approvals={preparation.approvalHistory}
            timeZone={contract.timeZone}
          />
          {dialog === 'edit' && (
            <EditTermsDialog
              contract={contract}
              onClose={() => setDialog(null)}
              onSaved={setNotice}
            />
          )}
          <ConfirmActionDialog
            open={dialog === 'submit'}
            title={t('contracts.preparation.submitTitle')}
            scope={scope}
            consequence={
              preparation.differsFromAward
                ? t('contracts.preparation.submitConsequenceDiffers')
                : t('contracts.preparation.submitConsequence')
            }
            confirmLabel={t('contracts.preparation.submit')}
            onConfirm={async () => {
              const result = await submit.run({ params: { contractId: contract.id } });
              if (result !== null) {
                setNotice(result.message);
                setDialog(null);
              }
            }}
            onCancel={() => setDialog(null)}
            pending={submit.pending}
            error={submit.error}
          >
            <ChecksPanel checks={preparation.checks} label={t('contracts.preparation.checks')} />
          </ConfirmActionDialog>
          <ConfirmActionDialog
            open={dialog === 'approve' || dialog === 'return'}
            title={
              dialog === 'return'
                ? t('contracts.preparation.returnTitle')
                : t('contracts.preparation.approveTitle')
            }
            tone={dialog === 'return' ? 'danger' : 'primary'}
            scope={scope}
            consequence={
              dialog === 'return'
                ? t('contracts.preparation.returnConsequence')
                : t('contracts.preparation.approveConsequence')
            }
            confirmLabel={
              dialog === 'return'
                ? t('contracts.preparation.return')
                : t('contracts.preparation.approve')
            }
            reason={{ label: t('contracts.common.reason'), required: true }}
            onConfirm={async ({ reason }) => {
              const result = await decide.run({
                params: { contractId: contract.id },
                body: { decision: dialog === 'return' ? 'return' : 'approve', reason },
              });
              if (result !== null) {
                setNotice(result.message);
                setDialog(null);
              }
            }}
            onCancel={() => setDialog(null)}
            pending={decide.pending}
            error={decide.error}
          >
            {preparation.differsFromAward &&
              preparation.differenceApproval?.status !== 'approved' && (
                <Banner tone="warning" title={t('contracts.preparation.differenceBlocks')}>
                  {t('contracts.preparation.differenceBlocksDetail')}
                </Banner>
              )}
          </ConfirmActionDialog>
        </div>
      )}
    </QueryView>
  );
}

export default function ContractPreparationPage() {
  return (
    <ContractWorkspace screen="CON-02">
      {(contract) => <PreparationBody contract={contract} />}
    </ContractWorkspace>
  );
}
