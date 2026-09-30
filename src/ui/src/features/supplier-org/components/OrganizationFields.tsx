/**
 * Form pieces shared by registration (SUP-02) and the profile editor (SUP-03): the locations editor (exactly one
 * registered office), the category picker over the shared catalog, and the language and country choices.
 */
import type { CategoryOption, ReferenceOptions } from '@contracts/suppliers';

import { Button, Card, Checkbox, MultiSelect, Select, TextField } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import {
  categoryChoices,
  countryOptions,
  effectiveCountry,
  emptyLocation,
} from '../lib/organizationForm';
import type { LocationDraft } from '../lib/organizationForm';

export interface LocationsEditorProps {
  readonly locations: readonly LocationDraft[];
  readonly onChange: (locations: LocationDraft[]) => void;
  /** Field error for `locations.<index>.<field>` or `locations`. */
  readonly errorFor: (path: string) => string | undefined;
  /** Countries and the default country (the reference endpoint). */
  readonly reference: ReferenceOptions | undefined;
}

export function LocationsEditor({
  locations,
  onChange,
  errorFor,
  reference,
}: LocationsEditorProps) {
  const update = (index: number, patch: Partial<LocationDraft>): void => {
    onChange(
      locations.map((location, position) => {
        if (patch.isRegisteredOffice === true) {
          return position === index
            ? { ...location, ...patch }
            : { ...location, isRegisteredOffice: false };
        }
        return position === index ? { ...location, ...patch } : location;
      }),
    );
  };
  const groupError = errorFor('locations');
  return (
    <div className="tiq-stack">
      {locations.map((location, index) => (
        <Card
          key={location.key}
          title={t('supplier-org.locations.itemTitle', { no: index + 1 })}
          headingLevel={4}
          actions={
            locations.length > 1 ? (
              <Button
                size="sm"
                icon="trash"
                onClick={() => onChange(locations.filter((_, position) => position !== index))}
              >
                {t('supplier-org.locations.remove', { no: index + 1 })}
              </Button>
            ) : undefined
          }
        >
          <div className="tiq-form-grid">
            <TextField
              label={t('supplier-org.locations.name')}
              required
              value={location.name}
              onChange={(name) => update(index, { name })}
              error={errorFor(`locations.${index}.name`)}
            />
            <Select
              label={t('supplier-org.locations.country')}
              required
              value={effectiveCountry(location.country, reference)}
              options={countryOptions(reference)}
              onChange={(country) => update(index, { country })}
              error={errorFor(`locations.${index}.country`)}
            />
            <TextField
              label={t('supplier-org.locations.address')}
              required
              fieldClassName="tiq-form-full"
              value={location.address}
              onChange={(address) => update(index, { address })}
              error={errorFor(`locations.${index}.address`)}
            />
            <TextField
              label={t('supplier-org.locations.region')}
              value={location.region}
              onChange={(region) => update(index, { region })}
              error={errorFor(`locations.${index}.region`)}
            />
            <Checkbox
              label={t('supplier-org.locations.registeredOffice')}
              hint={t('supplier-org.locations.registeredOfficeHint')}
              checked={location.isRegisteredOffice}
              onChange={(checked) => update(index, { isRegisteredOffice: checked })}
            />
          </div>
        </Card>
      ))}
      {groupError !== undefined && (
        <p className="tiq-field-error" role="alert">
          {groupError}
        </p>
      )}
      <div>
        <Button
          icon="plus"
          size="sm"
          onClick={() => onChange([...locations, emptyLocation(false)])}
          disabled={locations.length >= 20}
        >
          {t('supplier-org.locations.add')}
        </Button>
      </div>
    </div>
  );
}

export interface CategoryPickerProps {
  readonly options: readonly CategoryOption[] | undefined;
  readonly value: readonly string[];
  readonly onChange: (value: string[]) => void;
  readonly error?: string;
  readonly loadFailed?: boolean;
}

export function CategoryPicker({
  options,
  value,
  onChange,
  error,
  loadFailed,
}: CategoryPickerProps) {
  return (
    <MultiSelect
      label={t('supplier-org.fields.categories')}
      hint={
        loadFailed === true
          ? t('supplier-org.fields.categoriesUnavailable')
          : t('supplier-org.fields.categoriesHint')
      }
      required
      fieldClassName="tiq-form-full"
      value={value}
      onChange={onChange}
      options={options === undefined ? [] : categoryChoices(options)}
      error={error}
    />
  );
}
