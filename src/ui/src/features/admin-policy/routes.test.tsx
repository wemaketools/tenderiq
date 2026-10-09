import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { permissionsForTemplates } from '@contracts/permissions';
import type { PermissionCode } from '@contracts/permissions';

import { navGroupsFor } from '../../app/featureRegistry';
import { renderWithProviders } from '../../test/render';
import PolicyIndexPage from './pages/PolicyIndexPage';
import { features } from './routes';
import { sessionWith } from './test/kit';

vi.mock('../../api/client', async (original) => ({ ...(await original<object>()), call: vi.fn() }));

function navFor(templates: Parameters<typeof permissionsForTemplates>[0]): string[] {
  return navGroupsFor(features, {
    tenantKind: 'buyer',
    permissions: permissionsForTemplates(templates),
  }).flatMap((group) => group.items.map((item) => item.to));
}

describe('admin-policy feature module', () => {
  it('registers the four screens under the buyer area with one admin nav entry', () => {
    const [module] = features;
    expect(module?.area).toBe('buyer');
    const paths = module?.routes.map((route) => route.path) ?? [];
    expect(paths).toEqual(
      expect.arrayContaining([
        'admin/policy/profiles',
        'admin/policy/fields',
        'admin/policy/templates',
        'admin/policy/portal',
      ]),
    );
    expect(module?.nav?.[0]).toMatchObject({ section: 'admin', path: 'admin/policy' });
    expect(module?.routes.every((route) => route.permission !== undefined)).toBe(true);
  });

  it('shows the nav entry to administrators, auditors and publishers but not to requesters', () => {
    expect(navFor(['org_admin'])).toContain('/buyer/admin/policy');
    expect(navFor(['auditor'])).toContain('/buyer/admin/policy');
    expect(navFor(['procurement_officer'])).toContain('/buyer/admin/policy');
    expect(navFor(['requester'])).not.toContain('/buyer/admin/policy');
  });

  it('shows nothing to a supplier membership', () => {
    const groups = navGroupsFor(features, {
      tenantKind: 'supplier',
      permissions: permissionsForTemplates(['org_admin']),
    });
    expect(groups).toHaveLength(0);
  });
});

describe('PolicyIndexPage', () => {
  function renderIndex(permissions: readonly PermissionCode[]) {
    return renderWithProviders(<PolicyIndexPage />, {
      path: '/buyer/admin/policy',
      route: '/buyer/admin/policy',
      state: { session: sessionWith(permissions) },
      routes: [{ path: '/buyer/admin/policy/:screen', element: <p data-testid="screen">x</p> }],
    });
  }

  it('opens the policy profiles when the membership may read them', async () => {
    const { router } = renderIndex(['org.policy.manage']);
    expect(await screen.findByTestId('screen')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/buyer/admin/policy/profiles');
  });

  it('opens the portal policy for a publisher who can read only that screen', async () => {
    const { router } = renderIndex(['tender.publish']);
    expect(await screen.findByTestId('screen')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/buyer/admin/policy/portal');
  });

  it('explains the forbidden page with its heading when no screen is available', () => {
    renderIndex(['tender.view']);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Not available in your role' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Switch organization' })).toBeInTheDocument();
  });
});
