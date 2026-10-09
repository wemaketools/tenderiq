/**
 * BUY-30 — Event closeout and archive: lot outcomes, signed-contract links, accepted handovers, outstanding cases,
 * securities, lessons learned and retention classification. The closure gate lists every blocking reason, and an
 * unaccepted handover keeps the event open (AC-29). An information-only event (RFI) closes with reviewed market
 * findings and a linked next step, without an award (AC-39). Controlled evidence packs can be requested.
 */
import { useState } from 'react';
import { Link } from 'react-router';

import {
  RequestEvidencePackBody,
  UpdateCloseoutBody,
  archiveEvent,
  closeEvent,
  getAwardOverview,
  getCloseout,
  requestEvidencePack,
  updateCloseout,
} from '@contracts/awards';
import type {
  CloseoutContract,
  CloseoutState,
  EvidencePack,
  UpdateCloseoutBody as UpdateBody,
} from '@contracts/awards';
import type { FieldError } from '@contracts/common';
import { RETENTION_CLASSES_RECORD_CLASS } from '@contracts/enums';
import type { RetentionClassesRecordClass } from '@contracts/enums';
import { listTenders } from '@contracts/tenders';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useCanCall, usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  Dialog,
  EmptyState,
  ErrorState,
  FormErrorSummary,
  OrDash,
  Reference,
  Select,
  SkeletonBlock,
  StatusChip,
  TextArea,
  UnsavedChangesGuard,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { AwardFileLayout } from '../components/AwardFileLayout';
import { GateChecklist } from '../components/GateChecklist';
import { blockingCount } from '../lib/gates';
import { TextBlock } from '../components/TextBlock';
import { awardErrorMessage, withAwardMessage } from '../lib/errors';
import { useIdParam, useLatest, useOfficialTimeZone } from '../lib/hooks';
import { lotLabel, lotNosLabel } from '../lib/labels';
import { awardPaths } from '../lib/paths';
import { errorLookup, validateWith } from '../lib/validation';

export default function CloseoutPage() {
  const tenderId = useIdParam('tenderId');
  const overview = useApiQuery(
    getAwardOverview,
    tenderId === null ? null : { params: { tenderId } },
  );
  const query = useApiQuery(getCloseout, tenderId === null ? null : { params: { tenderId } });
  const [latest, setLatest] = useLatest<CloseoutState>(
    tenderId === null ? null : String(tenderId),
    (record) => String(record.tender.tenderId),
  );
  const state = latest ?? query.data;

  if (tenderId === null) {
    return <EmptyState title={t('awards.file.notFound')} icon="archive" />;
  }

  return (
    <AwardFileLayout
      tenderId={tenderId}
      overview={overview}
      subtitle={t('awards.closeout.intro')}
      back={{ to: awardPaths.closeoutRegister, label: t('awards.closeout.back') }}
    >
      {state === undefined ? (
        query.error !== null ? (
          <ErrorState error={query.error} onRetry={query.reload} />
        ) : (
          <SkeletonBlock lines={8} />
        )
      ) : (
        <CloseoutBody
          key={`${state.status}-${JSON.stringify(draftOf(state))}`}
          state={state}
          onChanged={setLatest}
        />
      )}
    </AwardFileLayout>
  );
}

interface RecordDraft {
  readonly lessonsLearned: string;
  readonly retentionClass: string;
  readonly marketFindings: string;
  readonly nextStepDecision: string;
  readonly linkedNextTenderId: string;
  readonly securitiesNote: string;
}

function draftOf(state: CloseoutState): RecordDraft {
  return {
    lessonsLearned: state.lessonsLearned ?? '',
    retentionClass: state.retentionClass ?? '',
    marketFindings: state.marketFindings ?? '',
    nextStepDecision: state.nextStepDecision ?? '',
    linkedNextTenderId:
      state.linkedNextTender === null ? '' : String(state.linkedNextTender.tenderId),
    securitiesNote: state.securitiesNote ?? '',
  };
}

function nullable(value: string): string | null {
  return value.trim() === '' ? null : value.trim();
}

function bodyOf(draft: RecordDraft): UpdateBody {
  const retention = RETENTION_CLASSES_RECORD_CLASS.find((item) => item === draft.retentionClass);
  return {
    lessonsLearned: nullable(draft.lessonsLearned),
    retentionClass: (retention ?? null) as RetentionClassesRecordClass | null,
    marketFindings: nullable(draft.marketFindings),
    nextStepDecision: nullable(draft.nextStepDecision),
    linkedNextTenderId: draft.linkedNextTenderId === '' ? null : Number(draft.linkedNextTenderId),
    securitiesNote: nullable(draft.securitiesNote),
  };
}

