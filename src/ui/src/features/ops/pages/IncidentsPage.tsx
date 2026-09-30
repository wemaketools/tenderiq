/**
 * OPS-05 Service incidents and continuity: scope (severity), affected customers and events, times, recovery status
 * and pending buyer decisions. Action: declare an incident. The responsible buyer, never the operator, decides any
 * deadline extension or restart.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import {
  CreateIncidentBody,
  SERVICE_INCIDENT_SEVERITIES,
  operationsEndpoints,
} from '@contracts/operations';
import type { IncidentRow, ServiceIncidentSeverity } from '@contracts/operations';
import { enumOptions } from '@contracts/enums';
import type { ServiceIncidentsStatus } from '@contracts/enums';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  DataTable,
  DateInput,
  DateTimeInput,
  Dialog,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  PageHeader,
  SearchField,
  Select,
  StatusChip,
  TextArea,
  TextField,
  useToast,
} from '../../../components/ui';
import { formatCount, formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { useValidatedForm } from '../lib/forms';
import { opsOptions } from '../lib/labels';
import { opsPaths } from '../lib/paths';
import { INCIDENTS_MANAGE } from '../lib/permissions';
import { ActionError } from '../components/ActionError';
import { OpsChip } from '../components/OpsChip';

const DEFAULTS = {
  q: '',
  status: '',
  severity: '',
  customer: '',
  from: '',
  to: '',
  page: 1,
  sort: 'startedAt',
  dir: 'desc',
};

type SortField = 'startedAt' | 'severity' | 'status' | 'title';

const FIELDS = ['title', 'description', 'severity', 'startedAt', 'customerNotice'] as const;

function DeclareIncidentDialog({
  timeZone,
  onClose,
  onCreated,
}: {
  readonly timeZone: string;
  readonly onClose: () => void;
  readonly onCreated: (id: number, reference: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('');
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const create = useApiMutation(operationsEndpoints.createIncident);
  const body = {
    title,
    description,
    severity: severity === '' ? undefined : severity,
    startedAt: startedAt ?? undefined,
    ...(notice.trim() === '' ? {} : { customerNotice: notice }),
  };
  const form = useValidatedForm(CreateIncidentBody, body, create.error, FIELDS);
  const submit = async (): Promise<void> => {
    const parsed = form.check();
    if (parsed === null) return;
    try {
      const created = await create.mutate({ body: parsed });
      onCreated(created.id, created.reference);
    } catch {
      // Shown by ActionError.
    }
  };
  return (
    <Dialog
      open
      size="lg"
      title={t('ops.incidents.declare.title')}
      description={t('ops.incidents.declare.description')}
      onClose={onClose}
      dismissible={!create.pending}
      footer={
        <>
          <Button onClick={onClose} disabled={create.pending}>
            {t('ops.common.cancel')}
          </Button>
          <Button variant="primary" loading={create.pending} onClick={() => void submit()}>
            {t('ops.incidents.declare.submit')}
          </Button>
        </>
      }
    >
      <div className="tiq-form-grid">
        <TextField
          fieldClassName="tiq-form-full"
          label={t('ops.incidents.col.incident')}
          required
          value={title}
          onChange={setTitle}
          error={form.errorFor('title')}
        />
        <Select
          label={t('ops.incidents.col.severity')}
          required
          placeholder={t('ops.common.choose')}
          value={severity}
          onChange={setSeverity}
          options={opsOptions('severity', SERVICE_INCIDENT_SEVERITIES)}
          error={form.errorFor('severity')}
        />
        <DateTimeInput
          label={t('ops.incidents.col.started')}
          timeZone={timeZone}
          required
          value={startedAt}
          onChange={setStartedAt}
          error={form.errorFor('startedAt')}
        />
        <TextArea
          fieldClassName="tiq-form-full"
          label={t('ops.incidents.field.description')}
          required
          rows={4}
          value={description}
          onChange={setDescription}
          error={form.errorFor('description')}
        />
        <TextArea
          fieldClassName="tiq-form-full"
          label={t('ops.incidents.field.notice')}
          hint={t('ops.incidents.field.noticeHint')}
          rows={3}
          value={notice}
          onChange={setNotice}
          error={form.errorFor('customerNotice')}
        />
      </div>
      <ActionError error={create.error} fields={FIELDS} />
    </Dialog>
  );
}

export default function IncidentsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const canManage = usePermission(INCIDENTS_MANAGE);
  const [declaring, setDeclaring] = useState(false);
  const [filters, setFilters, clearFilters] = useScreenFilters('OPS-05', DEFAULTS);
  const customers = useApiQuery(operationsEndpoints.listCustomers, {
    query: { pageSize: 100, sort: 'name' },
  });
  const query = {
    page: filters.page,
    pageSize: 25,
    sort: filters.sort as SortField,
    dir: filters.dir as 'asc' | 'desc',
    ...(filters.q.trim() === '' ? {} : { q: filters.q.trim() }),
    ...(filters.status === '' ? {} : { status: [filters.status as ServiceIncidentsStatus] }),
    ...(filters.severity === '' ? {} : { severity: [filters.severity as ServiceIncidentSeverity] }),
    ...(filters.customer === '' ? {} : { customerTenantId: Number(filters.customer) }),
    ...(filters.from === '' ? {} : { startedFrom: filters.from }),
    ...(filters.to === '' ? {} : { startedTo: filters.to }),
  };
  const incidents = useApiQuery(operationsEndpoints.listIncidents, { query });
  const all = useApiQuery(operationsEndpoints.listIncidents, { query: { pageSize: 100 } });
  const rows = all.data?.items;
  const count = (predicate: (row: IncidentRow) => boolean): string | null =>
    rows === undefined ? null : formatCount(rows.filter(predicate).length);
  const update = (values: Partial<typeof DEFAULTS>): void => setFilters({ page: 1, ...values });
  const canClear =
    filters.q !== '' ||
    filters.status !== '' ||
    filters.severity !== '' ||
    filters.customer !== '' ||
    filters.from !== '' ||
    filters.to !== '';

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('ops.incidents.title')}
        subtitle={t('ops.incidents.subtitle')}
        primaryAction={
          canManage ? (
            <Button variant="primary" icon="plus" onClick={() => setDeclaring(true)}>
              {t('ops.incidents.declare.open')}
            </Button>
          ) : undefined
        }
      />
      <Banner tone="info" title={t('ops.incidents.ruleTitle')}>
        <p>{t('ops.incidents.rule')}</p>
      </Banner>
      <FilterBar onClear={clearFilters} canClear={canClear}>
        <SearchField
          label={t('ops.common.search')}
          placeholder={t('ops.incidents.searchPlaceholder')}
          value={filters.q}
          onChange={(value) => update({ q: value })}
        />
        <Select
          label={t('ops.incidents.col.status')}
          placeholder={t('ops.common.all')}
          value={filters.status}
          onChange={(value) => update({ status: value })}
          options={enumOptions('service_incidents.status')}
        />
        <Select
          label={t('ops.incidents.col.severity')}
          placeholder={t('ops.common.all')}
          value={filters.severity}
          onChange={(value) => update({ severity: value })}
          options={opsOptions('severity', SERVICE_INCIDENT_SEVERITIES)}
        />
        <Select
          label={t('ops.incidents.filter.customer')}
          placeholder={t('ops.common.all')}
          value={filters.customer}
          onChange={(value) => update({ customer: value })}
          options={(customers.data?.items ?? []).map((row) => ({
            value: String(row.tenantId),
            label: row.name,
          }))}
        />
        <DateInput
          label={t('ops.incidents.filter.from')}
          value={filters.from}
          onChange={(value) => update({ from: value })}
        />
        <DateInput
          label={t('ops.incidents.filter.to')}
          value={filters.to}
          onChange={(value) => update({ to: value })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('ops.incidents.kpi.open')}
          icon="alertOctagon"
          tone="danger"
          value={count((row) => row.status !== 'resolved')}
          hint={t('ops.incidents.kpi.openHint')}
        />
        <KpiCard
          label={t('ops.incidents.kpi.decisions')}
          icon="gavel"
          tone="warning"
          value={
            rows === undefined
              ? null
              : formatCount(rows.reduce((total, row) => total + row.pendingBuyerDecisions, 0))
          }
          hint={t('ops.incidents.kpi.decisionsHint')}
        />
        <KpiCard
          label={t('ops.incidents.kpi.events')}
          icon="fileText"
          tone="info"
          value={
            rows === undefined
              ? null
              : formatCount(rows.reduce((total, row) => total + row.affectedEvents, 0))
          }
          hint={t('ops.incidents.kpi.eventsHint')}
        />
        <KpiCard
          label={t('ops.incidents.kpi.resolved')}
          icon="checkCircle"
          tone="success"
          value={count((row) => row.status === 'resolved')}
          hint={t('ops.incidents.kpi.resolvedHint')}
        />
      </KpiGrid>
      <Card flush title={t('ops.incidents.register')}>
        <DataTable<IncidentRow>
          caption={t('ops.incidents.register')}
          rows={incidents.data?.items}
          rowKey={(row) => String(row.id)}
          loading={incidents.isFetching}
          error={incidents.error}
          onRetry={incidents.reload}
          sort={{ key: filters.sort, dir: filters.dir as 'asc' | 'desc' }}
          onSortChange={(next) => setFilters({ sort: next.key, dir: next.dir, page: 1 })}
          onRowClick={(row) => navigate(opsPaths.incident(row.id))}
          rowLabel={(row) => t('ops.incidents.rowLabel', { reference: row.reference })}
          empty={
            <EmptyState
              compact
              icon="activity"
              title={t('ops.incidents.empty')}
              description={t('ops.incidents.emptyHint')}
            />
          }
          pagination={
            incidents.data === undefined
              ? undefined
              : {
                  page: incidents.data.page,
                  pageSize: incidents.data.pageSize,
                  total: incidents.data.total,
                  onPageChange: (page) => setFilters({ page }),
                }
          }
          columns={[
            {
              id: 'title',
              header: t('ops.incidents.col.incident'),
              sortable: true,
              width: '32%',
              cell: (row) => (
                <>
                  <span className="tiq-mono">{row.reference}</span>
                  <div className="tiq-cell-sub">{row.title}</div>
                </>
              ),
            },
            {
              id: 'severity',
              header: t('ops.incidents.col.severity'),
              sortable: true,
              cell: (row) => <OpsChip kind="severity" value={row.severity} size="sm" />,
            },
            {
              id: 'status',
              header: t('ops.incidents.col.status'),
              sortable: true,
              cell: (row) => <StatusChip enum="service_incidents.status" value={row.status} />,
            },
            {
              id: 'startedAt',
              header: t('ops.incidents.col.started'),
              sortable: true,
              cell: (row) => formatDateTime(row.startedAt, timeZone),
            },
            {
              id: 'resolvedAt',
              header: t('ops.incidents.col.resolved'),
              cell: (row) =>
                row.resolvedAt === null ? (
                  <span className="tiq-text-warning">{t('ops.incidents.ongoing')}</span>
                ) : (
                  formatDateTime(row.resolvedAt, timeZone)
                ),
            },
            {
              id: 'impact',
              header: t('ops.incidents.col.impact'),
              cell: (row) =>
                t('ops.incidents.impactValue', {
                  customers: row.affectedCustomers,
                  events: row.affectedEvents,
                }),
            },
            {
              id: 'decisions',
              header: t('ops.incidents.col.decisions'),
              cell: (row) =>
                row.pendingBuyerDecisions === 0 ? (
                  <span className="tiq-text-muted">{t('ops.incidents.noPending')}</span>
                ) : (
                  <span className="tiq-text-warning">
                    {t('ops.incidents.pending', { count: row.pendingBuyerDecisions })}
                  </span>
                ),
            },
          ]}
        />
      </Card>
      {declaring && (
        <DeclareIncidentDialog
          timeZone={timeZone}
          onClose={() => setDeclaring(false)}
          onCreated={(id, reference) => {
            setDeclaring(false);
            toast.show(t('ops.incidents.declare.done', { reference }), 'success');
            navigate(opsPaths.incident(id));
          }}
        />
      )}
    </div>
  );
}
