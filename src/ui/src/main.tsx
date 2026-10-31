/**
 * SPA entry point: global styles (tokens, components, self-hosted fonts), the API transport, the providers and the
 * router. In the Stage A prototype the API runs in the browser (DD-50).
 */
import './zodConfig';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import './theme/index.css';
import { configureApiTransport } from './api/client';
import { prototypeTransport } from './api/prototypeTransport';
import { AppProviders } from './app/AppProviders';
import { createAppRouter } from './app/router';
import { store } from './app/store';
import { readStoredTheme } from './lib/storage';

document.documentElement.dataset.theme = readStoredTheme() ?? 'light';
configureApiTransport(prototypeTransport);

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
