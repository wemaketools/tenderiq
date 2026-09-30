/**
 * Render helpers: a component inside the store, a stub AuthContext, toasts and a memory DATA router (so
 * `useBlocker`, links and navigation work), with the API client adapters wired to the store.
 */
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Provider } from 'react-redux';
import { RouterProvider, createMemoryRouter } from 'react-router';
import type { RouteObject } from 'react-router';
import { vi } from 'vitest';

import { configureApiClient } from '../api/client';
import { createAppStore } from '../app/store';
import type { AppStore, RootState } from '../app/store';
import { AuthContext } from '../auth/authContext';
import type { AuthActions } from '../auth/authContext';
import { ToastProvider } from '../components/ui/ToastProvider';

export function stubAuth(overrides: Partial<AuthActions> = {}): AuthActions {
  return {
    signIn: vi.fn(() => Promise.resolve({ ok: true })),
    signOut: vi.fn(() => Promise.resolve()),
    requestPasswordReset: vi.fn(() => Promise.resolve()),
    updatePassword: vi.fn(() => Promise.resolve({ ok: true })),
    recoverySession: false,
    reloadContext: vi.fn(),
    ...overrides,
  };
}

export interface RenderOptions {
  readonly state?: Partial<RootState>;
  readonly store?: AppStore;
  readonly route?: string;
  /** Extra routes next to the element (for navigation assertions). */
  readonly routes?: RouteObject[];
  /** The path pattern the element is mounted at (default `*`). */
  readonly path?: string;
  readonly auth?: AuthActions;
  readonly onUnauthorized?: () => void;
}

export function renderWithProviders(element: ReactElement, options: RenderOptions = {}) {
  const store = options.store ?? createAppStore(options.state);
  const auth = options.auth ?? stubAuth();
  const restore = configureApiClient({
    getAccessToken: () => Promise.resolve('test-token'),
    getActiveTenantId: () => store.getState().session.activeTenant?.tenantId ?? null,
    onUnauthorized: options.onUnauthorized ?? (() => undefined),
  });
  const router = createMemoryRouter(
    [{ path: options.path ?? '*', element }, ...(options.routes ?? [])],
    { initialEntries: [options.route ?? '/'] },
  );
  const result = render(
    <Provider store={store}>
      <AuthContext.Provider value={auth}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthContext.Provider>
    </Provider>,
  );
  return { ...result, store, router, auth, restore };
}

/** A route element that shows the current location (for redirect assertions). */
export function LocationProbe({ label }: { readonly label: string }) {
  return <p data-testid="location-probe">{label}</p>;
}
