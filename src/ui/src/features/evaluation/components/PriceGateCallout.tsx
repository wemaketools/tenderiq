/**
 * The price gate as a soft callout of the evaluation overview (AC-16, DD-16, DD-23; docs/plan/design1): the state
 * is derived from the real gate (sealed, released by whom and when, or no gate for a single-stage opening), never
 * hard-coded. The chair releases a closed gate here through the same COM-02 confirmation as the price gate card of
 * the commercial comparison; everyone else only reads the state.
 */
import { useState } from 'react';

import { releasePriceGate } from '@contracts/evaluation';
import type { PriceGate } from '@contracts/evaluation';

import { useApiMutation } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import { Button, Callout, ConfirmActionDialog, IconTile, useToast } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { withEvaluationMessage } from '../lib/errors';
import { priceGateState } from '../lib/scores';

export interface PriceGateCalloutProps {
  readonly tenderId: number;
  readonly lotId: number | null;
  readonly gate: PriceGate;
  readonly timeZone: string;
  /** "T-2026-0003 SCADA telemetry upgrade" (the confirmation scope). */
  readonly scope: string;
}

export function PriceGateCallout({
  tenderId,
  lotId,
  gate,
  timeZone,
  scope,
}: PriceGateCalloutProps) {
  const isChair = usePermission('evaluation.chair');
  const toast = useToast();
  const release = useApiMutation(releasePriceGate);
  const [open, setOpen] = useState(false);
  const [released, setReleased] = useState<PriceGate | null>(null);
  const current = released ?? gate;
  const state = priceGateState(current);

  return (
    <>
      <Callout
        lead={
          <IconTile
            icon={state === 'closed' ? 'lock' : 'unlock'}
            tone={state === 'closed' ? 'neutral' : 'accent'}
            size="lg"
          />
        }
        title={t(`evaluation.overview.gate.${state}.title`)}
        actions={
          isChair && state === 'closed' ? (
            <div>
              <Button
                icon="unlock"
                onClick={() => {
                  release.reset();
                  setOpen(true);
                }}
              >
                {t('evaluation.priceGate.release')}
              </Button>
            </div>
          ) : undefined
        }
      >
        <p>{t(`evaluation.priceGate.explain.${state}`)}</p>
        {state === 'released' && current.releasedAt !== null && (
          <p>
            {t('evaluation.overview.gate.releasedLine', {
              name: current.releasedBy?.fullName ?? '—',
              time: formatDateTime(current.releasedAt, timeZone),
            })}
          </p>
        )}
        {current.note !== null && (
          <p>{t('evaluation.overview.gate.note', { note: current.note })}</p>
        )}
      </Callout>
      <ConfirmActionDialog
        open={open}
        title={t('evaluation.priceGate.releaseTitle')}
        scope={scope}
        consequence={t('evaluation.priceGate.releaseConsequence')}
        confirmLabel={t('evaluation.priceGate.release')}
        acknowledgement={t('evaluation.priceGate.releaseAck')}
        reason={{ label: t('evaluation.priceGate.note'), required: false }}
        pending={release.pending}
        error={withEvaluationMessage(release.error, { note: 'reason' })}
        onCancel={() => setOpen(false)}
        onConfirm={async ({ reason }) => {
          try {
            const next = await release.mutate({
              params: { tenderId },
              body: {
                ...(lotId === null ? {} : { lotId }),
                nonPriceCompleteConfirmed: true,
                ...(reason === '' ? {} : { note: reason }),
              },
            });
            setReleased(next);
            setOpen(false);
            toast.show(t('evaluation.priceGate.released'), 'success');
          } catch {
            // The dialog shows the error (NON_PRICE_MODERATION_OPEN, PRICE_GATE_ALREADY_RELEASED…).
          }
        }}
      />
    </>
  );
}
