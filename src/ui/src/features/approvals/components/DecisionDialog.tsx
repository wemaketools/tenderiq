/**
 * The COM-05 decision confirmation: approve, approve with conditions, reject or return, for the EXACT version shown
 * (`subjectVersion` + `contentHash`, BR-10). Every decision except a plain approval needs a reason; a conditional
 * approval also needs its conditions. The decision runs in the approval's organization (DD-21).
 */
import { useState } from 'react';

import { decideApproval } from '@contracts/approvals';
import type { ApprovalDecision, ApprovalDetail } from '@contracts/approvals';

import { useApiMutation } from '../../../api/hooks';
import { ConfirmActionDialog, TextArea, formErrors, useToast } from '../../../components/ui';
import { formatMoney } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { localizeError, useRowOrganization } from '../../tasks/lib/shared';

export interface DecisionDialogProps {
  readonly approval: ApprovalDetail;
  readonly decision: ApprovalDecision;
  readonly onClose: () => void;
  readonly onDecided: (result: ApprovalDetail) => void;
}

export function DecisionDialog({ approval, decision, onClose, onDecided }: DecisionDialogProps) {
  const rowOrganization = useRowOrganization();
  const decide = useApiMutation(decideApproval);
  const toast = useToast();
  const [conditions, setConditions] = useState('');
  const [conditionsMissing, setConditionsMissing] = useState(false);
  const errors = formErrors(decide.error, ['reason', 'conditions']);
  const withConditions = decision === 'approve_with_conditions';

  const scope =
    approval.amount === null
      ? t('approvals.decide.scopeNoAmount', {
          title: approval.title,
          version: approval.subjectVersion,
        })
      : t('approvals.decide.scope', {
          title: approval.title,
          version: approval.subjectVersion,
          amount: formatMoney(approval.amount),
        });

  return (
    <ConfirmActionDialog
      open
      title={t(`approvals.decide.dialogTitle.${decision}`)}
      scope={scope}
      consequence={t(`approvals.decide.consequence.${decision}`, {
        version: approval.subjectVersion,
      })}
      confirmLabel={t(`approvals.decide.${decision}`)}
      tone={decision === 'reject' ? 'danger' : 'primary'}
      organization={rowOrganization(approval.organization)}
      reason={{
        label:
          decision === 'approve'
            ? t('approvals.decide.reasonOptional')
            : t('approvals.decide.reasonRequired'),
        required: decision !== 'approve',
      }}
      pending={decide.pending}
      error={localizeError(decide.error, 'approvals')}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        const trimmed = conditions.trim();
        if (withConditions && trimmed === '') {
          setConditionsMissing(true);
          return;
        }
        const result = await decide
          .mutate(
            {
              params: { approvalId: approval.id },
              body: {
                decision,
                subjectVersion: approval.subjectVersion,
                contentHash: approval.contentHash,
                ...(reason === '' ? {} : { reason }),
                ...(withConditions ? { conditions: trimmed } : {}),
              },
            },
            { tenantId: approval.organization.tenantId },
          )
          .catch(() => null);
        if (result !== null) {
          toast.show(t(`approvals.decide.done.${decision}`), 'success');
          onDecided(result);
        }
      }}
    >
      {withConditions && (
        <TextArea
          label={t('approvals.decide.conditions')}
          required
          rows={3}
          value={conditions}
          onChange={(value) => {
            setConditions(value);
            setConditionsMissing(false);
          }}
          error={
            errors.forField('conditions') ??
            (conditionsMissing ? t('approvals.decide.conditionsRequired') : undefined)
          }
        />
      )}
    </ConfirmActionDialog>
  );
}
