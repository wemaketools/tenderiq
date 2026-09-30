import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { businessError, fieldDetail, fieldPage, renderPage, routeCalls } from '../test/kit';
import CustomFieldNewPage from './CustomFieldNewPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = { path: '/buyer/admin/policy/fields/new', route: '/buyer/admin/policy/fields/new' };

function fill(key: string): void {
  fireEvent.change(screen.getByLabelText(/^Form/), { target: { value: 'procurement_request' } });
  fireEvent.change(screen.getByRole('textbox', { name: /^Key/ }), { target: { value: key } });
  fireEvent.change(screen.getByRole('textbox', { name: /^Label/ }), {
    target: { value: 'Asset number' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: /^Purpose/ }), {
    target: { value: 'Identifies the asset being replaced.' },
  });
}

describe('CustomFieldNewPage (ADM-07)', () => {
  it('refuses a key that would carry an undisclosed score', async () => {
    const calls = routeCalls({ 'buyer.policy.listFields': () => fieldPage() });
    renderPage(<CustomFieldNewPage />, PATH);
    fill('supplier_score');
    fireEvent.click(screen.getByRole('button', { name: 'Save field' }));
    expect(
      await screen.findByText(
        'Custom fields cannot carry scores or weights; use the published evaluation method.',
      ),
    ).toBeInTheDocument();
    expect(calls.some((entry) => entry.id === 'buyer.policy.createField')).toBe(false);
  });

  it('asks for the condition of a conditionally required field', async () => {
    routeCalls({ 'buyer.policy.listFields': () => fieldPage() });
    renderPage(<CustomFieldNewPage />, PATH);
    fill('asset_number');
    fireEvent.click(screen.getByRole('radio', { name: /Conditional/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save field' }));
    expect(
      await screen.findByText('Choose the field that makes this one required.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Emergency procurement (field)' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Value band (core)' })).toBeInTheDocument();
  });

  it('creates the field and opens it', async () => {
    const calls = routeCalls({
      'buyer.policy.listFields': () => fieldPage(),
      'buyer.policy.createField': () => fieldDetail({ id: 900 }),
    });
    const { router } = renderPage(<CustomFieldNewPage />, PATH);
    fill('asset_number');
    fireEvent.click(screen.getByRole('button', { name: 'Save field' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/buyer/admin/policy/fields/900'),
    );
    expect(calls.find((entry) => entry.id === 'buyer.policy.createField')?.request).toMatchObject({
      body: { key: 'asset_number', entityType: 'procurement_request', requiredMode: 'optional' },
    });
  });

  it('explains a key already used on the form', async () => {
    routeCalls({
      'buyer.policy.listFields': () => fieldPage(),
      'buyer.policy.createField': () => {
        throw businessError('buyer.policy.createField', 'CUSTOM_FIELD_KEY_TAKEN');
      },
    });
    renderPage(<CustomFieldNewPage />, PATH);
    fill('asset_number');
    fireEvent.click(screen.getByRole('button', { name: 'Save field' }));
    expect(
      await screen.findByText('Another field of this form already uses this key.'),
    ).toBeInTheDocument();
  });
});
