import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { installFetch, problem } from '../../../test/fetchMock';
import { plans12, plans5, tender12, tender5 } from '../test/data';
import { API, MANAGER, changeImpact, renderPage } from '../test/helpers';
import EvaluationPlanPage from './EvaluationPlanPage';

const PATH = '/buyer/tenders/:tenderId/evaluation';

describe('EvaluationPlanPage (BUY-11)', () => {
  it('shows the weights validation message and the blocking plan issues when weights total 95', async () => {
    installFetch({
      [`GET ${API}/12`]: () => ({ body: tender12 }),
      [`GET ${API}/12/evaluation-plans`]: () => ({ body: plans12 }),
    });

    renderPage(<EvaluationPlanPage />, { route: '/buyer/tenders/12/evaluation', path: PATH });

    expect(
      (await screen.findAllByText(/Weights total 95.*the top-level criteria must total 100\./))
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Blocking').length).toBeGreaterThan(0);
  });

  it('keeps an invalid plan in the editor with the contract messages when saving', async () => {
    const { requests } = installFetch({
      [`GET ${API}/12`]: () => ({ body: tender12 }),
      [`GET ${API}/12/evaluation-plans`]: () => ({ body: plans12 }),
    });
    renderPage(<EvaluationPlanPage />, { route: '/buyer/tenders/12/evaluation', path: PATH });

    await userEvent.click(await screen.findByRole('button', { name: 'Edit plan' }));
    const editor = screen.getByTestId('plan-editor');
    await userEvent.click(within(editor).getByRole('button', { name: 'Save draft' }));

    expect(
      within(editor).getByText('Declare this price treatment before release (PRD §9.3).'),
    ).toBeInTheDocument();
    expect(within(editor).getByText('Set the threshold for the chosen scope.')).toBeInTheDocument();
    expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(0);
  });

  it('saves a corrected plan and shows the returned version', async () => {
    const plan = plans12.plans[0];
    const { requests } = installFetch({
      [`GET ${API}/12`]: () => ({ body: tender12 }),
      [`GET ${API}/12/evaluation-plans`]: () => ({ body: plans12 }),
      [`PUT ${API}/12/evaluation-plans/${plan?.id}`]: () => ({
        body: {
          plan: { ...plan, version: 2, weightsTotal: '100.00', issues: [] },
          change: changeImpact(false),
        },
      }),
    });
    renderPage(<EvaluationPlanPage />, { route: '/buyer/tenders/12/evaluation', path: PATH });
    await userEvent.click(await screen.findByRole('button', { name: 'Edit plan' }));
    const editor = screen.getByTestId('plan-editor');

    const points = within(editor).getAllByLabelText(/^Points/);
    await userEvent.clear(points[1] as HTMLElement);
    await userEvent.type(points[1] as HTMLElement, '30');
    await userEvent.type(within(editor).getByLabelText(/^Threshold$/), '35');
    await userEvent.type(
      within(editor).getByLabelText(/^Missing price treatment/),
      'Not comparable.',
    );
    await userEvent.click(within(editor).getByRole('button', { name: 'Add tie rule' }));
    await userEvent.click(within(editor).getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByText('Evaluation plan saved as version 2.')).toBeInTheDocument();
    const put = requests.find((request) => request.method === 'PUT');
    expect(put?.body).toMatchObject({ expectedVersion: 1, nonPriceThreshold: '35' });
  });

  it('binds the API 422 weights error to the criteria when the server refuses the plan', async () => {
    const plan = plans5.plans[0];
    installFetch({
      [`GET ${API}/5`]: () => ({ body: tender5 }),
      [`GET ${API}/5/evaluation-plans`]: () => ({ body: plans5 }),
      [`PUT ${API}/5/evaluation-plans/${plan?.id}`]: () =>
        problem(422, 'Validation failed', {
          code: 'VALIDATION_FAILED',
          errors: [
            {
              field: 'criteria',
              code: 'WEIGHTS_TOTAL_NOT_100',
              message: 'Weights total 99; the top-level criteria must total 100.',
            },
          ],
        }),
    });
    renderPage(<EvaluationPlanPage />, {
      route: '/buyer/tenders/5/evaluation',
      path: PATH,
      permissions: MANAGER,
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Amend plan' }));
    const editor = screen.getByTestId('plan-editor');
    await userEvent.type(within(editor).getByLabelText(/^Amendment note/), 'Clarify price basis.');
    await userEvent.click(within(editor).getByRole('button', { name: 'Save amendment' }));

    expect(
      await within(editor).findByText('Weights total 99; the top-level criteria must total 100.'),
    ).toBeInTheDocument();
  });

  it('shows the approved plan without an approve action to a release approver', async () => {
    installFetch({
      [`GET ${API}/5`]: () => ({ body: tender5 }),
      [`GET ${API}/5/evaluation-plans`]: () => ({ body: plans5 }),
    });

    renderPage(<EvaluationPlanPage />, {
      route: '/buyer/tenders/5/evaluation',
      path: PATH,
      permissions: MANAGER,
    });

    expect(await screen.findByText('Mpho Dikgang', { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve plan' })).not.toBeInTheDocument();
  });
});
