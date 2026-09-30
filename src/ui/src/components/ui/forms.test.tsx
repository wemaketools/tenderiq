import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/client';
import { formErrors } from './formErrors';
import {
  Checkbox,
  DateInput,
  DateTimeInput,
  FormErrorSummary,
  MoneyInput,
  MultiSelect,
  NumberInput,
  RadioGroup,
  Select,
  TextArea,
  TextField,
} from './FormFields';

function Controlled<T>({
  initial,
  render: renderField,
}: {
  initial: T;
  render: (value: T, set: (value: T) => void) => React.ReactNode;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      {renderField(value, setValue)}
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  );
}

const valueOf = () => JSON.parse(screen.getByTestId('value').textContent ?? 'null') as unknown;

describe('text fields', () => {
  it('labels the input, marks it required and describes it by its hint and error', () => {
    render(
      <>
        <TextField
          label="Title"
          value=""
          onChange={() => undefined}
          required
          hint="Shown to suppliers"
          error="A title is required."
        />
        <TextArea label="Summary" value="" onChange={() => undefined} />
      </>,
    );
    const input = screen.getByLabelText(/Title/);
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Shown to suppliers A title is required.');
    expect(screen.getByLabelText('Summary').tagName).toBe('TEXTAREA');
  });
});

describe('choices', () => {
  it('selects, multi-selects, checks and picks a radio option', async () => {
    const onCheck = vi.fn();
    render(
      <>
        <Controlled
          initial=""
          render={(value, set) => (
            <Select
              label="Status"
              value={value}
              onChange={set}
              placeholder="All statuses"
              options={[{ value: 'open', label: 'Open' }]}
            />
          )}
        />
        <Checkbox label="My items only" checked={false} onChange={onCheck} />
      </>,
    );
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'open');
    expect(valueOf()).toBe('open');
    await userEvent.click(screen.getByLabelText('My items only'));
    expect(onCheck).toHaveBeenCalledWith(true);
  });

  it('keeps multi-select and radio values as strings', async () => {
    render(
      <Controlled
        initial={{ lots: [] as string[], envelope: 'technical' }}
        render={(value, set) => (
          <>
            <MultiSelect
              label="Lots"
              value={value.lots}
              onChange={(lots) => set({ ...value, lots })}
              options={[
                { value: '1', label: 'Lot 1' },
                { value: '2', label: 'Lot 2' },
              ]}
            />
            <RadioGroup
              label="Envelope"
              value={value.envelope}
              onChange={(envelope) => set({ ...value, envelope })}
              options={[
                { value: 'technical', label: 'Technical' },
                { value: 'commercial', label: 'Commercial' },
              ]}
            />
          </>
        )}
      />,
    );
    await userEvent.click(screen.getByLabelText('Lot 2'));
    await userEvent.click(screen.getByLabelText('Commercial'));
    expect(valueOf()).toEqual({ lots: ['2'], envelope: 'commercial' });
    expect(screen.getByRole('group', { name: 'Lots' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Envelope' })).toBeInTheDocument();
  });
});

describe('RadioGroup ARIA', () => {
  it('puts aria-required on a radiogroup named by the legend, never on the fieldset', () => {
    render(
      <RadioGroup
        label="Procurement method"
        required
        value=""
        onChange={() => undefined}
        options={[
          { value: 'open', label: 'Open' },
          { value: 'restricted', label: 'Restricted' },
        ]}
      />,
    );
    const group = screen.getByRole('group', { name: /Procurement method/ });
    expect(group).not.toHaveAttribute('aria-required');
    const radiogroup = screen.getByRole('radiogroup', { name: /Procurement method/ });
    expect(radiogroup).toHaveAttribute('aria-required', 'true');
    expect(radiogroup).toContainElement(screen.getByRole('radio', { name: 'Open' }));
  });
});

describe('numbers and money (decimal strings)', () => {
  it('accepts a money amount as a decimal string, strips grouping and refuses letters and a third decimal', async () => {
    render(
      <Controlled
        initial={{ amount: '', currency: 'BWP' }}
        render={(value, set) => (
          <MoneyInput label="Estimate" value={value} onChange={set} currencies={['BWP']} />
        )}
      />,
    );
    const input = screen.getByLabelText('Estimate');
    await userEvent.type(input, '1,500,000.505x');
    expect(valueOf()).toEqual({ amount: '1500000.50', currency: 'BWP' });
    expect(screen.getByText('BWP')).toBeInTheDocument();
  });

  it('lets the user choose the currency when several are allowed', async () => {
    render(
      <Controlled
        initial={{ amount: '10', currency: 'BWP' }}
        render={(value, set) => (
          <MoneyInput label="Offer" value={value} onChange={set} currencies={['BWP', 'USD']} />
        )}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'USD');
    expect(valueOf()).toEqual({ amount: '10', currency: 'USD' });
  });

  it('accepts whole numbers or decimals up to the given places', async () => {
    render(
      <Controlled
        initial=""
        render={(value, set) => (
          <NumberInput label="Weight" value={value} onChange={set} places={2} suffix="%" />
        )}
      />,
    );
    await userEvent.type(screen.getByLabelText('Weight'), '12.345');
    expect(valueOf()).toBe('12.34');
    expect(screen.getByText('%')).toBeInTheDocument();
  });
});

describe('dates', () => {
  it('produces a calendar date string', async () => {
    render(
      <Controlled
        initial=""
        render={(value, set) => <DateInput label="Target date" value={value} onChange={set} />}
      />,
    );
    await userEvent.type(screen.getByLabelText('Target date'), '2026-10-14');
    expect(valueOf()).toBe('2026-10-14');
  });

  it('enters date and time in the explicit official zone and yields the UTC instant', async () => {
    render(
      <Controlled
        initial={null as string | null}
        render={(value, set) => (
          <DateTimeInput
            label="Submission deadline"
            value={value}
            onChange={set}
            timeZone="Africa/Gaborone"
          />
        )}
      />,
    );
    expect(screen.getByText('(UTC+02:00) Africa/Gaborone')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Date'), '2026-10-14');
    await userEvent.type(screen.getByLabelText('Time'), '12:00');
    expect(valueOf()).toBe('2026-10-14T10:00:00Z');
  });
});

describe('problem+json field errors', () => {
  const error = new ApiError({
    kind: 'validation',
    status: 422,
    title: 'Validation failed',
    endpointId: 'x',
    fieldErrors: [
      { field: 'amount.currency', code: 'INVALID_CURRENCY', message: 'Use BWP.' },
      { field: 'title', code: 'TITLE_REQUIRED', message: 'A title is required.' },
      { field: 'lots.0.value', code: 'INVALID', message: 'Lot value is wrong.' },
    ],
  });

  it('binds errors to fields by path prefix and keeps the unmatched ones', () => {
    const errors = formErrors(error, ['title', 'amount']);
    expect(errors.forField('amount')).toBe('Use BWP.');
    expect(errors.forField('title')).toBe('A title is required.');
    expect(errors.other.map((item) => item.field)).toEqual(['lots.0.value']);
    expect(formErrors(new Error('x'), ['title']).hasFieldErrors).toBe(false);
  });

  it('never drops an unmatched error: the summary lists it', () => {
    render(
      <FormErrorSummary
        title="Validation failed"
        errors={formErrors(error, ['title', 'amount']).other}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('lots.0.value: Lot value is wrong.');
  });
});
