import { describe, expect, it } from 'vitest';

import type { PermissionCode } from '@contracts/permissions';

import { hasPermission, navGroupsFor } from '../../app/featureRegistry';
import type { FeatureModule } from '../../app/featureRegistry';
import { hasTranslation } from '../../lib/i18n';
import { features as approvals } from '../approvals/routes';
import { features as calendars } from '../calendars/routes';
import { features as documents } from '../documents/routes';
import { features as notifications } from '../notifications/routes';
import { features as tasks } from './routes';

const MODULES: FeatureModule[] = [
  ...tasks,
  ...approvals,
  ...notifications,
  ...documents,
  ...calendars,
];

function navIds(tenantKind: 'buyer' | 'supplier' | 'operator', permissions: PermissionCode[]) {
  return navGroupsFor(MODULES, { tenantKind, permissions }).flatMap((group) =>
    group.items.map((item) => item.id),
  );
}

function route(area: string, path: string) {
  const module = MODULES.find(
    (candidate) => candidate.area === area && candidate.routes.some((entry) => entry.path === path),
  );
  return module?.routes.find((entry) => entry.path === path);
}

describe('workspace navigation', () => {
  it('shows the personal inbox, notifications and documents to every account holder', () => {
    for (const kind of ['buyer', 'supplier', 'operator'] as const) {
      expect(navIds(kind, [])).toEqual(
        expect.arrayContaining(['me.tasks', 'me.notifications', 'me.documents']),
      );
    }
  });

  it('shows approvals only in buyer organizations', () => {
    expect(navIds('buyer', [])).toContain('me.approvals');
    expect(navIds('supplier', [])).not.toContain('me.approvals');
  });

  it('shows calendars and notification rules only to administrators who manage them', () => {
    const admin = navIds('buyer', ['org.calendars.manage', 'org.notifications.manage']);
    expect(admin).toEqual(expect.arrayContaining(['buyer.calendars', 'buyer.notification-rules']));
    const officer = navIds('buyer', ['tender.view', 'tender.edit']);
    expect(officer).not.toContain('buyer.calendars');
    expect(officer).not.toContain('buyer.notification-rules');
    expect(navIds('supplier', ['org.notifications.manage'])).not.toContain(
      'buyer.notification-rules',
    );
  });

  it('guards the administration routes with their permissions', () => {
    expect(hasPermission(route('buyer', 'admin/calendars')?.permission, ['tender.view'])).toBe(
      true,
    );
    expect(hasPermission(route('buyer', 'admin/calendars/new')?.permission, ['tender.view'])).toBe(
      false,
    );
    expect(
      hasPermission(route('buyer', 'admin/notification-rules/:ruleId')?.permission, [
        'tender.view',
      ]),
    ).toBe(false);
    expect(route('common', 'approvals/:approvalId')?.permission).toBeUndefined();
  });

  it('has a translated label for every nav item and route title', () => {
    for (const module of MODULES) {
      for (const item of module.nav ?? []) expect(hasTranslation(item.label)).toBe(true);
      for (const entry of module.routes) {
        if (entry.title !== undefined) expect(hasTranslation(entry.title)).toBe(true);
      }
    }
  });
});
