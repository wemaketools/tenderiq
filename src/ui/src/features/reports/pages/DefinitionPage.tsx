/**
 * REP-02 — Report definition and export review (PRD §13.4, §15.2; ADM-13 opens it). A new definition starts in the
 * editor (optionally from `?family=`); an existing one shows its business fields, filters, period, currency basis,
 * audience, recipients (each re-checked at issue time, DD-19), schedule and run history, with the actions to edit,
 * run now (a controlled export with a manifest) and activate or deactivate. Saving requires a current preview.
 */
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';

import { EXPORTS_FORMAT, REPORT_DEFINITIONS_FAMILY } from '@contracts/enums';
import { reportingEndpoints } from '@contracts/reporting';
import type { ReportDefinition, ReportFamilySummary, ReportRun } from '@contracts/reporting';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  Chip,
  Checkbox,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  ErrorState,
  PageHeader,
  RadioGroup,
  SkeletonBlock,
  StatusChip,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCalendarDate, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { DefinitionEditor } from '../components/DefinitionEditor';
import { emptyForm, formOf } from '../lib/definitions';
import { useDimensionOptions } from '../lib/dimensions';
import type { DimensionOptions } from '../lib/dimensions';
import { exportPath, useExportDownload } from '../lib/exports';
import { idOf, oneOf } from '../lib/shared';

export default function DefinitionPage() {
  const { definitionId: raw } = useParams();
  const definitionId = raw === undefined ? null : (idOf(raw) ?? -1);
  return <DefinitionWorkspace key={raw ?? 'new'} definitionId={definitionId} />;
}

