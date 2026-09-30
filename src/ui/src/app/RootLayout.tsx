/**
 * The root route element: scroll restoration and the matched route.
 */
import { Outlet, ScrollRestoration } from 'react-router';

export function RootLayout() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  );
}
