/**
 * BUY-05 Procurement plan and calendar. Required information: planned events, dependencies, budget periods,
 * expiries, expected release and resource demand. Principal actions: schedule, prioritize, allocate owners and
 * publish approved advance notices. Tabs: plan items, month calendar, resource demand, advance notices.
 */
import { requestEndpoints } from '@contracts/requests';
import type { PlanItemRow } from '@contracts/requests';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import { ButtonLink, KpiCard, KpiGrid, PageHeader, Tabs } from '../../../components/ui';
import { formatCount } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { CalendarTab } from '../components/CalendarTab';
import { NoticesTab } from '../components/NoticesTab';
import { PlanItemsTab } from '../components/PlanItemsTab';
import { ResourceDemandTab } from '../components/ResourceDemandTab';
import { planningPaths } from '../lib';

const TABS = ['items', 'calendar', 'demand', 'notices'] as const;
type TabId = (typeof TABS)[number];

const ALL_ITEMS = { query: { pageSize: 100 } } as const;
const PUBLISHED_NOTICES = { query: { status: ['published' as const], pageSize: 1 } };

export default function PlanningPage() {
  const canManage = usePermission('plan.manage');
  const [state, setState] = useScreenFilters('BUY-05', { tab: 'items' });
  const tab: TabId = (TABS as readonly string[]).includes(state.tab)
    ? (state.tab as TabId)
    : 'items';
  const items = useApiQuery(requestEndpoints.listPlanItems, ALL_ITEMS);
  const notices = useApiQuery(requestEndpoints.listAdvanceNotices, PUBLISHED_NOTICES);
  const rows = items.data?.items;
  const count = (predicate: (row: PlanItemRow) => boolean): string | null =>
    rows === undefined ? null : formatCount(rows.filter(predicate).length);

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('planning.plan.title')}
        subtitle={t('planning.plan.subtitle')}
        actions={
          canManage ? (
            <ButtonLink to={planningPaths.newNotice()} icon="megaphone">
              {t('planning.notices.new')}
            </ButtonLink>
          ) : undefined
        }
      />

      <KpiGrid>
        <KpiCard
          label={t('planning.plan.kpi.planned')}
          icon="calendar"
          value={count((row) => row.status === 'planned' || row.status === 'scheduled')}
          hint={t('planning.plan.kpi.plannedHint')}
        />
        <KpiCard
          label={t('planning.plan.kpi.unscheduled')}
          icon="clock"
          tone="warning"
          value={count(
            (row) =>
              (row.status === 'planned' || row.status === 'scheduled') &&
              row.plannedReleaseDate === null,
          )}
          hint={t('planning.plan.kpi.unscheduledHint')}
        />
        <KpiCard
          label={t('planning.plan.kpi.warnings')}
          icon="alertTriangle"
          tone="danger"
          value={count((row) => row.warnings.length > 0)}
          hint={t('planning.plan.kpi.warningsHint')}
        />
        <KpiCard
          label={t('planning.plan.kpi.expiries')}
          icon="hourglass"
          tone="info"
          value={count((row) => row.expiringContract !== null)}
          hint={t('planning.plan.kpi.expiriesHint', {
            count: notices.data?.total ?? 0,
          })}
        />
      </KpiGrid>

      <Tabs
        label={t('planning.plan.tabs.label')}
        selected={tab}
        onSelect={(id) => setState({ tab: id })}
        tabs={[
          { id: 'items', label: t('planning.plan.tabs.items'), count: items.data?.total },
          { id: 'calendar', label: t('planning.plan.tabs.calendar') },
          { id: 'demand', label: t('planning.plan.tabs.demand') },
          { id: 'notices', label: t('planning.plan.tabs.notices') },
        ]}
      >
        {tab === 'items' && <PlanItemsTab />}
        {tab === 'calendar' && <CalendarTab />}
        {tab === 'demand' && <ResourceDemandTab />}
        {tab === 'notices' && <NoticesTab />}
      </Tabs>
    </div>
  );
}
