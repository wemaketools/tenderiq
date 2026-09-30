import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { businessError, profileDetail, renderPage, routeCalls } from '../test/kit';
import PolicyProfileNewPage from './PolicyProfileNewPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = {
  path: '/buyer/admin/policy/profiles/new',
  route: '/buyer/admin/policy/profiles/new',
};

function fillValidProfile(): void {
  fireEvent.change(screen.getByRole('textbox', { name: /Profile name/ }), {
    target: { value: 'Works tendering' },
  });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Open' }));
  fireEvent.change(screen.getByLabelText(/^Procedure/), { target: { value: 'open' } });
  fireEvent.change(screen.getByRole('textbox', { name: /Required approval level/ }), {
    target: { value: 'Procurement Manager' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: /Minimum response period/ }), {
    target: { value: '21' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: /Question deadline/ }), {
    target: { value: '7' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: /Complaint window/ }), {
    target: { value: '10' },
  });
}

describe('PolicyProfileNewPage (ADM-06)', () => {
  it('explains that saving creates a draft, not an approved profile', () => {
    routeCalls({});
    renderPage(<PolicyProfileNewPage />, PATH);
    expect(
      screen.getByText('Saved, submitted and approved are different steps'),
    ).toBeInTheDocument();
  });

  it('refuses to send an incomplete profile and shows the contract messages', async () => {
    const calls = routeCalls({});
    renderPage(<PolicyProfileNewPage />, PATH);
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('At least 3 characters.')).toBeInTheDocument();
    expect(screen.getByText('Permit at least one procedure.')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('creates the profile and opens it with the saved draft', async () => {
    const calls = routeCalls({ 'buyer.policy.createProfile': () => profileDetail() });
    const { router } = renderPage(<PolicyProfileNewPage />, PATH);
    fillValidProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/buyer/admin/policy/profiles/1'),
    );
    expect(calls[0]).toMatchObject({
      id: 'buyer.policy.createProfile',
      request: {
        body: {
          name: 'Works tendering',
          rules: expect.objectContaining({ permittedProcedures: ['open'], minResponseDays: 21 }),
        },
      },
    });
  });

  it('explains a duplicate name refused by the API', async () => {
    routeCalls({
      'buyer.policy.createProfile': () => {
        throw businessError('buyer.policy.createProfile', 'POLICY_PROFILE_NAME_TAKEN');
      },
    });
    renderPage(<PolicyProfileNewPage />, PATH);
    fillValidProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(
      await screen.findByText('Another policy profile already has this name.'),
    ).toBeInTheDocument();
  });
});
