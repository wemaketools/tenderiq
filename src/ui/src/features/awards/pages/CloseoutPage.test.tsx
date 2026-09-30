import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../test/fetchMock';
import { closeout, overview } from '../test/data';
import { renderBuyer } from '../test/render';
import CloseoutPage from './CloseoutPage';

const OPTIONS = { route: '/buyer/awards/1/closeout', path: '/buyer/awards/:tenderId/closeout' };
const T1 = { ...overview().tender, tenderId: 1, reference: 'T-2026-0001', title: 'Borehole pumps' };

afterEach(() => {
  vi.unstubAllGlobals();
});

function routes(state = closeout()) {
  return {
    'GET /api/v1/buyer/awards/1': () => ({ body: overview({ tender: T1 }) }),
    'GET /api/v1/buyer/awards/1/closeout': () => ({ body: state }),
    'GET /api/v1/buyer/tenders': () => ({ body: { items: [], total: 0, page: 1, pageSize: 100 } }),
  };
}

describe('CloseoutPage (BUY-30)', () => {
  it('keeps the unaccepted handover visible as a blocking reason (AC-29)', async () => {
    installFetch(routes());
    renderBuyer(<CloseoutPage />, OPTIONS);

    expect(await screen.findByText('1 condition blocks closure')).toBeInTheDocument();
    expect(
      screen.getAllByText('The handover of C-2026-0002 is not accepted.').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('1 handover not accepted')).toBeInTheDocument();
  });

  it('shows the refusal when closure is attempted before the handover is accepted', async () => {
    installFetch({
      ...routes(),
      'POST /api/v1/buyer/awards/1/closeout/close': () =>
        problem(409, 'Conflict', { code: 'HANDOVER_NOT_ACCEPTED', detail: 'Handover open.' }),
    });
    renderBuyer(<CloseoutPage />, OPTIONS);

    await userEvent.click(await screen.findByRole('button', { name: 'Close event' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('checkbox'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close event' }));

    expect(
      await within(dialog).findByText(
        'A contract handover is not accepted yet; the event cannot close.',
      ),
    ).toBeInTheDocument();
  });

  it('asks an information-only event for market findings and shows the linked next event (AC-39)', async () => {
    installFetch(
      routes(
        closeout({
          isInformationOnly: true,
          status: 'closed',
          contracts: [],
          lots: [],
          gate: [{ code: 'rfi_findings', status: 'passed', detail: null }],
          blockingReasons: [],
          marketFindings: 'Five responses; mature technology.',
          nextStepDecision: 'Proceed to a restricted RFP.',
          linkedNextTender: {
            tenderId: 9,
            reference: 'T-2026-0009',
            title: 'Acoustic leak detection',
          },
          closedAt: '2026-07-15T12:00:00Z',
          closedBy: { userId: 5, fullName: 'Tebogo Molefe' },
        }),
      ),
    );
    renderBuyer(<CloseoutPage />, OPTIONS);

    expect(await screen.findByText('Information-only event')).toBeInTheDocument();
    expect(screen.getByText('Five responses; mature technology.')).toBeInTheDocument();
    expect(screen.getByText('T-2026-0009')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
  });

  it('saves the closure record separately from closing', async () => {
    const { requests } = installFetch({
      ...routes(),
      'PUT /api/v1/buyer/awards/1/closeout': () => ({
        body: closeout({ lessonsLearned: 'Publish sizing templates.' }),
      }),
    });
    renderBuyer(<CloseoutPage />, OPTIONS);

    await userEvent.type(
      await screen.findByLabelText('Lessons learned'),
      'Publish sizing templates.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save record' }));

    expect(await screen.findByText('Closure record saved.')).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'PUT')?.body).toMatchObject({
      lessonsLearned: 'Publish sizing templates.',
      retentionClass: 'tender',
    });
  });
});
