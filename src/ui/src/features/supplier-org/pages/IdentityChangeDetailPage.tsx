/**
 * SUP-03 — one legal-identity change request: what changes, why, the evidence, and where the review stands
 * (submitted → under review → approved or rejected). An approved change applies from its effective date; records
 * and submissions made earlier keep the identity they were made under.
 */
import { useLocation } from 'react-router';

import { suppliersEndpoints } from '@contracts/suppliers';
import type { IdentityChange } from '@contracts/suppliers';

import { useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Card,
  DetailList,
  ErrorState,
  PageHeader,
  SkeletonBlock,
  StatusChip,
  Stepper,
} from '../../../components/ui';
import type { StepItem } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { DocumentLink } from '../components/SupplierBits';
import { useCommandResult, useIdParam, useOfficialTimeZone } from '../lib/hooks';
import { supplierOrgPaths } from '../lib/paths';

export default function IdentityChangeDetailPage() {
  const changeId = useIdParam('changeId');
  const location = useLocation();
  const justSubmitted =
    (location.state as { readonly submitted?: boolean } | null)?.submitted === true;
  const [seeded] = useCommandResult<IdentityChange>(changeId);
  const query = useApiQuery(
    suppliersEndpoints.getIdentityChange,
    changeId === null || seeded !== null ? null : { params: { changeId } },
  );
  const change = seeded ?? query.data;
  const back = {
    to: `${supplierOrgPaths.profile}?tab=identity`,
    label: t('supplier-org.change.back'),
  };

  if (change === undefined) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('supplier-org.change.detailTitle')} back={back} />
        {query.error !== null ? (
          <ErrorState error={query.error} onRetry={query.reload} />
        ) : changeId === null ? (
          <Banner tone="error" title={t('supplier-org.change.notFound')} />
        ) : (
          <SkeletonBlock lines={6} />
        )}
      </div>
    );
  }
  return <ChangeView change={change} justSubmitted={justSubmitted} back={back} />;
}

function stepsOf(change: IdentityChange): StepItem[] {
  const decided = change.status === 'approved' || change.status === 'rejected';
  return [
    {
      id: 'submitted',
      label: tEnum('supplier_identity_changes.status', 'submitted'),
      state: 'complete',
    },
    {
      id: 'review',
      label: tEnum('supplier_identity_changes.status', 'under_review'),
      state: change.status === 'submitted' ? 'upcoming' : decided ? 'complete' : 'current',
    },
    {
      id: 'decision',
      label: decided
        ? tEnum('supplier_identity_changes.status', change.status)
        : t('supplier-org.change.decision'),
      state: change.status === 'rejected' ? 'blocked' : decided ? 'complete' : 'upcoming',
    },
  ];
}

function ChangeView({
  change,
  justSubmitted,
  back,
}: {
  readonly change: IdentityChange;
  readonly justSubmitted: boolean;
  readonly back: { readonly to: string; readonly label: string };
}) {
  const zone = useOfficialTimeZone();
  const typeLabel = tEnum('supplier_identity_changes.change_type', change.changeType);
  const next =
    change.status === 'submitted'
      ? t('supplier-org.change.next.submitted')
      : change.status === 'under_review'
        ? t('supplier-org.change.next.review')
        : change.status === 'approved'
          ? t('supplier-org.change.next.approved')
          : t('supplier-org.change.next.rejected');

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('supplier-org.change.detailTitleOf', { type: typeLabel })}
        back={back}
        meta={
          <span className="tiq-inline">
            <StatusChip enum="supplier_identity_changes.status" value={change.status} />
            <span className="tiq-text-muted">{t('supplier-org.change.nextLabel', { next })}</span>
          </span>
        }
      />
      {justSubmitted && (
        <Banner tone="success" title={t('supplier-org.change.submittedTitle')}>
          <p>{t('supplier-org.change.submittedText')}</p>
        </Banner>
      )}
      <Stepper steps={stepsOf(change)} label={t('supplier-org.change.progress')} />
      <div className="tiq-grid tiq-grid--2">
        <Card title={t('supplier-org.change.whatChanges')}>
          <DetailList
            items={[
              { key: 'type', label: t('supplier-org.change.type'), value: typeLabel },
              {
                key: 'previous',
                label: t('supplier-org.change.currentValue'),
                value: change.previousValue,
              },
              {
                key: 'proposed',
                label: t('supplier-org.change.proposedValue'),
                value: change.proposedValue,
              },
              { key: 'reason', label: t('supplier-org.change.reason'), value: change.reason },
              {
                key: 'evidence',
                label: t('supplier-org.change.evidenceTitle'),
                value: <DocumentLink document={change.evidenceDocument} />,
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
                value: `${change.submittedBy.fullName} · ${formatDateTime(change.submittedAt, zone)}`,
              },
              {
                key: 'reviewed',
                label: t('supplier-org.change.reviewedBy'),
                value:
                  change.reviewedBy === null || change.reviewedAt === null
                    ? null
                    : `${change.reviewedBy.fullName} · ${formatDateTime(change.reviewedAt, zone)}`,
              },
              {
                key: 'effective',
                label: t('supplier-org.change.effectiveAt'),
                value:
                  change.effectiveAt === null ? null : formatDateTime(change.effectiveAt, zone),
              },
              {
                key: 'note',
                label: t('supplier-org.change.decisionNote'),
                value: change.decisionNote,
              },
            ]}
          />
        </Card>
      </div>
      <Banner tone="info" title={t('supplier-org.change.historyTitle')}>
        <p>{t('supplier-org.change.history')}</p>
      </Banner>
    </div>
  );
}
