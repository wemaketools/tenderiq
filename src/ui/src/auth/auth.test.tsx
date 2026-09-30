import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { initialSessionState } from '../app/slices/session';
import { makeTenant, signedInSession } from '../test/fixtures';
import { LocationProbe, renderWithProviders, stubAuth } from '../test/render';
import { DEMO_ACCOUNTS_MARKER, DEMO_ACCOUNT_GROUPS } from './demoAccountList';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { usePermission } from './permissions';
import { ResetPasswordPage } from './ResetPasswordPage';
import { SignInPage } from './SignInPage';

const signedOut = { ...initialSessionState, authStatus: 'signedOut' as const };

describe('SignInPage (COM-01)', () => {
  it('signs in with email and password and shows ONE generic message on failure', async () => {
    const auth = stubAuth({ signIn: vi.fn(() => Promise.resolve({ ok: false })) });
    renderWithProviders(<SignInPage />, { state: { session: signedOut }, auth });
    await userEvent.type(screen.getByLabelText(/Email address/), 'someone@tenderiq.local');
    await userEvent.type(screen.getByLabelText(/Password/), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(auth.signIn).toHaveBeenCalledWith('someone@tenderiq.local', 'wrong');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not sign you in with those details',
    );
  });

  it('keeps keyboard focus in the form while signing in and returns it to the password field after a failure', async () => {
    let resolve: (value: { ok: boolean }) => void = () => undefined;
    const auth = stubAuth({
      signIn: vi.fn(
        () =>
          new Promise<{ ok: boolean }>((done) => {
            resolve = done;
          }),
      ),
    });
    renderWithProviders(<SignInPage />, { state: { session: signedOut }, auth });
    await userEvent.type(screen.getByLabelText(/Email address/), 'someone@tenderiq.local');
    const password = screen.getByLabelText(/Password/);
    await userEvent.type(password, 'wrong{Enter}');
    expect(password).not.toBeDisabled();
    expect(password).toHaveAttribute('readonly');
    expect(password).toHaveAttribute('aria-disabled', 'true');
    expect(password).toHaveFocus();
    resolve({ ok: false });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(password).toHaveFocus();
    expect(password).not.toHaveAttribute('readonly');
  });

  it('lists the demo accounts in development builds and signs in for real with the chosen persona', async () => {
    const auth = stubAuth();
    renderWithProviders(<SignInPage />, { state: { session: signedOut }, auth });
    const tebogo = await screen.findByRole('button', { name: /Sign in as Tebogo Molefe/ });
    expect(document.querySelector(`[data-marker="${DEMO_ACCOUNTS_MARKER}"]`)).not.toBeNull();
    await userEvent.click(tebogo);
    expect(auth.signIn).toHaveBeenCalledWith('tebogo.officer@tenderiq.local', 'test1234');
    const emails = DEMO_ACCOUNT_GROUPS.flatMap((group) =>
      group.accounts.map((account) => account.email),
    );
    expect(emails).toContain('sam.dual@tenderiq.local');
    expect(new Set(emails).size).toBe(emails.length);
  });

  it('explains an expired session', () => {
    renderWithProviders(<SignInPage />, {
      state: { session: { ...signedOut, signOutReason: 'expired' } },
    });
    expect(screen.getByText('Your session ended. Sign in again to continue.')).toBeInTheDocument();
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

describe('ForgotPasswordPage', () => {
  it('always confirms, whether or not the account exists', async () => {
    const auth = stubAuth();
    renderWithProviders(<ForgotPasswordPage />, { state: { session: signedOut }, auth });
    await userEvent.type(screen.getByLabelText(/Email address/), 'nobody@tenderiq.local');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(auth.requestPasswordReset).toHaveBeenCalledWith('nobody@tenderiq.local');
    expect(await screen.findByText('Check your email')).toBeInTheDocument();
  });
});

describe('ResetPasswordPage', () => {
  it('asks for a new link without a recovery session', () => {
    renderWithProviders(<ResetPasswordPage />, { state: { session: signedOut } });
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('validates and saves the new password in a recovery session', async () => {
    const auth = stubAuth({ recoverySession: true });
    renderWithProviders(<ResetPasswordPage />, { state: { session: signedOut }, auth });
    await userEvent.type(screen.getByLabelText(/^New password/), 'short');
    expect(
      screen.getByText('Use at least 8 characters.', { selector: '.tiq-field-error' }),
    ).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText(/^New password/));
    await userEvent.type(screen.getByLabelText(/^New password/), 'longenough1');
    await userEvent.type(screen.getByLabelText(/Confirm the new password/), 'longenough2');
    expect(screen.getByText('The two passwords do not match.')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText(/Confirm the new password/));
    await userEvent.type(screen.getByLabelText(/Confirm the new password/), 'longenough1');
    await userEvent.click(screen.getByRole('button', { name: 'Save the new password' }));
    expect(auth.updatePassword).toHaveBeenCalledWith('longenough1');
    await waitFor(() => expect(screen.getByText('Password changed')).toBeInTheDocument());
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
