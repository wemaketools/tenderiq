import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { businessError, profile, REFERENCE_HANDLERS, renderPage, routeCalls } from '../test/kit';
import ProfileEditPage from './ProfileEditPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = { path: '/supplier/organization/edit', route: '/supplier/organization/edit' };

describe('ProfileEditPage (SUP-03)', () => {
  it('keeps the legal identity read-only and saves the current profile', async () => {
    const calls = routeCalls({
      'supplier.suppliers.profile.get': () => profile(),
      ...REFERENCE_HANDLERS,
      'supplier.suppliers.profile.update': () => profile(),
    });
    const { router } = renderPage(<ProfileEditPage />, PATH);
    expect(await screen.findByText('Legal identity')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /Legal name/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Trading names/), {
      target: { value: 'Tsodilo Engineering, Tsodilo Pumps' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/supplier/organization'));
    const body = calls.find((c) => c.id === 'supplier.suppliers.profile.update')?.request
      .body as Record<string, unknown>;
    expect(body.tradingNames).toEqual(['Tsodilo Engineering', 'Tsodilo Pumps']);
    expect(body.primaryContactUserId).toBe(24);
    expect(body).not.toHaveProperty('legalName');
  });

  it('validates before sending: at least one category', async () => {
    const calls = routeCalls({
      'supplier.suppliers.profile.get': () => profile(),
      ...REFERENCE_HANDLERS,
    });
    renderPage(<ProfileEditPage />, PATH);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Pumps and mechanical/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(await screen.findByText('Choose at least one category.')).toBeInTheDocument();
    expect(calls.some((c) => c.id === 'supplier.suppliers.profile.update')).toBe(false);
  });

  it('explains a business refusal from the server', async () => {
    routeCalls({
      'supplier.suppliers.profile.get': () => profile(),
      ...REFERENCE_HANDLERS,
      'supplier.suppliers.profile.update': () => {
        throw businessError('supplier.suppliers.profile.update', 'PRIMARY_CONTACT_NOT_MEMBER', 422);
      },
    });
    renderPage(<ProfileEditPage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Save profile' }));
    expect(
      await screen.findByText('The primary contact must be an active member of your organization.'),
    ).toBeInTheDocument();
  });
});
