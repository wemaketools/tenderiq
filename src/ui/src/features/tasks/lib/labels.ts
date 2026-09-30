/** Labels of free-form record types (task sources): the catalog label, or the type in words. */
import { hasTranslation, t } from '../../../lib/i18n';

export function sourceTypeLabel(sourceType: string): string {
  const key = `tasks.sourceType.${sourceType}`;
  if (hasTranslation(key)) return t(key);
  const words = sourceType.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
