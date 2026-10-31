import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PageSlotsContext } from '../../../components/ui';
import { installFetch } from '../../../test/fetchMock';
import { registerPage, registerRow } from '../test/data';
import { renderBuyer } from '../test/render';
import AwardRegisterPage from './AwardRegisterPage';
import CloseoutRegisterPage from './CloseoutRegisterPage';

const LIST = 'GET /api/v1/buyer/awards';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AwardRegisterPage (BUY-26)', () => {
  it('lists award files with lot progress, standstill deadline, holds and the next step', async () => {
    installFetch({ [LIST]: () => ({ body: registerPage() }) });
    renderBuyer(<AwardRegisterPage />, { route: '/buyer/awards', path: '/buyer/awards' });

    expect((await screen.findAllByText('T-2026-0007')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Resolve complaint').length).toBeGreaterThan(0);
    expect(screen.getByText(/1 hold/)).toBeInTheDocument();
    expect(screen.getByText('1 of 1 lots decided')).toBeInTheDocument();
    expect(screen.getAllByTestId('official-deadline').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('link', { name: 'Open T-2026-0007 Reservoir rehabilitation works' }),
    ).toHaveAttribute('href', '/buyer/awards/7');
  });

  it('labels a draft or pending value as recommended and never as awarded or decided (BR-31)', async () => {
    const draft = registerRow({
      tender: {
        ...registerRow().tender,
        tenderId: 3,
        reference: 'T-2026-0003',
        status: 'under_assessment',
      },
      lotsWithOutcome: 0,
      lotsWithProposedOutcome: 1,
      latestRecommendation: { recommendationId: 13, version: 1, status: 'draft' },
      value: {
        basis: 'recommended',
        total: { amount: '120000.00', currency: 'BWP' },
        finalAwardedTotal: { amount: '0.00', currency: 'BWP' },
      },
      standstillStatus: null,
      standstillEndsAt: null,
    });
    installFetch({ [LIST]: () => ({ body: registerPage([draft, registerRow()]) }) });
    renderBuyer(<AwardRegisterPage />, { route: '/buyer/awards', path: '/buyer/awards' });

    expect(await screen.findByText('1 of 1 lots proposed')).toBeInTheDocument();
    expect(screen.getByText('Recommended value (not an award)')).toBeInTheDocument();
    expect(screen.getByText('Intended award (not final)')).toBeInTheDocument();
    expect(screen.getByText('1 of 1 lots decided')).toBeInTheDocument();
    expect(screen.queryByText('Awarded total')).not.toBeInTheDocument();
  });

  it('sends the chosen tender status filter to the API from the filter disclosure', async () => {
    const { requests } = installFetch({ [LIST]: () => ({ body: registerPage() }) });
    renderBuyer(<AwardRegisterPage />, { route: '/buyer/awards', path: '/buyer/awards' });
    await screen.findAllByText('T-2026-0007');

    const toggle = screen.getByRole('button', { name: 'Filters' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.selectOptions(screen.getByLabelText('Tender status'), 'awarded');

    await waitFor(() =>
      expect(requests.some((request) => request.search.includes('status=awarded'))).toBe(true),
    );
  });

  it('heads the page with the plain label, shows the stage counts of the whole register and filters by a stage', async () => {
    const draft = registerRow({
      tender: { ...registerRow().tender, tenderId: 3, reference: 'T-2026-0003' },
      nextStep: 'await_recommendation_approval',
    });
    const { requests } = installFetch({
      [LIST]: () => ({ body: registerPage([draft, registerRow()]) }),
    });
    renderBuyer(
      <PageSlotsContext.Provider
        value={{ presentation: 'buyer', title: null, sectionAction: null }}
      >
        <AwardRegisterPage />
      </PageSlotsContext.Provider>,
      { route: '/buyer/awards', path: '/buyer/awards' },
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'From decision to done.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Awards', { selector: '.tiq-hero-eyebrow' })).toBeInTheDocument();
    const stages = screen.getByRole('list', { name: 'Stages' });
    const decision = await within(stages).findByRole('button', { name: /Decision: 1/ });
    expect(within(stages).getByRole('button', { name: /Standstill: 1/ })).toBeInTheDocument();
    expect(within(stages).getByRole('button', { name: /Ready: 0/ })).toBeInTheDocument();
    expect(decision).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(decision);
    expect(decision).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() =>
      expect(
        requests.some(
          (request) =>
            request.search.includes('nextStep=prepare_recommendation') &&
            request.search.includes('nextStep=await_recommendation_approval') &&
            !request.search.includes('nextStep=final_award'),
        ),
      ).toBe(true),
    );

    const before = requests.length;
    await userEvent.click(decision);
    expect(decision).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => expect(requests.length).toBeGreaterThan(before));
    expect(requests[requests.length - 1]?.search.includes('nextStep=')).toBe(false);
  });

  it('hides the stage counts when the register is larger than the overview page', async () => {
    installFetch({
      [LIST]: (request) =>
        request.search.includes('pageSize=100')
          ? { body: { ...registerPage(), total: 140 } }
          : { body: registerPage() },
    });
    renderBuyer(<AwardRegisterPage />, { route: '/buyer/awards', path: '/buyer/awards' });
    await screen.findAllByText('T-2026-0007');

    expect(
      await screen.findByText('Stage counts are shown once the whole register is loaded.'),
    ).toBeInTheDocument();
    const stages = screen.getByRole('list', { name: 'Stages' });
    expect(within(stages).queryByRole('button', { name: /Decision: / })).not.toBeInTheDocument();
    expect(within(stages).getByRole('button', { name: /^Decision/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('expands the award progress of a file from the row disclosure', async () => {
    installFetch({ [LIST]: () => ({ body: registerPage() }) });
    renderBuyer(<AwardRegisterPage />, { route: '/buyer/awards', path: '/buyer/awards' });
    await screen.findAllByText('T-2026-0007');

    const toggle = screen.getByRole('button', {
      name: 'Show details for Award progress of T-2026-0007',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: 'Award progress' })).not.toBeInTheDocument();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('region', { name: 'Award progress' });
    expect(toggle).toHaveAttribute('aria-controls', panel.id);
    const milestones = within(panel).getByRole('list', { name: 'Award progress of T-2026-0007' });
    const items = within(milestones).getAllByRole('listitem');
    expect(items.map((item) => item.getAttribute('data-state'))).toEqual([
      'done',
      'done',
      'done',
      'pending',
      'warning',
      'pending',
    ]);
    expect(within(milestones).getByText('Final award')).toBeInTheDocument();
    expect(within(milestones).getByText('1 hold')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Hide details for Award progress of T-2026-0007' }),
    );
    expect(screen.queryByRole('region', { name: 'Award progress' })).not.toBeInTheDocument();
  });

  it('shows the empty state when no tender is at the award stage', async () => {
    installFetch({ [LIST]: () => ({ body: { items: [], total: 0, page: 1, pageSize: 25 } }) });
    renderBuyer(<AwardRegisterPage />, { route: '/buyer/awards', path: '/buyer/awards' });
    expect(await screen.findByText('No tender has reached the award stage')).toBeInTheDocument();
  });
});

describe('CloseoutRegisterPage (BUY-30)', () => {
  it('asks the API for the closeout view instead of restricting the next step', async () => {
    const { requests } = installFetch({ [LIST]: () => ({ body: registerPage() }) });
    renderBuyer(<CloseoutRegisterPage />, { route: '/buyer/closeout', path: '/buyer/closeout' });

    expect(await screen.findByRole('heading', { name: 'Event closeout' })).toBeInTheDocument();
    await waitFor(() =>
      expect(requests.some((request) => request.search.includes('view=closeout'))).toBe(true),
    );
    expect(requests.some((request) => request.search.includes('nextStep='))).toBe(false);
    expect((await screen.findAllByText('In progress')).length).toBeGreaterThan(0);
  });

  it('lists a blocked closeout whose next step is still upstream, matching the blocked KPI (AC-29)', async () => {
    const blocked = registerRow({
      tender: { ...registerRow().tender, tenderId: 1, reference: 'T-2026-0001' },
      closeoutStatus: 'blocked',
      nextStep: 'prepare_recommendation',
    });
    installFetch({ [LIST]: () => ({ body: registerPage([blocked]) }) });
    renderBuyer(<CloseoutRegisterPage />, { route: '/buyer/closeout', path: '/buyer/closeout' });

    const [reference] = await screen.findAllByText('T-2026-0001');
    const row = reference?.closest('tr');
    expect(row).toBeInstanceOf(HTMLElement);
    expect(within(row as HTMLElement).getByText('Blocked')).toBeInTheDocument();
  });

  it('sends the chosen closeout status filter to the API', async () => {
    const { requests } = installFetch({ [LIST]: () => ({ body: registerPage() }) });
    renderBuyer(<CloseoutRegisterPage />, { route: '/buyer/closeout', path: '/buyer/closeout' });
    await screen.findAllByText('T-2026-0007');

    await userEvent.selectOptions(screen.getByLabelText('Closeout status'), 'blocked');

    await waitFor(() =>
      expect(requests.some((request) => request.search.includes('closeoutStatus=blocked'))).toBe(
        true,
      ),
    );
  });
});
