/** Routes and classification helpers of the document screens (COM-07). */
import { DOCUMENT_CLASSIFICATION_BREADTH } from '@contracts/documents';
import { DOCUMENTS_CLASSIFICATION } from '@contracts/enums';
import type { DocumentsClassification } from '@contracts/enums';

export const documentPaths = {
  list: '/me/documents',
  document: (documentId: number) => `/me/documents/${documentId}`,
} as const;

/** Classifications that restrict reading to assigned users (or, for sealed content, to nobody before opening). */
export const RESTRICTED_CLASSIFICATIONS: readonly DocumentsClassification[] = [
  'restricted_assessment',
  'commercially_confidential',
  'sealed',
];

/** Classifications wider than the original's, offered for a redacted copy (CLASSIFICATION_NOT_WIDER otherwise). */
export function widerClassifications(original: DocumentsClassification): DocumentsClassification[] {
  return DOCUMENTS_CLASSIFICATION.filter(
    (value) => DOCUMENT_CLASSIFICATION_BREADTH[value] > DOCUMENT_CLASSIFICATION_BREADTH[original],
  );
}

/**
 * The readable name of a document language code (`en` → English, `tn` → Setswana), falling back to the code itself
 * when the browser has no name for it.
 */
export function languageName(code: string): string {
  try {
    const names = new Intl.DisplayNames(['en'], { type: 'language' });
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}
