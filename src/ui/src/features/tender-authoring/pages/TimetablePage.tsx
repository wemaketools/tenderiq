/**
 * BUY-12 — Timetable and participation rules: the official time zone, the working-day calendar, the opening plan
 * (envelopes, single-stage or staged), question dates, visits, deadlines, qualification and submission rules.
 * Principal actions: set a coherent schedule, define the envelope stages and specify participation conditions.
 * Every date renders through OfficialDeadline in the tender's official zone (BR-11, DD-33); non-working days of the
 * calendar are flagged with the next working day (BR-12).
 */
import { useState } from 'react';

import { getTimetable, removeParticipationCondition } from '@contracts/tenders';
import type {
  Milestone,
  ParticipationCondition,
  TenderTimetable,
  TimetableMutationResult,
} from '@contracts/tenders';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  ErrorState,
  KpiCard,
  KpiGrid,
  OfficialDeadline,
  OrDash,
  RestrictedState,
  SkeletonBlock,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCalendarDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { IssueList } from '../components/IssueList';
import { ConditionDialog, EnvelopesDialog } from '../components/ParticipationDialogs';
import { TenderHeader, TenderWorkspace } from '../components/TenderWorkspace';
import type { TenderWorkspaceContext } from '../components/TenderWorkspace';
import { TimetableEditor, WorkingDayChip } from '../components/TimetableEditor';
import { withTenderMessage } from '../lib/errors';
import { scopeLabel } from '../lib/labels';
import { useOverlay } from '../lib/overlay';

export default function TimetablePage() {
  return <TenderWorkspace>{(context) => <Timetable context={context} />}</TenderWorkspace>;
}

