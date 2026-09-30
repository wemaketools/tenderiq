/**
 * Schedules an opening stage (BUY-20): the envelope (single stage = all), an optional lot, the official time, the
 * quorum and the named officer, witnesses or committee members (FR-13, BR-05). The body is checked with the
 * contract schema before it is sent; the API's answer stays authoritative.
 */
import { useState } from 'react';

import { openingEndpoints, ScheduleOpeningSessionBody } from '@contracts/opening';
import type {
  OpeningSessionDetail,
  OpeningTeamMember,
  TenderOpeningOverview,
} from '@contracts/opening';
import type { FieldError } from '@contracts/common';
import type { OpeningParticipantsRole, OpeningSessionsEnvelope } from '@contracts/enums';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Button,
  DateTimeInput,
  Dialog,
  FormErrorSummary,
  NumberInput,
  QueryView,
  Select,
  EmptyState,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { formFeedback, validateBody } from '../lib/validation';
import { ActingContext } from './ActingContext';
import { ActionError } from './ActionError';

const FIELDS = ['envelope', 'lotId', 'scheduledAt', 'quorumRequired', 'participants'] as const;

export interface ScheduleSessionDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly overview: TenderOpeningOverview;
  readonly onScheduled: (session: OpeningSessionDetail) => void;
}

/** Envelopes that still have an unopened stage, in opening order. */
function schedulableEnvelopes(overview: TenderOpeningOverview): OpeningSessionsEnvelope[] {
  const seen = new Set<OpeningSessionsEnvelope>();
  for (const stage of [...overview.stages].sort((a, b) => a.openOrder - b.openOrder)) {
    if (stage.state !== 'opened' && stage.state !== 'cancelled') {
      seen.add(stage.envelope);
    }
  }
  return [...seen];
}

export function ScheduleSessionDialog({
  open,
  onClose,
  overview,
  onScheduled,
}: ScheduleSessionDialogProps) {
  const tender = overview.tender;
  const envelopes = schedulableEnvelopes(overview);
  const team = useApiQuery(
    openingEndpoints.getOpeningTeam,
    open ? { params: { tenderId: tender.tenderId } } : null,
  );
  const mutation = useApiMutation(openingEndpoints.scheduleSession);
  const [envelope, setEnvelope] = useState<string>(envelopes[0] ?? '');
  const [lotId, setLotId] = useState('');
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [quorum, setQuorum] = useState('2');
  const [roles, setRoles] = useState<Readonly<Record<number, string>>>({});
  const [clientErrors, setClientErrors] = useState<FieldError[]>([]);

  const feedback = formFeedback(clientErrors, mutation.error, FIELDS);

  const close = (): void => {
    setClientErrors([]);
    mutation.reset();
    onClose();
  };

  const submit = async (): Promise<void> => {
    const participants = Object.entries(roles)
      .filter(([, role]) => role !== '')
      .map(([userId, role]) => ({
        userId: Number(userId),
        role: role as OpeningParticipantsRole,
      }));
    const checked = validateBody(ScheduleOpeningSessionBody, {
      tenderId: tender.tenderId,
      lotId: lotId === '' ? null : Number(lotId),
      envelope,
      scheduledAt: scheduledAt ?? '',
      quorumRequired: quorum.trim() === '' ? Number.NaN : Number(quorum),
      participants,
    });
    if (!checked.ok) {
      setClientErrors(checked.errors);
      return;
    }
    setClientErrors([]);
    try {
      const session = await mutation.mutate({ body: checked.data });
      onScheduled(session);
      close();
    } catch {
      // The error is shown in the dialog.
    }
  };

  const roleOptions = (member: OpeningTeamMember) =>
    member.eligibleRoles.map((role) => ({
      value: role,
      label: tEnum('opening_participants.role', role),
    }));

  return (
    <Dialog
      open={open}
      size="lg"
      title={t('opening.schedule.title')}
      description={t('opening.schedule.description')}
      onClose={close}
      dismissible={!mutation.pending}
      footer={
        <>
          <Button onClick={close} disabled={mutation.pending}>
            {t('ui.action.cancel')}
          </Button>
          <Button
            variant="primary"
            loading={mutation.pending}
            disabled={envelopes.length === 0}
            onClick={() => {
              void submit();
            }}
          >
            {t('opening.schedule.submit')}
          </Button>
        </>
      }
    >
      <div className="tiq-form-stack">
        <ActingContext
          scope={`${tender.reference} ${tender.title}`}
          result={t('opening.schedule.result')}
        />
        <div className="tiq-form-grid">
          <Select
            label={t('opening.schedule.envelope')}
            hint={t('opening.schedule.envelopeHint')}
            required
            value={envelope}
            onChange={setEnvelope}
            options={envelopes.map((value) => ({
              value,
              label: tEnum('opening_sessions.envelope', value),
            }))}
            placeholder={envelopes.length === 0 ? t('opening.schedule.noEnvelope') : undefined}
            error={feedback.forField('envelope')}
          />
          <Select
            label={t('opening.schedule.lot')}
            value={lotId}
            onChange={setLotId}
            placeholder={t('opening.schedule.wholeTender')}
            options={overview.lots.map((lot) => ({
              value: String(lot.lotId),
              label: t('opening.lot.label', { number: lot.lotNo, title: lot.title }),
            }))}
            error={feedback.forField('lotId')}
          />
          <DateTimeInput
            label={t('opening.schedule.scheduledAt')}
            hint={t('opening.schedule.scheduledAtHint')}
            required
            value={scheduledAt}
            onChange={setScheduledAt}
            timeZone={tender.officialTimeZone}
            error={feedback.forField('scheduledAt')}
          />
          <NumberInput
            label={t('opening.schedule.quorum')}
            hint={t('opening.schedule.quorumHint')}
            required
            value={quorum}
            onChange={setQuorum}
            places={0}
            error={feedback.forField('quorumRequired')}
          />
        </div>
        <fieldset className="tiq-fieldset">
          <legend className="tiq-form-section-title">{t('opening.schedule.participants')}</legend>
          <p className="tiq-field-hint">{t('opening.schedule.participantsHint')}</p>
          {feedback.forField('participants') !== undefined && (
            <p className="tiq-field-error" role="alert">
              {feedback.forField('participants')}
            </p>
          )}
          <QueryView
            query={team}
            isEmpty={(data) => data.items.length === 0}
            empty={<EmptyState compact title={t('opening.schedule.noTeam')} />}
          >
            {(data) => (
              <div className="tiq-form-grid">
                {data.items.map((member) => (
                  <Select
                    key={member.user.userId}
                    label={member.user.fullName}
                    hint={
                      member.capacity ?? tEnum('tender_team_members.team_role', member.teamRole)
                    }
                    value={roles[member.user.userId] ?? ''}
                    onChange={(value) =>
                      setRoles((current) => ({ ...current, [member.user.userId]: value }))
                    }
                    placeholder={t('opening.schedule.notTakingPart')}
                    options={roleOptions(member)}
                  />
                ))}
              </div>
            )}
          </QueryView>
        </fieldset>
        <FormErrorSummary errors={feedback.other} />
        <ActionError error={mutation.error} />
      </div>
    </Dialog>
  );
}
