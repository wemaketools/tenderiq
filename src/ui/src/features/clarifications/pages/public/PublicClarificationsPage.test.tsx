import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { initialSessionState } from '../../../../app/slices/session';
import { installFetch, problem } from '../../../../test/fetchMock';
import { renderWithProviders } from '../../../../test/render';
import { stateWith } from '../../../../test/fixtures';
import { publicEditionBody } from '../../testData';
import PublicClarificationsPage from './PublicClarificationsPage';

const P = '/api/v1/public/clarifications/kwu/T-2026-0002';

function render() {
  return renderWithProviders(<PublicClarificationsPage />, {
    state: stateWith(initialSessionState),
    route: '/clarifications/kwu/T-2026-0002',
    path: '/clarifications/:buyerSlug/:ref',
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PublicClarificationsPage (PUB-04)', () => {
  it('shows released answers and issued addenda with issue dates and affected lots, without identities', async () => {
    installFetch({ [`GET ${P}`]: () => ({ body: publicEditionBody() }) });
    render();

    expect(await screen.findByText('Are prepaid meters in scope?')).toBeInTheDocument();
    expect(
      screen.getByText('New mandatory requirement REQ-Q-05 and deadline extension'),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Issued 8 Oct 2026/).length).toBeGreaterThan(0);
    expect(screen.getByText('Lot 1')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Questions are shown without the identity of the organization that asked them.',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('official-deadline').length).toBeGreaterThan(0);
  });

  it('sends the search to the API', async () => {
    const { requests } = installFetch({ [`GET ${P}`]: () => ({ body: publicEditionBody() }) });
    render();
    await screen.findByText('Are prepaid meters in scope?');

    await userEvent.type(screen.getByRole('searchbox'), 'meters');

    await waitFor(() =>
      expect(requests.some((request) => request.search.includes('q=meters'))).toBe(true),
    );
  });

  it('downloads the edition as a text document', async () => {
    installFetch({ [`GET ${P}`]: () => ({ body: publicEditionBody() }) });
    const createObjectURL = vi.fn(() => 'blob:edition');
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    render();

    await userEvent.click(await screen.findByRole('button', { name: 'Download edition' }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('explains when the edition is not available', async () => {
    installFetch({ [`GET ${P}`]: () => problem(404, 'Not Found', { code: 'NOT_FOUND' }) });
    render();
    expect(
      await screen.findByText('This clarification edition is not available'),
    ).toBeInTheDocument();
  });
});
