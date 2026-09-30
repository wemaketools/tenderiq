/**
 * An answer progress meter: complete / total, with an accessible text equivalent.
 */
import type { ProgressCounts } from '@contracts/bids';

import { t } from '../../../lib/i18n';

export function ProgressMeter({ progress }: { readonly progress: ProgressCounts }) {
  const percent = progress.total === 0 ? 0 : Math.round((progress.complete / progress.total) * 100);
  const label = t('responses.progress.label', {
    complete: progress.complete,
    total: progress.total,
  });
  return (
    <span className="tiq-stack">
      <span>{label}</span>
      <span
        className="tiq-progress"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span className="tiq-progress-bar" style={{ width: `${percent}%`, display: 'block' }} />
      </span>
    </span>
  );
}
