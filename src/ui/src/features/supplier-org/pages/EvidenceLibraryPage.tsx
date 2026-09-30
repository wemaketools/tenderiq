/**
 * SUP-05 — Evidence library: certificates, statements, licences, references, insurance and declarations with their
 * issuer, reporting period, expiry and sharing audiences. Add, replace prospectively, renew, withdraw future sharing;
 * each item shows where an edition was formally submitted. Financial evidence is withheld from members without
 * `supplier.financial.view` (PRD §4.3): the list says so instead of showing a misleading total.
 */
import { useNavigate } from 'react-router';

import {
  EVIDENCE_ITEMS_EVIDENCE_TYPE,
  EVIDENCE_ITEMS_SENSITIVITY,
  EVIDENCE_ITEMS_STATUS,
} from '@contracts/enums';
import { EVIDENCE_FRESHNESS, EVIDENCE_SORT_FIELDS, suppliersEndpoints } from '@contracts/suppliers';
import type { EvidenceItem } from '@contracts/suppliers';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  ButtonLink,
  Card,
  Checkbox,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  MoneyText,
  OrDash,
  PageHeader,
  SearchField,
  Select,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCalendarDate, formatCount } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { FreshnessChip } from '../components/SupplierBits';
import { compact, dateOf, directionOf, idOf, oneOf, sortOf, tableSort } from '../lib/lists';
import { supplierOrgPaths } from '../lib/paths';
import { EVIDENCE_MANAGE, PROFILE_READ } from '../lib/permissions';

