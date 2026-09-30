/**
 * Form fields (docs/technical/09-frontend.md §12): every input has a visible label, a required marker, an optional
 * hint and an error line; an invalid input carries `aria-invalid="true"` and is described by its error.
 *
 * Values are strings (or string arrays) exactly as entered. Money and numbers stay decimal STRINGS (DD-32); dates are
 * `YYYY-MM-DD`; DateTimeInput produces a UTC instant from a wall time entered in an explicit official zone.
 */
import { useId, useState } from 'react';
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

import type { FieldError } from '@contracts/common';

import { officialTimeParts } from '../../lib/format';
import { t } from '../../lib/i18n';
import { instantToWallTime, wallTimeToInstant } from '../../lib/zonedTime';
import { Banner } from './Banner';

// ---------------------------------------------------------------------------------------------------------
// Field shell
// ---------------------------------------------------------------------------------------------------------

interface FieldShellProps {
  readonly id: string;
  readonly label: ReactNode;
  readonly required?: boolean;
  readonly hint?: ReactNode;
  readonly error?: string;
  readonly className?: string;
  readonly children: ReactNode;
}

function FieldShell({ id, label, required, hint, error, className, children }: FieldShellProps) {
  return (
    <div className={className === undefined ? 'tiq-field' : `tiq-field ${className}`}>
      <label htmlFor={id}>
        {label}
        {required === true && (
          <span className="tiq-required" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint !== undefined && (
        <p className="tiq-field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p className="tiq-field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, hint: unknown, error: string | undefined): string | undefined {
  const ids = [
    hint !== undefined ? `${id}-hint` : null,
    error !== undefined ? `${id}-error` : null,
  ].filter((value): value is string => value !== null);
  return ids.length === 0 ? undefined : ids.join(' ');
}

interface CommonFieldProps {
  readonly label: ReactNode;
  readonly hint?: ReactNode;
  readonly error?: string;
  readonly required?: boolean;
  /** Extra class on the field wrapper, for example `tiq-form-full`. */
  readonly fieldClassName?: string;
}

// ---------------------------------------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------------------------------------

export interface TextFieldProps
  extends
    CommonFieldProps,
    Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'required'> {
  readonly value: string;
  readonly onChange: (value: string) => void;
}

export function TextField({
  label,
  hint,
  error,
  required,
  fieldClassName,
  value,
  onChange,
  id: givenId,
  type = 'text',
  ...rest
}: TextFieldProps) {
  const generated = useId();
  const id = givenId ?? generated;
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={fieldClassName}
    >
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      />
    </FieldShell>
  );
}

export interface TextAreaProps
  extends
    CommonFieldProps,
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'required'> {
  readonly value: string;
  readonly onChange: (value: string) => void;
}

export function TextArea({
  label,
  hint,
  error,
  required,
  fieldClassName,
  value,
  onChange,
  id: givenId,
  rows = 4,
  ...rest
}: TextAreaProps) {
  const generated = useId();
  const id = givenId ?? generated;
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={fieldClassName}
    >
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      />
    </FieldShell>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Choices
// ---------------------------------------------------------------------------------------------------------

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface SelectProps
  extends
    CommonFieldProps,
    Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange' | 'required' | 'multiple'> {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly SelectOption[];
  /** An empty first option, for example "All statuses" in a filter or "Select…" in a form. */
  readonly placeholder?: string;
}

export function Select({
  label,
  hint,
  error,
  required,
  fieldClassName,
  value,
  onChange,
  options,
  placeholder,
  id: givenId,
  ...rest
}: SelectProps) {
  const generated = useId();
  const id = givenId ?? generated;
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={fieldClassName}
    >
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export interface MultiSelectProps extends CommonFieldProps {
  readonly value: readonly string[];
  readonly onChange: (value: string[]) => void;
  readonly options: readonly SelectOption[];
  readonly disabled?: boolean;
}

/** Several choices as a labelled group of checkboxes (keyboard and screen-reader friendly). */
export function MultiSelect({
  label,
  hint,
  error,
  required,
  fieldClassName,
  value,
  onChange,
  options,
  disabled,
}: MultiSelectProps) {
  const id = useId();
  const toggle = (option: string, checked: boolean): void => {
    onChange(checked ? [...value, option] : value.filter((item) => item !== option));
  };
  return (
    <div className={fieldClassName === undefined ? 'tiq-field' : `tiq-field ${fieldClassName}`}>
      <span className="tiq-field-label" id={`${id}-label`}>
        {label}
        {required === true && (
          <span className="tiq-required" aria-hidden="true">
            *
          </span>
        )}
      </span>
      <div
        className="tiq-multiselect"
        role="group"
        aria-labelledby={`${id}-label`}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={describedBy(id, hint, error)}
      >
        {options.map((option) => (
          <label key={option.value} className="tiq-check">
            <input
              type="checkbox"
              checked={value.includes(option.value)}
              disabled={disabled === true || option.disabled === true}
              onChange={(event) => toggle(option.value, event.target.checked)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {hint !== undefined && (
        <p className="tiq-field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p className="tiq-field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export interface CheckboxProps {
  readonly label: ReactNode;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly hint?: ReactNode;
  readonly error?: string;
  readonly disabled?: boolean;
  readonly name?: string;
}

export function Checkbox({ label, checked, onChange, hint, error, disabled, name }: CheckboxProps) {
  const id = useId();
  return (
    <div className="tiq-field">
      <label className="tiq-check" htmlFor={id}>
        <input
          id={id}
          name={name}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={error !== undefined || undefined}
          aria-describedby={describedBy(id, hint, error)}
        />
        <span>{label}</span>
      </label>
      {hint !== undefined && (
        <p className="tiq-field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p className="tiq-field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export interface RadioOption extends SelectOption {
  readonly hint?: ReactNode;
}

export interface RadioGroupProps extends CommonFieldProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly RadioOption[];
  readonly inline?: boolean;
  readonly name?: string;
}

export function RadioGroup({
  label,
  hint,
  error,
  required,
  fieldClassName,
  value,
  onChange,
  options,
  inline = false,
  name,
}: RadioGroupProps) {
  const id = useId();
  const groupName = name ?? id;
  const classes = ['tiq-radio-group'];
  if (inline) classes.push('tiq-radio-group--inline');
  if (fieldClassName !== undefined) classes.push(fieldClassName);
  return (
    <fieldset
      className={classes.join(' ')}
      aria-invalid={error !== undefined || undefined}
      aria-describedby={describedBy(id, hint, error)}
      aria-required={required || undefined}
    >
      <legend>
        {label}
        {required === true && (
          <span className="tiq-required" aria-hidden="true">
            *
          </span>
        )}
      </legend>
      <div className="tiq-radio-options">
        {options.map((option) => (
          <label key={option.value} className="tiq-check">
            <input
              type="radio"
              name={groupName}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
            />
            <span>
              {option.label}
              {option.hint !== undefined && <span className="tiq-cell-sub">{option.hint}</span>}
            </span>
          </label>
        ))}
      </div>
      {hint !== undefined && (
        <p className="tiq-field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p className="tiq-field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Dates and times
// ---------------------------------------------------------------------------------------------------------

export interface DateInputProps extends CommonFieldProps {
  /** `YYYY-MM-DD` or `''`. */
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly min?: string;
  readonly max?: string;
  readonly disabled?: boolean;
}

export function DateInput({ value, onChange, min, max, disabled, ...common }: DateInputProps) {
  return (
    <TextField
      {...common}
      type="date"
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      disabled={disabled}
    />
  );
}

export interface DateTimeInputProps extends CommonFieldProps {
  /** A UTC instant (`2026-10-14T10:00:00Z`) or `null`. */
  readonly value: string | null;
  readonly onChange: (value: string | null) => void;
  /** The OFFICIAL IANA zone the date and time are entered in (never the browser's). */
  readonly timeZone: string;
  readonly disabled?: boolean;
}

/**
 * Date and time entered in an explicit official zone, shown beside the inputs as `(UTC+02:00) Africa/Gaborone`.
 * The value is the corresponding UTC instant.
 */
export function DateTimeInput({
  label,
  hint,
  error,
  required,
  fieldClassName,
  value,
  onChange,
  timeZone,
  disabled,
}: DateTimeInputProps) {
  const id = useId();
  const initial = value === null ? { date: '', time: '' } : instantToWallTime(value, timeZone);
  const [draft, setDraft] = useState(initial);
  const [lastValue, setLastValue] = useState(value);
  // Keep the draft in step when the parent replaces the value (derived state, updated during render).
  if (value !== lastValue) {
    setLastValue(value);
    if (value !== null) {
      const wall = instantToWallTime(value, timeZone);
      if (wall.date !== draft.date || wall.time !== draft.time) {
        setDraft(wall);
      }
    }
  }
  const zoneLabel = `(${officialTimeParts(value ?? new Date(0).toISOString(), timeZone).offset}) ${timeZone}`;

  const update = (next: { date: string; time: string }): void => {
    setDraft(next);
    const instant = wallTimeToInstant(next, timeZone);
    setLastValue(instant);
    onChange(instant);
  };

  return (
    <div className={fieldClassName === undefined ? 'tiq-field' : `tiq-field ${fieldClassName}`}>
      <span className="tiq-field-label" id={`${id}-label`}>
        {label}
        {required === true && (
          <span className="tiq-required" aria-hidden="true">
            *
          </span>
        )}
      </span>
      <div className="tiq-input-group" role="group" aria-labelledby={`${id}-label`}>
        <input
          type="date"
          aria-label={t('ui.form.date')}
          value={draft.date}
          disabled={disabled}
          required={required}
          aria-invalid={error !== undefined || undefined}
          aria-describedby={`${id}-zone ${describedBy(id, hint, error) ?? ''}`.trim()}
          onChange={(event) => update({ ...draft, date: event.target.value })}
        />
        <input
          type="time"
          aria-label={t('ui.form.time')}
          value={draft.time}
          disabled={disabled}
          required={required}
          aria-invalid={error !== undefined || undefined}
          aria-describedby={`${id}-zone`}
          onChange={(event) => update({ ...draft, time: event.target.value })}
        />
        <span className="tiq-input-addon" id={`${id}-zone`}>
          {zoneLabel}
        </span>
      </div>
      {hint !== undefined && (
        <p className="tiq-field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p className="tiq-field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Numbers and money (decimal strings, DD-32)
// ---------------------------------------------------------------------------------------------------------

/** Strips grouping separators and spaces the user may type: `1,500,000.50` → `1500000.50`. */
function normalizeDecimalInput(raw: string): string {
  return raw.replace(/[\s,]/g, '');
}

export interface NumberInputProps extends CommonFieldProps {
  /** A decimal string or `''`. */
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Maximum decimal places (0 = whole numbers). */
  readonly places?: number;
  readonly allowNegative?: boolean;
  readonly disabled?: boolean;
  readonly suffix?: string;
}

function decimalPattern(places: number, allowNegative: boolean): RegExp {
  const sign = allowNegative ? '-?' : '';
  const fraction = places > 0 ? `(\\.\\d{0,${places}})?` : '';
  return new RegExp(`^${sign}\\d*${fraction}$`);
}

export function NumberInput({
  value,
  onChange,
  places = 0,
  allowNegative = false,
  disabled,
  suffix,
  label,
  hint,
  error,
  required,
  fieldClassName,
}: NumberInputProps) {
  const id = useId();
  const pattern = decimalPattern(places, allowNegative);
  const accept = (raw: string): void => {
    const cleaned = normalizeDecimalInput(raw);
    if (cleaned === '' || pattern.test(cleaned)) {
      onChange(cleaned);
    }
  };
  const input = (
    <input
      id={id}
      type="text"
      inputMode={places > 0 ? 'decimal' : 'numeric'}
      value={value}
      disabled={disabled}
      required={required}
      aria-required={required || undefined}
      aria-invalid={error !== undefined || undefined}
      aria-describedby={describedBy(id, hint, error)}
      onChange={(event) => accept(event.target.value)}
      onBlur={() => {
        if (value.endsWith('.')) onChange(value.slice(0, -1));
      }}
      className="tiq-num"
    />
  );
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={fieldClassName}
    >
      {suffix === undefined ? (
        input
      ) : (
        <div className="tiq-input-group">
          {input}
          <span className="tiq-input-addon">{suffix}</span>
        </div>
      )}
    </FieldShell>
  );
}

export interface MoneyInputValue {
  readonly amount: string;
  readonly currency: string;
}

export interface MoneyInputProps extends CommonFieldProps {
  readonly value: MoneyInputValue;
  readonly onChange: (value: MoneyInputValue) => void;
  /** Selectable currencies; a single entry shows it as fixed text. */
  readonly currencies: readonly string[];
  readonly disabled?: boolean;
}

/** Money entered as a decimal string (2 places) with its currency; never converted to a JS number. */
export function MoneyInput({
  value,
  onChange,
  currencies,
  disabled,
  label,
  hint,
  error,
  required,
  fieldClassName,
}: MoneyInputProps) {
  const id = useId();
  const pattern = decimalPattern(2, false);
  const onAmount = (raw: string): void => {
    const cleaned = normalizeDecimalInput(raw);
    if (cleaned === '' || pattern.test(cleaned)) {
      onChange({ ...value, amount: cleaned });
    }
  };
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={fieldClassName}
    >
      <div className="tiq-input-group">
        {currencies.length > 1 ? (
          <select
            aria-label={t('ui.form.currency')}
            value={value.currency}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, currency: event.target.value })}
          >
            {currencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        ) : (
          <span className="tiq-input-addon tiq-input-addon--mono">{value.currency}</span>
        )}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          className="tiq-num"
          value={value.amount}
          disabled={disabled}
          required={required}
          aria-required={required || undefined}
          aria-invalid={error !== undefined || undefined}
          aria-describedby={describedBy(id, hint, error)}
          onChange={(event) => onAmount(event.target.value)}
          onBlur={() => {
            if (value.amount.endsWith('.'))
              onChange({ ...value, amount: value.amount.slice(0, -1) });
          }}
        />
      </div>
    </FieldShell>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Error summary
// ---------------------------------------------------------------------------------------------------------

export interface FormErrorSummaryProps {
  /** A general message (the problem title), shown when the request failed. */
  readonly title?: string | null;
  /** Field errors that match no input (from `formErrors(...).other`). */
  readonly errors?: readonly FieldError[];
}

/** The form-level error banner: the problem title plus any field error without a matching input. */
export function FormErrorSummary({ title, errors = [] }: FormErrorSummaryProps) {
  if ((title === null || title === undefined) && errors.length === 0) {
    return null;
  }
  return (
    <Banner tone="error" title={title ?? t('ui.form.errorTitle')}>
      {errors.length > 0 && (
        <ul>
          {errors.map((item) => (
            <li key={`${item.field}:${item.code}`}>
              {item.field === '' ? item.message : `${item.field}: ${item.message}`}
            </li>
          ))}
        </ul>
      )}
    </Banner>
  );
}
