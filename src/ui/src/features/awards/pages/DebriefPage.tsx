/**
 * BUY-29 — One debrief request: the request, due date and meeting, the written response and its effect on
 * deadlines, and the recipient's own result that the debrief explains (AC-27). Debrief managers schedule the
 * meeting, provide the written debrief or decline with a reason.
 */
import { useState } from 'react';

import {
  ProvideDebriefBody,
  declineDebrief,
  getDebrief,
  provideDebrief,
  scheduleDebrief,
} from '@contracts/awards';
import type { DebriefDetail } from '@contracts/awards';
import type { FieldError } from '@contracts/common';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  ConfirmActionDialog,
  DateTimeInput,
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
} from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { OwnResultCard } from '../components/OwnResultCard';
import { TextBlock } from '../components/TextBlock';
import { withAwardMessage } from '../lib/errors';
import { useIdParam, useLatest, useOfficialTimeZone } from '../lib/hooks';
import { awardPaths } from '../lib/paths';
import { errorLookup, validateWith } from '../lib/validation';

const OPEN = ['requested', 'scheduled'];

type Command = 'schedule' | 'provide' | 'decline';

export default function DebriefPage() {
  const debriefId = useIdParam('debriefId');
  const query = useApiQuery(getDebrief, debriefId === null ? null : { params: { debriefId } });
  const [latest, setLatest] = useLatest<DebriefDetail>(
    debriefId === null ? null : String(debriefId),
    (record) => String(record.debriefId),
  );
  if (debriefId === null) {
    return <EmptyState title={t('awards.debrief.notFound')} icon="messageSquare" />;
  }
  const back = { to: awardPaths.debriefs, label: t('awards.debrief.back') };
  return (
    <QueryView query={query} loading={<PageHeader title={t('awards.debrief.title')} back={back} />}>
      {(data) => <DebriefBody detail={latest ?? data} onChanged={setLatest} back={back} />}
    </QueryView>
  );
}

