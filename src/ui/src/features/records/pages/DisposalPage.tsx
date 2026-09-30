/**
 * ADM-14 — One disposal request (PRD §18.3, BR-40, AC-35): the records in scope with the date their retention ended,
 * the eligibility note, any hold that blocks disposal, the approval and, once executed, the retained disposition
 * record. Approvers approve PERMITTED disposal or reject it (the records are retained with their history intact);
 * an approved request is executed with a disposition record. A request blocked by an active hold cannot be approved
 * or executed: the hold must be released and the records reviewed again first.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { recordsEndpoints } from '@contracts/records';
import type { DisposalEntity, DisposalRequest } from '@contracts/records';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  QueryView,
  StatusChip,
  TextArea,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCalendarDate, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { idOf } from '../../reports/lib/shared';
import { businessErrorMessage } from '../../reports/lib/errors';
import { RecordsHeader } from '../components/RecordsHeader';
import { recordsPaths } from '../lib/permissions';

type Decision = 'approve' | 'reject' | 'execute';

export default function DisposalPage() {
  const { disposalRequestId: raw = '' } = useParams();
  const disposalRequestId = idOf(raw);
  const query = useApiQuery(
    recordsEndpoints.getDisposalRequest,
    disposalRequestId === undefined ? null : { params: { disposalRequestId } },
  );
  const [decided, setDecided] = useState<DisposalRequest | null>(null);
  const back = { to: recordsPaths.disposals, label: t('records.disposals.back') };
  if (disposalRequestId === undefined) {
    return (
      <div className="tiq-page">
        <RecordsHeader title={t('records.disposals.detailTitle')} back={back} />
        <Card>
          <EmptyState icon="compass" title={t('records.disposals.notFound')} />
        </Card>
      </div>
    );
  }
  return (
    <div className="tiq-page">
      <QueryView
        query={query}
        loading={<RecordsHeader title={t('records.disposals.detailTitle')} back={back} />}
      >
        {(request) => (
          <DisposalView request={decided ?? request} onDecided={setDecided} back={back} />
        )}
      </QueryView>
    </div>
  );
}

function DisposalView({
  request,
  onDecided,
  back,
}: {
  readonly request: DisposalRequest;
  readonly onDecided: (request: DisposalRequest) => void;
  readonly back: { readonly to: string; readonly label: string };
}) {
  const tenant = useActiveTenant();
  const toast = useToast();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const canDecide = usePermission('records.disposal.approve');
  const [decision, setDecision] = useState<Decision | null>(null);
  const [dispositionRecord, setDispositionRecord] = useState('');
  const [touched, setTouched] = useState(false);
  const approve = useApiMutation(recordsEndpoints.approveDisposalRequest);
  const reject = useApiMutation(recordsEndpoints.rejectDisposalRequest);
  const execute = useApiMutation(recordsEndpoints.executeDisposalRequest);
  const held = request.blockingHolds.length > 0 || request.status === 'blocked';
  const open = request.status === 'proposed' || request.status === 'blocked';
  const activeError =
    decision === 'approve'
      ? approve.error
      : decision === 'reject'
        ? reject.error
        : decision === 'execute'
          ? execute.error
          : null;
  const pending = approve.pending || reject.pending || execute.pending;
  const dispositionError =
    dispositionRecord.trim().length < 10
      ? t('records.disposals.errors.dispositionRecord')
      : undefined;

  const nextAction = held
    ? t('records.disposals.next.held')
    : request.status === 'proposed'
      ? t('records.disposals.next.decide')
      : request.status === 'approved'
        ? t('records.disposals.next.execute')
        : t('records.disposals.next.none');

  const columns: DataTableColumn<DisposalEntity>[] = [
    {
      id: 'label',
      header: t('records.disposals.col.record'),
      cell: (row) => (
        <>
          {row.to === null ? <span>{row.label}</span> : <Link to={row.to}>{row.label}</Link>}
          {row.reference !== null && <span className="tiq-cell-sub">{row.reference}</span>}
        </>
      ),
    },
    {
      id: 'retention',
      header: t('records.disposals.col.retentionEnded'),
      cell: (row) => formatCalendarDate(row.retentionEndedOn),
    },
    {
      id: 'protection',
      header: t('records.holds.col.protection'),
      cell: () =>
        held ? (
          <Chip tone="danger" size="sm" icon="lock">
            {t('records.holds.disposalBlocked')}
          </Chip>
        ) : (
          <Chip tone="neutral" size="sm">
            {t('records.disposals.noHold')}
          </Chip>
        ),
    },
  ];

  const confirm = async (reason: string): Promise<void> => {
    try {
      let result: DisposalRequest;
      if (decision === 'approve') {
        result = await approve.mutate({
          params: { disposalRequestId: request.id },
          body: { reason, confirmEligibility: true },
        });
      } else if (decision === 'reject') {
        result = await reject.mutate({
          params: { disposalRequestId: request.id },
          body: { reason },
        });
      } else {
        setTouched(true);
        if (dispositionError !== undefined) return;
        result = await execute.mutate({
          params: { disposalRequestId: request.id },
          body: { dispositionRecord: dispositionRecord.trim() },
        });
      }
      invalidateApiQueries('buyer.records.');
      onDecided(result);
      toast.show(t(`records.disposals.toast.${decision ?? 'approve'}`), 'success');
      setDecision(null);
    } catch {
      // Shown in the dialog.
    }
  };

  return (
    <>
      <RecordsHeader
        title={t('records.disposals.heading', { scope: request.scopeLabel })}
        subtitle={request.eligibilityNote}
        back={back}
        meta={
          <>
            <StatusChip enum="disposal_requests.status" value={request.status} size="sm" />
            <span className="tiq-text-muted">{nextAction}</span>
          </>
        }
        primaryAction={
          canDecide && request.status === 'approved' && !held ? (
            <Button
              variant="primary"
              icon="archive"
              onClick={() => {
                execute.reset();
                setDecision('execute');
              }}
            >
              {t('records.disposals.execute')}
            </Button>
          ) : canDecide && open ? (
            <Button
              variant="primary"
              icon="check"
              disabled={held}
              title={held ? t('records.disposals.approveBlocked') : undefined}
              onClick={() => {
                approve.reset();
                setDecision('approve');
              }}
            >
              {t('records.disposals.approve')}
            </Button>
          ) : undefined
        }
        actions={
          canDecide && open ? (
            <Button
              icon="x"
              onClick={() => {
                reject.reset();
                setDecision('reject');
              }}
            >
              {t('records.disposals.reject')}
            </Button>
          ) : undefined
        }
      />

      {held && (
        <Banner tone="error" title={t('records.disposals.heldTitle')}>
          <p>{t('records.disposals.held')}</p>
          <ul>
            {request.blockingHolds.map((hold) => (
              <li key={hold.holdId}>
                <Link to={recordsPaths.hold(hold.holdId)}>
                  {t('records.disposals.holdLine', {
                    id: hold.holdId,
                    type: tEnum('holds.hold_type', hold.holdType),
                    owner: hold.owner.fullName,
                    review: formatCalendarDate(hold.reviewDate),
                  })}
                </Link>
                <span className="tiq-cell-sub">{hold.reason}</span>
              </li>
            ))}
          </ul>
        </Banner>
      )}
      {request.status === 'executed' && (
        <Banner tone="success" title={t('records.disposals.executedTitle')}>
          <p>{t('records.disposals.executed')}</p>
        </Banner>
      )}
      {request.status === 'rejected' && (
        <Banner tone="info" title={t('records.disposals.rejectedTitle')}>
          <p>{t('records.disposals.rejected')}</p>
        </Banner>
      )}

      <Card title={t('records.disposals.about')}>
        <DetailList
          items={[
            {
              key: 'class',
              label: t('records.disposals.col.class'),
              value: tEnum('retention_classes.record_class', request.recordClass),
            },
            {
              key: 'disposition',
              label: t('records.disposals.col.disposition'),
              value: tEnum('retention_classes.disposition', request.disposition),
            },
            {
              key: 'count',
              label: t('records.disposals.recordCount'),
              value: String(request.entityCount),
            },
            {
              key: 'checked',
              label: t('records.disposals.col.checked'),
              value: formatDateTime(request.eligibilityCheckedAt, timeZone),
            },
            {
              key: 'proposed',
              label: t('records.disposals.col.proposed'),
              value: formatDateTime(request.proposedAt, timeZone),
            },
            {
              key: 'eligibility',
              label: t('records.disposals.eligibility'),
              value: request.eligibilityNote,
            },
            {
              key: 'approval',
              label: t('records.disposals.approval'),
              value:
                request.approval === null ? (
                  t('records.disposals.noApproval')
                ) : (
                  <span className="tiq-inline">
                    <StatusChip
                      enum="approval_requests.status"
                      value={request.approval.status}
                      size="sm"
                    />
                    {request.approval.decidedBy !== null &&
                      t('records.disposals.decidedBy', {
                        name: request.approval.decidedBy.fullName,
                        when:
                          request.approval.decidedAt === null
                            ? ''
                            : formatDateTime(request.approval.decidedAt, timeZone),
                      })}
                    {request.approval.reason !== null && (
                      <span className="tiq-cell-sub">{request.approval.reason}</span>
                    )}
                  </span>
                ),
            },
            {
              key: 'executed',
              label: t('records.disposals.executedAt'),
              value:
                request.executedAt === null ? null : formatDateTime(request.executedAt, timeZone),
            },
            {
              key: 'record',
              label: t('records.disposals.dispositionRecord'),
              value: request.dispositionRecord,
            },
          ]}
        />
      </Card>

      <Card
        flush
        title={t('records.disposals.recordsTitle')}
        subtitle={t('records.disposals.recordsSubtitle')}
      >
        <DataTable
          caption={t('records.disposals.recordsTitle')}
          columns={columns}
          rows={request.entities}
          rowKey={(row) => String(row.entityId)}
          empty={<EmptyState compact icon="archive" title={t('records.disposals.noEntities')} />}
        />
      </Card>

      <ConfirmActionDialog
        open={decision !== null}
        title={t(`records.disposals.dialog.${decision ?? 'approve'}.title`)}
        scope={t('records.disposals.dialogScope', {
          scope: request.scopeLabel,
          count: request.entityCount,
        })}
        consequence={t(`records.disposals.dialog.${decision ?? 'approve'}.consequence`)}
        confirmLabel={t(`records.disposals.dialog.${decision ?? 'approve'}.confirm`)}
        tone={decision === 'reject' ? 'primary' : 'danger'}
        reason={
          decision === 'execute'
            ? undefined
            : { label: t('records.disposals.reason'), required: true }
        }
        acknowledgement={decision === 'approve' ? t('records.disposals.eligibilityAck') : undefined}
        pending={pending}
        error={activeError}
        onCancel={() => setDecision(null)}
        onConfirm={({ reason }) => confirm(reason)}
      >
        {decision === 'execute' && (
          <TextArea
            label={t('records.disposals.dispositionRecord')}
            hint={t('records.disposals.dispositionHint')}
            required
            rows={4}
            value={dispositionRecord}
            onChange={setDispositionRecord}
            error={touched ? dispositionError : undefined}
          />
        )}
        {activeError !== null && activeError.code === 'DISPOSAL_BLOCKED_BY_HOLD' && (
          <p className="tiq-text-danger">{businessErrorMessage(activeError)}</p>
        )}
      </ConfirmActionDialog>
    </>
  );
}
