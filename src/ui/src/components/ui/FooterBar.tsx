/**
 * The reference footer bar (DD-34, PRD §15.2 freshness) for dashboards and reports: product mark, the currency basis
 * of the amounts shown, the "data as of" time (with its zone) and a refresh button.
 */
import { formatOfficialTime } from '../../lib/format';
import { t } from '../../lib/i18n';
import { IconButton } from './Button';

export interface FooterBarProps {
  /** Currency basis of every amount on the page, for example `BWP`. `null` hides the statement. */
  readonly currency: string | null;
  /** When the data was computed (server instant). */
  readonly asOf: string | null;
  /** The zone the "as of" time is shown in (the tenant's official zone). */
  readonly timeZone: string;
  readonly onRefresh?: () => void;
  readonly refreshing?: boolean;
  /** Optional conversion basis (PRD §15.2), for example "Converted at CBB rates of 29 Sep 2026". */
  readonly conversionNote?: string;
}

export function FooterBar({
  currency,
  asOf,
  timeZone,
  onRefresh,
  refreshing = false,
  conversionNote,
}: FooterBarProps) {
  return (
    <footer className="tiq-footer">
      <span>{t('shell.footer.copyright')}</span>
      <span>
        {currency !== null && t('shell.footer.currency', { currency })}
        {conversionNote !== undefined && ` · ${conversionNote}`}
      </span>
      <span className="tiq-footer-asof" aria-live="polite">
        {asOf !== null && t('shell.footer.asOf', { time: formatOfficialTime(asOf, timeZone) })}
        {onRefresh !== undefined && (
          <IconButton
            icon="refresh"
            label={t('shell.footer.refresh')}
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            aria-busy={refreshing || undefined}
          />
        )}
      </span>
    </footer>
  );
}
