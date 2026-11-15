import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { initialSessionState } from '../app/slices/session';
import { makeTenant, signedInSession } from '../test/fixtures';
import { LocationProbe, renderWithProviders, stubAuth } from '../test/render';
import { DEMO_ACCOUNT_GROUPS } from './demoAccountList';
import { usePermission } from './permissions';
import { SignInPage } from './SignInPage';

const signedOut = { ...initialSessionState, authStatus: 'signedOut' as const };

describe('SignInPage (COM-01, DD-50)', () => {
  it('lists every demo persona once and signs in as the chosen one', async () => {
    const auth = stubAuth();
    renderWithProviders(<SignInPage />, { state: { session: signedOut }, auth });
    await userEvent.click(screen.getByRole('button', { name: /Sign in as Tebogo Molefe/ }));
    expect(auth.signIn).toHaveBeenCalledWith('tebogo.officer@tenderiq.local');
    const emails = DEMO_ACCOUNT_GROUPS.flatMap((group) =>
      group.accounts.map((account) => account.email),
    );
    expect(emails).toContain('sam.dual@tenderiq.local');
    expect(new Set(emails).size).toBe(emails.length);
    expect(screen.getAllByRole('button', { name: /^Sign in as / })).toHaveLength(emails.length);
  });

  it('asks for no password: the page has no credential field', () => {
    renderWithProviders(<SignInPage />, { state: { session: signedOut } });
    expect(screen.queryByLabelText(/Password/)).toBeNull();
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it('shows ONE generic message when the API refused the persona', () => {
    renderWithProviders(<SignInPage />, {
      state: { session: { ...signedOut, signOutReason: 'rejected' } },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('This persona cannot sign in');
  });

  it('disables the choices while the chosen persona is signing in', () => {
    renderWithProviders(<SignInPage />, {
      state: {
        session: { ...initialSessionState, authStatus: 'signedIn', contextStatus: 'loading' },
      },
    });
    expect(screen.getByRole('status')).toHaveTextContent('Signing in…');
    for (const button of screen.getAllByRole('button', { name: /^Sign in as / })) {
      expect(button).toBeDisabled();
    }
  });

  it('explains an expired session', () => {
    renderWithProviders(<SignInPage />, {
      state: { session: { ...signedOut, signOutReason: 'expired' } },
    });
    expect(
      screen.getByText('Your session ended. Choose a persona to continue.'),
    ).toBeInTheDocument();
  });

  it('offers retry and sign-out when the account context cannot be loaded', async () => {
    const auth = stubAuth();
    renderWithProviders(<SignInPage />, {
      state: {
        session: {
          ...initialSessionState,
          authStatus: 'signedIn',
          contextStatus: 'error',
          contextError: { kind: 'server', status: 500, title: 'x', correlationId: 'corr-5' },
        },
      },
      auth,
    });
    expect(screen.getByText('Correlation id: corr-5')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(auth.reloadContext).toHaveBeenCalled();
  });

  it('sends a ready session to the organization home', () => {
    renderWithProviders(<SignInPage />, {
      state: { session: signedInSession() },
      path: '/signin',
      route: '/signin',
      routes: [{ path: '/buyer', element: <LocationProbe label="buyer home" /> }],
    });
    expect(screen.getByTestId('location-probe')).toHaveTextContent('buyer home');
  });

  it('sends a user without an organization to the selection page', () => {
    renderWithProviders(<SignInPage />, {
      state: { session: signedInSession({ activeTenant: null, tenantStatus: 'none' }) },
      path: '/signin',
      route: '/signin',
      routes: [{ path: '/select-organization', element: <LocationProbe label="select" /> }],
    });
    expect(screen.getByTestId('location-probe')).toHaveTextContent('select');
  });
});

describe('usePermission', () => {
  function Probe() {
    return (
      <p>
        {usePermission('tender.view') ? 'view' : 'no-view'}{' '}
        {usePermission(['award.approve', 'tender.edit']) ? 'edit' : 'no-edit'}
      </p>
    );
  }

  it('answers from the active membership’s effective permissions', () => {
    renderWithProviders(<Probe />, {
      state: { session: signedInSession({ activeTenant: makeTenant({}, ['tender.view']) }) },
    });
    expect(screen.getByText('view no-edit')).toBeInTheDocument();
  });
});
