/**
 * SUP-11 Briefings and site visits, one session: venue and attendance instructions, available places, mandatory
 * status, alternatives, accessibility information, the supplier's own booking and attendance evidence, and the
 * official minutes with the answers shared with every participant. Register, change the booking or request an
 * accommodation, and cancel the booking.
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import { clarificationsEndpoints } from '@contracts/clarifications';
import type { SupplierSessionDetail } from '@contracts/clarifications';

import { useApiMutation, useApiQuery } from '../../../../api/hooks';
import { usePermission } from '../../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DetailList,
  EmptyState,
  OfficialDeadline,
  PageHeader,
  QueryView,
  Reference,
  StatusChip,
  TextArea,
  formErrors,
  useToast,
} from '../../../../components/ui';
import { formatDateTime, formatOfficialTime } from '../../../../lib/format';
import { t } from '../../../../lib/i18n';
import { SharedAnswerList } from '../../components/shared';
import {
  SUPPLIER_PARTICIPATE_PERMISSION,
  explainError,
  splitLines,
  supplierPaths,
} from '../../lib';

type DialogKind = 'register' | 'change' | 'cancel';

export default function SupplierSessionPage() {
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
  return <SupplierSessionLoader key={id} sessionId={id} />;
}

function SupplierSessionLoader({ sessionId }: { readonly sessionId: number }) {
  const query = useApiQuery(clarificationsEndpoints.supplierSessionsGet, { params: { sessionId } });
  const [result, setResult] = useState<SupplierSessionDetail | null>(null);
  return (
    <div className="tiq-page">
      {query.data === undefined && (
        <PageHeader
          title={t('clarifications.supplierSessions.title')}
          back={{ to: supplierPaths.sessions, label: t('clarifications.supplierSessions.back') }}
        />
      )}
      <QueryView query={query}>
        {(data) => <SupplierSessionView session={result ?? data} onChanged={setResult} />}
      </QueryView>
    </div>
  );
}

function SupplierSessionView({
  session,
  onChanged,
}: {
  readonly session: SupplierSessionDetail;
  readonly onChanged: (next: SupplierSessionDetail) => void;
}) {
  const toast = useToast();
  const canBook = usePermission(SUPPLIER_PARTICIPATE_PERMISSION);
  const tz = session.timeZone;
  const own = session.ownRegistration;
  const booked = own !== null && own.status === 'registered';
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [attendees, setAttendees] = useState('');
  const [needs, setNeeds] = useState('');
  const [tried, setTried] = useState(false);
  const register = useApiMutation(clarificationsEndpoints.supplierSessionsRegister);
  const change = useApiMutation(clarificationsEndpoints.supplierRegistrationUpdate);
  const cancel = useApiMutation(clarificationsEndpoints.supplierRegistrationCancel);
  const bookingMutation = dialog === 'change' ? change : register;
  const bookingErrors = formErrors(bookingMutation.error, ['attendeeNames', 'accessibilityNeeds']);
  const names = splitLines(attendees);

  const openBooking = (kind: 'register' | 'change'): void => {
    setAttendees(kind === 'change' && own !== null ? own.attendeeNames.join('\n') : '');
    setNeeds(kind === 'change' && own !== null ? (own.accessibilityNeeds ?? '') : '');
    setTried(false);
    setDialog(kind);
  };
  const closeDialog = (): void => {
    register.reset();
    change.reset();
    cancel.reset();
    setDialog(null);
  };
  const scope = t('clarifications.sessionPage.scope', {
    title: session.title,
    reference: session.tender.reference,
  });

  const nextAction =
    session.status !== 'scheduled'
      ? session.minutesPublishedAt !== null
        ? t('clarifications.next.supplier.readMinutes')
        : t('clarifications.next.none')
      : booked
        ? t('clarifications.next.supplier.attend')
        : session.registrationOpen
          ? session.mandatory
            ? t('clarifications.next.supplier.registerMandatory')
            : t('clarifications.next.supplier.register')
          : t('clarifications.next.none');

  return (
    <>
      <PageHeader
        title={session.title}
        subtitle={t('clarifications.sessionPage.subtitle', {
          type: t(`clarifications.sessionType.${session.sessionType}`),
          reference: session.tender.reference,
        })}
        back={{ to: supplierPaths.sessions, label: t('clarifications.supplierSessions.back') }}
        meta={
          <>
            <Reference
              value={session.tender.reference}
              to={supplierPaths.tender(session.tender.tenderId)}
            />
            <StatusChip enum="sessions.status" value={session.status} />
            {session.mandatory && (
              <Chip tone="warning">{t('clarifications.sessions.mandatory')}</Chip>
            )}
            {session.registrationDeadline !== null && (
              <OfficialDeadline
                variant="block"
                label={t('clarifications.sessionPage.registrationDeadline')}
                deadline={session.registrationDeadline}
                showRemaining
              />
            )}
            <span>
              <strong>{t('clarifications.common.nextAction')}:</strong> {nextAction}
            </span>
          </>
        }
        primaryAction={
          canBook && session.registrationOpen && own?.status !== 'registered' ? (
            <Button variant="primary" icon="userPlus" onClick={() => openBooking('register')}>
              {t('clarifications.supplierSession.register')}
            </Button>
          ) : undefined
        }
        actions={
          canBook && booked && session.status === 'scheduled' ? (
            <>
              <Button icon="edit" onClick={() => openBooking('change')}>
                {t('clarifications.supplierSession.change')}
              </Button>
              <Button variant="danger-soft" icon="x" onClick={() => setDialog('cancel')}>
                {t('clarifications.supplierSession.cancel')}
              </Button>
            </>
          ) : undefined
        }
      />

      {session.status === 'cancelled' && (
        <Banner tone="warning" title={t('clarifications.sessionPage.cancelledBanner')}>
          {session.alternatives.length > 0 && (
            <p>{t('clarifications.supplierSession.seeAlternatives')}</p>
          )}
        </Banner>
      )}
      {session.mandatory && session.status === 'scheduled' && !booked && (
        <Banner tone="warning" title={t('clarifications.supplierSession.mandatoryBanner')}>
          <p>{t('clarifications.supplierSession.mandatoryDetail')}</p>
        </Banner>
      )}

      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack tiq-stack--spaced">
          <Card title={t('clarifications.sessionPage.logistics')}>
            <DetailList
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
                  key: 'places',
                  label: t('clarifications.sessions.col.places'),
                  value: t('clarifications.supplierSession.places', {
                    available: session.placesAvailable,
                    capacity: session.capacity,
                  }),
                },
                {
                  key: 'accessibility',
                  label: t('clarifications.sessionForm.accessibility'),
                  value: session.accessibilityInfo,
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
                  key: 'alternatives',
                  label: t('clarifications.sessionPage.alternatives'),
                  value:
                    session.alternatives.length === 0 && session.alternativeOf === null ? null : (
                      <ul>
                        {session.alternativeOf !== null && (
                          <li>
                            <Reference
                              value={session.alternativeOf.title}
                              to={supplierPaths.session(session.alternativeOf.id)}
                            />
                          </li>
                        )}
                        {session.alternatives.map((item) => (
                          <li key={item.id}>
                            <Reference value={item.title} to={supplierPaths.session(item.id)} />{' '}
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
          <Card
            title={t('clarifications.sessionPage.minutes')}
            subtitle={
              session.minutesPublishedAt === null
                ? t('clarifications.supplierSession.minutesPending')
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
        <Card title={t('clarifications.supplierSession.booking')}>
          {own === null ? (
            <EmptyState
              compact
              icon="calendar"
              title={t('clarifications.supplierSessions.notBooked')}
              description={
                session.registrationOpen
                  ? t('clarifications.supplierSession.notBookedHint')
                  : t('clarifications.supplierSessions.registrationClosed')
              }
            />
          ) : (
            <DetailList
              stacked
              items={[
                {
                  key: 'status',
                  label: t('clarifications.sessionPage.col.status'),
                  value: <StatusChip enum="session_registrations.status" value={own.status} />,
                },
                {
                  key: 'attendees',
                  label: t('clarifications.sessionPage.col.attendees'),
                  value: own.attendeeNames.join(', '),
                },
                {
                  key: 'needs',
                  label: t('clarifications.supplierSession.accommodation'),
                  value: own.accessibilityNeeds,
                },
                {
                  key: 'by',
                  label: t('clarifications.supplierSession.bookedBy'),
                  value: `${own.registeredBy.fullName} · ${formatDateTime(own.createdAt, tz)}`,
                },
                {
                  key: 'evidence',
                  label: t('clarifications.supplierSession.evidence'),
                  value:
                    own.attendanceRecordedAt === null
                      ? t('clarifications.supplierSession.noEvidence')
                      : t('clarifications.supplierSession.evidenceValue', {
                          status: t(`clarifications.registrationStatus.${own.status}`),
                          at: formatDateTime(own.attendanceRecordedAt, tz),
                        }),
                },
              ]}
            />
          )}
        </Card>
      </div>

      <ConfirmActionDialog
        open={dialog === 'register' || dialog === 'change'}
        title={
          dialog === 'change'
            ? t('clarifications.supplierSession.changeDialog.title')
            : t('clarifications.supplierSession.registerDialog.title')
        }
        scope={scope}
        consequence={
          dialog === 'change'
            ? t('clarifications.supplierSession.changeDialog.consequence')
            : t('clarifications.supplierSession.registerDialog.consequence')
        }
        confirmLabel={
          dialog === 'change'
            ? t('clarifications.supplierSession.change')
            : t('clarifications.supplierSession.register')
        }
        pending={bookingMutation.pending}
        error={explainError(bookingMutation.error)}
        onCancel={closeDialog}
        onConfirm={async () => {
          setTried(true);
          if (names.length === 0) return;
          const body = {
            attendeeNames: names,
            accessibilityNeeds: needs.trim() === '' ? null : needs.trim(),
          };
          try {
            const next =
              dialog === 'change' && own !== null
                ? await change.mutate({ params: { registrationId: own.id }, body })
                : await register.mutate({ params: { sessionId: session.id }, body });
            onChanged(next);
            closeDialog();
            toast.show(
              dialog === 'change'
                ? t('clarifications.supplierSession.toast.changed')
                : t('clarifications.supplierSession.toast.registered'),
              'success',
            );
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <div className="tiq-form-stack">
          <TextArea
            label={t('clarifications.supplierSession.attendees')}
            hint={t('clarifications.supplierSession.attendeesHint')}
            required
            rows={3}
            value={attendees}
            onChange={setAttendees}
            error={
              bookingErrors.forField('attendeeNames') ??
              (tried && names.length === 0
                ? t('clarifications.supplierSession.attendeesRequired')
                : undefined)
            }
          />
          <TextArea
            label={t('clarifications.supplierSession.accommodation')}
            hint={t('clarifications.supplierSession.accommodationHint')}
            rows={2}
            value={needs}
            onChange={setNeeds}
            error={bookingErrors.forField('accessibilityNeeds')}
          />
        </div>
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'cancel'}
        tone="danger"
        title={t('clarifications.supplierSession.cancelDialog.title')}
        scope={scope}
        consequence={
          session.mandatory
            ? t('clarifications.supplierSession.cancelDialog.mandatory')
            : t('clarifications.supplierSession.cancelDialog.consequence')
        }
        confirmLabel={t('clarifications.supplierSession.cancel')}
        pending={cancel.pending}
        error={explainError(cancel.error)}
        reason={{ label: t('clarifications.common.reason'), required: false }}
        onCancel={closeDialog}
        onConfirm={async ({ reason }) => {
          if (own === null) return;
          try {
            const next = await cancel.mutate({
              params: { registrationId: own.id },
              body: reason === '' ? {} : { reason },
            });
            onChanged(next);
            closeDialog();
            toast.show(t('clarifications.supplierSession.toast.cancelled'), 'success');
          } catch {
            // Shown in the dialog.
          }
        }}
      />
    </>
  );
}
