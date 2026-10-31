/**
 * "This week" (docs/plan/design1 §3): the seven days from today in the official zone; today is the blue disc and a
 * day with deadlines carries a dot, with the count given in words for assistive technology.
 */
import { t } from '../../../lib/i18n';
import type { WeekDay } from '../lib/upNext';

export function WeekStrip({ days }: { readonly days: readonly WeekDay[] }) {
  return (
    <ul className="tiq-daystrip" aria-label={t('dashboard.week.title')}>
      {days.map((day) => {
        const classes = ['tiq-daystrip-item'];
        if (day.today) classes.push('tiq-daystrip-item--today');
        if (day.count > 0) classes.push('tiq-daystrip-item--busy');
        return (
          <li key={day.date} className={classes.join(' ')} data-date={day.date}>
            <span aria-hidden="true">{t(`format.weekday.${day.weekday}`)}</span>
            <span className="tiq-daystrip-num" aria-hidden="true">
              {day.day}
            </span>
            <span className="tiq-visually-hidden">
              {day.today
                ? t('dashboard.week.todayDay', {
                    weekday: t(`format.weekday.${day.weekday}`),
                    day: day.day,
                  })
                : t('dashboard.week.day', {
                    weekday: t(`format.weekday.${day.weekday}`),
                    day: day.day,
                  })}
              {day.count > 0 && ` ${t('dashboard.week.deadlines', { count: day.count })}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
