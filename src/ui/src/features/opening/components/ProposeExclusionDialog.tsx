/**
 * Proposes the exclusion of a bid (BUY-21, AC-17): the grounds, the failed checks it cites and the challenge route
 * the supplier will receive. Approval is requested next (subject type `exclusion`); until it is decided the bid is
 * not ranked and its unopened commercial envelope stays sealed.
 */
import { useState } from 'react';

import { openingEndpoints, ProposeExclusionBody } from '@contracts/opening';
import type { ComplianceCheck, ExclusionDetail } from '@contracts/opening';
import type { FieldError } from '@contracts/common';

import { useApiMutation } from '../../../api/hooks';
import {
  Button,
  Dialog,
  EmptyState,
  FormErrorSummary,
  MultiSelect,
  TextArea,
  UnsavedChangesGuard,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { formFeedback, validateBody } from '../lib/validation';
import { ActingContext } from './ActingContext';
import { ActionError } from './ActionError';

const FIELDS = ['bidId', 'grounds', 'checkIds', 'challengeRoute'] as const;

export interface ProposeExclusionDialogProps {
  readonly bidId: number;
  readonly scope: string;
  /** The bid's checks; only failed ones can be cited. */
  readonly checks: readonly ComplianceCheck[];
  readonly onClose: () => void;
  readonly onProposed: (exclusion: ExclusionDetail) => void;
}

function checkLabel(check: ComplianceCheck): string {
  const subject =
    check.requirement === null
      ? tEnum('compliance_checks.check_type', check.checkType)
      : `${check.requirement.refCode} ${check.requirement.text}`;
  return `${subject} (${tEnum('compliance_checks.finding_class', check.findingClass)})`;
}

export function ProposeExclusionDialog({
  bidId,
  scope,
  checks,
  onClose,
  onProposed,
}: ProposeExclusionDialogProps) {
  const failed = checks.filter((check) => check.result === 'fail');
  const mutation = useApiMutation(openingEndpoints.proposeExclusion);
  const [checkIds, setCheckIds] = useState<string[]>(failed.map((check) => String(check.id)));
  const [grounds, setGrounds] = useState('');
  const [challengeRoute, setChallengeRoute] = useState('');
  const [clientErrors, setClientErrors] = useState<FieldError[]>([]);
  const feedback = formFeedback(clientErrors, mutation.error, FIELDS);
  const dirty = grounds !== '' || challengeRoute !== '';

  const submit = async (): Promise<void> => {
    const checked = validateBody(ProposeExclusionBody, {
      bidId,
      grounds,
      checkIds: checkIds.map(Number),
      challengeRoute,
    });
    if (!checked.ok) {
      setClientErrors(checked.errors);
      return;
    }
    setClientErrors([]);
    try {
      onProposed(await mutation.mutate({ body: checked.data }));
    } catch {
      // Shown in the dialog.
    }
  };

  return (
    <Dialog
      open
      size="lg"
      title={t('opening.propose.title')}
      onClose={onClose}
      dismissible={!mutation.pending}
      footer={
        <>
          <Button onClick={onClose} disabled={mutation.pending}>
            {t('ui.action.cancel')}
          </Button>
          <Button
            variant="danger"
            loading={mutation.pending}
            disabled={failed.length === 0}
            onClick={() => {
              void submit();
            }}
          >
            {t('opening.propose.submit')}
          </Button>
        </>
      }
    >
      <UnsavedChangesGuard when={dirty && !mutation.pending} />
      <div className="tiq-form-stack">
        <ActingContext scope={scope} result={t('opening.propose.result')} />
        {failed.length === 0 ? (
          <EmptyState compact icon="checkCircle" title={t('opening.propose.noFailed')} />
        ) : (
          <MultiSelect
            label={t('opening.propose.checks')}
            hint={t('opening.propose.checksHint')}
            required
            value={checkIds}
            onChange={setCheckIds}
            options={failed.map((check) => ({ value: String(check.id), label: checkLabel(check) }))}
            error={feedback.forField('checkIds')}
          />
        )}
        <TextArea
          label={t('opening.propose.grounds')}
          hint={t('opening.propose.groundsHint')}
          required
          rows={4}
          value={grounds}
          onChange={setGrounds}
          error={feedback.forField('grounds')}
        />
        <TextArea
          label={t('opening.propose.challengeRoute')}
          hint={t('opening.propose.challengeRouteHint')}
          required
          rows={3}
          value={challengeRoute}
          onChange={setChallengeRoute}
          error={feedback.forField('challengeRoute')}
        />
        <FormErrorSummary errors={feedback.other} />
        <ActionError error={mutation.error} />
      </div>
    </Dialog>
  );
}
