/**
 * Operator — review one possible duplicate (BR-44): the two organizations side by side (identity metadata only), the
 * fields that match or differ, and the decision: not a duplicate, merge (choosing the surviving organization; the
 * merged record is kept and historical bids, receipts and contracts are never re-pointed) or escalate.
 */
import { useState } from 'react';

import type { FieldError } from '@contracts/common';
import { DecideDuplicateBody, suppliersEndpoints } from '@contracts/suppliers';
import type { DuplicateCandidate, DuplicateDetail, OpsSupplierSummary } from '@contracts/suppliers';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  ErrorState,
  PageHeader,
  RadioGroup,
  SkeletonBlock,
  StatusChip,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { withSupplierMessage } from '../../supplier-org/lib/errors';
import { useIdParam, useOfficialTimeZone } from '../../supplier-org/lib/hooks';
import { errorLookup, validateWith } from '../../supplier-org/lib/validation';
import { OpsReviewTabs } from '../components/OpsReviewTabs';
import { directoryPaths } from '../lib/paths';

export default function OpsDuplicateDetailPage() {
  const candidateId = useIdParam('candidateId');
  const query = useApiQuery(
    suppliersEndpoints.getDuplicate,
    candidateId === null ? null : { params: { candidateId } },
  );
  const back = { to: directoryPaths.duplicates, label: t('supplier-directory.duplicates.back') };
  if (query.data === undefined) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('supplier-directory.duplicates.detailTitle')} back={back} />
        {query.error !== null ? (
          <ErrorState error={query.error} onRetry={query.reload} />
        ) : candidateId === null ? (
          <Banner tone="error" title={t('supplier-directory.duplicates.notFound')} />
        ) : (
          <SkeletonBlock lines={8} />
        )}
      </div>
    );
  }
  return <DuplicateView key={query.data.id} detail={query.data} back={back} />;
}

type Decision = 'not_duplicate' | 'merged' | 'escalated';

