/**
 * REP-02 preview: the scope a definition returns today, which fields are included or redacted and why, what is
 * omitted, whether each recipient is authorized for the audience (an unauthorized recipient is excluded at issue
 * time, DD-19), the currency basis, completeness, the schedule and sample rows. It is reviewed before sharing.
 */
import type { ReportPreview } from '@contracts/reporting';

import { Banner, Card, Chip, DataTable, DetailList, EmptyState } from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCalendarDate, formatCount, formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { ReportCellView } from './ReportCellView';

type SampleRow = ReportPreview['sampleRows'][number];

export function DefinitionPreviewPanel({
  preview,
  stale,
}: {
  readonly preview: ReportPreview;
  readonly stale: boolean;
}) {
  const unauthorized = preview.recipients.filter((recipient) => !recipient.authorized);
  const columns: DataTableColumn<SampleRow>[] = [
    {
      id: '__level',
      header: t('reports.report.col.rowType'),
      cell: (row) => (
        <Chip
          tone={row.level === 'lot' ? 'neutral' : 'info'}
          size="sm"
          outlined={row.level === 'lot'}
        >
          {t(`reports.report.rowLevels.${row.level}`)}
        </Chip>
      ),
    },
    ...preview.columns.map((column): DataTableColumn<SampleRow> => ({
      id: column.key,
      header: column.label,
      numeric: column.numeric,
      cell: (row) => <ReportCellView cell={row.cells[column.key]} />,
    })),
  ];

  return (
    <Card
      title={t('reports.preview.title')}
      subtitle={preview.scopeDescription}
      aria-label={t('reports.preview.title')}
    >
      <div className="tiq-stack">
        {stale && (
          <Banner tone="warning" title={t('reports.preview.staleTitle')}>
            <p>{t('reports.preview.stale')}</p>
          </Banner>
        )}
        {unauthorized.length > 0 && (
          <Banner tone="error" title={t('reports.preview.unauthorizedTitle')}>
            <ul>
              {unauthorized.map((recipient) => (
                <li key={recipient.user.userId}>
                  {t('reports.preview.unauthorized', {
                    name: recipient.user.fullName,
                    reason: recipient.reason ?? t('reports.definition.notAuthorized'),
                  })}
                </li>
              ))}
            </ul>
          </Banner>
        )}
        <DetailList
          items={[
            {
              key: 'rows',
              label: t('reports.preview.rows'),
              value: t('reports.preview.rowsValue', { count: preview.estimatedRowCount }),
            },
            {
              key: 'currency',
              label: t('reports.report.currencyBasis'),
              value:
                preview.currencyBasis.conversionDate === null
                  ? preview.currencyBasis.note
                  : `${preview.currencyBasis.note} ${t('reports.report.convertedOn', {
                      date: formatCalendarDate(preview.currencyBasis.conversionDate),
                    })}`,
            },
            {
              key: 'completeness',
              label: t('reports.preview.completeness'),
              value: preview.completeness.complete
                ? t('reports.report.complete')
                : t('reports.preview.incomplete', {
                    missing: formatCount(preview.completeness.recordsWithMissingData),
                    included: formatCount(preview.completeness.recordsIncluded),
                  }),
            },
            {
              key: 'schedule',
              label: t('reports.preview.schedule'),
              value:
                preview.schedule === null
                  ? t('reports.preview.notScheduled')
                  : t('reports.preview.scheduleValue', {
                      description: preview.schedule.description,
                      next:
                        preview.schedule.nextRunAt === null
                          ? t('reports.preview.noNextRun')
                          : formatDateTime(preview.schedule.nextRunAt, preview.schedule.timeZone),
                    }),
            },
          ]}
        />

        <div className="tiq-grid tiq-grid--2">
          <div className="tiq-stack">
            <h3 className="tiq-form-section-title">{t('reports.preview.fields')}</h3>
            <ul
              className="tiq-stack"
              style={{ listStyle: 'none', margin: 0, padding: 0 }}
              aria-label={t('reports.preview.fields')}
            >
              {preview.fields.map((field) => (
                <li key={field.key} className="tiq-inline">
                  <Chip
                    tone={!field.included ? 'neutral' : field.redacted ? 'warning' : 'success'}
                    size="sm"
                    icon={!field.included ? 'minus' : field.redacted ? 'eyeOff' : 'check'}
                  >
                    {!field.included
                      ? t('reports.preview.excluded')
                      : field.redacted
                        ? t('reports.preview.redacted')
                        : t('reports.preview.included')}
                  </Chip>
                  <span>{field.label}</span>
                  {field.reason !== null && <span className="tiq-cell-sub">{field.reason}</span>}
                </li>
              ))}
            </ul>
          </div>
          <div className="tiq-stack">
            <h3 className="tiq-form-section-title">{t('reports.preview.recipients')}</h3>
            {preview.recipients.length === 0 ? (
              <p className="tiq-text-muted">{t('reports.preview.noRecipients')}</p>
            ) : (
              <ul
                className="tiq-stack"
                style={{ listStyle: 'none', margin: 0, padding: 0 }}
                aria-label={t('reports.preview.recipients')}
              >
                {preview.recipients.map((recipient) => (
                  <li key={recipient.user.userId} className="tiq-inline">
                    <Chip tone={recipient.authorized ? 'success' : 'danger'} size="sm">
                      {recipient.authorized
                        ? t('reports.preview.authorized')
                        : t('reports.preview.excludedRecipient')}
                    </Chip>
                    <span>{recipient.user.fullName}</span>
                  </li>
                ))}
              </ul>
            )}
            <h3 className="tiq-form-section-title">{t('reports.preview.omissions')}</h3>
            {preview.omissions.length === 0 ? (
              <p className="tiq-text-muted">{t('reports.preview.noOmissions')}</p>
            ) : (
              <ul aria-label={t('reports.preview.omissions')}>
                {preview.omissions.map((omission) => (
                  <li key={omission}>{omission}</li>
                ))}
              </ul>
            )}
            {preview.redactions.length > 0 && (
              <>
                <h3 className="tiq-form-section-title">{t('reports.preview.redactions')}</h3>
                <DetailList
                  stacked
                  items={preview.redactions.map((item) => ({
                    key: item.field,
                    label: item.field,
                    value: item.reason,
                  }))}
                />
              </>
            )}
          </div>
        </div>

        <h3 className="tiq-form-section-title">{t('reports.preview.sample')}</h3>
        <DataTable
          caption={t('reports.preview.sample')}
          columns={columns}
          rows={preview.sampleRows}
          rowKey={(row) => row.id}
          empty={<EmptyState compact icon="table" title={t('reports.preview.noSample')} />}
        />
      </div>
    </Card>
  );
}
