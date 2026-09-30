/**
 * Renders a selection page for a test: a signed-in session whose active organization holds the given permissions,
 * mounted at the page's route pattern so route parameters resolve.
 */
import type { ReactElement } from 'react';

import type { PermissionCode } from '@contracts/permissions';
import type { ActiveTenantContext } from '@contracts/session';

import { renderWithProviders } from '../../../test/render';
import { makeMembership, makeTenant, signedInSession } from '../../../test/fixtures';

export const OFFICER: readonly PermissionCode[] = [
  'selection.manage',
  'diligence.manage',
  'negotiation.conduct',
];
export const MANAGER: readonly PermissionCode[] = [
  'selection.manage',
  'shortlist.approve',
  'negotiation.approve',
  'audit.view',
];
export const AUDITOR: readonly PermissionCode[] = ['audit.view'];
export const EVALUATOR: readonly PermissionCode[] = ['evaluation.score'];
export const SUPPLIER_ADMIN: readonly PermissionCode[] = [
  'supplier.outcomes.view',
  'supplier.notices.acknowledge',
  'supplier.opportunities.view',
];

export interface SelectionRenderOptions {
  readonly path: string;
  readonly route: string;
  readonly permissions?: readonly PermissionCode[];
  readonly supplier?: boolean;
  /** Overrides of the buyer tenant context (for example no default currency). */
  readonly tenant?: Partial<ActiveTenantContext>;
}

export function renderSelection(element: ReactElement, options: SelectionRenderOptions) {
  const supplier = options.supplier === true;
  const tenant = supplier
    ? makeTenant(
        {
          tenantId: 8,
          kind: 'supplier',
          name: 'Limpopo Environmental Services',
          slug: 'limpopo-env',
          capacity: 'Organization Administrator',
        },
        [...(options.permissions ?? SUPPLIER_ADMIN)],
      )
    : makeTenant({ ...options.tenant }, [...(options.permissions ?? OFFICER)]);
  const memberships = supplier
    ? [
        makeMembership({
          tenantId: 8,
          tenantKind: 'supplier',
          tenantName: 'Limpopo Environmental Services',
          tenantSlug: 'limpopo-env',
        }),
      ]
    : [makeMembership()];
  return renderWithProviders(element, {
    state: { session: signedInSession({ activeTenant: tenant, memberships }) },
    path: options.path,
    route: options.route,
  });
}
