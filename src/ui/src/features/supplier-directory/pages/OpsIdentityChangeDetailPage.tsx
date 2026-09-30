/**
 * Operator — review one legal-identity change: the current and proposed values, reason and evidence, the legal-name
 * history, other changes of the same organization and how many formal submissions were made under the current
 * identity (they keep it). Actions: start the review, then approve with an effective date or reject with a note.
 */
import { useState } from 'react';

import type { FieldError } from '@contracts/common';
import { DecideIdentityChangeBody, suppliersEndpoints } from '@contracts/suppliers';
import type { OpsIdentityChangeDetail, OpsIdentityChangeRow } from '@contracts/suppliers';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  ConfirmActionDialog,
  DataTable,
  DateInput,
  DetailList,
  EmptyState,
  ErrorState,
  PageHeader,
  RadioGroup,
  SkeletonBlock,
  StatusChip,
  Stepper,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn, StepItem } from '../../../components/ui';
import { formatCalendarDate, formatCount, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { DocumentLink } from '../../supplier-org/components/SupplierBits';
import { withSupplierMessage } from '../../supplier-org/lib/errors';
import { useIdParam, useOfficialTimeZone } from '../../supplier-org/lib/hooks';
import { errorLookup, validateWith } from '../../supplier-org/lib/validation';
import { OpsReviewTabs } from '../components/OpsReviewTabs';
import { directoryPaths } from '../lib/paths';

export default function OpsIdentityChangeDetailPage() {
  const changeId = useIdParam('changeId');
  const query = useApiQuery(
    suppliersEndpoints.getOpsIdentityChange,
    changeId === null ? null : { params: { changeId } },
  );
  const back = {
    to: directoryPaths.identityChanges,
    label: t('supplier-directory.opsIdentity.back'),
  };
  if (query.data === undefined) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('supplier-directory.opsIdentity.detailTitle')} back={back} />
        {query.error !== null ? (
          <ErrorState error={query.error} onRetry={query.reload} />
        ) : changeId === null ? (
          <Banner tone="error" title={t('supplier-org.change.notFound')} />
        ) : (
          <SkeletonBlock lines={8} />
        )}
      </div>
    );
  }
  return <ReviewView key={query.data.id} detail={query.data} back={back} />;
}