function DefinitionWorkspace({ definitionId }: { readonly definitionId: number | null }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tenant = useActiveTenant();
  const canManage = usePermission('report.manage');
  const options = useDimensionOptions();
  const families = useApiQuery(reportingEndpoints.listReportFamilies, {});
  const query = useApiQuery(
    reportingEndpoints.getReportDefinition,
    definitionId === null || definitionId < 0 ? null : { params: { definitionId } },
  );
  const [saved, setSaved] = useState<ReportDefinition | null>(null);
  const [editing, setEditing] = useState(definitionId === null);

  const definition = saved ?? query.data ?? null;
  const familyList = families.data?.families ?? [];
  const currency = families.data?.currency ?? tenant?.defaultCurrency ?? 'BWP';

  if (definitionId !== null && definitionId < 0) {
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('reports.definition.title')}
          back={{ to: '/buyer/admin/reports', label: t('reports.definition.back') }}
        />
        <Card>
          <EmptyState icon="compass" title={t('reports.definition.notFound')} />
        </Card>
      </div>
    );
  }

  const title =
    definition?.name ??
    (definitionId === null ? t('reports.definition.newTitle') : t('reports.definition.title'));
  const back = { to: '/buyer/admin/reports', label: t('reports.definition.back') };

  if (editing) {
    if (families.data === undefined || (definitionId !== null && definition === null)) {
      return (
        <div className="tiq-page">
          <PageHeader title={title} back={back} />
          {families.error !== null ? (
            <ErrorState error={families.error} onRetry={families.reload} />
          ) : query.error !== null ? (
            <ErrorState error={query.error} onRetry={query.reload} />
          ) : (
            <SkeletonBlock lines={8} />
          )}
        </div>
      );
    }
    if (!canManage) {
      return (
        <div className="tiq-page">
          <PageHeader title={title} back={back} />
          <Banner tone="info" title={t('reports.definition.readOnlyTitle')}>
            <p>{t('reports.definition.readOnly')}</p>
          </Banner>
        </div>
      );
    }
    const initial =
      definition === null
        ? initialNewForm(familyList, params.get('family'), currency)
        : formOf(definition);
    return (
      <div className="tiq-page">
        <PageHeader
          title={title}
          subtitle={t('reports.definition.editorIntro')}
          back={back}
          meta={
            <Chip tone="neutral" size="sm">
              {t('reports.definition.draftChip')}
            </Chip>
          }
        />
        <DefinitionEditor
          initial={initial}
          families={familyList}
          options={options}
          definitionId={definition?.id ?? null}
          onSaved={(result) => {
            setSaved(result);
            setEditing(false);
          }}
          onCancel={() => {
            if (definition === null) void navigate('/buyer/admin/reports');
            else setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="tiq-page">
      {definition === null ? (
        <>
          <PageHeader title={title} back={back} />
          {query.error !== null ? (
            <ErrorState error={query.error} onRetry={query.reload} />
          ) : (
            <SkeletonBlock lines={8} />
          )}
        </>
      ) : (
        <DefinitionDetail
          definition={definition}
          families={familyList}
          options={options}
          justSaved={saved !== null}
          canManage={canManage}
          onEdit={() => setEditing(true)}
          onChanged={setSaved}
        />
      )}
    </div>
  );
}

function initialNewForm(
  families: readonly ReportFamilySummary[],
  requested: string | null,
  currency: string,
) {
  const requestedFamily =
    requested === null ? undefined : oneOf(requested, REPORT_DEFINITIONS_FAMILY);
  const family =
    families.find((item) => item.family === requestedFamily && !item.restricted) ??
    families.find((item) => !item.restricted);
  return emptyForm(
    family?.family ?? 'pipeline',
    (family?.fields ?? [])
      .filter((field) => field.sensitivity === 'normal')
      .map((field) => field.key),
    currency,
  );
}

function labelsOf(
  ids: readonly number[],
  options: readonly { id: number; label: string }[],
): string {
  if (ids.length === 0) return t('reports.definition.allValues');
  return ids.map((id) => options.find((option) => option.id === id)?.label ?? `#${id}`).join(', ');
}

function DefinitionDetail({
  definition,
  families,
  options,
  justSaved,
  canManage,
  onEdit,
  onChanged,
}: {
  readonly definition: ReportDefinition;
  readonly families: readonly ReportFamilySummary[];
  readonly options: DimensionOptions;
  readonly justSaved: boolean;
  readonly canManage: boolean;
  readonly onEdit: () => void;
  readonly onChanged: (definition: ReportDefinition) => void;
}) {
  const tenant = useActiveTenant();
  const toast = useToast();
  const timeZone = definition.schedule?.timeZone ?? tenant?.officialTimeZone ?? 'UTC';
  const family = families.find((item) => item.family === definition.family);
  const [running, setRunning] = useState(false);
  const [activating, setActivating] = useState(false);
  const [format, setFormat] = useState<(typeof EXPORTS_FORMAT)[number]>('csv');
  const [deliver, setDeliver] = useState(definition.recipients.length > 0);
  const [lastRun, setLastRun] = useState<ReportRun | null>(null);
  const run = useApiMutation(reportingEndpoints.runReportDefinition);
  const activation = useApiMutation(reportingEndpoints.setReportDefinitionActive);
  const { download, pendingId } = useExportDownload();
  const runs = lastRun === null ? definition.runs : [lastRun, ...definition.runs];

  const fieldLabel = (key: string): string =>
    family?.fields.find((field) => field.key === key)?.label ?? key;

  const runColumns: DataTableColumn<ReportRun>[] = [
    {
      id: 'runAt',
      header: t('reports.definition.runs.col.when'),
      cell: (row) => (
        <>
          <span>{formatDateTime(row.runAt, timeZone)}</span>
          <span className="tiq-cell-sub">
            {row.runBy === null ? t('reports.definition.runs.schedule') : row.runBy.fullName}
          </span>
        </>
      ),
    },
    {
      id: 'rows',
      header: t('reports.definition.runs.col.rows'),
      numeric: true,
      cell: (row) => row.rowCount,
    },
    {
      id: 'export',
      header: t('reports.definition.runs.col.export'),
      cell: (row) =>
        row.export === null ? (
          <span className="tiq-text-muted">{t('reports.definition.runs.noExport')}</span>
        ) : (
          <span className="tiq-inline">
            {row.export.accessible ? (
              <Link to={exportPath(row.export.id)}>
                {row.export.fileName ?? t('reports.exports.number', { id: row.export.id })}
              </Link>
            ) : (
              <span>
                {row.export.fileName ?? t('reports.exports.number', { id: row.export.id })}
                <span className="tiq-cell-sub">{t('reports.definition.runs.exportNotYours')}</span>
              </span>
            )}
            <StatusChip enum="exports.status" value={row.export.status} size="sm" />
          </span>
        ),
    },
    {
      id: 'recipients',
      header: t('reports.definition.runs.col.recipients'),
      cell: (row) => (
        <>
          <span>
            {row.recipients.length === 0
              ? t('reports.definition.runs.noRecipients')
              : row.recipients.map((person) => person.fullName).join(', ')}
          </span>
          {row.excludedRecipients.map((item) => (
            <span key={item.user.userId} className="tiq-cell-sub tiq-text-danger">
              {t('reports.definition.runs.excluded', {
                name: item.user.fullName,
                reason: item.reason,
              })}
            </span>
          ))}
        </>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={definition.name}
        subtitle={family?.description}
        back={{ to: '/buyer/admin/reports', label: t('reports.definition.back') }}
        meta={
          <>
            <Chip tone={definition.active ? 'success' : 'neutral'} size="sm">
              {definition.active
                ? t('reports.definition.active')
                : t('reports.definition.inactive')}
            </Chip>
            <Chip tone="info" size="sm">
              {family?.title ?? tEnum('report_definitions.family', definition.family)}
            </Chip>
            <span className="tiq-text-muted">
              {definition.schedule === null
                ? t('reports.definition.notScheduled')
                : t('reports.definition.nextRun', {
                    when:
                      definition.schedule.nextRunAt === null
                        ? t('reports.preview.noNextRun')
                        : formatDateTime(definition.schedule.nextRunAt, timeZone),
                  })}
            </span>
          </>
        }
        primaryAction={
          canManage ? (
            <Button
              variant="primary"
              icon="play"
              disabled={!definition.active}
              onClick={() => {
                run.reset();
                setRunning(true);
              }}
            >
              {t('reports.definition.runNow')}
            </Button>
          ) : undefined
        }
        actions={
          canManage ? (
            <>
              <Button icon="edit" disabled={!definition.active} onClick={onEdit}>
                {t('reports.definition.edit')}
              </Button>
              <Button
                icon={definition.active ? 'pause' : 'play'}
                onClick={() => {
                  activation.reset();
                  setActivating(true);
                }}
              >
                {definition.active
                  ? t('reports.definition.deactivate')
                  : t('reports.definition.activate')}
              </Button>
            </>
          ) : undefined
        }
      />

      {justSaved && (
        <Banner tone="success" title={t('reports.definition.savedTitle')}>
          <p>{t('reports.definition.savedNote')}</p>
        </Banner>
      )}
      {!definition.active && (
        <Banner tone="warning" title={t('reports.definition.inactiveTitle')}>
          <p>{t('reports.definition.inactiveNote')}</p>
        </Banner>
      )}

      <div className="tiq-grid tiq-grid--2">
        <Card title={t('reports.definition.sections.what')}>
          <DetailList
            items={[
              {
                key: 'owner',
                label: t('reports.definition.owner'),
                value: definition.owner.fullName,
              },
              {
                key: 'fields',
                label: t('reports.definition.fields'),
                value: definition.fields.map(fieldLabel).join(', '),
              },
              {
                key: 'period',
                label: t('reports.definition.period'),
                value:
                  definition.filters.from === null && definition.filters.to === null
                    ? t('reports.report.allDates')
                    : t('reports.report.period', {
                        from:
                          definition.filters.from === null
                            ? '…'
                            : formatCalendarDate(definition.filters.from),
                        to:
                          definition.filters.to === null
                            ? '…'
                            : formatCalendarDate(definition.filters.to),
                      }),
              },
              {
                key: 'level',
                label: t('reports.definition.level'),
                value: t(`reports.report.levels.${definition.filters.level}`),
              },
              {
                key: 'entities',
                label: t('reports.definition.entities'),
                value: labelsOf(definition.filters.legalEntityIds, options.legalEntities),
              },
              {
                key: 'departments',
                label: t('reports.definition.departments'),
                value: labelsOf(definition.filters.departmentIds, options.departments),
              },
              {
                key: 'categories',
                label: t('reports.definition.categories'),
                value: labelsOf(definition.filters.categoryIds, options.categories),
              },
              {
                key: 'stages',
                label: t('reports.definition.stages'),
                value:
                  definition.filters.stages.length === 0
                    ? t('reports.definition.allValues')
                    : definition.filters.stages
                        .map((stage) => tEnum('tenders.status', stage))
                        .join(', '),
              },
              {
                key: 'currency',
                label: t('reports.definition.currency'),
                value:
                  definition.conversionDate === null
                    ? definition.currencyBasis
                    : t('reports.definition.currencyConverted', {
                        currency: definition.currencyBasis,
                        date: formatCalendarDate(definition.conversionDate),
                      }),
              },
              {
                key: 'updated',
                label: t('reports.definition.updated'),
                value: formatDateTime(definition.updatedAt, timeZone),
              },
            ]}
          />
        </Card>
        <Card title={t('reports.definition.sections.audience')}>
          <DetailList
            items={[
              {
                key: 'audience',
                label: t('reports.definition.audience'),
                value: t(`reports.audiences.${definition.audiencePermission.replace(/\./g, '_')}`),
              },
              {
                key: 'schedule',
                label: t('reports.definition.schedule'),
                value:
                  definition.schedule === null
                    ? t('reports.definition.notScheduled')
                    : t('reports.definition.scheduleValue', {
                        description: definition.schedule.description,
                        cron: definition.schedule.cron,
                        zone: definition.schedule.timeZone,
                      }),
              },
            ]}
          />
          <h3 className="tiq-form-section-title">{t('reports.definition.recipients')}</h3>
          {definition.recipients.length === 0 ? (
            <p className="tiq-text-muted">{t('reports.preview.noRecipients')}</p>
          ) : (
            <ul className="tiq-stack" aria-label={t('reports.definition.recipients')}>
              {definition.recipients.map((recipient) => (
                <li key={recipient.user.userId} className="tiq-inline">
                  <Chip tone={recipient.authorized ? 'success' : 'danger'} size="sm">
                    {recipient.authorized
                      ? t('reports.preview.authorized')
                      : t('reports.preview.excludedRecipient')}
                  </Chip>
                  <span>{recipient.user.fullName}</span>
                  {recipient.reason !== null && (
                    <span className="tiq-cell-sub">{recipient.reason}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card
        flush
        title={t('reports.definition.runs.title')}
        subtitle={t('reports.definition.runs.subtitle')}
      >
        <DataTable
          caption={t('reports.definition.runs.title')}
          columns={runColumns}
          rows={runs}
          rowKey={(row) => `${row.id}-${row.runAt}`}
          empty={<EmptyState compact icon="history" title={t('reports.definition.runs.empty')} />}
        />
      </Card>

      <ConfirmActionDialog
        open={running}
        title={t('reports.definition.runTitle')}
        scope={t('reports.definition.runScope', { name: definition.name })}
        consequence={
          deliver
            ? t('reports.definition.runConsequenceDeliver', { count: definition.recipients.length })
            : t('reports.definition.runConsequence')
        }
        confirmLabel={t('reports.definition.runConfirm')}
        pending={run.pending || pendingId !== null}
        error={run.error}
        onCancel={() => setRunning(false)}
        onConfirm={async () => {
          try {
            const result = await run.mutate({
              params: { definitionId: definition.id },
              body: { format, deliverToRecipients: deliver },
            });
            setLastRun(result);
            invalidateApiQueries('buyer.exports.');
            setRunning(false);
            toast.show(t('reports.definition.runDone', { rows: result.rowCount }), 'success');
            if (result.export !== null && result.export.status === 'ready') {
              await download(result.export.id);
            }
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <RadioGroup
          label={t('reports.export.format')}
          inline
          value={format}
          onChange={(value) => {
            const next = EXPORTS_FORMAT.find((item) => item === value);
            if (next !== undefined) setFormat(next);
          }}
          options={EXPORTS_FORMAT.map((value) => ({
            value,
            label: t(`reports.export.formats.${value}`),
          }))}
        />
        <Checkbox
          label={t('reports.definition.deliver')}
          hint={t('reports.definition.deliverHint')}
          checked={deliver}
          disabled={definition.recipients.length === 0}
          onChange={setDeliver}
        />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={activating}
        title={
          definition.active
            ? t('reports.definition.deactivateTitle')
            : t('reports.definition.activateTitle')
        }
        scope={t('reports.definition.runScope', { name: definition.name })}
        consequence={
          definition.active
            ? t('reports.definition.deactivateConsequence')
            : t('reports.definition.activateConsequence')
        }
        confirmLabel={
          definition.active ? t('reports.definition.deactivate') : t('reports.definition.activate')
        }
        tone={definition.active ? 'danger' : 'primary'}
        reason={{ label: t('reports.definition.reason'), required: true }}
        pending={activation.pending}
        error={activation.error}
        onCancel={() => setActivating(false)}
        onConfirm={async ({ reason }) => {
          try {
            const result = await activation.mutate({
              params: { definitionId: definition.id },
              body: { active: !definition.active, reason },
            });
            invalidateApiQueries('buyer.reportDefinitions.');
            onChanged(result);
            setActivating(false);
            toast.show(
              result.active
                ? t('reports.definition.activatedToast', { name: result.name })
                : t('reports.definition.deactivatedToast', { name: result.name }),
              'success',
            );
          } catch {
            // Shown in the dialog.
          }
        }}
      />
    </>
  );
}
