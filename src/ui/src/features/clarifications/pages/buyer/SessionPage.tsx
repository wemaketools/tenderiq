/**
 * BUY-18 Briefings and visits, one session: logistics, registered suppliers with attendees and accommodation needs,
 * attendance, mandatory status and alternatives, attendance exceptions (resolved the same way for every supplier),
 * and the official minutes whose material answers are shared with the whole competition audience (FR-10).
 */
import { useState } from 'react';
import { useLocation, useParams } from 'react-router';

import { BuyerSessionDetail, clarificationsEndpoints } from '@contracts/clarifications';
import type { BuyerSessionRegistration } from '@contracts/clarifications';

import { useApiMutation, useApiQuery } from '../../../../api/hooks';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  OfficialDeadline,
  PageHeader,
  QueryView,
  RadioGroup,
  Reference,
  Select,
  StatusChip,
  TextArea,
  useToast,
} from '../../../../components/ui';
import { EMPTY_VALUE, formatDateTime, formatOfficialTime } from '../../../../lib/format';
import { t } from '../../../../lib/i18n';
import { useNow } from '../../../../lib/useNow';
import { ClarificationHistory, SharedAnswerList } from '../../components/shared';
import { buyerPaths, explainError } from '../../lib';

type DialogKind = 'cancel' | 'attendance' | 'minutes' | 'exception';

interface AnswerRow {
  readonly key: number;
  readonly supplierTenantId: string;
  readonly sanitizedQuestion: string;
  readonly answerText: string;
}

export default function SessionPage() {
  const { sessionId } = useParams();
  const id = Number(sessionId);
  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('clarifications.sessionPage.notFound')} />
        <EmptyState title={t('clarifications.sessionPage.notFound')} />
      </div>
    );
  }
  return <SessionLoader key={id} sessionId={id} />;
}

function SessionLoader({ sessionId }: { readonly sessionId: number }) {
  const location = useLocation();
  const carried = BuyerSessionDetail.safeParse(
    (location.state as { session?: unknown } | null)?.session,
  );
  const initial = carried.success && carried.data.id === sessionId ? carried.data : null;
  const query = useApiQuery(
    clarificationsEndpoints.sessionsGet,
    initial === null ? { params: { sessionId } } : null,
  );
  const [result, setResult] = useState<BuyerSessionDetail | null>(null);
  const current = result ?? initial;
  return (
    <div className="tiq-page">
      {current !== null ? (
        <SessionWorkspace session={current} onChanged={setResult} />
      ) : (
        <>
          {query.data === undefined && (
            <PageHeader
              title={t('clarifications.sessions.title')}
              back={{ to: buyerPaths.sessions, label: t('clarifications.sessionPage.back') }}
            />
          )}
          <QueryView query={query}>
            {(data) => <SessionWorkspace session={data} onChanged={setResult} />}
          </QueryView>
        </>
      )}
    </div>
  );
}

