/**
 * The authentication actions AuthProvider exposes. Session DATA (user, memberships, active tenant) lives in the
 * Redux session slice; this context only carries the prototype session operations (DD-50).
 */
import { createContext, useContext } from 'react';

export interface AuthActions {
  /** Signs in as a demo persona (its e-mail); the session slice follows once /me/context loads. */
  signIn(email: string): void;
  /** Ends the session; the session slice resets. */
  signOut(): Promise<void>;
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
