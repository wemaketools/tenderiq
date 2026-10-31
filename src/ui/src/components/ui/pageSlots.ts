/**
 * What the shell tells a page (architecture-plan §7; docs/plan/design1):
 * - `presentation`: `default` (the dark-sidebar shell of the supplier, operator and public areas) or `buyer` (the
 *   white / silver / blue workspace of a buyer organization). PageHeader places its title accordingly.
 * - `title`: in the default presentation, the top bar element the page portals its title into; `null` in the buyer
 *   presentation, where the H1 renders in the content.
 * - `sectionAction`: the action of the active sidebar destination (DD-46) when the shell leaves it to the page: the
 *   buyer utility bar shows no actions, so PageHeader renders it in the page head as the one primary action (or as a
 *   secondary one when the page has its own primary action). `null` when the top bar shows it, or there is none.
 */
import { createContext, useContext } from 'react';

import type { ResolvedSectionAction } from '../../app/featureRegistry';

export type Presentation = 'default' | 'buyer';

export interface PageSlots {
  readonly presentation: Presentation;
  readonly title: HTMLElement | null;
  readonly sectionAction: ResolvedSectionAction | null;
}

export const PageSlotsContext = createContext<PageSlots | null>(null);

export function usePageSlots(): PageSlots | null {
  return useContext(PageSlotsContext);
}

/** The presentation of the surrounding shell (`default` outside the shell). */
export function usePresentation(): Presentation {
  return useContext(PageSlotsContext)?.presentation ?? 'default';
}
