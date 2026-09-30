/**
 * BUY-17 Addenda and date changes: every addendum of the active buyer with its proposed change, affected lots,
 * materiality, approval, revised dates, recipients and acknowledgment status. A deadline changes only through an
 * issued addendum (BR-13, BR-16).
 */
import { useNavigate } from 'react-router';

import { clarificationsEndpoints } from '@contracts/clarifications';
import type { BuyerAddendumRow } from '@contracts/clarifications';
import type { AddendaMateriality, AddendaStatus } from '@contracts/enums';

import { useApiQuery } from '../../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../../app/hooks';
import { usePermission } from '../../../../auth/permissions';
import {
  ButtonLink,
  Card,
  Checkbox,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  OfficialDeadline,
  PageHeader,
  Reference,
  SearchField,
  Select,
  StatusChip,
} from '../../../../components/ui';
import type { DataTableSort } from '../../../../components/ui';
import { EMPTY_VALUE, formatCount, formatDateTime } from '../../../../lib/format';
import { t } from '../../../../lib/i18n';
import { BuyerTabs } from '../../components/BuyerTabs';
import { BuyerTenderSelect } from '../../components/BuyerTenderSelect';
import { ChangeAreaChips } from '../../components/shared';
import { useBuyerTenders } from '../../hooks';
import { QUESTION_PERMISSION, buyerPaths, enumOptions, lotsLabel } from '../../lib';

const DEFAULT_FILTERS = {
  tender: '',
  status: '',
  materiality: '',
  deadlineOnly: false,
  from: '',
  to: '',
  q: '',
  page: 1,
  sort: 'createdAt',
  dir: 'desc',
};

type SortField = 'number' | 'issuedAt' | 'status' | 'tenderReference' | 'createdAt';

