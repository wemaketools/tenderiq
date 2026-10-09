import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { CustomFieldIssue, CustomFieldValues } from '@contracts/policy';

import { renderWithProviders } from '../../../test/render';
import { businessError, requestForm, routeCalls, sessionWith } from '../test/kit';
import { CustomFieldsSection } from './CustomFieldsSection';

vi.mock('../../../api/client', async (original) => ({
  ...(await original<object>()),
  call: vi.fn(),
}));

function Host({ onIssues }: { readonly onIssues: (issues: readonly CustomFieldIssue[]) => void }) {
  const [values, setValues] = useState<CustomFieldValues>({});
  return (
    <CustomFieldsSection
      entityType="procurement_request"
      values={values}
      onChange={setValues}
      showErrors
      onValidationChange={onIssues}
    />
  );
}

function render(element: ReactElement) {
  return renderWithProviders(element, { state: { session: sessionWith(['request.create']) } });
}

describe('CustomFieldsSection', () => {
  it('requires the justification only once the emergency flag is set to yes', async () => {
    const calls = routeCalls({ 'buyer.policy.formDefinition': () => requestForm() });
    const onIssues = vi.fn();
    render(<Host onIssues={onIssues} />);

    expect(await screen.findByText('Emergency justification')).toBeInTheDocument();
    expect(calls[0]?.request).toEqual({ params: { entityType: 'procurement_request' } });
    expect(screen.queryByText('Emergency justification is required.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));

    expect(await screen.findByText('Emergency justification is required.')).toBeInTheDocument();
    await waitFor(() =>
      expect(onIssues).toHaveBeenLastCalledWith([
        expect.objectContaining({ key: 'emergency_justification', code: 'CUSTOM_FIELD_REQUIRED' }),
      ]),
    );
    fireEvent.change(screen.getByRole('textbox', { name: /Emergency justification/ }), {
      target: { value: 'Pump failure at Mahalapye.' },
    });
    await waitFor(() => expect(onIssues).toHaveBeenLastCalledWith([]));
  });

  it('reads the supplier-visible form of the buyer for a supplier', async () => {
    const calls = routeCalls({ 'supplier.policy.formDefinition': () => requestForm() });
    render(
      <CustomFieldsSection
        entityType="tender"
        values={{}}
        onChange={() => undefined}
        source={{ audience: 'supplier', buyerSlug: 'kwu' }}
      />,
    );
    expect(await screen.findByText('Emergency procurement')).toBeInTheDocument();
    expect(calls[0]).toMatchObject({
      id: 'supplier.policy.formDefinition',
      request: { params: { buyerSlug: 'kwu', entityType: 'tender' } },
    });
  });

  it('shows the values read-only when no change handler is given', () => {
    routeCalls({});
    render(
      <CustomFieldsSection
        entityType="procurement_request"
        form={requestForm()}
        values={{ is_emergency: true, emergency_justification: 'Burst main' }}
      />,
    );
    expect(screen.getByText('Burst main')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('binds the host save errors to the matching field', () => {
    routeCalls({});
    render(
      <CustomFieldsSection
        entityType="procurement_request"
        form={requestForm()}
        values={{}}
        onChange={() => undefined}
        serverErrors={[
          {
            field: 'customFields.emergency_justification',
            code: 'CUSTOM_FIELD_REQUIRED',
            message: 'Say why it cannot wait.',
          },
        ]}
      />,
    );
    expect(screen.getByText('Say why it cannot wait.')).toBeInTheDocument();
  });

  it('shows a retryable error when the form cannot be loaded', async () => {
    routeCalls({
      'buyer.policy.formDefinition': () => {
        throw businessError('buyer.policy.formDefinition', 'INTERNAL_ERROR', 500);
      },
    });
    render(<CustomFieldsSection entityType="tender" values={{}} onChange={() => undefined} />);
    expect(
      await screen.findByText('The additional fields could not be loaded'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('renders nothing, not a restricted box, when the form is refused', async () => {
    const calls = routeCalls({
      'buyer.policy.formDefinition': () => {
        throw businessError('buyer.policy.formDefinition', 'FORBIDDEN', 403);
      },
    });
    const { container } = render(
      <CustomFieldsSection entityType="tender" values={{}} onChange={() => undefined} />,
    );
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    await waitFor(() =>
      expect(screen.queryByText('Loading the additional fields')).not.toBeInTheDocument(),
    );
    expect(container.querySelector('[data-state="restricted"]')).toBeNull();
    expect(screen.queryByText('The additional fields could not be loaded')).not.toBeInTheDocument();
    expect(container.querySelector('fieldset')).toBeNull();
  });

  it('renders nothing for a supplier on the buyer-only request form', () => {
    routeCalls({});
    const { container } = render(
      <CustomFieldsSection
        entityType="procurement_request"
        values={{}}
        onChange={() => undefined}
        source={{ audience: 'supplier', buyerSlug: 'kwu' }}
      />,
    );
    expect(container.querySelector('fieldset')).toBeNull();
  });
});
