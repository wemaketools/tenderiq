/**
 * Editor of a shortlist's rule, threshold, rationale and include/exclude decisions (BUY-23). Every candidate needs a
 * reason, an included candidate needs its rank, and an included candidate below the threshold blocks saving
 * (`INCLUDED_BELOW_THRESHOLD`). A draft is saved in place; an approved shortlist is changed with a recorded reason
 * and returns for approval (AC-22).
 */
import { useState } from 'react';

import { gte } from '@contracts/decimal';
import { selectionEndpoints } from '@contracts/selection';
import type { SelectionCandidate, ShortlistDetail } from '@contracts/selection';

import { useApiMutation } from '../../../api/hooks';
import {
  Button,
  Card,
  ConfirmActionDialog,
  FormErrorSummary,
  NumberInput,
  RadioGroup,
  ReadinessChecklist,
  TextArea,
  TextField,
  UnsavedChangesGuard,
  formErrors,
  isReady,
  useToast,
} from '../../../components/ui';
import type { ReadinessItem } from '../../../components/ui';
import { formatDecimalString } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { selectionErrorMessage, withSelectionMessage } from '../lib/errors';
import { bidLabel, tenderLabel } from '../lib/labels';
import { attempt } from '../lib/lists';

interface EntryDraft {
  readonly bidId: number;
  readonly label: string;
  readonly nonPriceScore: string | null;
  readonly included: boolean;
  readonly rank: string;
  readonly reason: string;
  readonly conditions: string;
}

export interface ShortlistEditorProps {
  readonly shortlist: ShortlistDetail;
  /** Candidates of the tender (used when the draft has no entries yet). */
  readonly candidates: readonly SelectionCandidate[];
  readonly mode: 'edit' | 'change';
  readonly onSaved: (shortlist: ShortlistDetail) => void;
  readonly onCancel: () => void;
}

function initialEntries(
  shortlist: ShortlistDetail,
  candidates: readonly SelectionCandidate[],
): EntryDraft[] {
  if (shortlist.entries.length > 0) {
    return shortlist.entries.map((entry) => ({
      bidId: entry.bid.bidId,
      label: bidLabel(entry.bid),
      nonPriceScore: entry.nonPriceScore,
      included: entry.included,
      rank: entry.rank === null ? '' : String(entry.rank),
      reason: entry.reason,
      conditions: entry.conditions ?? '',
    }));
  }
  return candidates
    .filter(
      (candidate) =>
        shortlist.lot === null ||
        candidate.lot === null ||
        candidate.lot.lotId === shortlist.lot.lotId,
    )
    .map((candidate) => ({
      bidId: candidate.bid.bidId,
      label: bidLabel(candidate.bid),
      nonPriceScore: candidate.nonPriceScore,
      included: false,
      rank: candidate.rank === null ? '' : String(candidate.rank),
      reason: '',
      conditions: '',
    }));
}

function belowThreshold(entry: EntryDraft, threshold: string): boolean {
  if (!entry.included || threshold === '' || entry.nonPriceScore === null) return false;
  return !gte(entry.nonPriceScore, threshold);
}