export default function AddendaPage() {
  const navigate = useNavigate();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const canDraft = usePermission(QUESTION_PERMISSION);
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-17', DEFAULT_FILTERS);
  const tenders = useBuyerTenders();
  const tenderId = filters.tender === '' ? undefined : Number(filters.tender);

  const addenda = useApiQuery(clarificationsEndpoints.addendaList, {
    query: {
      page: filters.page,
      pageSize: 25,
      sort: filters.sort as SortField,
      dir: filters.dir as 'asc' | 'desc',
      ...(filters.q.trim() === '' ? {} : { q: filters.q.trim() }),
      ...(tenderId === undefined ? {} : { tenderId }),
      ...(filters.status === '' ? {} : { status: [filters.status as AddendaStatus] }),
      ...(filters.materiality === ''
        ? {}
        : { materiality: filters.materiality as AddendaMateriality }),
      ...(filters.deadlineOnly ? { changesDeadline: true } : {}),
      ...(filters.from === '' ? {} : { issuedFrom: filters.from }),
      ...(filters.to === '' ? {} : { issuedTo: filters.to }),
    },
  });

  const allTenders = tenders.data?.items;
  const scoped = (allTenders ?? []).filter(
    (tender) => tenderId === undefined || tender.tenderId === tenderId,
  );
  const sum = (pick: (row: (typeof scoped)[number]) => number): number | null =>
    allTenders === undefined ? null : scoped.reduce((total, row) => total + pick(row), 0);
  const update = (values: Partial<typeof DEFAULT_FILTERS>): void => {
    setFilters({ page: 1, ...values });
  };
  const canClear =
    filters.tender !== '' ||
    filters.status !== '' ||
    filters.materiality !== '' ||
    filters.deadlineOnly ||
    filters.from !== '' ||
    filters.to !== '' ||
    filters.q !== '';
  const sort: DataTableSort = { key: filters.sort, dir: filters.dir as 'asc' | 'desc' };

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('clarifications.addenda.title')}
        subtitle={t('clarifications.addenda.subtitle')}
        primaryAction={
          canDraft ? (
            <ButtonLink
              variant="primary"
              icon="plus"
              to={
                tenderId === undefined
                  ? buyerPaths.newAddendum
                  : `${buyerPaths.newAddendum}?tenderId=${tenderId}`
              }
            >
              {t('clarifications.addenda.new')}
            </ButtonLink>
          ) : undefined
        }
      />
      <BuyerTabs />

      <FilterBar onClear={clearFilters} canClear={canClear}>
        <BuyerTenderSelect
          tenders={allTenders}
          value={filters.tender}
          onChange={(value) => update({ tender: value })}
          placeholder={t('clarifications.filters.allTenders')}
        />
        <Select
          label={t('clarifications.filters.status')}
          value={filters.status}
          onChange={(value) => update({ status: value })}
          placeholder={t('clarifications.filters.allStatuses')}
          options={enumOptions('addenda.status')}
        />
        <Select
          label={t('clarifications.filters.materiality')}
          value={filters.materiality}
          onChange={(value) => update({ materiality: value })}
          placeholder={t('clarifications.filters.allMateriality')}
          options={enumOptions('addenda.materiality')}
        />
        <DateInput
          label={t('clarifications.filters.issuedFrom')}
          value={filters.from}
          onChange={(value) => update({ from: value })}
        />
        <DateInput
          label={t('clarifications.filters.issuedTo')}
          value={filters.to}
          onChange={(value) => update({ to: value })}
        />
        <SearchField
          label={t('clarifications.filters.search')}
          placeholder={t('clarifications.addenda.searchPlaceholder')}
          value={filters.q}
          onChange={(value) => update({ q: value })}
        />
        <Checkbox
          label={t('clarifications.filters.deadlineOnly')}
          checked={filters.deadlineOnly}
          onChange={(checked) => update({ deadlineOnly: checked })}
        />
      </FilterBar>

      <KpiGrid>
        <KpiCard
          label={t('clarifications.addenda.kpi.inProgress')}
          icon="edit"
          value={formatCount(sum((row) => row.addendaInProgress))}
          hint={t('clarifications.addenda.kpi.inProgressHint')}
        />
        <KpiCard
          label={t('clarifications.addenda.kpi.issued')}
          icon="send"
          tone="success"
          value={formatCount(sum((row) => row.issuedAddenda))}
          hint={t('clarifications.addenda.kpi.issuedHint')}
        />
        <KpiCard
          label={t('clarifications.addenda.kpi.pendingAck')}
          icon="clipboardCheck"
          tone="warning"
          value={formatCount(sum((row) => row.pendingAcknowledgments))}
          hint={t('clarifications.addenda.kpi.pendingAckHint')}
        />
        <KpiCard
          label={t('clarifications.addenda.kpi.escalations')}
          icon="messageQuestion"
          tone="info"
          value={formatCount(sum((row) => row.openQuestions))}
          hint={t('clarifications.addenda.kpi.escalationsHint')}
          to={buyerPaths.questions}
        />
      </KpiGrid>

      <Card flush title={t('clarifications.addenda.register')}>
        <DataTable<BuyerAddendumRow>
          caption={t('clarifications.addenda.register')}
          rows={addenda.data?.items}
          rowKey={(row) => String(row.id)}
          loading={addenda.isFetching}
          error={addenda.error}
          onRetry={addenda.reload}
          sort={sort}
          onSortChange={(next) => setFilters({ sort: next.key, dir: next.dir, page: 1 })}
          onRowClick={(row) => navigate(buyerPaths.addendum(row.id))}
          rowLabel={(row) =>
            t('clarifications.addenda.rowLabel', {
              no: row.number,
              reference: row.tender.reference,
            })
          }
          empty={
            <EmptyState
              compact
              icon="fileText"
              title={t('clarifications.addenda.empty')}
              description={t('clarifications.addenda.emptyHint')}
            />
          }
          pagination={
            addenda.data === undefined
              ? undefined
              : {
                  page: addenda.data.page,
                  pageSize: addenda.data.pageSize,
                  total: addenda.data.total,
                  onPageChange: (page) => setFilters({ page }),
                }
          }
          columns={[
            {
              id: 'number',
              header: t('clarifications.addenda.col.addendum'),
              sortable: true,
              cell: (row) => (
                <>
                  <Reference
                    value={t('clarifications.common.addendumNo', { no: row.number })}
                    to={buyerPaths.addendum(row.id)}
                  />
                  <div className="tiq-cell-sub">{row.title}</div>
                </>
              ),
            },
            {
              id: 'tenderReference',
              header: t('clarifications.addenda.col.tender'),
              sortable: true,
              cell: (row) => (
                <>
                  <Reference value={row.tender.reference} />
                  <div className="tiq-cell-sub">{lotsLabel(row.affectedLots)}</div>
                </>
              ),
            },
            {
              id: 'materiality',
              header: t('clarifications.addenda.col.materiality'),
              cell: (row) => (
                <div className="tiq-stack">
                  <StatusChip enum="addenda.materiality" value={row.materiality} size="sm" />
                  <ChangeAreaChips areas={row} />
                </div>
              ),
            },
            {
              id: 'deadline',
              header: t('clarifications.addenda.col.newDeadline'),
              cell: (row) =>
                row.newSubmissionDeadline === null ? (
                  <span className="tiq-text-muted">{t('clarifications.addenda.noDateChange')}</span>
                ) : (
                  <OfficialDeadline deadline={row.newSubmissionDeadline} showLocal={false} />
                ),
            },
            {
              id: 'existing',
              header: t('clarifications.addenda.col.existing'),
              cell: (row) => (
                <StatusChip
                  enum="addenda.existing_submission_action"
                  value={row.existingSubmissionAction}
                  size="sm"
                />
              ),
            },
            {
              id: 'approval',
              header: t('clarifications.addenda.col.approval'),
              cell: (row) =>
                row.approvalStatus === null ? (
                  <span className="tiq-text-muted">{t('clarifications.addenda.notRequested')}</span>
                ) : (
                  <StatusChip
                    enum="approval_requests.status"
                    value={row.approvalStatus}
                    size="sm"
                  />
                ),
            },
            {
              id: 'status',
              header: t('clarifications.addenda.col.status'),
              sortable: true,
              cell: (row) => <StatusChip enum="addenda.status" value={row.status} />,
            },
            {
              id: 'acknowledgments',
              header: t('clarifications.addenda.col.acknowledgments'),
              numeric: true,
              cell: (row) =>
                row.acknowledgments === null ? (
                  EMPTY_VALUE
                ) : (
                  <>
                    {t('clarifications.addenda.ackTally', {
                      acknowledged: row.acknowledgments.acknowledged,
                      recipients: row.acknowledgments.recipients,
                    })}
                    {row.acknowledgments.actionOutstanding > 0 && (
                      <div className="tiq-cell-sub tiq-text-warning">
                        {t('clarifications.addenda.outstanding', {
                          count: row.acknowledgments.actionOutstanding,
                        })}
                      </div>
                    )}
                  </>
                ),
            },
            {
              id: 'issuedAt',
              header: t('clarifications.addenda.col.issued'),
              sortable: true,
              cell: (row) =>
                row.issuedAt === null ? EMPTY_VALUE : formatDateTime(row.issuedAt, timeZone),
            },
          ]}
        />
      </Card>
    </div>
  );
}
