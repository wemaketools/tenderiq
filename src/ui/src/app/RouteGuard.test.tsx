import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { initialSessionState } from './slices/session';
import { makeMembership, makeTenant, signedInSession } from '../test/fixtures';
import { LocationProbe, renderWithProviders } from '../test/render';
import { RouteGuard } from './RouteGuard';

const probes = [
  { path: '/signin', element: <LocationProbe label="sign-in page" /> },
  { path: '/select-organization', element: <LocationProbe label="organization selection" /> },
];

describe('RouteGuard', () => {
  it('shows the loading screen while the session is established', () => {
    renderWithProviders(
      <RouteGuard>
        <p>secret</p>
      </RouteGuard>,
      { state: { session: initialSessionState }, path: '/buyer', route: '/buyer', routes: probes },
    );
    expect(screen.getByRole('status')).toHaveTextContent('Signing you in');
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('redirects a signed-out visitor to sign-in', () => {
    renderWithProviders(
      <RouteGuard>
        <p>secret</p>
      </RouteGuard>,
      {
        state: { session: { ...initialSessionState, authStatus: 'signedOut' } },
        path: '/buyer',
        route: '/buyer',
        routes: probes,
      },
    );
    expect(screen.getByTestId('location-probe')).toHaveTextContent('sign-in page');
  });

  it('sends a signed-in user without an organization to the selection page', () => {
    renderWithProviders(
      <RouteGuard requireTenant>
        <p>secret</p>
      </RouteGuard>,
      {
        state: { session: signedInSession({ activeTenant: null, tenantStatus: 'none' }) },
        path: '/buyer',
        route: '/buyer',
        routes: probes,
      },
    );
    expect(screen.getByTestId('location-probe')).toHaveTextContent('organization selection');
  });

  it('explains when the area needs another kind of organization', () => {
    renderWithProviders(
      <RouteGuard area="supplier">
        <p>secret</p>
      </RouteGuard>,
      {
        state: {
          session: signedInSession({
            memberships: [
              makeMembership(),
              makeMembership({ tenantId: 5, tenantKind: 'supplier', membershipId: 2 }),
            ],
          }),
        },
        path: '/supplier',
        route: '/supplier',
      },
    );
    expect(screen.getByText('This page is for supplier organizations')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /switch organization/i })).toHaveAttribute(
      'href',
      '/select-organization',
    );
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('shows the forbidden page without the permission', () => {
    renderWithProviders(
      <RouteGuard permission="evaluation.chair">
        <p>secret</p>
      </RouteGuard>,
      { state: { session: signedInSession({ activeTenant: makeTenant({}, ['tender.view']) }) } },
    );
    expect(screen.getByRole('heading', { name: 'Not available in your role' })).toBeInTheDocument();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('renders the page when every check passes', () => {
    renderWithProviders(
      <RouteGuard requireTenant area="buyer" permission={['tender.edit', 'tender.view']}>
        <p>secret</p>
      </RouteGuard>,
      { state: { session: signedInSession() } },
    );
    expect(screen.getByText('secret')).toBeInTheDocument();
  });
});
