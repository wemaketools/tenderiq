/**
 * The four SUP-06 tabs: discovered opportunities (matches are suggestions, never eligibility decisions), the
 * watchlist, saved searches and notice subscriptions.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { TENDERS_EVENT_TYPE, TENDERS_PROCEDURE, TENDERS_STATUS } from '@contracts/enums';
import { OPPORTUNITY_SORT_FIELDS, publicationEndpoints } from '@contracts/publication';
import type {
  NoticeSubscription,
  OpportunityFilters,
  OpportunityRow,
  SavedSearch,
  WatchlistItem,
} from '@contracts/publication';

import { isApiError } from '../../../api/client';
import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  OfficialDeadline,
  OrDash,
  Reference,
  SearchField,
  Select,
  StatusChip,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn, SelectOption } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { publicationErrorMessage, withPublicationMessage } from '../../publication/lib/errors';
import { useOfficialTimeZone } from '../../publication/lib/hooks';
import {
  compact,
  dateOrUndefined,
  directionOf,
  idOrUndefined,
  oneOf,
  paginationOf,
  sortOf,
  tableSort,
} from '../../publication/lib/lists';
import { opportunityPaths } from '../../publication/lib/paths';
import { DISCOVER_DEFAULTS } from '../lib/discovery';
import { SavedSearchDialog, SubscriptionDialog } from './DiscoveryDialogs';

function optionsOf(
  options: ReadonlyArray<{ value: string; label: string; count: number }> | undefined,
): SelectOption[] {
  return (options ?? []).map((option) => ({
    value: option.value,
    label: `${option.label} (${option.count})`,
  }));
}

/** The participation summary of a row, for the buyer-facing state the supplier already has. */
function participationLabel(row: OpportunityRow): string | null {
  const participation = row.participation;
  if (participation === null) return null;
  if (participation.invitationStatus === 'invited') return t('opportunities.discover.invited');
  if (participation.invitationStatus === 'accepted') return t('opportunities.discover.accepted');
  if (participation.accessStatus === 'requested')
    return t('opportunities.discover.accessRequested');
  return tEnum('participants.source', participation.source);
}

// ---------------------------------------------------------------------------------------------------------
// Discover
// ---------------------------------------------------------------------------------------------------------

interface RowOverride {
  readonly watchlistItemId?: number | null;
  readonly dismissed?: boolean;
}

