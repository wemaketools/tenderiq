/**
 * ADM-16 import review: the proposed records of one batch with their origin, original business date, quality issues
 * (including missing evidence), duplicate candidates and decision. Actions: accept valid records (resolving each
 * quality issue and every duplicate candidate explicitly), reject errors, and complete the batch once every row is
 * decided. Accepted records keep their original dates and provenance.
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import { operationsEndpoints } from '@contracts/operations';
import type { ImportBatchDetail, ImportRecordRow } from '@contracts/operations';
import { enumOptions } from '@contracts/enums';
import type { ImportRecordsDecision } from '@contracts/enums';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  PageHeader,
  QueryView,
  RadioGroup,
  Select,
  StatusChip,
  TextArea,
  useToast,
} from '../../../components/ui';
import { formatCalendarDate, formatCount, formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { fieldErrorOnly } from '../../ops/lib/errors';
import { ServiceLayout } from '../components/ServiceLayout';
import { servicePaths } from '../lib/paths';
import { ActionError } from '../../ops/components/ActionError';

export default function ImportBatchPage() {
  const { batchId } = useParams();
  const batch = useApiQuery(operationsEndpoints.getImportBatch, {
    params: { batchId: Number(batchId) },
  });
  return (
    <ServiceLayout>
      {batch.data === undefined && (
        <PageHeader
          title={t('admin-integrations.batch.title')}
          back={{ to: servicePaths.imports, label: t('admin-integrations.imports.title') }}
        />
      )}
      <QueryView query={batch}>{(data) => <BatchView batch={data} />}</QueryView>
    </ServiceLayout>
  );
}

const RECORD_FILTERS = {
  decision: '',
  issues: false,
  duplicates: false,
  page: 1,
  sort: 'rowNo',
  dir: 'asc',
};

function rawValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function BatchView({ batch }: { readonly batch: ImportBatchDetail }) {
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const [filters, setFilters, clearFilters] = useScreenFilters(
    `ADM-16-batch-${batch.id}`,
    RECORD_FILTERS,
  );
  const [deciding, setDeciding] = useState<ImportRecordRow | null>(null);
  const [decision, setDecision] = useState<'accepted' | 'rejected'>('accepted');
  const [duplicate, setDuplicate] = useState('');
  const [issues, setIssues] = useState('');
  const [provenance, setProvenance] = useState('');
  const [missing, setMissing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const decide = useApiMutation(operationsEndpoints.decideImportRecord);
  const complete = useApiMutation(operationsEndpoints.completeImportBatch);
  const records = useApiQuery(operationsEndpoints.listImportRecords, {
    params: { batchId: batch.id },
    query: {
      page: filters.page,
      pageSize: 25,
      sort: filters.sort as 'rowNo' | 'label' | 'decision',
      dir: filters.dir as 'asc' | 'desc',
      ...(filters.decision === '' ? {} : { decision: [filters.decision as ImportRecordsDecision] }),
      ...(filters.issues ? { hasQualityIssues: true } : {}),
      ...(filters.duplicates ? { hasDuplicateCandidate: true } : {}),
    },
  });
  const closed = batch.completedAt !== null;
  const scope = `${batch.origin} · ${batch.sourceFileName}`;
  const rowScope =
    deciding === null
      ? ''
      : `${scope} · ${t('admin-integrations.batch.rowNo', { no: deciding.rowNo })} ${deciding.label}`;

  const openDecision = (row: ImportRecordRow, choice: 'accepted' | 'rejected'): void => {
    decide.reset();
    setDecision(choice);
    setDuplicate('');
    setIssues('');
    setProvenance('');
    setMissing(false);
    setDeciding(row);
  };

  const nextAction = (): string => {
    if (closed) return t('admin-integrations.batch.next.done');
    if (batch.counts.pending > 0)
      return t('admin-integrations.batch.next.decide', { count: batch.counts.pending });
    return t('admin-integrations.batch.next.complete');
  };

  return (
    <>
      <PageHeader
        title={batch.origin}
        subtitle={batch.sourceFileName}
        back={{ to: servicePaths.imports, label: t('admin-integrations.imports.title') }}
        meta={
          <>
            <StatusChip enum="import_batches.status" value={batch.status} />
            <StatusChip enum="import_batches.record_type" value={batch.recordType} />
            <span>
              {t('ops.customer.nextAction')}: {nextAction()}
            </span>
          </>
        }
        primaryAction={
          !closed && batch.capabilities.canComplete ? (
            <Button
              variant="primary"
              icon="checkCircle"
              onClick={() => {
                complete.reset();
                setCompleting(true);
              }}
            >
              {t('admin-integrations.batch.complete')}
            </Button>
          ) : undefined
        }
      />
      <Banner tone="info" title={t('admin-integrations.batch.ruleTitle')}>
        <p>{batch.acceptanceRule}</p>
      </Banner>
      <KpiGrid>
        <KpiCard
          label={t('admin-integrations.batch.kpi.pending')}
          icon="hourglass"
          tone="warning"
          value={formatCount(batch.counts.pending)}
          hint={t('admin-integrations.batch.kpi.pendingHint', { total: batch.counts.total })}
        />
        <KpiCard
          label={t('admin-integrations.batch.kpi.quality')}
          icon="alertTriangle"
          tone="danger"
          value={formatCount(batch.counts.withQualityIssues)}
          hint={t('admin-integrations.batch.kpi.qualityHint')}
        />
        <KpiCard
          label={t('admin-integrations.batch.kpi.duplicates')}
          icon="copy"
          tone="info"
          value={formatCount(batch.counts.withDuplicateCandidates)}
          hint={t('admin-integrations.batch.kpi.duplicatesHint')}
        />
        <KpiCard
          label={t('admin-integrations.batch.kpi.accepted')}
          icon="checkCircle"
          tone="success"
          value={formatCount(batch.counts.accepted)}
          hint={t('admin-integrations.batch.kpi.acceptedHint', { rejected: batch.counts.rejected })}
        />
      </KpiGrid>
      <Card title={t('admin-integrations.batch.provenance')}>
        <DetailList
          items={[
            {
              key: 'note',
              label: t('admin-integrations.imports.new.provenance'),
              value: batch.provenanceNote,
            },
            {
              key: 'uploaded',
              label: t('admin-integrations.imports.col.uploaded'),
              value: `${formatDateTime(batch.uploadedAt, timeZone)} · ${batch.uploadedBy.fullName}`,
            },
            {
              key: 'reviewer',
              label: t('admin-integrations.batch.reviewer'),
              value: batch.reviewedBy?.fullName ?? null,
            },
            {
              key: 'completed',
              label: t('admin-integrations.batch.completed'),
              value:
                batch.completedAt === null ? null : formatDateTime(batch.completedAt, timeZone),
            },
            {
              key: 'review',
              label: t('admin-integrations.batch.reviewNote'),
              value: batch.reviewNote,
            },
          ]}
        />
      </Card>
      <FilterBar
        onClear={clearFilters}
        canClear={filters.decision !== '' || filters.issues || filters.duplicates}
      >
        <Select
          label={t('admin-integrations.batch.col.decision')}
          placeholder={t('ops.common.all')}
          value={filters.decision}
          onChange={(value) => setFilters({ decision: value, page: 1 })}
          options={enumOptions('import_records.decision')}
        />
        <Checkbox
          label={t('admin-integrations.batch.withIssues')}
          checked={filters.issues}
          onChange={(checked) => setFilters({ issues: checked, page: 1 })}
        />
        <Checkbox
          label={t('admin-integrations.batch.withDuplicates')}
          checked={filters.duplicates}
          onChange={(checked) => setFilters({ duplicates: checked, page: 1 })}
        />
      </FilterBar>
      <Card flush title={t('admin-integrations.batch.records')}>
        <DataTable<ImportRecordRow>
          caption={t('admin-integrations.batch.records')}
          rows={records.data?.items}
          rowKey={(row) => String(row.id)}
          loading={records.isFetching}
          error={records.error}
          onRetry={records.reload}
          sort={{ key: filters.sort, dir: filters.dir as 'asc' | 'desc' }}
          onSortChange={(next) => setFilters({ sort: next.key, dir: next.dir, page: 1 })}
          empty={<EmptyState compact title={t('admin-integrations.batch.noRecords')} />}
          pagination={
            records.data === undefined
              ? undefined
              : {
                  page: records.data.page,
                  pageSize: records.data.pageSize,
                  total: records.data.total,
                  onPageChange: (page) => setFilters({ page }),
                }
          }
          columns={[
            {
              id: 'rowNo',
              header: t('admin-integrations.batch.col.row'),
              sortable: true,
              numeric: true,
              cell: (row) => row.rowNo,
            },
            {
              id: 'label',
              header: t('admin-integrations.batch.col.record'),
              sortable: true,
              width: '26%',
              cell: (row) => (
                <>
                  <strong>{row.label}</strong>
                  <div className="tiq-cell-sub">
                    {t('admin-integrations.batch.originalDate')}:{' '}
                    {formatCalendarDate(row.originalBusinessDate)}
                  </div>
                </>
              ),
            },
            {
              id: 'issues',
              header: t('admin-integrations.batch.col.issues'),
              cell: (row) =>
                row.qualityIssues.length === 0 ? (
                  <span className="tiq-text-muted">{t('ops.common.none')}</span>
                ) : (
                  <ul className="tiq-stack">
                    {row.qualityIssues.map((issue) => (
                      <li key={issue} className="tiq-text-danger">
                        {issue}
                      </li>
                    ))}
                  </ul>
                ),
            },
            {
              id: 'duplicate',
              header: t('admin-integrations.batch.col.duplicate'),
              cell: (row) =>
                row.duplicateCandidate === null ? (
                  <span className="tiq-text-muted">{t('ops.common.none')}</span>
                ) : (
                  <>
                    <Chip tone="warning" size="sm" icon="copy">
                      {row.duplicateCandidate.name}
                    </Chip>
                    {row.duplicateReason !== null && (
                      <div className="tiq-cell-sub">{row.duplicateReason}</div>
                    )}
                  </>
                ),
            },
            {
              id: 'decision',
              header: t('admin-integrations.batch.col.decision'),
              sortable: true,
              cell: (row) => (
                <div className="tiq-stack">
                  <span>
                    <StatusChip enum="import_records.decision" value={row.decision} />
                  </span>
                  {row.decidedBy !== null && (
                    <span className="tiq-cell-sub">
                      {row.decidedBy.fullName}
                      {row.decidedAt !== null && ` · ${formatDateTime(row.decidedAt, timeZone)}`}
                    </span>
                  )}
                  {row.createdEntityLabel !== null && (
                    <span className="tiq-cell-sub">
                      {t('admin-integrations.batch.created', { label: row.createdEntityLabel })}
                    </span>
                  )}
                  {row.provenanceNote !== null && (
                    <span className="tiq-cell-sub">{row.provenanceNote}</span>
                  )}
                </div>
              ),
            },
            {
              id: 'actions',
              header: t('ops.common.actions'),
              cell: (row) =>
                row.decision === 'pending' && !closed && batch.capabilities.canDecide ? (
                  <div className="tiq-inline">
                    <Button size="sm" onClick={() => openDecision(row, 'accepted')}>
                      {t('admin-integrations.batch.accept')}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger-soft"
                      onClick={() => openDecision(row, 'rejected')}
                    >
                      {t('admin-integrations.batch.reject')}
                    </Button>
                  </div>
                ) : null,
            },
          ]}
        />
      </Card>

      <ConfirmActionDialog
        open={deciding !== null}
        title={
          decision === 'accepted'
            ? t('admin-integrations.batch.acceptTitle')
            : t('admin-integrations.batch.rejectTitle')
        }
        scope={rowScope}
        consequence={
          decision === 'accepted'
            ? t('admin-integrations.batch.acceptConsequence')
            : t('admin-integrations.batch.rejectConsequence')
        }
        confirmLabel={
          decision === 'accepted'
            ? t('admin-integrations.batch.accept')
            : t('admin-integrations.batch.reject')
        }
        tone={decision === 'rejected' ? 'danger' : 'primary'}
        reason={{ label: t('ops.common.reason'), required: true }}
        pending={decide.pending}
        error={fieldErrorOnly(decide.error)}
        onCancel={() => setDeciding(null)}
        onConfirm={async ({ reason }) => {
          if (deciding === null) return;
          const needsDuplicate = decision === 'accepted' && deciding.duplicateCandidate !== null;
          const needsIssues = decision === 'accepted' && deciding.qualityIssues.length > 0;
          if ((needsDuplicate && duplicate === '') || (needsIssues && issues.trim() === '')) {
            setMissing(true);
            return;
          }
          try {
            await decide.mutate({
              params: { batchId: batch.id, recordId: deciding.id },
              body: {
                decision,
                reason,
                ...(needsDuplicate
                  ? { duplicateResolution: duplicate as 'link_existing' | 'create_new' }
                  : {}),
                ...(needsIssues ? { issuesResolution: issues.trim() } : {}),
                ...(provenance.trim() === '' ? {} : { provenanceNote: provenance.trim() }),
              },
            });
            toast.show(
              decision === 'accepted'
                ? t('admin-integrations.batch.accepted')
                : t('admin-integrations.batch.rejected'),
              'success',
            );
            invalidateApiQueries('buyer.operations.imports.');
            setDeciding(null);
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        {deciding !== null && (
          <>
            <DetailList
              items={Object.entries(deciding.raw).map(([key, value]) => ({
                key,
                label: key,
                value: rawValue(value),
              }))}
            />
            <RadioGroup
              label={t('admin-integrations.batch.col.decision')}
              inline
              value={decision}
              onChange={(value) => setDecision(value === 'rejected' ? 'rejected' : 'accepted')}
              options={[
                { value: 'accepted', label: t('admin-integrations.batch.accept') },
                { value: 'rejected', label: t('admin-integrations.batch.reject') },
              ]}
            />
            {decision === 'accepted' && deciding.duplicateCandidate !== null && (
              <RadioGroup
                label={t('admin-integrations.batch.duplicateResolution', {
                  name: deciding.duplicateCandidate.name,
                })}
                required
                value={duplicate}
                onChange={setDuplicate}
                options={[
                  {
                    value: 'link_existing',
                    label: t('admin-integrations.batch.linkExisting'),
                    hint: t('admin-integrations.batch.linkExistingHint'),
                  },
                  {
                    value: 'create_new',
                    label: t('admin-integrations.batch.createNew'),
                    hint: t('admin-integrations.batch.createNewHint'),
                  },
                ]}
                error={
                  missing && duplicate === ''
                    ? t('ops.errors.DUPLICATE_REVIEW_REQUIRED')
                    : undefined
                }
              />
            )}
            {decision === 'accepted' && deciding.qualityIssues.length > 0 && (
              <TextArea
                label={t('admin-integrations.batch.issuesResolution')}
                hint={deciding.qualityIssues.join('; ')}
                required
                rows={3}
                value={issues}
                onChange={setIssues}
                error={
                  missing && issues.trim() === ''
                    ? t('ops.errors.QUALITY_ISSUES_UNRESOLVED')
                    : undefined
                }
              />
            )}
            <TextArea
              label={t('admin-integrations.batch.provenanceNote')}
              hint={t('admin-integrations.batch.provenanceHint')}
              rows={2}
              value={provenance}
              onChange={setProvenance}
            />
          </>
        )}
        <ActionError error={decide.error} />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={completing}
        title={t('admin-integrations.batch.completeTitle')}
        scope={scope}
        consequence={t('admin-integrations.batch.completeConsequence', {
          accepted: batch.counts.accepted,
          rejected: batch.counts.rejected,
        })}
        confirmLabel={t('admin-integrations.batch.complete')}
        reason={{ label: t('admin-integrations.batch.reviewNote'), required: false }}
        pending={complete.pending}
        error={fieldErrorOnly(complete.error)}
        onCancel={() => setCompleting(false)}
        onConfirm={async ({ reason }) => {
          try {
            await complete.mutate({
              params: { batchId: batch.id },
              body: reason === '' ? {} : { note: reason },
            });
            toast.show(t('admin-integrations.batch.completeDone'), 'success');
            invalidateApiQueries('buyer.operations.imports.');
            setCompleting(false);
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        {batch.counts.pending > 0 && (
          <Banner tone="warning" title={t('admin-integrations.batch.pendingTitle')}>
            <p>{t('admin-integrations.batch.pendingText', { count: batch.counts.pending })}</p>
          </Banner>
        )}
        <ActionError error={complete.error} />
      </ConfirmActionDialog>
    </>
  );
}
