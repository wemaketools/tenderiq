import { describe, expect, it } from 'vitest';

import { permissionsForTemplates } from '@contracts/permissions';
import type { PermissionCode } from '@contracts/permissions';

import { features } from './routes';

function allows(
  requirement: PermissionCode | readonly PermissionCode[] | undefined,
  held: readonly string[],
) {
  if (requirement === undefined) return true;
  const list: readonly string[] = typeof requirement === 'string' ? [requirement] : requirement;
  return list.some((code) => held.includes(code));
}

describe('planning feature routes and navigation', () => {
  const buyer = features.find((item) => item.area === 'buyer');
  const publicArea = features.find((item) => item.area === 'public');

  it('shows the plan entry to a procurement officer and an auditor but not to a requester', () => {
    const item = buyer?.nav?.[0];
    expect(item?.section).toBe('planning');
    expect(allows(item?.permission, permissionsForTemplates(['procurement_officer']))).toBe(true);
    expect(allows(item?.permission, permissionsForTemplates(['auditor']))).toBe(true);
    expect(allows(item?.permission, permissionsForTemplates(['requester']))).toBe(false);
  });

  it('keeps creation routes for plan managers only', () => {
    const create = buyer?.routes.find((route) => route.path === 'planning/items/new');
    expect(allows(create?.permission, permissionsForTemplates(['auditor']))).toBe(false);
    expect(allows(create?.permission, permissionsForTemplates(['procurement_officer']))).toBe(true);
  });

  it('serves the public plans pages without a permission', () => {
    expect(publicArea?.routes.map((route) => route.path)).toEqual([
      'plans',
      'plans/:buyerSlug/:noticeId',
    ]);
    expect(publicArea?.routes.every((route) => route.permission === undefined)).toBe(true);
  });
});