function Timetable({ context }: { readonly context: TenderWorkspaceContext }) {
  const { tender, canEdit } = context;
  const toast = useToast();
  const query = useApiQuery(getTimetable, { params: { tenderId: tender.id } });
  const [saved, setSaved] = useState<TenderTimetable | null>(null);
  const conditions = useOverlay<ParticipationCondition>();
  const [editing, setEditing] = useState(false);
  const [envelopesOpen, setEnvelopesOpen] = useState(false);
  const [conditionOpen, setConditionOpen] = useState(false);
  const [conditionEditing, setConditionEditing] = useState<ParticipationCondition | null>(null);
  const [removing, setRemoving] = useState<ParticipationCondition | null>(null);
  const remove = useApiMutation(removeParticipationCondition);

  const timetable = saved ?? query.data ?? null;

  const onTimetableSaved = (result: TimetableMutationResult): void => {
    setSaved(result.timetable);
    context.reportChange(result.change);
    setEditing(false);
    toast.show(
      t('tender-authoring.timetable.saved', { revision: result.change.draftRevision }),
      'success',
    );
  };

  const confirmRemove = async (): Promise<void> => {
    if (removing === null) return;
    try {
      const result = await remove.mutate({
        params: { tenderId: tender.id, conditionId: removing.id },
      });
      conditions.remove(result.removedId);
      context.reportChange(result.change);
      setRemoving(null);
      remove.reset();
    } catch {
      // Shown in the dialog.
    }
  };

  const milestoneColumns = (current: TenderTimetable): DataTableColumn<Milestone>[] => [
    {
      id: 'milestone',
      header: t('tender-authoring.timetable.milestone'),
      cell: (row) => (
        <>
          <span>{tEnum('tender_milestones.milestone', row.milestone)}</span>
          <span className="tiq-cell-sub">{scopeLabel(row.lot)}</span>
        </>
      ),
    },
    {
      id: 'when',
      header: t('tender-authoring.timetable.when'),
      cell: (row) => <OfficialDeadline deadline={row.deadline} />,
    },
    {
      id: 'working',
      header: t('tender-authoring.timetable.workingDayCol'),
      cell: (row) => (
        <WorkingDayChip
          at={row.deadline.at}
          timeZone={current.officialTimeZone}
          holidays={current.holidays}
        />
      ),
    },
    {
      id: 'disclosed',
      header: t('tender-authoring.timetable.disclosedCol'),
      cell: (row) =>
        row.isDisclosed ? (
          t('tender-authoring.timetable.published')
        ) : (
          <Chip tone="neutral" size="sm" icon="eyeOff">
            {t('tender-authoring.timetable.internal')}
          </Chip>
        ),
    },
    {
      id: 'note',
      header: t('tender-authoring.timetable.note'),
      cell: (row) => <OrDash>{row.note}</OrDash>,
    },
  ];

  const content = (() => {
    if (query.error !== null && saved === null) {
      return query.error.kind === 'forbidden' ? (
        <RestrictedState />
      ) : (
        <ErrorState error={query.error} onRetry={query.reload} />
      );
    }
    if (timetable === null) return <SkeletonBlock lines={8} />;
    const period = timetable.responsePeriod;
    const short =
      period.calendarDays !== null &&
      period.policyMinimumDays !== null &&
      period.calendarDays < period.policyMinimumDays;
    const conditionRows = conditions.apply(timetable.participationConditions);
    const blocking = timetable.issues.filter((issue) => issue.severity === 'blocking').length;
    return (
      <>
        <KpiGrid>
          <KpiCard
            label={t('tender-authoring.timetable.kpi.period')}
            icon="timer"
            tone={short ? 'danger' : 'success'}
            value={
              period.calendarDays === null
                ? null
                : t('tender-authoring.pricing.days', { count: period.calendarDays })
            }
            hint={
              period.policyMinimumDays === null
                ? t('tender-authoring.timetable.kpi.noPolicy')
                : t('tender-authoring.timetable.kpi.periodHint', {
                    working: period.workingDays ?? 0,
                    minimum: period.policyMinimumDays,
                  })
            }
          />
          <KpiCard
            label={t('tender-authoring.timetable.release')}
            icon="megaphone"
            tone="info"
            value={
              timetable.scheduledReleaseAt === null ? null : (
                <OfficialDeadline
                  deadline={{
                    at: timetable.scheduledReleaseAt,
                    timeZone: timetable.officialTimeZone,
                  }}
                  showLocal={false}
                />
              )
            }
          />
          <KpiCard
            label={t('tender-authoring.timetable.kpi.deadline')}
            icon="clock"
            tone="accent"
            value={
              period.submissionDeadline === null ? null : (
                <OfficialDeadline deadline={period.submissionDeadline} showLocal={false} />
              )
            }
          />
          <KpiCard
            label={t('tender-authoring.timetable.kpi.issues')}
            icon="alertTriangle"
            tone={blocking > 0 ? 'danger' : timetable.issues.length > 0 ? 'warning' : 'success'}
            value={timetable.issues.length}
            hint={t('tender-authoring.timetable.kpi.issuesHint', { blocking })}
          />
        </KpiGrid>
        <IssueList issues={timetable.issues} label={t('tender-authoring.timetable.issues')} />
        <div className="tiq-grid tiq-grid--sidebar">
          <div className="tiq-stack">
            {editing ? (
              <TimetableEditor
                tenderId={tender.id}
                draftRevision={tender.draftRevision}
                timetable={timetable}
                lots={tender.lots}
                onCancel={() => setEditing(false)}
                onSaved={onTimetableSaved}
              />
            ) : (
              <Card
                title={t('tender-authoring.timetable.milestones')}
                subtitle={t('tender-authoring.timetable.zoneNote', {
                  zone: timetable.officialTimeZone,
                })}
                flush
              >
                <DataTable
                  caption={t('tender-authoring.timetable.milestonesCaption')}
                  columns={milestoneColumns(timetable)}
                  rows={timetable.milestones}
                  rowKey={(row) => String(row.id)}
                  empty={
                    <EmptyState
                      compact
                      icon="calendar"
                      title={t('tender-authoring.timetable.noMilestones')}
                    />
                  }
                />
              </Card>
            )}
            <Card
              title={t('tender-authoring.conditions.title')}
              subtitle={t('tender-authoring.conditions.subtitle')}
              actions={
                canEdit ? (
                  <Button
                    size="sm"
                    icon="plus"
                    onClick={() => {
                      setConditionEditing(null);
                      setConditionOpen(true);
                    }}
                  >
                    {t('tender-authoring.conditions.add')}
                  </Button>
                ) : undefined
              }
            >
              {conditionRows.length === 0 ? (
                <EmptyState
                  compact
                  icon="shieldCheck"
                  title={t('tender-authoring.conditions.empty')}
                />
              ) : (
                <ul className="tiq-stack" aria-label={t('tender-authoring.conditions.title')}>
                  {conditionRows.map((row) => (
                    <li key={row.id} className="tiq-stack">
                      <span className="tiq-inline">
                        <strong>
                          {tEnum('participation_conditions.condition_type', row.conditionType)}
                        </strong>
                        <Chip tone={row.blocking ? 'danger' : 'info'} size="sm">
                          {row.blocking
                            ? t('tender-authoring.conditions.isBlocking')
                            : t('tender-authoring.conditions.isInfo')}
                        </Chip>
                        {canEdit && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              icon="edit"
                              aria-label={t('tender-authoring.conditions.editOne', {
                                type: tEnum(
                                  'participation_conditions.condition_type',
                                  row.conditionType,
                                ),
                              })}
                              onClick={() => {
                                setConditionEditing(row);
                                setConditionOpen(true);
                              }}
                            >
                              {t('tender-authoring.common.edit')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              icon="trash"
                              aria-label={t('tender-authoring.conditions.removeOne', {
                                type: tEnum(
                                  'participation_conditions.condition_type',
                                  row.conditionType,
                                ),
                              })}
                              onClick={() => setRemoving(row)}
                            >
                              {t('tender-authoring.common.remove')}
                            </Button>
                          </>
                        )}
                      </span>
                      <span>{row.description}</span>
                      {row.qualificationProgram !== null && (
                        <span className="tiq-cell-sub">
                          {t('tender-authoring.conditions.programValue', {
                            name: row.qualificationProgram.name,
                          })}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
          <div className="tiq-stack">
            <Card title={t('tender-authoring.timetable.calendarTitle')}>
              <DetailList
                stacked
                items={[
                  {
                    key: 'zone',
                    label: t('tender-authoring.fields.officialTimeZone'),
                    value: timetable.officialTimeZone,
                  },
                  {
                    key: 'calendar',
                    label: t('tender-authoring.fields.calendar'),
                    value: timetable.calendar?.name ?? null,
                  },
                  {
                    key: 'policy',
                    label: t('tender-authoring.fields.policy'),
                    value:
                      timetable.policy === null
                        ? null
                        : t('tender-authoring.timetable.policyValue', {
                            name: timetable.policy.profileName,
                            version: timetable.policy.versionNo,
                            days: timetable.policy.minResponseDays ?? '—',
                            questions: timetable.policy.questionDeadlineDaysBeforeClose ?? '—',
                          }),
                  },
                ]}
              />
              {timetable.holidays.length > 0 && (
                <>
                  <p className="tiq-text-muted">{t('tender-authoring.timetable.holidays')}</p>
                  <ul className="tiq-stack">
                    {timetable.holidays.map((holiday) => (
                      <li key={holiday.date}>
                        {formatCalendarDate(holiday.date)} · {holiday.name}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
            <Card
              title={t('tender-authoring.envelopes.title')}
              actions={
                canEdit ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="edit"
                    onClick={() => setEnvelopesOpen(true)}
                  >
                    {t('tender-authoring.common.edit')}
                  </Button>
                ) : undefined
              }
            >
              <DetailList
                stacked
                items={[
                  {
                    key: 'mode',
                    label: t('tender-authoring.envelopes.mode'),
                    value: tEnum('tenders.opening_mode', timetable.openingMode),
                  },
                  ...[...timetable.envelopes]
                    .sort((a, b) => a.openOrder - b.openOrder)
                    .map((row) => ({
                      key: row.envelope,
                      label: tEnum('tender_envelopes.envelope', row.envelope),
                      value: t('tender-authoring.envelopes.value', {
                        order: row.openOrder,
                        count: row.requirementCount,
                      }),
                    })),
                ]}
              />
            </Card>
            <Card title={t('tender-authoring.timetable.rulesTitle')}>
              <DetailList
                stacked
                items={[
                  {
                    key: 'submission',
                    label: t('tender-authoring.timetable.submissionRules'),
                    value: timetable.submissionRules,
                  },
                  {
                    key: 'late',
                    label: t('tender-authoring.timetable.lateRule'),
                    value: timetable.lateMaterialRule,
                  },
                  {
                    key: 'channel',
                    label: t('tender-authoring.timetable.channel'),
                    value: tender.communicationChannelNote,
                  },
                ]}
              />
            </Card>
          </div>
        </div>
        {canEdit && (
          <>
            <EnvelopesDialog
              open={envelopesOpen}
              tenderId={tender.id}
              draftRevision={tender.draftRevision}
              timetable={timetable}
              onClose={() => setEnvelopesOpen(false)}
              onSaved={(result) => {
                setSaved(result.timetable);
                context.reportChange(result.change);
              }}
            />
            <ConditionDialog
              open={conditionOpen}
              tenderId={tender.id}
              programs={timetable.qualificationPrograms}
              condition={conditionEditing}
              onClose={() => setConditionOpen(false)}
              onSaved={(result) => {
                conditions.put(result.condition);
                context.reportChange(result.change);
              }}
            />
          </>
        )}
      </>
    );
  })();

  return (
    <>
      <TenderHeader
        context={context}
        section="timetable"
        primaryAction={
          canEdit && !editing && timetable !== null ? (
            <Button variant="primary" icon="calendar" onClick={() => setEditing(true)}>
              {t('tender-authoring.timetable.edit')}
            </Button>
          ) : undefined
        }
      />
      {content}
      <ConfirmActionDialog
        open={removing !== null}
        tone="danger"
        title={t('tender-authoring.conditions.removeTitle')}
        scope={
          removing === null
            ? ''
            : `${tender.reference} · ${tEnum('participation_conditions.condition_type', removing.conditionType)}`
        }
        consequence={t('tender-authoring.conditions.removeResult')}
        confirmLabel={t('tender-authoring.common.remove')}
        onConfirm={() => confirmRemove()}
        onCancel={() => {
          setRemoving(null);
          remove.reset();
        }}
        pending={remove.pending}
        error={withTenderMessage(remove.error)}
      />
    </>
  );
}
