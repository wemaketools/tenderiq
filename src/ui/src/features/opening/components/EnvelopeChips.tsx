/**
 * The state of each envelope of one bid: sealed (locked), opened, or withheld (never opened, for example the
 * commercial envelope of an excluded bid, AC-17). Only states are shown, never sealed content (BR-17).
 */
import type { BidEnvelopeState } from '@contracts/opening';

import { Chip } from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { ENVELOPE_STATE_TONE, envelopeStateLabel } from '../lib/options';

export function EnvelopeChips({ envelopes }: { readonly envelopes: readonly BidEnvelopeState[] }) {
  if (envelopes.length === 0) {
    return <span className="tiq-text-muted">{t('opening.envelopes.none')}</span>;
  }
  return (
    <span className="tiq-inline">
      {envelopes.map((item) => (
        <Chip
          key={item.envelope}
          tone={ENVELOPE_STATE_TONE[item.state]}
          size="sm"
          icon={item.state === 'opened' ? 'unlock' : 'lock'}
        >
          {t('opening.envelopes.chip', {
            envelope: tEnum('tender_envelopes.envelope', item.envelope),
            state: envelopeStateLabel(item.state),
          })}
        </Chip>
      ))}
    </span>
  );
}
