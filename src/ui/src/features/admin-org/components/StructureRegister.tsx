/**
 * One register of structure values (ADM-01 legal entities, ADM-02 departments, locations, categories, cost centers
 * and funding sources; FR-01): search, active/inactive filter, sort, pagination, usage on current and historical
 * records, and add / revise / deactivate. Values are deactivated, never deleted, and historical records keep the
 * description they were created with. Every command is confirmed with the acting organization (COM-02).
 *
 * The six kinds share this component; each kind's columns, fields and body live in `structureKinds.tsx`. The
 * endpoint groups differ only in their row and body schemas, so they are handled as `AnyEndpoint` here and the
 * kind's typed helpers convert rows and drafts.
 */
import { useState } from 'react';
import type { ComponentType } from 'react';

import type { AnyEndpoint } from '@contracts/endpoint';
import { STRUCTURE_SORTS } from '@contracts/org-admin';
import type { StructureUsage } from '@contracts/org-admin';
import type { Page } from '@contracts/common';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  EmptyState,
  FilterBar,
  SearchField,
  Select,
  formErrors,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatInstantDate } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { dialogError } from '../../admin-access/lib/errors';
import { useOfficialTimeZone } from '../../admin-access/lib/hooks';
import {
  booleanFilter,
  compact,
  directionOf,
  pagingOf,
  sortOf,
  tableSort,
} from '../../admin-access/lib/lists';
import { STRUCTURE_MANAGE } from '../lib/permissions';

export interface StructureRowBase {
  readonly id: number;
  readonly name: string;
  readonly active: boolean;
  readonly deactivatedAt: string | null;
  readonly usage: StructureUsage;
  readonly createdAt: string;
}

export type Draft = Readonly<Record<string, string>>;

export interface FieldsProps {
  readonly draft: Draft;
  readonly onChange: (draft: Draft) => void;
  readonly errorOf: (field: string) => string | undefined;
  /** The value being revised (to exclude it from parent choices), or null. */
  readonly editingId: number | null;
}

export interface StructureKind<Row extends StructureRowBase> {
  /** i18n key segment and filter screen key (`departments`). */
  readonly key: string;
  readonly endpoints: {
    readonly list: AnyEndpoint;
    readonly create: AnyEndpoint;
    readonly update: AnyEndpoint;
    readonly deactivate: AnyEndpoint;
  };
  readonly columns: () => readonly DataTableColumn<Row>[];
  /** The body fields, for binding server field errors. */
  readonly fields: readonly string[];
  readonly emptyDraft: Draft;
  readonly draftOf: (row: Row) => Draft;
  /** Client-side checks (the server's 422 stays authoritative): field → message. */
  readonly validate: (draft: Draft) => Readonly<Record<string, string>>;
  readonly bodyOf: (draft: Draft) => unknown;
  readonly Fields: ComponentType<FieldsProps>;
  /** i18n key of an extra deactivation consequence (for example children or the last contracting entity). */
  readonly deactivateNote?: string;
}

const DEFAULTS = { q: '', active: 'true', sort: 'name', dir: 'asc', page: 1, pageSize: 25 };

type Open<Row> =
  | { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly row: Row }
  | { readonly kind: 'deactivate'; readonly row: Row };

