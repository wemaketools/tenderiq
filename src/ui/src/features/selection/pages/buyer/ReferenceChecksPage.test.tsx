import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installFetch, problem } from '../../../../test/fetchMock';
import type { MockHandler } from '../../../../test/fetchMock';
import { setDateTime } from '../../testing/interact';
import { page, referenceCheck, tenderRow, tenderSummary } from '../../testing/data';
import { OFFICER, renderSelection } from '../../testing/render';
import ReferenceChecksPage from './ReferenceChecksPage';

afterEach(() => vi.unstubAllGlobals());

const PATH = '/buyer/selection/references';

function routes(
  feedback: MockHandler = () => ({
    body: referenceCheck({ outcome: 'Verified.', feedback: 'Good work.' }),
  }),
) {
  return {
    'GET /api/v1/buyer/selection/reference-checks': () => ({
      body: page([
        referenceCheck(),
        referenceCheck({
          referenceCheckId: 2,
          refereeName: 'Naledi Ramotswe',
          consentConfirmed: false,
        }),
        referenceCheck({
          referenceCheckId: 3,
          refereeName: 'Kabo Seane',
          confidential: true,
          feedbackRestricted: true,
        }),
      ]),
    }),
    'GET /api/v1/buyer/selection/tenders': () => ({ body: page([tenderRow()]) }),
    'GET /api/v1/buyer/selection/tenders/9': () => ({ body: tenderSummary() }),
    'POST /api/v1/buyer/selection/reference-checks/1/feedback': feedback,
  };
}

describe('ReferenceChecksPage', () => {
  it('shows consent, a dash with the confidential chip for unreadable feedback and a consent requirement', async () => {
    installFetch(routes());
    renderSelection(<ReferenceChecksPage />, { path: PATH, route: PATH, permissions: OFFICER });
    const table = await screen.findByRole('table', { name: 'Reference checks' });
    expect(within(table).getByText('Consent required')).toBeInTheDocument();
    const confidential = within(table).getByRole('row', { name: /Kabo Seane/ });
    expect(within(confidential).getByText('Confidential')).toBeInTheDocument();
    expect(within(confidential).getAllByText('—').length).toBeGreaterThan(0);
    expect(within(table).queryByText(/restricted/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add referee' })).toBeDisabled();
  });

  it('records referee feedback and shows the server refusal without consent', async () => {
    installFetch(routes(() => problem(409, 'Conflict', { code: 'REFERENCE_CONSENT_REQUIRED' })));
    renderSelection(<ReferenceChecksPage />, { path: PATH, route: PATH, permissions: OFFICER });
    fireEvent.click(await screen.findByRole('button', { name: 'Record feedback' }));
    const dialog = screen.getByRole('dialog');
    setDateTime(dialog, /Contacted at/, '2026-09-20', '10:00');
    fireEvent.change(within(dialog).getByLabelText(/^Feedback/), {
      target: { value: 'Good work.' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Outcome/), { target: { value: 'Verified.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record feedback' }));
    expect(
      await within(dialog).findByText(
        'The referee has not consented: feedback cannot be recorded.',
      ),
    ).toBeInTheDocument();
  });

  it('enables adding a referee once a tender is selected', async () => {
    installFetch(routes());
    renderSelection(<ReferenceChecksPage />, {
      path: PATH,
      route: `${PATH}?tenderId=9`,
      permissions: OFFICER,
    });
    await vi.waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add referee' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add referee' }));
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Without consent, feedback cannot be recorded',
    );
  });
});
