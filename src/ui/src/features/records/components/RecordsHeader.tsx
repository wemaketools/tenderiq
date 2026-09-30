/** ADM-14 page header with the workspace tabs the membership may open. */
import type { ReactNode } from 'react';

import { usePermission } from '../../../auth/permissions';
import { LinkTabs, PageHeader } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { AUDIT_READ, EVIDENCE_PACKS_READ, RECORDS_READ, recordsPaths } from '../lib/permissions';

export interface RecordsHeaderProps {
  readonly title?: string;
  readonly subtitle?: ReactNode;
  readonly meta?: ReactNode;
  readonly primaryAction?: ReactNode;
  readonly actions?: ReactNode;
  readonly back?: { readonly to: string; readonly label: string };
}

export function RecordsHeader({
  title,
  subtitle,
  meta,
  primaryAction,
  actions,
  back,
}: RecordsHeaderProps) {
  const canAudit = usePermission(AUDIT_READ);
  const canRecords = usePermission(RECORDS_READ);
  const canPacks = usePermission(EVIDENCE_PACKS_READ);
  const tabs = [
    { to: recordsPaths.overview, label: t('records.tabs.overview'), end: true },
    ...(canAudit ? [{ to: recordsPaths.audit, label: t('records.tabs.audit') }] : []),
    ...(canRecords
      ? [
          { to: recordsPaths.retention, label: t('records.tabs.retention') },
          { to: recordsPaths.holds, label: t('records.tabs.holds') },
          { to: recordsPaths.disposals, label: t('records.tabs.disposals') },
        ]
      : []),
    ...(canPacks ? [{ to: recordsPaths.evidencePacks, label: t('records.tabs.packs') }] : []),
  ];
  return (
    <>
      <PageHeader
        title={title ?? t('records.title')}
        subtitle={subtitle}
        meta={meta}
        primaryAction={primaryAction}
        actions={actions}
        back={back}
      />
      <LinkTabs label={t('records.tabs.label')} tabs={tabs} />
    </>
  );
}
