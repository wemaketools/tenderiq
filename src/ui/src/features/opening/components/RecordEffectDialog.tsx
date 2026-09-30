/**
 * Records the effect of a supplier's answer on compliance or assessment and distributes the answer to the affected
 * assessors (BUY-21, EVA-03: consistent distribution).
 */
import { useState } from 'react';

import { openingEndpoints, RecordEffectBody } from '@contracts/opening';
import type { ClarificationDetail } from '@contracts/opening';
import type { FieldError } from '@contracts/common';

import { useApiMutation } from '../../../api/hooks';
import {
  Button,
  Checkbox,
  Dialog,
  FormErrorSummary,
  RadioGroup,
  TextArea,
  UnsavedChangesGuard,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { affectedAssessors } from '../lib/assessors';
import { formFeedback, validateBody } from '../lib/validation';
import { ActingContext } from './ActingContext';
import { ActionError } from './ActionError';

const FIELDS = ['effect', 'effectNote', 'distributeToUserIds'] as const;
const EFFECTS = ['resolved', 'not_resolved', 'no_effect'] as const;

export interface RecordEffectDialogProps {
  readonly clarification: ClarificationDetail;
  readonly scope: string;
  readonly onClose: () => void;
  readonly onRecorded: (clarification: ClarificationDetail) => void;
}

export function RecordEffectDialog({
  clarification,
  scope,
  onClose,
  onRecorded,
}: RecordEffectDialogProps) {
  const candidates = affectedAssessors(clarification);
  const mutation = useApiMutation(openingEndpoints.recordClarificationEffect);
  const [effect, setEffect] = useState<string>('resolved');
  const [effectNote, setEffectNote] = useState('');
  const [recipients, setRecipients] = useState<ReadonlySet<number>>(
    () => new Set(candidates.map((person) => person.userId)),
  );
  const [clientErrors, setClientErrors] = useState<FieldError[]>([]);
  const feedback = formFeedback(clientErrors, mutation.error, FIELDS);

  const submit = async (): Promise<void> => {
    const checked = validateBody(RecordEffectBody, {
      effect,
      effectNote,
      distributeToUserIds: [...recipients],
    });
    if (!checked.ok) {
      setClientErrors(checked.errors);
      return;
    }
    setClientErrors([]);
    try {
      onRecorded(
        await mutation.mutate({
          params: { clarificationId: clarification.id },
          body: checked.data,
        }),
      );
    } catch {
      // Shown in the dialog.
    }
  };

  return (
    <Dialog
      open
      size="lg"
      title={t('opening.effect.title')}
      onClose={onClose}
      dismissible={!mutation.pending}
      footer={
        <>
          <Button onClick={onClose} disabled={mutation.pending}>
            {t('ui.action.cancel')}
          </Button>
          <Button
            variant="primary"
            loading={mutation.pending}
            onClick={() => {
              void submit();
            }}
          >
            {t('opening.effect.submit')}
          </Button>
        </>
      }
    >
      <UnsavedChangesGuard when={effectNote !== '' && !mutation.pending} />
      <div className="tiq-form-stack">
        <ActingContext scope={scope} result={t('opening.effect.result')} />
        <RadioGroup
          label={t('opening.effect.effect')}
          required
          value={effect}
          onChange={setEffect}
          options={EFFECTS.map((value) => ({
            value,
            label: tEnum('bid_clarifications.effect', value),
            hint: t(`opening.effect.hint.${value}`),
          }))}
          error={feedback.forField('effect')}
        />
        <TextArea
          label={t('opening.effect.note')}
          required
          rows={3}
          value={effectNote}
          onChange={setEffectNote}
          error={feedback.forField('effectNote')}
        />
        <fieldset className="tiq-fieldset">
          <legend className="tiq-form-section-title">{t('opening.effect.distribute')}</legend>
          <p className="tiq-field-hint">{t('opening.effect.distributeHint')}</p>
          {candidates.map((person) => (
            <Checkbox
              key={person.userId}
              label={person.fullName}
              checked={recipients.has(person.userId)}
              onChange={(checked) =>
                setRecipients((current) => {
                  const next = new Set(current);
                  if (checked) next.add(person.userId);
                  else next.delete(person.userId);
                  return next;
                })
              }
            />
          ))}
          {feedback.forField('distributeToUserIds') !== undefined && (
            <p className="tiq-field-error" role="alert">
              {feedback.forField('distributeToUserIds')}
            </p>
          )}
        </fieldset>
        <FormErrorSummary errors={feedback.other} />
        <ActionError error={mutation.error} />
      </div>
    </Dialog>
  );
}
