/** Draft helpers of the structure forms (ADM-01, ADM-02): trimmed text, nullable values and client checks. */
import { t } from '../../../lib/i18n';
import type { Draft } from '../components/StructureRegister';

const CODE = /^[A-Z0-9][A-Z0-9-]{0,31}$/;
const COUNTRY = /^[A-Z]{2}$/;

export function text(draft: Draft, key: string): string {
  return (draft[key] ?? '').trim();
}
export function nullable(draft: Draft, key: string): string | null {
  const value = text(draft, key);
  return value === '' ? null : value;
}
export function idOrNull(draft: Draft, key: string): number | null {
  const value = text(draft, key);
  return value === '' ? null : Number(value);
}
export function nameCheck(draft: Draft, problems: Record<string, string>): void {
  if (text(draft, 'name').length < 2) problems.name = t('admin-org.structure.error.name');
}
export function codeCheck(draft: Draft, problems: Record<string, string>, required: boolean): void {
  const code = text(draft, 'code');
  if ((required || code !== '') && !CODE.test(code))
    problems.code = t('admin-org.structure.error.code');
}
export function countryCheck(draft: Draft, problems: Record<string, string>): void {
  if (!COUNTRY.test(text(draft, 'country')))
    problems.country = t('admin-org.structure.error.country');
}
