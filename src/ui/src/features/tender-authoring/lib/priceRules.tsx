/** DetailList rows stating a schedule's discount rules and accepted price entries (BUY-10, PRD §7.4). */
import type { DiscountType, PriceEntryType } from '@contracts/tenders';

import type { DetailItem } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { PriceEntryMeanings } from '../components/PriceRules';

export interface PriceRules {
  readonly discountsAccepted: readonly DiscountType[];
  readonly discountEvaluationNote: string | null;
  readonly priceEntries: readonly PriceEntryType[];
}

/** "Unconditional, package discounts", or "No discounts accepted". */
export function discountsText(discounts: readonly DiscountType[]): string {
  if (discounts.length === 0) return t('tender-authoring.pricing.discounts.none');
  return discounts.map((type) => t(`tender-authoring.pricing.discounts.type.${type}`)).join(', ');
}

/** DetailList rows for the discount rules and the accepted price entries of a schedule. */
export function priceRuleItems(rules: PriceRules): DetailItem[] {
  return [
    {
      key: 'discounts',
      label: t('tender-authoring.pricing.discounts.label'),
      value: discountsText(rules.discountsAccepted),
    },
    ...(rules.discountsAccepted.length > 0
      ? [
          {
            key: 'discountBasis',
            label: t('tender-authoring.pricing.discounts.basis'),
            value:
              rules.discountEvaluationNote ?? t('tender-authoring.pricing.discounts.basisMissing'),
          },
        ]
      : []),
    {
      key: 'entries',
      label: t('tender-authoring.pricing.entries.label'),
      value: <PriceEntryMeanings entries={rules.priceEntries} />,
    },
  ];
}
