import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../../test/fetchMock';
import { page, shortlistDetail, tenderRow, tenderSummary } from '../../testing/data';
import { renderSelection } from '../../testing/render';
import ShortlistFormPage from './ShortlistFormPage';

afterEach(() => vi.unstubAllGlobals());

const PATH = '/buyer/selection/shortlists/new';

describe('ShortlistFormPage', () => {
  it('validates the rule and rationale before saving', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/selection/tenders': () => ({ body: page([tenderRow()]) }),
      'GET /api/v1/buyer/selection/tenders/9': () => ({ body: tenderSummary() }),
    });
    renderSelection(<ShortlistFormPage />, { path: PATH, route: `${PATH}?tenderId=9` });
    await screen.findByRole('table', { name: 'Eligible candidates' });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findAllByText('This field is required.')).toHaveLength(2);
    expect(requests.some((request) => request.method === 'POST')).toBe(false);
  });

  it('saves the shortlist as a draft and opens it', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/selection/tenders': () => ({ body: page([tenderRow()]) }),
      'GET /api/v1/buyer/selection/tenders/9': () => ({ body: tenderSummary() }),
      'POST /api/v1/buyer/selection/shortlists': () => ({
        status: 201,
        body: shortlistDetail({ shortlistId: 9001, status: 'draft', entries: [] }),
      }),
    });
    const { router } = renderSelection(<ShortlistFormPage />, {
      path: PATH,
      route: `${PATH}?tenderId=9`,
    });
    await screen.findByRole('table', { name: 'Eligible candidates' });
    fireEvent.change(screen.getByLabelText(/Non-price threshold/), { target: { value: '49' } });
    fireEvent.change(screen.getByLabelText(/Selection rule/), { target: { value: 'Top two.' } });
    fireEvent.change(screen.getByLabelText(/^Rationale/), {
      target: { value: 'Scores moderated.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe('/buyer/selection/shortlists/9001'),
    );
    expect(requests.find((request) => request.method === 'POST')?.body).toMatchObject({
      tenderId: 9,
      stageNo: 1,
      threshold: '49',
    });
  });
});
