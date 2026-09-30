/**
 * BUY-31 — Supplier directory: supplier identities, categories, this buyer's relationship and contacts, qualification
 * scope, restrictions, contracts and evidence freshness (from evidence shared with THIS buyer only, BR-45). Search,
 * invite a supplier, request qualification, flag duplicates and open authorized relationship records.
 */
import { useState } from 'react';

import {
  BUYER_SUPPLIER_RELATIONSHIPS_RISK_RATING,
  BUYER_SUPPLIER_RELATIONSHIPS_STATUS,
  TENANTS_VERIFICATION_STATUS,
  V_QUALIFICATION_STATUS_EFFECTIVE_STATUS,
} from '@contracts/enums';
import {
  DIRECTORY_SORT_FIELDS,
  EVIDENCE_FRESHNESS,
  suppliersEndpoints,
} from '@contracts/suppliers';
import type { DirectoryRow } from '@contracts/suppliers';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  IconButton,
  KpiCard,
  KpiGrid,
  Menu,
  MoneyText,
  OrDash,
  PageHeader,
  SearchField,
  Select,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn, MenuEntry } from '../../../components/ui';
import { formatCalendarDate, formatCount } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useCreateParam } from '../../../lib/useCreateParam';
import { CategoryChips, FreshnessChip } from '../../supplier-org/components/SupplierBits';
import {
  booleanOf,
  compact,
  dateOf,
  directionOf,
  idOf,
  oneOf,
  sortOf,
  tableSort,
} from '../../supplier-org/lib/lists';
import { categoryChoices } from '../../supplier-org/lib/organizationForm';
import {
  FlagDuplicateDialog,
  InviteSupplierDialog,
  RequestQualificationDialog,
} from '../components/SupplierActionDialogs';
import type { SupplierRef } from '../components/SupplierActionDialogs';
import { directoryPaths } from '../lib/paths';

const RELATIONSHIP_FILTER = [...BUYER_SUPPLIER_RELATIONSHIPS_STATUS, 'none'] as const;

