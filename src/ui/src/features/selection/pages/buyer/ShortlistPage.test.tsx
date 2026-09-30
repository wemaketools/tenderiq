import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../../test/fetchMock';
import { shortlistDetail, tenderSummary } from '../../testing/data';
import { AUDITOR, OFFICER, renderSelection } from '../../testing/render';
import ShortlistPage from './ShortlistPage';

afterEach(() => vi.unstubAllGlobals());

const PATH = '/buyer/selection/shortlists/:shortlistId';
const ROUTE = '/buyer/selection/shortlists/9';

describe('ShortlistPage', () => {
  it('links the next stage that runs inside the same event instead of offering a new event (AC-22)', async () => {
    installFetch({
      'GET /api/v1/buyer/selection/shortlists/9': () => ({
        body: shortlistDetail({
          notifiedAt: '2026-08-25T07:00:00Z',
          nextStage: {
            tender: { tenderId: 9, reference: 'T-2026-0009', stageNo: 2 },
            createLink: null,
          },
        }),
      }),
      'GET /api/v1/buyer/selection/tenders/9': () => ({ body: tenderSummary() }),
    });
    renderSelection(<ShortlistPage />, { path: PATH, route: ROUTE, permissions: OFFICER });

    const sameEvent = await screen.findByText(/Stage 2 of the same event:/);
    expect(within(sameEvent).getByRole('link', { name: 'T-2026-0009' })).toHaveAttribute(
      'href',
      '/buyer/tenders/9',
    );
    expect(screen.queryByRole('link', { name: 'Create next-stage event' })).not.toBeInTheDocument();
  });

  it('issues outcome notices after the acknowledgement and reports what was sent (AC-22)', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/selection/shortlists/9': () => ({ body: shortlistDetail() }),
      'GET /api/v1/buyer/selection/tenders/9': () => ({ body: tenderSummary() }),
      'POST /api/v1/buyer/selection/shortlists/9/notify': () => ({
        body: {
          shortlist: shortlistDetail({ notifiedAt: '2026-09-25T08:00:00Z' }),
          outcomeNoticesIssued: 2,
          nextStageInvitationsIssued: 1,
        },
      }),
    });
    renderSelection(<ShortlistPage />, { path: PATH, route: ROUTE, permissions: OFFICER });

    expect(await screen.findByText('Next: issue outcome notices')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Issue outcome notices' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Issue outcome notices' }));

    expect(
      await screen.findByText('2 outcome notices and 1 next-stage invitations were issued.'),
    ).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      confirmed: true,
    });
  });

  it('blocks saving a draft that includes a candidate below the threshold', async () => {
    const draft = shortlistDetail({ status: 'draft', approval: null, approvedAt: null });
    installFetch({
      'GET /api/v1/buyer/selection/shortlists/9': () => ({ body: draft }),
      'GET /api/v1/buyer/selection/tenders/9': () => ({ body: tenderSummary() }),
    });
    renderSelection(<ShortlistPage />, { path: PATH, route: ROUTE, permissions: OFFICER });

    fireEvent.click(await screen.findByRole('button', { name: 'Record decisions' }));
    const includes = screen.getAllByRole('radio', { name: 'Included' });
    fireEvent.click(includes[1] as HTMLElement);
    expect(
      screen.getByText('Below the threshold: this candidate cannot be included.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
  });

  it('offers no command to a read-only auditor', async () => {
    installFetch({
      'GET /api/v1/buyer/selection/shortlists/9': () => ({ body: shortlistDetail() }),
      'GET /api/v1/buyer/selection/tenders/9': () => ({ body: tenderSummary() }),
    });
    renderSelection(<ShortlistPage />, { path: PATH, route: ROUTE, permissions: AUDITOR });
    await screen.findByRole('table', { name: 'Candidates and decisions' });
    expect(screen.queryByRole('button', { name: 'Issue outcome notices' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change shortlist' })).not.toBeInTheDocument();
  });
});
