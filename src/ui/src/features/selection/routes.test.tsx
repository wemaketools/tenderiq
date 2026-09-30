import { describe, expect, it } from 'vitest';

import type { PermissionCode } from '@contracts/permissions';
import { permissionsForTemplates } from '@contracts/permissions';

import { hasPermission } from '../../app/featureRegistry';
import { hasTranslation } from '../../lib/i18n';
import { features } from './routes';

const buyer = features.find((feature) => feature.id === 'selection');
const supplier = features.find((feature) => feature.id === 'selection-supplier');

function visibleNav(area: typeof buyer, granted: readonly PermissionCode[]): string[] {
  return (area?.nav ?? [])
    .filter((item) => hasPermission(item.permission, granted))
    .map((item) => item.id);
}

describe('selection routes and navigation', () => {
  it('registers one route per screen with translated titles', () => {
    const paths = [...(buyer?.routes ?? []), ...(supplier?.routes ?? [])].map(
      (route) => route.path,
    );
    expect(paths).toEqual(
      expect.arrayContaining([
        'selection/assessments/:sessionId',
        'selection/shortlists/:shortlistId',
        'selection/preferred-bidders/:preferredBidderId',
        'selection/due-diligence/:caseId',
        'selection/negotiations/:negotiationId',
        'selection/final-offers/:roundId',
        'assessment-invites',
        'negotiations/:negotiationId',
      ]),
    );
    for (const route of [...(buyer?.routes ?? []), ...(supplier?.routes ?? [])]) {
      expect(hasTranslation(route.title ?? '')).toBe(true);
    }
  });

  it('shows the buyer selection entry to officers, managers, evaluators and auditors only', () => {
    expect(visibleNav(buyer, permissionsForTemplates(['procurement_officer']))).toEqual([
      'buyer.selection',
    ]);
    expect(visibleNav(buyer, permissionsForTemplates(['procurement_manager']))).toEqual([
      'buyer.selection',
    ]);
    expect(visibleNav(buyer, permissionsForTemplates(['evaluator']))).toEqual(['buyer.selection']);
    expect(visibleNav(buyer, permissionsForTemplates(['auditor']))).toEqual(['buyer.selection']);
    expect(visibleNav(buyer, permissionsForTemplates(['requester']))).toEqual([]);
    expect(visibleNav(buyer, permissionsForTemplates(['org_admin']))).toEqual([]);
  });

  it('guards buyer commands with their manage permissions', () => {
    const route = (path: string) => buyer?.routes.find((item) => item.path === path);
    const evaluator = permissionsForTemplates(['evaluator']);
    expect(hasPermission(route('selection/assessments/new')?.permission, evaluator)).toBe(false);
    expect(hasPermission(route('selection/shortlists')?.permission, evaluator)).toBe(false);
    expect(
      hasPermission(
        route('selection/negotiations/new')?.permission,
        permissionsForTemplates(['procurement_manager']),
      ),
    ).toBe(false);
  });

  it('shows supplier negotiations only to roles that may read outcomes or pricing', () => {
    expect(visibleNav(supplier, permissionsForTemplates(['supplier_admin']))).toEqual([
      'supplier.selection.invites',
      'supplier.selection.negotiations',
    ]);
    expect(visibleNav(supplier, permissionsForTemplates(['contributor']))).toEqual([
      'supplier.selection.invites',
    ]);
    expect(visibleNav(supplier, permissionsForTemplates(['supplier_finance']))).toEqual([]);
  });
});
