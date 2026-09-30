/**
 * Issues assessment invitations (`buyer.selection.sessions.issueInvites`): each selected candidate gets an
 * appointment in the tender's official time zone with at least the declared preparation time and the same
 * instructions (FR-15). Equal treatment must be confirmed first; the server re-checks every rule.
 */
import { useState } from 'react';

import { selectionEndpoints } from '@contracts/selection';
import type { AssessmentSessionDetail } from '@contracts/selection';

import { useApiMutation } from '../../../api/hooks';
import {
  Banner,
  Checkbox,
  ConfirmActionDialog,
  DateTimeInput,
  useToast,
} from '../../../components/ui';
import { clockNow } from '../../../lib/clock';
import { t, tEnum } from '../../../lib/i18n';
import { withSelectionMessage } from '../lib/errors';
import { bidLabel, tenderLabel } from '../lib/labels';
import { attempt } from '../lib/lists';

export interface IssueInvitesDialogProps {
  readonly session: AssessmentSessionDetail;
  readonly onClose: () => void;
  readonly onIssued: (session: AssessmentSessionDetail) => void;
}

const DAY_MS = 86_400_000;

export function IssueInvitesDialog({ session, onClose, onIssued }: IssueInvitesDialogProps) {
  const toast = useToast();
  const issue = useApiMutation(selectionEndpoints.issueInvites);
  const [selected, setSelected] = useState<Record<number, string | null>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const timeZone = session.tender.officialTimeZone;

  const toggle = (bidId: number, checked: boolean): void => {
    setSelected((current) => {
      const next = { ...current };
      if (checked) next[bidId] = null;
      else delete next[bidId];
      return next;
    });
  };

  return (
    <ConfirmActionDialog
      open
      title={t('selection.invites.title')}
      scope={`${tEnum('assessment_sessions.session_type', session.sessionType)} · ${tenderLabel(session.tender, session.lot)}`}
      consequence={t('selection.invites.consequence', { days: session.preparationDays })}
      confirmLabel={t('selection.invites.confirm')}
      pending={issue.pending}
      error={withSelectionMessage(issue.error)}
      onCancel={onClose}
      onConfirm={async () => {
        const entries = Object.entries(selected);
        if (entries.length === 0) {
          setProblem(t('selection.invites.noneSelected'));
          return;
        }
        if (entries.some(([, at]) => at === null)) {
          setProblem(t('selection.invites.timeRequired'));
          return;
        }
        const earliest = clockNow() + session.preparationDays * DAY_MS;
        if (entries.some(([, at]) => at !== null && Date.parse(at) < earliest)) {
          setProblem(t('selection.invites.tooSoon', { days: session.preparationDays }));
          return;
        }
        setProblem(null);
        const result = await attempt(
          issue.mutate({
            params: { sessionId: session.sessionId },
            body: {
              invites: entries.map(([bidId, at]) => ({
                bidId: Number(bidId),
                scheduledAt: at ?? '',
              })),
            },
          }),
        );
        if (result === undefined) return;
        toast.show(t('selection.invites.issued'), 'success');
        onIssued(result);
      }}
    >
      {!session.equalTreatmentConfirmed && (
        <Banner tone="warning" title={t('selection.invites.equalTreatmentFirst')} />
      )}
      {session.invitableBids.length === 0 ? (
        <p className="tiq-text-muted">{t('selection.invites.noCandidates')}</p>
      ) : (
        <fieldset className="tiq-fieldset tiq-stack">
          <legend>{t('selection.invites.candidates')}</legend>
          {session.invitableBids.map((bid) => {
            const checked = bid.bidId in selected;
            return (
              <div key={bid.bidId} className="tiq-form-grid">
                <Checkbox
                  label={bidLabel(bid)}
                  checked={checked}
                  onChange={(value) => toggle(bid.bidId, value)}
                />
                {checked && (
                  <DateTimeInput
                    label={t('selection.invites.appointment', { supplier: bid.supplierName })}
                    required
                    timeZone={timeZone}
                    value={selected[bid.bidId] ?? null}
                    onChange={(at) => setSelected((current) => ({ ...current, [bid.bidId]: at }))}
                  />
                )}
              </div>
            );
          })}
        </fieldset>
      )}
      {problem !== null && <Banner tone="error" title={problem} />}
    </ConfirmActionDialog>
  );
}
