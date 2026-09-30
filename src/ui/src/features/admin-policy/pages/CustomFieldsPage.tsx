/**
 * ADM-07 — Forms and business fields: the register of the organization's additional fields on the request, tender,
 * qualification application and contract forms (label, purpose, applicability, required status, allowed values,
 * audience, reporting), and a live preview of each form with its conditional required rules and display order.
 * Fields carried by issued forms are never changed silently (PRD §17.1, §17.3).
 */
import { useState } from 'react';

import {
  CUSTOM_FIELDS_AUDIENCE,
  CUSTOM_FIELDS_ENTITY_TYPE,
  CUSTOM_FIELDS_FIELD_TYPE,
  CUSTOM_FIELDS_REQUIRED_MODE,
  TENDERS_PROCEDURE_WRITE,
} from '@contracts/enums';
import type { CustomFieldsEntityType } from '@contracts/enums';
import {
  VALUE_BANDS,
  getCustomFieldForm,
  listCustomFields,
  reorderCustomFields,
} from '@contracts/policy';
import type {
  CoreConditionSource,
  CustomFieldContext,
  CustomFieldForm,
  CustomFieldIssue,
  CustomFieldSummary,
  CustomFieldValues,
} from '@contracts/policy';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Chip,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  IconButton,
  KpiCard,
  KpiGrid,
  PageHeader,
  QueryView,
  SearchField,
  Select,
  StatusChip,
  Tabs,
  TextField,
  UnsavedChangesGuard,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { CustomFieldsSection } from '../components/CustomFieldsSection';
import { PolicyLayout } from '../components/PolicyLayout';
import { policyErrorMessage } from '../lib/errors';
import { requirementText } from '../lib/fieldText';
import { useOfficialTimeZone } from '../lib/hooks';
import { compact, directionOf, fromDate, oneOf, tableSort, toDate } from '../lib/lists';
import { policyPaths } from '../lib/paths';

const SORT_FIELDS = ['sortOrder', 'label', 'key', 'entityType', 'updatedAt'] as const;
type SortField = (typeof SORT_FIELDS)[number];

