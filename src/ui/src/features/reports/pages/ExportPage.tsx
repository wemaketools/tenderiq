/**
 * ADM-13 / ADM-14 — One controlled export and its manifest (DD-16, PRD §15.2, §18): what it contains (with record
 * counts), which versions, what was omitted and why (for example sealed content before opening), what was
 * redacted, who requested it and for what scope. A ready export can be downloaded; the download is audited.
 */
import { useParams } from 'react-router';

import { reportingEndpoints } from '@contracts/reporting';
import type { ExportManifest, ExportRecord } from '@contracts/reporting';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import {
  Banner,
  Button,
  Card,
  DataTable,
  DetailList,
  EmptyState,
  PageHeader,
  QueryView,
  StatusChip,
} from '../../../components/ui';
import { formatBytes, formatCount, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useExportDownload } from '../lib/exports';
import { idOf } from '../lib/shared';

type ContentRow = ExportManifest['contents'][number];
type VersionRow = ExportManifest['versions'][number];

export default function ExportPage() {
  const { exportId: raw = '' } = useParams();
  const exportId = idOf(raw);
  const query = useApiQuery(
    reportingEndpoints.getExport,
    exportId === undefined ? null : { params: { exportId } },
  );
  const back = { to: '/buyer/admin/reports/exports', label: t('reports.exportDetail.back') };
  if (exportId === undefined) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('reports.exportDetail.title')} back={back} />
        <Card>
          <EmptyState icon="compass" title={t('reports.exportDetail.notFound')} />
        </Card>
      </div>
    );
  }
  return (
    <div className="tiq-page">
      <QueryView
        query={query}
        loading={<PageHeader title={t('reports.exportDetail.title')} back={back} />}
      >
        {(record) => <ExportDetail record={record} back={back} />}
      </QueryView>
    </div>
  );
}

