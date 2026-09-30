/**
 * ADM-14 — Retention schedules (PRD §18.3, BR-39): each record class with its trigger, duration, owner, disposition
 * and purpose, the records in scope, those past retention, those held and the disposals a hold blocks. Records
 * managers change a schedule prospectively; records already under a hold stay held. Personal account deletion and
 * business-record retention remain separate decisions.
 */
import { useState } from 'react';

import { RETENTION_CLASSES_DISPOSITION, RETENTION_CLASSES_TRIGGER_EVENT } from '@contracts/enums';
import { recordsEndpoints } from '@contracts/records';
import type { RetentionClass } from '@contracts/records';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  ConfirmActionDialog,
  DataTable,
  EmptyState,
  FilterBar,
  NumberInput,
  Select,
  TextArea,
  formErrors,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { compact, idOf, oneOf } from '../../reports/lib/shared';
import { RecordsHeader } from '../components/RecordsHeader';

const DEFAULTS = {
  disposition: '',
  owner: '',
  sort: 'recordClass',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

function durationText(months: number): string {
  return months % 12 === 0
    ? t('records.retention.years', { count: months / 12 })
    : t('records.retention.months', { count: months });
}

export default function RetentionPage() {
  const tenant = useActiveTenant();
  const canManage = usePermission('records.retention.manage');
  const [filters, setFilters, clearFilters] = useScreenFilters('ADM-14:retention', DEFAULTS);
  const [editing, setEditing] = useState<RetentionClass | null>(null);
  const disposition = oneOf(filters.disposition, RETENTION_CLASSES_DISPOSITION);
  const query = useApiQuery(recordsEndpoints.listRetentionClasses, {
    query: {
      ...compact({
        disposition: disposition === undefined ? undefined : [disposition],
        ownerUserId: idOf(filters.owner),
      }),
      sort: oneOf(filters.sort, ['recordClass', 'durationMonths'] as const),
      dir: filters.dir === 'desc' ? 'desc' : 'asc',
      page: filters.page,
      pageSize: filters.pageSize,
    },
  });
  const data = query.data;
  const people = new Map<number, string>();
  for (const row of data?.items ?? []) {
    people.set(row.owner.userId, row.owner.fullName);
    if (row.approvedBy !== null) people.set(row.approvedBy.userId, row.approvedBy.fullName);
  }
  const filtered = filters.disposition !== '' || filters.owner !== '';

  const columns: DataTableColumn<RetentionClass>[] = [
    {
      id: 'recordClass',
      header: t('records.retention.col.class'),
      sortable: true,
      cell: (row) => (
        <>
          <strong>{tEnum('retention_classes.record_class', row.recordClass)}</strong>
          <span className="tiq-cell-sub">{row.purpose}</span>
        </>
      ),
    },
    {
      id: 'trigger',
      header: t('records.retention.col.trigger'),
      cell: (row) => tEnum('retention_classes.trigger_event', row.triggerEvent),
    },
    {
      id: 'durationMonths',
      header: t('records.retention.col.duration'),
      sortable: true,
      numeric: true,
      cell: (row) => durationText(row.durationMonths),
    },
    {
      id: 'disposition',
      header: t('records.retention.col.disposition'),
      cell: (row) => tEnum('retention_classes.disposition', row.disposition),
    },
    {
      id: 'owner',
      header: t('records.retention.col.owner'),
      cell: (row) => (
        <>
          <span>{row.owner.fullName}</span>
          <span className="tiq-cell-sub">
            {row.approvedBy === null
              ? t('records.retention.notApproved')
              : t('records.retention.approvedBy', { name: row.approvedBy.fullName })}
          </span>
        </>
      ),
    },
    {
      id: 'records',
      header: t('records.retention.col.records'),
      numeric: true,
      cell: (row) => (
        <>
          <span>{formatCount(row.stats.recordsInScope)}</span>
          <span className="tiq-cell-sub">
            {t('records.retention.stats', {
              past: row.stats.pastRetention,
              held: row.stats.heldRecords,
              blocked: row.stats.disposalBlocked,
            })}
          </span>
        </>
      ),
    },
    {
      id: 'updated',
      header: t('records.retention.col.updated'),
      cell: (row) => formatDateTime(row.updatedAt, tenant?.officialTimeZone ?? 'UTC'),
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: t('records.retention.col.actions'),
            accessibleHeader: t('records.retention.col.actions'),
            cell: (row: RetentionClass) => (
              <Button
                size="sm"
                icon="edit"
                onClick={() => setEditing(row)}
                aria-label={t('records.retention.editNamed', {
                  name: tEnum('retention_classes.record_class', row.recordClass),
                })}
              >
                {t('records.retention.edit')}
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="tiq-page">
      <RecordsHeader subtitle={t('records.retention.intro')} />
      <Banner tone="info" title={t('records.retention.separateTitle')}>
        <p>{t('records.retention.separate')}</p>
      </Banner>
      <FilterBar label={t('records.retention.filters')} onClear={clearFilters} canClear={filtered}>
        <Select
          label={t('records.retention.disposition')}
          value={filters.disposition}
          placeholder={t('records.all')}
          options={RETENTION_CLASSES_DISPOSITION.map((value) => ({
            value,
            label: tEnum('retention_classes.disposition', value),
          }))}
          onChange={(value) => setFilters({ disposition: value, page: 1 })}
        />
        <Select
          label={t('records.retention.owner')}
          value={filters.owner}
          placeholder={t('records.all')}
          options={[...people.entries()].map(([id, name]) => ({ value: String(id), label: name }))}
          onChange={(value) => setFilters({ owner: value, page: 1 })}
        />
      </FilterBar>
      <Card flush title={t('records.retention.title')} subtitle={t('records.retention.subtitle')}>
        <DataTable
          caption={t('records.retention.title')}
          columns={columns}
          rows={data?.items}
          rowKey={(row) => String(row.id)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={{ key: filters.sort, dir: filters.dir === 'desc' ? 'desc' : 'asc' }}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={<EmptyState compact icon="archive" title={t('records.retention.empty')} />}
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
      {editing !== null && (
        <RetentionEditDialog
          key={editing.id}
          retentionClass={editing}
          people={[...people.entries()]}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function RetentionEditDialog({
  retentionClass,
  people,
  onClose,
}: {
  readonly retentionClass: RetentionClass;
  readonly people: readonly (readonly [number, string])[];
  readonly onClose: () => void;
}) {
  const toast = useToast();
  const update = useApiMutation(recordsEndpoints.updateRetentionClass);
  const [triggerEvent, setTriggerEvent] = useState(retentionClass.triggerEvent);
  const [duration, setDuration] = useState(String(retentionClass.durationMonths));
  const [owner, setOwner] = useState(String(retentionClass.owner.userId));
  const [disposition, setDisposition] = useState(retentionClass.disposition);
  const [purpose, setPurpose] = useState(retentionClass.purpose);
  const [touched, setTouched] = useState(false);
  const errors = formErrors(update.error, [
    'triggerEvent',
    'durationMonths',
    'ownerUserId',
    'disposition',
    'purpose',
    'reason',
  ]);
  const months = Number(duration);
  const durationError =
    !Number.isInteger(months) || months < 1 || months > 1200
      ? t('records.retention.errors.duration')
      : undefined;
  const purposeError =
    purpose.trim().length < 10 ? t('records.retention.errors.purpose') : undefined;
  const codeError =
    update.error?.code === 'OWNER_NOT_ELIGIBLE' ||
    update.error?.code === 'RETENTION_SHORTER_THAN_LIVE_OBLIGATIONS'
      ? t(`reports.errors.${update.error.code}`)
      : undefined;
  const name = tEnum('retention_classes.record_class', retentionClass.recordClass);

  return (
    <ConfirmActionDialog
      open
      title={t('records.retention.editTitle', { name })}
      scope={t('records.retention.editScope', {
        name,
        count: retentionClass.stats.recordsInScope,
      })}
      consequence={t('records.retention.editConsequence')}
      confirmLabel={t('records.retention.save')}
      reason={{ label: t('records.retention.reason'), required: true }}
      pending={update.pending}
      error={update.error}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        setTouched(true);
        if (durationError !== undefined || purposeError !== undefined) return;
        try {
          await update.mutate({
            params: { retentionClassId: retentionClass.id },
            body: {
              triggerEvent,
              durationMonths: months,
              ownerUserId: Number(owner),
              disposition,
              purpose: purpose.trim(),
              reason,
            },
          });
          invalidateApiQueries('buyer.records.');
          toast.show(t('records.retention.saved', { name }), 'success');
          onClose();
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      <div className="tiq-form-stack">
        {retentionClass.stats.heldRecords > 0 && (
          <Banner tone="warning" title={t('records.retention.heldTitle')}>
            <p>{t('records.retention.held', { count: retentionClass.stats.heldRecords })}</p>
          </Banner>
        )}
        <Select
          label={t('records.retention.trigger')}
          required
          value={triggerEvent}
          options={RETENTION_CLASSES_TRIGGER_EVENT.map((value) => ({
            value,
            label: tEnum('retention_classes.trigger_event', value),
          }))}
          onChange={(value) => {
            const next = RETENTION_CLASSES_TRIGGER_EVENT.find((item) => item === value);
            if (next !== undefined) setTriggerEvent(next);
          }}
          error={errors.forField('triggerEvent')}
        />
        <NumberInput
          label={t('records.retention.duration')}
          required
          value={duration}
          onChange={setDuration}
          suffix={t('records.retention.monthsSuffix')}
          error={
            (touched ? durationError : undefined) ?? errors.forField('durationMonths') ?? codeError
          }
        />
        <Select
          label={t('records.retention.owner')}
          required
          value={owner}
          options={people.map(([id, label]) => ({ value: String(id), label }))}
          onChange={setOwner}
          error={errors.forField('ownerUserId')}
        />
        <Select
          label={t('records.retention.disposition')}
          required
          value={disposition}
          options={RETENTION_CLASSES_DISPOSITION.map((value) => ({
            value,
            label: tEnum('retention_classes.disposition', value),
          }))}
          onChange={(value) => {
            const next = RETENTION_CLASSES_DISPOSITION.find((item) => item === value);
            if (next !== undefined) setDisposition(next);
          }}
          error={errors.forField('disposition')}
        />
        <TextArea
          label={t('records.retention.purpose')}
          required
          rows={3}
          value={purpose}
          onChange={setPurpose}
          error={(touched ? purposeError : undefined) ?? errors.forField('purpose')}
        />
      </div>
    </ConfirmActionDialog>
  );
}
