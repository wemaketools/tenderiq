import { describe, expect, it } from 'vitest';

import { permissionsForTemplates } from '@contracts/permissions';
import type { RoleTemplateCode } from '@contracts/permissions';

import { collectFeatures, hasPermission, navGroupsFor } from '../../app/featureRegistry';
import type { TenantKind } from '@contracts/common';
import { features } from './routes';

const modules = collectFeatures({ './opening/routes.tsx': { features } });

function navFor(kind: TenantKind, templates: readonly RoleTemplateCode[]): string[] {
  return navGroupsFor(modules, {
    tenantKind: kind,
    permissions: permissionsForTemplates(templates),
  })
    .flatMap((group) => group.items)
    .map((item) => item.to);
}

function routeAllowed(path: string, templates: readonly RoleTemplateCode[]): boolean {
  const route = modules.flatMap((module) => module.routes).find((item) => item.path === path);
  if (route === undefined) throw new Error(`No route ${path}`);
  return hasPermission(route.permission, permissionsForTemplates(templates));
}

describe('opening navigation and route permissions', () => {
  it('shows opening, compliance and clarifications to the procurement officer', () => {
    expect(navFor('buyer', ['procurement_officer'])).toEqual([
      '/buyer/opening',
      '/buyer/compliance',
      '/buyer/bid-clarifications',
    ]);
  });

  it('shows the opening officer the opening only', () => {
    expect(navFor('buyer', ['opening_officer'])).toEqual(['/buyer/opening']);
  });

  it('shows an evaluator the bid clarifications only', () => {
    expect(navFor('buyer', ['evaluator'])).toEqual(['/buyer/bid-clarifications']);
  });

  it('hides every opening destination and refuses every route to administrators, auditors and support (AC-15)', () => {
    for (const templates of [['org_admin'], ['auditor'], ['support_agent']] as const) {
      expect(navFor('buyer', templates)).toEqual([]);
      for (const path of [
        'opening',
        'opening/sessions/:sessionId',
        'compliance',
        'bid-clarifications',
      ]) {
        expect(routeAllowed(path, templates)).toBe(false);
      }
    }
  });

  it('shows assessment requests to supplier bid managers and administrators, not to buyers', () => {
    expect(navFor('supplier', ['bid_manager'])).toEqual(['/supplier/assessment-requests']);
    expect(navFor('supplier', ['supplier_admin'])).toEqual(['/supplier/assessment-requests']);
    expect(navFor('buyer', ['procurement_officer'])).not.toContain('/supplier/assessment-requests');
  });
});