const DEFAULTS = {
  q: '',
  category: '',
  relationshipStatus: '',
  qualificationStatus: '',
  riskRating: '',
  evidenceFreshness: '',
  verificationStatus: '',
  owner: '',
  hasContracts: '',
  provisionalOnly: false,
  engagedFrom: '',
  engagedTo: '',
  sort: 'legalName',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

/** The first sentence of a restriction note (the full note is on the record and in the tooltip). */
function firstSentence(text: string): string {
  const end = text.indexOf('. ');
  return end === -1 ? text : text.slice(0, end + 1);
}

type Dialog =
  | { readonly kind: 'qualify'; readonly supplier: SupplierRef }
  | { readonly kind: 'flag'; readonly supplier: SupplierRef }
  | null;

export default function SupplierDirectoryPage() {
  const canManage = usePermission('supplier.relationship.manage');
  const canFlag = usePermission('supplier.duplicates.review');
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-31', DEFAULTS);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [inviteRequested, setInviting] = useCreateParam();
  const inviting = canManage && inviteRequested;
  const [outcome, setOutcome] = useState<string | null>(null);
  const categories = useApiQuery(suppliersEndpoints.categoryOptions, {});

  const query = useApiQuery(suppliersEndpoints.listDirectory, {
    query: compact({
      q: filters.q.trim(),
      category: filters.category === '' ? undefined : [filters.category],
      relationshipStatus: oneOf(filters.relationshipStatus, RELATIONSHIP_FILTER),
      qualificationStatus: oneOf(
        filters.qualificationStatus,
        V_QUALIFICATION_STATUS_EFFECTIVE_STATUS,
      ),
      riskRating: oneOf(filters.riskRating, BUYER_SUPPLIER_RELATIONSHIPS_RISK_RATING),
      evidenceFreshness: oneOf(filters.evidenceFreshness, EVIDENCE_FRESHNESS),
      verificationStatus: oneOf(filters.verificationStatus, TENANTS_VERIFICATION_STATUS),
      ownerUserId: idOf(filters.owner),
      hasContracts: booleanOf(filters.hasContracts),
      provisionalOnly: filters.provisionalOnly ? true : undefined,
      engagedFrom: dateOf(filters.engagedFrom),
      engagedTo: dateOf(filters.engagedTo),
      sort: sortOf(filters.sort, DIRECTORY_SORT_FIELDS, 'legalName'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const data = query.data;
  const filtered =
    filters.q !== '' ||
    filters.category !== '' ||
    filters.relationshipStatus !== '' ||
    filters.qualificationStatus !== '' ||
    filters.riskRating !== '' ||
    filters.evidenceFreshness !== '' ||
    filters.verificationStatus !== '' ||
    filters.owner !== '' ||
    filters.hasContracts !== '' ||
    filters.provisionalOnly ||
    filters.engagedFrom !== '' ||
    filters.engagedTo !== '';

  const refOf = (row: DirectoryRow): SupplierRef => ({
    supplierTenantId: row.supplierTenantId,
    legalName: row.legalName,
  });

  const rowMenu = (row: DirectoryRow): MenuEntry[] => [
    {
      kind: 'link',
      id: 'open',
      label: t('supplier-directory.list.open'),
      icon: 'externalLink',
      to: directoryPaths.record(row.supplierTenantId),
    },
    ...(canManage
      ? [
          {
            id: 'qualify',
            label: t('supplier-directory.list.requestQualification'),
            icon: 'clipboardCheck' as const,
            onSelect: () => setDialog({ kind: 'qualify', supplier: refOf(row) }),
          },
        ]
      : []),
    ...(canFlag
      ? [
          {
            id: 'flag',
            label: t('supplier-directory.list.flagDuplicate'),
            icon: 'flag' as const,
            onSelect: () => setDialog({ kind: 'flag', supplier: refOf(row) }),
          },
        ]
      : []),
  ];

  const columns: DataTableColumn<DirectoryRow>[] = [
    {
      id: 'legalName',
      header: t('supplier-directory.list.col.supplier'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.legalName}</span>
          <span className="tiq-cell-sub">
            {[row.tradingName, row.country].filter((part) => part !== null).join(' · ')}
          </span>
          <span className="tiq-inline">
            {row.isProvisional && (
              <Chip tone="info" size="sm">
                {t('supplier-directory.list.provisional')}
              </Chip>
            )}
            {row.duplicateFlagged && (
              <Chip tone="warning" size="sm" icon="flag">
                {t('supplier-directory.list.flagged')}
              </Chip>
            )}
            <StatusChip
              enum="tenants.verification_status"
              value={row.verificationStatus}
              size="sm"
            />
          </span>
          {row.primaryContact !== null && (
            <span className="tiq-cell-sub">
              {t('supplier-directory.list.contactIs', {
                contact: [
                  row.primaryContact.name,
                  row.primaryContact.email,
                  row.primaryContact.phone,
                ]
                  .filter((part) => part !== null)
                  .join(' · '),
              })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'categories',
      header: t('supplier-directory.list.col.categories'),
      cell: (row) => <CategoryChips categories={row.categories} />,
    },
    {
      id: 'relationshipStatus',
      header: t('supplier-directory.list.col.relationship'),
      sortable: true,
      cell: (row) =>
        row.relationship === null ? (
          <span className="tiq-text-muted">{t('supplier-directory.list.noRelationship')}</span>
        ) : (
          <span className="tiq-stack">
            <StatusChip
              enum="buyer_supplier_relationships.status"
              value={row.relationship.status}
            />
            <span className="tiq-cell-sub">
              {t('supplier-directory.list.contractCount', {
                count: row.contractCount,
                formatted: formatCount(row.contractCount),
              })}
            </span>
            <span className="tiq-cell-sub">
              {t('supplier-directory.list.ownerIs', {
                name: row.relationship.owner?.fullName ?? t('supplier-directory.list.unassigned'),
              })}
            </span>
            {row.relationship.restrictionNote !== null && (
              <span
                className="tiq-cell-sub tiq-text-danger"
                title={row.relationship.restrictionNote}
              >
                {firstSentence(row.relationship.restrictionNote)}
              </span>
            )}
          </span>
        ),
    },
    {
      id: 'riskRating',
      header: t('supplier-directory.list.col.risk'),
      sortable: true,
      cell: (row) =>
        row.relationship === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <StatusChip
            enum="buyer_supplier_relationships.risk_rating"
            value={row.relationship.riskRating}
          />
        ),
    },
    {
      id: 'qualification',
      header: t('supplier-directory.list.col.qualification'),
      cell: (row) =>
        row.qualification.length === 0 ? (
          <StatusChip enum="v_qualification_status.effective_status" value="not_assessed" />
        ) : (
          <span className="tiq-stack">
            {row.qualification.map((scope) => (
              <span key={scope.programId} className="tiq-stack">
                <StatusChip
                  enum="v_qualification_status.effective_status"
                  value={scope.effectiveStatus}
                  size="sm"
                />
                <span className="tiq-cell-sub">
                  {scope.programName}
                  {scope.scopeMaxValue !== null && (
                    <>
                      {' · '}
                      {t('supplier-directory.list.upTo')}{' '}
                      <MoneyText value={scope.scopeMaxValue} compact />
                    </>
                  )}
                </span>
              </span>
            ))}
          </span>
        ),
    },
    {
      id: 'nextEvidenceExpiry',
      header: t('supplier-directory.list.col.evidence'),
      sortable: true,
      cell: (row) =>
        row.evidence.sharedCount === 0 ? (
          <span className="tiq-text-muted">{t('supplier-directory.list.noSharedEvidence')}</span>
        ) : (
          <span className="tiq-stack">
            {row.evidence.worst !== null && <FreshnessChip value={row.evidence.worst} size="sm" />}
            <span className="tiq-cell-sub">
              {t('supplier-directory.list.evidenceSummary', {
                shared: row.evidence.sharedCount,
                expiring: row.evidence.expiringSoonCount,
                expired: row.evidence.expiredCount,
              })}
            </span>
            {row.evidence.nextExpiry !== null && (
              <span className="tiq-cell-sub">
                {t('supplier-directory.list.nextExpiry', {
                  date: formatCalendarDate(row.evidence.nextExpiry),
                })}
              </span>
            )}
          </span>
        ),
    },
    {
      id: 'actions',
      header: t('supplier-directory.list.col.actions'),
      cell: (row) => (
        <Menu
          label={t('supplier-directory.list.actionsFor', { name: row.legalName })}
          entries={rowMenu(row)}
          trigger={(props) => (
            <IconButton
              {...props}
              icon="moreHorizontal"
              variant="ghost"
              size="sm"
              label={t('supplier-directory.list.actionsFor', { name: row.legalName })}
            />
          )}
        />
      ),
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('supplier-directory.list.title')}
        subtitle={t('supplier-directory.list.intro')}
      />
      <FilterBar
        onClear={clearFilters}
        canClear={filtered}
        label={t('supplier-directory.list.filters')}
      >
        <Select
          label={t('supplier-directory.list.filter.category')}
          placeholder={t('supplier-directory.list.filter.allCategories')}
          value={filters.category}
          options={categoryChoices(categories.data?.items ?? [])}
          onChange={(category) => setFilters({ category, page: 1 })}
        />
        <Select
          label={t('supplier-directory.list.filter.relationship')}
          placeholder={t('supplier-org.common.allStatuses')}
          value={filters.relationshipStatus}
          options={RELATIONSHIP_FILTER.map((value) => ({
            value,
            label:
              value === 'none'
                ? t('supplier-directory.list.noRelationship')
                : tEnum('buyer_supplier_relationships.status', value),
          }))}
          onChange={(relationshipStatus) => setFilters({ relationshipStatus, page: 1 })}
        />
        <Select
          label={t('supplier-directory.list.filter.qualification')}
          placeholder={t('supplier-org.common.allStatuses')}
          value={filters.qualificationStatus}
          options={V_QUALIFICATION_STATUS_EFFECTIVE_STATUS.map((value) => ({
            value,
            label: tEnum('v_qualification_status.effective_status', value),
          }))}
          onChange={(qualificationStatus) => setFilters({ qualificationStatus, page: 1 })}
        />
        <Select
          label={t('supplier-directory.list.filter.risk')}
          placeholder={t('supplier-org.common.all')}
          value={filters.riskRating}
          options={BUYER_SUPPLIER_RELATIONSHIPS_RISK_RATING.map((value) => ({
            value,
            label: tEnum('buyer_supplier_relationships.risk_rating', value),
          }))}
          onChange={(riskRating) => setFilters({ riskRating, page: 1 })}
        />
        <Select
          label={t('supplier-directory.list.filter.evidence')}
          placeholder={t('supplier-org.common.all')}
          value={filters.evidenceFreshness}
          options={EVIDENCE_FRESHNESS.map((value) => ({
            value,
            label: t(`supplier-org.freshness.${value}`),
          }))}
          onChange={(evidenceFreshness) => setFilters({ evidenceFreshness, page: 1 })}
        />
        <Select
          label={t('supplier-directory.list.filter.verification')}
          placeholder={t('supplier-org.common.all')}
          value={filters.verificationStatus}
          options={TENANTS_VERIFICATION_STATUS.map((value) => ({
            value,
            label: tEnum('tenants.verification_status', value),
          }))}
          onChange={(verificationStatus) => setFilters({ verificationStatus, page: 1 })}
        />
        <Select
          label={t('supplier-directory.list.filter.owner')}
          placeholder={t('supplier-directory.list.filter.allOwners')}
          value={filters.owner}
          options={(data?.ownerOptions ?? []).map((person) => ({
            value: String(person.userId),
            label: person.fullName,
          }))}
          onChange={(owner) => setFilters({ owner, page: 1 })}
        />
        <Select
          label={t('supplier-directory.list.filter.contracts')}
          placeholder={t('supplier-org.common.all')}
          value={filters.hasContracts}
          options={[
            { value: 'yes', label: t('supplier-directory.list.filter.withContracts') },
            { value: 'no', label: t('supplier-directory.list.filter.withoutContracts') },
          ]}
          onChange={(hasContracts) => setFilters({ hasContracts, page: 1 })}
        />
        <DateInput
          label={t('supplier-directory.list.filter.engagedFrom')}
          value={filters.engagedFrom}
          onChange={(engagedFrom) => setFilters({ engagedFrom, page: 1 })}
        />
        <DateInput
          label={t('supplier-directory.list.filter.engagedTo')}
          value={filters.engagedTo}
          onChange={(engagedTo) => setFilters({ engagedTo, page: 1 })}
        />
        <SearchField
          label={t('supplier-org.common.search')}
          placeholder={t('supplier-directory.list.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Checkbox
          label={t('supplier-directory.list.filter.provisional')}
          checked={filters.provisionalOnly}
          onChange={(provisionalOnly) => setFilters({ provisionalOnly, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('supplier-directory.list.kpi.active')}
          icon="handshake"
          value={data === undefined ? '…' : formatCount(data.summary.active)}
          hint={t('supplier-directory.list.kpi.activeHint')}
        />
        <KpiCard
          label={t('supplier-directory.list.kpi.qualified')}
          icon="shieldCheck"
          tone="success"
          value={data === undefined ? '…' : formatCount(data.summary.qualified)}
          hint={t('supplier-directory.list.kpi.qualifiedHint')}
        />
        <KpiCard
          label={t('supplier-directory.list.kpi.restricted')}
          icon="ban"
          tone="danger"
          value={data === undefined ? '…' : formatCount(data.summary.restrictedOrSuspended)}
          hint={t('supplier-directory.list.kpi.restrictedHint')}
        />
        <KpiCard
          label={t('supplier-directory.list.kpi.evidence')}
          icon="hourglass"
          tone="warning"
          value={data === undefined ? '…' : formatCount(data.summary.evidenceExpiring)}
          hint={t('supplier-directory.list.kpi.evidenceHint')}
        />
      </KpiGrid>
      {outcome !== null && (
        <Banner
          tone="success"
          title={t('supplier-directory.list.doneTitle')}
          actions={
            <Button size="sm" onClick={() => setOutcome(null)}>
              {t('ui.action.dismiss')}
            </Button>
          }
        >
          <p>{outcome}</p>
        </Banner>
      )}
      <Card flush>
        <DataTable
          caption={t('supplier-directory.list.caption')}
          columns={columns}
          rows={data?.items}
          rowKey={(row) => String(row.supplierTenantId)}
          rowLabel={(row) => row.legalName}
          rowHref={(row) => directoryPaths.record(row.supplierTenantId)}
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
                  ? t('supplier-directory.list.emptyFiltered')
                  : t('supplier-directory.list.empty')
              }
              description={filtered ? undefined : t('supplier-directory.list.emptyHint')}
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
      <p className="tiq-text-muted">{t('supplier-directory.list.segregation')}</p>
      {inviting && (
        <InviteSupplierDialog
          onClose={() => setInviting(false)}
          onDone={(message) => {
            setInviting(false);
            setOutcome(message);
          }}
        />
      )}
      {dialog?.kind === 'qualify' && (
        <RequestQualificationDialog
          supplier={dialog.supplier}
          onClose={() => setDialog(null)}
          onDone={(message) => {
            setDialog(null);
            setOutcome(message);
          }}
        />
      )}
      {dialog?.kind === 'flag' && (
        <FlagDuplicateDialog
          supplier={dialog.supplier}
          onClose={() => setDialog(null)}
          onDone={(message) => {
            setDialog(null);
            setOutcome(message);
          }}
        />
      )}
    </div>
  );
}
