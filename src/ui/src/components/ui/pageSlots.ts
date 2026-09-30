/**
 * The top bar slot a page renders into: the page title (architecture-plan §7). AppShell provides the slot element;
 * PageHeader portals into it. Actions never go to the top bar from a page: the top bar shows only the section action
 * of the active sidebar destination (DD-46), and a page's primary action stays in its head row.
 */
import { createContext, useContext } from 'react';

export interface PageSlots {
  readonly title: HTMLElement | null;
}

export const PageSlotsContext = createContext<PageSlots | null>(null);

export function usePageSlots(): PageSlots | null {
  return useContext(PageSlotsContext);
}
