/**
 * EVA-03: the evaluation chair merges duplicate assessor questions into one draft, optionally rewording the
 * question and its permitted scope, so the supplier receives one consistent request.
 */
import { useState } from 'react';

import { ConsolidateClarificationsBody, openingEndpoints } from '@contracts/opening';
import type { ClarificationDetail, ClarificationRow } from '@contracts/opening';
import type { FieldError } from '@contracts/common';

import { useApiMutation } from '../../../api/hooks';
import {
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  FormErrorSummary,
  Select,
  TextArea,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { formFeedback, validateBody } from '../lib/validation';
import { ActingContext } from './ActingContext';
import { ActionError } from './ActionError';

const FIELDS = ['clarificationIds', 'question', 'permittedScope'] as const;

export interface ConsolidateDialogProps {
  /** Draft questions that may be merged (the target is chosen among them). */
  readonly drafts: readonly ClarificationRow[];
  readonly initialTargetId: number;
  /** Questions pre-selected for merging (default: none). */
  readonly initialSelected?: readonly number[];
  readonly onClose: () => void;
  readonly onConsolidated: (clarification: ClarificationDetail) => void;
}

function shortQuestion(row: ClarificationRow): string {
  return t('opening.consolidate.option', {
    id: row.id,
    who: row.raisedBy.fullName,
    question: row.question.length > 90 ? `${row.question.slice(0, 90)}…` : row.question,
  });
}

export function ConsolidateDialog({
  drafts,
  initialTargetId,
  initialSelected = [],
  onClose,
  onConsolidated,
}: ConsolidateDialogProps) {
  const mutation = useApiMutation(openingEndpoints.consolidateClarifications);
  const [targetId, setTargetId] = useState(String(initialTargetId));
  const [selected, setSelected] = useState<ReadonlySet<number>>(
    () => new Set(initialSelected.filter((id) => id !== initialTargetId)),
  );
  const [question, setQuestion] = useState('');
  const [permittedScope, setPermittedScope] = useState('');
  const [clientErrors, setClientErrors] = useState<FieldError[]>([]);
  const feedback = formFeedback(clientErrors, mutation.error, FIELDS);
  const target = drafts.find((row) => String(row.id) === targetId) ?? null;
  const others = drafts.filter((row) => String(row.id) !== targetId);

  const submit = async (): Promise<void> => {
    if (target === null) {
      return;
    }
    const merged = others.filter((row) => selected.has(row.id));
    if (merged.some((row) => row.bidId !== target.bidId)) {
      setClientErrors([
        {
          field: 'clarificationIds',
          code: 'CONSOLIDATION_DIFFERENT_BID',
          message: t('opening.errors.CONSOLIDATION_DIFFERENT_BID'),
        },
      ]);
      return;
    }
    const checked = validateBody(ConsolidateClarificationsBody, {
      clarificationIds: merged.map((row) => row.id),
      ...(question.trim() === '' ? {} : { question }),
      ...(permittedScope.trim() === '' ? {} : { permittedScope }),
    });
    if (!checked.ok) {
      setClientErrors(checked.errors);
      return;
    }
    setClientErrors([]);
    try {
      onConsolidated(
        await mutation.mutate({ params: { clarificationId: target.id }, body: checked.data }),
      );
    } catch {
      // Shown in the dialog.
    }
  };

  return (
    <Dialog
      open
      size="lg"
      title={t('opening.consolidate.title')}
      description={t('opening.consolidate.description')}
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
            disabled={target === null}
            onClick={() => {
              void submit();
            }}
          >
            {t('opening.consolidate.submit')}
          </Button>
        </>
      }
    >
      <div className="tiq-form-stack">
        <ActingContext
          scope={
            target === null
              ? t('opening.consolidate.noTarget')
              : t('opening.consolidate.scope', {
                  supplier: target.supplier.name,
                  reference: target.tenderReference,
                })
          }
          result={t('opening.consolidate.result')}
        />
        <Select
          label={t('opening.consolidate.target')}
          required
          value={targetId}
          onChange={(value) => {
            setTargetId(value);
            setSelected((current) => {
              const next = new Set(current);
              next.delete(Number(value));
              return next;
            });
          }}
          options={drafts.map((row) => ({ value: String(row.id), label: shortQuestion(row) }))}
        />
        <fieldset className="tiq-fieldset">
          <legend className="tiq-form-section-title">{t('opening.consolidate.merge')}</legend>
          {others.length === 0 ? (
            <EmptyState compact title={t('opening.consolidate.noOthers')} />
          ) : (
            others.map((row) => (
              <Checkbox
                key={row.id}
                label={shortQuestion(row)}
                hint={
                  target !== null && row.bidId !== target.bidId
                    ? t('opening.consolidate.otherBid', { supplier: row.supplier.name })
                    : undefined
                }
                checked={selected.has(row.id)}
                onChange={(checked) =>
                  setSelected((current) => {
                    const next = new Set(current);
                    if (checked) next.add(row.id);
                    else next.delete(row.id);
                    return next;
                  })
                }
              />
            ))
          )}
          {feedback.forField('clarificationIds') !== undefined && (
            <p className="tiq-field-error" role="alert">
              {feedback.forField('clarificationIds')}
            </p>
          )}
        </fieldset>
        <TextArea
          label={t('opening.consolidate.question')}
          hint={t('opening.consolidate.keepHint')}
          rows={3}
          value={question}
          onChange={setQuestion}
          error={feedback.forField('question')}
        />
        <TextArea
          label={t('opening.consolidate.permittedScope')}
          hint={t('opening.consolidate.keepHint')}
          rows={2}
          value={permittedScope}
          onChange={setPermittedScope}
          error={feedback.forField('permittedScope')}
        />
        <FormErrorSummary errors={feedback.other} />
        <ActionError error={mutation.error} />
      </div>
    </Dialog>
  );
}
