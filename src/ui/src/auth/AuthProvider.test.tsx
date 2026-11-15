import { act, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAppSelector } from '../app/hooks';
import { createAppStore } from '../app/store';
import { installFetch, problem } from '../test/fetchMock';
import { makeContext, makeTenant, makeUser } from '../test/fixtures';
import { useAuth } from './authContext';
import { AuthProvider } from './AuthProvider';
import { currentPersona } from './prototypeSession';

const TEBOGO = 'tebogo.officer@tenderiq.local';
const STORAGE_KEY = 'tiq.prototype.persona';

function Probe() {
  const auth = useAuth();
  const status = useAppSelector((state) => state.session);
  return (
    <>
      <p data-testid="status">
        {status.authStatus} {status.contextStatus} {status.activeTenant?.name ?? 'none'}{' '}
        {status.signOutReason ?? '-'}
      </p>
      <button type="button" onClick={() => auth.signIn(TEBOGO)}>
        sign in
      </button>
      <button type="button" onClick={() => void auth.signOut()}>
        sign out
      </button>
    </>
  );
}

function renderProvider() {
  const store = createAppStore();
  render(
    <Provider store={store}>
      <AuthProvider store={store}>
        <Probe />
      </AuthProvider>
    </Provider>,
  );
  return store;
}

function contextRoutes() {
  return installFetch({
    'GET /api/v1/me/context': (request) => ({
      body: makeContext({
        user: makeUser({ theme: 'dark' }),
        activeTenant: request.search.includes('tenantId=2') ? makeTenant() : null,
      }),
    }),
  });
}

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('AuthProvider (prototype persona session, DD-50)', () => {
  it('signs in as the chosen persona, sends it as the token, enters the only organization and applies the theme', async () => {
    const { requests } = contextRoutes();
    renderProvider();
    expect(screen.getByTestId('status')).toHaveTextContent('signedOut');
    act(() => screen.getByRole('button', { name: 'sign in' }).click());
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent(
        'signedIn ready Kalahari Water Utilities (Pilot)',
      ),
    );
    expect(requests[0]?.headers.authorization).toBe(`Bearer ${TEBOGO}`);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe(TEBOGO);
  });

  it('restores the persona of this browser tab on load', async () => {
    contextRoutes();
    window.sessionStorage.setItem(STORAGE_KEY, TEBOGO);
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent(
        'signedIn ready Kalahari Water Utilities (Pilot)',
      ),
    );
  });

  it('signs out a persona the API refuses and says the sign-in was rejected', async () => {
    installFetch({ 'GET /api/v1/me/context': () => problem(401, 'Unauthenticated') });
    renderProvider();
    act(() => screen.getByRole('button', { name: 'sign in' }).click());
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('signedOut idle none rejected'),
    );
    expect(currentPersona()).toBeNull();
  });

  it('ends the session on request and forgets the persona', async () => {
    contextRoutes();
    renderProvider();
    act(() => screen.getByRole('button', { name: 'sign in' }).click());
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn ready'));
    act(() => screen.getByRole('button', { name: 'sign out' }).click());
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('signedOut idle none user'),
    );
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
