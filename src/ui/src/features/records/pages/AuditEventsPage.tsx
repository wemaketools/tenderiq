/**
 * ADM-14 — Audit viewer (FR-22, PRD §18.2, DD-31): business actions and access events of the active buyer, each
 * showing who acted, in which capacity, on behalf of whom, under support access or not, when, on which record,
 * with which reason. Restricted rows (sealed content, evaluator scores) are metadata only. Records under a hold are
 * flagged; history is never edited.
 *
 * `?entityType=<type>&entityId=<id>` scopes the viewer to one record's history: the drill-through for held records
 * that have no feature page of their own (for example the imported legacy tender under the AC-35 legal hold).
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import {
  AUDIT_EVENT_CATEGORIES,
  AUDIT_EVENT_SORT_FIELDS,
  recordsEndpoints,
} from '@contracts/records';
import type { RecordAuditEvent } from '@contracts/records';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import {
  Banner,
  Button,
  Card,
  Chip,
  DataTable,
  DateInput,
  DetailList,
  Dialog,
  EmptyState,
  FilterBar,
  SearchField,
  Select,
  StatusChip,
  formErrors,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { compact, idOf, oneOf } from '../../reports/lib/shared';
import { RecordsHeader } from '../components/RecordsHeader';

const DEFAULTS = {
  category: '',
  sensitivity: '',
  action: '',
  entityType: '',
  from: '',
  to: '',
  actor: '',
  sort: 'occurredAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

const ACTION_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const ENTITY_PATTERN = /^[a-z][a-z0-9_]{1,62}$/;

function actorText(row: RecordAuditEvent): string {
  return row.actor?.fullName ?? t('records.audit.system');
}

export default function AuditEventsPage() {
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const [filters, setFilters, clearFilters] = useScreenFilters('ADM-14:audit', DEFAULTS);
  const [actionText, setActionText] = useState(filters.action);
  const [inspecting, setInspecting] = useState<RecordAuditEvent | null>(null);
  const category = oneOf(filters.category, AUDIT_EVENT_CATEGORIES);
  const sensitivity = oneOf(filters.sensitivity, ['normal', 'restricted'] as const);
  const action = ACTION_PATTERN.test(filters.action) ? filters.action : undefined;
  const [searchParams, setSearchParams] = useSearchParams();
  const scopedType = searchParams.get('entityType') ?? '';
  const scopedIdText = searchParams.get('entityId') ?? '';
  const scoped =
    ENTITY_PATTERN.test(scopedType) && /^[1-9][0-9]{0,15}$/.test(scopedIdText)
      ? { entityType: scopedType, entityId: Number(scopedIdText) }
      : null;
  const entityType =
    scoped?.entityType ??
    (ENTITY_PATTERN.test(filters.entityType) ? filters.entityType : undefined);
  const query = useApiQuery(recordsEndpoints.listAuditEvents, {
    query: {
      ...compact({
        category: category === undefined ? undefined : [category],
        sensitivity: sensitivity === undefined ? undefined : [sensitivity],
        action: action === undefined ? undefined : [action],
        entityType: entityType === undefined ? undefined : [entityType],
        entityId: scoped?.entityId,
        actorUserId: idOf(filters.actor),
        from: filters.from,
        to: filters.to,
      }),
      sort: oneOf(filters.sort, AUDIT_EVENT_SORT_FIELDS),
      dir: filters.dir === 'asc' ? 'asc' : 'desc',
      page: filters.page,
      pageSize: filters.pageSize,
    },
  });
  const errors = formErrors(query.error, ['from', 'to', 'action']);
  const data = query.data;
  const actors = new Map<number, string>();
  for (const row of data?.items ?? []) {
    if (row.actor !== null) actors.set(row.actor.userId, row.actor.fullName);
  }
  const entityTypes = [...new Set((data?.items ?? []).map((row) => row.entityType))].sort();
  const filtered = (
    ['category', 'sensitivity', 'action', 'entityType', 'from', 'to', 'actor'] as const
  ).some((key) => filters[key] !== '');
  const invalidAction = filters.action !== '' && action === undefined;

  const columns: DataTableColumn<RecordAuditEvent>[] = [
    {
      id: 'occurredAt',
      header: t('records.audit.col.when'),
      sortable: true,
      cell: (row) => formatDateTime(row.occurredAt, timeZone),
    },
    {
      id: 'actor',
      header: t('records.audit.col.actor'),
      cell: (row) => (
        <>
          <span>{actorText(row)}</span>
          <span className="tiq-cell-sub">
            {[
              row.actorCapacity ?? row.actor?.capacity ?? null,
              row.onBehalfOf === null
                ? null
                : t('records.audit.onBehalfOf', { name: row.onBehalfOf.fullName }),
              row.supportGrantId === null ? null : t('records.audit.support'),
            ]
              .filter((part): part is string => part !== null)
              .join(' · ')}
          </span>
        </>
      ),
    },
    {
      id: 'action',
      header: t('records.audit.col.action'),
      sortable: true,
      cell: (row) => (
        <>
          <span className="tiq-mono">{row.action}</span>
          <span className="tiq-cell-sub">
            {row.category === 'access_event'
              ? t('records.audit.accessEvent')
              : t('records.audit.businessAction')}
          </span>
        </>
      ),
    },
    {
      id: 'entityType',
      header: t('records.audit.col.record'),
      sortable: true,
      cell: (row) => (
        <>
          {row.to === null ? (
            <span>{row.entityLabel ?? `${row.entityType} #${row.entityId}`}</span>
          ) : (
            <Link to={row.to}>{row.entityLabel ?? `${row.entityType} #${row.entityId}`}</Link>
          )}
          <span className="tiq-cell-sub">
            {[row.entityReference, row.entityType].filter((part) => part !== null).join(' · ')}
          </span>
        </>
      ),
    },
    {
      id: 'governance',
      header: t('records.audit.col.governance'),
      cell: (row) => (
        <span className="tiq-inline">
          {row.redacted && (
            <Chip tone="neutral" size="sm" icon="eyeOff">
              {t('records.audit.metadataOnly')}
            </Chip>
          )}
          {row.classification !== null && (
            <StatusChip enum="documents.classification" value={row.classification} size="sm" />
          )}
          {row.retentionClass !== null && (
            <Chip tone="neutral" size="sm" outlined>
              {tEnum('retention_classes.record_class', row.retentionClass)}
            </Chip>
          )}
          {row.underHold && (
            <Chip tone="warning" size="sm" icon="lock">
              {t('records.audit.underHold')}
            </Chip>
          )}
        </span>
      ),
    },
    {
      id: 'inspect',
      header: t('records.audit.col.details'),
      accessibleHeader: t('records.audit.col.details'),
      cell: (row) => (
        <Button
          size="sm"
          variant="ghost"
          icon="eye"
          onClick={() => setInspecting(row)}
          aria-label={t('records.audit.inspectNamed', { action: row.action, id: row.id })}
        >
          {t('records.audit.inspect')}
        </Button>
      ),
    },
  ];

  return (
    <div className="tiq-page">
      <RecordsHeader subtitle={t('records.audit.intro')} />
      <FilterBar
        label={t('records.audit.filters')}
        onClear={() => {
          setActionText('');
          clearFilters();
        }}
        canClear={filtered}
      >
        <SearchField
          label={t('records.audit.action')}
          value={actionText}
          onChange={setActionText}
          onSubmit={(value) => setFilters({ action: value.trim(), page: 1 })}
          placeholder={t('records.audit.actionPlaceholder')}
        />
        <Select
          label={t('records.audit.category')}
          value={filters.category}
          placeholder={t('records.all')}
          options={AUDIT_EVENT_CATEGORIES.map((value) => ({
            value,
            label:
              value === 'access_event'
                ? t('records.audit.accessEvent')
                : t('records.audit.businessAction'),
          }))}
          onChange={(value) => setFilters({ category: value, page: 1 })}
        />
        <Select
          label={t('records.audit.sensitivity')}
          value={filters.sensitivity}
          placeholder={t('records.all')}
          options={[
            { value: 'normal', label: tEnum('audit_log.sensitivity', 'normal') },
            { value: 'restricted', label: tEnum('audit_log.sensitivity', 'restricted') },
          ]}
          onChange={(value) => setFilters({ sensitivity: value, page: 1 })}
        />
        <Select
          label={t('records.audit.entityType')}
          value={filters.entityType}
          placeholder={t('records.all')}
          options={[
            ...new Set([
              ...entityTypes,
              ...(filters.entityType === '' ? [] : [filters.entityType]),
            ]),
          ].map((value) => ({ value, label: value }))}
          onChange={(value) => setFilters({ entityType: value, page: 1 })}
        />
        <Select
          label={t('records.audit.actor')}
          value={filters.actor}
          placeholder={t('records.all')}
          options={[...actors.entries()].map(([id, name]) => ({ value: String(id), label: name }))}
          onChange={(value) => setFilters({ actor: value, page: 1 })}
        />
        <DateInput
          label={t('records.audit.from')}
          value={filters.from}
          onChange={(value) => setFilters({ from: value, page: 1 })}
          error={errors.forField('from')}
        />
        <DateInput
          label={t('records.audit.to')}
          value={filters.to}
          onChange={(value) => setFilters({ to: value, page: 1 })}
          error={errors.forField('to')}
        />
      </FilterBar>
      {scoped !== null && (
        <Banner
          tone="info"
          title={t('records.audit.scopedTitle')}
          actions={
            <Button variant="secondary" onClick={() => setSearchParams({})}>
              {t('records.audit.scopedClear')}
            </Button>
          }
        >
          <p>
            {t('records.audit.scopedBody', {
              entity: `${scoped.entityType} #${String(scoped.entityId)}`,
            })}
          </p>
        </Banner>
      )}
      {invalidAction && (
        <Banner tone="warning" title={t('records.audit.invalidActionTitle')}>
          <p>{t('records.audit.invalidAction')}</p>
        </Banner>
      )}
      <Card
        flush
        title={t('records.audit.title')}
        subtitle={data === undefined ? undefined : t('records.audit.count', { count: data.total })}
      >
        <DataTable
          caption={t('records.audit.title')}
          columns={columns}
          rows={data?.items}
          rowKey={(row) => String(row.id)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={{ key: filters.sort, dir: filters.dir === 'asc' ? 'asc' : 'desc' }}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={<EmptyState compact icon="history" title={t('records.audit.empty')} />}
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
      <Dialog
        open={inspecting !== null}
        title={t('records.audit.detailTitle')}
        onClose={() => setInspecting(null)}
        size="lg"
        footer={<Button onClick={() => setInspecting(null)}>{t('records.close')}</Button>}
      >
        {inspecting !== null && <AuditDetail row={inspecting} timeZone={timeZone} />}
      </Dialog>
    </div>
  );
}

function AuditDetail({
  row,
  timeZone,
}: {
  readonly row: RecordAuditEvent;
  readonly timeZone: string;
}) {
  return (
    <div className="tiq-stack">
      {row.redacted && (
        <Banner tone="info" title={t('records.audit.metadataOnly')}>
          <p>{t('records.audit.redactedNote')}</p>
        </Banner>
      )}
      <DetailList
        items={[
          {
            key: 'when',
            label: t('records.audit.col.when'),
            value: formatDateTime(row.occurredAt, timeZone),
          },
          { key: 'actor', label: t('records.audit.col.actor'), value: actorText(row) },
          {
            key: 'capacity',
            label: t('records.audit.capacity'),
            value: row.actorCapacity ?? row.actor?.capacity ?? null,
          },
          {
            key: 'behalf',
            label: t('records.audit.behalf'),
            value: row.onBehalfOf?.fullName ?? null,
          },
          {
            key: 'support',
            label: t('records.audit.supportGrant'),
            value:
              row.supportGrantId === null ? t('records.audit.noSupport') : `#${row.supportGrantId}`,
          },
          {
            key: 'action',
            label: t('records.audit.col.action'),
            value: <span className="tiq-mono">{row.action}</span>,
          },
          {
            key: 'record',
            label: t('records.audit.col.record'),
            value: `${row.entityLabel ?? row.entityType} (${row.entityType} #${row.entityId})`,
          },
          { key: 'reason', label: t('records.audit.reason'), value: row.reason },
          {
            key: 'correlation',
            label: t('records.audit.correlation'),
            value:
              row.correlationId === null ? null : (
                <span className="tiq-mono">{row.correlationId}</span>
              ),
          },
        ]}
      />
      {!row.redacted && (
        <div className="tiq-grid tiq-grid--2">
          <div>
            <h3 className="tiq-form-section-title">{t('records.audit.before')}</h3>
            <pre className="tiq-mono">
              {row.beforeState === null
                ? t('records.audit.noState')
                : JSON.stringify(row.beforeState, null, 2)}
            </pre>
          </div>
          <div>
            <h3 className="tiq-form-section-title">{t('records.audit.after')}</h3>
            <pre className="tiq-mono">
              {row.afterState === null
                ? t('records.audit.noState')
                : JSON.stringify(row.afterState, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