function DuplicateView({
  detail,
  back,
}: {
  readonly detail: DuplicateDetail;
  readonly back: { readonly to: string; readonly label: string };
}) {
  const zone = useOfficialTimeZone();
  const toast = useToast();
  const decide = useApiMutation(suppliersEndpoints.decideDuplicate);
  const [candidate, setCandidate] = useState<DuplicateCandidate>(detail);
  const [merge, setMerge] = useState(detail.merge);
  const [deciding, setDeciding] = useState(false);
  const [decision, setDecision] = useState<Decision>('not_duplicate');
  const [surviving, setSurviving] = useState(String(detail.tenantA.tenantId));
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const [outcome, setOutcome] = useState<string | null>(null);
  const errors = errorLookup(clientErrors, decide.error, ['decision', 'survivingTenantId']);
  const open = candidate.status === 'open' || candidate.status === 'escalated';

  type Row = DuplicateDetail['comparison'][number];
  const columns: DataTableColumn<Row>[] = [
    { id: 'field', header: t('supplier-directory.duplicates.col.field'), cell: (row) => row.field },
    {
      id: 'a',
      header: detail.tenantA.legalName,
      cell: (row) => row.valueA ?? '—',
    },
    {
      id: 'b',
      header: detail.tenantB.legalName,
      cell: (row) => row.valueB ?? '—',
    },
    {
      id: 'matches',
      header: t('supplier-directory.duplicates.col.matches'),
      cell: (row) =>
        row.matches ? (
          <Chip tone="warning" size="sm" icon="check">
            {t('supplier-directory.duplicates.same')}
          </Chip>
        ) : (
          <Chip tone="neutral" size="sm">
            {t('supplier-directory.duplicates.different')}
          </Chip>
        ),
    },
  ];

  const summary = (org: OpsSupplierSummary) => (
    <DetailList
      items={[
        {
          key: 'status',
          label: t('supplier-directory.duplicates.orgStatus'),
          value: <StatusChip enum="tenants.status" value={org.status} />,
        },
        {
          key: 'verification',
          label: t('supplier-org.statuses.verification'),
          value: <StatusChip enum="tenants.verification_status" value={org.verificationStatus} />,
        },
        {
          key: 'provisional',
          label: t('supplier-directory.duplicates.provisional'),
          value: org.isProvisional
            ? t('supplier-directory.duplicates.provisionalBy', {
                buyer: org.createdBy?.tenantName ?? '—',
              })
            : t('supplier-directory.record.no'),
        },
        {
          key: 'number',
          label: t('supplier-org.fields.registrationNumber'),
          value: org.registrationNumber,
        },
        { key: 'domain', label: t('supplier-directory.duplicates.domain'), value: org.emailDomain },
        {
          key: 'members',
          label: t('supplier-directory.duplicates.members'),
          value: formatCount(org.memberCount),
        },
        {
          key: 'created',
          label: t('supplier-directory.duplicates.orgCreated'),
          value: formatDateTime(org.createdAt, zone),
        },
      ]}
    />
  );

  const body = {
    decision,
    ...(decision === 'merged' ? { survivingTenantId: Number(surviving) } : {}),
  };

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('supplier-directory.duplicates.detailTitle')}
        back={back}
        meta={
          <span className="tiq-inline">
            <StatusChip enum="duplicate_candidates.status" value={candidate.status} />
            <span>{tEnum('duplicate_candidates.detected_reason', candidate.detectedReason)}</span>
            <span className="tiq-text-muted">
              {candidate.raisedBy === null
                ? t('supplier-directory.duplicates.detectedAt', {
                    at: formatDateTime(candidate.createdAt, zone),
                  })
                : t('supplier-directory.duplicates.raised', {
                    by: candidate.raisedBy.tenantName,
                    at: formatDateTime(candidate.createdAt, zone),
                  })}
            </span>
          </span>
        }
        primaryAction={
          open ? (
            <Button variant="primary" icon="gavel" onClick={() => setDeciding(true)}>
              {t('supplier-directory.duplicates.decide')}
            </Button>
          ) : undefined
        }
      />
      <OpsReviewTabs />
      <Banner tone="warning" title={t('supplier-directory.duplicates.guidanceTitle')}>
        <p>{detail.guidance}</p>
      </Banner>
      {outcome !== null && (
        <Banner tone="success" title={t('supplier-directory.list.doneTitle')}>
          <p>{outcome}</p>
        </Banner>
      )}
      {candidate.note !== null && (
        <Card title={t('supplier-directory.duplicates.note')}>
          <p>{candidate.note}</p>
        </Card>
      )}
      <div className="tiq-grid tiq-grid--2">
        <Card
          title={detail.tenantA.legalName}
          subtitle={t('supplier-directory.duplicates.recordA')}
        >
          {summary(detail.tenantA)}
        </Card>
        <Card
          title={detail.tenantB.legalName}
          subtitle={t('supplier-directory.duplicates.recordB')}
        >
          {summary(detail.tenantB)}
        </Card>
      </div>
      <Card flush title={t('supplier-directory.duplicates.comparison')}>
        <DataTable
          caption={t('supplier-directory.duplicates.comparison')}
          columns={columns}
          rows={detail.comparison}
          rowKey={(row) => row.field}
        />
      </Card>
      {(candidate.reviewedAt !== null || merge !== null) && (
        <Card title={t('supplier-directory.duplicates.decisionTitle')}>
          <DetailList
            items={[
              {
                key: 'reviewed',
                label: t('supplier-directory.duplicates.col.reviewed'),
                value:
                  candidate.reviewedAt === null
                    ? null
                    : `${candidate.reviewedBy?.fullName ?? ''} · ${formatDateTime(candidate.reviewedAt, zone)}`,
              },
              {
                key: 'merge',
                label: t('supplier-directory.duplicates.merge'),
                value:
                  merge === null
                    ? null
                    : t('supplier-directory.duplicates.mergeText', {
                        surviving:
                          merge.survivingTenantId === detail.tenantA.tenantId
                            ? detail.tenantA.legalName
                            : detail.tenantB.legalName,
                        reason: merge.reason,
                      }),
              },
            ]}
          />
        </Card>
      )}
      {deciding && (
        <ConfirmActionDialog
          open
          tone={decision === 'merged' ? 'danger' : 'primary'}
          title={t('supplier-directory.duplicates.decideTitle')}
          scope={t('supplier-directory.duplicates.decideScope', {
            a: detail.tenantA.legalName,
            b: detail.tenantB.legalName,
          })}
          consequence={t(`supplier-directory.duplicates.result.${decision}`)}
          confirmLabel={t('supplier-directory.duplicates.confirm')}
          reason={{ label: t('supplier-directory.duplicates.decisionReason'), required: true }}
          acknowledgement={
            decision === 'merged'
              ? t('supplier-directory.duplicates.mergeAcknowledgement')
              : undefined
          }
          pending={decide.pending}
          error={withSupplierMessage(decide.error)}
          onCancel={() => {
            decide.reset();
            setDeciding(false);
          }}
          onConfirm={async ({ reason }) => {
            const full = { ...body, reason };
            const found = validateWith(DecideDuplicateBody, full);
            setClientErrors(found);
            if (found.length > 0) return;
            try {
              const result = await decide.mutate({
                params: { candidateId: detail.id },
                body: full,
              });
              setCandidate(result.candidate);
              setMerge(result.merge);
              setDeciding(false);
              setOutcome(result.message);
              toast.show(result.message, 'success');
            } catch {
              // The dialog shows the error.
            }
          }}
        >
          <div className="tiq-stack">
            <RadioGroup
              label={t('supplier-directory.duplicates.decision')}
              value={decision}
              onChange={(value) => setDecision(value as Decision)}
              options={(['not_duplicate', 'merged', 'escalated'] as const).map((value) => ({
                value,
                label: tEnum('duplicate_candidates.status', value),
                hint: t(`supplier-directory.duplicates.decisionHint.${value}`),
              }))}
              error={errors.forField('decision')}
            />
            {decision === 'merged' && (
              <RadioGroup
                label={t('supplier-directory.duplicates.surviving')}
                value={surviving}
                onChange={setSurviving}
                options={[detail.tenantA, detail.tenantB].map((org) => ({
                  value: String(org.tenantId),
                  label: org.legalName,
                }))}
                error={errors.forField('survivingTenantId')}
              />
            )}
          </div>
        </ConfirmActionDialog>
      )}
    </div>
  );
}
