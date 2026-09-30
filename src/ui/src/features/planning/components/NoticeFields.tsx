/**
 * The advance notice fields (BUY-05 → PUB-06): title, summary, category, indicative timing, estimated value band
 * and expression-of-interest instructions. A notice is a forecast, never an invitation to submit a bid.
 */
import type { RequestOptions } from '@contracts/requests';

import { Select, TextArea, TextField } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import type { NoticeDraft } from './noticeDraft';

export function NoticeFields({
  draft,
  onChange,
  options,
  errorOf,
}: {
  readonly draft: NoticeDraft;
  readonly onChange: (next: NoticeDraft) => void;
  readonly options: RequestOptions | undefined;
  readonly errorOf: (field: string) => string | undefined;
}) {
  const set = (key: keyof NoticeDraft, value: string): void => onChange({ ...draft, [key]: value });
  return (
    <div className="tiq-form-grid">
      <TextField
        label={t('planning.noticeFields.title')}
        required
        fieldClassName="tiq-form-full"
        value={draft.title}
        onChange={(value) => set('title', value)}
        error={errorOf('title')}
      />
      <TextArea
        label={t('planning.noticeFields.summary')}
        required
        fieldClassName="tiq-form-full"
        rows={4}
        value={draft.summary}
        onChange={(value) => set('summary', value)}
        error={errorOf('summary')}
      />
      <Select
        label={t('planning.noticeFields.category')}
        value={draft.categoryId}
        onChange={(value) => set('categoryId', value)}
        placeholder={t('planning.common.none')}
        options={(options?.categories ?? []).map((category) => ({
          value: String(category.id),
          label: `${category.code} ${category.name}`,
        }))}
        error={errorOf('categoryId')}
      />
      <TextField
        label={t('planning.noticeFields.timing')}
        required
        hint={t('planning.noticeFields.timingHint')}
        value={draft.indicativeTiming}
        onChange={(value) => set('indicativeTiming', value)}
        error={errorOf('indicativeTiming')}
      />
      <TextField
        label={t('planning.noticeFields.valueBand')}
        hint={t('planning.noticeFields.valueBandHint')}
        value={draft.estimatedValueBand}
        onChange={(value) => set('estimatedValueBand', value)}
        error={errorOf('estimatedValueBand')}
      />
      <TextArea
        label={t('planning.noticeFields.eoi')}
        hint={t('planning.noticeFields.eoiHint')}
        fieldClassName="tiq-form-full"
        rows={3}
        value={draft.eoiInstructions}
        onChange={(value) => set('eoiInstructions', value)}
        error={errorOf('eoiInstructions')}
      />
    </div>
  );
}