const DEFAULTS = {
  q: '',
  evidenceType: '',
  status: '',
  freshness: '',
  sensitivity: '',
  buyer: '',
  createdBy: '',
  expiresFrom: '',
  expiresTo: '',
  includeHistory: false,
  sort: 'expiresAt',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

export default function EvidenceLibraryPage() {
  const navigate = useNavigate();
  const canManage = usePermission(EVIDENCE_MANAGE);
  const canReadProfile = usePermission(PROFILE_READ);
  const [filters, setFilters, clearFilters] = useScreenFilters('SUP-05', DEFAULTS);
  const buyers = useApiQuery(suppliersEndpoints.sharingBuyers, {});
  const profile = useApiQuery(suppliersEndpoints.getProfile, canReadProfile ? {} : null);

  const query = useApiQuery(suppliersEndpoints.listEvidence, {
    query: compact({
      q: filters.q.trim(),
      evidenceType: oneOf(filters.evidenceType, EVIDENCE_ITEMS_EVIDENCE_TYPE),
      status: oneOf(filters.status, EVIDENCE_ITEMS_STATUS),
      freshness: oneOf(filters.freshness, EVIDENCE_FRESHNESS),
      sensitivity: oneOf(filters.sensitivity, EVIDENCE_ITEMS_SENSITIVITY),
      sharedWithBuyerId: idOf(filters.buyer),
      createdBy: idOf(filters.createdBy),
      expiresFrom: dateOf(filters.expiresFrom),
      expiresTo: dateOf(filters.expiresTo),
      includeHistory: filters.includeHistory ? true : undefined,
      sort: sortOf(filters.sort, EVIDENCE_SORT_FIELDS, 'expiresAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const data = query.data;
  const filtered =
    filters.q !== '' ||
    filters.evidenceType !== '' ||
    filters.status !== '' ||
    filters.freshness !== '' ||
    filters.sensitivity !== '' ||
    filters.buyer !== '' ||
    filters.createdBy !== '' ||
    filters.expiresFrom !== '' ||
    filters.expiresTo !== '' ||
    filters.includeHistory;

  const columns: DataTableColumn<EvidenceItem>[] = [
    {
      id: 'title',
      header: t('supplier-org.evidence.col.title'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.title}</span>
          <span className="tiq-cell-sub">
            {[row.issuer, row.referenceNumber].filter((part) => part !== null).join(' · ')}
          </span>
        </>
      ),
    },
    {
      id: 'evidenceType',
      header: t('supplier-org.evidence.col.type'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{tEnum('evidence_items.evidence_type', row.evidenceType)}</span>
          {row.sensitivity !== 'general' && (
            <span className="tiq-cell-sub">
              <StatusChip enum="evidence_items.sensitivity" value={row.sensitivity} size="sm" />
            </span>
          )}
        </>
      ),
    },
    {
      id: 'period',
      header: t('supplier-org.evidence.col.period'),
      cell: (row) =>
        row.periodStart !== null && row.periodEnd !== null ? (
          t('supplier-org.evidence.range', {
            from: formatCalendarDate(row.periodStart),
            to: formatCalendarDate(row.periodEnd),
          })
        ) : row.coverage !== null ? (
          <MoneyText value={row.coverage} />
        ) : (
          <OrDash>{null}</OrDash>
        ),
    },
    {
      id: 'expiresAt',
      header: t('supplier-org.evidence.col.expires'),
      sortable: true,
      cell: (row) => (
        <span className="tiq-stack">
          <span>
            {row.expiresAt === null
              ? t('supplier-org.evidence.noExpiry')
              : formatCalendarDate(row.expiresAt)}
          </span>
          <FreshnessChip value={row.freshness} size="sm" />
        </span>
      ),
    },
    {
      id: 'status',
      header: t('supplier-org.evidence.col.status'),
      sortable: true,
      cell: (row) => (
        <span className="tiq-stack">
          <StatusChip enum="evidence_items.status" value={row.status} />
          <span className="tiq-cell-sub">
            {tEnum('evidence_items.verification_status', row.verificationStatus)}
          </span>
        </span>
      ),
    },
    {
      id: 'sharing',
      header: t('supplier-org.evidence.col.sharing'),
      cell: (row) =>
        row.activeShares.length === 0 ? (
          <span className="tiq-text-muted">{t('supplier-org.evidence.notShared')}</span>
        ) : (
          row.activeShares.map((share) => share.buyer.tenantName).join(', ')
        ),
    },
    {
      id: 'submissions',
      header: t('supplier-org.evidence.col.submissions'),
      numeric: true,
      cell: (row) => formatCount(row.submissionCount),
    },
    {
      id: 'edition',
      header: t('supplier-org.evidence.col.edition'),
      numeric: true,
      cell: (row) => t('supplier-org.evidence.editionNo', { no: row.editionNo }),
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('supplier-org.evidence.title')}
        subtitle={t('supplier-org.evidence.intro')}
        primaryAction={
          canManage ? (
            <ButtonLink to={supplierOrgPaths.newEvidence} variant="primary" icon="plus">
              {t('supplier-org.evidence.add')}
            </ButtonLink>
          ) : undefined
        }
      />
      <FilterBar
        onClear={clearFilters}
        canClear={filtered}
        label={t('supplier-org.evidence.filters')}
      >
        <Select
          label={t('supplier-org.evidence.filter.type')}
          placeholder={t('supplier-org.common.allTypes')}
          value={filters.evidenceType}
          options={EVIDENCE_ITEMS_EVIDENCE_TYPE.map((value) => ({
            value,
            label: tEnum('evidence_items.evidence_type', value),
          }))}
          onChange={(evidenceType) => setFilters({ evidenceType, page: 1 })}
        />
        <Select
          label={t('supplier-org.evidence.filter.status')}
          placeholder={t('supplier-org.common.allStatuses')}
          value={filters.status}
          options={EVIDENCE_ITEMS_STATUS.map((value) => ({
            value,
            label: tEnum('evidence_items.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <Select
          label={t('supplier-org.evidence.filter.freshness')}
          placeholder={t('supplier-org.common.all')}
          value={filters.freshness}
          options={EVIDENCE_FRESHNESS.map((value) => ({
            value,
            label: t(`supplier-org.freshness.${value}`),
          }))}
          onChange={(freshness) => setFilters({ freshness, page: 1 })}
        />
        <Select
          label={t('supplier-org.evidence.filter.sensitivity')}
          placeholder={t('supplier-org.common.all')}
          value={filters.sensitivity}
          options={EVIDENCE_ITEMS_SENSITIVITY.map((value) => ({
            value,
            label: tEnum('evidence_items.sensitivity', value),
          }))}
          onChange={(sensitivity) => setFilters({ sensitivity, page: 1 })}
        />
        <Select
          label={t('supplier-org.evidence.filter.buyer')}
          placeholder={t('supplier-org.evidence.filter.anyBuyer')}
          value={filters.buyer}
          options={(buyers.data?.items ?? []).map((row) => ({
            value: String(row.buyer.tenantId),
            label: row.buyer.tenantName,
          }))}
          onChange={(buyer) => setFilters({ buyer, page: 1 })}
        />
        {profile.data !== undefined && (
          <Select
            label={t('supplier-org.evidence.filter.owner')}
            placeholder={t('supplier-org.evidence.filter.anyone')}
            value={filters.createdBy}
            options={profile.data.memberOptions.map((person) => ({
              value: String(person.userId),
              label: person.fullName,
            }))}
            onChange={(createdBy) => setFilters({ createdBy, page: 1 })}
          />
        )}
        <DateInput
          label={t('supplier-org.evidence.filter.expiresFrom')}
          value={filters.expiresFrom}
          onChange={(expiresFrom) => setFilters({ expiresFrom, page: 1 })}
        />
        <DateInput
          label={t('supplier-org.evidence.filter.expiresTo')}
          value={filters.expiresTo}
          onChange={(expiresTo) => setFilters({ expiresTo, page: 1 })}
        />
        <SearchField
          label={t('supplier-org.common.search')}
          placeholder={t('supplier-org.evidence.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Checkbox
          label={t('supplier-org.evidence.filter.history')}
          checked={filters.includeHistory}
          onChange={(includeHistory) => setFilters({ includeHistory, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('supplier-org.evidence.kpi.current')}
          icon="checkCircle"
          tone="success"
          value={data === undefined ? '…' : formatCount(data.summary.current)}
          hint={t('supplier-org.evidence.kpi.currentHint')}
        />
        <KpiCard
          label={t('supplier-org.evidence.kpi.expiring')}
          icon="hourglass"
          tone="warning"
          value={data === undefined ? '…' : formatCount(data.summary.expiringSoon)}
          hint={t('supplier-org.evidence.kpi.expiringHint')}
        />
        <KpiCard
          label={t('supplier-org.evidence.kpi.expired')}
          icon="alertTriangle"
          tone="danger"
          value={data === undefined ? '…' : formatCount(data.summary.expired)}
          hint={t('supplier-org.evidence.kpi.expiredHint')}
        />
        <KpiCard
          label={t('supplier-org.evidence.kpi.withdrawn')}
          icon="archive"
          tone="info"
          value={data === undefined ? '…' : formatCount(data.summary.withdrawn)}
          hint={t('supplier-org.evidence.kpi.withdrawnHint')}
        />
      </KpiGrid>
      {data?.financialRestricted === true && (
        <Banner tone="info" title={t('supplier-org.evidence.financialRestrictedTitle')}>
          <p>{t('supplier-org.evidence.financialRestricted')}</p>
        </Banner>
      )}
      <Card flush>
        <DataTable
          caption={t('supplier-org.evidence.caption')}
          columns={columns}
          rows={data?.items}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => row.title}
          onRowClick={(row) => void navigate(supplierOrgPaths.evidenceItem(row.id))}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={
                filtered
                  ? t('supplier-org.evidence.emptyFiltered')
                  : t('supplier-org.evidence.empty')
              }
              description={filtered ? undefined : t('supplier-org.evidence.emptyHint')}
            />
          }
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
    </div>
  );
}
