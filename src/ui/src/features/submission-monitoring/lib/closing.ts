/** Chip tones of the closing status (not an enumeration of the blueprint: derived by the monitoring view). */
import type { ClosingStatus } from '@contracts/bids';
import type { ChipTone } from '@contracts/enums';

export const CLOSING_TONE: Readonly<Record<ClosingStatus, ChipTone>> = {
  open: 'accent',
  deadline_passed: 'warning',
  closed: 'info',
};
