import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter, data } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RouteErrorPage } from './RouteErrorPage';
import { isChunkLoadError } from './chunkLoadError';

function renderFailing(error: unknown, onReload?: () => void) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        loader: () => {
          throw error;
        },
        element: <p>loaded</p>,
        errorElement: <RouteErrorPage onReload={onReload} />,
      },
    ],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
}

describe('RouteErrorPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('recognizes page module load failures from every major browser and nothing else', () => {
    expect(
      isChunkLoadError(
        new TypeError('Failed to fetch dynamically imported module: http://x/a.tsx'),
      ),
    ).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false);
  });

  it('asks for a reload when a page module could not be fetched, and reloads on request', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onReload = vi.fn();
    renderFailing(
      new TypeError('Failed to fetch dynamically imported module: http://x/a.tsx'),
      onReload,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'This page could not be loaded' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reload the page' }));

    expect(onReload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Go to the start page' })).toHaveAttribute('href', '/');
  });

  it('shows a sanitized message for an unexpected error without the raw error text', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderFailing(new Error('secret internal detail'));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Something went wrong' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/secret internal detail/)).not.toBeInTheDocument();
    expect(document.querySelector('pre')).toBeNull();
  });

  it('renders Not found for a thrown 404 response', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderFailing(data(null, { status: 404 }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();
  });
});
