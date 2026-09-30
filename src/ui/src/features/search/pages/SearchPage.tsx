/**
 * COM-08 — Global search and saved views (FR-21, PRD §11.1, BR-43, DD-21). Searches the authorized tenders,
 * requests, suppliers, tasks, contracts and documents of every active membership. Each result is labelled with its
 * organization; opening a result of another organization first switches to it (after a confirmation). The counts
 * by type and organization are counts of authorized results only: restricted records are never revealed.
 */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import type { JsonObject } from '@contracts/common';
import { SEARCH_RESULT_TYPES, reportingEndpoints } from '@contracts/reporting';
import type { SavedView, SearchResult, SearchResultType } from '@contracts/reporting';

import { useApiQuery } from '../../../api/hooks';
import {
  useActiveTenant,
  useAppDispatch,
  useMemberships,
  useScreenFilters,
} from '../../../app/hooks';
import { selectTenant } from '../../../app/sessionActions';
import {
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  PageHeader,
  Reference,
  SearchField,
  Select,
  StatusChip,
  formErrors,
} from '../../../components/ui';
import type { DataTableColumn, DataTableSort } from '../../../components/ui';
import { formatCount, formatInstantDate } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { compact, idOf, oneOf } from '../../reports/lib/shared';
import { DeleteViewDialog, SaveViewDialog } from '../components/SavedViews';

const DEFAULTS = {
  type: '',
  tenant: '',
  updatedFrom: '',
  updatedTo: '',
  sort: 'relevance',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

const SORTS = ['relevance', 'updatedAt', 'title'] as const;

const TYPE_ICON: Readonly<
  Record<
    SearchResultType,
    'fileText' | 'inbox' | 'building' | 'checkSquare' | 'fileSignature' | 'file' | 'users'
  >
> = {
  tender: 'fileText',
  request: 'inbox',
  supplier: 'building',
  task: 'checkSquare',
  contract: 'fileSignature',
  document: 'file',
  organization: 'users',
};

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  return (
    <SearchWorkspace
      key={urlQuery}
      urlQuery={urlQuery}
      onSearch={(q) => setParams(q === '' ? {} : { q })}
    />
  );
}

