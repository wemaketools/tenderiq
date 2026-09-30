/**
 * SUP-18 — Assessment requests: the compliance questions, presentation, demonstration, reference and due-diligence
 * requests buyers issued to this supplier after opening, with their official deadlines and response history. Only
 * the supplier's own issued requests appear (never drafts, other suppliers or internal assessments). Appointments
 * (presentations, demonstrations, interviews) are confirmed on the selection feature's Assessment appointments
 * screen, which this page links to so SUP-18 reads as one flow.
 */
import { useNavigate } from 'react-router';

import { SUPPLIER_VISIBLE_CLARIFICATION_STATUSES, openingEndpoints } from '@contracts/opening';
import type { AssessmentRequestRow, SupplierClarificationStatus } from '@contracts/opening';
import type { BidClarificationsSource } from '@contracts/enums';

import { useActiveTenant } from '../../../app/hooks';
import { useApiQuery } from '../../../api/hooks';
import {
  Banner,
  ButtonLink,
  Card,
  DataTable,
  DateInput,
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
import { oneOf, textOrUndefined, useListState } from '../lib/listState';
import { enumSelectOptions } from '../lib/options';
import { openingPaths } from '../lib/paths';
import { selectionPaths } from '../../selection/lib/paths';

function Kpis() {
  const count = { page: 1, pageSize: 1 } as const;
  const open = useApiQuery(openingEndpoints.listAssessmentRequests, {
    query: { ...count, status: ['issued'] },
  });
  const responded = useApiQuery(openingEndpoints.listAssessmentRequests, {
    query: { ...count, status: ['responded', 'closed'] },
  });
  const expired = useApiQuery(openingEndpoints.listAssessmentRequests, {
    query: { ...count, status: ['expired'] },
  });
  const value = (total: number | undefined) =>
    total === undefined ? t('opening.kpi.loading') : formatCount(total);
  return (
    <KpiGrid>
      <KpiCard
        label={t('opening.supplier.kpi.open')}
        value={value(open.data?.total)}
        icon="hourglass"
        tone="warning"
        hint={t('opening.supplier.kpi.openHint')}
      />
      <KpiCard
        label={t('opening.supplier.kpi.responded')}
        value={value(responded.data?.total)}
        icon="checkCircle"
        tone="success"
      />
      <KpiCard
        label={t('opening.supplier.kpi.expired')}
        value={value(expired.data?.total)}
        icon="clock"
        tone="danger"
      />
    </KpiGrid>
  );
}

export default function AssessmentRequestsPage() {
  const navigate = useNavigate();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const list = useListState(
    'SUP-18',
    { q: '', status: '', source: '', dueFrom: '', dueTo: '' },
    { key: 'dueAt' as const, dir: 'asc' },
  );
  const { filters } = list;
  const query = useApiQuery(openingEndpoints.listAssessmentRequests, {
    query: {
      ...list.paging,
      q: textOrUndefined(filters.q),
      status: oneOf<SupplierClarificationStatus>(filters.status),
      source: oneOf<BidClarificationsSource>(filters.source),
      dueFrom: textOrUndefined(filters.dueFrom),
      dueTo: textOrUndefined(filters.dueTo),
    },
  });

  const columns: DataTableColumn<AssessmentRequestRow>[] = [
    {
      id: 'reference',
      header: t('opening.columns.reference'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference value={row.tenderReference} to={openingPaths.request(row.id)} />
          <span className="tiq-cell-sub">{row.buyer.name}</span>
        </>
      ),
    },
    {
      id: 'tender',
      header: t('opening.columns.tender'),
      cell: (row) => row.tenderTitle,
    },
    {
      id: 'source',
      header: t('opening.supplier.type'),
      cell: (row) => tEnum('bid_clarifications.source', row.source),
    },
    {
      id: 'question',
      header: t('opening.supplier.request'),
      cell: (row) => (row.question.length > 140 ? `${row.question.slice(0, 140)}…` : row.question),
    },
    {
      id: 'dueAt',
      header: t('opening.columns.due'),
      sortable: true,
      cell: (row) =>
        row.dueAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <OfficialDeadline deadline={row.dueAt} showLocal={false} />
        ),
    },
    {
      id: 'status',
      header: t('opening.columns.status'),
      sortable: true,
      cell: (row) => <StatusChip enum="bid_clarifications.status" value={row.status} />,
    },
    {
      id: 'responded',
      header: t('opening.supplier.responded'),
      cell: (row) =>
        row.respondedAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <>
            {row.respondedBy?.fullName ?? ''}
            <span className="tiq-cell-sub">{formatOfficialTime(row.respondedAt, timeZone)}</span>
          </>
        ),
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader title={t('opening.supplier.title')} subtitle={t('opening.supplier.subtitle')} />
      <Banner tone="info" title={t('opening.br22.title')}>
        {t('opening.br22.supplier')}
      </Banner>
      <Banner
        tone="info"
        title={t('opening.supplier.appointmentsTitle')}
        actions={
          <ButtonLink to={selectionPaths.supplierInvites} icon="calendar" size="sm">
            {t('opening.supplier.appointmentsLink')}
          </ButtonLink>
        }
      >
        {t('opening.supplier.appointments')}
      </Banner>
      <Kpis />
      <FilterBar onClear={list.clear} canClear={list.canClear}>
        <SearchField
          label={t('opening.filters.search')}
          placeholder={t('opening.filters.searchRequests')}
          value={filters.q}
          onChange={(q) => list.update({ q })}
        />
        <Select
          label={t('opening.filters.status')}
          value={filters.status}
          onChange={(status) => list.update({ status })}
          placeholder={t('opening.filters.allStatuses')}
          options={enumSelectOptions(
            'bid_clarifications.status',
            SUPPLIER_VISIBLE_CLARIFICATION_STATUSES,
          )}
        />
        <Select
          label={t('opening.supplier.type')}
          value={filters.source}
          onChange={(source) => list.update({ source })}
          placeholder={t('opening.filters.allTypes')}
          options={enumSelectOptions('bid_clarifications.source')}
        />
        <DateInput
          label={t('opening.filters.dueFrom')}
          value={filters.dueFrom}
          onChange={(dueFrom) => list.update({ dueFrom })}
        />
        <DateInput
          label={t('opening.filters.dueTo')}
          value={filters.dueTo}
          onChange={(dueTo) => list.update({ dueTo })}
        />
      </FilterBar>
      <Card flush>
        <DataTable
          caption={t('opening.supplier.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.id)}
          onRowClick={(row) => {
            void navigate(openingPaths.request(row.id));
          }}
          rowLabel={(row) => row.tenderReference}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={list.sort}
          onSortChange={list.onSortChange}
          empty={<EmptyState compact icon="inbox" title={t('opening.supplier.none')} />}
          pagination={query.data === undefined ? undefined : list.pagination(query.data.total)}
        />
      </Card>
    </div>
  );
}
