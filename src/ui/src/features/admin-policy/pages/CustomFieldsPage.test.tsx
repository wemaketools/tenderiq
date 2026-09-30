import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { businessError, fieldPage, renderPage, requestForm, routeCalls } from '../test/kit';
import CustomFieldsPage from './CustomFieldsPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = { path: '/buyer/admin/policy/fields', route: '/buyer/admin/policy/fields' };

describe('CustomFieldsPage (ADM-07)', () => {
  it('lists each field with its purpose, form, requirement, audience, reporting and usage', async () => {
    routeCalls({ 'buyer.policy.listFields': () => fieldPage() });
    renderPage(<CustomFieldsPage />, PATH);

    const row = await screen.findByRole('row', { name: 'Emergency justification' });
    expect(within(row).getByText('Records why the need cannot wait.')).toBeInTheDocument();
    expect(within(row).getByText('Procurement request')).toBeInTheDocument();
    expect(within(row).getByText('Required when Emergency procurement is Yes')).toBeInTheDocument();
    expect(within(row).getByText('Buyer internal')).toBeInTheDocument();
    const flagged = screen.getByRole('row', { name: 'Emergency procurement' });
    expect(within(flagged).getByText('4 issued')).toBeInTheDocument();
    expect(within(flagged).getByText('Included in reports')).toBeInTheDocument();
    expect(screen.getByText('Locked by issued forms')).toBeInTheDocument();
  });

  it('filters by form and audience', async () => {
    const calls = routeCalls({ 'buyer.policy.listFields': () => fieldPage() });
    renderPage(<CustomFieldsPage />, PATH);
    await screen.findByRole('row', { name: 'Emergency justification' });
    fireEvent.change(screen.getByLabelText('Form'), { target: { value: 'tender' } });
    fireEvent.change(screen.getByLabelText('Audience'), { target: { value: 'public' } });
    await waitFor(() =>
      expect(calls.at(-1)?.request).toEqual({
        query: expect.objectContaining({ entityType: ['tender'], audience: ['public'] }),
      }),
    );
  });

  it('previews a form, reports missing required fields and saves a new order', async () => {
    const calls = routeCalls({
      'buyer.policy.listFields': () => fieldPage(),
      'buyer.policy.formDefinition': () => requestForm(),
      'buyer.policy.reorderFields': () => requestForm(),
    });
    renderPage(<CustomFieldsPage />, PATH);
    fireEvent.click(await screen.findByRole('tab', { name: 'Form preview and order' }));
    fireEvent.change(screen.getByLabelText('Form'), { target: { value: 'procurement_request' } });

    fireEvent.click(await screen.findByRole('radio', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check the form' }));
    expect(await screen.findByText('1 field needs attention')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Move Emergency justification up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save order' }));
    await waitFor(() =>
      expect(calls.find((entry) => entry.id === 'buyer.policy.reorderFields')?.request).toEqual({
        body: { entityType: 'procurement_request', fieldIds: [3, 2] },
      }),
    );
  });

  it('explains a refused order', async () => {
    routeCalls({
      'buyer.policy.listFields': () => fieldPage(),
      'buyer.policy.formDefinition': () => requestForm(),
      'buyer.policy.reorderFields': () => {
        throw businessError('buyer.policy.reorderFields', 'FIELD_ORDER_INCOMPLETE', 422);
      },
    });
    renderPage(<CustomFieldsPage />, PATH);
    fireEvent.click(await screen.findByRole('tab', { name: 'Form preview and order' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Move Emergency justification up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save order' }));
    expect(
      await screen.findByText('List every active field of the form in the new order.'),
    ).toBeInTheDocument();
  });

  it('hides authoring from auditors', async () => {
    routeCalls({
      'buyer.policy.listFields': () => fieldPage(),
      'buyer.policy.formDefinition': () => requestForm(),
    });
    renderPage(<CustomFieldsPage />, { ...PATH, permissions: ['audit.view'] });
    await screen.findByRole('row', { name: 'Emergency justification' });
    expect(screen.queryByRole('link', { name: 'New field' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Form preview and order' }));
    fireEvent.change(screen.getByLabelText('Form'), { target: { value: 'procurement_request' } });
    await screen.findByRole('radio', { name: 'Yes' });
    expect(screen.queryByRole('button', { name: 'Save order' })).not.toBeInTheDocument();
  });

  it('explains an empty register', async () => {
    routeCalls({ 'buyer.policy.listFields': () => fieldPage([]) });
    renderPage(<CustomFieldsPage />, PATH);
    expect(await screen.findByText('No additional fields yet.')).toBeInTheDocument();
  });
});
