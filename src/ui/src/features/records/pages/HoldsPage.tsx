/**
 * ADM-14 — Legal and investigation holds (PRD §18.3, BR-40, AC-35): each hold with its record, type, scope, owner,
 * review date, the records it protects and the disposals it blocks. Records staff with records.hold.manage impose
 * holds; every other records role sees them read-only.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { HOLDS_SUBJECT_TYPE } from '@contracts/enums';
import {
  HOLD_SORT_FIELDS,
  HOLD_STATES,
  RECORDS_HOLD_TYPES,
  recordsEndpoints,
} from '@contracts/records';
import type { Hold } from '@contracts/records';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Button,
  Card,
  Chip,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  Select,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCalendarDate, formatCount, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useNow } from '../../../lib/useNow';
import { compact, idOf, oneOf } from '../../reports/lib/shared';
import { CreateHoldDialog } from '../components/CreateHoldDialog';
import { RecordsHeader } from '../components/RecordsHeader';
import { tomorrowOf } from '../lib/dates';
import { recordsPaths } from '../lib/permissions';

const DEFAULTS = {
  holdType: '',
  state: 'active',
  subjectType: '',
  owner: '',
  startedFrom: '',
  startedTo: '',
  sort: 'startedAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

export default function HoldsPage() {
  const navigate = useNavigate();
  const tenant = useActiveTenant();
  const now = useNow();
  const canManage = usePermission('records.hold.manage');
  const [filters, setFilters, clearFilters] = useScreenFilters('ADM-14:holds', DEFAULTS);
  const [creating, setCreating] = useState(false);
  const holdType = oneOf(filters.holdType, RECORDS_HOLD_TYPES);
  const state = oneOf(filters.state, HOLD_STATES);
  const subjectType = oneOf(filters.subjectType, HOLDS_SUBJECT_TYPE);
  const query = useApiQuery(recordsEndpoints.listHolds, {
    query: {
      ...compact({
        holdType: holdType === undefined ? undefined : [holdType],
        state: state === undefined ? undefined : [state],
        subjectType: subjectType === undefined ? undefined : [subjectType],
        ownerUserId: idOf(filters.owner),
        startedFrom: filters.startedFrom,
        startedTo: filters.startedTo,
      }),
      sort: oneOf(filters.sort, HOLD_SORT_FIELDS),
      dir: filters.dir === 'asc' ? 'asc' : 'desc',
      page: filters.page,
      pageSize: filters.pageSize,
    },
  });
  const data = query.data;
  const owners = new Map<number, string>();
  for (const row of data?.items ?? []) owners.set(row.owner.userId, row.owner.fullName);
  const filtered =
    (['holdType', 'subjectType', 'owner', 'startedFrom', 'startedTo'] as const).some(
      (key) => filters[key] !== '',
    ) || filters.state !== DEFAULTS.state;

  const columns: DataTableColumn<Hold>[] = [
    {
      id: 'subject',
      header: t('records.holds.col.record'),
      cell: (row) => (
        <>
          {row.subjectReference !== null && <span className="tiq-ref">{row.subjectReference}</span>}{' '}
          <span>{row.subjectLabel}</span>
          <span className="tiq-cell-sub">{row.scopeDescription}</span>
        </>
      ),
    },
    {
      id: 'holdType',
      header: t('records.holds.col.type'),
      sortable: true,
      cell: (row) => (
        <span className="tiq-inline">
          <Chip tone={row.holdType === 'legal_hold' ? 'warning' : 'info'} size="sm" icon="lock">
            {tEnum('holds.hold_type', row.holdType)}
          </Chip>
          <Chip tone={row.state === 'active' ? 'danger' : 'neutral'} size="sm" outlined>
            {t(`records.holds.states.${row.state}`)}
          </Chip>
        </span>
      ),
    },
    {
      id: 'owner',
      header: t('records.holds.col.owner'),
      cell: (row) => (
        <>
          <span>{row.owner.fullName}</span>
          <span className="tiq-cell-sub">{row.authorityNote}</span>
        </>
      ),
    },
    {
      id: 'startedAt',
      header: t('records.holds.col.started'),
      sortable: true,
      cell: (row) => formatDateTime(row.startedAt, tenant?.officialTimeZone ?? 'UTC'),
    },
    {
      id: 'reviewDate',
      header: t('records.holds.col.review'),
      sortable: true,
      cell: (row) =>
        row.state === 'released' ? (
          <span className="tiq-text-muted">
            {t('records.holds.releasedOn', {
              date:
                row.releasedAt === null
                  ? '—'
                  : formatDateTime(row.releasedAt, tenant?.officialTimeZone ?? 'UTC'),
            })}
          </span>
        ) : (
          <span className={row.reviewDue ? 'tiq-text-warning' : undefined}>
            {formatCalendarDate(row.reviewDate)}
            {row.reviewDue && ` · ${t('records.holds.reviewDue')}`}
          </span>
        ),
    },
    {
      id: 'records',
      header: t('records.holds.col.records'),
      numeric: true,
      cell: (row) => (
        <>
          <span>{formatCount(row.affectedRecordCount)}</span>
          <span className="tiq-cell-sub">
            {t('records.holds.blockedDisposals', { count: row.blockedDisposalCount })}
          </span>
        </>
      ),
    },
  ];

  return (
    <div className="tiq-page">
      <RecordsHeader
        subtitle={t('records.holds.intro')}
        primaryAction={
          canManage ? (
            <Button variant="primary" icon="lock" onClick={() => setCreating(true)}>
              {t('records.hold.create')}
            </Button>
          ) : undefined
        }
      />
      <FilterBar label={t('records.holds.filters')} onClear={clearFilters} canClear={filtered}>
        <Select
          label={t('records.holds.state')}
          value={filters.state}
          placeholder={t('records.all')}
          options={HOLD_STATES.map((value) => ({
            value,
            label: t(`records.holds.states.${value}`),
          }))}
          onChange={(value) => setFilters({ state: value, page: 1 })}
        />
        <Select
          label={t('records.holds.type')}
          value={filters.holdType}
          placeholder={t('records.all')}
          options={RECORDS_HOLD_TYPES.map((value) => ({
            value,
            label: tEnum('holds.hold_type', value),
          }))}
          onChange={(value) => setFilters({ holdType: value, page: 1 })}
        />
        <Select
          label={t('records.holds.subjectType')}
          value={filters.subjectType}
          placeholder={t('records.all')}
          options={HOLDS_SUBJECT_TYPE.map((value) => ({
            value,
            label: tEnum('holds.subject_type', value),
          }))}
          onChange={(value) => setFilters({ subjectType: value, page: 1 })}
        />
        <Select
          label={t('records.holds.owner')}
          value={filters.owner}
          placeholder={t('records.all')}
          options={[...owners.entries()].map(([id, name]) => ({ value: String(id), label: name }))}
          onChange={(value) => setFilters({ owner: value, page: 1 })}
        />
        <DateInput
          label={t('records.holds.startedFrom')}
          value={filters.startedFrom}
          onChange={(value) => setFilters({ startedFrom: value, page: 1 })}
        />
        <DateInput
          label={t('records.holds.startedTo')}
          value={filters.startedTo}
          onChange={(value) => setFilters({ startedTo: value, page: 1 })}
        />
      </FilterBar>
      <Card
        flush
        title={t('records.holds.title')}
        subtitle={data === undefined ? undefined : t('records.holds.count', { count: data.total })}
      >
        <DataTable
          caption={t('records.holds.title')}
          columns={columns}
          rows={data?.items}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => t('records.holds.openNamed', { subject: row.subjectLabel })}
          onRowClick={(row) => void navigate(recordsPaths.hold(row.id))}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={{ key: filters.sort, dir: filters.dir === 'asc' ? 'asc' : 'desc' }}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={<EmptyState compact icon="unlock" title={t('records.holds.empty')} />}
          pagination={
            data === undefined
              ? undefined
              : {
                  page: data.page,
                  pageSize: data.pageSize,
                  total: data.total,
                  onPageChange: (page) => setFilters({ page }),
                  onPageSizeChange: (pageSize) => setFilters({ pageSize, page: 1 }),
                }
          }
        />
      </Card>
      <CreateHoldDialog
        open={creating}
        onClose={() => setCreating(false)}
        minReviewDate={tomorrowOf(now)}
        onCreated={() => setCreating(false)}
      />
    </div>
  );
}
