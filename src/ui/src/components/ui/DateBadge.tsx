/**
 * A date badge (docs/plan/design1): the day in large figures over the short month, for a calendar date or an instant
 * in its official zone. The full date (and, for an instant, the official time with its zone) is given to assistive
 * technology, so the badge never stands for an unexplained date.
 */
import {
  calendarDateParts,
  formatCalendarDate,
  formatOfficialTime,
  instantDateParts,
} from '../../lib/format';

export type DateBadgeProps =
  | {
      readonly date: string;
      readonly at?: undefined;
      readonly timeZone?: undefined;
      readonly size?: 'md' | 'lg';
    }
  | {
      readonly at: string;
      readonly timeZone: string;
      readonly date?: undefined;
      readonly size?: 'md' | 'lg';
    };

export function DateBadge(props: DateBadgeProps) {
  const size = props.size ?? 'md';
  const parts =
    props.date !== undefined
      ? calendarDateParts(props.date)
      : instantDateParts(props.at, props.timeZone);
  const spoken =
    props.date !== undefined
      ? formatCalendarDate(props.date)
      : formatOfficialTime(props.at, props.timeZone);
  if (parts === null) {
    return <span className="tiq-datebadge">{spoken}</span>;
  }
  return (
    <span className={size === 'lg' ? 'tiq-datebadge tiq-datebadge--lg' : 'tiq-datebadge'}>
      <span className="tiq-visually-hidden">{spoken}</span>
      <span className="tiq-datebadge-day" aria-hidden="true">
        {parts.day.padStart(2, '0')}
      </span>
      <span className="tiq-datebadge-month" aria-hidden="true">
        {parts.month}
      </span>
    </span>
  );
}
