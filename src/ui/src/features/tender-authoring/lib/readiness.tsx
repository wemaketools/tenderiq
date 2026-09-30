/** Maps contract readiness items onto the ReadinessChecklist component, with a link to the section that fixes each. */
import type { ReadinessItem } from '@contracts/tenders';

import { ButtonLink } from '../../../components/ui';
import type { ReadinessItem as ChecklistItem } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { sectionLabel } from './labels';

export function readinessItems(items: readonly ReadinessItem[]): ChecklistItem[] {
  return items.map((item) => ({
    id: item.id,
    status: item.status,
    label: `${sectionLabel(item.section)}: ${item.title}`,
    ...(item.detail === null ? {} : { detail: item.detail }),
    ...(item.link === null || item.status === 'passed'
      ? {}
      : {
          action: (
            <ButtonLink to={item.link} size="sm" variant="ghost">
              {t('tender-authoring.readiness.open')}
            </ButtonLink>
          ),
        }),
  }));
}