function DebriefBody({
  detail,
  onChanged,
  back,
}: {
  readonly detail: DebriefDetail;
  readonly onChanged: (detail: DebriefDetail) => void;
  readonly back: { readonly to: string; readonly label: string };
}) {
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const canManage = usePermission('debrief.manage');
  const [command, setCommand] = useState<Command | null>(null);
  const [meetingAt, setMeetingAt] = useState<string | null>(null);
  const [effect, setEffect] = useState('');
  const [response, setResponse] = useState('');
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);

  const schedule = useApiMutation(scheduleDebrief);
  const provide = useApiMutation(provideDebrief);
  const decline = useApiMutation(declineDebrief);
  const active = command === 'schedule' ? schedule : command === 'provide' ? provide : decline;
  const open = canManage && OPEN.includes(detail.status);
  const scope = `${detail.tender.reference} · ${detail.supplier.name}`;
  const scheduleErrors = formErrors(schedule.error, ['meetingAt', 'effectOnDeadlines']);
  const provideErrors = errorLookup(clientErrors, provide.error, [
    'writtenResponse',
    'effectOnDeadlines',
  ]);

  const start = (next: Command): void => {
    schedule.reset();
    provide.reset();
    decline.reset();
    setClientErrors([]);
    setMeetingAt(detail.meetingAt?.at ?? null);
    setEffect(detail.effectOnDeadlines);
    setResponse(detail.writtenResponse ?? '');
    setCommand(next);
  };

  const confirm = async ({ reason }: { readonly reason: string }): Promise<void> => {
    try {
      let result: DebriefDetail;
      if (command === 'schedule') {
        if (meetingAt === null) {
          setClientErrors([
            { field: 'meetingAt', code: 'REQUIRED', message: t('awards.debrief.meetingRequired') },
          ]);
          return;
        }
        result = await schedule.mutate({
          params: { debriefId: detail.debriefId },
          body: { meetingAt, effectOnDeadlines: effect.trim() === '' ? undefined : effect.trim() },
        });
      } else if (command === 'provide') {
        const body = { writtenResponse: response.trim(), effectOnDeadlines: effect.trim() };
        const found = validateWith(ProvideDebriefBody, body);
        setClientErrors(found);
        if (found.length > 0) return;
        result = await provide.mutate({ params: { debriefId: detail.debriefId }, body });
      } else {
        result = await decline.mutate({
          params: { debriefId: detail.debriefId },
          body: { reason: reason.trim() },
        });
      }
      setCommand(null);
      onChanged(result);
      toast.show(t(`awards.debrief.done.${command ?? 'schedule'}`), 'success');
    } catch {
      // The dialog shows the error.
    }
  };

  const meetingError =
    scheduleErrors.forField('meetingAt') ??
    clientErrors.find((error) => error.field === 'meetingAt')?.message;

  return (
    <>
      <PageHeader
        title={t('awards.debrief.titleFor', {
          supplier: detail.supplier.name,
          reference: detail.tender.reference,
        })}
        back={back}
        meta={
          <>
            <Reference
              value={detail.tender.reference}
              to={awardPaths.tender(detail.tender.tenderId)}
            />
            <StatusChip enum="debrief_requests.status" value={detail.status} />
            <span className="tiq-inline">
              <span className="tiq-text-muted">{t('awards.debrief.due')}</span>
              <OfficialDeadline deadline={detail.dueAt} />
            </span>
          </>
        }
        primaryAction={
          open ? (
            <Button variant="primary" icon="send" onClick={() => start('provide')}>
              {t('awards.debrief.provide')}
            </Button>
          ) : undefined
        }
        actions={
          open ? (
            <>
              <Button icon="calendar" onClick={() => start('schedule')}>
                {t('awards.debrief.schedule')}
              </Button>
              <Button icon="ban" onClick={() => start('decline')}>
                {t('awards.debrief.decline')}
              </Button>
            </>
          ) : undefined
        }
      />
      <div className="tiq-stack tiq-stack--spaced">
        <Banner tone="info" title={t('awards.debrief.ownOnly')}>
          {t('awards.debrief.ownOnlyText')}
        </Banner>
        <div className="tiq-grid tiq-grid--sidebar">
          <div className="tiq-stack tiq-stack--spaced">
            <Card title={t('awards.debrief.responseTitle')}>
              {detail.status === 'declined' ? (
                <Banner tone="warning" title={t('awards.debrief.declined')}>
                  {detail.declineReason}
                </Banner>
              ) : (
                <TextBlock text={detail.writtenResponse} empty={t('awards.debrief.noResponse')} />
              )}
            </Card>
            <OwnResultCard result={detail.ownResult} />
          </div>
          <div className="tiq-stack tiq-stack--spaced">
            <Card title={t('awards.debrief.requestTitle')}>
              <DetailList
                stacked
                items={[
                  { label: t('awards.debrief.supplier'), value: detail.supplier.name },
                  {
                    label: t('awards.debrief.requestedBy'),
                    value: `${detail.requestedBy.fullName} · ${formatDateTime(detail.requestedAt, timeZone)}`,
                  },
                  { label: t('awards.debrief.note'), value: detail.requestNote },
                  {
                    label: t('awards.debrief.due'),
                    value: <OfficialDeadline deadline={detail.dueAt} variant="block" />,
                  },
                  {
                    label: t('awards.debrief.meeting'),
                    value:
                      detail.meetingAt === null ? null : (
                        <OfficialDeadline deadline={detail.meetingAt} />
                      ),
                  },
                  {
                    label: t('awards.debrief.providedBy'),
                    value: detail.providedBy?.fullName ?? null,
                  },
                  { label: t('awards.debrief.effect'), value: detail.effectOnDeadlines },
                ]}
              />
            </Card>
            <Card title={t('awards.debrief.challengeTitle')}>
              <TextBlock text={detail.challengeInstructions} />
            </Card>
          </div>
        </div>
      </div>

      <ConfirmActionDialog
        open={command !== null}
        title={command === null ? '' : t(`awards.debrief.${command}Title`)}
        scope={scope}
        consequence={command === null ? '' : t(`awards.debrief.${command}Consequence`)}
        confirmLabel={command === null ? '' : t(`awards.debrief.${command}`)}
        tone={command === 'decline' ? 'danger' : 'primary'}
        reason={
          command === 'decline'
            ? { label: t('awards.debrief.declineReason'), required: true }
            : undefined
        }
        pending={active.pending}
        error={withAwardMessage(active.error)}
        onCancel={() => setCommand(null)}
        onConfirm={confirm}
      >
        {command === 'schedule' && (
          <>
            <DateTimeInput
              label={t('awards.debrief.meeting')}
              required
              timeZone={detail.dueAt.timeZone}
              value={meetingAt}
              error={meetingError}
              onChange={setMeetingAt}
            />
            <TextArea
              label={t('awards.debrief.effect')}
              hint={t('awards.debrief.effectHint')}
              rows={2}
              value={effect}
              error={scheduleErrors.forField('effectOnDeadlines')}
              onChange={setEffect}
            />
          </>
        )}
        {command === 'provide' && (
          <>
            <TextArea
              label={t('awards.debrief.writtenResponse')}
              hint={t('awards.debrief.writtenResponseHint')}
              required
              rows={6}
              value={response}
              error={provideErrors.forField('writtenResponse')}
              onChange={setResponse}
            />
            <TextArea
              label={t('awards.debrief.effect')}
              hint={t('awards.debrief.effectHint')}
              required
              rows={2}
              value={effect}
              error={provideErrors.forField('effectOnDeadlines')}
              onChange={setEffect}
            />
          </>
        )}
      </ConfirmActionDialog>
    </>
  );
}
