import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { installFetch, problem } from '../../../test/fetchMock';
import { makeTenant, signedInSession } from '../../../test/fixtures';
import { renderWithProviders } from '../../../test/render';
import { list, sources } from '../test/data';
import { API, OFFICER, renderPage } from '../test/helpers';
import CreateTenderPage from './CreateTenderPage';

const SOURCES = 'GET /api/v1/buyer/tender-sources';

const created = {
  tender: {
    ...list.items[1],
    id: 900,
    reference: 'T-2026-0900',
    title: 'Pump station upgrade',
    status: 'draft',
  },
  provenance: { source: 'blank', sourceId: null, label: 'Blank form' },
  copiedSections: [],
  notCopied: sources.neverCopied,
  reviewRequired: [],
  link: '/buyer/tenders/900',
};

describe('CreateTenderPage (BUY-07)', () => {
  it('lists what reuse never copies when the sources are loaded', async () => {
    installFetch({ [SOURCES]: () => ({ body: sources }) });

    renderPage(<CreateTenderPage />, { route: '/buyer/tenders/new' });

    const never = await screen.findByTestId('never-copied');
    expect(within(never).getByText('Bids')).toBeInTheDocument();
    expect(within(never).getByText('Approvals')).toBeInTheDocument();
  });

  it('shows validation messages and sends nothing when a blank tender is incomplete', async () => {
    const { requests } = installFetch({ [SOURCES]: () => ({ body: sources }) });
    renderPage(<CreateTenderPage />, { route: '/buyer/tenders/new' });
    await userEvent.click(await screen.findByLabelText(/A blank form/));

    await userEvent.click(screen.getByRole('button', { name: 'Create draft tender' }));

    expect(screen.getByText('A title is required.')).toBeInTheDocument();
    expect(screen.getAllByText('Required.').length).toBeGreaterThan(0);
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(0);
  });

  it('creates a blank draft through the confirmation dialog and shows the result', async () => {
    const { requests } = installFetch({
      [SOURCES]: () => ({ body: sources }),
      [`POST ${API}`]: () => ({ status: 201, body: created }),
    });
    renderPage(<CreateTenderPage />, { route: '/buyer/tenders/new' });
    await userEvent.click(await screen.findByLabelText(/A blank form/));
    await userEvent.type(screen.getByLabelText(/^Title/), 'Pump station upgrade');
    await userEvent.selectOptions(screen.getByLabelText(/^Event type/), 'rfq');
    await userEvent.selectOptions(screen.getByLabelText(/^Procedure/), 'open');
    await userEvent.selectOptions(screen.getByLabelText(/^Participation/), 'open');

    await userEvent.click(screen.getByRole('button', { name: 'Create draft tender' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Kalahari Water Utilities (Pilot)')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create draft tender' }));

    expect(await screen.findByText('T-2026-0900 created as a draft')).toBeInTheDocument();
    const post = requests.find((request) => request.method === 'POST');
    expect(post?.body).toMatchObject({
      source: 'blank',
      title: 'Pump station upgrade',
      eventType: 'rfq',
    });
  });

  it('makes the buyer choose the estimate currency when the organization has no default', async () => {
    // Arrange
    const { requests } = installFetch({
      [SOURCES]: () => ({
        body: { ...sources, defaultCurrency: null, currencies: ['ZAR', 'USD'] },
      }),
      [`POST ${API}`]: () => ({ status: 201, body: created }),
    });
    renderWithProviders(<CreateTenderPage />, {
      route: '/buyer/tenders/new',
      state: {
        session: signedInSession({
          activeTenant: makeTenant({ defaultCurrency: null }, OFFICER),
        }),
      },
    });
    await userEvent.click(await screen.findByLabelText(/A blank form/));
    expect(screen.getByLabelText(/^Estimated value/)).toBeDisabled();

    // Act
    await userEvent.selectOptions(screen.getByLabelText(/^Currency of the estimate/), 'ZAR');
    await userEvent.type(screen.getByLabelText(/^Estimated value/), '250000');
    await userEvent.type(screen.getByLabelText(/^Title/), 'Pump station upgrade');
    await userEvent.selectOptions(screen.getByLabelText(/^Event type/), 'rfq');
    await userEvent.selectOptions(screen.getByLabelText(/^Procedure/), 'open');
    await userEvent.selectOptions(screen.getByLabelText(/^Participation/), 'open');
    await userEvent.click(screen.getByRole('button', { name: 'Create draft tender' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create draft tender' }));

    // Assert
    expect(await screen.findByText('T-2026-0900 created as a draft')).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'POST')?.body).toMatchObject({
      estimatedValue: { amount: '250000', currency: 'ZAR' },
    });
  });

  it('prices the estimate in the organization default currency when one is configured', async () => {
    installFetch({ [SOURCES]: () => ({ body: sources }) });
    renderPage(<CreateTenderPage />, { route: '/buyer/tenders/new' });

    await userEvent.click(await screen.findByLabelText(/A blank form/));

    expect(screen.getByLabelText(/^Estimated value/)).toBeEnabled();
    expect(screen.queryByLabelText(/^Currency of the estimate/)).not.toBeInTheDocument();
  });

  it('shows the business message when the chosen template is refused', async () => {
    installFetch({
      [SOURCES]: () => ({ body: sources }),
      [`POST ${API}`]: () => problem(409, 'Conflict', { code: 'TEMPLATE_NOT_APPROVED' }),
    });
    renderPage(<CreateTenderPage />, { route: '/buyer/tenders/new' });
    await userEvent.click(await screen.findByLabelText(/An approved template/));
    const usable = sources.templates.find((row) => row.usable);
    expect(usable).toBeDefined();
    await userEvent.click(
      screen.getByLabelText(new RegExp((usable?.name ?? 'none').replace(/[()]/g, '.'))),
    );
    await userEvent.type(screen.getByLabelText(/^Title/), 'From template');

    await userEvent.click(screen.getByRole('button', { name: 'Create draft tender' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create draft tender' }));

    expect(
      await screen.findByText('Only approved, current templates can be used for new events.'),
    ).toBeInTheDocument();
  });
});
