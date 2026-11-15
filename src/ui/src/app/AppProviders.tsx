/**
 * The application providers, outermost first: the Redux store, authentication (prototype persona session,
 * /me/context, API client adapters, theme) and toasts. The router renders inside them.
 */
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';

import { AuthProvider } from '../auth/AuthProvider';
import { ToastProvider } from '../components/ui/ToastProvider';
import type { AppStore } from './store';

export function AppProviders({
  store,
  children,
}: {
  readonly store: AppStore;
  readonly children: ReactNode;
}) {
  return (
    <Provider store={store}>
      <AuthProvider store={store}>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </Provider>
  );
}
