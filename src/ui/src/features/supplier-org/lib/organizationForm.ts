/**
 * Form helpers shared by registration (SUP-02) and the profile editor (SUP-03): location drafts, the category
 * choices over the shared catalog, and the country and language options. Countries come from the reference endpoint
 * (`referenceOptions`); a location left on "" uses the platform's default country.
 */
import type { CategoryOption, ReferenceOptions } from '@contracts/suppliers';

import { t } from '../../../lib/i18n';

export interface LocationDraft {
  readonly key: string;
  readonly name: string;
  readonly address: string;
  readonly region: string;
  readonly country: string;
  readonly isRegisteredOffice: boolean;
}

/** Working languages offered in the forms. */
export const LANGUAGE_CODES = ['en', 'tn'] as const;

/** The country choices served by the API (empty until the reference lists load). */
export function countryOptions(reference: ReferenceOptions | undefined) {
  return (reference?.countries ?? []).map((option) => ({ value: option.code, label: option.name }));
}

/** The display name of a country code (the code itself when the lists are not loaded). */
export function countryName(code: string, reference: ReferenceOptions | undefined): string {
  return reference?.countries.find((option) => option.code === code)?.name ?? code;
}

/** A chosen country, or the platform's default country while the field is still untouched (""). */
export function effectiveCountry(value: string, reference: ReferenceOptions | undefined): string {
  return value === '' ? (reference?.defaultCountry ?? '') : value;
}

export function languageOptions() {
  return LANGUAGE_CODES.map((code) => ({ value: code, label: t(`supplier-org.language.${code}`) }));
}

/** A readable name for a language code (unknown codes show the code). */
export function languageName(code: string): string {
  return (LANGUAGE_CODES as readonly string[]).includes(code)
    ? t(`supplier-org.language.${code}`)
    : code;
}

let nextKey = 0;
/** A new empty location row (the first one is the registered office); its country follows the default until chosen. */
export function emptyLocation(isRegisteredOffice: boolean): LocationDraft {
  nextKey += 1;
  return {
    key: `location-${nextKey}`,
    name: '',
    address: '',
    region: '',
    country: '',
    isRegisteredOffice,
  };
}

/** Draft rows → the contract's location input (region left out when blank, untouched country = default). */
export function toLocationInputs(
  locations: readonly LocationDraft[],
  reference: ReferenceOptions | undefined,
) {
  return locations.map((location) => ({
    name: location.name.trim(),
    address: location.address.trim(),
    ...(location.region.trim() === '' ? {} : { region: location.region.trim() }),
    country: effectiveCountry(location.country, reference),
    isRegisteredOffice: location.isRegisteredOffice,
  }));
}

/** Catalog options as "Parent › Child" labels, parents first. */
export function categoryChoices(options: readonly CategoryOption[]) {
  const byCode = new Map(options.map((option) => [option.code, option]));
  return options
    .map((option) => {
      const parent = option.parentCode === null ? undefined : byCode.get(option.parentCode);
      return {
        value: option.code,
        label: parent === undefined ? option.name : `${parent.name} › ${option.name}`,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}
