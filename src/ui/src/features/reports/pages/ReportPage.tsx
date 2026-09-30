/**
 * REP-01 — One management report (FR-21, PRD §15.1–15.2, AC-34). Runs a report family over the records the caller
 * may read and states every safeguard beside the numbers: unique organizations rather than revisions, whether each
 * row is event-level or lot-level (lot rows are never added to their event), the currency basis and conversion
 * date, and completeness (missing data is shown as missing, never as zero). Rows drill through to the supporting
 * record when the caller may open it; restricted fields are redacted and listed.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import type { JsonObject } from '@contracts/common';
import { REPORT_DEFINITIONS_FAMILY } from '@contracts/enums';
import { REPORT_LEVEL_FILTERS, reportingEndpoints } from '@contracts/reporting';
import type { ReportResult, ReportRow, SavedView } from '@contracts/reporting';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import { BarList } from '../../../components/charts';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Chip,
  DataTable,
  DateInput,
  DetailList,
  EmptyState,
  ErrorState,
  FilterBar,
  FooterBar,
  KpiCard,
  KpiGrid,
  PageHeader,
  QuickRanges,
  RestrictedState,
  SearchField,
  Select,
  SkeletonBlock,
  TextField,
  formErrors,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { clockDate } from '../../../lib/clock';
import { formatCalendarDate, formatCount } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { NotFoundPage } from '../../../pages/NotFoundPage';
import { SavedViewsMenu } from '../../search/components/SavedViews';
import { ExportDialog } from '../components/ExportDialog';
import { ReportCellView } from '../components/ReportCellView';
import { cellText } from '../lib/cells';
import { EMPTY_FILTERS, FAMILY_ICON } from '../lib/definitions';
import { useDimensionOptions } from '../lib/dimensions';
import { QUICK_RANGES, compact, idOf, oneOf, quickRangeDates } from '../lib/shared';

const DEFAULTS = {
  range: '',
  from: '',
  to: '',
  level: 'both',
  q: '',
  currency: '',
  legalEntityId: '',
  departmentId: '',
  categoryId: '',
  ownerUserId: '',
};
type Filters = typeof DEFAULTS;

const TOTAL_ROW_ID = '__totals';

export default function ReportPage() {
  const { family: raw = '' } = useParams();
  const family = oneOf(raw, REPORT_DEFINITIONS_FAMILY);
  if (family === undefined) {
    return <NotFoundPage inShell />;
  }
  return <ReportView key={family} family={family} />;
}

function filtersOfView(view: SavedView): Partial<Filters> {
  const next: Partial<Filters> = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS) as (keyof Filters)[]) {
    const value = view.filters[key];
    if (typeof value === 'string' || typeof value === 'number') next[key] = String(value);
  }
  return next;
}

function ReportView({ family }: { readonly family: (typeof REPORT_DEFINITIONS_FAMILY)[number] }) {
  const tenant = useActiveTenant();
  const canExport = usePermission('export.create');
  const canManage = usePermission('report.manage');
  const options = useDimensionOptions();
  const [filters, setFilters, clearFilters] = useScreenFilters(`REP-01:${family}`, DEFAULTS);
  const [search, setSearch] = useState(filters.q);
  const [exporting, setExporting] = useState(false);

  const level = oneOf(filters.level, REPORT_LEVEL_FILTERS) ?? 'both';
  const query = useApiQuery(reportingEndpoints.runReport, {
    params: { family },
    query: {
      level,
      ...compact({
        from: filters.from,
        to: filters.to,
        q: filters.q.trim(),
        currency: filters.currency.trim().toUpperCase(),
        legalEntityId: idOf(filters.legalEntityId),
        departmentId: idOf(filters.departmentId),
        categoryId: idOf(filters.categoryId),
        ownerUserId: idOf(filters.ownerUserId),
      }),
    },
  });
  const errors = formErrors(query.error, ['from', 'to', 'currency', 'q']);
  const data = query.data;
  const currency = data?.currencyBasis.currency ?? tenant?.defaultCurrency ?? 'BWP';
  const filtered = (Object.keys(DEFAULTS) as (keyof Filters)[]).some(
    (key) => filters[key] !== DEFAULTS[key],
  );
  const current: JsonObject = compact({ ...filters }) as JsonObject;
  const restricted =
    query.error !== null &&
    (query.error.kind === 'forbidden' || query.error.code === 'REPORT_FAMILY_RESTRICTED');

  const exportFilters = {
    ...EMPTY_FILTERS,
    from: filters.from === '' ? null : filters.from,
    to: filters.to === '' ? null : filters.to,
    level,
    legalEntityIds:
      idOf(filters.legalEntityId) === undefined ? [] : [Number(filters.legalEntityId)],
    departmentIds: idOf(filters.departmentId) === undefined ? [] : [Number(filters.departmentId)],
    categoryIds: idOf(filters.categoryId) === undefined ? [] : [Number(filters.categoryId)],
    ownerUserIds: idOf(filters.ownerUserId) === undefined ? [] : [Number(filters.ownerUserId)],
  };

  return (
    <div className="tiq-page">
      <PageHeader
        title={data?.title ?? t(`reports.families.${family}`)}
        subtitle={data?.description}
        back={{ to: '/buyer/reports', label: t('reports.report.back') }}
        meta={
          data === undefined ? undefined : (
            <>
              <Chip tone="info" size="sm" icon="layers">
                {t(`reports.report.levels.${data.levelBasis.level}`)}
              </Chip>
              <Chip tone="neutral" size="sm" icon="coins">
                {t('reports.report.currencyChip', { currency: data.currencyBasis.currency })}
              </Chip>
              <Chip tone={data.completeness.complete ? 'success' : 'warning'} size="sm">
                {data.completeness.complete
                  ? t('reports.report.complete')
                  : t('reports.report.incompleteChip', {
                      count: data.completeness.recordsWithMissingData,
                    })}
              </Chip>
            </>
          )
        }
        primaryAction={
          canExport ? (
            <Button
              variant="primary"
              icon="download"
              disabled={data === undefined}
              onClick={() => setExporting(true)}
            >
              {t('reports.report.export')}
            </Button>
          ) : undefined
        }
        actions={
          <>
            <SavedViewsMenu
              scope="REP-01"
              current={{ family, ...current }}
              onApply={(view) => {
                const next = filtersOfView(view);
                setSearch(next.q ?? '');
                setFilters(next);
              }}
            />
            {canManage && (
              <ButtonLink to={`/buyer/reports/definitions/new?family=${family}`} icon="bookOpen">
                {t('reports.report.saveDefinition')}
              </ButtonLink>
            )}
          </>
        }
      />

      <FilterBar
        label={t('reports.report.filters')}
        onClear={() => {
          setSearch('');
          clearFilters();
        }}
        canClear={filtered}
        quickRanges={
          <QuickRanges
            label={t('reports.report.quickRanges')}
            options={QUICK_RANGES.map((id) => ({ id, label: t(`reports.ranges.${id}`) }))}
            selected={filters.range === '' ? null : filters.range}
            onSelect={(id) => {
              const range = oneOf(id, QUICK_RANGES);
              if (range === undefined) return;
              setFilters({ range, ...quickRangeDates(range, clockDate()) });
            }}
          />
        }
      >
        <SearchField
          label={t('reports.report.search')}
          value={search}
          onChange={setSearch}
          onSubmit={(value) => setFilters({ q: value.trim() })}
          placeholder={t('reports.report.searchPlaceholder')}
        />
        <DateInput
          label={t('reports.report.from')}
          value={filters.from}
          onChange={(from) => setFilters({ from, range: '' })}
          error={errors.forField('from')}
        />
        <DateInput
          label={t('reports.report.to')}
          value={filters.to}
          onChange={(to) => setFilters({ to, range: '' })}
          error={errors.forField('to')}
        />
        <Select
          label={t('reports.report.level')}
          value={level}
          options={REPORT_LEVEL_FILTERS.map((value) => ({
            value,
            label: t(`reports.report.levels.${value}`),
          }))}
          onChange={(value) => setFilters({ level: value })}
        />
        <Select
          label={t('reports.report.entity')}
          value={filters.legalEntityId}
          placeholder={t('reports.report.all')}
          options={options.legalEntities.map((item) => ({
            value: String(item.id),
            label: item.label,
          }))}
          onChange={(legalEntityId) => setFilters({ legalEntityId })}
        />
        <Select
          label={t('reports.report.department')}
          value={filters.departmentId}
          placeholder={t('reports.report.all')}
          options={options.departments.map((item) => ({
            value: String(item.id),
            label: item.label,
          }))}
          onChange={(departmentId) => setFilters({ departmentId })}
        />
        <Select
          label={t('reports.report.category')}
          value={filters.categoryId}
          placeholder={t('reports.report.all')}
          options={options.categories.map((item) => ({
            value: String(item.id),
            label: item.label,
          }))}
          onChange={(categoryId) => setFilters({ categoryId })}
        />
        <Select
          label={t('reports.report.owner')}
          value={filters.ownerUserId}
          placeholder={t('reports.report.all')}
          options={options.owners.map((item) => ({
            value: String(item.userId),
            label: item.fullName,
          }))}
          onChange={(ownerUserId) => setFilters({ ownerUserId })}
        />
        <TextField
          label={t('reports.report.currency')}
          hint={t('reports.report.currencyHint')}
          value={filters.currency}
          maxLength={3}
          placeholder={tenant?.defaultCurrency ?? 'BWP'}
          onChange={(value) => setFilters({ currency: value.toUpperCase() })}
          error={errors.forField('currency')}
        />
      </FilterBar>

      {restricted ? (
        <Card>
          <RestrictedState description={t('reports.report.restricted')} />
        </Card>
      ) : (
        <>
          {query.error !== null && (
            <ErrorState
              error={query.error}
              onRetry={query.reload}
              title={t('reports.report.loadError')}
            />
          )}
          {data === undefined ? (
            query.error === null && <SkeletonBlock lines={10} />
          ) : (
            <ReportBody data={data} />
          )}
        </>
      )}

      <ExportDialog
        open={exporting}
        onClose={() => setExporting(false)}
        source={{ kind: 'family', family, filters: exportFilters, currency }}
        scopeLabel={t('reports.report.exportScope', {
          report: data?.title ?? t(`reports.families.${family}`),
          period: periodText(data),
          level: t(`reports.report.levels.${level}`),
          currency,
        })}
      />
      <FooterBar
        currency={data?.currencyBasis.currency ?? null}
        asOf={data?.asOf ?? null}
        timeZone={tenant?.officialTimeZone ?? 'UTC'}
        conversionNote={
          data?.currencyBasis.conversionDate
            ? t('reports.report.convertedOn', {
                date: formatCalendarDate(data.currencyBasis.conversionDate),
              })
            : undefined
        }
        refreshing={query.isFetching}
        onRefresh={query.reload}
      />
    </div>
  );
}

function periodText(data: ReportResult | undefined): string {
  if (data === undefined || (data.period.from === null && data.period.to === null)) {
    return t('reports.report.allDates');
  }
  return t('reports.report.period', {
    from: data.period.from === null ? '…' : formatCalendarDate(data.period.from),
    to: data.period.to === null ? '…' : formatCalendarDate(data.period.to),
  });
}

interface DisplayRow extends ReportRow {
  readonly total?: boolean;
}

function ReportBody({ data }: { readonly data: ReportResult }) {
  const rows: DisplayRow[] = [...data.rows];
  if (data.totals !== null && data.rows.length > 0) {
    rows.push({
      id: TOTAL_ROW_ID,
      level: 'event',
      parentId: null,
      cells: data.totals,
      drillThrough: null,
      total: true,
    });
  }
  const firstKey = data.columns[0]?.key;

  const columns: DataTableColumn<DisplayRow>[] = [
    {
      id: '__level',
      header: t('reports.report.col.rowType'),
      cell: (row) =>
        row.total === true ? (
          <Chip tone="accent" size="sm">
            {t('reports.report.totalRow')}
          </Chip>
        ) : (
          <Chip
            tone={row.level === 'lot' ? 'neutral' : 'info'}
            size="sm"
            outlined={row.level === 'lot'}
          >
            {t(`reports.report.rowLevels.${row.level}`)}
          </Chip>
        ),
    },
    ...data.columns.map((column): DataTableColumn<DisplayRow> => ({
      id: column.key,
      header: column.label,
      numeric: column.numeric,
      cell: (row) => {
        const cell = row.cells[column.key];
        if (row.total === true && cell === undefined) return null;
        if (column.key === firstKey && row.level === 'lot' && row.total !== true) {
          return (
            <span className="tiq-inline" style={{ paddingLeft: 'var(--tiq-space-4)' }}>
              <ReportCellView cell={cell} />
            </span>
          );
        }
        return row.total === true ? (
          <strong>
            <ReportCellView cell={cell} />
          </strong>
        ) : (
          <ReportCellView cell={cell} />
        );
      },
    })),
    {
      id: '__drill',
      header: t('reports.report.col.record'),
      cell: (row) =>
        row.drillThrough === null ? (
          row.total === true ? null : (
            <span className="tiq-text-muted">{t('reports.report.noDrill')}</span>
          )
        ) : (
          <Link
            to={row.drillThrough}
            aria-label={t('reports.report.drillNamed', {
              row: cellText(firstKey === undefined ? undefined : row.cells[firstKey]),
            })}
          >
            {t('reports.report.drill')}
          </Link>
        ),
    },
  ];

  return (
    <>
      {!data.completeness.complete && (
        <Banner tone="warning" title={t('reports.report.incompleteTitle')}>
          <p>
            {t('reports.report.incompleteSummary', {
              missing: data.completeness.recordsWithMissingData,
              included: data.completeness.recordsIncluded,
            })}
          </p>
          <ul>
            {data.completeness.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Banner>
      )}

      {data.highlights.length > 0 && (
        <KpiGrid>
          {data.highlights.map((highlight) => (
            <KpiCard
              key={highlight.key}
              label={highlight.label}
              icon={FAMILY_ICON[data.family]}
              value={
                highlight.cell.kind === 'missing' || highlight.cell.kind === 'restricted' ? (
                  <ReportCellView cell={highlight.cell} />
                ) : (
                  cellText(highlight.cell)
                )
              }
              restricted={highlight.cell.kind === 'restricted'}
            />
          ))}
        </KpiGrid>
      )}

      <div className="tiq-grid tiq-grid--sidebar">
        <Card title={t('reports.report.basisTitle')} subtitle={t('reports.report.basisSubtitle')}>
          <DetailList
            items={[
              {
                key: 'level',
                label: t('reports.report.levelBasis'),
                value: data.levelBasis.note,
              },
              {
                key: 'currency',
                label: t('reports.report.currencyBasis'),
                value: (
                  <>
                    <span>{data.currencyBasis.note}</span>
                    <span className="tiq-cell-sub">
                      {data.currencyBasis.conversionDate === null
                        ? t('reports.report.noConversion', {
                            currency: data.currencyBasis.currency,
                          })
                        : t('reports.report.convertedOn', {
                            date: formatCalendarDate(data.currencyBasis.conversionDate),
                          })}
                    </span>
                  </>
                ),
              },
              {
                key: 'period',
                label: t('reports.report.periodLabel'),
                value: periodText(data),
              },
              ...data.countingBasis.map((item) => ({
                key: `metric-${item.metric}`,
                label: item.metric,
                value: item.definition,
              })),
            ]}
          />
        </Card>
        <Card
          title={data.chart?.title ?? t('reports.report.completenessTitle')}
          subtitle={data.chart === null ? undefined : t('reports.report.chartHint')}
        >
          {data.chart !== null ? (
            <BarList
              label={data.chart.title}
              showShare={false}
              items={data.chart.items.map((item) => ({
                id: item.id,
                label: item.label,
                value: item.value,
                display: item.display,
              }))}
            />
          ) : (
            <DetailList
              items={[
                {
                  key: 'included',
                  label: t('reports.report.recordsIncluded'),
                  value: formatCount(data.completeness.recordsIncluded),
                },
                {
                  key: 'missing',
                  label: t('reports.report.recordsMissing'),
                  value: formatCount(data.completeness.recordsWithMissingData),
                },
              ]}
            />
          )}
        </Card>
      </div>

      <Card
        flush
        title={t('reports.report.rowsTitle')}
        subtitle={t('reports.report.rowsSubtitle', {
          count: data.rows.length,
          included: data.completeness.recordsIncluded,
        })}
      >
        <DataTable
          caption={t('reports.report.rowsCaption', { report: data.title })}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          empty={
            <EmptyState
              compact
              icon="barChart"
              title={t('reports.report.empty')}
              description={t('reports.report.emptyHint')}
            />
          }
        />
      </Card>

      {data.redactions.length > 0 && (
        <Card
          title={t('reports.report.redactionsTitle')}
          subtitle={t('reports.report.redactionsSubtitle')}
        >
          <DetailList
            items={data.redactions.map((item) => ({
              key: item.field,
              label: item.field,
              value: item.reason,
            }))}
          />
        </Card>
      )}
    </>
  );
}