function SessionWorkspace({
  session,
  onChanged,
}: {
  readonly session: BuyerSessionDetail;
  readonly onChanged: (next: BuyerSessionDetail) => void;
}) {
  const toast = useToast();
  const e = clarificationsEndpoints;
  const tz = session.timeZone;
  const now = useNow();
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [attendance, setAttendance] = useState<Record<number, 'attended' | 'absent'>>({});
  const [minutesDocument, setMinutesDocument] = useState('');
  const [minutesAudience, setMinutesAudience] = useState<'all_participants' | 'public'>(
    'all_participants',
  );
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [minutesTried, setMinutesTried] = useState(false);
  const [exceptionFor, setExceptionFor] = useState<BuyerSessionRegistration | null>(null);
  const [resolution, setResolution] = useState<'offer_alternative' | 'confirm_not_met'>(
    'offer_alternative',
  );
  const [alternative, setAlternative] = useState('');

  const cancel = useApiMutation(e.sessionsCancel);
  const record = useApiMutation(e.sessionsRecordAttendance);
  const minutes = useApiMutation(e.sessionsPublishMinutes);
  const resolve = useApiMutation(e.sessionsResolveException);

  const active = session.registrations.filter((row) => row.status !== 'cancelled');
  const scope = t('clarifications.sessionPage.scope', {
    title: session.title,
    reference: session.tender.reference,
  });
  const started = Date.parse(session.startsAt) <= now;
  const canRecord = session.status !== 'cancelled' && active.length > 0 && started;
  const canPublishMinutes = session.status === 'completed' && session.minutesPublishedAt === null;

  const done = (next: BuyerSessionDetail, message: string): void => {
    onChanged(next);
    setDialog(null);
    setExceptionFor(null);
    toast.show(message, 'success');
  };
  const close = (reset: () => void) => () => {
    reset();
    setDialog(null);
    setExceptionFor(null);
  };
  const attempt = async (action: () => Promise<void>): Promise<void> => {
    try {
      await action();
    } catch {
      // The mutation keeps the error; the dialog shows it.
    }
  };
  const setAnswer = (key: number, values: Partial<AnswerRow>): void =>
    setAnswers(answers.map((row) => (row.key === key ? { ...row, ...values } : row)));
  const answersIncomplete = answers.some(
    (row) =>
      row.supplierTenantId === '' ||
      row.sanitizedQuestion.trim() === '' ||
      row.answerText.trim() === '',
  );

  return (
    <>
      <PageHeader
        title={session.title}
        subtitle={t('clarifications.sessionPage.subtitle', {
          type: t(`clarifications.sessionType.${session.sessionType}`),
          reference: session.tender.reference,
        })}
        back={{ to: buyerPaths.sessions, label: t('clarifications.sessionPage.back') }}
        meta={
          <>
            <Reference value={session.tender.reference} />
            <StatusChip enum="sessions.status" value={session.status} />
            <StatusChip enum="sessions.session_type" value={session.sessionType} />
            {session.mandatory && (
              <Chip tone="warning">{t('clarifications.sessions.mandatory')}</Chip>
            )}
            {session.registrationDeadline !== null && (
              <OfficialDeadline
                variant="block"
                label={t('clarifications.sessionPage.registrationDeadline')}
                deadline={session.registrationDeadline}
              />
            )}
            <span>
              <strong>{t('clarifications.common.nextAction')}:</strong>{' '}
              {session.status === 'scheduled' && started && active.length > 0
                ? t('clarifications.next.session.attendance')
                : session.status === 'scheduled'
                  ? t('clarifications.next.session.scheduled')
                  : session.status === 'completed' && session.minutesPublishedAt === null
                    ? t('clarifications.next.session.minutes')
                    : session.openAttendanceExceptions > 0
                      ? t('clarifications.next.session.exceptions')
                      : t('clarifications.next.none')}
            </span>
          </>
        }
        primaryAction={
          canPublishMinutes ? (
            <Button variant="primary" icon="upload" onClick={() => setDialog('minutes')}>
              {t('clarifications.sessionPage.action.minutes')}
            </Button>
          ) : undefined
        }
        actions={
          <>
            {session.status === 'scheduled' && (
              <ButtonLink icon="edit" to={buyerPaths.editSession(session.id)}>
                {t('clarifications.sessionPage.action.edit')}
              </ButtonLink>
            )}
            {canRecord && (
              <Button
                icon="userCheck"
                onClick={() => {
                  setAttendance(
                    Object.fromEntries(
                      active.map((row) => [
                        row.id,
                        row.status === 'absent' ? 'absent' : 'attended',
                      ]),
                    ),
                  );
                  setDialog('attendance');
                }}
              >
                {t('clarifications.sessionPage.action.attendance')}
              </Button>
            )}
            {session.status === 'scheduled' && (
              <Button variant="danger-soft" icon="ban" onClick={() => setDialog('cancel')}>
                {t('clarifications.sessionPage.action.cancel')}
              </Button>
            )}
          </>
        }
      />

      {session.status === 'cancelled' && (
        <Banner tone="warning" title={t('clarifications.sessionPage.cancelledBanner')}>
          <p>{session.cancellationReason}</p>
        </Banner>
      )}
      {session.openAttendanceExceptions > 0 && (
        <Banner
          tone="error"
          title={t('clarifications.sessionPage.exceptionsBanner', {
            count: session.openAttendanceExceptions,
          })}
        >
          <p>{t('clarifications.sessionPage.exceptionsDetail')}</p>
        </Banner>
      )}

      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack tiq-stack--spaced">
          <Card flush title={t('clarifications.sessionPage.registrations')}>
            <DataTable<BuyerSessionRegistration>
              caption={t('clarifications.sessionPage.registrations')}
              rows={session.registrations}
              rowKey={(row) => String(row.id)}
              empty={
                <EmptyState
                  compact
                  icon="users"
                  title={t('clarifications.sessionPage.noRegistrations')}
                />
              }
              columns={[
                {
                  id: 'supplier',
                  header: t('clarifications.sessionPage.col.supplier'),
                  cell: (row) => (
                    <>
                      {row.supplier.name}
                      <div className="tiq-cell-sub">
                        {t('clarifications.sessionPage.registeredBy', {
                          name: row.registeredBy.fullName,
                          at: formatDateTime(row.createdAt, tz),
                        })}
                      </div>
                    </>
                  ),
                },
                {
                  id: 'attendees',
                  header: t('clarifications.sessionPage.col.attendees'),
                  cell: (row) => row.attendeeNames.join(', '),
                },
                {
                  id: 'accessibility',
                  header: t('clarifications.sessionPage.col.accessibility'),
                  cell: (row) =>
                    row.accessibilityNeeds === null ? (
                      EMPTY_VALUE
                    ) : (
                      <span className="tiq-inline">
                        <Chip tone="info" size="sm" icon="userCheck">
                          {t('clarifications.sessionPage.accommodation')}
                        </Chip>
                        {row.accessibilityNeeds}
                      </span>
                    ),
                },
                {
                  id: 'status',
                  header: t('clarifications.sessionPage.col.status'),
                  cell: (row) => (
                    <div className="tiq-stack">
                      <StatusChip
                        enum="session_registrations.status"
                        value={row.status}
                        size="sm"
                      />
                      {row.attendanceRecordedAt !== null && (
                        <span className="tiq-cell-sub">
                          {t('clarifications.sessionPage.recordedBy', {
                            name: row.attendanceRecordedBy?.fullName ?? EMPTY_VALUE,
                            at: formatDateTime(row.attendanceRecordedAt, tz),
                          })}
                        </span>
                      )}
                    </div>
                  ),
                },
                {
                  id: 'exception',
                  header: t('clarifications.sessionPage.col.exception'),
                  cell: (row) =>
                    !row.attendanceException ? (
                      EMPTY_VALUE
                    ) : row.exceptionResolution !== null ? (
                      <div className="tiq-stack">
                        <Chip tone="success" size="sm">
                          {t(`clarifications.resolution.${row.exceptionResolution.resolution}`)}
                        </Chip>
                        <span className="tiq-cell-sub">{row.exceptionResolution.note}</span>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="danger-soft"
                        onClick={() => {
                          setExceptionFor(row);
                          setResolution(
                            session.alternatives.length > 0
                              ? 'offer_alternative'
                              : 'confirm_not_met',
                          );
                          setAlternative('');
                          setDialog('exception');
                        }}
                      >
                        {t('clarifications.sessionPage.action.resolve', {
                          supplier: row.supplier.name,
                        })}
                      </Button>
                    ),
                },
              ]}
            />
          </Card>

          <Card
            title={t('clarifications.sessionPage.minutes')}
            subtitle={
              session.minutesPublishedAt === null
                ? t('clarifications.sessionPage.minutesPending')
                : t('clarifications.sessionPage.minutesPublishedAt', {
                    at: formatDateTime(session.minutesPublishedAt, tz),
                  })
            }
          >
            <div className="tiq-stack">
              {session.minutesDocument !== null && (
                <p>
                  {t('clarifications.sessionPage.minutesDocument')}{' '}
                  <Reference
                    value={session.minutesDocument.title}
                    to={`/me/documents/${session.minutesDocument.documentId}`}
                  />
                </p>
              )}
              {session.minutesPublishedAt !== null && session.minutesDocument === null && (
                <p className="tiq-text-muted">{t('clarifications.sessionPage.minutesRecord')}</p>
              )}
              <SharedAnswerList
                answers={session.sharedAnswers}
                timeZone={tz}
                emptyTitle={t('clarifications.sessionPage.noSharedAnswers')}
              />
            </div>
          </Card>
        </div>

        <div className="tiq-stack tiq-stack--spaced">
          <Card title={t('clarifications.sessionPage.logistics')}>
            <DetailList
              stacked
              items={[
                {
                  key: 'when',
                  label: t('clarifications.sessionPage.when'),
                  value: `${formatOfficialTime(session.startsAt, tz)} – ${formatDateTime(session.endsAt, tz)}`,
                },
                {
                  key: 'venue',
                  label: t('clarifications.sessionForm.venue'),
                  value: session.venue,
                },
                {
                  key: 'instructions',
                  label: t('clarifications.sessionForm.instructions'),
                  value: session.instructions,
                },
                {
                  key: 'lot',
                  label: t('clarifications.addendumForm.lot'),
                  value:
                    session.lot === null
                      ? t('clarifications.common.allLots')
                      : t('clarifications.common.lotLabel', {
                          no: session.lot.lotNo,
                          title: session.lot.title,
                        }),
                },
                {
                  key: 'places',
                  label: t('clarifications.sessions.col.places'),
                  value: t('clarifications.sessionPage.placesDetail', {
                    registered: session.registered,
                    capacity: session.capacity,
                    available: session.placesAvailable,
                  }),
                },
                {
                  key: 'accessibility',
                  label: t('clarifications.sessionForm.accessibility'),
                  value: session.accessibilityInfo,
                },
                {
                  key: 'alternativeOf',
                  label: t('clarifications.sessionPage.alternativeOf'),
                  value:
                    session.alternativeOf === null ? null : (
                      <Reference
                        value={session.alternativeOf.title}
                        to={buyerPaths.session(session.alternativeOf.id)}
                      />
                    ),
                },
                {
                  key: 'alternatives',
                  label: t('clarifications.sessionPage.alternatives'),
                  value:
                    session.alternatives.length === 0 ? null : (
                      <ul>
                        {session.alternatives.map((item) => (
                          <li key={item.id}>
                            <Reference value={item.title} to={buyerPaths.session(item.id)} />{' '}
                            {t('clarifications.sessions.available', {
                              count: item.placesAvailable,
                            })}
                          </li>
                        ))}
                      </ul>
                    ),
                },
              ]}
            />
          </Card>
          <Card title={t('clarifications.history.title')}>
            <ClarificationHistory entries={session.history} timeZone={tz} />
          </Card>
        </div>
      </div>

      <ConfirmActionDialog
        open={dialog === 'cancel'}
        tone="danger"
        title={t('clarifications.sessionPage.cancelDialog.title')}
        scope={scope}
        consequence={t('clarifications.sessionPage.cancelDialog.consequence', {
          count: active.length,
        })}
        confirmLabel={t('clarifications.sessionPage.action.cancel')}
        pending={cancel.pending}
        error={explainError(cancel.error)}
        reason={{ label: t('clarifications.common.reason'), required: true }}
        onCancel={close(cancel.reset)}
        onConfirm={({ reason }) =>
          attempt(async () => {
            const next = await cancel.mutate({
              params: { sessionId: session.id },
              body: { reason },
            });
            done(next, t('clarifications.sessionPage.toast.cancelled'));
          })
        }
      />

      <ConfirmActionDialog
        open={dialog === 'attendance'}
        title={t('clarifications.sessionPage.attendanceDialog.title')}
        scope={scope}
        consequence={t('clarifications.sessionPage.attendanceDialog.consequence')}
        confirmLabel={t('clarifications.sessionPage.action.attendance')}
        pending={record.pending}
        error={explainError(record.error)}
        onCancel={close(record.reset)}
        onConfirm={() =>
          attempt(async () => {
            const next = await record.mutate({
              params: { sessionId: session.id },
              body: {
                entries: active.map((row) => ({
                  registrationId: row.id,
                  status: attendance[row.id] ?? 'attended',
                })),
              },
            });
            done(next, t('clarifications.sessionPage.toast.attendance'));
          })
        }
      >
        <div className="tiq-stack">
          {active.map((row) => (
            <RadioGroup
              key={row.id}
              inline
              label={`${row.supplier.name} (${row.attendeeNames.join(', ')})`}
              value={attendance[row.id] ?? 'attended'}
              onChange={(value) =>
                setAttendance({ ...attendance, [row.id]: value as 'attended' | 'absent' })
              }
              options={(['attended', 'absent'] as const).map((value) => ({
                value,
                label: t(`clarifications.attendance.${value}`),
              }))}
            />
          ))}
          {session.mandatory && (
            <p className="tiq-text-muted">
              {t('clarifications.sessionPage.attendanceDialog.mandatory')}
            </p>
          )}
        </div>
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'minutes'}
        title={t('clarifications.sessionPage.minutesDialog.title')}
        scope={scope}
        consequence={t(`clarifications.sessionPage.minutesDialog.${minutesAudience}`)}
        confirmLabel={t('clarifications.sessionPage.action.minutes')}
        pending={minutes.pending}
        error={explainError(minutes.error)}
        onCancel={() => {
          setMinutesTried(false);
          close(minutes.reset)();
        }}
        onConfirm={() => {
          setMinutesTried(true);
          if (answersIncomplete) return;
          void attempt(async () => {
            const next = await minutes.mutate({
              params: { sessionId: session.id },
              body: {
                minutesDocumentId: minutesDocument === '' ? null : Number(minutesDocument),
                audience: minutesAudience,
                sharedAnswers: answers.map((row) => ({
                  supplierTenantId: Number(row.supplierTenantId),
                  sanitizedQuestion: row.sanitizedQuestion,
                  answerText: row.answerText,
                })),
              },
            });
            done(next, t('clarifications.sessionPage.toast.minutes'));
          });
        }}
      >
        <div className="tiq-form-stack">
          <Select
            label={t('clarifications.sessionPage.minutesDialog.document')}
            hint={t('clarifications.sessionPage.minutesDialog.documentHint')}
            value={minutesDocument}
            onChange={setMinutesDocument}
            placeholder={t('clarifications.sessionPage.minutesDialog.noDocument')}
            options={session.minutesDocumentOptions.map((document) => ({
              value: String(document.documentId),
              label: document.title,
            }))}
          />
          <RadioGroup
            label={t('clarifications.questionPage.audience')}
            value={minutesAudience}
            onChange={(value) => setMinutesAudience(value as 'all_participants' | 'public')}
            options={(['all_participants', 'public'] as const).map((value) => ({
              value,
              label: t(`clarifications.audience.${value}`),
            }))}
          />
          <p className="tiq-text-muted">
            {t('clarifications.sessionPage.minutesDialog.answersHint')}
          </p>
          {answers.map((row, index) => (
            <fieldset key={row.key} className="tiq-fieldset">
              <legend>
                {t('clarifications.sessionPage.minutesDialog.answerNo', { no: index + 1 })}
              </legend>
              <Select
                label={t('clarifications.sessionPage.minutesDialog.raisedBy')}
                hint={t('clarifications.sessionPage.minutesDialog.raisedByHint')}
                required
                value={row.supplierTenantId}
                onChange={(value) => setAnswer(row.key, { supplierTenantId: value })}
                placeholder={t('clarifications.sessionPage.minutesDialog.pickSupplier')}
                options={active.map((registration) => ({
                  value: String(registration.supplier.tenantId),
                  label: registration.supplier.name,
                }))}
              />
              <TextArea
                label={t('clarifications.questionPage.sanitized')}
                required
                rows={2}
                value={row.sanitizedQuestion}
                onChange={(value) => setAnswer(row.key, { sanitizedQuestion: value })}
              />
              <TextArea
                label={t('clarifications.questionPage.answer')}
                required
                rows={3}
                value={row.answerText}
                onChange={(value) => setAnswer(row.key, { answerText: value })}
              />
              <Button
                size="sm"
                variant="danger-soft"
                icon="trash"
                onClick={() => setAnswers(answers.filter((item) => item.key !== row.key))}
              >
                {t('clarifications.sessionPage.minutesDialog.removeAnswer', { no: index + 1 })}
              </Button>
            </fieldset>
          ))}
          {minutesTried && answersIncomplete && (
            <p className="tiq-field-error">
              {t('clarifications.sessionPage.minutesDialog.answersIncomplete')}
            </p>
          )}
          <div>
            <Button
              size="sm"
              icon="plus"
              onClick={() => {
                setAnswers([
                  ...answers,
                  { key: nextKey, supplierTenantId: '', sanitizedQuestion: '', answerText: '' },
                ]);
                setNextKey(nextKey + 1);
              }}
            >
              {t('clarifications.sessionPage.minutesDialog.addAnswer')}
            </Button>
          </div>
        </div>
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'exception' && exceptionFor !== null}
        title={t('clarifications.sessionPage.exceptionDialog.title')}
        scope={t('clarifications.sessionPage.exceptionDialog.scope', {
          supplier: exceptionFor?.supplier.name ?? '',
          title: session.title,
        })}
        consequence={t(`clarifications.sessionPage.exceptionDialog.${resolution}`)}
        confirmLabel={t('clarifications.sessionPage.exceptionDialog.confirm')}
        pending={resolve.pending}
        error={explainError(resolve.error)}
        reason={{ label: t('clarifications.common.note'), required: true }}
        onCancel={close(resolve.reset)}
        onConfirm={({ reason }) => {
          if (exceptionFor === null) return;
          if (resolution === 'offer_alternative' && alternative === '') return;
          void attempt(async () => {
            const next = await resolve.mutate({
              params: { sessionId: session.id, registrationId: exceptionFor.id },
              body: {
                resolution,
                alternativeSessionId:
                  resolution === 'offer_alternative' ? Number(alternative) : null,
                note: reason,
              },
            });
            done(next, t('clarifications.sessionPage.toast.exception'));
          });
        }}
      >
        <div className="tiq-form-stack">
          <p className="tiq-text-muted">
            {t('clarifications.sessionPage.exceptionDialog.consistency')}
          </p>
          <RadioGroup
            label={t('clarifications.sessionPage.exceptionDialog.resolution')}
            value={resolution}
            onChange={(value) => setResolution(value as 'offer_alternative' | 'confirm_not_met')}
            options={(['offer_alternative', 'confirm_not_met'] as const).map((value) => ({
              value,
              label: t(`clarifications.resolution.${value}`),
              disabled: value === 'offer_alternative' && session.alternatives.length === 0,
            }))}
          />
          {resolution === 'offer_alternative' && (
            <Select
              label={t('clarifications.sessionPage.exceptionDialog.alternative')}
              required
              value={alternative}
              onChange={setAlternative}
              placeholder={t('clarifications.sessionPage.exceptionDialog.pickAlternative')}
              options={session.alternatives.map((item) => ({
                value: String(item.id),
                label: `${item.title} · ${formatOfficialTime(item.startsAt, tz)} · ${t('clarifications.sessions.available', { count: item.placesAvailable })}`,
                disabled: item.placesAvailable === 0,
              }))}
            />
          )}
        </div>
      </ConfirmActionDialog>
    </>
  );
}
