/**
 * SPA entry point: global styles (tokens, components, self-hosted fonts), the providers and the router.
 */
import './zodConfig';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import './theme/index.css';
import { AppProviders } from './app/AppProviders';
import { createAppRouter } from './app/router';
import { store } from './app/store';
import { readStoredTheme } from './lib/storage';

document.documentElement.dataset.theme = readStoredTheme() ?? 'light';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('index.html must contain <div id="root">.');
}

const router = createAppRouter();

createRoot(container).render(
  <StrictMode>
    <AppProviders store={store}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
