/**
 * A bid as the selection screens name it: the legal supplier valid at receipt, plus a chip for a variant offer.
 */
import type { SelectionBidRef } from '@contracts/selection';

import { Chip } from '../../../components/ui';
import { t } from '../../../lib/i18n';

export function BidName({ bid }: { readonly bid: SelectionBidRef }) {
  return (
    <span className="tiq-inline">
      <span>{bid.supplierName}</span>
      {bid.isAlternative && (
        <Chip tone="info" size="sm">
          {t('selection.common.variant')}
        </Chip>
      )}
    </span>
  );
}