function ExportDetail({
  record,
  back,
}: {
  readonly record: ExportRecord;
  readonly back: { readonly to: string; readonly label: string };
}) {
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const { download, pendingId } = useExportDownload();
  const manifest = record.manifest;

  return (
    <>
      <PageHeader
        title={t('reports.exportDetail.heading', {
          type: tEnum('exports.export_type', record.exportType),
          id: record.id,
        })}
        subtitle={record.scopeDescription}
        back={back}
        meta={
          <>
            <StatusChip enum="exports.status" value={record.status} size="sm" />
            <span className="tiq-text-muted">{record.format.toUpperCase()}</span>
          </>
        }
        primaryAction={
          record.status === 'ready' ? (
            <Button
              variant="primary"
              icon="download"
              loading={pendingId === record.id}
              onClick={() => void download(record.id)}
            >
              {t('reports.exports.download')}
            </Button>
          ) : undefined
        }
      />
      {record.status === 'failed' && (
        <Banner tone="error" title={t('reports.exportDetail.failedTitle')}>
          <p>{record.error ?? t('reports.exportDetail.failed')}</p>
        </Banner>
      )}
      {(record.status === 'queued' || record.status === 'running') && (
        <Banner tone="info" title={t('reports.exportDetail.pendingTitle')}>
          <p>{t('reports.exportDetail.pending')}</p>
        </Banner>
      )}

      <Card title={t('reports.exportDetail.about')}>
        <DetailList
          items={[
            {
              key: 'scope',
              label: t('reports.exportDetail.scope'),
              value: record.scopeDescription,
            },
            {
              key: 'subject',
              label: t('reports.exportDetail.subject'),
              value: record.subjectLabel,
            },
            {
              key: 'family',
              label: t('reports.exportDetail.family'),
              value:
                record.reportFamily === null
                  ? null
                  : tEnum('report_definitions.family', record.reportFamily),
            },
            {
              key: 'requested',
              label: t('reports.exportDetail.requested'),
              value: t('reports.exportDetail.requestedValue', {
                name: record.requestedBy.fullName,
                when: formatDateTime(record.requestedAt, timeZone),
              }),
            },
            {
              key: 'completed',
              label: t('reports.exportDetail.completed'),
              value:
                record.completedAt === null ? null : formatDateTime(record.completedAt, timeZone),
            },
            { key: 'file', label: t('reports.exportDetail.file'), value: record.fileName },
            {
              key: 'size',
              label: t('reports.exportDetail.size'),
              value: record.sizeBytes === null ? null : formatBytes(record.sizeBytes),
            },
          ]}
        />
      </Card>

      {manifest === null ? (
        <Card title={t('reports.exportDetail.manifest')}>
          <EmptyState
            compact
            icon="listChecks"
            title={t('reports.exportDetail.noManifest')}
            description={t('reports.exportDetail.noManifestHint')}
          />
        </Card>
      ) : (
        <>
          <div className="tiq-grid tiq-grid--2">
            <Card
              flush
              title={t('reports.exportDetail.contents')}
              subtitle={t('reports.exportDetail.contentsHint')}
            >
              <DataTable<ContentRow>
                caption={t('reports.exportDetail.contents')}
                columns={[
                  {
                    id: 'label',
                    header: t('reports.exportDetail.col.item'),
                    cell: (row) => (
                      <>
                        <span>{row.label}</span>
                        <span className="tiq-cell-sub">{row.description}</span>
                      </>
                    ),
                  },
                  {
                    id: 'count',
                    header: t('reports.exportDetail.col.records'),
                    numeric: true,
                    cell: (row) =>
                      row.recordCount === null ? (
                        <span className="tiq-text-muted">
                          {t('reports.exportDetail.notCounted')}
                        </span>
                      ) : (
                        formatCount(row.recordCount)
                      ),
                  },
                ]}
                rows={manifest.contents}
                rowKey={(row) => row.label}
                empty={<EmptyState compact title={t('reports.exportDetail.noContents')} />}
              />
            </Card>
            <Card
              flush
              title={t('reports.exportDetail.versions')}
              subtitle={t('reports.exportDetail.versionsHint')}
            >
              <DataTable<VersionRow>
                caption={t('reports.exportDetail.versions')}
                columns={[
                  {
                    id: 'label',
                    header: t('reports.exportDetail.col.record'),
                    cell: (row) => row.label,
                  },
                  {
                    id: 'reference',
                    header: t('reports.exportDetail.col.reference'),
                    cell: (row) => <span className="tiq-mono">{row.reference ?? '—'}</span>,
                  },
                  {
                    id: 'version',
                    header: t('reports.exportDetail.col.version'),
                    cell: (row) => row.version,
                  },
                ]}
                rows={manifest.versions}
                rowKey={(row) => `${row.label}-${row.version}`}
                empty={<EmptyState compact title={t('reports.exportDetail.noVersions')} />}
              />
            </Card>
          </div>
          <div className="tiq-grid tiq-grid--2">
            <Card
              title={t('reports.exportDetail.omissions')}
              subtitle={t('reports.exportDetail.omissionsHint')}
            >
              {manifest.omissions.length === 0 ? (
                <p className="tiq-text-muted">{t('reports.exportDetail.noOmissions')}</p>
              ) : (
                <DetailList
                  stacked
                  items={manifest.omissions.map((item) => ({
                    key: item.label,
                    label: item.label,
                    value: item.reason,
                  }))}
                />
              )}
            </Card>
            <Card
              title={t('reports.exportDetail.redactions')}
              subtitle={t('reports.exportDetail.redactionsHint')}
            >
              {manifest.redactions.length === 0 ? (
                <p className="tiq-text-muted">{t('reports.exportDetail.noRedactions')}</p>
              ) : (
                <DetailList
                  stacked
                  items={manifest.redactions.map((item) => ({
                    key: item.field,
                    label: item.field,
                    value: item.reason,
                  }))}
                />
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
