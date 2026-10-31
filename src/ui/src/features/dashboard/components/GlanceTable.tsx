/**
 * "Your tenders, at a glance" (docs/plan/design1 §3): one plain row per tender with its nearest deadline: the tender
 * (title and reference), the milestone, the owner and the official deadline (DD-33). The row opens the tender.
 */
import type { DashboardDeadline } from '@contracts/reporting';

import { DataTable, OfficialDeadline, Person } from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';

export function GlanceTable({ rows }: { readonly rows: readonly DashboardDeadline[] }) {
  const columns: DataTableColumn<DashboardDeadline>[] = [
    {
      id: 'tender',
      header: t('dashboard.glance.col.tender'),
      cell: (row) => (
        <>
          <span className="tiq-cell-title">{row.title}</span>
          <span className="tiq-cell-sub">{row.reference}</span>
        </>
      ),
    },
    {
      id: 'milestone',
      header: t('dashboard.glance.col.milestone'),
      cell: (row) =>
        row.lotLabel === null
          ? tEnum('tender_milestones.milestone', row.milestone)
          : t('dashboard.deadlines.milestoneLot', {
              milestone: tEnum('tender_milestones.milestone', row.milestone),
              lot: row.lotLabel,
            }),
    },
    {
      id: 'owner',
      header: t('dashboard.glance.col.owner'),
      cell: (row) => <Person name={row.owner.fullName} size="sm" />,
    },
    {
      id: 'deadline',
      header: t('dashboard.glance.col.deadline'),
      cell: (row) => <OfficialDeadline deadline={row.deadline} showLocal={false} />,
    },
  ];
  return (
    <DataTable
      variant="plain"
      caption={t('dashboard.glance.caption')}
      columns={columns}
      rows={rows}
      rowKey={(row) => String(row.tenderId)}
      rowLabel={(row) => `${row.reference} ${row.title}`}
      rowHref={(row) => row.to}
    />
  );
}
