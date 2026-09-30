/**
 * COM-02 inside a form dialog: the acting organization, capacity, scope and result of the command the form
 * submits (the same block ConfirmActionDialog shows).
 */
import type { ReactNode } from 'react';

import { useActiveTenant } from '../../../app/hooks';
import { DetailList } from '../../../components/ui';
import { t } from '../../../lib/i18n';

export function ActingContext({
  scope,
  result,
}: {
  readonly scope: ReactNode;
  readonly result: ReactNode;
}) {
  const tenant = useActiveTenant();
  return (
    <div className="tiq-consequence" data-testid="acting-context">
      <DetailList
        stacked
        items={[
          {
            key: 'org',
            label: t('ui.confirm.organization'),
            value: tenant?.name ?? t('ui.confirm.noOrganization'),
          },
          { key: 'capacity', label: t('ui.confirm.capacity'), value: tenant?.capacity ?? null },
          { key: 'scope', label: t('ui.confirm.scope'), value: scope },
          { key: 'result', label: t('ui.confirm.result'), value: result },
        ]}
      />
    </div>
  );
}
