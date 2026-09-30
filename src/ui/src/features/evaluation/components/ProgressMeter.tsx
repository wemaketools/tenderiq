/**
 * A labelled completion bar (`done` of `total`), exposed to assistive technology as a progressbar.
 */
import { t } from '../../../lib/i18n';

export function ProgressMeter({
  done,
  total,
  label,
}: {
  readonly done: number;
  readonly total: number;
  readonly label: string;
}) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <span className="tiq-stack">
      <span className="tiq-cell-sub">{t('evaluation.common.ofTotal', { done, total })}</span>
      <span
        className="tiq-progress"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <span className="tiq-progress-bar" style={{ width: `${percent}%` }} />
      </span>
    </span>
  );
}
