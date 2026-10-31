/**
 * FilterBar (architecture-plan §7, `overview.png` and `leads.png`): a card of labelled filters with optional quick
 * ranges, a search box, and "Clear filters". The filter fields are the form field components; their state usually
 * lives in the tenant-scoped filters slice (`useScreenFilters`).
 */
import { useId } from 'react';
import type { FormEvent, ReactNode } from 'react';

import { t } from '../../lib/i18n';
import { Button } from './Button';
import { Icon } from './Icon';

export interface FilterBarProps {
  readonly children: ReactNode;
  /** Shows "Clear filters" when given. */
  readonly onClear?: () => void;
  /** Disables "Clear filters" when nothing is filtered. */
  readonly canClear?: boolean;
  /** Accessible name of the filter region. */
  readonly label?: string;
  readonly quickRanges?: ReactNode;
  /** `panel`: the soft, unframed panel of a filter disclosure (docs/plan/design1); default: a card. */
  readonly variant?: 'card' | 'panel';
}

export function FilterBar({
  children,
  onClear,
  canClear = true,
  label,
  quickRanges,
  variant = 'card',
}: FilterBarProps) {
  if (variant === 'panel') {
    return (
      <section className="tiq-toolbar-panel" aria-label={label ?? t('ui.filters.label')}>
        {quickRanges}
        {children}
        {onClear !== undefined && (
          <div className="tiq-toolbar-panel-actions">
            <Button size="sm" onClick={onClear} disabled={!canClear}>
              {t('ui.filters.clear')}
            </Button>
          </div>
        )}
      </section>
    );
  }
  return (
    <section className="tiq-card" aria-label={label ?? t('ui.filters.label')}>
      <div className="tiq-filterbar">
        {quickRanges}
        {children}
        {onClear !== undefined && (
          <div className="tiq-filterbar-actions">
            <Button onClick={onClear} disabled={!canClear}>
              {t('ui.filters.clear')}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

export interface QuickRangeOption {
  readonly id: string;
  readonly label: string;
}

export interface QuickRangesProps {
  readonly options: readonly QuickRangeOption[];
  readonly selected: string | null;
  readonly onSelect: (id: string) => void;
  readonly label: string;
}

/** Toggle buttons such as "This month / Last month / This quarter". */
export function QuickRanges({ options, selected, onSelect, label }: QuickRangesProps) {
  return (
    <div className="tiq-filterbar-quick" role="group" aria-label={label}>
      {options.map((option) => (
        <Button
          key={option.id}
          size="sm"
          variant={option.id === selected ? 'primary' : 'secondary'}
          aria-pressed={option.id === selected}
          onClick={() => onSelect(option.id)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

export interface SearchFieldProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Called on Enter. */
  readonly onSubmit?: (value: string) => void;
  readonly label: string;
  readonly placeholder?: string;
  /** Visually hide the label (the placeholder and icon explain it). */
  readonly hideLabel?: boolean;
  readonly full?: boolean;
}

/** A search input with the leading magnifier (`.tiq-searchbox`). */
export function SearchField({
  value,
  onChange,
  onSubmit,
  label,
  placeholder,
  hideLabel = false,
  full = false,
}: SearchFieldProps) {
  const id = useId();
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onSubmit?.(value);
  };
  return (
    <form role="search" className="tiq-field" onSubmit={submit}>
      <label htmlFor={id} className={hideLabel ? 'tiq-visually-hidden' : undefined}>
        {label}
      </label>
      <div className={full ? 'tiq-searchbox tiq-searchbox--full' : 'tiq-searchbox'}>
        <Icon name="search" />
        <input
          id={id}
          type="search"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </form>
  );
}