export function ShortlistEditor({
  shortlist,
  candidates,
  mode,
  onSaved,
  onCancel,
}: ShortlistEditorProps) {
  const toast = useToast();
  const update = useApiMutation(selectionEndpoints.updateShortlist);
  const change = useApiMutation(selectionEndpoints.changeShortlist);
  const [rule, setRule] = useState(shortlist.selectionRule);
  const [threshold, setThreshold] = useState(shortlist.threshold ?? '');
  const [rationale, setRationale] = useState(shortlist.rationale);
  const [entries, setEntries] = useState<EntryDraft[]>(() => initialEntries(shortlist, candidates));
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const mutation = mode === 'edit' ? update : change;
  const server = formErrors(mutation.error, ['selectionRule', 'threshold', 'rationale', 'entries']);

  const setEntry = (bidId: number, values: Partial<EntryDraft>): void => {
    setEntries((list) =>
      list.map((entry) => (entry.bidId === bidId ? { ...entry, ...values } : entry)),
    );
    setDirty(true);
  };

  const checks: ReadinessItem[] = [
    {
      id: 'rule',
      label: t('selection.shortlistEditor.check.rule'),
      status: rule.trim() === '' || rationale.trim() === '' ? 'blocking' : 'passed',
    },
    {
      id: 'reasons',
      label: t('selection.shortlistEditor.check.reasons'),
      detail: entries
        .filter((entry) => entry.reason.trim() === '')
        .map((entry) => entry.label)
        .join(', '),
      status:
        entries.length === 0 || entries.some((entry) => entry.reason.trim() === '')
          ? 'blocking'
          : 'passed',
    },
    {
      id: 'ranks',
      label: t('selection.shortlistEditor.check.ranks'),
      status: entries.some((entry) => entry.included && entry.rank === '') ? 'blocking' : 'passed',
    },
    {
      id: 'threshold',
      label: t('selection.shortlistEditor.check.threshold'),
      detail: entries
        .filter((entry) => belowThreshold(entry, threshold))
        .map((entry) => entry.label)
        .join(', '),
      status: entries.some((entry) => belowThreshold(entry, threshold)) ? 'blocking' : 'passed',
    },
    {
      id: 'included',
      label: t('selection.shortlistEditor.check.included'),
      status: entries.some((entry) => entry.included) ? 'passed' : 'warning',
    },
  ];

  const body = {
    selectionRule: rule.trim(),
    threshold: threshold === '' ? null : threshold,
    rationale: rationale.trim(),
    entries: entries.map((entry) => ({
      bidId: entry.bidId,
      included: entry.included,
      rank: entry.included && entry.rank !== '' ? Number(entry.rank) : null,
      reason: entry.reason.trim(),
      conditions: entry.conditions.trim() === '' ? null : entry.conditions.trim(),
    })),
  };

  const save = async (changeReason: string | null): Promise<void> => {
    const result =
      mode === 'edit'
        ? await attempt(update.mutate({ params: { shortlistId: shortlist.shortlistId }, body }))
        : await attempt(
            change.mutate({
              params: { shortlistId: shortlist.shortlistId },
              body: { ...body, changeReason: changeReason ?? '' },
            }),
          );
    if (result === undefined) return;
    setDirty(false);
    setConfirming(false);
    toast.show(
      mode === 'edit'
        ? t('selection.shortlistEditor.saved')
        : t('selection.shortlistEditor.changed'),
      'success',
    );
    onSaved(result);
  };

  return (
    <Card
      title={
        mode === 'edit'
          ? t('selection.shortlistEditor.editTitle')
          : t('selection.shortlistEditor.changeTitle')
      }
      subtitle={
        mode === 'edit'
          ? t('selection.shortlistEditor.editHint')
          : t('selection.shortlistEditor.changeHint')
      }
    >
      <UnsavedChangesGuard when={dirty && !mutation.pending} />
      <div className="tiq-stack">
        {mutation.error !== null && !confirming && (
          <FormErrorSummary title={selectionErrorMessage(mutation.error)} errors={server.other} />
        )}
        <div className="tiq-form-grid">
          <TextArea
            label={t('selection.shortlistForm.selectionRule')}
            required
            rows={2}
            value={rule}
            onChange={(value) => {
              setRule(value);
              setDirty(true);
            }}
            error={server.forField('selectionRule')}
          />
          <NumberInput
            label={t('selection.shortlistForm.threshold')}
            hint={t('selection.shortlistForm.thresholdHint')}
            places={2}
            value={threshold}
            onChange={(value) => {
              setThreshold(value);
              setDirty(true);
            }}
            error={server.forField('threshold')}
          />
          <TextArea
            label={t('selection.shortlistForm.rationale')}
            required
            rows={3}
            fieldClassName="tiq-form-full"
            value={rationale}
            onChange={(value) => {
              setRationale(value);
              setDirty(true);
            }}
            error={server.forField('rationale')}
          />
        </div>
        {entries.map((entry, index) => (
          <fieldset key={entry.bidId} className="tiq-fieldset">
            <legend>
              {entry.label}
              {entry.nonPriceScore !== null &&
                ` · ${t('selection.shortlistEditor.nonPrice', {
                  score: formatDecimalString(entry.nonPriceScore, 2),
                })}`}
            </legend>
            <div className="tiq-form-grid">
              <RadioGroup
                label={t('selection.shortlistEditor.decision')}
                inline
                required
                name={`decision-${entry.bidId}`}
                value={entry.included ? 'include' : 'exclude'}
                options={[
                  { value: 'include', label: t('selection.candidates.included') },
                  { value: 'exclude', label: t('selection.candidates.excluded') },
                ]}
                onChange={(value) => setEntry(entry.bidId, { included: value === 'include' })}
                error={
                  belowThreshold(entry, threshold)
                    ? t('selection.shortlistEditor.belowThreshold')
                    : undefined
                }
              />
              {entry.included && (
                <NumberInput
                  label={t('selection.shortlistEditor.rank')}
                  required
                  places={0}
                  value={entry.rank}
                  onChange={(rank) => setEntry(entry.bidId, { rank })}
                  error={server.forField(`entries.${index}.rank`)}
                />
              )}
              <TextArea
                label={
                  entry.included
                    ? t('selection.shortlistEditor.includeReason')
                    : t('selection.shortlistEditor.excludeReason')
                }
                required
                rows={2}
                fieldClassName="tiq-form-full"
                value={entry.reason}
                onChange={(reason) => setEntry(entry.bidId, { reason })}
                error={server.forField(`entries.${index}.reason`)}
              />
              <TextField
                label={t('selection.shortlistEditor.conditions')}
                fieldClassName="tiq-form-full"
                value={entry.conditions}
                onChange={(conditions) => setEntry(entry.bidId, { conditions })}
              />
            </div>
          </fieldset>
        ))}
        <ReadinessChecklist label={t('selection.shortlistEditor.readiness')} items={checks} />
        <div className="tiq-inline">
          <Button
            variant="primary"
            icon="check"
            disabled={!isReady(checks)}
            loading={mutation.pending && !confirming}
            onClick={() => {
              if (mode === 'change') setConfirming(true);
              else void save(null);
            }}
          >
            {mode === 'edit'
              ? t('selection.shortlistEditor.save')
              : t('selection.shortlistEditor.submitChange')}
          </Button>
          <Button onClick={onCancel}>{t('selection.form.cancel')}</Button>
        </div>
      </div>
      {confirming && (
        <ConfirmActionDialog
          open
          title={t('selection.shortlistEditor.changeConfirmTitle')}
          scope={tenderLabel(shortlist.tender, shortlist.lot)}
          consequence={t('selection.shortlistEditor.changeConsequence')}
          confirmLabel={t('selection.shortlistEditor.submitChange')}
          reason={{ label: t('selection.shortlistEditor.changeReason'), required: true }}
          pending={change.pending}
          error={withSelectionMessage(change.error)}
          onCancel={() => setConfirming(false)}
          onConfirm={({ reason }) => save(reason)}
        />
      )}
    </Card>
  );
}
