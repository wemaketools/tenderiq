/**
 * OPS-06 Platform oversight: account administration and aggregate usage (counts only), privileged-access reviews,
 * support-grant use, service complaints and misuse cases. Actions: complete an access review (never one's own) and
 * review a conduct case. Oversight never exposes confidential procurement information or enables sealed-bid access.
 */
import { useState } from 'react';

import {
  ACCESS_REVIEW_OUTCOMES,
  ACCESS_REVIEW_STATUSES,
  CONDUCT_CASE_KINDS,
  CONDUCT_CASE_STATUSES,
  operationsEndpoints,
} from '@contracts/operations';
import type {
  AccessReviewRow,
  AccessReviewStatus,
  ConductCaseKind,
  ConductCaseRow,
  ConductCaseStatus,
  UsageRow,
} from '@contracts/operations';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import {
  Banner,
  Button,
  Card,
  ConfirmActionDialog,
  DataTable,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  PageHeader,
  QueryView,
  RadioGroup,
  Select,
  Tabs,
  TextArea,
  useToast,
} from '../../../components/ui';
import { formatCalendarDate, formatCount, formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { fieldErrorOnly } from '../lib/errors';
import { opsOptions, personName } from '../lib/labels';
import { opsPaths } from '../lib/paths';
import { ActionError } from '../components/ActionError';
import { OpsChip } from '../components/OpsChip';

type Tab = 'usage' | 'reviews' | 'conduct';

export default function OversightPage() {
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const [tab, setTab] = useState<Tab>('usage');
  const summary = useApiQuery(operationsEndpoints.getOversightSummary, {});

  return (
    <div className="tiq-page">
      <PageHeader title={t('ops.oversight.title')} subtitle={t('ops.oversight.subtitle')} />
      <QueryView query={summary}>
        {(data) => (
          <>
            <Banner tone="info" title={t('ops.oversight.confidentialityTitle')}>
              <p>{data.confidentialityNote}</p>
            </Banner>
            <KpiGrid>
              <KpiCard
                label={t('ops.oversight.kpi.customers')}
                icon="building"
                value={formatCount(data.customers.buyers + data.customers.suppliers)}
                hint={t('ops.oversight.kpi.customersHint', {
                  buyers: data.customers.buyers,
                  suppliers: data.customers.suppliers,
                })}
                to={opsPaths.customers}
              />
              <KpiCard
                label={t('ops.oversight.kpi.grants')}
                icon="key"
                tone="info"
                value={formatCount(data.activeSupportGrants)}
                hint={t('ops.oversight.kpi.grantsHint', { count: data.supportGrantsLast90Days })}
                to={opsPaths.supportGrants}
              />
              <KpiCard
                label={t('ops.oversight.kpi.reviews')}
                icon="shieldCheck"
                tone="warning"
                value={formatCount(data.accessReviewsDue)}
                hint={t('ops.oversight.kpi.reviewsHint')}
              />
              <KpiCard
                label={t('ops.oversight.kpi.conduct')}
                icon="alertTriangle"
                tone="danger"
                value={formatCount(data.openConductCases)}
                hint={t('ops.oversight.kpi.conductHint', { count: data.openIncidents })}
              />
            </KpiGrid>
            <p className="tiq-text-muted">
              {t('ops.oversight.asOf', { at: formatDateTime(data.asOf, timeZone) })}
            </p>
            <Tabs
              label={t('ops.oversight.tabs')}
              selected={tab}
              onSelect={(id) => setTab(id as Tab)}
              tabs={[
                { id: 'usage', label: t('ops.oversight.usage') },
                { id: 'reviews', label: t('ops.oversight.reviews'), count: data.accessReviewsDue },
                { id: 'conduct', label: t('ops.oversight.conduct'), count: data.openConductCases },
              ]}
            >
              {tab === 'usage' && <UsageTable rows={data.usage} timeZone={timeZone} />}
              {tab === 'reviews' && <AccessReviews timeZone={timeZone} />}
              {tab === 'conduct' && <ConductCases timeZone={timeZone} />}
            </Tabs>
          </>
        )}
      </QueryView>
    </div>
  );
}

function UsageTable({
  rows,
  timeZone,
}: {
  readonly rows: readonly UsageRow[];
  readonly timeZone: string;
}) {
  return (
    <Card flush title={t('ops.oversight.usage')} subtitle={t('ops.oversight.usageHint')}>
      <DataTable<UsageRow>
        caption={t('ops.oversight.usage')}
        rows={rows}
        rowKey={(row) => String(row.customer.tenantId)}
        empty={<EmptyState compact title={t('ops.oversight.noUsage')} />}
        columns={[
          {
            id: 'customer',
            header: t('ops.oversight.col.customer'),
            cell: (row) => (
              <>
                {row.customer.name}
                <div className="tiq-cell-sub">{t(`ops.customers.kind.${row.customer.kind}`)}</div>
              </>
            ),
          },
          {
            id: 'users',
            header: t('ops.oversight.col.users'),
            numeric: true,
            cell: (row) => formatCount(row.activeUsers),
          },
          {
            id: 'events',
            header: t('ops.oversight.col.events'),
            numeric: true,
            cell: (row) => formatCount(row.publishedEventsYtd),
          },
          {
            id: 'submissions',
            header: t('ops.oversight.col.submissions'),
            numeric: true,
            cell: (row) => formatCount(row.submissionsReceivedYtd),
          },
          {
            id: 'contracts',
            header: t('ops.oversight.col.contracts'),
            numeric: true,
            cell: (row) => formatCount(row.activeContracts),
          },
          {
            id: 'storage',
            header: t('ops.oversight.col.storage'),
            numeric: true,
            cell: (row) => row.storageUsedGb,
          },
          {
            id: 'cases',
            header: t('ops.oversight.col.cases'),
            numeric: true,
            cell: (row) => formatCount(row.openSupportCases),
          },
          {
            id: 'activity',
            header: t('ops.oversight.col.activity'),
            cell: (row) =>
              row.lastActivityAt === null
                ? t('ops.common.none')
                : formatDateTime(row.lastActivityAt, timeZone),
          },
        ]}
      />
    </Card>
  );
}

function AccessReviews({ timeZone }: { readonly timeZone: string }) {
  const toast = useToast();
  const [filters, setFilters, clearFilters] = useScreenFilters('OPS-06-reviews', {
    status: '',
    page: 1,
    sort: 'dueOn',
    dir: 'asc',
  });
  const [reviewing, setReviewing] = useState<AccessReviewRow | null>(null);
  const [outcome, setOutcome] = useState('');
  const [missing, setMissing] = useState(false);
  const complete = useApiMutation(operationsEndpoints.completeAccessReview);
  const reviews = useApiQuery(operationsEndpoints.listAccessReviews, {
    query: {
      page: filters.page,
      pageSize: 25,
      sort: filters.sort as 'dueOn' | 'status' | 'subject',
      dir: filters.dir as 'asc' | 'desc',
      ...(filters.status === '' ? {} : { status: [filters.status as AccessReviewStatus] }),
    },
  });
  return (
    <>
      <FilterBar onClear={clearFilters} canClear={filters.status !== ''}>
        <Select
          label={t('ops.oversight.col.status')}
          placeholder={t('ops.common.all')}
          value={filters.status}
          onChange={(value) => setFilters({ status: value, page: 1 })}
          options={opsOptions('reviewStatus', ACCESS_REVIEW_STATUSES)}
        />
      </FilterBar>
      <Card flush title={t('ops.oversight.reviews')} subtitle={t('ops.oversight.reviewsHint')}>
        <DataTable<AccessReviewRow>
          caption={t('ops.oversight.reviews')}
          rows={reviews.data?.items}
          rowKey={(row) => String(row.id)}
          loading={reviews.isFetching}
          error={reviews.error}
          onRetry={reviews.reload}
          sort={{ key: filters.sort, dir: filters.dir as 'asc' | 'desc' }}
          onSortChange={(next) => setFilters({ sort: next.key, dir: next.dir, page: 1 })}
          empty={<EmptyState compact icon="shieldCheck" title={t('ops.oversight.noReviews')} />}
          pagination={
            reviews.data === undefined
              ? undefined
              : {
                  page: reviews.data.page,
                  pageSize: reviews.data.pageSize,
                  total: reviews.data.total,
                  onPageChange: (page) => setFilters({ page }),
                }
          }
          columns={[
            {
              id: 'subject',
              header: t('ops.oversight.col.subject'),
              sortable: true,
              cell: (row) => (
                <>
                  {row.subject.fullName}
                  <div className="tiq-cell-sub">{row.capacity}</div>
                </>
              ),
            },
            {
              id: 'privileges',
              header: t('ops.oversight.col.privileges'),
              cell: (row) => <span className="tiq-cell-sub">{row.privileges.join(', ')}</span>,
            },
            {
              id: 'grants',
              header: t('ops.oversight.col.grants'),
              numeric: true,
              cell: (row) => formatCount(row.grantsLast90Days),
            },
            {
              id: 'dueOn',
              header: t('ops.oversight.col.due'),
              sortable: true,
              cell: (row) => formatCalendarDate(row.dueOn),
            },
            {
              id: 'status',
              header: t('ops.oversight.col.status'),
              sortable: true,
              cell: (row) => (
                <div className="tiq-stack">
                  <span>
                    <OpsChip kind="reviewStatus" value={row.status} size="sm" />
                  </span>
                  {row.outcome !== null && (
                    <OpsChip kind="reviewOutcome" value={row.outcome} size="sm" />
                  )}
                </div>
              ),
            },
            {
              id: 'reviewer',
              header: t('ops.oversight.col.reviewer'),
              cell: (row) => (
                <>
                  {personName(row.reviewer)}
                  {row.reviewedAt !== null && (
                    <div className="tiq-cell-sub">{formatDateTime(row.reviewedAt, timeZone)}</div>
                  )}
                  {row.note !== null && <div className="tiq-cell-sub">{row.note}</div>}
                </>
              ),
            },
            {
              id: 'actions',
              header: t('ops.common.actions'),
              cell: (row) =>
                row.status === 'completed' ? null : (
                  <Button
                    size="sm"
                    onClick={() => {
                      complete.reset();
                      setOutcome('');
                      setMissing(false);
                      setReviewing(row);
                    }}
                  >
                    {t('ops.oversight.completeReview')}
                  </Button>
                ),
            },
          ]}
        />
      </Card>
      <ConfirmActionDialog
        open={reviewing !== null}
        title={t('ops.oversight.completeTitle')}
        scope={reviewing === null ? '' : `${reviewing.subject.fullName} · ${reviewing.capacity}`}
        consequence={
          outcome === ''
            ? t('ops.oversight.chooseOutcome')
            : t(`ops.oversight.outcomeConsequence.${outcome}`)
        }
        confirmLabel={t('ops.oversight.completeReview')}
        tone={outcome === 'revoke' ? 'danger' : 'primary'}
        reason={{ label: t('ops.oversight.reviewNote'), required: true }}
        pending={complete.pending}
        error={fieldErrorOnly(complete.error)}
        onCancel={() => setReviewing(null)}
        onConfirm={async ({ reason }) => {
          if (reviewing === null) return;
          if (outcome === '') {
            setMissing(true);
            return;
          }
          try {
            await complete.mutate({
              params: { reviewId: reviewing.id },
              body: { outcome: outcome as (typeof ACCESS_REVIEW_OUTCOMES)[number], note: reason },
            });
            toast.show(t('ops.oversight.reviewDone'), 'success');
            invalidateApiQueries('ops.operations.');
            setReviewing(null);
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <RadioGroup
          label={t('ops.oversight.outcome')}
          required
          value={outcome}
          onChange={setOutcome}
          options={opsOptions('reviewOutcome', ACCESS_REVIEW_OUTCOMES)}
          error={missing && outcome === '' ? t('ops.common.required') : undefined}
        />
        <ActionError error={complete.error} />
      </ConfirmActionDialog>
    </>
  );
}

function ConductCases({ timeZone }: { readonly timeZone: string }) {
  const toast = useToast();
  const [filters, setFilters, clearFilters] = useScreenFilters('OPS-06-conduct', {
    kind: '',
    status: '',
    page: 1,
    sort: 'reportedAt',
    dir: 'desc',
  });
  const [reviewing, setReviewing] = useState<ConductCaseRow | null>(null);
  const [target, setTarget] = useState<'under_review' | 'closed'>('under_review');
  const [outcome, setOutcome] = useState('');
  const review = useApiMutation(operationsEndpoints.reviewConductCase);
  const cases = useApiQuery(operationsEndpoints.listConductCases, {
    query: {
      page: filters.page,
      pageSize: 25,
      sort: filters.sort as 'reportedAt' | 'status' | 'kind',
      dir: filters.dir as 'asc' | 'desc',
      ...(filters.kind === '' ? {} : { kind: [filters.kind as ConductCaseKind] }),
      ...(filters.status === '' ? {} : { status: [filters.status as ConductCaseStatus] }),
    },
  });
  return (
    <>
      <FilterBar onClear={clearFilters} canClear={filters.kind !== '' || filters.status !== ''}>
        <Select
          label={t('ops.oversight.col.kind')}
          placeholder={t('ops.common.all')}
          value={filters.kind}
          onChange={(value) => setFilters({ kind: value, page: 1 })}
          options={opsOptions('conductKind', CONDUCT_CASE_KINDS)}
        />
        <Select
          label={t('ops.oversight.col.status')}
          placeholder={t('ops.common.all')}
          value={filters.status}
          onChange={(value) => setFilters({ status: value, page: 1 })}
          options={opsOptions('conductStatus', CONDUCT_CASE_STATUSES)}
        />
      </FilterBar>
      <Card flush title={t('ops.oversight.conduct')} subtitle={t('ops.oversight.conductHint')}>
        <DataTable<ConductCaseRow>
          caption={t('ops.oversight.conduct')}
          rows={cases.data?.items}
          rowKey={(row) => String(row.id)}
          loading={cases.isFetching}
          error={cases.error}
          onRetry={cases.reload}
          sort={{ key: filters.sort, dir: filters.dir as 'asc' | 'desc' }}
          onSortChange={(next) => setFilters({ sort: next.key, dir: next.dir, page: 1 })}
          empty={<EmptyState compact icon="shield" title={t('ops.oversight.noConduct')} />}
          pagination={
            cases.data === undefined
              ? undefined
              : {
                  page: cases.data.page,
                  pageSize: cases.data.pageSize,
                  total: cases.data.total,
                  onPageChange: (page) => setFilters({ page }),
                }
          }
          columns={[
            {
              id: 'reference',
              header: t('ops.oversight.col.case'),
              cell: (row) => (
                <>
                  <span className="tiq-mono">{row.reference}</span>
                  <div className="tiq-cell-sub">{row.summary}</div>
                </>
              ),
            },
            {
              id: 'kind',
              header: t('ops.oversight.col.kind'),
              sortable: true,
              cell: (row) => <OpsChip kind="conductKind" value={row.kind} size="sm" />,
            },
            {
              id: 'customer',
              header: t('ops.oversight.col.customer'),
              cell: (row) => row.customer?.name ?? t('ops.oversight.platformWide'),
            },
            {
              id: 'owner',
              header: t('ops.oversight.col.owner'),
              cell: (row) => personName(row.owner),
            },
            {
              id: 'reportedAt',
              header: t('ops.oversight.col.reported'),
              sortable: true,
              cell: (row) => formatDateTime(row.reportedAt, timeZone),
            },
            {
              id: 'status',
              header: t('ops.oversight.col.status'),
              sortable: true,
              cell: (row) => (
                <div className="tiq-stack">
                  <span>
                    <OpsChip kind="conductStatus" value={row.status} size="sm" />
                  </span>
                  {row.outcome !== null && <span className="tiq-cell-sub">{row.outcome}</span>}
                </div>
              ),
            },
            {
              id: 'actions',
              header: t('ops.common.actions'),
              cell: (row) =>
                row.status === 'closed' ? null : (
                  <Button
                    size="sm"
                    onClick={() => {
                      review.reset();
                      setTarget(row.status === 'open' ? 'under_review' : 'closed');
                      setOutcome('');
                      setReviewing(row);
                    }}
                  >
                    {t('ops.oversight.review')}
                  </Button>
                ),
            },
          ]}
        />
      </Card>
      <ConfirmActionDialog
        open={reviewing !== null}
        title={t('ops.oversight.reviewTitle')}
        scope={reviewing === null ? '' : `${reviewing.reference} · ${reviewing.summary}`}
        consequence={t(`ops.oversight.conductConsequence.${target}`)}
        confirmLabel={t('ops.oversight.review')}
        reason={{ label: t('ops.oversight.reviewNote'), required: false }}
        pending={review.pending}
        error={fieldErrorOnly(review.error)}
        onCancel={() => setReviewing(null)}
        onConfirm={async ({ reason }) => {
          if (reviewing === null) return;
          try {
            await review.mutate({
              params: { conductCaseId: reviewing.id },
              body: {
                status: target,
                ...(reason === '' ? {} : { note: reason }),
                ...(outcome.trim() === '' ? {} : { outcome: outcome.trim() }),
              },
            });
            toast.show(t('ops.oversight.reviewSaved'), 'success');
            invalidateApiQueries('ops.operations.');
            setReviewing(null);
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <RadioGroup
          label={t('ops.oversight.col.status')}
          required
          value={target}
          onChange={(value) => setTarget(value === 'closed' ? 'closed' : 'under_review')}
          options={opsOptions('conductStatus', ['under_review', 'closed'])}
        />
        {target === 'closed' && (
          <TextArea
            label={t('ops.oversight.outcomeText')}
            hint={t('ops.oversight.outcomeHint')}
            required
            rows={3}
            value={outcome}
            onChange={setOutcome}
          />
        )}
        <ActionError error={review.error} />
      </ConfirmActionDialog>
    </>
  );
}