export function DiscoverTab({
  filters: filterOptions,
  searches,
}: {
  readonly filters: OpportunityFilters | undefined;
  readonly searches: readonly SavedSearch[];
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const [filters, setFilters, clearFilters] = useScreenFilters('SUP-06', DISCOVER_DEFAULTS);
  const [overrides, setOverrides] = useState<ReadonlyMap<number, RowOverride>>(new Map());
  const [saveOpen, setSaveOpen] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const addWatch = useApiMutation(publicationEndpoints.addToWatchlist);
  const removeWatch = useApiMutation(publicationEndpoints.removeFromWatchlist);
  const dismiss = useApiMutation(publicationEndpoints.dismissOpportunity);
  const restore = useApiMutation(publicationEndpoints.restoreOpportunity);

  const query = useApiQuery(publicationEndpoints.listOpportunities, {
    query: compact({
      q: filters.q.trim(),
      buyer: idOrUndefined(filters.buyer) === undefined ? undefined : [Number(filters.buyer)],
      category: filters.category === '' ? undefined : [filters.category],
      region: filters.region === '' ? undefined : [filters.region],
      procedure: oneOf(filters.procedure, TENDERS_PROCEDURE),
      eventType: oneOf(filters.eventType, TENDERS_EVENT_TYPE),
      status: oneOf(filters.status, TENDERS_STATUS),
      closingFrom: dateOrUndefined(filters.closingFrom),
      closingTo: dateOrUndefined(filters.closingTo),
      matchedOnly: filters.matchedOnly,
      watchedOnly: filters.watchedOnly,
      participatingOnly: filters.participatingOnly,
      includeDismissed: filters.includeDismissed,
      savedSearchId: idOrUndefined(filters.savedSearchId),
      sort: sortOf(filters.sort, OPPORTUNITY_SORT_FIELDS, 'closingAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });

  const rows = query.data?.items
    .map((row) => {
      const override = overrides.get(row.tender.tenderId);
      return override === undefined ? row : { ...row, ...override };
    })
    .filter((row) => filters.includeDismissed || !row.dismissed);

  const setOverride = (tenderId: number, value: RowOverride): void => {
    setOverrides((current) => {
      const next = new Map(current);
      next.set(tenderId, { ...(current.get(tenderId) ?? {}), ...value });
      return next;
    });
  };

  const run = async (row: OpportunityRow, action: () => Promise<string>): Promise<void> => {
    setBusy(row.tender.tenderId);
    try {
      toast.show(await action(), 'success');
    } catch (error) {
      toast.show(
        isApiError(error) ? publicationErrorMessage(error) : t('opportunities.dialogs.failed'),
        'error',
      );
    } finally {
      setBusy(null);
    }
  };

  const toggleWatch = (row: OpportunityRow): Promise<void> =>
    run(row, async () => {
      if (row.watchlistItemId === null) {
        const item = await addWatch.mutate({ body: { tenderId: row.tender.tenderId } });
        setOverride(row.tender.tenderId, { watchlistItemId: item.id });
        invalidateApiQueries('supplier.watchlist.list');
        return t('opportunities.discover.watched', { reference: row.tender.reference });
      }
      await removeWatch.mutate({ params: { watchlistItemId: row.watchlistItemId } });
      setOverride(row.tender.tenderId, { watchlistItemId: null });
      invalidateApiQueries('supplier.watchlist.list');
      return t('opportunities.discover.unwatched', { reference: row.tender.reference });
    });

  const dismissRow = (row: OpportunityRow): Promise<void> =>
    run(row, async () => {
      await dismiss.mutate({ params: { tenderId: row.tender.tenderId } });
      setOverride(row.tender.tenderId, { dismissed: true });
      return t('opportunities.discover.dismissed', { reference: row.tender.reference });
    });

  const restoreRow = (row: OpportunityRow): Promise<void> =>
    run(row, async () => {
      await restore.mutate({ params: { tenderId: row.tender.tenderId } });
      setOverride(row.tender.tenderId, { dismissed: false });
      return t('opportunities.discover.restored', { reference: row.tender.reference });
    });

  const filtered =
    filters.q !== '' ||
    filters.buyer !== '' ||
    filters.category !== '' ||
    filters.region !== '' ||
    filters.procedure !== '' ||
    filters.eventType !== '' ||
    filters.status !== '' ||
    filters.closingFrom !== '' ||
    filters.closingTo !== '' ||
    filters.matchedOnly ||
    filters.watchedOnly ||
    filters.participatingOnly ||
    filters.includeDismissed ||
    filters.savedSearchId !== '';

  const columns: DataTableColumn<OpportunityRow>[] = [
    {
      id: 'title',
      header: t('opportunities.discover.col.opportunity'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference
            value={row.tender.reference}
            to={opportunityPaths.workspace(row.tender.tenderId)}
          />
          <span className="tiq-cell-sub">{row.tender.title}</span>
          <span className="tiq-cell-sub">
            {tEnum('tenders.event_type', row.tender.eventType)} ·{' '}
            {tEnum('tenders.procedure', row.tender.procedure)}
          </span>
        </>
      ),
    },
    {
      id: 'buyer',
      header: t('opportunities.discover.col.buyer'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.buyer.name}</span>
          <span className="tiq-cell-sub">{row.category.name}</span>
        </>
      ),
    },
    {
      id: 'match',
      header: t('opportunities.discover.col.match'),
      sortable: true,
      cell: (row) => (
        <>
          {row.match.isMatch ? (
            <Chip tone="accent" size="sm" icon="target">
              {t('opportunities.discover.suggested')}
            </Chip>
          ) : (
            <span className="tiq-text-muted">{t('opportunities.discover.notMatched')}</span>
          )}
          {row.match.reasons.length > 0 && (
            <span className="tiq-cell-sub">
              {row.match.reasons
                .map((reason) => `${t(`opportunities.matchKind.${reason.kind}`)}: ${reason.label}`)
                .join(' · ')}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'status',
      header: t('opportunities.discover.col.status'),
      cell: (row) => (
        <>
          <StatusChip enum="tenders.status" value={row.tender.status} size="sm" />
          {participationLabel(row) !== null && (
            <span className="tiq-cell-sub">{participationLabel(row)}</span>
          )}
          {row.pursuitDecision !== null && (
            <span className="tiq-cell-sub">
              {t('opportunities.discover.pursuit', {
                decision: tEnum('pursuits.decision', row.pursuitDecision),
              })}
            </span>
          )}
          {row.dismissed && (
            <Chip tone="neutral" size="sm">
              {t('opportunities.discover.dismissedChip')}
            </Chip>
          )}
        </>
      ),
    },
    {
      id: 'closingAt',
      header: t('opportunities.discover.col.closing'),
      sortable: true,
      cell: (row) =>
        row.closingAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <OfficialDeadline
            deadline={row.closingAt}
            showLocal={false}
            showRemaining={row.isAcceptingResponses}
          />
        ),
    },
    {
      id: 'actions',
      header: (
        <span className="tiq-visually-hidden">{t('opportunities.discover.col.actions')}</span>
      ),
      cell: (row) => (
        <div className="tiq-row-actions">
          <Button
            size="sm"
            icon={row.watchlistItemId === null ? 'eye' : 'eyeOff'}
            loading={busy === row.tender.tenderId}
            onClick={(event) => {
              event.stopPropagation();
              void toggleWatch(row);
            }}
            aria-label={
              row.watchlistItemId === null
                ? t('opportunities.discover.watchNamed', { reference: row.tender.reference })
                : t('opportunities.discover.unwatchNamed', { reference: row.tender.reference })
            }
          >
            {row.watchlistItemId === null
              ? t('opportunities.actions.watch')
              : t('opportunities.actions.unwatch')}
          </Button>
          {!row.dismissed && row.participation === null && (
            <Button
              size="sm"
              variant="ghost"
              icon="xCircle"
              disabled={busy === row.tender.tenderId}
              onClick={(event) => {
                event.stopPropagation();
                void dismissRow(row);
              }}
              aria-label={t('opportunities.discover.dismissNamed', {
                reference: row.tender.reference,
              })}
            >
              {t('opportunities.actions.dismiss')}
            </Button>
          )}
          {row.dismissed && (
            <Button
              size="sm"
              variant="ghost"
              icon="refresh"
              disabled={busy === row.tender.tenderId}
              onClick={(event) => {
                event.stopPropagation();
                void restoreRow(row);
              }}
              aria-label={t('opportunities.discover.restoreNamed', {
                reference: row.tender.reference,
              })}
            >
              {t('opportunities.actions.restore')}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="tiq-stack tiq-stack--spaced">
      <Banner tone="info" title={t('opportunities.discover.matchTitle')}>
        <p>{t('opportunities.discover.matchNote')}</p>
        {filterOptions !== undefined && (
          <p className="tiq-text-muted">
            {t('opportunities.discover.profile', {
              categories:
                filterOptions.profileCategories.map((category) => category.name).join(', ') ||
                t('opportunities.common.none'),
              regions: filterOptions.profileRegions.join(', ') || t('opportunities.common.none'),
            })}
          </p>
        )}
      </Banner>
      <FilterBar
        label={t('opportunities.discover.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('opportunities.common.search')}
          placeholder={t('opportunities.discover.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('opportunities.discover.savedSearch')}
          placeholder={t('opportunities.discover.noSavedSearch')}
          value={filters.savedSearchId}
          options={searches.map((search) => ({ value: String(search.id), label: search.name }))}
          onChange={(savedSearchId) => setFilters({ savedSearchId, page: 1 })}
        />
        <Select
          label={t('opportunities.discover.col.buyer')}
          placeholder={t('opportunities.common.all')}
          value={filters.buyer}
          options={optionsOf(filterOptions?.buyers)}
          onChange={(buyer) => setFilters({ buyer, page: 1 })}
        />
        <Select
          label={t('opportunities.discover.category')}
          placeholder={t('opportunities.common.all')}
          value={filters.category}
          options={optionsOf(filterOptions?.categories)}
          onChange={(category) => setFilters({ category, page: 1 })}
        />
        <Select
          label={t('opportunities.discover.region')}
          placeholder={t('opportunities.common.all')}
          value={filters.region}
          options={optionsOf(filterOptions?.regions)}
          onChange={(region) => setFilters({ region, page: 1 })}
        />
        <Select
          label={t('opportunities.discover.procedure')}
          placeholder={t('opportunities.common.all')}
          value={filters.procedure}
          options={optionsOf(filterOptions?.procedures)}
          onChange={(procedure) => setFilters({ procedure, page: 1 })}
        />
        <Select
          label={t('opportunities.discover.eventType')}
          placeholder={t('opportunities.common.all')}
          value={filters.eventType}
          options={optionsOf(filterOptions?.eventTypes)}
          onChange={(eventType) => setFilters({ eventType, page: 1 })}
        />
        <Select
          label={t('opportunities.discover.col.status')}
          placeholder={t('opportunities.common.all')}
          value={filters.status}
          options={optionsOf(filterOptions?.statuses)}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <DateInput
          label={t('opportunities.discover.closingFrom')}
          value={filters.closingFrom}
          onChange={(closingFrom) => setFilters({ closingFrom, page: 1 })}
        />
        <DateInput
          label={t('opportunities.discover.closingTo')}
          value={filters.closingTo}
          onChange={(closingTo) => setFilters({ closingTo, page: 1 })}
        />
        <Checkbox
          label={t('opportunities.discover.matchedOnly')}
          checked={filters.matchedOnly}
          onChange={(matchedOnly) => setFilters({ matchedOnly, page: 1 })}
        />
        <Checkbox
          label={t('opportunities.discover.watchedOnly')}
          checked={filters.watchedOnly}
          onChange={(watchedOnly) => setFilters({ watchedOnly, page: 1 })}
        />
        <Checkbox
          label={t('opportunities.discover.participatingOnly')}
          checked={filters.participatingOnly}
          onChange={(participatingOnly) => setFilters({ participatingOnly, page: 1 })}
        />
        <Checkbox
          label={t('opportunities.discover.includeDismissed')}
          checked={filters.includeDismissed}
          onChange={(includeDismissed) => setFilters({ includeDismissed, page: 1 })}
        />
      </FilterBar>
      <Card
        flush
        title={t('opportunities.discover.tableTitle')}
        actions={
          <Button size="sm" icon="star" onClick={() => setSaveOpen(true)}>
            {t('opportunities.discover.saveSearch')}
          </Button>
        }
      >
        <DataTable
          caption={t('opportunities.discover.caption')}
          columns={columns}
          rows={rows}
          rowKey={(row) => String(row.tender.tenderId)}
          rowLabel={(row) => `${row.tender.reference} ${row.tender.title}`}
          onRowClick={(row) => void navigate(opportunityPaths.workspace(row.tender.tenderId))}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              icon="search"
              title={
                filtered
                  ? t('opportunities.discover.emptyFiltered')
                  : t('opportunities.discover.empty')
              }
            />
          }
          pagination={paginationOf(query.data, setFilters)}
        />
      </Card>
      {saveOpen && (
        <SavedSearchDialog
          open
          search={null}
          filters={filterOptions}
          initial={{
            name: '',
            keywords: filters.q.trim() === '' ? null : filters.q.trim(),
            catalogCodes: filters.category === '' ? [] : [filters.category],
            buyerTenantIds: filters.buyer === '' ? [] : [Number(filters.buyer)],
            regions: filters.region === '' ? [] : [filters.region],
            procedures: [],
            notify: true,
          }}
          onClose={() => setSaveOpen(false)}
          onSaved={(search) => {
            setSaveOpen(false);
            toast.show(t('opportunities.searches.saved', { name: search.name }), 'success');
            invalidateApiQueries('supplier.savedSearches.');
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Watchlist
// ---------------------------------------------------------------------------------------------------------

const WATCH_DEFAULTS = { q: '', status: '', sort: 'closingAt', dir: 'asc', page: 1, pageSize: 25 };

export function WatchlistTab() {
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const [filters, setFilters, clearFilters] = useScreenFilters('SUP-06:watchlist', WATCH_DEFAULTS);
  const [removed, setRemoved] = useState<ReadonlySet<number>>(new Set());
  const [confirm, setConfirm] = useState<WatchlistItem | null>(null);
  const remove = useApiMutation(publicationEndpoints.removeFromWatchlist);
  const query = useApiQuery(publicationEndpoints.listWatchlist, {
    query: compact({
      q: filters.q.trim(),
      status: oneOf(filters.status, TENDERS_STATUS),
      sort: sortOf(filters.sort, ['closingAt', 'addedAt', 'title'] as const, 'closingAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const rows = query.data?.items.filter((row) => !removed.has(row.id));

  const columns: DataTableColumn<WatchlistItem>[] = [
    {
      id: 'title',
      header: t('opportunities.discover.col.opportunity'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference value={row.tender.reference} to={row.linkPath} />
          <span className="tiq-cell-sub">{row.tender.title}</span>
          <span className="tiq-cell-sub">{row.buyer.name}</span>
        </>
      ),
    },
    {
      id: 'status',
      header: t('opportunities.discover.col.status'),
      cell: (row) => (
        <>
          <StatusChip enum="tenders.status" value={row.tender.status} size="sm" />
          {!row.isAcceptingResponses && (
            <span className="tiq-cell-sub">{t('opportunities.common.notAccepting')}</span>
          )}
        </>
      ),
    },
    {
      id: 'closingAt',
      header: t('opportunities.discover.col.closing'),
      sortable: true,
      cell: (row) =>
        row.closingAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <OfficialDeadline
            deadline={row.closingAt}
            showLocal={false}
            showRemaining={row.isAcceptingResponses}
          />
        ),
    },
    {
      id: 'amended',
      header: t('opportunities.watchlist.col.amended'),
      cell: (row) => (
        <OrDash>
          {row.lastAmendedAt === null ? null : formatDateTime(row.lastAmendedAt, timeZone)}
        </OrDash>
      ),
    },
    {
      id: 'addedAt',
      header: t('opportunities.watchlist.col.added'),
      sortable: true,
      cell: (row) => formatDateTime(row.addedAt, timeZone),
    },
    {
      id: 'actions',
      header: (
        <span className="tiq-visually-hidden">{t('opportunities.discover.col.actions')}</span>
      ),
      cell: (row) => (
        <Button size="sm" variant="ghost" icon="trash" onClick={() => setConfirm(row)}>
          {t('opportunities.actions.unwatch')}
        </Button>
      ),
    },
  ];

  return (
    <div className="tiq-stack tiq-stack--spaced">
      <FilterBar
        label={t('opportunities.watchlist.filters')}
        onClear={clearFilters}
        canClear={filters.q !== '' || filters.status !== ''}
      >
        <SearchField
          label={t('opportunities.common.search')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('opportunities.discover.col.status')}
          placeholder={t('opportunities.common.all')}
          value={filters.status}
          options={TENDERS_STATUS.map((value) => ({
            value,
            label: tEnum('tenders.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
      </FilterBar>
      <Card flush title={t('opportunities.watchlist.title')}>
        <DataTable
          caption={t('opportunities.watchlist.caption')}
          columns={columns}
          rows={rows}
          rowKey={(row) => String(row.id)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              icon="eye"
              title={t('opportunities.watchlist.empty')}
              description={t('opportunities.watchlist.emptyHint')}
            />
          }
          pagination={paginationOf(query.data, setFilters)}
        />
      </Card>
      <ConfirmActionDialog
        open={confirm !== null}
        tone="danger"
        title={t('opportunities.watchlist.removeTitle')}
        scope={confirm === null ? '' : `${confirm.tender.reference} ${confirm.tender.title}`}
        consequence={t('opportunities.watchlist.removeConsequence')}
        confirmLabel={t('opportunities.actions.unwatch')}
        pending={remove.pending}
        error={withPublicationMessage(remove.error)}
        onCancel={() => {
          remove.reset();
          setConfirm(null);
        }}
        onConfirm={async () => {
          if (confirm === null) return;
          try {
            await remove.mutate({ params: { watchlistItemId: confirm.id } });
            setRemoved((current) => new Set(current).add(confirm.id));
            toast.show(
              t('opportunities.discover.unwatched', { reference: confirm.tender.reference }),
              'success',
            );
            setConfirm(null);
            invalidateApiQueries('supplier.opportunities.list');
          } catch {
            // Shown in the dialog.
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Saved searches
// ---------------------------------------------------------------------------------------------------------

export function SavedSearchesTab({
  filters,
  onRun,
}: {
  readonly filters: OpportunityFilters | undefined;
  readonly onRun: (search: SavedSearch) => void;
}) {
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<SavedSearch | 'new' | null>(null);
  const [deleting, setDeleting] = useState<SavedSearch | null>(null);
  const [saved, setSaved] = useState<ReadonlyMap<number, SavedSearch>>(new Map());
  const [deleted, setDeleted] = useState<ReadonlySet<number>>(new Set());
  const remove = useApiMutation(publicationEndpoints.deleteSavedSearch);
  const query = useApiQuery(publicationEndpoints.listSavedSearches, {
    query: compact({ q: q.trim(), pageSize: 100 }),
  });
  const base = query.data?.items ?? [];
  const rows =
    query.data === undefined
      ? undefined
      : [
          ...[...saved.values()].filter((item) => !base.some((row) => row.id === item.id)),
          ...base.map((row) => saved.get(row.id) ?? row),
        ].filter((row) => !deleted.has(row.id));

  const summary = (search: SavedSearch): string => {
    const parts: string[] = [];
    if (search.keywords !== null) parts.push(`"${search.keywords}"`);
    if (search.catalogCodes.length > 0) parts.push(search.catalogCodes.join(', '));
    if (search.regions.length > 0) parts.push(search.regions.join(', '));
    if (search.buyerTenantIds.length > 0) {
      parts.push(
        search.buyerTenantIds
          .map(
            (id) =>
              filters?.buyers.find((option) => option.value === String(id))?.label ?? `#${id}`,
          )
          .join(', '),
      );
    }
    if (search.procedures.length > 0) {
      parts.push(search.procedures.map((value) => tEnum('tenders.procedure', value)).join(', '));
    }
    return parts.join(' · ');
  };

  const columns: DataTableColumn<SavedSearch>[] = [
    {
      id: 'name',
      header: t('opportunities.searches.name'),
      cell: (row) => (
        <>
          <strong>{row.name}</strong>
          <span className="tiq-cell-sub">{summary(row)}</span>
        </>
      ),
    },
    {
      id: 'matches',
      header: t('opportunities.searches.col.matches'),
      numeric: true,
      cell: (row) => row.matchCount,
    },
    {
      id: 'notify',
      header: t('opportunities.searches.col.notify'),
      cell: (row) =>
        row.notify ? (
          <Chip tone="success" size="sm">
            {t('opportunities.common.on')}
          </Chip>
        ) : (
          <Chip tone="neutral" size="sm">
            {t('opportunities.common.off')}
          </Chip>
        ),
    },
    {
      id: 'updatedAt',
      header: t('opportunities.searches.col.updated'),
      cell: (row) => formatDateTime(row.updatedAt, timeZone),
    },
    {
      id: 'actions',
      header: (
        <span className="tiq-visually-hidden">{t('opportunities.discover.col.actions')}</span>
      ),
      cell: (row) => (
        <div className="tiq-row-actions">
          <Button size="sm" icon="search" onClick={() => onRun(row)}>
            {t('opportunities.searches.run')}
          </Button>
          <Button size="sm" icon="edit" onClick={() => setEditing(row)}>
            {t('opportunities.actions.edit')}
          </Button>
          <Button size="sm" variant="ghost" icon="trash" onClick={() => setDeleting(row)}>
            {t('opportunities.actions.delete')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="tiq-stack tiq-stack--spaced">
      <FilterBar
        label={t('opportunities.searches.filters')}
        onClear={() => setQ('')}
        canClear={q !== ''}
      >
        <SearchField label={t('opportunities.common.search')} value={q} onChange={setQ} />
      </FilterBar>
      <Card
        flush
        title={t('opportunities.searches.title')}
        actions={
          <Button size="sm" variant="primary" icon="plus" onClick={() => setEditing('new')}>
            {t('opportunities.searches.new')}
          </Button>
        }
      >
        <DataTable
          caption={t('opportunities.searches.caption')}
          columns={columns}
          rows={rows}
          rowKey={(row) => String(row.id)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          empty={
            <EmptyState
              compact
              icon="star"
              title={t('opportunities.searches.empty')}
              description={t('opportunities.searches.emptyHint')}
            />
          }
        />
      </Card>
      {editing !== null && (
        <SavedSearchDialog
          open
          search={editing === 'new' ? null : editing}
          filters={filters}
          onClose={() => setEditing(null)}
          onSaved={(search) => {
            setEditing(null);
            setSaved((current) => new Map(current).set(search.id, search));
            toast.show(t('opportunities.searches.saved', { name: search.name }), 'success');
          }}
        />
      )}
      <ConfirmActionDialog
        open={deleting !== null}
        tone="danger"
        title={t('opportunities.searches.deleteTitle')}
        scope={deleting?.name ?? ''}
        consequence={t('opportunities.searches.deleteConsequence')}
        confirmLabel={t('opportunities.actions.delete')}
        pending={remove.pending}
        error={withPublicationMessage(remove.error)}
        onCancel={() => {
          remove.reset();
          setDeleting(null);
        }}
        onConfirm={async () => {
          if (deleting === null) return;
          try {
            await remove.mutate({ params: { savedSearchId: deleting.id } });
            setDeleted((current) => new Set(current).add(deleting.id));
            toast.show(t('opportunities.searches.deleted', { name: deleting.name }), 'success');
            setDeleting(null);
          } catch {
            // Shown in the dialog.
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------------------------------------

export function SubscriptionsTab({
  filters,
}: {
  readonly filters: OpportunityFilters | undefined;
}) {
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const [activeFilter, setActiveFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<NoticeSubscription | null>(null);
  const [changed, setChanged] = useState<ReadonlyMap<number, NoticeSubscription>>(new Map());
  const [deleted, setDeleted] = useState<ReadonlySet<number>>(new Set());
  const [busy, setBusy] = useState<number | null>(null);
  const update = useApiMutation(publicationEndpoints.updateSubscription);
  const remove = useApiMutation(publicationEndpoints.deleteSubscription);
  const query = useApiQuery(publicationEndpoints.listSubscriptions, {
    query: compact({
      active: activeFilter === '' ? undefined : activeFilter === 'active',
      pageSize: 100,
    }),
  });
  const base = query.data?.items ?? [];
  const rows =
    query.data === undefined
      ? undefined
      : [
          ...[...changed.values()].filter((item) => !base.some((row) => row.id === item.id)),
          ...base.map((row) => changed.get(row.id) ?? row),
        ].filter((row) => !deleted.has(row.id));

  const toggle = async (row: NoticeSubscription): Promise<void> => {
    setBusy(row.id);
    try {
      const next = await update.mutate({
        params: { subscriptionId: row.id },
        body: { active: !row.active },
      });
      setChanged((current) => new Map(current).set(next.id, next));
      toast.show(
        next.active
          ? t('opportunities.subscriptions.resumed')
          : t('opportunities.subscriptions.paused'),
        'success',
      );
    } catch (error) {
      toast.show(
        isApiError(error) ? publicationErrorMessage(error) : t('opportunities.dialogs.failed'),
        'error',
      );
    } finally {
      setBusy(null);
    }
  };

  const columns: DataTableColumn<NoticeSubscription>[] = [
    {
      id: 'buyer',
      header: t('opportunities.subscriptions.buyer'),
      cell: (row) => (
        <OrDash>{row.buyer?.name ?? t('opportunities.subscriptions.anyBuyer')}</OrDash>
      ),
    },
    {
      id: 'category',
      header: t('opportunities.subscriptions.category'),
      cell: (row) =>
        row.category === null ? (
          t('opportunities.subscriptions.anyCategory')
        ) : (
          <>
            <span>{row.category.name}</span>
            <span className="tiq-cell-sub tiq-mono">{row.category.code}</span>
          </>
        ),
    },
    {
      id: 'active',
      header: t('opportunities.subscriptions.col.state'),
      cell: (row) =>
        row.active ? (
          <Chip tone="success" size="sm">
            {t('opportunities.subscriptions.active')}
          </Chip>
        ) : (
          <Chip tone="neutral" size="sm">
            {t('opportunities.subscriptions.pausedChip')}
          </Chip>
        ),
    },
    {
      id: 'createdAt',
      header: t('opportunities.subscriptions.col.created'),
      cell: (row) => formatDateTime(row.createdAt, timeZone),
    },
    {
      id: 'actions',
      header: (
        <span className="tiq-visually-hidden">{t('opportunities.discover.col.actions')}</span>
      ),
      cell: (row) => (
        <div className="tiq-row-actions">
          <Button
            size="sm"
            icon={row.active ? 'pause' : 'play'}
            loading={busy === row.id}
            onClick={() => void toggle(row)}
          >
            {row.active
              ? t('opportunities.subscriptions.pause')
              : t('opportunities.subscriptions.resume')}
          </Button>
          <Button size="sm" variant="ghost" icon="trash" onClick={() => setDeleting(row)}>
            {t('opportunities.actions.delete')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="tiq-stack tiq-stack--spaced">
      <FilterBar
        label={t('opportunities.subscriptions.filters')}
        onClear={() => setActiveFilter('')}
        canClear={activeFilter !== ''}
      >
        <Select
          label={t('opportunities.subscriptions.col.state')}
          placeholder={t('opportunities.common.all')}
          value={activeFilter}
          options={[
            { value: 'active', label: t('opportunities.subscriptions.active') },
            { value: 'paused', label: t('opportunities.subscriptions.pausedChip') },
          ]}
          onChange={setActiveFilter}
        />
      </FilterBar>
      <Card
        flush
        title={t('opportunities.subscriptions.title')}
        subtitle={t('opportunities.subscriptions.intro')}
        actions={
          <Button size="sm" variant="primary" icon="bell" onClick={() => setCreating(true)}>
            {t('opportunities.subscriptions.new')}
          </Button>
        }
      >
        <DataTable
          caption={t('opportunities.subscriptions.caption')}
          columns={columns}
          rows={rows}
          rowKey={(row) => String(row.id)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          empty={<EmptyState compact icon="bell" title={t('opportunities.subscriptions.empty')} />}
        />
      </Card>
      <SubscriptionDialog
        open={creating}
        filters={filters}
        onClose={() => setCreating(false)}
        onSaved={(subscription) => {
          setCreating(false);
          setChanged((current) => new Map(current).set(subscription.id, subscription));
          toast.show(t('opportunities.subscriptions.created'), 'success');
        }}
      />
      <ConfirmActionDialog
        open={deleting !== null}
        tone="danger"
        title={t('opportunities.subscriptions.deleteTitle')}
        scope={
          deleting === null
            ? ''
            : [deleting.buyer?.name, deleting.category?.name]
                .filter((part) => part !== undefined)
                .join(' · ')
        }
        consequence={t('opportunities.subscriptions.deleteConsequence')}
        confirmLabel={t('opportunities.actions.delete')}
        pending={remove.pending}
        error={withPublicationMessage(remove.error)}
        onCancel={() => {
          remove.reset();
          setDeleting(null);
        }}
        onConfirm={async () => {
          if (deleting === null) return;
          try {
            await remove.mutate({ params: { subscriptionId: deleting.id } });
            setDeleted((current) => new Set(current).add(deleting.id));
            toast.show(t('opportunities.subscriptions.deleted'), 'success');
            setDeleting(null);
          } catch {
            // Shown in the dialog.
          }
        }}
      />
    </div>
  );
}
