import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  REFERENCE_HANDLERS,
  businessError,
  claimInvitation,
  registrationResult,
  renderPage,
  routeCalls,
} from '../test/kit';
import ClaimOrganizationPage from './ClaimOrganizationPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const TOKEN = 'clm_K4sBoreh0le7Qx2';
const PATH = {
  path: '/register/claim/:token',
  route: `/register/claim/${TOKEN}`,
  signedOut: true,
};

async function fillClaim(email: string): Promise<void> {
  expect(await screen.findByRole('option', { name: 'Botswana' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Your work e-mail/), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/Registration jurisdiction/), {
    target: { value: 'Botswana — CIPA' },
  });
  fireEvent.change(screen.getByLabelText(/^Registration number/), {
    target: { value: 'BW00008877665' },
  });
  fireEvent.change(screen.getByLabelText(/Location name/), {
    target: { value: 'Registered office' },
  });
  fireEvent.change(screen.getByLabelText(/^Address/), { target: { value: 'Plot 5, Kasane' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /I accept the TenderIQ terms/ }));
}

describe('ClaimOrganizationPage (SUP-02 claim an invited organization)', () => {
  it('shows the invited organization, the inviting buyer and a masked address, never the buyer notes', async () => {
    routeCalls({ ...REFERENCE_HANDLERS, 'public.suppliers.claims.get': () => claimInvitation() });
    renderPage(<ClaimOrganizationPage />, PATH);
    const card = (await screen.findByText('Your invitation')).closest('section') ?? document.body;
    expect(
      within(card as HTMLElement).getByText('Kasane Borehole Drilling (Pty) Ltd'),
    ).toBeInTheDocument();
    expect(
      within(card as HTMLElement).getByText('Kalahari Water Utilities (Pilot)'),
    ).toBeInTheDocument();
    expect(
      within(card as HTMLElement).getByText('o•••@kasane-drilling.example'),
    ).toBeInTheDocument();
    expect(screen.getByText('Registration is not qualification')).toBeInTheDocument();
    expect(screen.getByLabelText(/Your full name/)).toHaveValue('Onkemetse Dube');
  });

  it('confirms the claim and shows separate statuses with qualification not assessed (AC-07)', async () => {
    const calls = routeCalls({
      ...REFERENCE_HANDLERS,
      'public.suppliers.claims.get': () => claimInvitation(),
      'public.suppliers.claims.claim': () =>
        registrationResult({ registrationId: 50, legalName: 'Kasane Borehole Drilling (Pty) Ltd' }),
    });
    renderPage(<ClaimOrganizationPage />, PATH);
    await fillClaim('onkemetse.dube@kasane-drilling.example');
    fireEvent.click(screen.getByRole('button', { name: 'Claim the organization' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/recorded by Kalahari Water Utilities/)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/The organization is registered, not qualified/),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Claim the organization' }));
    expect(await screen.findByText('Where your registration stands')).toBeInTheDocument();
    expect(
      screen.getByText('Kasane Borehole Drilling (Pty) Ltd is registered'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Not assessed').length).toBeGreaterThan(0);
    const claim = calls.find((entry) => entry.id === 'public.suppliers.claims.claim');
    expect(claim?.request).toEqual({
      params: { token: TOKEN },
      body: expect.objectContaining({
        email: 'onkemetse.dube@kasane-drilling.example',
        categories: ['WTR-PUMP'],
        locations: [expect.objectContaining({ country: 'BW', isRegisteredOffice: true })],
        acceptTerms: true,
      }),
    });
  });

  it('explains that the invited address must be used when the server refuses another one', async () => {
    routeCalls({
      ...REFERENCE_HANDLERS,
      'public.suppliers.claims.get': () => claimInvitation(),
      'public.suppliers.claims.claim': () => {
        throw businessError('public.suppliers.claims.claim', 'CLAIM_EMAIL_MISMATCH', 422);
      },
    });
    renderPage(<ClaimOrganizationPage />, PATH);
    await fillClaim('someone.else@kasane-drilling.example');
    fireEvent.click(screen.getByRole('button', { name: 'Claim the organization' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Claim the organization' }));
    expect(
      await screen.findByText('Use the e-mail address the invitation was sent to.'),
    ).toBeInTheDocument();
  });

  it('explains an expired invitation and offers registration instead', async () => {
    routeCalls({
      ...REFERENCE_HANDLERS,
      'public.suppliers.claims.get': () =>
        claimInvitation({ state: 'expired', stateNote: 'This invitation has expired.' }),
    });
    renderPage(<ClaimOrganizationPage />, PATH);
    expect(await screen.findByText('This invitation cannot be used')).toBeInTheDocument();
    expect(screen.getByText('This invitation has expired.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Register an organization' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Claim the organization' }),
    ).not.toBeInTheDocument();
  });

  it('rejects a malformed link without calling the API and reports an unknown invitation', async () => {
    const calls = routeCalls({ ...REFERENCE_HANDLERS });
    renderPage(<ClaimOrganizationPage />, { ...PATH, route: '/register/claim/not-a-token' });
    expect(await screen.findByText('This invitation link is not valid')).toBeInTheDocument();
    expect(calls.some((entry) => entry.id === 'public.suppliers.claims.get')).toBe(false);

    routeCalls({ ...REFERENCE_HANDLERS });
    renderPage(<ClaimOrganizationPage />, { ...PATH, route: '/register/claim/clm_Unknown0000' });
    await waitFor(() =>
      expect(screen.getByText('We could not find this invitation')).toBeInTheDocument(),
    );
  });
});
