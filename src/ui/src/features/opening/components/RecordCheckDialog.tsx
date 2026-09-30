/**
 * Records one compliance finding (BUY-21, FR-13): the disposition (pass, fail, clarification required or not
 * applicable), the finding class (administrative omission, substantive noncompliance, clarifiable), the reason and
 * the evidence. The contract's consistency rules run before the request is sent.
 */
import { useState } from 'react';

import { openingEndpoints, RecordCheckBody } from '@contracts/opening';
import type { ComplianceCheck } from '@contracts/opening';
import type { FieldError } from '@contracts/common';
import type { ComplianceChecksFindingClass, ComplianceChecksResult } from '@contracts/enums';

import { useApiMutation } from '../../../api/hooks';
import {
  Button,
  Dialog,
  FormErrorSummary,
  RadioGroup,
  TextArea,
  TextField,
  UnsavedChangesGuard,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { formFeedback, validateBody } from '../lib/validation';
import { ActionError } from './ActionError';

const FIELDS = ['result', 'findingClass', 'reason', 'evidenceRef'] as const;
const RESULTS = ['pass', 'fail', 'clarification_required', 'not_applicable'] as const;
const CLASSES = [
  'none',
  'administrative_omission',
  'substantive_noncompliance',
  'clarifiable',
] as const;

/** The finding class that fits a disposition by default. */
const DEFAULT_CLASS: Readonly<Record<(typeof RESULTS)[number], ComplianceChecksFindingClass>> = {
  pass: 'none',
  fail: 'substantive_noncompliance',
  clarification_required: 'clarifiable',
  not_applicable: 'none',
};

export interface RecordCheckDialogProps {
  readonly check: ComplianceCheck;
  readonly supplierName: string;
  readonly onClose: () => void;
  readonly onRecorded: (check: ComplianceCheck) => void;
}

function initialResult(result: ComplianceChecksResult): (typeof RESULTS)[number] {
  return result === 'pending' ? 'pass' : result;
}

export function RecordCheckDialog({
  check,
  supplierName,
  onClose,
  onRecorded,
}: RecordCheckDialogProps) {
  const mutation = useApiMutation(openingEndpoints.recordCheck);
  const [result, setResult] = useState<(typeof RESULTS)[number]>(initialResult(check.result));
  const [findingClass, setFindingClass] = useState<ComplianceChecksFindingClass>(
    check.result === 'pending' ? 'none' : check.findingClass,
  );
  const [reason, setReason] = useState(check.reason ?? '');
  const [evidenceRef, setEvidenceRef] = useState(check.evidenceRef ?? '');
  const [clientErrors, setClientErrors] = useState<FieldError[]>([]);
  const feedback = formFeedback(clientErrors, mutation.error, FIELDS);
  const dirty =
    reason !== (check.reason ?? '') ||
    evidenceRef !== (check.evidenceRef ?? '') ||
    result !== initialResult(check.result);

  const submit = async (): Promise<void> => {
    const checked = validateBody(RecordCheckBody, {
      result,
      findingClass,
      reason: reason.trim() === '' ? null : reason,
      evidenceRef: evidenceRef.trim() === '' ? null : evidenceRef,
    });
    if (!checked.ok) {
      setClientErrors(checked.errors);
      return;
    }
    setClientErrors([]);
    try {
      const recorded = await mutation.mutate({ params: { checkId: check.id }, body: checked.data });
      onRecorded(recorded);
    } catch {
      // Shown in the dialog.
    }
  };

  const subject =
    check.requirement === null
      ? tEnum('compliance_checks.check_type', check.checkType)
      : `${check.requirement.refCode} ${check.requirement.text}`;

  return (
    <Dialog
      open
      size="lg"
      title={t('opening.check.title')}
      description={t('opening.check.description', { subject, supplier: supplierName })}
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
            {t('opening.check.submit')}
          </Button>
        </>
      }
    >
      <UnsavedChangesGuard when={dirty && !mutation.pending} />
      <div className="tiq-form-stack">
        <RadioGroup
          label={t('opening.check.result')}
          required
          value={result}
          onChange={(value) => {
            const next = value as (typeof RESULTS)[number];
            setResult(next);
            setFindingClass(DEFAULT_CLASS[next]);
          }}
          options={RESULTS.map((value) => ({
            value,
            label: tEnum('compliance_checks.result', value),
            hint: t(`opening.check.resultHint.${value}`),
          }))}
          error={feedback.forField('result')}
        />
        <RadioGroup
          label={t('opening.check.findingClass')}
          hint={t('opening.check.findingClassHint')}
          required
          value={findingClass}
          onChange={(value) => setFindingClass(value as ComplianceChecksFindingClass)}
          options={CLASSES.map((value) => ({
            value,
            label: tEnum('compliance_checks.finding_class', value),
            hint: t(`opening.check.classHint.${value}`),
          }))}
          error={feedback.forField('findingClass')}
        />
        <TextField
          label={t('opening.check.evidence')}
          hint={t('opening.check.evidenceHint')}
          value={evidenceRef}
          onChange={setEvidenceRef}
          error={feedback.forField('evidenceRef')}
        />
        <TextArea
          label={t('opening.check.reason')}
          hint={t('opening.check.reasonHint')}
          value={reason}
          onChange={setReason}
          rows={3}
          error={feedback.forField('reason')}
        />
        <FormErrorSummary errors={feedback.other} />
        <ActionError error={mutation.error} />
      </div>
    </Dialog>
  );
}
