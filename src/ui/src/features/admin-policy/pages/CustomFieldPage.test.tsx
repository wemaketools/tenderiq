import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { businessError, fieldDetail, fieldPage, renderPage, routeCalls } from '../test/kit';
import CustomFieldPage from './CustomFieldPage';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

const PATH = { path: '/buyer/admin/policy/fields/:fieldId', route: '/buyer/admin/policy/fields/2' };

describe('CustomFieldPage (ADM-07)', () => {
  it('shows the definition, dependents, usage and history', async () => {
    routeCalls({
      'buyer.policy.getField': () => fieldDetail(),
      'buyer.policy.listFields': () => fieldPage(),
    });
    renderPage(<CustomFieldPage />, PATH);

    expect(
      await screen.findByText('Flags a request raised under an emergency.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Emergency justification is required when this field is Yes'),
    ).toBeInTheDocument();
    expect(screen.getByText('Included in reports.')).toBeInTheDocument();
    expect(screen.getByText('Locked by issued forms')).toBeInTheDocument();
  });

  it('locks the key and type of a field carried by issued forms and saves an explained change', async () => {
    const calls = routeCalls({
      'buyer.policy.getField': () => fieldDetail(),
      'buyer.policy.listFields': () => fieldPage(),
      'buyer.policy.updateField': () => fieldDetail({ label: 'Emergency request' }),
    });
    renderPage(<CustomFieldPage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit field' }));

    expect(screen.getByText('Issued records carry this field')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Type/)).toBeDisabled();
    expect(screen.getByRole('textbox', { name: /^Key/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Explain the change.')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: /What changes and why/ }), {
      target: { value: 'Clearer label.' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /^Label/ }), {
      target: { value: 'Emergency request' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('heading', { name: 'Emergency request' })).toBeInTheDocument();
    await waitFor(() =>
      expect(calls.find((entry) => entry.id === 'buyer.policy.updateField')?.request).toMatchObject(
        {
          params: { fieldId: 2 },
          body: { label: 'Emergency request', changeNote: 'Clearer label.', fieldType: 'boolean' },
        },
      ),
    );
  });

  it('explains why a condition source cannot be deactivated', async () => {
    routeCalls({
      'buyer.policy.getField': () => fieldDetail(),
      'buyer.policy.listFields': () => fieldPage(),
      'buyer.policy.deactivateField': () => {
        throw businessError('buyer.policy.deactivateField', 'FIELD_IS_CONDITION_SOURCE');
      },
    });
    renderPage(<CustomFieldPage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'No longer used.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    expect(
      await within(dialog).findByText(
        'Other active fields depend on this field for their required rule. Change them first.',
      ),
    ).toBeInTheDocument();
  });

  it('offers only narrower audiences for a field that issued records carry', async () => {
    routeCalls({
      'buyer.policy.getField': () => fieldDetail({ audience: 'supplier_visible' }),
      'buyer.policy.listFields': () => fieldPage(),
    });
    renderPage(<CustomFieldPage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit field' }));
    expect(
      screen.getByText(
        'Values were captured for this audience, so wider audiences are not available. Create a new field to collect information for a wider audience.',
      ),
    ).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    const byName = (pattern: RegExp) =>
      radios.find((radio) => pattern.test(radio.getAttribute('value') ?? ''));
    expect(byName(/^public$/)).toBeDisabled();
    expect(byName(/^supplier_visible$/)).toBeEnabled();
    expect(byName(/^buyer_internal$/)).toBeEnabled();
  });

  it('explains a refused audience widening', async () => {
    routeCalls({
      'buyer.policy.getField': () => fieldDetail(),
      'buyer.policy.listFields': () => fieldPage(),
      'buyer.policy.updateField': () => {
        throw businessError(
          'buyer.policy.updateField',
          'AUDIENCE_WIDENING_REQUIRES_NEW_FIELD',
          409,
        );
      },
    });
    renderPage(<CustomFieldPage />, PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit field' }));
    fireEvent.change(screen.getByRole('textbox', { name: /What changes and why/ }), {
      target: { value: 'Clearer label.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(
      await screen.findByText(
        'Issued records carry this field, so its audience can only be narrowed. Create a new field for a wider audience.',
      ),
    ).toBeInTheDocument();
  });

  it('reactivates an inactive field', async () => {
    const inactive = fieldDetail({
      active: false,
      capabilities: {
        canEdit: false,
        structureLocked: true,
        canDeactivate: false,
        canReactivate: true,
      },
    });
    routeCalls({
      'buyer.policy.getField': () => inactive,
      'buyer.policy.listFields': () => fieldPage(),
      'buyer.policy.reactivateField': () => fieldDetail(),
    });
    renderPage(<CustomFieldPage />, PATH);
    expect(await screen.findByText('This field is inactive')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reactivate' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reactivate' }));
    await waitFor(() =>
      expect(screen.queryByText('This field is inactive')).not.toBeInTheDocument(),
    );
  });
});
