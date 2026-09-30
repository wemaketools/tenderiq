/**
 * The authentication actions AuthProvider exposes. Session DATA (user, memberships, active tenant) lives in the
 * Redux session slice; this context only carries the supabase-js operations.
 */
import { createContext, useContext } from 'react';

export interface SignInResult {
  readonly ok: boolean;
}

export interface AuthActions {
  /** Email + password sign-in. Any failure yields `{ ok: false }` (one generic message, brief §5.7). */
  signIn(email: string, password: string): Promise<SignInResult>;
  /** Signs out of Supabase Auth; the session slice resets on the SIGNED_OUT event. */
  signOut(): Promise<void>;
  /** Sends the password-reset email (always resolves: the page never reveals whether the account exists). */
  requestPasswordReset(email: string): Promise<void>;
  /** Sets a new password during a recovery session. */
  updatePassword(password: string): Promise<{ readonly ok: boolean }>;
  /** True once a password-recovery link has produced a recovery session (on /reset-password). */
  readonly recoverySession: boolean;
  /** Retries loading /me/context after a failure. */
  reloadContext(): void;
}

export const AuthContext = createContext<AuthActions | null>(null);

export function useAuth(): AuthActions {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return value;
}
