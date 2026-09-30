/**
 * The price gate (AC-16, DD-16, DD-23): commercial prices stay unavailable until the chair releases the gate after
 * the non-price review. The chair releases it here through a COM-02 confirmation; everyone else sees its state.
 */
import { useState } from 'react';

import { releasePriceGate } from '@contracts/evaluation';
import type { PriceGate } from '@contracts/evaluation';

import { useApiMutation } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import { Button, Card, ConfirmActionDialog, DetailList, useToast } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { withEvaluationMessage } from '../lib/errors';
import { priceGateState } from '../lib/scores';
import { PriceGateChip } from './chips';

export interface PriceGateCardProps {
  readonly tenderId: number;
  readonly lotId: number | null;
  readonly gate: PriceGate;
  readonly timeZone: string;
  /** "T-2026-0003 SCADA telemetry upgrade" (the confirmation scope). */
  readonly scope: string;
  readonly onReleased?: (gate: PriceGate) => void;
}

export function PriceGateCard({
  tenderId,
  lotId,
  gate,
  timeZone,
  scope,
  onReleased,
}: PriceGateCardProps) {
  const isChair = usePermission('evaluation.chair');
  const toast = useToast();
  const release = useApiMutation(releasePriceGate);
  const [open, setOpen] = useState(false);
  const [released, setReleased] = useState<PriceGate | null>(null);
  const current = released ?? gate;
  const state = priceGateState(current);

  return (
    <Card
      title={t('evaluation.priceGate.title')}
      subtitle={t(`evaluation.priceGate.explain.${state}`)}
      actions={
        isChair && state === 'closed' ? (
          <Button
            icon="unlock"
            onClick={() => {
              release.reset();
              setOpen(true);
            }}
          >
            {t('evaluation.priceGate.release')}
          </Button>
        ) : undefined
      }
    >
      <DetailList
        items={[
          {
            key: 'state',
            label: t('evaluation.priceGate.stateLabel'),
            value: <PriceGateChip gate={current} />,
          },
          {
            key: 'releasedAt',
            label: t('evaluation.priceGate.releasedAt'),
            value:
              current.releasedAt === null ? null : formatDateTime(current.releasedAt, timeZone),
          },
          {
            key: 'releasedBy',
            label: t('evaluation.priceGate.releasedBy'),
            value: current.releasedBy?.fullName ?? null,
          },
          {
            key: 'confirmed',
            label: t('evaluation.priceGate.nonPriceConfirmed'),
            value:
              current.nonPriceCompleteConfirmed === null
                ? null
                : t(
                    current.nonPriceCompleteConfirmed
                      ? 'evaluation.common.yes'
                      : 'evaluation.common.no',
                  ),
          },
          { key: 'note', label: t('evaluation.priceGate.note'), value: current.note },
        ]}
      />
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
            onReleased?.(next);
          } catch {
            // The dialog shows the error (NON_PRICE_MODERATION_OPEN, PRICE_GATE_ALREADY_RELEASED…).
          }
        }}
      />
    </Card>
  );
}
