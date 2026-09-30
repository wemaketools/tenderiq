/**
 * Permission sets of the response screens, taken from the bids contract so the UI and the API agree (AC-03).
 */
import {
  PRICING_VIEW_PERMISSIONS,
  RECEIPT_VIEW_PERMISSIONS,
  RESPONSE_TEAM_PERMISSIONS,
} from '@contracts/bids';

/** The response team reads the workspace. */
export const RESPONSE_READ = RESPONSE_TEAM_PERMISSIONS;
/** Pricing personas and internal approvers read pricing. */
export const PRICING_READ = PRICING_VIEW_PERMISSIONS;
/** Receipts are also readable by the supplier administrator. */
export const RECEIPT_READ = RECEIPT_VIEW_PERMISSIONS;
