/**
 * EVA-03 — Clarification coordination: the questions assessors raised to suppliers after opening, their duplication
 * (merged questions), the permitted scope, the supplier's response and its recorded effect. The chair merges
 * duplicates and approves; approved questions are issued. Evaluators without oversight see only the questions they
 * raised and the answers distributed to them (the API filters; the page says so).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { openingEndpoints } from '@contracts/opening';
import type { ClarificationRow } from '@contracts/opening';
import type { BidClarificationsSource, BidClarificationsStatus } from '@contracts/enums';

import { useAppSelector } from '../../../app/hooks';
import { invalidateApiQueries, useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  Checkbox,
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
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { ConsolidateDialog } from '../components/ConsolidateDialog';
import { oneOf, textOrUndefined, useListState } from '../lib/listState';
import { enumSelectOptions } from '../lib/options';
import { openingPaths } from '../lib/paths';

function shorten(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

const OVERSIGHT = ['compliance.assess', 'evaluation.chair', 'exclusion.approve'] as const;

function Kpis() {
  const count = { page: 1, pageSize: 1 } as const;
  const drafts = useApiQuery(openingEndpoints.listClarifications, {
    query: { ...count, status: ['draft'] },
  });
  const approved = useApiQuery(openingEndpoints.listClarifications, {
    query: { ...count, status: ['approved'] },
  });
  const issued = useApiQuery(openingEndpoints.listClarifications, {
    query: { ...count, status: ['issued'] },
  });
  const responded = useApiQuery(openingEndpoints.listClarifications, {
    query: { ...count, status: ['responded'] },
  });
  const value = (total: number | undefined) =>
    total === undefined ? t('opening.kpi.loading') : formatCount(total);
  return (
    <KpiGrid>
      <KpiCard
        label={t('opening.kpi.drafts')}
        value={value(drafts.data?.total)}
        icon="edit"
        tone="warning"
        hint={t('opening.kpi.draftsHint')}
      />
      <KpiCard
        label={t('opening.kpi.approvedToIssue')}
        value={value(approved.data?.total)}
        icon="checkSquare"
        tone="accent"
      />
      <KpiCard
        label={t('opening.kpi.awaitingSupplier')}
        value={value(issued.data?.total)}
        icon="hourglass"
        tone="info"
      />
      <KpiCard
        label={t('opening.kpi.awaitingEffect')}
        value={value(responded.data?.total)}
        icon="messageSquare"
        tone="success"
        hint={t('opening.kpi.awaitingEffectHint')}
      />
    </KpiGrid>
  );
}

export default function ClarificationsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const userId = useAppSelector((state) => state.session.user?.id ?? null);
  const oversight = usePermission(OVERSIGHT);
  const isChair = usePermission('evaluation.chair');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [consolidating, setConsolidating] = useState(false);
  const list = useListState(
    'EVA-03',
    {
      q: '',
      status: '',
      source: '',
      mine: false as boolean,
      includeConsolidated: false as boolean,
      dueFrom: '',
      dueTo: '',
    },
    { key: 'dueAt' as const, dir: 'asc' },
  );
  const { filters } = list;
  const query = useApiQuery(openingEndpoints.listClarifications, {
    query: {
      ...list.paging,
      q: textOrUndefined(filters.q),
      status: oneOf<BidClarificationsStatus>(filters.status),
      source: oneOf<BidClarificationsSource>(filters.source),
      raisedBy: filters.mine && userId !== null ? userId : undefined,
      includeConsolidated: filters.includeConsolidated ? true : undefined,
      dueFrom: textOrUndefined(filters.dueFrom),
      dueTo: textOrUndefined(filters.dueTo),
    },
  });
  const rows = query.data?.items;
  const selectedDrafts = (rows ?? []).filter(
    (row) =>
      selected.has(String(row.id)) && row.status === 'draft' && row.consolidatedIntoId === null,
  );
  const selectionHasNonDraft = selectedDrafts.length !== selected.size;

  const columns: DataTableColumn<ClarificationRow>[] = [
    {
      id: 'reference',
      header: t('opening.columns.reference'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference
            value={t('opening.clarification.number', { id: row.id })}
            to={openingPaths.clarification(row.id)}
          />
          <span className="tiq-cell-sub">{row.tenderReference}</span>
        </>
      ),
    },
    {
      id: 'supplier',
      header: t('opening.columns.supplier'),
      cell: (row) => row.supplier.name,
    },
    {
      id: 'question',
      header: t('opening.columns.question'),
      cell: (row) => (
        <>
          {shorten(row.question, 140)}
          <span className="tiq-cell-sub">
            {t('opening.clarification.scopeShort', { scope: shorten(row.permittedScope, 90) })}
          </span>
        </>
      ),
    },
    {
      id: 'source',
      header: t('opening.columns.source'),
      cell: (row) => tEnum('bid_clarifications.source', row.source),
    },
    {
      id: 'status',
      sortable: true,
      header: t('opening.columns.status'),
      cell: (row) =>
        row.consolidatedIntoId === null ? (
          <StatusChip enum="bid_clarifications.status" value={row.status} />
        ) : (
          <Reference
            value={t('opening.clarification.mergedInto', { id: row.consolidatedIntoId })}
            to={openingPaths.clarification(row.consolidatedIntoId)}
          />
        ),
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
      id: 'raisedAt',
      header: t('opening.columns.raisedBy'),
      sortable: true,
      cell: (row) => row.raisedBy.fullName,
    },
    {
      id: 'merged',
      header: t('opening.columns.merged'),
      numeric: true,
      cell: (row) => formatCount(row.consolidatedCount),
    },
    {
      id: 'effect',
      header: t('opening.columns.effect'),
      cell: (row) =>
        row.effect === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <StatusChip enum="bid_clarifications.effect" value={row.effect} size="sm" />
        ),
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('opening.coordination.title')}
        subtitle={t('opening.coordination.subtitle')}
      />
      {!oversight && (
        <Banner tone="info" title={t('opening.coordination.ownTitle')}>
          {t('opening.coordination.own')}
        </Banner>
      )}
      <Kpis />
      <FilterBar onClear={list.clear} canClear={list.canClear}>
        <SearchField
          label={t('opening.filters.search')}
          placeholder={t('opening.filters.searchClarifications')}
          value={filters.q}
          onChange={(q) => list.update({ q })}
        />
        <Select
          label={t('opening.filters.status')}
          value={filters.status}
          onChange={(status) => list.update({ status })}
          placeholder={t('opening.filters.allStatuses')}
          options={enumSelectOptions('bid_clarifications.status')}
        />
        <Select
          label={t('opening.filters.source')}
          value={filters.source}
          onChange={(source) => list.update({ source })}
          placeholder={t('opening.filters.allSources')}
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
        <Checkbox
          label={t('opening.filters.raisedByMe')}
          checked={filters.mine}
          onChange={(mine) => list.update({ mine })}
        />
        <Checkbox
          label={t('opening.filters.includeMerged')}
          checked={filters.includeConsolidated}
          onChange={(includeConsolidated) => list.update({ includeConsolidated })}
        />
      </FilterBar>
      <Card flush>
        <DataTable
          caption={t('opening.coordination.caption')}
          columns={columns}
          rows={rows}
          rowKey={(row) => String(row.id)}
          onRowClick={(row) => {
            void navigate(openingPaths.clarification(row.id));
          }}
          rowLabel={(row) => t('opening.clarification.number', { id: row.id })}
          selection={
            isChair
              ? {
                  selected,
                  onChange: setSelected,
                  actions: (
                    <>
                      {selectionHasNonDraft && (
                        <span className="tiq-text-warning">
                          {t('opening.consolidate.onlyDrafts')}
                        </span>
                      )}
                      <Button
                        size="sm"
                        icon="layers"
                        disabled={selectedDrafts.length < 2}
                        onClick={() => setConsolidating(true)}
                      >
                        {t('opening.consolidate.action')}
                      </Button>
                    </>
                  ),
                }
              : undefined
          }
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={list.sort}
          onSortChange={list.onSortChange}
          empty={
            <EmptyState
              compact
              icon="messageQuestion"
              title={t('opening.clarifications.none')}
              description={oversight ? undefined : t('opening.coordination.own')}
            />
          }
          pagination={query.data === undefined ? undefined : list.pagination(query.data.total)}
        />
      </Card>
      {consolidating && selectedDrafts[0] !== undefined && (
        <ConsolidateDialog
          drafts={selectedDrafts}
          initialTargetId={selectedDrafts[0].id}
          initialSelected={selectedDrafts.map((row) => row.id)}
          onClose={() => setConsolidating(false)}
          onConsolidated={(result) => {
            setConsolidating(false);
            setSelected(new Set());
            invalidateApiQueries('buyer.opening.listClarifications');
            toast.show(
              t('opening.consolidate.done', { id: result.id, count: result.consolidatedCount }),
              'success',
            );
          }}
        />
      )}
    </div>
  );
}
