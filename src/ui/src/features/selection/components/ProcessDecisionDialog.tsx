/**
 * Proposes a process decision (`buyer.selection.processDecisions.propose`): the recorded procedural authority that a
 * blocked action needs, such as a new competition, a fallback to the next bidder or a reopened round (AC-23, AC-24).
 * The decision then goes through the shared approvals (subject `process_decision`).
 */
import { useState } from 'react';

import { PROCESS_DECISIONS_DECISION_TYPE } from '@contracts/enums';
import type { ProcessDecisionsDecisionType } from '@contracts/enums';
import { selectionEndpoints } from '@contracts/selection';
import type { ProcessDecision, SelectionLotRef, SelectionTenderRef } from '@contracts/selection';

import { useApiMutation } from '../../../api/hooks';
import { ConfirmActionDialog, Select, useToast } from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { withSelectionMessage } from '../lib/errors';
import { tenderLabel } from '../lib/labels';
import { attempt } from '../lib/lists';

export interface ProcessDecisionDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly tender: SelectionTenderRef;
  readonly lot?: SelectionLotRef | null;
  readonly defaultType: ProcessDecisionsDecisionType;
  /** Why the decision is needed (shown as the consequence context). */
  readonly context?: string;
  readonly onProposed?: (decision: ProcessDecision) => void;
}

export function ProcessDecisionDialog({
  open,
  onClose,
  tender,
  lot = null,
  defaultType,
  context,
  onProposed,
}: ProcessDecisionDialogProps) {
  const toast = useToast();
  const propose = useApiMutation(selectionEndpoints.proposeProcessDecision);
  const [decisionType, setDecisionType] = useState<string>(defaultType);

  const close = (): void => {
    propose.reset();
    setDecisionType(defaultType);
    onClose();
  };

  if (!open) return null;
  return (
    <ConfirmActionDialog
      open
      title={t('selection.processDecision.title')}
      scope={tenderLabel(tender, lot)}
      consequence={
        <>
          {context !== undefined && <p>{context}</p>}
          <p>{t('selection.processDecision.consequence')}</p>
        </>
      }
      confirmLabel={t('selection.processDecision.confirm')}
      reason={{ label: t('selection.processDecision.reason'), required: true }}
      pending={propose.pending}
      error={withSelectionMessage(propose.error)}
      onCancel={close}
      onConfirm={async ({ reason }) => {
        const decision = await attempt(
          propose.mutate({
            body: {
              tenderId: tender.tenderId,
              lotId: lot?.lotId ?? null,
              decisionType: decisionType as ProcessDecisionsDecisionType,
              reason,
            },
          }),
        );
        if (decision === undefined) return;
        toast.show(t('selection.processDecision.proposed'), 'success');
        onProposed?.(decision);
        close();
      }}
    >
      <Select
        label={t('selection.processDecision.type')}
        value={decisionType}
        required
        options={PROCESS_DECISIONS_DECISION_TYPE.map((value) => ({
          value,
          label: tEnum('process_decisions.decision_type', value),
        }))}
        onChange={setDecisionType}
      />
    </ConfirmActionDialog>
  );
}
