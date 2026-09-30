/** Compliance summaries of a bid (BUY-21): its checklist counts and whether it may be ranked (AC-17). */
import type { ComplianceBidRow } from '@contracts/opening';

import { Chip } from '../../../components/ui';
import { t } from '../../../lib/i18n';

export function CheckSummaryText({ row }: { readonly row: ComplianceBidRow }) {
  const summary = row.checkSummary;
  return (
    <span className="tiq-inline">
      <Chip tone="success" size="sm">
        {t('opening.checks.pass', { count: summary.pass })}
      </Chip>
      {summary.fail > 0 && (
        <Chip tone="danger" size="sm">
          {t('opening.checks.fail', { count: summary.fail })}
        </Chip>
      )}
      {summary.clarificationRequired > 0 && (
        <Chip tone="warning" size="sm">
          {t('opening.checks.clarification', { count: summary.clarificationRequired })}
        </Chip>
      )}
      {summary.pending > 0 && (
        <Chip tone="neutral" size="sm">
          {t('opening.checks.pending', { count: summary.pending })}
        </Chip>
      )}
      {summary.notApplicable > 0 && (
        <Chip tone="neutral" size="sm">
          {t('opening.checks.notApplicable', { count: summary.notApplicable })}
        </Chip>
      )}
    </span>
  );
}

export function RankingChip({ eligible }: { readonly eligible: boolean }) {
  return eligible ? (
    <Chip tone="success" size="sm">
      {t('opening.ranking.eligible')}
    </Chip>
  ) : (
    <Chip tone="danger" size="sm" icon="ban">
      {t('opening.ranking.notRanked')}
    </Chip>
  );
}
