/**
 * Plain-text labels of selection records, for select options, dialog scopes and approval subjects.
 */
import type { SelectionBidRef, SelectionLotRef, SelectionTenderRef } from '@contracts/selection';

import { t } from '../../../lib/i18n';

/** A bid: the supplier name, marked when it is a variant offer. */
export function bidLabel(bid: SelectionBidRef): string {
  return bid.isAlternative
    ? t('selection.common.bidVariantLabel', { supplier: bid.supplierName })
    : bid.supplierName;
}

/** `T-2026-0009 Leak detection services` plus the lot when the record is lot-specific. */
export function tenderLabel(
  tender: Pick<SelectionTenderRef, 'reference' | 'title'>,
  lot?: SelectionLotRef | null,
): string {
  const base = `${tender.reference} ${tender.title}`;
  return lot === null || lot === undefined
    ? base
    : t('selection.common.tenderLot', { tender: base, lotNo: lot.lotNo, lot: lot.title });
}

/** The lot text of a record (`Lot 1: title`) or the whole-tender label. */
export function lotLabel(lot: SelectionLotRef | null): string {
  return lot === null
    ? t('selection.common.wholeTender')
    : t('selection.common.lotLabel', { lotNo: lot.lotNo, title: lot.title });
}
