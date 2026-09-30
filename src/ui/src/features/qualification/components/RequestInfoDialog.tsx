/**
 * "Request missing material" (BUY-33) and "clarify" (BUY-34): asks the supplier a question about one criterion or
 * the whole application, with a due time in the official time zone. The application moves to
 * `more_info_required` until the supplier answers.
 */
import { useState } from 'react';

import { RequestInfoBody, qualificationEndpoints as api } from '@contracts/qualification';
import type { Criterion, InfoRequestResult } from '@contracts/qualification';

import { useApiMutation } from '../../../api/hooks';
import {
  Banner,
  Button,
  DateTimeInput,
  Dialog,
  FormErrorSummary,
  Select,
  TextArea,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { summaryTitle } from '../lib/errors';
import { runCommand } from '../lib/hooks';
import { errorLookup, validateWith } from '../lib/validation';

export interface RequestInfoDialogProps {
  readonly applicationId: number;
  readonly reference: string;
  readonly supplierName: string;
  readonly timeZone: string;
  /** Criteria the question can point at; empty for a general request. */
  readonly criteria: readonly Criterion[];
  readonly initialCriterionId?: number | null;
  readonly onClose: () => void;
  readonly onRequested: (result: InfoRequestResult) => void;
}

const FIELDS = ['criterionId', 'question', 'dueAt'];

export function RequestInfoDialog({
  applicationId,
  reference,
  supplierName,
  timeZone,
  criteria,
  initialCriterionId = null,
  onClose,
  onRequested,
}: RequestInfoDialogProps) {
  const request = useApiMutation(api.requestInformation);
  const [criterionId, setCriterionId] = useState(
    initialCriterionId === null ? '' : String(initialCriterionId),
  );
  const [question, setQuestion] = useState('');
  const [dueAt, setDueAt] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  const body = {
    criterionId: criterionId === '' ? null : Number(criterionId),
    question,
    dueAt: dueAt ?? undefined,
  };
  const errors = errorLookup(
    tried ? validateWith(RequestInfoBody, body) : [],
    request.error,
    FIELDS,
  );

  const submit = (): void => {
    setTried(true);
    const parsed = RequestInfoBody.safeParse(body);
    if (!parsed.success) return;
    void runCommand(
      () => request.mutate({ params: { applicationId }, body: parsed.data }),
      onRequested,
    );
  };

  return (
    <Dialog
      open
      title={t('qualification.requestInfo.title', { reference })}
      description={t('qualification.requestInfo.description', { supplier: supplierName })}
      onClose={onClose}
      dismissible={!request.pending}
      footer={
        <>
          <Button onClick={onClose} disabled={request.pending}>
            {t('qualification.common.cancel')}
          </Button>
          <Button variant="primary" icon="send" onClick={submit} loading={request.pending}>
            {t('qualification.requestInfo.confirm')}
          </Button>
        </>
      }
    >
      <Banner tone="info">{t('qualification.requestInfo.effect')}</Banner>
      <FormErrorSummary title={summaryTitle(request.error)} errors={errors.other} />
      <div className="tiq-form-grid">
        {criteria.length > 0 && (
          <Select
            label={t('qualification.requestInfo.criterion')}
            placeholder={t('qualification.requestInfo.general')}
            value={criterionId}
            onChange={setCriterionId}
            error={errors.forField('criterionId')}
            fieldClassName="tiq-form-full"
            options={criteria.map((criterion) => ({
              value: String(criterion.id),
              label: `${tEnum('qualification_criteria.area', criterion.area)} — ${criterion.question}`,
            }))}
          />
        )}
        <TextArea
          label={t('qualification.requestInfo.question')}
          required
          rows={4}
          value={question}
          onChange={setQuestion}
          error={errors.forField('question')}
          fieldClassName="tiq-form-full"
        />
        <DateTimeInput
          label={t('qualification.requestInfo.dueAt')}
          required
          value={dueAt}
          onChange={setDueAt}
          timeZone={timeZone}
          error={errors.forField('dueAt')}
          fieldClassName="tiq-form-full"
        />
      </div>
    </Dialog>
  );
}
