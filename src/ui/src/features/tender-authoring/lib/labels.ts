/** Display labels of the contract's domain values that have no blueprint enumeration. */
import { hasTranslation, t } from '../../../lib/i18n';

/** The label of a tender section (`lots` → "Lots"). */
export function sectionLabel(section: string): string {
  return t(`tender-authoring.section.${section}`);
}

/** A lot label: "Lot 2 · Calcium hypochlorite". */
export function lotLabel(lot: { readonly lotNo: number; readonly title: string }): string {
  return t('tender-authoring.common.lotLabel', { no: lot.lotNo, title: lot.title });
}

/** A lot label, or "Whole tender" when the record applies to every lot. */
export function scopeLabel(lot: { readonly lotNo: number; readonly title: string } | null): string {
  return lot === null ? t('tender-authoring.common.wholeTender') : lotLabel(lot);
}

/** A language name for an ISO 639-1 code ("tn" → "Setswana"); the code itself when the name is unknown. */
export function languageName(code: string): string {
  const key = `tender-authoring.language.${code}`;
  if (hasTranslation(key)) return t(key);
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Several language names, comma separated. */
export function languageNames(codes: readonly string[]): string {
  return codes.map(languageName).join(', ');
}

/** "BWP only", or "BWP; also accepted: ZAR, USD" (each code once). */
export function currenciesText(currency: string, accepted: readonly string[]): string {
  const others = accepted.filter((code) => code !== currency);
  return others.length === 0
    ? t('tender-authoring.preview.currencyOnly', { code: currency })
    : t('tender-authoring.preview.currencyAlso', { code: currency, others: others.join(', ') });
}
