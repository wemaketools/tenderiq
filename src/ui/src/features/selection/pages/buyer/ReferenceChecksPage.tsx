/**
 * BUY-22 — Reference checks: every referee with consent, contact time, feedback (restricted when confidential and
 * the caller may not read it) and outcome. Actions: add a referee for a candidate of the selected tender and record
 * feedback, which is refused without consent (FR-15).
 */
import { useState } from 'react';

import { selectionEndpoints } from '@contracts/selection';
import type { ReferenceCheck } from '@contracts/selection';

import { useApiQuery } from '../../../../api/hooks';
import { useScreenFilters } from '../../../../app/hooks';
import { usePermission } from '../../../../auth/permissions';
import {
  Button,
  Card,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  PageHeader,
  SearchField,
  Select,
} from '../../../../components/ui';
import { formatCount } from '../../../../lib/format';
import { t } from '../../../../lib/i18n';
import {
  CreateReferenceCheckDialog,
  RecordFeedbackDialog,
} from '../../components/ReferenceCheckDialogs';
import { ReferenceCheckTable } from '../../components/ReferenceCheckTable';
import { SelectionPage } from '../../components/SelectionPage';
import { TenderSelect } from '../../components/TenderSelect';
import { useTenderFilter } from '../../lib/hooks';
import { booleanOf, compact, directionOf, idOf, sortOf, tableSort } from '../../lib/lists';
import { SELECTION_MANAGE } from '../../lib/permissions';

