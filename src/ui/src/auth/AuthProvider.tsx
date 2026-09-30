/**
 * AuthProvider (brief §10, DD-43): owns the supabase-js session, keeps the Redux session slice in step with it,
 * loads /me/context after sign-in (restoring or selecting the organization), installs the API client adapters
 * (per-request token, active tenant, 401 → sign-out), and applies the user's theme to `<html data-theme>`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { configureApiClient } from '../api/client';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { bootstrapSession } from '../app/sessionActions';
import { authSignedIn, signedOut } from '../app/slices/session';
import type { SignOutReason } from '../app/slices/session';
import type { AppStore } from '../app/store';
import { readStoredTheme, storeTheme } from '../lib/storage';
import { AuthContext } from './authContext';
import type { AuthActions } from './authContext';
import { currentAccessToken, supabase } from './supabase';

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
  const [recoverySession, setRecoverySession] = useState(false);
  const signOutReason = useRef<SignOutReason | null>(null);
  const bootstrappedFor = useRef<string | null>(null);

  // API client adapters: token per request, active tenant from the store, 401 → sign-out.
  useEffect(
    () =>
      configureApiClient({
        getAccessToken: currentAccessToken,
        getActiveTenantId: () => store.getState().session.activeTenant?.tenantId ?? null,
        onUnauthorized: () => {
          if (store.getState().session.authStatus !== 'signedIn') {
            return;
          }
          const bootstrapping = store.getState().session.contextStatus !== 'ready';
          signOutReason.current = bootstrapping ? 'rejected' : 'expired';
          void supabase.auth.signOut({ scope: 'local' });
        },
      }),
    [store],
  );

  // Supabase session → session slice.
  useEffect(() => {
    const handle = (event: AuthChangeEvent, session: Session | null): void => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoverySession(true);
      }
      if (session === null) {
        bootstrappedFor.current = null;
        dispatch(signedOut(signOutReason.current ?? undefined));
        signOutReason.current = null;
        return;
      }
      if (event === 'TOKEN_REFRESHED') {
        return;
      }
      const userKey = session.user.id;
      if (bootstrappedFor.current === userKey) {
        return;
      }
      bootstrappedFor.current = userKey;
      dispatch(authSignedIn({ email: session.user.email ?? null }));
      // Never call Supabase from inside its own callback: defer the context load.
      window.setTimeout(() => {
        void dispatch(bootstrapSession());
      }, 0);
    };
    const { data } = supabase.auth.onAuthStateChange(handle);
    return () => data.subscription.unsubscribe();
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
      async signIn(email, password) {
        try {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          return { ok: error === null };
        } catch {
          return { ok: false };
        }
      },
      async signOut() {
        signOutReason.current = 'user';
        await supabase.auth.signOut({ scope: 'local' });
      },
      async requestPasswordReset(email) {
        try {
          await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
          });
        } catch {
          // The page shows the same confirmation either way (no account enumeration).
        }
      },
      async updatePassword(password) {
        try {
          const { error } = await supabase.auth.updateUser({ password });
          return { ok: error === null };
        } catch {
          return { ok: false };
        }
      },
      recoverySession,
      reloadContext() {
        void dispatch(bootstrapSession());
      },
    }),
    [dispatch, recoverySession],
  );

  return <AuthContext.Provider value={actions}>{children}</AuthContext.Provider>;
}
