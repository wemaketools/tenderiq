/** The count a nav item shows (shared by the sidebar list and the buyer rail). */
import type { NavBadgeSource } from '../../app/featureRegistry';
import type { RootState } from '../../app/store';

export function badgeCount(source: NavBadgeSource | undefined, state: RootState): number | null {
  if (source === undefined) return null;
  if (source === 'notifications') return state.badges.me.notificationsUnread;
  if (source === 'tasks') return state.badges.me.tasksOpen;
  if (source === 'tasksOverdue') return state.badges.me.tasksOverdue;
  return state.badges.nav[source.navBadgeId] ?? null;
}

export function countText(count: number): string {
  return count > 99 ? '99+' : String(count);
}

/** The nav ids pinned on the buyer rail, in rail order (docs/plan/design1 §2). */
export const PINNED_NAV_IDS: readonly string[] = [
  'buyer.dashboard',
  'buyer.tenders',
  'me.approvals',
  'buyer.evaluation.evaluations',
  'buyer.awards',
  'buyer.contracts',
];
