/**
 * Hooks of the clarifications feature: the buyer's tender list (shared by filters and forms) and the buyer tabs the
 * membership may use.
 */
import { clarificationsEndpoints } from '@contracts/clarifications';

import { useApiQuery } from '../../api/hooks';
import { usePermissions } from '../../auth/permissions';
import { t } from '../../lib/i18n';
import {
  ADDENDUM_READ_PERMISSION,
  QUESTION_PERMISSION,
  SESSION_PERMISSION,
  buyerPaths,
} from './lib';

const TENDERS_REQUEST = { query: { pageSize: 100 } } as const;

/** All tenders of the active buyer with their clarification workload. */
export function useBuyerTenders() {
  return useApiQuery(clarificationsEndpoints.buyerTenders, TENDERS_REQUEST);
}

export interface BuyerTab {
  readonly to: string;
  readonly label: string;
}

/** Q&A, addenda and sessions tabs, filtered by the membership's permissions. */
export function useVisibleTabs(): BuyerTab[] {
  const held: readonly string[] = usePermissions();
  const tabs = [
    {
      to: buyerPaths.questions,
      label: t('clarifications.tabs.questions'),
      permissions: [QUESTION_PERMISSION] as readonly string[],
    },
    {
      to: buyerPaths.addenda,
      label: t('clarifications.tabs.addenda'),
      permissions: ADDENDUM_READ_PERMISSION as readonly string[],
    },
    {
      to: buyerPaths.sessions,
      label: t('clarifications.tabs.sessions'),
      permissions: [SESSION_PERMISSION] as readonly string[],
    },
  ];
  return tabs
    .filter((tab) => tab.permissions.some((code) => held.includes(code)))
    .map(({ to, label }) => ({ to, label }));
}
