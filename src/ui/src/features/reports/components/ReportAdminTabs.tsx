/** ADM-13 header and tabs: report definitions and the controlled export history. */
import type { ReactNode } from 'react';

import { usePermission } from '../../../auth/permissions';
import { ButtonLink, LinkTabs, PageHeader } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { EXPORT_READ, REPORT_READ } from '../lib/shared';

export function ReportAdminHeader({ actions }: { readonly actions?: ReactNode }) {
  const canManage = usePermission('report.manage');
  const canDefinitions = usePermission(REPORT_READ);
  const canExports = usePermission(EXPORT_READ);
  const tabs = [
    ...(canDefinitions
      ? [{ to: '/buyer/admin/reports', label: t('reports.admin.tabs.definitions'), end: true }]
      : []),
    ...(canExports
      ? [{ to: '/buyer/admin/reports/exports', label: t('reports.admin.tabs.exports') }]
      : []),
  ];
  return (
    <>
      <PageHeader
        title={t('reports.admin.title')}
        subtitle={t('reports.admin.intro')}
        primaryAction={
          canManage ? (
            <ButtonLink to="/buyer/reports/definitions/new" variant="primary" icon="plus">
              {t('reports.catalog.newDefinition')}
            </ButtonLink>
          ) : undefined
        }
        actions={actions}
      />
      {tabs.length > 1 && <LinkTabs label={t('reports.admin.tabs.label')} tabs={tabs} />}
    </>
  );
}
