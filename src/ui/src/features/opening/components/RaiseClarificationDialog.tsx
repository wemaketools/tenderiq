/**
 * Drafts a clarification to one supplier (BUY-21, EVA-03): the question, the PERMITTED SCOPE of the answer and its
 * official deadline. A clarification can never become an improved offer (BR-22); the draft is approved and issued
 * separately.
 */
import { useState } from 'react';

import { openingEndpoints, RaiseClarificationBody } from '@contracts/opening';
import type { ClarificationDetail } from '@contracts/opening';
import type { FieldError } from '@contracts/common';
import type { BidClarificationsSource } from '@contracts/enums';

import { useApiMutation } from '../../../api/hooks';
import {
  Banner,
  Button,
  DateTimeInput,
  Dialog,
  FormErrorSummary,
  Select,
  TextArea,
  UnsavedChangesGuard,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { enumSelectOptions } from '../lib/options';
import { formFeedback, validateBody } from '../lib/validation';
import { ActingContext } from './ActingContext';
import { ActionError } from './ActionError';

const FIELDS = ['bidId', 'source', 'question', 'permittedScope', 'dueAt'] as const;

export interface RaiseClarificationDialogProps {
  readonly bidId: number;
  /** For example "Makgadikgadi Civil Works · T-2026-0003". */
  readonly scope: string;
  readonly timeZone: string;
  readonly sources: readonly BidClarificationsSource[];
  readonly onClose: () => void;
  readonly onRaised: (clarification: ClarificationDetail) => void;
}

export function RaiseClarificationDialog({
  bidId,
  scope,
  timeZone,
  sources,
  onClose,
  onRaised,
}: RaiseClarificationDialogProps) {
  const mutation = useApiMutation(openingEndpoints.raiseClarification);
  const [source, setSource] = useState<string>(sources[0] ?? 'compliance');
  const [question, setQuestion] = useState('');
  const [permittedScope, setPermittedScope] = useState('');
  const [dueAt, setDueAt] = useState<string | null>(null);
  const [clientErrors, setClientErrors] = useState<FieldError[]>([]);
  const feedback = formFeedback(clientErrors, mutation.error, FIELDS);
  const dirty = question !== '' || permittedScope !== '' || dueAt !== null;

  const submit = async (): Promise<void> => {
    const checked = validateBody(RaiseClarificationBody, {
      bidId,
      source,
      question,
      permittedScope,
      dueAt: dueAt ?? '',
    });
    if (!checked.ok) {
      setClientErrors(checked.errors);
      return;
    }
    setClientErrors([]);
    try {
      onRaised(await mutation.mutate({ body: checked.data }));
    } catch {
      // Shown in the dialog.
    }
  };

  return (
    <Dialog
      open
      size="lg"
      title={t('opening.raise.title')}
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
            {t('opening.raise.submit')}
          </Button>
        </>
      }
    >
      <UnsavedChangesGuard when={dirty && !mutation.pending} />
      <div className="tiq-form-stack">
        <ActingContext scope={scope} result={t('opening.raise.result')} />
        <Banner tone="info" title={t('opening.br22.title')}>
          {t('opening.br22.buyer')}
        </Banner>
        <Select
          label={t('opening.raise.source')}
          required
          value={source}
          onChange={setSource}
          options={enumSelectOptions('bid_clarifications.source', sources)}
          error={feedback.forField('source')}
        />
        <TextArea
          label={t('opening.raise.question')}
          required
          rows={4}
          value={question}
          onChange={setQuestion}
          error={feedback.forField('question')}
        />
        <TextArea
          label={t('opening.raise.scope')}
          hint={t('opening.raise.scopeHint')}
          required
          rows={3}
          value={permittedScope}
          onChange={setPermittedScope}
          error={feedback.forField('permittedScope')}
        />
        <DateTimeInput
          label={t('opening.raise.dueAt')}
          required
          value={dueAt}
          onChange={setDueAt}
          timeZone={timeZone}
          error={feedback.forField('dueAt')}
        />
        <FormErrorSummary errors={feedback.other} />
        <ActionError error={mutation.error} />
      </div>
    </Dialog>
  );
}