function EditDialog<Row extends StructureRowBase>({
  config,
  row,
  onClose,
  onSaved,
}: {
  readonly config: StructureKind<Row>;
  readonly row: Row | null;
  readonly onClose: () => void;
  readonly onSaved: (row: Row) => void;
}) {
  const create = useApiMutation(config.endpoints.create);
  const update = useApiMutation(config.endpoints.update);
  const [draft, setDraft] = useState<Draft>(row === null ? config.emptyDraft : config.draftOf(row));
  const [checked, setChecked] = useState(false);
  const error = row === null ? create.error : update.error;
  const server = formErrors(error, config.fields);
  const local = checked ? config.validate(draft) : {};
  const Fields = config.Fields;
  return (
    <ConfirmActionDialog
      open
      title={
        row === null
          ? t(`admin-org.structure.${config.key}.addTitle`)
          : t(`admin-org.structure.${config.key}.editTitle`, { name: row.name })
      }
      scope={row === null ? t(`admin-org.structure.${config.key}.newValue`) : row.name}
      consequence={
        row === null
          ? t('admin-org.structure.addConsequence')
          : t('admin-org.structure.editConsequence', { count: row.usage.referenceCount })
      }
      confirmLabel={row === null ? t('admin-org.structure.add') : t('admin-org.structure.save')}
      pending={create.pending || update.pending}
      error={dialogError(error, config.fields)}
      onCancel={onClose}
      onConfirm={async () => {
        setChecked(true);
        if (Object.keys(config.validate(draft)).length > 0) return;
        const body = config.bodyOf(draft);
        try {
          const saved =
            row === null
              ? await create.mutate({ body } as never)
              : await update.mutate({ params: { valueId: row.id }, body } as never);
          onSaved(saved as Row);
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      <div className="tiq-form-grid">
        <Fields
          draft={draft}
          onChange={setDraft}
          errorOf={(field) => local[field] ?? server.forField(field)}
          editingId={row?.id ?? null}
        />
      </div>
    </ConfirmActionDialog>
  );
}

function DeactivateDialog<Row extends StructureRowBase>({
  config,
  row,
  onClose,
  onSaved,
}: {
  readonly config: StructureKind<Row>;
  readonly row: Row;
  readonly onClose: () => void;
  readonly onSaved: (row: Row) => void;
}) {
  const deactivate = useApiMutation(config.endpoints.deactivate);
  return (
    <ConfirmActionDialog
      open
      tone="danger"
      title={t(`admin-org.structure.${config.key}.deactivateTitle`, { name: row.name })}
      scope={row.name}
      consequence={`${t('admin-org.structure.deactivateConsequence', {
        references: row.usage.referenceCount,
        tenders: row.usage.openTenders,
        contracts: row.usage.activeContracts,
      })}${config.deactivateNote === undefined ? '' : ` ${t(config.deactivateNote)}`}`}
      confirmLabel={t('admin-org.structure.deactivate')}
      reason={{ label: t('admin-access.common.reason'), required: true }}
      pending={deactivate.pending}
      error={dialogError(deactivate.error, [])}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        try {
          const saved = await deactivate.mutate({
            params: { valueId: row.id },
            body: { reason },
          } as never);
          onSaved(saved as Row);
        } catch {
          // Shown in the dialog.
        }
      }}
    />
  );
}

export function StructureRegister<Row extends StructureRowBase>({
  config,
}: {
  readonly config: StructureKind<Row>;
}) {
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const canManage = usePermission(STRUCTURE_MANAGE);
  const [filters, setFilters, clearFilters] = useScreenFilters(`ADM-02:${config.key}`, DEFAULTS);
  const [open, setOpen] = useState<Open<Row> | null>(null);
  const [created, setCreated] = useState<readonly Row[]>([]);
  const [results, setResults] = useState<Readonly<Record<number, Row>>>({});
  const query = useApiQuery(config.endpoints.list, {
    query: compact({
      q: filters.q.trim(),
      active: booleanFilter(filters.active),
      sort: sortOf(filters.sort, STRUCTURE_SORTS, 'name'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  } as never);
  const page = query.data as Page<Row> | undefined;
  const loaded = (page?.items ?? []).map((row) => results[row.id] ?? row);
  const rows = [...created.filter((row) => !loaded.some((item) => item.id === row.id)), ...loaded];
  const filtered = filters.q !== '' || filters.active !== 'true';

  const columns: DataTableColumn<Row>[] = [
    ...config.columns(),
    {
      id: 'referenceCount',
      header: t('admin-org.structure.col.usage'),
      sortable: true,
      numeric: true,
      cell: (row) => (
        <>
          <span>{t('admin-org.structure.references', { count: row.usage.referenceCount })}</span>
          {(row.usage.openTenders > 0 || row.usage.activeContracts > 0) && (
            <span className="tiq-cell-sub">
              {t('admin-org.structure.live', {
                tenders: formatCount(row.usage.openTenders),
                contracts: formatCount(row.usage.activeContracts),
              })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'status',
      header: t('admin-org.structure.col.status'),
      cell: (row) =>
        row.active ? (
          <Chip tone="success" size="sm">
            {t('admin-access.common.active')}
          </Chip>
        ) : (
          <>
            <Chip tone="neutral-outlined" size="sm">
              {t('admin-access.common.inactive')}
            </Chip>
            {row.deactivatedAt !== null && (
              <span className="tiq-cell-sub">{formatInstantDate(row.deactivatedAt, timeZone)}</span>
            )}
          </>
        ),
    },
    {
      id: 'actions',
      header: t('admin-access.common.actions'),
      cell: (row) =>
        canManage && row.active ? (
          <div className="tiq-row-actions">
            <Button size="sm" onClick={() => setOpen({ kind: 'edit', row })}>
              {t('admin-org.structure.edit')}
            </Button>
            <Button size="sm" onClick={() => setOpen({ kind: 'deactivate', row })}>
              {t('admin-org.structure.deactivate')}
            </Button>
          </div>
        ) : (
          '—'
        ),
    },
  ];

  const saved = (row: Row, message: string, isNew: boolean): void => {
    if (isNew) setCreated([row, ...created]);
    else setResults({ ...results, [row.id]: row });
    setOpen(null);
    toast.show(message, 'success');
  };

  return (
    <div className="tiq-page">
      <FilterBar
        label={t(`admin-org.structure.${config.key}.filters`)}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('admin-access.common.search')}
          placeholder={t(`admin-org.structure.${config.key}.search`)}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('admin-org.structure.col.status')}
          placeholder={t('admin-access.common.allStatuses')}
          value={filters.active}
          options={[
            { value: 'true', label: t('admin-access.common.active') },
            { value: 'false', label: t('admin-access.common.inactive') },
          ]}
          onChange={(active) => setFilters({ active, page: 1 })}
        />
        {canManage && (
          <div className="tiq-filterbar-actions">
            <Button icon="plus" onClick={() => setOpen({ kind: 'create' })}>
              {t(`admin-org.structure.${config.key}.add`)}
            </Button>
          </div>
        )}
      </FilterBar>
      <Card flush>
        <DataTable
          caption={t(`admin-org.structure.${config.key}.caption`)}
          columns={columns}
          rows={page === undefined ? undefined : rows}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => row.name}
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
                  ? t('admin-org.structure.emptyFiltered')
                  : t(`admin-org.structure.${config.key}.empty`)
              }
            />
          }
          pagination={pagingOf(page, setFilters)}
        />
      </Card>
      {open?.kind === 'create' && (
        <EditDialog
          config={config}
          row={null}
          onClose={() => setOpen(null)}
          onSaved={(row) => saved(row, t('admin-org.structure.added', { name: row.name }), true)}
        />
      )}
      {open?.kind === 'edit' && (
        <EditDialog
          config={config}
          row={open.row}
          onClose={() => setOpen(null)}
          onSaved={(row) => saved(row, t('admin-org.structure.saved', { name: row.name }), false)}
        />
      )}
      {open?.kind === 'deactivate' && (
        <DeactivateDialog
          config={config}
          row={open.row}
          onClose={() => setOpen(null)}
          onSaved={(row) =>
            saved(row, t('admin-org.structure.deactivated', { name: row.name }), false)
          }
        />
      )}
    </div>
  );
}
