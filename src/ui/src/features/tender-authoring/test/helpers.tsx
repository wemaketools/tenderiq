/** Shared helpers of the tender authoring page tests. */
import type { ReactElement } from 'react';

import type { PermissionCode } from '@contracts/permissions';

import { makeTenant, signedInSession } from '../../../test/fixtures';
import { renderWithProviders } from '../../../test/render';
import { tender5 } from './data';

export const OFFICER: readonly PermissionCode[] = [
  'tender.view',
  'tender.create',
  'tender.edit',
  'tender.publish',
];
export const MANAGER: readonly PermissionCode[] = [
  ...OFFICER,
  'tender.release_approve',
  'audit.view',
];
export const EVALUATOR: readonly PermissionCode[] = ['tender.view'];

export const API = '/api/v1/buyer/tenders';

/** Renders a page as a KWU member holding the given permissions. */
export function renderPage(
  element: ReactElement,
  options: { route: string; path?: string; permissions?: readonly PermissionCode[] },
) {
  return renderWithProviders(element, {
    route: options.route,
    path: options.path ?? '*',
    state: {
      session: signedInSession({ activeTenant: makeTenant({}, options.permissions ?? OFFICER) }),
    },
  });
}

/** A contract-valid change impact: revision 4, invalidating the given approval. */
export function changeImpact(invalidated: boolean) {
  return {
    material: true,
    draftRevision: 4,
    contentHash: 'a'.repeat(64),
    tenderStatus: 'draft',
    invalidatedApproval: invalidated
      ? {
          ...tender5.releaseApproval,
          status: 'invalidated',
          invalidatedAt: '2026-09-30T08:00:00Z',
          invalidationReason: 'Material change in revision 4.',
        }
      : null,
    releaseChecksReset: ['scope'],
  };
}
