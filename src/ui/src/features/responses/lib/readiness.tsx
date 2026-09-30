/**
 * Maps contract readiness findings to checklist items: a translated label per code, the category as detail and a
 * link to where the finding is fixed.
 */
import { Link } from 'react-router';

import type { ReadinessItem as ContractReadinessItem } from '@contracts/bids';

import type { ReadinessItem } from '../../../components/ui';
import { t } from '../../../lib/i18n';

function labelOf(item: ContractReadinessItem): string {
  if (item.code === 'CHECK_PASSED') {
    return t(`responses.readiness.passed.${item.category}`);
  }
  return t(`responses.readiness.code.${item.code}`, {
    count: item.count ?? 1,
    subject: item.subject ?? '',
  });
}

export function toChecklistItems(items: readonly ContractReadinessItem[]): ReadinessItem[] {
  return items.map((item) => ({
    id: item.id,
    status: item.severity,
    label: labelOf(item),
    detail: t(`responses.readiness.category.${item.category}`),
    action:
      item.link === null || item.severity === 'passed' ? undefined : (
        <Link to={item.link} className="tiq-btn tiq-btn--link tiq-btn--sm">
          {t('responses.readiness.fix')}
        </Link>
      ),
  }));
}
