import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { getMyTaskSummary } from '@contracts/tasks';
import { updateTheme } from '@contracts/session';

import { activeTenantSet } from '../app/slices/session';
import { installFetch, problem } from '../test/fetchMock';
import { makeTenant, signedInSession } from '../test/fixtures';
import { renderWithProviders } from '../test/render';
import { invalidateApiQueries, useApiMutation, useApiQuery } from './hooks';

function Summary() {
  const query = useApiQuery(getMyTaskSummary, {});
  if (query.status === 'loading') return <p>loading</p>;
  if (query.status === 'error') return <p>error {query.error?.status}</p>;
  return (
    <p>
      open {query.data?.open} {query.isFetching ? 'fetching' : 'idle'}
    </p>
  );
}

const summary = (open: number) => ({ open, overdue: 0, dueSoon: 0, byOrganization: [] });

describe('useApiQuery', () => {
  it('shows loading, then the data', async () => {
    installFetch({ 'GET /api/v1/me/task-summary': () => ({ body: summary(4) }) });
    renderWithProviders(<Summary />, { state: { session: signedInSession() } });
    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(await screen.findByText('open 4 idle')).toBeInTheDocument();
  });

  it('exposes the normalized error', async () => {
    installFetch({ 'GET /api/v1/me/task-summary': () => problem(403, 'Forbidden') });
    renderWithProviders(<Summary />, { state: { session: signedInSession() } });
    expect(await screen.findByText('error 403')).toBeInTheDocument();
  });

  it('drops data from the previous tenant when the active tenant changes', async () => {
    let open = 1;
    let release: (() => void) | null = null;
    installFetch({
      'GET /api/v1/me/task-summary': async () => {
        if (open > 1) {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        return { body: summary(open) };
      },
    });
    const { store } = renderWithProviders(<Summary />, { state: { session: signedInSession() } });
    expect(await screen.findByText('open 1 idle')).toBeInTheDocument();
    open = 2;
    act(() => {
      store.dispatch(
        activeTenantSet(makeTenant({ tenantId: 3, name: 'Okavango District Council' })),
      );
    });
    expect(screen.getByText('loading')).toBeInTheDocument();
    await waitFor(() => expect(release).not.toBeNull());
    act(() => release?.());
    expect(await screen.findByText('open 2 idle')).toBeInTheDocument();
  });

  it('re-runs when its endpoint is invalidated', async () => {
    let open = 1;
    installFetch({ 'GET /api/v1/me/task-summary': () => ({ body: summary(open) }) });
    renderWithProviders(<Summary />, { state: { session: signedInSession() } });
    expect(await screen.findByText('open 1 idle')).toBeInTheDocument();
    open = 5;
    act(() => invalidateApiQueries('me.tasks.'));
    expect(await screen.findByText('open 5 idle')).toBeInTheDocument();
  });
});

function ThemeButton() {
  const mutation = useApiMutation(updateTheme);
  return (
    <>
      <button
        type="button"
        disabled={mutation.pending}
        onClick={() => void mutation.mutate({ body: { theme: 'dark' } }).catch(() => undefined)}
      >
        save
      </button>
      {mutation.data !== undefined && <p>saved {mutation.data.theme}</p>}
      {mutation.error !== null && <p>failed {mutation.error.status}</p>}
    </>
  );
}

describe('useApiMutation', () => {
  it('disables while pending and keeps the response', async () => {
    installFetch({ 'PUT /api/v1/me/theme': () => ({ body: { theme: 'dark' } }) });
    renderWithProviders(<ThemeButton />, { state: { session: signedInSession() } });
    await userEvent.click(screen.getByRole('button', { name: 'save' }));
    expect(await screen.findByText('saved dark')).toBeInTheDocument();
  });

  it('keeps the error of a failed command', async () => {
    installFetch({ 'PUT /api/v1/me/theme': () => problem(500, 'Internal') });
    renderWithProviders(<ThemeButton />, { state: { session: signedInSession() } });
    await userEvent.click(screen.getByRole('button', { name: 'save' }));
    expect(await screen.findByText('failed 500')).toBeInTheDocument();
  });
});
