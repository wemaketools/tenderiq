import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext } from '../auth/authContext';
import { ToastProvider } from '../components/ui/ToastProvider';
import { PageHeader } from '../components/ui/PageHeader';
import { installFetch } from '../test/fetchMock';
import { signedInSession } from '../test/fixtures';
import { stubAuth } from '../test/render';
import type { FeatureModule } from './featureRegistry';
import { buildRoutes } from './router';
import { initialSessionState } from './slices/session';
import { createAppStore } from './store';
import type { RootState } from './store';

function TendersPage() {
  return <PageHeader title="Tenders" subtitle="All tenders" />;
}

const modules: FeatureModule[] = [
  {
    id: 'tenders',
    area: 'buyer',
    routes: [
      { path: 'tenders', element: <TendersPage /> },
      { path: 'secret', element: <p>secret</p>, permission: 'evaluation.chair' },
      {
        path: 'offline',
        load: () =>
          Promise.reject(
            new TypeError('Failed to fetch dynamically imported module: http://x/Offline.tsx'),
          ),
      },
    ],
    nav: [
      {
        id: 'buyer.tenders',
        label: 'Tenders',
        path: 'tenders',
        section: 'sourcing',
        order: 1,
        icon: 'fileText',
      },
    ],
  },
];

function renderAt(path: string, state: Partial<RootState>) {
  installFetch({});
  const store = createAppStore(state);
  const router = createMemoryRouter(buildRoutes(modules), { initialEntries: [path] });
  render(
    <Provider store={store}>
      <AuthContext.Provider value={stubAuth()}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthContext.Provider>
    </Provider>,
  );
  return router;
}

describe('router', () => {
  it('mounts a feature page inside the app shell with its title in the top bar', async () => {
    renderAt('/buyer/tenders', { session: signedInSession() });
    expect(await screen.findByRole('heading', { level: 1, name: 'Tenders' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tenders' })).toHaveAttribute('href', '/buyer/tenders');
    expect(screen.getByTestId('prototype-banner')).toHaveTextContent(
      'Prototype — static demo data',
    );
  });

  it('opens the first destination when the area root has no page of its own', async () => {
    const router = renderAt('/buyer', { session: signedInSession() });
    expect(await screen.findByText('All tenders')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/buyer/tenders');
  });

  it('guards feature routes that need a permission', async () => {
    renderAt('/buyer/secret', { session: signedInSession() });
    expect(
      await screen.findByText(/do not have the permission this page needs/),
    ).toBeInTheDocument();
  });

  it('sends a visitor from the root to sign-in when no public home is registered', async () => {
    const router = renderAt('/', { session: { ...initialSessionState, authStatus: 'signedOut' } });
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/signin');
  });

  it('renders Not found for unknown addresses, inside the shell for area paths', async () => {
    renderAt('/nowhere', { session: { ...initialSessionState, authStatus: 'signedOut' } });
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('keeps unknown area paths inside the shell', async () => {
    renderAt('/buyer/unknown', { session: signedInSession() });
    expect(
      await screen.findByText('The address may be mistyped, or the page may have moved.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('renders a page module that failed to load as a reload prompt inside the shell', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderAt('/buyer/offline', { session: signedInSession() });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'This page could not be loaded' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
