/**
 * Focus return after a dialog or drawer closes (docs/technical/09-frontend.md §15): focus never drops to <body>.
 */
import type { RefObject } from 'react';

/** The id of the app shell's main region (tabIndex -1), the fallback focus target. */
export const MAIN_REGION_ID = 'tiq-main';

function canTakeFocus(element: HTMLElement | null | undefined): element is HTMLElement {
  return (
    element !== null &&
    element !== undefined &&
    element.isConnected &&
    !element.matches(':disabled') &&
    element.getAttribute('aria-hidden') !== 'true'
  );
}

/**
 * Returns focus after a dialog closes: the preferred element (read now, so it may have rendered after the dialog
 * opened), the opener, the main region, in that order.
 */
export function restoreFocus(
  preferred: RefObject<HTMLElement | null> | undefined,
  opener: HTMLElement | null,
): void {
  const main = document.getElementById(MAIN_REGION_ID);
  const target = [preferred?.current, opener, main].find(canTakeFocus);
  target?.focus();
}
