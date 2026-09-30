import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../test/fetchMock';
import { noticeDetail, overview } from '../test/data';
import { renderBuyer } from '../test/render';
import NoticePage from './NoticePage';

const OPTIONS = {
  route: '/buyer/awards/7/notices/55',
  path: '/buyer/awards/:tenderId/notices/:noticeId',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('NoticePage (BUY-28)', () => {
  it('re-sends a failed delivery and shows the recipient as delivered', async () => {
    const detail = noticeDetail();
    const failed = detail.recipients[1];
    installFetch({
      'GET /api/v1/buyer/awards/7': () => ({ body: overview() }),
      'GET /api/v1/buyer/outcome-notices/55': () => ({ body: detail }),
      'POST /api/v1/buyer/outcome-notices/55/recipients/552/resend': () => ({
        body: {
          noticeId: 55,
          recipient: {
            ...failed,
            deliveryStatus: 'delivered',
            deliveredAt: '2026-09-30T08:00:00Z',
            failureReason: null,
          },
        },
      }),
    });
    renderBuyer(<NoticePage />, OPTIONS);

    expect(await screen.findByText('Mailbox full')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Re-send' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Re-send' }),
    );

    expect(
      await screen.findByText('Notice re-sent to Limpopo Environmental Services.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Mailbox full')).not.toBeInTheDocument();
  });

  it('issues a draft only after the disclosure review is confirmed', async () => {
    const draft = noticeDetail({ status: 'draft', issuedAt: null, issuedBy: null });
    const { requests } = installFetch({
      'GET /api/v1/buyer/awards/7': () => ({ body: overview() }),
      'GET /api/v1/buyer/outcome-notices/55': () => ({ body: draft }),
      'POST /api/v1/buyer/outcome-notices/55/issue': () => ({
        body: noticeDetail({ status: 'issued' }),
      }),
    });
    renderBuyer(<NoticePage />, OPTIONS);

    expect(await screen.findByText('Draft — not issued')).toBeInTheDocument();
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Issue notice' })[0] as HTMLElement,
    );
    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Issue notice' });
    expect(confirm).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('checkbox'));
    await userEvent.click(confirm);

    expect(await screen.findByText('Notice issued.')).toBeInTheDocument();
    expect(requests.find((request) => request.path.endsWith('/issue'))?.body).toEqual({
      disclosureReviewed: true,
    });
  });
});
