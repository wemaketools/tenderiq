/**
 * The price entries a pricing schedule accepts, each with its meaning (BUY-10, PRD §7.4): a priced line, a zero
 * price, "included" and "not offered" are distinct answers. Used on the pricing page and in the package preview.
 */
import { PRICE_ENTRY_TYPES } from '@contracts/tenders';
import type { PriceEntryType } from '@contracts/tenders';

import { t } from '../../../lib/i18n';

/** The accepted price entries with their meaning, in the contract's order. */
export function PriceEntryMeanings({ entries }: { readonly entries: readonly PriceEntryType[] }) {
  const refused = PRICE_ENTRY_TYPES.filter((entry) => !entries.includes(entry));
  return (
    <div className="tiq-stack">
      <ul className="tiq-stack" aria-label={t('tender-authoring.pricing.entries.label')}>
        {PRICE_ENTRY_TYPES.filter((entry) => entries.includes(entry)).map((entry) => (
          <li key={entry}>
            <strong>{t(`tender-authoring.pricing.entries.type.${entry}`)}</strong>:{' '}
            {t(`tender-authoring.pricing.entries.meaning.${entry}`)}
          </li>
        ))}
      </ul>
      {refused.length > 0 && (
        <span className="tiq-text-muted">
          {t('tender-authoring.pricing.entries.notAccepted', {
            entries: refused
              .map((entry) => t(`tender-authoring.pricing.entries.type.${entry}`))
              .join(', '),
          })}
        </span>
      )}
    </div>
  );
}
