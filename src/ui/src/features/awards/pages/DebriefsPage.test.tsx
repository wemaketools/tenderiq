import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch } from '../../../test/fetchMock';
import { debrief, debriefPage } from '../test/data';
import { renderBuyer } from '../test/render';
import DebriefPage from './DebriefPage';
import DebriefsPage from './DebriefsPage';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DebriefsPage (BUY-29)', () => {
  it('lists debrief requests with the official due date and status', async () => {
    installFetch({ 'GET /api/v1/buyer/debriefs': () => ({ body: debriefPage() }) });
    renderBuyer(<DebriefsPage />, { route: '/buyer/award-cases', path: '/buyer/award-cases' });

    expect((await screen.findAllByText('Limpopo Environmental Services')).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByTestId('official-deadline').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Complaints' })).toBeInTheDocument();
  });

  it('lays the filters, KPIs and table out in a spaced page', async () => {
    installFetch({ 'GET /api/v1/buyer/debriefs': () => ({ body: debriefPage() }) });
    renderBuyer(<DebriefsPage />, { route: '/buyer/award-cases', path: '/buyer/award-cases' });

    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading.closest('.tiq-page')).not.toBeNull();
  });
});

describe('DebriefPage (BUY-29)', () => {
  const OPTIONS = {
    route: '/buyer/award-cases/debriefs/82',
    path: '/buyer/award-cases/debriefs/:debriefId',
  };

  it('shows only the recipient’s own result against the criteria (AC-27)', async () => {
    installFetch({ 'GET /api/v1/buyer/debriefs/82': () => ({ body: debrief() }) });
    renderBuyer(<DebriefPage />, OPTIONS);

    expect(
      await screen.findByText('The debrief covers this supplier’s own result only'),
    ).toBeInTheDocument();
    expect(screen.getByText('15.40 of 25.00')).toBeInTheDocument();
  });

  it('validates the written debrief before providing it', async () => {
    const { requests } = installFetch({
      'GET /api/v1/buyer/debriefs/82': () => ({ body: debrief() }),
    });
    renderBuyer(<DebriefPage />, OPTIONS);

    await userEvent.click(await screen.findByRole('button', { name: 'Provide debrief' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/^Written debrief/), 'Too short');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Provide debrief' }));

    expect(await within(dialog).findByText('At least 20 characters.')).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'POST')).toBe(false);
  });

  it('hides debrief commands without debrief.manage', async () => {
    installFetch({ 'GET /api/v1/buyer/debriefs/82': () => ({ body: debrief() }) });
    renderBuyer(<DebriefPage />, { ...OPTIONS, permissions: ['audit.view'] });

    await screen.findByText('The debrief covers this supplier’s own result only');
    expect(screen.queryByRole('button', { name: 'Provide debrief' })).not.toBeInTheDocument();
  });
});
