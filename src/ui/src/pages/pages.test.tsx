import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { FeatureModule } from '../app/featureRegistry';
import { initialSessionState } from '../app/slices/session';
import { makeMembership, signedInSession } from '../test/fixtures';
import { LocationProbe, renderWithProviders } from '../test/render';
import { AreaHomePage } from './AreaHomePage';
import { ContextRequiredPage } from './ContextRequiredPage';
import { ForbiddenPage } from './ForbiddenPage';
import { LoadingScreen } from './LoadingScreen';
import { NotFoundPage } from './NotFoundPage';

describe('shell pages', () => {
  it('Not found offers the way back', () => {
    renderWithProviders(<NotFoundPage />, {
      state: { session: { ...initialSessionState, authStatus: 'signedOut' } },
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the start page' })).toHaveAttribute('href', '/');
  });

  it('Forbidden names the acting organization and capacity only', () => {
    renderWithProviders(<ForbiddenPage />, { state: { session: signedInSession() } });
    expect(
      screen.getByText(
        /Acting as Procurement Officer for Kalahari Water Utilities \(Pilot\), you do not have the permission/,
      ),
    ).toBeInTheDocument();
  });

  it('Context required offers switching when a matching organization exists, and says so when none does', () => {
    const { unmount } = renderWithProviders(<ContextRequiredPage requiredKind="supplier" />, {
      state: {
        session: signedInSession({
          memberships: [
            makeMembership(),
            makeMembership({ membershipId: 5, tenantId: 5, tenantKind: 'supplier' }),
          ],
        }),
      },
    });
    expect(screen.getByRole('link', { name: /Switch organization/ })).toHaveAttribute(
      'href',
      '/select-organization',
    );
    unmount();
    renderWithProviders(<ContextRequiredPage requiredKind="operator" />, {
      state: { session: signedInSession() },
    });
    expect(
      screen.getByText('You are not a member of any operator organization.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to Kalahari Water Utilities (Pilot)' }),
    ).toHaveAttribute('href', '/buyer');
  });

  it('Area home opens the first destination or explains that none is available', () => {
    const modules: FeatureModule[] = [
      {
        id: 'x',
        area: 'buyer',
        routes: [],
        nav: [
          { id: 'buyer.x', label: 'x', path: 'x', section: 'home', order: 1, icon: 'dashboard' },
        ],
      },
    ];
    const { unmount } = renderWithProviders(<AreaHomePage area="buyer" modules={modules} />, {
      state: { session: signedInSession() },
      path: '/buyer',
      route: '/buyer',
      routes: [{ path: '/buyer/x', element: <LocationProbe label="first destination" /> }],
    });
    expect(screen.getByTestId('location-probe')).toHaveTextContent('first destination');
    unmount();
    renderWithProviders(<AreaHomePage area="buyer" modules={[]} />, {
      state: { session: signedInSession() },
    });
    expect(screen.getByText('Nothing to open yet')).toBeInTheDocument();
  });

  it('Loading screen announces progress', () => {
    renderWithProviders(<LoadingScreen message="Entering the organization…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Entering the organization…');
  });
});
