/**
 * The section actions of the real sidebar (DD-46): the top bar shows one action for a whole destination, to the left
 * of the search box, on every page of that destination. Each list page used to render this action itself; this test
 * now holds its target and permission rules in one place.
 */
import { describe, expect, it } from 'vitest';

import type { TenantKind } from '@contracts/common';
import { PERMISSION_CODES } from '@contracts/permissions';

import { t } from '../lib/i18n';
import { activeNavItem, features, navGroupsFor } from './featureRegistry';

interface Expected {
  readonly kind: TenantKind;
  readonly nav: string;
  readonly label: string;
  readonly to: string;
  /** Without these permissions the action is hidden; `null`: every member sees it. */
  readonly requires: readonly string[] | null;
}

const EXPECTED: readonly Expected[] = [
  {
    kind: 'buyer',
    nav: 'buyer.dashboard',
    label: 'Management reports',
    to: '/buyer/reports',
    requires: ['report.view', 'report.manage'],
  },
  {
    kind: 'buyer',
    nav: 'buyer.requests',
    label: 'New request',
    to: '/buyer/requests/new',
    requires: ['request.create'],
  },
  {
    kind: 'buyer',
    nav: 'buyer.planning',
    label: 'New plan item',
    to: '/buyer/planning/items/new',
    requires: ['plan.manage'],
  },
  {
    kind: 'buyer',
    nav: 'buyer.strategies',
    label: 'New strategy',
    to: '/buyer/strategies/new',
    requires: ['strategy.manage'],
  },
  {
    kind: 'buyer',
    nav: 'buyer.tenders',
    label: 'New tender',
    to: '/buyer/tenders/new',
    requires: ['tender.create'],
  },
  {
    kind: 'buyer',
    nav: 'buyer.contracts',
    label: 'New contract',
    to: '/buyer/contracts/new',
    requires: ['contract.prepare'],
  },
  {
    kind: 'buyer',
    nav: 'buyer.suppliers',
    label: 'Invite supplier',
    to: '/buyer/suppliers?new=1',
    requires: ['supplier.relationship.manage'],
  },
  {
    kind: 'buyer',
    nav: 'buyer.reports',
    label: 'New report definition',
    to: '/buyer/reports/definitions/new',
    requires: ['report.manage'],
  },
  {
    kind: 'buyer',
    nav: 'buyer.admin.reports',
    label: 'New report definition',
    to: '/buyer/reports/definitions/new',
    requires: ['report.manage'],
  },
  {
    kind: 'buyer',
    nav: 'buyer.calendars',
    label: 'New calendar',
    to: '/buyer/admin/calendars/new',
    requires: ['org.calendars.manage'],
  },
  {
    kind: 'buyer',
    nav: 'buyer.notification-rules',
    label: 'New rule',
    to: '/buyer/admin/notification-rules/new',
    requires: ['org.notifications.manage'],
  },
  {
    kind: 'buyer',
    nav: 'buyer.qualification.programs',
    label: 'New program',
    to: '/buyer/admin/qualification/new',
    requires: ['qualification.program.manage'],
  },
  {
    kind: 'buyer',
    nav: 'me.memberships',
    label: 'Switch organization',
    to: '/select-organization',
    requires: null,
  },
  {
    kind: 'supplier',
    nav: 'supplier.invitations',
    label: 'Request document access',
    to: '/supplier/invitations?new=1',
    requires: ['supplier.notices.acknowledge'],
  },
  {
    kind: 'supplier',
    nav: 'supplier.complaints',
    label: 'Lodge a complaint',
    to: '/supplier/complaints/new',
    requires: ['supplier.complaint.submit'],
  },
  {
    kind: 'supplier',
    nav: 'supplier.evidence',
    label: 'Add evidence',
    to: '/supplier/evidence/new',
    requires: ['supplier.evidence.manage'],
  },
  {
    kind: 'supplier',
    nav: 'me.supplierMembershipRequests',
    label: 'Find an organization',
    to: '/register',
    requires: null,
  },
  {
    kind: 'operator',
    nav: 'ops.customers',
    label: 'Add customer',
    to: '/ops/customers?new=1',
    requires: ['ops.customers.manage'],
  },
  {
    kind: 'operator',
    nav: 'ops.support',
    label: 'Log a case',
    to: '/ops/support?new=1',
    requires: ['ops.support.manage'],
  },
  {
    kind: 'operator',
    nav: 'ops.incidents',
    label: 'Declare incident',
    to: '/ops/incidents?new=1',
    requires: ['ops.incidents.manage'],
  },
];

function item(kind: TenantKind, nav: string, permissions: readonly string[]) {
  return navGroupsFor(features, { tenantKind: kind, permissions })
    .flatMap((group) => group.items)
    .find((candidate) => candidate.id === nav);
}

describe('section actions of the sidebar (DD-46)', () => {
  it.each(EXPECTED)('$nav offers "$label" → $to', (expected) => {
    const action = item(expected.kind, expected.nav, PERMISSION_CODES)?.sectionAction;
    expect(action?.to).toBe(expected.to);
    expect(action === undefined ? undefined : t(action.label)).toBe(expected.label);
  });

  it.each(EXPECTED.filter((expected) => expected.requires !== null))(
    '$nav hides its action from a member without $requires',
    (expected) => {
      const without = PERMISSION_CODES.filter((code) => !(expected.requires ?? []).includes(code));
      // The destination itself may need the same permission (calendars, notification rules).
      expect(item(expected.kind, expected.nav, without)?.sectionAction).toBeUndefined();
    },
  );

  it('defines no other section actions, so every one is reviewed against the placement rule', () => {
    const defined = features.flatMap((feature) =>
      (feature.nav ?? []).filter((nav) => nav.sectionAction !== undefined).map((nav) => nav.id),
    );
    expect([...defined].sort()).toEqual(EXPECTED.map((entry) => entry.nav).sort());
  });

  it('keeps the tender section action on every page of a tender, where the user drills in', () => {
    const groups = navGroupsFor(features, { tenantKind: 'buyer', permissions: PERMISSION_CODES });
    for (const path of ['/buyer/tenders', '/buyer/tenders/5', '/buyer/tenders/5/pricing']) {
      expect(activeNavItem(groups, path)?.sectionAction?.to).toBe('/buyer/tenders/new');
    }
  });
});