type Command = 'close' | 'archive';

function CloseoutBody({
  state,
  onChanged,
}: {
  readonly state: CloseoutState;
  readonly onChanged: (state: CloseoutState) => void;
}) {
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const canClose = usePermission('event.closeout');
  const canExport = usePermission('export.create');
  const canListTenders = useCanCall(listTenders);
  const [initial] = useState(() => draftOf(state));
  const [draft, setDraft] = useState<RecordDraft>(initial);
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const [command, setCommand] = useState<Command | null>(null);
  const [packOpen, setPackOpen] = useState(false);
  const [packs, setPacks] = useState<readonly EvidencePack[]>(state.evidencePacks);

  const save = useApiMutation(updateCloseout);
  const close = useApiMutation(closeEvent);
  const archive = useApiMutation(archiveEvent);
  const tenders = useApiQuery(
    listTenders,
    canClose && canListTenders ? { query: { pageSize: 100 } } : null,
  );

  const editable = canClose && (state.status === 'in_progress' || state.status === 'blocked');
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const errors = errorLookup(clientErrors, save.error, [
    'lessonsLearned',
    'retentionClass',
    'marketFindings',
    'nextStepDecision',
    'linkedNextTenderId',
    'securitiesNote',
  ]);
  const blocking = blockingCount(state.gate);
  const unacceptedHandovers = state.contracts.filter(
    (contract) => contract.handoverStatus !== 'accepted',
  );
  const scope = `${state.tender.reference} ${state.tender.title}`;
  const set = (change: Partial<RecordDraft>): void =>
    setDraft((current) => ({ ...current, ...change }));

  const submitSave = async (): Promise<void> => {
    const body = bodyOf(draft);
    const found = validateWith(UpdateCloseoutBody, body);
    setClientErrors(found);
    if (found.length > 0) return;
    try {
      const result = await save.mutate({ params: { tenderId: state.tender.tenderId }, body });
      onChanged(result);
      toast.show(t('awards.closeout.saved'), 'success');
    } catch {
      // The summary shows the error.
    }
  };

  const confirmCommand = async (): Promise<void> => {
    try {
      const result =
        command === 'close'
          ? await close.mutate({
              params: { tenderId: state.tender.tenderId },
              body: { confirmation: true },
            })
          : await archive.mutate({
              params: { tenderId: state.tender.tenderId },
              body: { confirmation: true },
            });
      setCommand(null);
      onChanged(result);
      invalidateApiQueries('buyer.awards.');
      toast.show(
        command === 'close' ? t('awards.closeout.closed') : t('awards.closeout.archived'),
        'success',
      );
    } catch {
      // The dialog shows the error.
    }
  };

  const tenderOptions = (tenders.data?.items ?? [])
    .filter((row) => row.id !== state.tender.tenderId)
    .map((row) => ({ value: String(row.id), label: `${row.reference} ${row.title}` }));
  if (
    state.linkedNextTender !== null &&
    !tenderOptions.some((option) => option.value === String(state.linkedNextTender?.tenderId))
  ) {
    tenderOptions.unshift({
      value: String(state.linkedNextTender.tenderId),
      label: `${state.linkedNextTender.reference} ${state.linkedNextTender.title}`,
    });
  }

  const contractColumns: DataTableColumn<CloseoutContract>[] = [
    {
      id: 'reference',
      header: t('awards.closeout.col.contract'),
      cell: (row) => (
        <Link className="tiq-ref" to={awardPaths.contract(row.contractId)}>
          {row.reference}
        </Link>
      ),
    },
    { id: 'supplier', header: t('awards.closeout.col.supplier'), cell: (row) => row.supplier.name },
    { id: 'lots', header: t('awards.closeout.col.lots'), cell: (row) => lotNosLabel(row.lotNos) },
    {
      id: 'status',
      header: t('awards.closeout.col.status'),
      cell: (row) => <StatusChip enum="contracts.status" value={row.status} size="sm" />,
    },
    {
      id: 'handover',
      header: t('awards.closeout.col.handover'),
      cell: (row) =>
        row.handoverStatus === null ? (
          <span className="tiq-text-danger">{t('awards.closeout.noHandover')}</span>
        ) : (
          <StatusChip enum="handovers.status" value={row.handoverStatus} size="sm" />
        ),
    },
  ];

  const packColumns: DataTableColumn<EvidencePack>[] = [
    { id: 'scope', header: t('awards.closeout.col.scope'), cell: (row) => row.scopeDescription },
    {
      id: 'status',
      header: t('awards.closeout.col.status'),
      cell: (row) => <StatusChip enum="exports.status" value={row.status} size="sm" />,
    },
    {
      id: 'requested',
      header: t('awards.closeout.col.requested'),
      cell: (row) => (
        <>
          <span>{formatDateTime(row.requestedAt, timeZone)}</span>
          <span className="tiq-cell-sub">{row.requestedBy.fullName}</span>
        </>
      ),
    },
    {
      id: 'completed',
      header: t('awards.closeout.col.completed'),
      cell: (row) =>
        row.completedAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          formatDateTime(row.completedAt, timeZone)
        ),
    },
  ];

  return (
    <div className="tiq-stack tiq-stack--spaced">
      {state.isInformationOnly && (
        <Banner tone="info" title={t('awards.closeout.rfiTitle')}>
          {t('awards.closeout.rfiText')}
        </Banner>
      )}
      {state.status === 'closed' || state.status === 'archived' ? (
        <Banner tone="success" title={t(`awards.closeout.state.${state.status}`)}>
          {state.closedAt === null
            ? null
            : t('awards.closeout.closedBy', {
                at: formatDateTime(state.closedAt, timeZone),
                name: state.closedBy?.fullName ?? t('awards.common.unknownPerson'),
              })}
          {state.archivedAt !== null &&
            ` ${t('awards.closeout.archivedAt', { at: formatDateTime(state.archivedAt, timeZone) })}`}
        </Banner>
      ) : state.blockingReasons.length > 0 ? (
        <Banner
          tone="error"
          title={t('awards.closeout.blockedTitle', { count: state.blockingReasons.length })}
        >
          <ul>
            {state.blockingReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </Banner>
      ) : (
        <Banner tone="success" title={t('awards.closeout.readyTitle')}>
          {t('awards.closeout.readyText')}
        </Banner>
      )}
      {canClose && (
        <div className="tiq-inline">
          {(state.status === 'in_progress' || state.status === 'blocked') && (
            <Button
              variant="primary"
              icon="checkCircle"
              onClick={() => {
                close.reset();
                setCommand('close');
              }}
            >
              {t('awards.closeout.close')}
            </Button>
          )}
          {state.status === 'closed' && (
            <Button
              variant="primary"
              icon="archive"
              onClick={() => {
                archive.reset();
                setCommand('archive');
              }}
            >
              {t('awards.closeout.archive')}
            </Button>
          )}
          {canExport && (
            <Button icon="package" onClick={() => setPackOpen(true)}>
              {t('awards.closeout.requestPack')}
            </Button>
          )}
        </div>
      )}
      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack tiq-stack--spaced">
          <Card title={t('awards.closeout.lotsTitle')}>
            {state.lots.length === 0 && (
              <p className="tiq-text-muted">{t('awards.closeout.noLots')}</p>
            )}
            <DetailList
              stacked
              items={state.lots.map((row) => ({
                key: String(row.lot.lotId),
                label: lotLabel(row.lot),
                value: (
                  <span className="tiq-inline">
                    <StatusChip enum="lots.stage" value={row.stage} size="sm" />
                    {row.outcome === null ? (
                      <span className="tiq-text-danger">{t('awards.closeout.noOutcome')}</span>
                    ) : (
                      <StatusChip enum="lot_outcomes.outcome" value={row.outcome} size="sm" />
                    )}
                    {row.outcomeStatus !== null && (
                      <StatusChip enum="lot_outcomes.status" value={row.outcomeStatus} size="sm" />
                    )}
                  </span>
                ),
              }))}
            />
          </Card>
          <Card
            title={t('awards.closeout.contractsTitle')}
            subtitle={
              unacceptedHandovers.length > 0
                ? t('awards.closeout.unacceptedHandovers', { count: unacceptedHandovers.length })
                : t('awards.closeout.handoversAccepted')
            }
            flush
          >
            <DataTable
              caption={t('awards.closeout.contractsTitle')}
              columns={contractColumns}
              rows={state.contracts}
              rowKey={(row) => String(row.contractId)}
              empty={
                <EmptyState
                  compact
                  icon="fileSignature"
                  title={
                    state.isInformationOnly
                      ? t('awards.closeout.noContractsRfi')
                      : t('awards.closeout.noContracts')
                  }
                />
              }
            />
          </Card>
          <Card title={t('awards.closeout.recordTitle')} subtitle={t('awards.closeout.recordHint')}>
            {editable ? (
              <form
                className="tiq-form-grid"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitSave();
                }}
              >
                <UnsavedChangesGuard when={dirty && !save.pending} />
                <div className="tiq-form-full">
                  <FormErrorSummary
                    title={save.error === null ? null : awardErrorMessage(save.error)}
                    errors={errors.other}
                  />
                </div>
                {state.isInformationOnly && (
                  <TextArea
                    fieldClassName="tiq-form-full"
                    label={t('awards.closeout.field.marketFindings')}
                    hint={t('awards.closeout.field.marketFindingsHint')}
                    required
                    rows={4}
                    value={draft.marketFindings}
                    error={errors.forField('marketFindings')}
                    onChange={(marketFindings) => set({ marketFindings })}
                  />
                )}
                <TextArea
                  fieldClassName="tiq-form-full"
                  label={t('awards.closeout.field.nextStepDecision')}
                  required={state.isInformationOnly}
                  rows={3}
                  value={draft.nextStepDecision}
                  error={errors.forField('nextStepDecision')}
                  onChange={(nextStepDecision) => set({ nextStepDecision })}
                />
                <Select
                  label={t('awards.closeout.field.linkedTender')}
                  hint={
                    tenders.error !== null
                      ? t('awards.closeout.field.linkedTenderUnavailable')
                      : t('awards.closeout.field.linkedTenderHint')
                  }
                  placeholder={t('awards.closeout.field.noLinkedTender')}
                  value={draft.linkedNextTenderId}
                  error={errors.forField('linkedNextTenderId')}
                  options={tenderOptions}
                  onChange={(linkedNextTenderId) => set({ linkedNextTenderId })}
                />
                <Select
                  label={t('awards.closeout.field.retention')}
                  hint={t('awards.closeout.field.retentionHint')}
                  placeholder={t('awards.closeout.field.noRetention')}
                  value={draft.retentionClass}
                  error={errors.forField('retentionClass')}
                  options={RETENTION_CLASSES_RECORD_CLASS.map((value) => ({
                    value,
                    label: tEnum('retention_classes.record_class', value),
                  }))}
                  onChange={(retentionClass) => set({ retentionClass })}
                />
                <TextArea
                  fieldClassName="tiq-form-full"
                  label={t('awards.closeout.field.securities')}
                  rows={2}
                  value={draft.securitiesNote}
                  error={errors.forField('securitiesNote')}
                  onChange={(securitiesNote) => set({ securitiesNote })}
                />
                <TextArea
                  fieldClassName="tiq-form-full"
                  label={t('awards.closeout.field.lessons')}
                  rows={3}
                  value={draft.lessonsLearned}
                  error={errors.forField('lessonsLearned')}
                  onChange={(lessonsLearned) => set({ lessonsLearned })}
                />
                <div className="tiq-form-full tiq-inline">
                  <Button
                    type="submit"
                    variant="primary"
                    icon="check"
                    loading={save.pending}
                    disabled={!dirty}
                  >
                    {t('awards.closeout.save')}
                  </Button>
                  <span className="tiq-text-muted">
                    {dirty ? t('awards.closeout.unsaved') : t('awards.closeout.allSaved')}
                  </span>
                </div>
              </form>
            ) : (
              <DetailList
                stacked
                items={[
                  ...(state.isInformationOnly
                    ? [
                        {
                          label: t('awards.closeout.field.marketFindings'),
                          value: <TextBlock text={state.marketFindings} />,
                        },
                      ]
                    : []),
                  {
                    label: t('awards.closeout.field.nextStepDecision'),
                    value: <TextBlock text={state.nextStepDecision} />,
                  },
                  {
                    label: t('awards.closeout.field.linkedTender'),
                    value:
                      state.linkedNextTender === null ? null : (
                        <Reference
                          value={state.linkedNextTender.reference}
                          to={awardPaths.tender(state.linkedNextTender.tenderId)}
                        />
                      ),
                  },
                  {
                    label: t('awards.closeout.field.retention'),
                    value:
                      state.retentionClass === null
                        ? null
                        : tEnum('retention_classes.record_class', state.retentionClass),
                  },
                  {
                    label: t('awards.closeout.field.securities'),
                    value: <TextBlock text={state.securitiesNote} />,
                  },
                  {
                    label: t('awards.closeout.field.lessons'),
                    value: <TextBlock text={state.lessonsLearned} />,
                  },
                ]}
              />
            )}
          </Card>
        </div>
        <div className="tiq-stack tiq-stack--spaced">
          <Card
            title={t('awards.closeout.gateTitle')}
            subtitle={
              blocking > 0
                ? t('awards.closeout.gateBlocking', { count: blocking })
                : t('awards.closeout.gateClear')
            }
          >
            <GateChecklist checks={state.gate} label={t('awards.closeout.gateTitle')} />
          </Card>
          <Card title={t('awards.closeout.casesTitle')}>
            <DetailList
              stacked
              items={[
                {
                  label: t('awards.closeout.status'),
                  value: <StatusChip enum="event_closeouts.status" value={state.status} />,
                },
                {
                  label: t('awards.closeout.outstandingComplaints'),
                  value:
                    state.outstandingComplaints.length === 0 ? (
                      t('awards.closeout.noneOutstanding')
                    ) : (
                      <span className="tiq-stack">
                        {state.outstandingComplaints.map((complaint) => (
                          <span key={complaint.complaintId} className="tiq-inline">
                            <Link to={awardPaths.complaint(complaint.complaintId)}>
                              {complaint.reference}
                            </Link>
                            <StatusChip
                              enum="complaints.status"
                              value={complaint.status}
                              size="sm"
                            />
                          </span>
                        ))}
                      </span>
                    ),
                },
                {
                  label: t('awards.closeout.openDebriefs'),
                  value: formatCount(state.openDebriefCount),
                },
              ]}
            />
          </Card>
        </div>
      </div>
      <Card title={t('awards.closeout.packsTitle')} subtitle={t('awards.closeout.packsHint')} flush>
        <DataTable
          caption={t('awards.closeout.packsTitle')}
          columns={packColumns}
          rows={packs}
          rowKey={(row) => String(row.exportId)}
          empty={<EmptyState compact icon="package" title={t('awards.closeout.noPacks')} />}
        />
      </Card>

      <ConfirmActionDialog
        open={command !== null}
        title={
          command === 'archive'
            ? t('awards.closeout.archiveTitle')
            : t('awards.closeout.closeTitle')
        }
        scope={scope}
        consequence={
          command === 'archive'
            ? t('awards.closeout.archiveConsequence')
            : t('awards.closeout.closeConsequence')
        }
        confirmLabel={
          command === 'archive' ? t('awards.closeout.archive') : t('awards.closeout.close')
        }
        acknowledgement={
          command === 'archive'
            ? t('awards.closeout.archiveAcknowledgement')
            : t('awards.closeout.closeAcknowledgement')
        }
        pending={close.pending || archive.pending}
        error={withAwardMessage(command === 'archive' ? archive.error : close.error)}
        onCancel={() => setCommand(null)}
        onConfirm={confirmCommand}
      >
        {command === 'close' && (
          <GateChecklist checks={state.gate} label={t('awards.closeout.gateTitle')} />
        )}
      </ConfirmActionDialog>
      {packOpen && (
        <EvidencePackDialog
          tenderId={state.tender.tenderId}
          defaultScope={t('awards.closeout.packDefaultScope', {
            reference: state.tender.reference,
          })}
          onClose={() => setPackOpen(false)}
          onRequested={(pack) => {
            setPacks((current) => [pack, ...current]);
            setPackOpen(false);
            toast.show(t('awards.closeout.packRequested'), 'success');
          }}
        />
      )}
    </div>
  );
}

