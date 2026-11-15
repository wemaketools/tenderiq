/**
 * AuthProvider (brief §10, DD-50): owns the prototype persona session, keeps the Redux session slice in step with it,
 * loads /me/context after sign-in (restoring or selecting the organization), installs the API client adapters
 * (per-request token, active tenant, 401 → sign-out), and applies the user's theme to `<html data-theme>`.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';

import { configureApiClient } from '../api/client';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { bootstrapSession } from '../app/sessionActions';
import { authSignedIn, signedOut } from '../app/slices/session';
import type { SignOutReason } from '../app/slices/session';
import type { AppStore } from '../app/store';
import { readStoredTheme, storeTheme } from '../lib/storage';
import { AuthContext } from './authContext';
import type { AuthActions } from './authContext';
import {
  currentPersona,
  endPersonaSession,
  onPersonaSessionChange,
  startPersonaSession,
} from './prototypeSession';

export interface AuthProviderProps {
  readonly store: AppStore;
  readonly children: ReactNode;
}

function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = theme;
}

export function AuthProvider({ store, children }: AuthProviderProps) {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((state) => state.session.user?.theme ?? null);
  const signOutReason = useRef<SignOutReason | null>(null);
  const bootstrappedFor = useRef<string | null>(null);

  // API client adapters: the persona as the token, active tenant from the store, 401 → sign-out.
  useEffect(
    () =>
      configureApiClient({
        getAccessToken: () => Promise.resolve(currentPersona()),
        getActiveTenantId: () => store.getState().session.activeTenant?.tenantId ?? null,
        onUnauthorized: () => {
          if (store.getState().session.authStatus !== 'signedIn') {
            return;
          }
          const bootstrapping = store.getState().session.contextStatus !== 'ready';
          signOutReason.current = bootstrapping ? 'rejected' : 'expired';
          endPersonaSession();
        },
      }),
    [store],
  );

  // Persona session → session slice (the stored session first, then every change).
  useEffect(() => {
    const handle = (email: string | null): void => {
      if (email === null) {
        bootstrappedFor.current = null;
        dispatch(signedOut(signOutReason.current ?? undefined));
        signOutReason.current = null;
        return;
      }
      if (bootstrappedFor.current === email) {
        return;
      }
      bootstrappedFor.current = email;
      dispatch(authSignedIn({ email }));
      void dispatch(bootstrapSession());
    };
    const unsubscribe = onPersonaSessionChange(handle);
    handle(currentPersona());
    return unsubscribe;
  }, [dispatch]);

  // Theme: the user's preference once known, otherwise the last applied one.
  useEffect(() => {
    const next = theme ?? readStoredTheme() ?? 'light';
    applyTheme(next);
    if (theme !== null) {
      storeTheme(theme);
    }
  }, [theme]);

  const actions = useMemo<AuthActions>(
    () => ({
      signIn(email) {
        signOutReason.current = null;
        startPersonaSession(email);
      },
      signOut() {
        signOutReason.current = 'user';
        endPersonaSession();
        return Promise.resolve();
      },
      reloadContext() {
        void dispatch(bootstrapSession());
      },
    }),
    [dispatch],
  );

  return <AuthContext.Provider value={actions}>{children}</AuthContext.Provider>;
}
