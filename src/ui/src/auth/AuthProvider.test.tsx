import { act, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { useAppSelector } from '../app/hooks';
import { createAppStore } from '../app/store';
import { installFetch, problem } from '../test/fetchMock';
import { makeContext, makeTenant, makeUser } from '../test/fixtures';
import { useAuth } from './authContext';
import { AuthProvider } from './AuthProvider';

type Listener = (event: AuthChangeEvent, session: Session | null) => void;

const mocks = vi.hoisted(() => ({
  listeners: [] as Array<(event: string, session: unknown) => void>,
  signOut: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (listener: (event: string, session: unknown) => void) => {
        mocks.listeners.push(listener);
        return { data: { subscription: { unsubscribe: () => undefined } } };
      },
      signOut: mocks.signOut,
      signInWithPassword: mocks.signInWithPassword,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      updateUser: mocks.updateUser,
    },
  },
  currentAccessToken: () => Promise.resolve('jwt-from-session'),
}));

function emit(event: AuthChangeEvent, session: Session | null): void {
  for (const listener of mocks.listeners as Listener[]) listener(event, session);
}

const session = {
  access_token: 'jwt',
  user: { id: 'auth-1', email: 'tebogo.officer@tenderiq.local' },
} as unknown as Session;

function Probe() {
  const auth = useAuth();
  const status = useAppSelector((state) => state.session);
  return (
    <>
      <p data-testid="status">
        {status.authStatus} {status.contextStatus} {status.activeTenant?.name ?? 'none'}{' '}
        {status.signOutReason ?? '-'}
      </p>
      <button type="button" onClick={() => void auth.signIn('a@b.c', 'pw')}>
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

beforeEach(() => {
  mocks.listeners.length = 0;
  mocks.signOut.mockReset().mockImplementation(() => {
    emit('SIGNED_OUT', null);
    return Promise.resolve({ error: null });
  });
  mocks.signInWithPassword.mockReset().mockResolvedValue({ error: null });
});

describe('AuthProvider', () => {
  it('loads /me/context with the session token, enters the only organization and applies the theme', async () => {
    const { requests } = installFetch({
      'GET /api/v1/me/context': (request) => ({
        body: makeContext({
          user: makeUser({ theme: 'dark' }),
          activeTenant: request.search.includes('tenantId=2') ? makeTenant() : null,
        }),
      }),
    });
    renderProvider();
    act(() => emit('INITIAL_SESSION', session));
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent(
        'signedIn ready Kalahari Water Utilities (Pilot)',
      ),
    );
    expect(requests[0]?.headers.authorization).toBe('Bearer jwt-from-session');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('signs out an account the API does not know and says the sign-in was rejected', async () => {
    installFetch({ 'GET /api/v1/me/context': () => problem(401, 'Unauthenticated') });
    renderProvider();
    act(() => emit('SIGNED_IN', session));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' }));
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('signedOut idle none rejected'),
    );
  });

  it('reports a failed sign-in as a single generic result and signs out on request', async () => {
    installFetch({});
    mocks.signInWithPassword.mockResolvedValue({ error: new Error('Invalid login credentials') });
    renderProvider();
    act(() => emit('INITIAL_SESSION', null));
    expect(screen.getByTestId('status')).toHaveTextContent('signedOut');
    act(() => screen.getByRole('button', { name: 'sign in' }).click());
    await waitFor(() =>
      expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.c', password: 'pw' }),
    );
    act(() => screen.getByRole('button', { name: 'sign out' }).click());
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('signedOut idle none user'),
    );
  });
});