function SearchWorkspace({
  urlQuery,
  onSearch,
}: {
  readonly urlQuery: string;
  readonly onSearch: (q: string) => void;
}) {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const tenant = useActiveTenant();
  const memberships = useMemberships().filter((membership) => membership.status === 'active');
  const [text, setText] = useState(urlQuery);
  const [filters, setFilters, clearFilters] = useScreenFilters('COM-08', DEFAULTS);
  const [opening, setOpening] = useState<SearchResult | null>(null);
  const [switching, setSwitching] = useState(false);
  const [switchFailed, setSwitchFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<SavedView | null>(null);
  const [deleting, setDeleting] = useState<SavedView | null>(null);

  const q = urlQuery.trim();
  const searchable = q.length >= 2;
  const type = oneOf(filters.type, SEARCH_RESULT_TYPES);
  const query = useApiQuery(
    reportingEndpoints.search,
    searchable
      ? {
          query: {
            q,
            ...compact({
              type,
              tenantId: idOf(filters.tenant),
              updatedFrom: filters.updatedFrom,
              updatedTo: filters.updatedTo,
            }),
            sort: oneOf(filters.sort, SORTS),
            dir: filters.dir === 'asc' ? 'asc' : 'desc',
            page: filters.page,
            pageSize: filters.pageSize,
          },
        }
      : null,
  );
  const views = useApiQuery(reportingEndpoints.listSavedViews, {
    query: { scope: 'COM-08', pageSize: 100 },
  });
  const errors = formErrors(query.error, ['q', 'updatedFrom', 'updatedTo']);
  const data = query.data;

  const currentFilters: JsonObject = {
    q,
    ...(type === undefined ? {} : { type: [type] }),
    ...(filters.tenant === '' ? {} : { tenantId: Number(filters.tenant) }),
    ...(filters.updatedFrom === '' ? {} : { updatedFrom: filters.updatedFrom }),
    ...(filters.updatedTo === '' ? {} : { updatedTo: filters.updatedTo }),
  };

  const applyView = (view: SavedView): void => {
    const saved = view.filters;
    const savedType = Array.isArray(saved.type) ? saved.type[0] : saved.type;
    setFilters({
      type: typeof savedType === 'string' ? savedType : '',
      tenant: typeof saved.tenantId === 'number' ? String(saved.tenantId) : '',
      updatedFrom: typeof saved.updatedFrom === 'string' ? saved.updatedFrom : '',
      updatedTo: typeof saved.updatedTo === 'string' ? saved.updatedTo : '',
      page: 1,
    });
    const savedQuery = typeof saved.q === 'string' ? saved.q : '';
    setText(savedQuery);
    onSearch(savedQuery);
  };

  const open = (row: SearchResult): void => {
    if (tenant !== null && row.organization.tenantId === tenant.tenantId) {
      void navigate(row.to);
      return;
    }
    setSwitchFailed(false);
    setOpening(row);
  };

  const confirmSwitch = async (): Promise<void> => {
    if (opening === null) return;
    setSwitching(true);
    const ok = await dispatch(selectTenant(opening.organization.tenantId));
    setSwitching(false);
    if (ok) {
      const target = opening.to;
      setOpening(null);
      void navigate(target);
    } else {
      setSwitchFailed(true);
    }
  };

  const columns: DataTableColumn<SearchResult>[] = [
    {
      id: 'type',
      header: t('search.col.type'),
      cell: (row) => (
        <Chip tone="neutral" size="sm" icon={TYPE_ICON[row.type]}>
          {t(`search.types.${row.type}`)}
        </Chip>
      ),
    },
    {
      id: 'title',
      header: t('search.col.result'),
      sortable: true,
      cell: (row) => (
        <>
          {row.reference !== null && <Reference value={row.reference} />} <span>{row.title}</span>
          {row.subtitle !== null && <span className="tiq-cell-sub">{row.subtitle}</span>}
        </>
      ),
    },
    {
      id: 'status',
      header: t('search.col.status'),
      cell: (row) =>
        row.status === null ? (
          <span className="tiq-text-muted">{t('search.noStatus')}</span>
        ) : (
          <StatusChip enum={row.status.enum} value={row.status.value} size="sm" />
        ),
    },
    {
      id: 'organization',
      header: t('search.col.organization'),
      cell: (row) => (
        <>
          <span>{row.organization.tenantName}</span>
          {tenant !== null && row.organization.tenantId !== tenant.tenantId && (
            <span className="tiq-cell-sub">{t('search.otherOrganization')}</span>
          )}
        </>
      ),
    },
    {
      id: 'matchedOn',
      header: t('search.col.matched'),
      cell: (row) => <span className="tiq-text-muted">{row.matchedOn}</span>,
    },
    {
      id: 'updatedAt',
      header: t('search.col.updated'),
      sortable: true,
      cell: (row) => formatInstantDate(row.updatedAt, tenant?.officialTimeZone ?? 'UTC'),
    },
  ];

  const sort: DataTableSort | null =
    filters.sort === 'relevance'
      ? null
      : { key: filters.sort, dir: filters.dir === 'asc' ? 'asc' : 'desc' };
  const filtered =
    filters.type !== '' ||
    filters.tenant !== '' ||
    filters.updatedFrom !== '' ||
    filters.updatedTo !== '';

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('search.title')}
        subtitle={t('search.intro')}
        actions={
          <Button icon="bookOpen" disabled={!searchable} onClick={() => setSaving(true)}>
            {t('search.views.saveCurrent')}
          </Button>
        }
      />
      <FilterBar label={t('search.filters')} onClear={clearFilters} canClear={filtered}>
        <SearchField
          label={t('search.query')}
          value={text}
          onChange={setText}
          onSubmit={(value) => {
            setFilters({ page: 1 });
            onSearch(value.trim());
          }}
          placeholder={t('search.placeholder')}
        />
        <Select
          label={t('search.type')}
          value={filters.type}
          placeholder={t('search.allTypes')}
          options={SEARCH_RESULT_TYPES.map((value) => ({
            value,
            label: t(`search.types.${value}`),
          }))}
          onChange={(value) => setFilters({ type: value, page: 1 })}
        />
        <Select
          label={t('search.organization')}
          value={filters.tenant}
          placeholder={t('search.allOrganizations')}
          options={memberships.map((membership) => ({
            value: String(membership.tenantId),
            label: membership.tenantName,
          }))}
          onChange={(value) => setFilters({ tenant: value, page: 1 })}
        />
        <DateInput
          label={t('search.updatedFrom')}
          value={filters.updatedFrom}
          onChange={(value) => setFilters({ updatedFrom: value, page: 1 })}
          error={errors.forField('updatedFrom')}
        />
        <DateInput
          label={t('search.updatedTo')}
          value={filters.updatedTo}
          onChange={(value) => setFilters({ updatedTo: value, page: 1 })}
          error={errors.forField('updatedTo')}
        />
        <Select
          label={t('search.sort')}
          value={filters.sort}
          options={SORTS.map((value) => ({ value, label: t(`search.sorts.${value}`) }))}
          onChange={(value) =>
            setFilters({ sort: value, dir: value === 'title' ? 'asc' : 'desc', page: 1 })
          }
        />
      </FilterBar>

      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack">
          {searchable && data !== undefined && (
            <Card title={t('search.countsTitle')} subtitle={t('search.countsHint')}>
              <div className="tiq-inline" role="group" aria-label={t('search.countsTitle')}>
                <Button
                  size="sm"
                  variant={filters.type === '' ? 'primary' : 'secondary'}
                  aria-pressed={filters.type === ''}
                  onClick={() => setFilters({ type: '', page: 1 })}
                >
                  {t('search.allCount', {
                    count: data.counts.reduce((sum, item) => sum + item.count, 0),
                  })}
                </Button>
                {data.counts.map((item) => (
                  <Button
                    key={item.type}
                    size="sm"
                    variant={filters.type === item.type ? 'primary' : 'secondary'}
                    aria-pressed={filters.type === item.type}
                    onClick={() => setFilters({ type: item.type, page: 1 })}
                  >
                    {t('search.typeCount', {
                      type: t(`search.types.${item.type}`),
                      count: formatCount(item.count),
                    })}
                  </Button>
                ))}
              </div>
              {data.organizations.length > 0 && (
                <p className="tiq-text-muted">
                  {data.organizations
                    .map((item) =>
                      t('search.orgCount', {
                        organization: item.organization.tenantName,
                        count: formatCount(item.count),
                      }),
                    )
                    .join(' · ')}
                </p>
              )}
            </Card>
          )}
          <Card
            flush
            title={searchable ? t('search.resultsFor', { q }) : t('search.resultsTitle')}
            subtitle={
              searchable && data !== undefined
                ? t('search.resultCount', { count: data.total })
                : undefined
            }
          >
            {searchable ? (
              <DataTable
                caption={t('search.resultsTitle')}
                columns={columns}
                rows={data?.items}
                rowKey={(row) => row.key}
                rowLabel={(row) =>
                  t('search.openResult', {
                    title: row.title,
                    organization: row.organization.tenantName,
                  })
                }
                onRowClick={open}
                loading={query.isFetching}
                error={query.error}
                onRetry={query.reload}
                sort={sort}
                onSortChange={(next) => setFilters({ sort: next.key, dir: next.dir, page: 1 })}
                empty={
                  <EmptyState
                    compact
                    icon="search"
                    title={t('search.noResults', { q })}
                    description={t('search.noResultsHint')}
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
            ) : (
              <EmptyState
                icon="search"
                title={t('search.startTitle')}
                description={q.length === 1 ? t('search.tooShort') : t('search.startHint')}
              />
            )}
          </Card>
        </div>

        <Card
          title={t('search.views.title')}
          subtitle={t('search.views.subtitle')}
          style={{ alignSelf: 'start' }}
        >
          {views.status === 'error' && views.data === undefined ? (
            <EmptyState compact icon="alertTriangle" title={t('search.views.loadError')} />
          ) : views.data === undefined ? (
            <p className="tiq-text-muted">{t('search.views.loading')}</p>
          ) : views.data.items.length === 0 ? (
            <EmptyState
              compact
              icon="bookOpen"
              title={t('search.views.none')}
              description={t('search.views.noneHint')}
            />
          ) : (
            <ul className="tiq-stack" aria-label={t('search.views.title')}>
              {views.data.items.map((view) => (
                <li key={view.id} className="tiq-stack">
                  <div className="tiq-inline">
                    <Button
                      variant="link"
                      onClick={() => applyView(view)}
                      aria-label={t('search.views.applyNamed', { name: view.name })}
                    >
                      {view.name}
                    </Button>
                    {view.isDefault && (
                      <Chip tone="accent" size="sm">
                        {t('search.views.defaultChip')}
                      </Chip>
                    )}
                  </div>
                  <span className="tiq-cell-sub">
                    {t('search.views.meta', {
                      organization: view.organization.tenantName,
                      date: formatInstantDate(view.updatedAt, tenant?.officialTimeZone ?? 'UTC'),
                    })}
                  </span>
                  <div className="tiq-inline">
                    <Button
                      size="sm"
                      icon="edit"
                      onClick={() => setEditing(view)}
                      aria-label={t('search.views.editNamed', { name: view.name })}
                    >
                      {t('search.views.edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="trash"
                      onClick={() => setDeleting(view)}
                      aria-label={t('search.views.deleteNamed', { name: view.name })}
                    >
                      {t('search.views.delete')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ConfirmActionDialog
        open={opening !== null}
        title={t('search.switchTitle')}
        organization={
          opening === null
            ? undefined
            : { name: opening.organization.tenantName, capacity: capacityIn(opening, memberships) }
        }
        scope={opening === null ? '' : `${opening.reference ?? ''} ${opening.title}`.trim()}
        consequence={t('search.switchConsequence', {
          organization: opening?.organization.tenantName ?? '',
        })}
        confirmLabel={t('search.switchConfirm')}
        pending={switching}
        onCancel={() => setOpening(null)}
        onConfirm={confirmSwitch}
      >
        {switchFailed && <p className="tiq-text-danger">{t('search.switchFailed')}</p>}
      </ConfirmActionDialog>
      <SaveViewDialog
        open={saving}
        onClose={() => setSaving(false)}
        scope="COM-08"
        filters={currentFilters}
      />
      <SaveViewDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        scope="COM-08"
        filters={currentFilters}
        view={editing ?? undefined}
      />
      <DeleteViewDialog view={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

function capacityIn(
  row: SearchResult,
  memberships: readonly { tenantId: number; capacity: string | null }[],
): string | null {
  return memberships.find((item) => item.tenantId === row.organization.tenantId)?.capacity ?? null;
}
