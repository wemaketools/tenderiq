import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../test/fetchMock';
import { publicAward, publicAwardPage } from '../../awards/test/data';
import { renderPublic } from '../../awards/test/render';
import PublicAwardPage from './PublicAwardPage';
import PublicAwardsPage from './PublicAwardsPage';

const DETAIL = '/api/v1/public/awards/kwu/T-2026-0001';
const OPTIONS = { route: '/awards/kwu/T-2026-0001', path: '/awards/:buyerSlug/:reference' };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PublicAwardsPage (PUB-05)', () => {
  it('lists published awards with suppliers and disclosed values', async () => {
    installFetch({ 'GET /api/v1/public/awards': () => ({ body: publicAwardPage() }) });
    renderPublic(<PublicAwardsPage />, { route: '/awards', path: '/awards' });

    expect((await screen.findAllByText('T-2026-0001')).length).toBeGreaterThan(0);
    expect(screen.getByText('Tsodilo Engineering')).toBeInTheDocument();
    expect(screen.getByText('BWP 5,340,000')).toBeInTheDocument();
  });

  it('sends the search to the API', async () => {
    const { requests } = installFetch({
      'GET /api/v1/public/awards': () => ({ body: publicAwardPage() }),
    });
    renderPublic(<PublicAwardsPage />, { route: '/awards', path: '/awards' });
    await screen.findAllByText('T-2026-0001');

    await userEvent.type(screen.getByRole('searchbox'), 'pump');

    await waitFor(() =>
      expect(requests.some((request) => request.search.includes('q=pump'))).toBe(true),
    );
  });
});

describe('PublicAwardPage (PUB-05)', () => {
  it('shows the awarded lots, the explanation and that publication is not a contract', async () => {
    installFetch({ [`GET ${DETAIL}`]: () => ({ body: publicAward() }) });
    renderPublic(<PublicAwardPage />, OPTIONS);

    expect(
      await screen.findByText('Lot 1 was awarded to Tsodilo Engineering; lot 2 was cancelled.'),
    ).toBeInTheDocument();
    expect(screen.getByText('An award notice is not a signed contract')).toBeInTheDocument();
  });

  it('downloads the approved public notice', async () => {
    installFetch({
      [`GET ${DETAIL}`]: () => ({ body: publicAward() }),
      [`GET ${DETAIL}/notice`]: () => ({
        body: { fileName: 'notice.txt', contentType: 'text/plain', content: 'Award notice.' },
      }),
    });
    const createObjectURL = vi.fn(() => 'blob:notice');
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    renderPublic(<PublicAwardPage />, OPTIONS);

    await userEvent.click(await screen.findByRole('button', { name: 'Download notice' }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('explains when the notice is not published', async () => {
    installFetch({ [`GET ${DETAIL}`]: () => problem(404, 'Not Found', { code: 'NOT_FOUND' }) });
    renderPublic(<PublicAwardPage />, OPTIONS);
    expect(await screen.findByRole('button', { name: /Try again|Retry/ })).toBeInTheDocument();
  });
});