const DEFAULTS = {
  q: '',
  entityType: '',
  audience: '',
  requiredMode: '',
  fieldType: '',
  active: '',
  reports: '',
  updatedFrom: '',
  updatedTo: '',
  sort: 'entityType',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

function sortField(value: string): SortField {
  return (SORT_FIELDS as readonly string[]).includes(value) ? (value as SortField) : 'entityType';
}

function booleanFilter(value: string): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

type Tab = 'register' | 'preview';

function FieldRegister() {
  const timeZone = useOfficialTimeZone();
  const [filters, setFilters, clearFilters] = useScreenFilters('ADM-07', DEFAULTS);
  const query = useApiQuery(listCustomFields, {
    query: compact({
      q: filters.q.trim(),
      entityType: oneOf(filters.entityType, CUSTOM_FIELDS_ENTITY_TYPE),
      audience: oneOf(filters.audience, CUSTOM_FIELDS_AUDIENCE),
      requiredMode: oneOf(filters.requiredMode, CUSTOM_FIELDS_REQUIRED_MODE),
      fieldType: oneOf(filters.fieldType, CUSTOM_FIELDS_FIELD_TYPE),
      active: booleanFilter(filters.active),
      includeInReports: booleanFilter(filters.reports),
      updatedFrom: fromDate(filters.updatedFrom),
      updatedTo: toDate(filters.updatedTo),
      sort: sortField(filters.sort),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(listCustomFields, { query: { pageSize: 100 } });
  const all = overview.data?.items ?? [];
  const kpiRestricted = overview.error?.kind === 'forbidden';
  const loadingKpi = overview.data === undefined;
  const filtered = Object.entries(filters).some(
    ([key, value]) => !['sort', 'dir', 'page', 'pageSize'].includes(key) && value !== '',
  );

  const columns: DataTableColumn<CustomFieldSummary>[] = [
    {
      id: 'label',
      header: t('admin-policy.fields.col.label'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.label}</span>
          <span className="tiq-cell-sub tiq-mono">{row.key}</span>
          <span className="tiq-cell-sub">{row.purpose}</span>
        </>
      ),
    },
    {
      id: 'entityType',
      header: t('admin-policy.fields.col.form'),
      sortable: true,
      cell: (row) => tEnum('custom_fields.entity_type', row.entityType),
    },
    {
      id: 'type',
      header: t('admin-policy.fields.col.type'),
      cell: (row) => (
        <>
          <span>{tEnum('custom_fields.field_type', row.fieldType)}</span>
          {row.allowedValues.length > 0 && (
            <span className="tiq-cell-sub">{row.allowedValues.join(', ')}</span>
          )}
        </>
      ),
    },
    {
      id: 'required',
      header: t('admin-policy.fields.col.required'),
      cell: (row) => requirementText(row, all),
    },
    {
      id: 'audience',
      header: t('admin-policy.fields.col.audience'),
      cell: (row) => (
        <>
          <StatusChip enum="custom_fields.audience" value={row.audience} size="sm" />
          {row.includeInReports && (
            <span className="tiq-cell-sub">{t('admin-policy.fields.inReports')}</span>
          )}
        </>
      ),
    },
    {
      id: 'usage',
      header: t('admin-policy.fields.col.usage'),
      numeric: true,
      cell: (row) => (
        <>
          <span>{formatCount(row.valueCount)}</span>
          {row.issuedRecordCount > 0 && (
            <span className="tiq-cell-sub">
              {t('admin-policy.fields.issued', { count: row.issuedRecordCount })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'status',
      header: t('admin-policy.fields.col.status'),
      cell: (row) =>
        row.active ? (
          <Chip tone="success">{t('admin-policy.fields.active')}</Chip>
        ) : (
          <Chip tone="neutral">{t('admin-policy.fields.inactive')}</Chip>
        ),
    },
    {
      id: 'updatedAt',
      header: t('admin-policy.fields.col.updated'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{formatInstantDate(row.updatedAt, timeZone)}</span>
          {row.updatedBy !== null && <span className="tiq-cell-sub">{row.updatedBy.fullName}</span>}
        </>
      ),
    },
  ];

  const yesNoOptions = [
    { value: 'true', label: t('admin-policy.common.yes') },
    { value: 'false', label: t('admin-policy.common.no') },
  ];

  return (
    <div className="tiq-page">
      <FilterBar
        label={t('admin-policy.fields.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('admin-policy.common.search')}
          placeholder={t('admin-policy.fields.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('admin-policy.fields.filter.form')}
          placeholder={t('admin-policy.fields.filter.allForms')}
          value={filters.entityType}
          options={CUSTOM_FIELDS_ENTITY_TYPE.map((value) => ({
            value,
            label: tEnum('custom_fields.entity_type', value),
          }))}
          onChange={(entityType) => setFilters({ entityType, page: 1 })}
        />
        <Select
          label={t('admin-policy.fields.filter.audience')}
          placeholder={t('admin-policy.fields.filter.allAudiences')}
          value={filters.audience}
          options={CUSTOM_FIELDS_AUDIENCE.map((value) => ({
            value,
            label: tEnum('custom_fields.audience', value),
          }))}
          onChange={(audience) => setFilters({ audience, page: 1 })}
        />
        <Select
          label={t('admin-policy.fields.filter.required')}
          placeholder={t('admin-policy.fields.filter.allRequired')}
          value={filters.requiredMode}
          options={CUSTOM_FIELDS_REQUIRED_MODE.map((value) => ({
            value,
            label: tEnum('custom_fields.required_mode', value),
          }))}
          onChange={(requiredMode) => setFilters({ requiredMode, page: 1 })}
        />
        <Select
          label={t('admin-policy.fields.filter.type')}
          placeholder={t('admin-policy.fields.filter.allTypes')}
          value={filters.fieldType}
          options={CUSTOM_FIELDS_FIELD_TYPE.map((value) => ({
            value,
            label: tEnum('custom_fields.field_type', value),
          }))}
          onChange={(fieldType) => setFilters({ fieldType, page: 1 })}
        />
        <Select
          label={t('admin-policy.fields.filter.status')}
          placeholder={t('admin-policy.common.allStatuses')}
          value={filters.active}
          options={[
            { value: 'true', label: t('admin-policy.fields.active') },
            { value: 'false', label: t('admin-policy.fields.inactive') },
          ]}
          onChange={(active) => setFilters({ active, page: 1 })}
        />
        <Select
          label={t('admin-policy.fields.filter.reports')}
          placeholder={t('admin-policy.common.all')}
          value={filters.reports}
          options={yesNoOptions}
          onChange={(reports) => setFilters({ reports, page: 1 })}
        />
        <DateInput
          label={t('admin-policy.common.updatedFrom')}
          value={filters.updatedFrom}
          onChange={(updatedFrom) => setFilters({ updatedFrom, page: 1 })}
        />
        <DateInput
          label={t('admin-policy.common.updatedTo')}
          value={filters.updatedTo}
          onChange={(updatedTo) => setFilters({ updatedTo, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('admin-policy.fields.kpi.active')}
          icon="listChecks"
          restricted={kpiRestricted}
          value={loadingKpi ? '…' : formatCount(all.filter((row) => row.active).length)}
          hint={t('admin-policy.fields.kpi.activeHint', {
            count: all.filter((row) => !row.active).length,
          })}
        />
        <KpiCard
          label={t('admin-policy.fields.kpi.conditional')}
          icon="gitBranch"
          tone="info"
          restricted={kpiRestricted}
          value={
            loadingKpi
              ? '…'
              : formatCount(all.filter((row) => row.requiredMode === 'conditional').length)
          }
          hint={t('admin-policy.fields.kpi.conditionalHint')}
        />
        <KpiCard
          label={t('admin-policy.fields.kpi.supplier')}
          icon="eye"
          tone="warning"
          restricted={kpiRestricted}
          value={
            loadingKpi
              ? '…'
              : formatCount(all.filter((row) => row.audience !== 'buyer_internal').length)
          }
          hint={t('admin-policy.fields.kpi.supplierHint')}
        />
        <KpiCard
          label={t('admin-policy.fields.kpi.locked')}
          icon="lock"
          tone="success"
          restricted={kpiRestricted}
          value={
            loadingKpi ? '…' : formatCount(all.filter((row) => row.issuedRecordCount > 0).length)
          }
          hint={t('admin-policy.fields.kpi.lockedHint')}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('admin-policy.fields.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => row.label}
          rowHref={(row) => policyPaths.field(row.id)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={
                filtered ? t('admin-policy.fields.emptyFiltered') : t('admin-policy.fields.empty')
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
    </div>
  );
}

const CORE_TEXT_SOURCES: readonly CoreConditionSource[] = [
  'category_code',
  'event_type',
  'participation',
];

function FormPreview() {
  const toast = useToast();
  const canManage = usePermission('org.fields.manage');
  const [entityType, setEntityType] = useState<CustomFieldsEntityType>('tender');
  const [values, setValues] = useState<CustomFieldValues>({});
  const [context, setContext] = useState<CustomFieldContext>({});
  const [checked, setChecked] = useState(false);
  const [issues, setIssues] = useState<readonly CustomFieldIssue[]>([]);
  const [order, setOrder] = useState<readonly number[] | null>(null);
  const [saved, setSaved] = useState<CustomFieldForm | null>(null);
  const query = useApiQuery(getCustomFieldForm, { params: { entityType } });
  const reorder = useApiMutation(reorderCustomFields);

  const selectForm = (next: string): void => {
    setEntityType(next as CustomFieldsEntityType);
    setValues({});
    setContext({});
    setChecked(false);
    setOrder(null);
    setSaved(null);
    reorder.reset();
  };

  return (
    <div className="tiq-page">
      <UnsavedChangesGuard when={order !== null} />
      <Card title={t('admin-policy.preview.title')} subtitle={t('admin-policy.preview.intro')}>
        <div className="tiq-form-grid">
          <Select
            label={t('admin-policy.preview.form')}
            value={entityType}
            options={CUSTOM_FIELDS_ENTITY_TYPE.map((value) => ({
              value,
              label: tEnum('custom_fields.entity_type', value),
            }))}
            onChange={selectForm}
          />
        </div>
      </Card>
      <QueryView
        query={query}
        isEmpty={(form) => form.fields.length === 0}
        empty={
          <EmptyState
            title={t('admin-policy.preview.empty')}
            description={t('admin-policy.preview.emptyHint')}
          />
        }
      >
        {(loaded) => {
          const form = saved ?? loaded;
          const ids = order ?? form.fields.map((field) => field.id);
          const ordered = ids.flatMap((id) => form.fields.filter((field) => field.id === id));
          const move = (index: number, delta: number): void => {
            const next = [...ids];
            const target = index + delta;
            const current = next[index];
            const other = next[target];
            if (current === undefined || other === undefined) return;
            next[index] = other;
            next[target] = current;
            setOrder(next);
          };
          const previewForm: CustomFieldForm = {
            ...form,
            fields: ordered.map((field, position) => ({ ...field, sortOrder: position })),
          };
          return (
            <div className="tiq-grid tiq-grid--sidebar">
              <Card
                title={t('admin-policy.preview.formTitle', {
                  form: tEnum('custom_fields.entity_type', entityType),
                })}
                actions={
                  <Button size="sm" icon="checkSquare" onClick={() => setChecked(true)}>
                    {t('admin-policy.preview.check')}
                  </Button>
                }
              >
                <div className="tiq-stack">
                  <fieldset className="tiq-fieldset">
                    <legend>{t('admin-policy.preview.context')}</legend>
                    <div className="tiq-form-grid">
                      {form.coreConditionSources.map((source) => {
                        if (source === 'procedure') {
                          return (
                            <Select
                              key={source}
                              label={t('admin-policy.core.procedure')}
                              placeholder={t('admin-policy.common.choose')}
                              value={context.procedure ?? ''}
                              options={TENDERS_PROCEDURE_WRITE.map((value) => ({
                                value,
                                label: tEnum('tenders.procedure', value),
                              }))}
                              onChange={(value) =>
                                setContext({ ...context, procedure: value === '' ? null : value })
                              }
                            />
                          );
                        }
                        if (source === 'value_band') {
                          return (
                            <Select
                              key={source}
                              label={t('admin-policy.core.value_band')}
                              placeholder={t('admin-policy.common.choose')}
                              value={context.value_band ?? ''}
                              options={VALUE_BANDS.map((value) => ({
                                value,
                                label: t(`admin-policy.valueBand.${value}`),
                              }))}
                              onChange={(value) =>
                                setContext({ ...context, value_band: value === '' ? null : value })
                              }
                            />
                          );
                        }
                        if ((CORE_TEXT_SOURCES as readonly string[]).includes(source)) {
                          const key = source as CoreConditionSource;
                          return (
                            <TextField
                              key={source}
                              label={t(`admin-policy.core.${source}`)}
                              value={context[key] ?? ''}
                              onChange={(value) =>
                                setContext({ ...context, [key]: value === '' ? null : value })
                              }
                            />
                          );
                        }
                        return null;
                      })}
                    </div>
                  </fieldset>
                  <CustomFieldsSection
                    entityType={entityType}
                    form={previewForm}
                    values={values}
                    onChange={setValues}
                    context={context}
                    showErrors={checked}
                    onValidationChange={setIssues}
                  />
                  {checked &&
                    (issues.length === 0 ? (
                      <Banner tone="success" title={t('admin-policy.preview.valid')} />
                    ) : (
                      <Banner
                        tone="error"
                        title={t('admin-policy.preview.invalid', { count: issues.length })}
                      >
                        <ul>
                          {issues.map((issue) => (
                            <li key={`${issue.key}:${issue.code}`}>{issue.message}</li>
                          ))}
                        </ul>
                      </Banner>
                    ))}
                </div>
              </Card>
              <Card
                flush
                title={t('admin-policy.preview.order')}
                subtitle={t('admin-policy.preview.orderHint')}
                footer={
                  canManage ? (
                    <div className="tiq-inline">
                      <Button
                        variant="primary"
                        icon="check"
                        disabled={order === null}
                        loading={reorder.pending}
                        onClick={() => {
                          void reorder.mutate({ body: { entityType, fieldIds: [...ids] } }).then(
                            (result) => {
                              setSaved(result);
                              setOrder(null);
                              toast.show(t('admin-policy.preview.orderSaved'), 'success');
                            },
                            () => undefined,
                          );
                        }}
                      >
                        {t('admin-policy.preview.saveOrder')}
                      </Button>
                      <Button disabled={order === null} onClick={() => setOrder(null)}>
                        {t('admin-policy.preview.resetOrder')}
                      </Button>
                    </div>
                  ) : undefined
                }
              >
                {reorder.error !== null && (
                  <Banner tone="error" title={t('admin-policy.preview.orderFailed')}>
                    <p>{policyErrorMessage(reorder.error)}</p>
                  </Banner>
                )}
                <DataTable
                  caption={t('admin-policy.preview.order')}
                  rows={ordered}
                  rowKey={(field) => String(field.id)}
                  columns={[
                    {
                      id: 'position',
                      header: t('admin-policy.preview.position'),
                      numeric: true,
                      width: '3rem',
                      cell: (field) => ordered.indexOf(field) + 1,
                    },
                    {
                      id: 'label',
                      header: t('admin-policy.preview.field'),
                      cell: (field) => field.label,
                    },
                    ...(canManage
                      ? [
                          {
                            id: 'move',
                            header: t('admin-policy.preview.move'),
                            cell: (field: (typeof ordered)[number]) => {
                              const index = ordered.indexOf(field);
                              return (
                                <span className="tiq-row-actions">
                                  <IconButton
                                    icon="arrowUp"
                                    size="sm"
                                    label={t('admin-policy.preview.moveUp', { field: field.label })}
                                    disabled={index === 0}
                                    onClick={() => move(index, -1)}
                                  />
                                  <IconButton
                                    icon="arrowDown"
                                    size="sm"
                                    label={t('admin-policy.preview.moveDown', {
                                      field: field.label,
                                    })}
                                    disabled={index === ordered.length - 1}
                                    onClick={() => move(index, 1)}
                                  />
                                </span>
                              );
                            },
                          },
                        ]
                      : []),
                  ]}
                />
              </Card>
            </div>
          );
        }}
      </QueryView>
    </div>
  );
}

export default function CustomFieldsPage() {
  const canManage = usePermission('org.fields.manage');
  const [tab, setTab] = useState<Tab>('register');
  return (
    <PolicyLayout>
      <PageHeader
        title={t('admin-policy.fields.title')}
        subtitle={t('admin-policy.fields.intro')}
        primaryAction={
          canManage ? (
            <ButtonLink to={policyPaths.newField} variant="primary" icon="plus">
              {t('admin-policy.fields.new')}
            </ButtonLink>
          ) : undefined
        }
      />
      <Tabs
        label={t('admin-policy.fields.tabs')}
        selected={tab}
        onSelect={(id) => setTab(id as Tab)}
        tabs={[
          { id: 'register', label: t('admin-policy.fields.tab.register') },
          { id: 'preview', label: t('admin-policy.fields.tab.preview') },
        ]}
      >
        {tab === 'register' ? <FieldRegister /> : <FormPreview />}
      </Tabs>
    </PolicyLayout>
  );
}
