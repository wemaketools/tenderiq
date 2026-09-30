/**
 * OfficialDeadline (BR-11, BR-12, DD-33; docs/technical/09-frontend.md §13): always the date, time, UTC offset and
 * IANA zone of the event's OFFICIAL time zone, for example `14 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone`, plus
 * the abbreviation when Intl provides one. Local-time help (the user's display zone) is secondary and only shown
 * when it differs. A time-remaining hint may accompany the official line, never replace it.
 */
import type { OfficialDeadline as OfficialDeadlineValue } from '@contracts/common';

import { useAppSelector } from '../../app/hooks';
import { browserTimeZone, formatTimeRemaining, officialTimeParts } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';

export interface OfficialDeadlineProps {
  readonly deadline: OfficialDeadlineValue;
  /** Label of the block variant, for example "Submission deadline". */
  readonly label?: string;
  readonly variant?: 'inline' | 'block';
  /** Show the user's local time when it differs from the official zone (default true). */
  readonly showLocal?: boolean;
  /** Add "2 days 4 hours left" next to the official time (default false). */
  readonly showRemaining?: boolean;
}

const SOON_MS = 48 * 3_600_000;

export function OfficialDeadline({
  deadline,
  label,
  variant = 'inline',
  showLocal = true,
  showRemaining = false,
}: OfficialDeadlineProps) {
  const displayZone = useAppSelector((state) => state.session.user?.displayTimeZone ?? null);
  const now = useNow(showRemaining ? 30_000 : 60_000);
  const official = officialTimeParts(deadline.at, deadline.timeZone);
  const localZone = displayZone ?? browserTimeZone();
  const local = officialTimeParts(deadline.at, localZone);
  const showLocalLine =
    showLocal && (local.offset !== official.offset || localZone !== deadline.timeZone);
  const remaining = new Date(deadline.at).getTime() - now;

  const classes = ['tiq-deadline'];
  if (variant === 'block') {
    classes.push('tiq-deadline--block');
    if (remaining < 0) classes.push('tiq-deadline--passed');
    else if (remaining < SOON_MS) classes.push('tiq-deadline--soon');
  }

  return (
    <span className={classes.join(' ')} data-testid="official-deadline">
      {variant === 'block' && label !== undefined && (
        <span className="tiq-deadline-label">{label}</span>
      )}
      <time className="tiq-deadline-official" dateTime={deadline.at}>
        {official.dateTime}{' '}
        <span className="tiq-deadline-zone">
          ({official.offset}) {official.timeZone}
          {official.abbreviation !== null && ` · ${official.abbreviation}`}
        </span>
      </time>
      {showRemaining && (
        <span
          className={remaining < 0 ? 'tiq-deadline-status tiq-text-muted' : 'tiq-deadline-status'}
        >
          {formatTimeRemaining(deadline.at, now)}
        </span>
      )}
      {showLocalLine && (
        <span className="tiq-deadline-local">{t('ui.deadline.local', { time: local.text })}</span>
      )}
    </span>
  );
}