function EvidencePackDialog({
  tenderId,
  defaultScope,
  onClose,
  onRequested,
}: {
  readonly tenderId: number;
  readonly defaultScope: string;
  readonly onClose: () => void;
  readonly onRequested: (pack: EvidencePack) => void;
}) {
  const request = useApiMutation(requestEvidencePack);
  const [scope, setScope] = useState(defaultScope);
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const errors = errorLookup(clientErrors, request.error, ['scopeDescription']);

  const submit = async (): Promise<void> => {
    const body = { scopeDescription: scope.trim() };
    const found = validateWith(RequestEvidencePackBody, body);
    setClientErrors(found);
    if (found.length > 0) return;
    try {
      onRequested(await request.mutate({ params: { tenderId }, body }));
    } catch {
      // The summary shows the error.
    }
  };

  return (
    <Dialog
      open
      title={t('awards.closeout.packTitle')}
      description={t('awards.closeout.packDescription')}
      onClose={onClose}
      dismissible={!request.pending}
      footer={
        <>
          <Button onClick={onClose} disabled={request.pending}>
            {t('awards.common.cancel')}
          </Button>
          <Button
            variant="primary"
            icon="package"
            loading={request.pending}
            onClick={() => void submit()}
          >
            {t('awards.closeout.requestPack')}
          </Button>
        </>
      }
    >
      <div className="tiq-form-stack">
        <FormErrorSummary
          title={request.error === null ? null : awardErrorMessage(request.error)}
          errors={errors.other}
        />
        <TextArea
          label={t('awards.closeout.packScope')}
          required
          rows={3}
          value={scope}
          error={errors.forField('scopeDescription')}
          onChange={setScope}
        />
      </div>
    </Dialog>
  );
}
