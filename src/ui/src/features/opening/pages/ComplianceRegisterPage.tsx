/**
 * BUY-21 — Compliance register of one tender: one row per non-draft bid with its checklist summary, open
 * clarifications, exclusion and ranking eligibility. Excluded bids (and bids with an exclusion pending) are not
 * ranked, and their unopened commercial envelopes stay sealed (AC-17).
 */
import { Link, useNavigate, useParams } from 'react-router';

import { openingEndpoints } from '@contracts/opening';
import type { ComplianceBidRow } from '@contracts/opening';
import type { BidsComplianceStatus, BidsSubmissionState } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import {
  Banner,
  ButtonLink,
  Card,
  Chip,
  DataTable,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  OfficialDeadline,
  OrDash,
  PageHeader,
  Reference,
  SearchField,
  Select,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatOfficialTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { CheckSummaryText, RankingChip } from '../components/ComplianceChips';
import { EnvelopeChips } from '../components/EnvelopeChips';
import { LoadingFrame } from '../components/LoadingFrame';
import { RecordNotFound } from '../components/RecordNotFound';
import { oneOf, textOrUndefined, useListState } from '../lib/listState';
import { PROGRESS_TONE, enumSelectOptions, progressLabel } from '../lib/options';
import { idParam, openingPaths } from '../lib/paths';

function RegisterKpis({ tenderId }: { readonly tenderId: number }) {
  const count = { page: 1, pageSize: 1 } as const;
  const params = { tenderId };
  const compliant = useApiQuery(openingEndpoints.listBids, {
    params,
    query: { ...count, complianceStatus: ['compliant'] },
  });
  const pending = useApiQuery(openingEndpoints.listBids, {
    params,
    query: { ...count, complianceStatus: ['pending', 'clarification_pending'] },
  });
  const failed = useApiQuery(openingEndpoints.listBids, {
    params,
    query: { ...count, complianceStatus: ['non_compliant', 'excluded'] },
  });
  const notRanked = useApiQuery(openingEndpoints.listBids, {
    params,
    query: { ...count, rankingEligible: false },
  });
  const value = (total: number | undefined) =>
    total === undefined ? t('opening.kpi.loading') : formatCount(total);
  return (
    <KpiGrid>
      <KpiCard
        label={t('opening.kpi.compliant')}
        value={value(compliant.data?.total)}
        icon="checkCircle"
        tone="success"
      />
      <KpiCard
        label={t('opening.kpi.inReview')}
        value={value(pending.data?.total)}
        icon="hourglass"
        tone="warning"
      />
      <KpiCard
        label={t('opening.kpi.nonCompliant')}
        value={value(failed.data?.total)}
        icon="xCircle"
        tone="danger"
      />
      <KpiCard
        label={t('opening.kpi.notRanked')}
        value={value(notRanked.data?.total)}
        icon="ban"
        hint={t('opening.kpi.notRankedHint')}
      />
    </KpiGrid>
  );
}

function RegisterView({ tenderId }: { readonly tenderId: number }) {
  const navigate = useNavigate();
  const overview = useApiQuery(openingEndpoints.getTender, { params: { tenderId } });
  const list = useListState(
    `BUY-21.register.${tenderId}`,
    { q: '', complianceStatus: '', submissionState: '', lotId: '', ranking: '' },
    { key: 'supplierName' as const, dir: 'asc' },
  );
  const { filters } = list;
  const query = useApiQuery(openingEndpoints.listBids, {
    params: { tenderId },
    query: {
      ...list.paging,
      q: textOrUndefined(filters.q),
      complianceStatus: oneOf<BidsComplianceStatus>(filters.complianceStatus),
      submissionState: oneOf<BidsSubmissionState>(filters.submissionState),
      lotId: filters.lotId === '' ? undefined : Number(filters.lotId),
      rankingEligible: filters.ranking === '' ? undefined : filters.ranking === 'yes',
    },
  });
  const back = { to: openingPaths.compliance, label: t('opening.compliance.back') };

  return (
    <LoadingFrame title={t('opening.register.loadingTitle')} back={back} query={overview}>
      {(data) => {
        const tender = data.tender;
        const timeZone = tender.officialTimeZone;
        const columns: DataTableColumn<ComplianceBidRow>[] = [
          {
            id: 'supplierName',
            header: t('opening.columns.supplier'),
            sortable: true,
            cell: (row) => (
              <>
                <Link to={openingPaths.bid(row.bidId)}>{row.supplier.name}</Link>
                <span className="tiq-cell-sub tiq-mono">{row.receiptNo}</span>
                <span className="tiq-cell-sub">
                  {row.lots.length === 0
                    ? t('opening.lot.whole')
                    : row.lots
                        .map((lot) => t('opening.lot.short', { number: lot.lotNo }))
                        .join(', ')}
                </span>
              </>
            ),
          },
          {
            id: 'receivedAt',
            header: t('opening.columns.receivedAt'),
            sortable: true,
            cell: (row) => formatOfficialTime(row.receivedAt, timeZone),
          },
          {
            id: 'complianceStatus',
            header: t('opening.columns.compliance'),
            sortable: true,
            cell: (row) => (
              <StatusChip enum="bids.compliance_status" value={row.complianceStatus} />
            ),
          },
          {
            id: 'checks',
            header: t('opening.columns.checks'),
            cell: (row) => <CheckSummaryText row={row} />,
          },
          {
            id: 'clarifications',
            header: t('opening.columns.openClarifications'),
            numeric: true,
            cell: (row) => formatCount(row.openClarifications),
          },
          {
            id: 'exclusion',
            header: t('opening.columns.exclusion'),
            cell: (row) =>
              row.exclusion === null ? (
                <OrDash>{null}</OrDash>
              ) : (
                <Reference
                  value={tEnum('exclusions.status', row.exclusion.status)}
                  to={openingPaths.exclusion(row.exclusion.exclusionId)}
                />
              ),
          },
          {
            id: 'ranking',
            header: t('opening.columns.ranking'),
            cell: (row) => <RankingChip eligible={row.rankingEligible} />,
          },
          {
            id: 'envelopes',
            header: t('opening.columns.envelopes'),
            cell: (row) => <EnvelopeChips envelopes={row.envelopes} />,
          },
        ];

        return (
          <div className="tiq-page">
            <PageHeader
              title={t('opening.register.title', { reference: tender.reference })}
              subtitle={tender.title}
              back={back}
              actions={
                <ButtonLink to={openingPaths.tender(tender.tenderId)} icon="layers">
                  {t('opening.session.toTender')}
                </ButtonLink>
              }
              meta={
                <>
                  <StatusChip enum="tenders.status" value={tender.status} />
                  <Chip tone={PROGRESS_TONE[tender.progress]}>
                    {progressLabel(tender.progress)}
                  </Chip>
                  {tender.submissionDeadline !== null && (
                    <OfficialDeadline
                      deadline={tender.submissionDeadline}
                      label={t('opening.tender.deadline')}
                    />
                  )}
                </>
              }
            />
            <Banner tone="info" title={t('opening.register.rankingTitle')}>
              {t('opening.register.ranking')}
            </Banner>
            <RegisterKpis tenderId={tenderId} />
            <FilterBar onClear={list.clear} canClear={list.canClear}>
              <SearchField
                label={t('opening.filters.search')}
                placeholder={t('opening.filters.searchBids')}
                value={filters.q}
                onChange={(q) => list.update({ q })}
              />
              <Select
                label={t('opening.filters.compliance')}
                value={filters.complianceStatus}
                onChange={(complianceStatus) => list.update({ complianceStatus })}
                placeholder={t('opening.filters.allStatuses')}
                options={enumSelectOptions('bids.compliance_status')}
              />
              <Select
                label={t('opening.filters.submissionState')}
                value={filters.submissionState}
                onChange={(submissionState) => list.update({ submissionState })}
                placeholder={t('opening.filters.allStates')}
                options={enumSelectOptions('bids.submission_state', ['submitted', 'withdrawn'])}
              />
              {data.lots.length > 0 && (
                <Select
                  label={t('opening.filters.lot')}
                  value={filters.lotId}
                  onChange={(lotId) => list.update({ lotId })}
                  placeholder={t('opening.filters.allLots')}
                  options={data.lots.map((lot) => ({
                    value: String(lot.lotId),
                    label: t('opening.lot.label', { number: lot.lotNo, title: lot.title }),
                  }))}
                />
              )}
              <Select
                label={t('opening.filters.ranking')}
                value={filters.ranking}
                onChange={(ranking) => list.update({ ranking })}
                placeholder={t('opening.filters.allRanking')}
                options={[
                  { value: 'yes', label: t('opening.ranking.eligible') },
                  { value: 'no', label: t('opening.ranking.notRanked') },
                ]}
              />
            </FilterBar>
            <Card flush>
              <DataTable
                caption={t('opening.register.caption')}
                columns={columns}
                rows={query.data?.items}
                rowKey={(row) => String(row.bidId)}
                onRowClick={(row) => {
                  void navigate(openingPaths.bid(row.bidId));
                }}
                rowLabel={(row) => row.supplier.name}
                loading={query.isFetching}
                error={query.error}
                onRetry={query.reload}
                sort={list.sort}
                onSortChange={list.onSortChange}
                empty={<EmptyState compact icon="inbox" title={t('opening.register.none')} />}
                pagination={
                  query.data === undefined ? undefined : list.pagination(query.data.total)
                }
              />
            </Card>
          </div>
        );
      }}
    </LoadingFrame>
  );
}

export default function ComplianceRegisterPage() {
  const params = useParams();
  const tenderId = idParam(params.tenderId);
  if (tenderId === null) {
    return (
      <RecordNotFound
        title={t('opening.register.loadingTitle')}
        back={{ to: openingPaths.compliance, label: t('opening.compliance.back') }}
      />
    );
  }
  return <RegisterView key={tenderId} tenderId={tenderId} />;
}
