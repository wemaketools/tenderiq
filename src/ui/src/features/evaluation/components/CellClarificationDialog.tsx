/**
 * EVA-02 → EVA-03: sends an assessor's flagged clarification to the chair's coordination queue. The evaluator's
 * question on the score cell is prefilled; the evaluator states the permitted scope (BR-22: a clarification never
 * becomes an improved offer) and the response deadline in the tender's official time zone. The result is a DRAFT
 * bid clarification (source `evaluation`) that the chair consolidates, approves and issues on EVA-03.
 */
import { useState } from 'react';

import { splitIssueMessage } from '@contracts/common';
import type { FieldError } from '@contracts/common';
import { openingEndpoints, RaiseClarificationBody } from '@contracts/opening';
import type { ClarificationDetail } from '@contracts/opening';

import { isApiError } from '../../../api/client';
import { useApiMutation } from '../../../api/hooks';
import {
  Banner,
  ConfirmActionDialog,
  DateTimeInput,
  FormErrorSummary,
  TextArea,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { withEvaluationMessage } from '../lib/errors';

const FIELDS = ['question', 'permittedScope', 'dueAt'] as const;

export interface CellClarificationDialogProps {
  readonly bidId: number;
  /** The evaluator's question saved on the score cell. */
  readonly question: string;
  /** "C3 Relevant experience · Supplier A (Serowe ICT Solutions) · T-2026-0003". */
  readonly scope: string;
  /** The tender's official IANA time zone (DD-33). */
  readonly timeZone: string;
  readonly onCancel: () => void;
  readonly onRaised: (clarification: ClarificationDetail) => void;
}

function matches(field: string, name: string): boolean {
  return field === name || field.startsWith(`${name}.`);
}

export function CellClarificationDialog({
  bidId,
  question: initialQuestion,
  scope,
  timeZone,
  onCancel,
  onRaised,
}: CellClarificationDialogProps) {
  const raise = useApiMutation(openingEndpoints.raiseClarification);
  const [question, setQuestion] = useState(initialQuestion);
  const [permittedScope, setPermittedScope] = useState('');
  const [dueAt, setDueAt] = useState<string | null>(null);
  const [clientErrors, setClientErrors] = useState<FieldError[]>([]);

  const serverErrors: readonly FieldError[] = isApiError(raise.error)
    ? raise.error.fieldErrors
    : [];
  const all = [...clientErrors, ...serverErrors];
  const forField = (name: string) => all.find((item) => matches(item.field, name))?.message;
  const other = all.filter((item) => !FIELDS.some((name) => matches(item.field, name)));

  return (
    <ConfirmActionDialog
      open
      size="lg"
      title={t('evaluation.assessment.raise.title')}
      scope={scope}
      consequence={t('evaluation.assessment.raise.consequence')}
      confirmLabel={t('evaluation.assessment.raise.confirm')}
      pending={raise.pending}
      error={withEvaluationMessage(raise.error)}
      onCancel={onCancel}
      onConfirm={async () => {
        const parsed = RaiseClarificationBody.safeParse({
          bidId,
          source: 'evaluation',
          question,
          permittedScope,
          dueAt: dueAt ?? '',
        });
        if (!parsed.success) {
          setClientErrors(
            parsed.error.issues.map((item) => {
              const { code, message } = splitIssueMessage(item.message);
              return { field: item.path.map(String).join('.'), code, message };
            }),
          );
          return;
        }
        setClientErrors([]);
        try {
          onRaised(await raise.mutate({ body: parsed.data }));
        } catch {
          // The dialog shows the error (BID_EXCLUDED, DUE_DATE_IN_PAST…).
        }
      }}
    >
      <div className="tiq-form-stack">
        <Banner tone="info" title={t('evaluation.assessment.raise.br22Title')}>
          <p>{t('evaluation.assessment.raise.br22')}</p>
        </Banner>
        <TextArea
          label={t('evaluation.assessment.raise.question')}
          required
          rows={4}
          value={question}
          onChange={setQuestion}
          error={forField('question')}
        />
        <TextArea
          label={t('evaluation.assessment.raise.scope')}
          hint={t('evaluation.assessment.raise.scopeHint')}
          required
          rows={3}
          value={permittedScope}
          onChange={setPermittedScope}
          error={forField('permittedScope')}
        />
        <DateTimeInput
          label={t('evaluation.assessment.raise.dueAt')}
          required
          value={dueAt}
          onChange={setDueAt}
          timeZone={timeZone}
          error={forField('dueAt')}
        />
        <FormErrorSummary errors={other} />
      </div>
    </ConfirmActionDialog>
  );
}
