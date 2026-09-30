/** The editable state of an advance notice and its client checks (BUY-05). */
import { t } from '../../../lib/i18n';

export interface NoticeDraft {
  readonly title: string;
  readonly summary: string;
  readonly categoryId: string;
  readonly indicativeTiming: string;
  readonly estimatedValueBand: string;
  readonly eoiInstructions: string;
}

export const EMPTY_NOTICE: NoticeDraft = {
  title: '',
  summary: '',
  categoryId: '',
  indicativeTiming: '',
  estimatedValueBand: '',
  eoiInstructions: '',
};

export const NOTICE_FIELDS = [
  'planItemId',
  'title',
  'summary',
  'categoryId',
  'indicativeTiming',
  'estimatedValueBand',
  'eoiInstructions',
];

/** Client checks mirroring the contract. */
export function noticeErrors(draft: NoticeDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (draft.title.trim().length < 3) errors.title = t('planning.noticeForm.errors.title');
  if (draft.summary.trim().length < 10) errors.summary = t('planning.noticeForm.errors.summary');
  if (draft.indicativeTiming.trim().length < 2) {
    errors.indicativeTiming = t('planning.noticeForm.errors.timing');
  }
  return errors;
}

export function noticeBody(draft: NoticeDraft) {
  const text = (value: string): string | null => (value.trim() === '' ? null : value.trim());
  return {
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    categoryId: draft.categoryId === '' ? null : Number(draft.categoryId),
    indicativeTiming: draft.indicativeTiming.trim(),
    estimatedValueBand: text(draft.estimatedValueBand),
    eoiInstructions: text(draft.eoiInstructions),
  };
}
