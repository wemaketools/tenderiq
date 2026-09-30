/**
 * BUY-14 commands, each confirmed with the acting organization, capacity, scope and result (COM-02): publish now or
 * schedule, cancel a scheduled release, retry a failed external notice, reconcile an external notice with the
 * official version (AC-33), and distribute pending invitations.
 */
import { useState } from 'react';

import { publicationEndpoints } from '@contracts/publication';
import type {
  DistributionOutcome,
  PublicationOutcome,
  PublicationOverview,
  PublicationRow,
} from '@contracts/publication';
import type { z } from 'zod';

import { useApiMutation } from '../../../api/hooks';
import {
  Checkbox,
  ConfirmActionDialog,
  DateTimeInput,
  NumberInput,
  RadioGroup,
  TextField,
} from '../../../components/ui';
import { formatDateTime, formatOfficialTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { fieldMessage, withPublicationMessage } from '../lib/errors';

type Overview = PublicationOverview;
type Distribution = z.infer<typeof DistributionOutcome>;

function tenderScope(overview: Overview): string {
  return t('publication.dialogs.tenderScope', {
    reference: overview.tender.reference,
    title: overview.tender.title,
    revision: overview.tender.draftRevision,
  });
}

// ---------------------------------------------------------------------------------------------------------
// Publish now or schedule
// ---------------------------------------------------------------------------------------------------------

export interface PublishDialogProps {
  readonly open: boolean;
  readonly overview: Overview;
  readonly onClose: () => void;
  readonly onDone: (outcome: PublicationOutcome) => void;
}

export function PublishDialog({ open, overview, onClose, onDone }: PublishDialogProps) {
  const publish = useApiMutation(publicationEndpoints.publish);
  const { capabilities, tender } = overview;
  const [mode, setMode] = useState<'now' | 'scheduled'>(
    capabilities.canPublish ? 'now' : 'scheduled',
  );
  const [scheduledAt, setScheduledAt] = useState<string | null>(tender.scheduledReleaseAt);
  const [external, setExternal] = useState(true);
  const scheduleMissing = mode === 'scheduled' && scheduledAt === null;

  const close = (): void => {
    publish.reset();
    onClose();
  };

  const confirm = async (): Promise<void> => {
    if (scheduleMissing) return;
    const channels: Array<'portal' | 'external_notice'> = external
      ? ['portal', 'external_notice']
      : ['portal'];
    try {
      const outcome = await publish.mutate({
        params: { tenderId: tender.tenderId },
        body: {
          mode,
          ...(mode === 'scheduled' && scheduledAt !== null ? { scheduledAt } : {}),
          channels,
          draftRevision: tender.draftRevision,
        },
      });
      publish.reset();
      onDone(outcome);
    } catch {
      // The failure is shown in the dialog.
    }
  };

  const consequence =
    mode === 'now'
      ? t('publication.dialogs.publish.consequenceNow', { audience: overview.audience.description })
      : scheduledAt === null
        ? t('publication.dialogs.publish.consequenceChooseTime')
        : t('publication.dialogs.publish.consequenceScheduled', {
            at: formatOfficialTime(scheduledAt, tender.officialTimeZone),
          });

  return (
    <ConfirmActionDialog
      open={open}
      title={t('publication.dialogs.publish.title')}
      scope={tenderScope(overview)}
      consequence={consequence}
      confirmLabel={
        mode === 'now'
          ? t('publication.dialogs.publish.confirmNow')
          : t('publication.dialogs.publish.confirmSchedule')
      }
      onConfirm={confirm}
      onCancel={close}
      pending={publish.pending}
      error={withPublicationMessage(publish.error, ['scheduledAt', 'channels'])}
      acknowledgement={t('publication.dialogs.publish.acknowledgement')}
    >
      <RadioGroup
        label={t('publication.dialogs.publish.mode')}
        value={mode}
        onChange={(value) => setMode(value === 'scheduled' ? 'scheduled' : 'now')}
        options={[
          {
            value: 'now',
            label: t('publication.dialogs.publish.modeNow'),
            disabled: !capabilities.canPublish,
          },
          {
            value: 'scheduled',
            label: t('publication.dialogs.publish.modeScheduled'),
            disabled: !capabilities.canSchedule,
            hint: t('publication.dialogs.publish.modeScheduledHint'),
          },
        ]}
      />
      {mode === 'scheduled' && (
        <DateTimeInput
          label={t('publication.dialogs.publish.scheduledAt')}
          required
          value={scheduledAt}
          onChange={setScheduledAt}
          timeZone={tender.officialTimeZone}
          error={
            fieldMessage(publish.error, 'scheduledAt') ??
            (scheduleMissing ? t('publication.dialogs.publish.scheduleRequired') : undefined)
          }
          hint={
            tender.submissionDeadline === null
              ? undefined
              : t('publication.dialogs.publish.beforeDeadline', {
                  deadline: formatOfficialTime(
                    tender.submissionDeadline.at,
                    tender.submissionDeadline.timeZone,
                  ),
                })
          }
        />
      )}
      <fieldset className="tiq-fieldset">
        <legend>{t('publication.dialogs.publish.channels')}</legend>
        <Checkbox
          label={tEnum('publications.channel', 'portal')}
          checked
          disabled
          onChange={() => undefined}
          hint={t('publication.dialogs.publish.portalAlways')}
        />
        <Checkbox
          label={tEnum('publications.channel', 'external_notice')}
          checked={external}
          onChange={setExternal}
          hint={t('publication.dialogs.publish.externalHint')}
          error={fieldMessage(publish.error, 'channels')}
        />
      </fieldset>
    </ConfirmActionDialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Cancel a scheduled release
// ---------------------------------------------------------------------------------------------------------

export interface CancelScheduleDialogProps {
  readonly open: boolean;
  readonly overview: Overview;
  readonly onClose: () => void;
  readonly onDone: (outcome: PublicationOutcome) => void;
}

export function CancelScheduleDialog({
  open,
  overview,
  onClose,
  onDone,
}: CancelScheduleDialogProps) {
  const cancel = useApiMutation(publicationEndpoints.cancelSchedule);
  const scheduled = overview.tender.scheduledReleaseAt;
  return (
    <ConfirmActionDialog
      open={open}
      tone="danger"
      title={t('publication.dialogs.cancelSchedule.title')}
      scope={tenderScope(overview)}
      consequence={t('publication.dialogs.cancelSchedule.consequence', {
        at:
          scheduled === null
            ? t('publication.common.notScheduled')
            : formatOfficialTime(scheduled, overview.tender.officialTimeZone),
      })}
      confirmLabel={t('publication.dialogs.cancelSchedule.confirm')}
      reason={{ label: t('publication.dialogs.reason'), required: true }}
      onCancel={() => {
        cancel.reset();
        onClose();
      }}
      onConfirm={async ({ reason }) => {
        try {
          const outcome = await cancel.mutate({
            params: { tenderId: overview.tender.tenderId },
            body: { reason },
          });
          cancel.reset();
          onDone(outcome);
        } catch {
          // Shown in the dialog.
        }
      }}
      pending={cancel.pending}
      error={withPublicationMessage(cancel.error)}
    />
  );
}

// ---------------------------------------------------------------------------------------------------------
// Retry a failed external notice
// ---------------------------------------------------------------------------------------------------------

export interface RetryDialogProps {
  readonly row: PublicationRow | null;
  readonly timeZone: string;
  readonly onClose: () => void;
  readonly onDone: (row: PublicationRow) => void;
}

export function RetryDialog({ row, timeZone, onClose, onDone }: RetryDialogProps) {
  const retry = useApiMutation(publicationEndpoints.retryExternal);
  return (
    <ConfirmActionDialog
      open={row !== null}
      title={t('publication.dialogs.retry.title')}
      scope={
        row === null
          ? ''
          : t('publication.dialogs.channelScope', {
              reference: row.tender.reference,
              channel: row.channelName ?? tEnum('publications.channel', row.channel),
              version: row.versionNo,
            })
      }
      consequence={t('publication.dialogs.retry.consequence', {
        failedAt: row === null ? '' : formatDateTime(row.updatedAt, timeZone),
      })}
      confirmLabel={t('publication.dialogs.retry.confirm')}
      onCancel={() => {
        retry.reset();
        onClose();
      }}
      onConfirm={async () => {
        if (row === null) return;
        try {
          const next = await retry.mutate({ params: { publicationId: row.id } });
          retry.reset();
          onDone(next);
        } catch {
          // Shown in the dialog.
        }
      }}
      pending={retry.pending}
      error={withPublicationMessage(retry.error)}
    />
  );
}

// ---------------------------------------------------------------------------------------------------------
// Reconcile an external notice (AC-33)
// ---------------------------------------------------------------------------------------------------------

export interface ReconcileDialogProps {
  readonly row: PublicationRow | null;
  readonly currentVersionNo: number;
  readonly timeZone: string;
  readonly onClose: () => void;
  readonly onDone: (row: PublicationRow) => void;
}

export function ReconcileDialog({
  row,
  currentVersionNo,
  timeZone,
  onClose,
  onDone,
}: ReconcileDialogProps) {
  const reconcile = useApiMutation(publicationEndpoints.reconcileExternal);
  const [outcome, setOutcome] = useState<'confirmed' | 'manual_fallback_used'>('confirmed');
  const [externalReference, setExternalReference] = useState('');
  const [versionNo, setVersionNo] = useState(String(currentVersionNo));
  const [receivedAt, setReceivedAt] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const referenceMissing = externalReference.trim().length < 3;
  const receivedMissing = receivedAt === null;
  const versionInvalid = !/^[1-9]\d*$/.test(versionNo);

  const reset = (): void => {
    reconcile.reset();
    setOutcome('confirmed');
    setExternalReference('');
    setVersionNo(String(currentVersionNo));
    setReceivedAt(null);
    setTouched(false);
  };

  return (
    <ConfirmActionDialog
      open={row !== null}
      title={t('publication.dialogs.reconcile.title')}
      scope={
        row === null
          ? ''
          : t('publication.dialogs.channelScope', {
              reference: row.tender.reference,
              channel: row.channelName ?? tEnum('publications.channel', row.channel),
              version: row.versionNo,
            })
      }
      consequence={t('publication.dialogs.reconcile.consequence')}
      confirmLabel={t('publication.dialogs.reconcile.confirm')}
      reason={{
        label: t('publication.dialogs.reconcile.resolution'),
        required: true,
        hint: t('publication.dialogs.reconcile.resolutionHint'),
      }}
      onCancel={() => {
        reset();
        onClose();
      }}
      onConfirm={async ({ reason }) => {
        setTouched(true);
        if (row === null || referenceMissing || receivedAt === null || versionInvalid) return;
        try {
          const next = await reconcile.mutate({
            params: { publicationId: row.id },
            body: {
              outcome,
              externalReference: externalReference.trim(),
              confirmedVersionNo: Number(versionNo),
              confirmationReceivedAt: receivedAt,
              resolution: reason,
            },
          });
          reset();
          onDone(next);
        } catch {
          // Shown in the dialog.
        }
      }}
      pending={reconcile.pending}
      error={withPublicationMessage(reconcile.error, [
        'externalReference',
        'confirmedVersionNo',
        'confirmationReceivedAt',
      ])}
    >
      {row !== null && row.exception !== null && (
        <p className="tiq-text-muted">
          {t('publication.dialogs.reconcile.exception', {
            id: row.exception.id,
            description: row.exception.description,
          })}
        </p>
      )}
      <RadioGroup
        label={t('publication.dialogs.reconcile.outcome')}
        value={outcome}
        onChange={(value) =>
          setOutcome(value === 'manual_fallback_used' ? 'manual_fallback_used' : 'confirmed')
        }
        options={[
          { value: 'confirmed', label: t('publication.dialogs.reconcile.outcomeConfirmed') },
          {
            value: 'manual_fallback_used',
            label: t('publication.dialogs.reconcile.outcomeFallback'),
            hint: t('publication.dialogs.reconcile.outcomeFallbackHint'),
          },
        ]}
      />
      <TextField
        label={t('publication.dialogs.reconcile.externalReference')}
        required
        value={externalReference}
        onChange={setExternalReference}
        error={
          fieldMessage(reconcile.error, 'externalReference') ??
          (touched && referenceMissing
            ? t('publication.dialogs.reconcile.externalReferenceRequired')
            : undefined)
        }
      />
      <NumberInput
        label={t('publication.dialogs.reconcile.version')}
        required
        places={0}
        value={versionNo}
        onChange={setVersionNo}
        hint={t('publication.dialogs.reconcile.versionHint', { version: currentVersionNo })}
        error={
          fieldMessage(reconcile.error, 'confirmedVersionNo') ??
          (touched && versionInvalid
            ? t('publication.dialogs.reconcile.versionRequired')
            : undefined)
        }
      />
      <DateTimeInput
        label={t('publication.dialogs.reconcile.receivedAt')}
        required
        value={receivedAt}
        onChange={setReceivedAt}
        timeZone={timeZone}
        error={
          fieldMessage(reconcile.error, 'confirmationReceivedAt') ??
          (touched && receivedMissing
            ? t('publication.dialogs.reconcile.receivedAtRequired')
            : undefined)
        }
      />
    </ConfirmActionDialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Distribute invitations
// ---------------------------------------------------------------------------------------------------------

export interface DistributeDialogProps {
  readonly open: boolean;
  readonly tender: {
    readonly tenderId: number;
    readonly reference: string;
    readonly title: string;
  };
  readonly pendingCount: number;
  /** Only these participants; omitted = every undelivered invitation. */
  readonly participantIds?: readonly number[];
  readonly onClose: () => void;
  readonly onDone: (outcome: Distribution) => void;
}

export function DistributeDialog({
  open,
  tender,
  pendingCount,
  participantIds,
  onClose,
  onDone,
}: DistributeDialogProps) {
  const distribute = useApiMutation(publicationEndpoints.distributeInvitations);
  const count = participantIds?.length ?? pendingCount;
  return (
    <ConfirmActionDialog
      open={open}
      title={t('publication.dialogs.distribute.title')}
      scope={t('publication.dialogs.distribute.scope', {
        reference: tender.reference,
        title: tender.title,
        count,
      })}
      consequence={t('publication.dialogs.distribute.consequence')}
      confirmLabel={t('publication.dialogs.distribute.confirm', { count })}
      onCancel={() => {
        distribute.reset();
        onClose();
      }}
      onConfirm={async () => {
        try {
          const outcome = await distribute.mutate({
            params: { tenderId: tender.tenderId },
            body: participantIds === undefined ? {} : { participantIds: [...participantIds] },
          });
          distribute.reset();
          onDone(outcome);
        } catch {
          // Shown in the dialog.
        }
      }}
      pending={distribute.pending}
      error={withPublicationMessage(distribute.error)}
    />
  );
}
