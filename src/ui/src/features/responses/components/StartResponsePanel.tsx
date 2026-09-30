/**
 * Start a response (SUP-08 hand-off into SUP-12). The opportunity workspace sends the supplier to
 * `/supplier/responses?tenderId=N`; this panel states whether the tender's current round can still be answered and
 * offers "Start response" (and "Start alternative offer" when the tender accepts alternatives). Starting is a
 * consequential action, so it is confirmed with organization, capacity, scope and result (COM-02), and then opens
 * the new workspace. When a response already exists, the panel links to it instead.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';

import { getBidStartOptions, startBid } from '@contracts/bids';
import type { BidStartOption, BidStartOptions } from '@contracts/bids';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  ConfirmActionDialog,
  DetailList,
  ErrorState,
  OfficialDeadline,
  SkeletonBlock,
  useToast,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { responseErrorMessage, withResponseMessage } from '../lib/errors';
import { responsePaths } from '../lib/paths';

export interface StartResponsePanelProps {
  readonly tenderId: number;
}

function optionLabel(option: BidStartOption): string {
  return option.isAlternative
    ? t('responses.start.startAlternative')
    : t('responses.start.startMain');
}

function OptionRow({
  option,
  onStart,
}: {
  readonly option: BidStartOption;
  readonly onStart: (option: BidStartOption) => void;
}) {
  const variant = option.isAlternative
    ? t('responses.start.alternativeOffer')
    : t('responses.start.mainOffer');
  if (option.canStart) {
    return (
      <div className="tiq-inline" data-testid="start-option">
        <Button
          variant={option.isAlternative ? 'secondary' : 'primary'}
          icon="plus"
          onClick={() => onStart(option)}
        >
          {optionLabel(option)}
        </Button>
      </div>
    );
  }
  if (option.blockedBy === 'BID_ALREADY_EXISTS' && option.existingBidId !== null) {
    return (
      <div className="tiq-inline" data-testid="start-option">
        <span>{t('responses.start.exists', { variant })}</span>
        <ButtonLink to={responsePaths.answers(option.existingBidId)} size="sm">
          {t('responses.start.openExisting')}
        </ButtonLink>
      </div>
    );
  }
  return (
    <p className="tiq-text-muted" data-testid="start-option">
      {t('responses.start.blocked', {
        variant,
        reason: t(`responses.start.block.${option.blockedBy ?? 'NOT_PERMITTED'}`),
      })}
    </p>
  );
}

function StartContent({ data }: { readonly data: BidStartOptions }) {
  const navigate = useNavigate();
  const toast = useToast();
  const start = useApiMutation(startBid);
  const [chosen, setChosen] = useState<BidStartOption | null>(null);

  const confirm = async (): Promise<void> => {
    if (chosen === null) return;
    try {
      const created = await start.mutate({
        body: {
          tenderId: data.tender.tenderId,
          roundType: data.roundType,
          isAlternative: chosen.isAlternative,
        },
      });
      setChosen(null);
      toast.show(t('responses.start.started', { reference: data.tender.reference }), 'success');
      void navigate(responsePaths.answers(created.id));
    } catch {
      // Shown in the dialog.
    }
  };

  const scope = t('responses.start.scope', {
    reference: data.tender.reference,
    title: data.tender.title,
    round: tEnum('bids.round_type', data.roundType),
    variant:
      chosen?.isAlternative === true
        ? t('responses.start.alternativeOffer')
        : t('responses.start.mainOffer'),
  });

  return (
    <>
      <DetailList
        items={[
          {
            key: 'tender',
            label: t('responses.start.tender'),
            value: `${data.tender.reference} ${data.tender.title}`,
          },
          { key: 'buyer', label: t('responses.start.buyer'), value: data.tender.buyer.name },
          {
            key: 'round',
            label: t('responses.start.round'),
            value: tEnum('bids.round_type', data.roundType),
          },
          {
            key: 'deadline',
            label: t('responses.start.deadline'),
            value: <OfficialDeadline deadline={data.deadline} />,
          },
          {
            key: 'lots',
            label: t('responses.start.lots'),
            value: data.lots
              .map((lot) => `${t('responses.common.lotNo', { no: lot.lotNo })} ${lot.title}`)
              .join(' · '),
          },
          {
            key: 'alternatives',
            label: t('responses.start.alternatives'),
            value: data.alternativesAllowed
              ? t('responses.start.alternativesAllowed')
              : t('responses.start.alternativesNotAllowed'),
          },
        ]}
      />
      <div className="tiq-stack" data-testid="start-options">
        {data.options.map((option) => (
          <OptionRow
            key={option.isAlternative ? 'alternative' : 'main'}
            option={option}
            onStart={(picked) => {
              start.reset();
              setChosen(picked);
            }}
          />
        ))}
      </div>
      <ConfirmActionDialog
        open={chosen !== null}
        title={chosen === null ? '' : optionLabel(chosen)}
        scope={scope}
        consequence={t('responses.start.consequence')}
        confirmLabel={chosen === null ? '' : optionLabel(chosen)}
        pending={start.pending}
        error={withResponseMessage(start.error)}
        onConfirm={confirm}
        onCancel={() => setChosen(null)}
      />
    </>
  );
}

export function StartResponsePanel({ tenderId }: StartResponsePanelProps) {
  const query = useApiQuery(getBidStartOptions, { params: { tenderId } });

  let body: ReactNode;
  if (query.data !== undefined) {
    body = <StartContent data={query.data} />;
  } else if (query.error?.kind === 'not_found') {
    body = (
      <Banner tone="warning" title={t('responses.start.notFoundTitle')}>
        {responseErrorMessage(query.error)}
      </Banner>
    );
  } else if (query.error !== null) {
    body = <ErrorState error={query.error} onRetry={query.reload} />;
  } else {
    body = <SkeletonBlock lines={3} label={t('responses.start.loading')} />;
  }

  return (
    <Card title={t('responses.start.title')} subtitle={t('responses.start.intro')}>
      {body}
    </Card>
  );
}