const SORTS = ['refereeName', 'contactedAt', 'updatedAt'] as const;
const DEFAULTS = {
  q: '',
  tender: '',
  consent: '',
  recorded: '',
  sort: 'updatedAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

export default function ReferenceChecksPage() {
  const canManage = usePermission(SELECTION_MANAGE);
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-22-REF', DEFAULTS);
  const [tender, setTender, clearTenderLink] = useTenderFilter(filters.tender, (value) =>
    setFilters({ tender: value, page: 1 }),
  );
  const [adding, setAdding] = useState(false);
  const [feedbackFor, setFeedbackFor] = useState<ReferenceCheck | null>(null);
  const [changed, setChanged] = useState<Readonly<Record<number, ReferenceCheck>>>({});
  const tenderId = idOf(tender);

  const query = useApiQuery(selectionEndpoints.listReferenceChecks, {
    query: compact({
      q: filters.q.trim(),
      tenderId,
      consentConfirmed: booleanOf(filters.consent),
      recorded: booleanOf(filters.recorded),
      sort: sortOf(filters.sort, SORTS, 'updatedAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(selectionEndpoints.listReferenceChecks, {
    query: compact({ tenderId, pageSize: 100 }),
  });
  const summary = useApiQuery(
    selectionEndpoints.getTender,
    tenderId === undefined ? null : { params: { tenderId } },
  );
  const all = overview.data?.items ?? [];
  const loadingValue = overview.data === undefined ? '…' : null;
  const kpiRestricted = overview.error?.kind === 'forbidden';
  const created = Object.values(changed).filter(
    (item) =>
      !(query.data?.items ?? []).some((row) => row.referenceCheckId === item.referenceCheckId),
  );
  const rows =
    query.data === undefined
      ? undefined
      : [...created, ...query.data.items.map((row) => changed[row.referenceCheckId] ?? row)];
  const save = (check: ReferenceCheck): void => {
    setChanged((current) => ({ ...current, [check.referenceCheckId]: check }));
  };

  const filtered =
    filters.q !== '' || tender !== '' || filters.consent !== '' || filters.recorded !== '';

  return (
    <SelectionPage
      header={
        <PageHeader
          title={t('selection.references.pageTitle')}
          subtitle={t('selection.references.intro')}
          primaryAction={
            canManage ? (
              <Button
                variant="primary"
                icon="userPlus"
                disabled={summary.data === undefined}
                title={
                  summary.data === undefined ? t('selection.references.pickTender') : undefined
                }
                onClick={() => setAdding(true)}
              >
                {t('selection.references.add')}
              </Button>
            ) : undefined
          }
        />
      }
    >
      <FilterBar
        label={t('selection.common.filters')}
        onClear={() => {
          clearFilters();
          clearTenderLink();
        }}
        canClear={filtered}
      >
        <SearchField
          label={t('selection.common.search')}
          placeholder={t('selection.references.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <TenderSelect mode="filter" value={tender} onChange={setTender} />
        <Select
          label={t('selection.references.filter.consent')}
          placeholder={t('selection.common.all')}
          value={filters.consent}
          options={[
            { value: 'true', label: t('selection.references.consentGiven') },
            { value: 'false', label: t('selection.references.consentMissing') },
          ]}
          onChange={(consent) => setFilters({ consent, page: 1 })}
        />
        <Select
          label={t('selection.references.filter.recorded')}
          placeholder={t('selection.common.all')}
          value={filters.recorded}
          options={[
            { value: 'true', label: t('selection.references.filter.feedbackRecorded') },
            { value: 'false', label: t('selection.references.filter.feedbackOutstanding') },
          ]}
          onChange={(recorded) => setFilters({ recorded, page: 1 })}
        />
      </FilterBar>
      {canManage && summary.data === undefined && (
        <p className="tiq-text-muted">{t('selection.references.pickTender')}</p>
      )}
      <KpiGrid>
        <KpiCard
          label={t('selection.references.kpi.total')}
          icon="users"
          value={loadingValue ?? formatCount(all.length)}
          hint={t('selection.references.kpi.totalHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.references.kpi.noConsent')}
          icon="ban"
          tone="danger"
          value={loadingValue ?? formatCount(all.filter((row) => !row.consentConfirmed).length)}
          hint={t('selection.references.kpi.noConsentHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.references.kpi.outstanding')}
          icon="hourglass"
          tone="warning"
          value={
            loadingValue ??
            formatCount(all.filter((row) => row.outcome === null && !row.feedbackRestricted).length)
          }
          hint={t('selection.references.kpi.outstandingHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.references.kpi.recorded')}
          icon="checkCircle"
          tone="success"
          value={loadingValue ?? formatCount(all.filter((row) => row.outcome !== null).length)}
          hint={t('selection.references.kpi.recordedHint')}
          restricted={kpiRestricted}
        />
      </KpiGrid>
      <Card flush>
        <ReferenceCheckTable
          caption={t('selection.references.pageTitle')}
          showTender
          checks={rows}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          onRecordFeedback={canManage ? setFeedbackFor : undefined}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={
                filtered ? t('selection.common.emptyFiltered') : t('selection.references.empty')
              }
            />
          }
          pagination={
            query.data === undefined
              ? undefined
              : {
                  page: query.data.page,
                  pageSize: query.data.pageSize,
                  total: query.data.total,
                  onPageChange: (page) => setFilters({ page }),
                  onPageSizeChange: (pageSize) => setFilters({ pageSize, page: 1 }),
                }
          }
        />
      </Card>
      {adding && summary.data !== undefined && (
        <CreateReferenceCheckDialog
          tender={{
            tenderId: summary.data.tender.tenderId,
            reference: summary.data.tender.reference,
            title: summary.data.tender.title,
            officialTimeZone: summary.data.tender.officialTimeZone,
          }}
          bids={summary.data.candidates.map((candidate) => candidate.bid)}
          onClose={() => setAdding(false)}
          onCreated={(check) => {
            save(check);
            setAdding(false);
          }}
        />
      )}
      {feedbackFor !== null && (
        <RecordFeedbackDialog
          check={feedbackFor}
          onClose={() => setFeedbackFor(null)}
          onRecorded={(check) => {
            save(check);
            setFeedbackFor(null);
          }}
        />
      )}
    </SelectionPage>
  );
}
