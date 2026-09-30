/**
 * Authoring issues of a section (contradictions, missing owners, coherence checks). Blocking errors and warnings
 * look distinct and are announced with their severity, so the difference never depends on colour alone.
 */
import type { TenderIssue } from '@contracts/tenders';

import { Chip, Icon } from '../../../components/ui';
import { t } from '../../../lib/i18n';

export function IssueChips({ issues }: { readonly issues: readonly TenderIssue[] }) {
  if (issues.length === 0) return null;
  const blocking = issues.filter((issue) => issue.severity === 'blocking').length;
  const warnings = issues.length - blocking;
  return (
    <span className="tiq-inline">
      {blocking > 0 && (
        <Chip tone="danger" size="sm" icon="xCircle">
          {t('tender-authoring.issues.blockingCount', { count: blocking })}
        </Chip>
      )}
      {warnings > 0 && (
        <Chip tone="warning" size="sm" icon="alertTriangle">
          {t('tender-authoring.issues.warningCount', { count: warnings })}
        </Chip>
      )}
    </span>
  );
}

export function IssueList({
  issues,
  label,
}: {
  readonly issues: readonly TenderIssue[];
  readonly label: string;
}) {
  if (issues.length === 0) return null;
  const sorted = [...issues].sort(
    (a, b) => Number(b.severity === 'blocking') - Number(a.severity === 'blocking'),
  );
  return (
    <ul className="tiq-readiness" aria-label={label}>
      {sorted.map((issue, index) => (
        <li
          key={`${issue.code}-${issue.field ?? ''}-${index}`}
          className={`tiq-readiness-item tiq-readiness-item--${issue.severity}`}
        >
          <Icon name={issue.severity === 'blocking' ? 'xCircle' : 'alertTriangle'} />
          <span className="tiq-readiness-text">
            <span>
              <span className="tiq-visually-hidden">
                {t(`tender-authoring.issues.severity.${issue.severity}`)}:{' '}
              </span>
              {issue.message}
            </span>
          </span>
          <Chip tone={issue.severity === 'blocking' ? 'danger' : 'warning'} size="sm">
            {t(`tender-authoring.issues.severity.${issue.severity}`)}
          </Chip>
        </li>
      ))}
    </ul>
  );
}
