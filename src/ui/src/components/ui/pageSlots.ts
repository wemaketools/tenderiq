/**
 * The top bar slots a page renders into (architecture-plan §7: the top bar holds the page title and ONE primary
 * action). AppShell provides the slot elements; PageHeader portals into them.
 */
import { createContext, useContext } from 'react';

export interface PageSlots {
  readonly title: HTMLElement | null;
  readonly primaryAction: HTMLElement | null;
}

export const PageSlotsContext = createContext<PageSlots | null>(null);

export function usePageSlots(): PageSlots | null {
  return useContext(PageSlotsContext);
}