function ReviewView({
  detail,
  back,
}: {
  readonly detail: OpsIdentityChangeDetail;
  readonly back: { readonly to: string; readonly label: string };
}) {
  const zone = useOfficialTimeZone();
  const toast = useToast();
  const start = useApiMutation(suppliersEndpoints.startIdentityReview);
  const decide = useApiMutation(suppliersEndpoints.decideIdentityChange);
  const [row, setRow] = useState<OpsIdentityChangeRow>(detail);
  const [confirmStart, setConfirmStart] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const [outcome, setOutcome] = useState<string | null>(null);
  const errors = errorLookup(clientErrors, decide.error, [
    'decision',
    'effectiveDate',
    'decisionNote',
  ]);
  const typeLabel = tEnum('supplier_identity_changes.change_type', row.changeType);
  const decided = row.status === 'approved' || row.status === 'rejected';

  const steps: StepItem[] = [
    {
      id: 'submitted',
      label: tEnum('supplier_identity_changes.status', 'submitted'),
      state: 'complete',
    },
    {
      id: 'review',
      label: tEnum('supplier_identity_changes.status', 'under_review'),
      state: row.status === 'submitted' ? 'current' : 'complete',
    },
    {
      id: 'decision',
      label: decided
        ? tEnum('supplier_identity_changes.status', row.status)
        : t('supplier-org.change.decision'),
      state:
        row.status === 'rejected'
          ? 'blocked'
          : decided
            ? 'complete'
            : row.status === 'under_review'
              ? 'current'
              : 'upcoming',
    },
  ];

  const otherColumns: DataTableColumn<OpsIdentityChangeDetail['otherChanges'][number]>[] = [
    {
      id: 'type',
      header: t('supplier-org.identity.col.type'),
      cell: (item) => tEnum('supplier_identity_changes.change_type', item.changeType),
    },
    {
      id: 'value',
      header: t('supplier-org.identity.col.values'),
      cell: (item) => item.proposedValue,
    },
    {
      id: 'status',
      header: t('supplier-org.identity.col.status'),
      cell: (item) => <StatusChip enum="supplier_identity_changes.status" value={item.status} />,
    },
    {
      id: 'submitted',
      header: t('supplier-org.identity.col.submitted'),
      cell: (item) => formatDateTime(item.submittedAt, zone),
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('supplier-directory.opsIdentity.detailTitleOf', {
          type: typeLabel,
          name: row.supplier.legalName,
        })}
        back={back}
        meta={
          <span className="tiq-inline">
            <StatusChip enum="supplier_identity_changes.status" value={row.status} />
            <span className="tiq-text-muted">
              {t('supplier-org.change.nextLabel', {
                next:
                  row.status === 'submitted'
                    ? t('supplier-directory.opsIdentity.next.start')
                    : row.status === 'under_review'
                      ? t('supplier-directory.opsIdentity.next.decide')
                      : t('supplier-directory.opsIdentity.next.none'),
              })}
            </span>
          </span>
        }
        primaryAction={
          row.status === 'submitted' ? (
            <Button variant="primary" icon="eye" onClick={() => setConfirmStart(true)}>
              {t('supplier-directory.opsIdentity.start')}
            </Button>
          ) : row.status === 'under_review' ? (
            <Button variant="primary" icon="gavel" onClick={() => setDeciding(true)}>
              {t('supplier-directory.opsIdentity.decide')}
            </Button>
          ) : undefined
        }
      />
      <OpsReviewTabs />
      {outcome !== null && (
        <Banner tone="success" title={t('supplier-directory.list.doneTitle')}>
          <p>{outcome}</p>
        </Banner>
      )}
      <Stepper steps={steps} label={t('supplier-org.change.progress')} />
      <Banner tone="info" title={t('supplier-directory.opsIdentity.consequenceTitle')}>
        <p>{detail.consequence}</p>
        <p>
          {t('supplier-directory.opsIdentity.historic', {
            count: detail.historicSubmissionCount,
            formatted: formatCount(detail.historicSubmissionCount),
          })}
        </p>
      </Banner>
      <div className="tiq-grid tiq-grid--2">
        <Card title={t('supplier-org.change.whatChanges')}>
          <DetailList
            items={[
              {
                key: 'supplier',
                label: t('supplier-directory.opsIdentity.col.supplier'),
                value: row.supplier.legalName,
              },
              { key: 'type', label: t('supplier-org.change.type'), value: typeLabel },
              {
                key: 'previous',
                label: t('supplier-org.change.currentValue'),
                value: row.previousValue,
              },
              {
                key: 'proposed',
                label: t('supplier-org.change.proposedValue'),
                value: row.proposedValue,
              },
              { key: 'reason', label: t('supplier-org.change.reason'), value: row.reason },
              {
                key: 'evidence',
                label: t('supplier-org.change.evidenceTitle'),
                value: <DocumentLink document={row.evidenceDocument} />,
              },
            ]}
          />
        </Card>
        <Card title={t('supplier-org.change.reviewTitle')}>
          <DetailList
            items={[
              {
                key: 'submitted',
                label: t('supplier-org.change.submittedBy'),
                value: `${row.submittedBy.fullName} · ${formatDateTime(row.submittedAt, zone)}`,
              },
              {
                key: 'reviewed',
                label: t('supplier-org.change.reviewedBy'),
                value:
                  row.reviewedBy === null || row.reviewedAt === null
                    ? null
                    : `${row.reviewedBy.fullName} · ${formatDateTime(row.reviewedAt, zone)}`,
              },
              {
                key: 'effective',
                label: t('supplier-org.change.effectiveAt'),
                value: row.effectiveAt === null ? null : formatDateTime(row.effectiveAt, zone),
              },
              {
                key: 'note',
                label: t('supplier-org.change.decisionNote'),
                value: row.decisionNote,
              },
            ]}
          />
        </Card>
      </div>
      <div className="tiq-grid tiq-grid--2">
        <Card title={t('supplier-org.identity.historyTitle')}>
          {detail.legalNameHistory.length === 0 ? (
            <EmptyState compact title={t('supplier-org.identity.noHistory')} />
          ) : (
            <DetailList
              items={detail.legalNameHistory.map((entry) => ({
                key: `${entry.legalName}-${entry.validFrom}`,
                label: entry.legalName,
                value:
                  entry.validTo === null
                    ? t('supplier-org.identity.since', {
                        from: formatCalendarDate(entry.validFrom),
                      })
                    : t('supplier-org.identity.between', {
                        from: formatCalendarDate(entry.validFrom),
                        to: formatCalendarDate(entry.validTo),
                      }),
              }))}
            />
          )}
        </Card>
        <Card flush title={t('supplier-directory.opsIdentity.otherChanges')}>
          <DataTable
            caption={t('supplier-directory.opsIdentity.otherChanges')}
            columns={otherColumns}
            rows={detail.otherChanges}
            rowKey={(item) => String(item.id)}
            empty={<EmptyState compact title={t('supplier-directory.opsIdentity.noOther')} />}
          />
        </Card>
      </div>

      {confirmStart && (
        <ConfirmActionDialog
          open
          title={t('supplier-directory.opsIdentity.startTitle')}
          scope={t('supplier-directory.opsIdentity.scope', {
            type: typeLabel,
            name: row.supplier.legalName,
          })}
          consequence={t('supplier-directory.opsIdentity.startResult')}
          confirmLabel={t('supplier-directory.opsIdentity.start')}
          pending={start.pending}
          error={withSupplierMessage(start.error)}
          onCancel={() => {
            start.reset();
            setConfirmStart(false);
          }}
          onConfirm={async () => {
            try {
              const result = await start.mutate({ params: { changeId: row.id } });
              setRow(result);
              setConfirmStart(false);
              setOutcome(t('supplier-directory.opsIdentity.started'));
              toast.show(t('supplier-directory.opsIdentity.started'), 'success');
            } catch {
              // The dialog shows the error.
            }
          }}
        />
      )}
      {deciding && (
        <ConfirmActionDialog
          open
          tone={decision === 'rejected' ? 'danger' : 'primary'}
          title={t('supplier-directory.opsIdentity.decideTitle')}
          scope={t('supplier-directory.opsIdentity.scope', {
            type: typeLabel,
            name: row.supplier.legalName,
          })}
          consequence={
            decision === 'approved'
              ? t('supplier-directory.opsIdentity.approveResult')
              : t('supplier-directory.opsIdentity.rejectResult')
          }
          confirmLabel={
            decision === 'approved'
              ? t('supplier-directory.opsIdentity.approve')
              : t('supplier-directory.opsIdentity.reject')
          }
          reason={{ label: t('supplier-org.change.decisionNote'), required: true }}
          pending={decide.pending}
          error={withSupplierMessage(decide.error)}
          onCancel={() => {
            decide.reset();
            setDeciding(false);
          }}
          onConfirm={async ({ reason }) => {
            const body = {
              decision,
              decisionNote: reason,
              ...(decision === 'approved' && effectiveDate !== '' ? { effectiveDate } : {}),
            };
            const found = validateWith(DecideIdentityChangeBody, body);
            setClientErrors(found);
            if (found.length > 0) return;
            try {
              const result = await decide.mutate({ params: { changeId: row.id }, body });
              setRow(result);
              setDeciding(false);
              const message = t('supplier-directory.opsIdentity.decided', {
                status: tEnum('supplier_identity_changes.status', result.status),
              });
              setOutcome(message);
              toast.show(message, 'success');
            } catch {
              // The dialog shows the error.
            }
          }}
        >
          <div className="tiq-stack">
            <RadioGroup
              label={t('supplier-org.change.decision')}
              inline
              value={decision}
              onChange={(value) => setDecision(value === 'rejected' ? 'rejected' : 'approved')}
              options={[
                { value: 'approved', label: t('supplier-directory.opsIdentity.approve') },
                { value: 'rejected', label: t('supplier-directory.opsIdentity.reject') },
              ]}
              error={errors.forField('decision')}
            />
            {decision === 'approved' && (
              <DateInput
                label={t('supplier-directory.opsIdentity.effectiveDate')}
                hint={t('supplier-directory.opsIdentity.effectiveDateHint')}
                required
                value={effectiveDate}
                onChange={setEffectiveDate}
                error={errors.forField('effectiveDate')}
              />
            )}
          </div>
        </ConfirmActionDialog>
      )}
    </div>
  );
}
