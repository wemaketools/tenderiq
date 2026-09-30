/**
 * REP-01 — Management reports (FR-21, PRD §13.4, §15.1; styled on `reports.png`). The report families with the
 * questions they answer and their dimensions. Each card opens the report or produces a controlled CSV export with a
 * manifest. A family the caller's role may not run shows why, never an empty report (BR-43).
 */
import { useState } from 'react';

import { reportingEndpoints } from '@contracts/reporting';
import type { ReportFamilySummary } from '@contracts/reporting';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Button,
  ButtonLink,
  Card,
  Chip,
  EmptyState,
  FooterBar,
  Icon,
  PageHeader,
  QueryView,
  RestrictedState,
} from '../../../components/ui';
import { formatInstantDate } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { ExportDialog } from '../components/ExportDialog';
import { RecentExports } from '../components/RecentExports';
import { EMPTY_FILTERS, FAMILY_ICON } from '../lib/definitions';
import { EXPORT_READ, REPORT_ADMIN_READ } from '../lib/shared';

export default function ReportsPage() {
  const tenant = useActiveTenant();
  const canManage = usePermission('report.manage');
  const canExport = usePermission('export.create');
  const canAdmin = usePermission(REPORT_ADMIN_READ);
  const canSeeExports = usePermission(EXPORT_READ);
  const query = useApiQuery(reportingEndpoints.listReportFamilies, {});
  const [exporting, setExporting] = useState<ReportFamilySummary | null>(null);
  const currency = query.data?.currency ?? tenant?.defaultCurrency ?? 'BWP';

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('reports.catalog.title')}
        subtitle={t('reports.catalog.intro')}
        primaryAction={
          canManage ? (
            <ButtonLink to="/buyer/reports/definitions/new" variant="primary" icon="plus">
              {t('reports.catalog.newDefinition')}
            </ButtonLink>
          ) : undefined
        }
        actions={
          canAdmin ? (
            <ButtonLink to="/buyer/admin/reports" icon="sliders">
              {t('reports.catalog.definitionsAndExports')}
            </ButtonLink>
          ) : undefined
        }
      />
      <QueryView
        query={query}
        isEmpty={(data) => data.families.length === 0}
        empty={<EmptyState icon="barChart" title={t('reports.catalog.empty')} />}
      >
        {(data) => (
          <div className="tiq-grid tiq-grid--3">
            {data.families.map((family) => (
              <FamilyCard
                key={family.family}
                family={family}
                timeZone={tenant?.officialTimeZone ?? 'UTC'}
                canExport={canExport}
                onExport={() => setExporting(family)}
              />
            ))}
          </div>
        )}
      </QueryView>
      {canSeeExports && <RecentExports />}
      <ExportDialog
        open={exporting !== null}
        onClose={() => setExporting(null)}
        source={{
          kind: 'family',
          family: exporting?.family ?? 'pipeline',
          filters: EMPTY_FILTERS,
          currency,
        }}
        scopeLabel={
          exporting === null
            ? ''
            : t('reports.catalog.exportScope', { family: exporting.title, currency })
        }
      />
      <FooterBar
        currency={query.data?.currency ?? null}
        asOf={query.data?.asOf ?? null}
        timeZone={tenant?.officialTimeZone ?? 'UTC'}
        refreshing={query.isFetching}
        onRefresh={query.reload}
      />
    </div>
  );
}

function FamilyCard({
  family,
  timeZone,
  canExport,
  onExport,
}: {
  readonly family: ReportFamilySummary;
  readonly timeZone: string;
  readonly canExport: boolean;
  readonly onExport: () => void;
}) {
  return (
    <Card
      aria-label={family.title}
      title={
        <span className="tiq-inline" style={{ flexWrap: 'nowrap' }}>
          <span className="tiq-kpi-halo">
            <Icon name={FAMILY_ICON[family.family]} />
          </span>
          <span>{family.title}</span>
        </span>
      }
      subtitle={family.description}
      footer={
        family.restricted ? undefined : (
          <div className="tiq-inline">
            <ButtonLink
              to={`/buyer/reports/${family.family}`}
              variant="primary"
              size="sm"
              icon="fileText"
              aria-label={t('reports.catalog.openNamed', { family: family.title })}
            >
              {t('reports.catalog.open')}
            </ButtonLink>
            {canExport && (
              <Button
                variant="ghost"
                size="sm"
                icon="download"
                onClick={onExport}
                aria-label={t('reports.catalog.csvNamed', { family: family.title })}
              >
                {t('reports.catalog.csv')}
              </Button>
            )}
          </div>
        )
      }
    >
      {family.restricted ? (
        <RestrictedState
          compact
          description={family.restrictionReason ?? t('reports.catalog.restricted')}
        />
      ) : (
        <div className="tiq-stack" style={{ gap: 'var(--tiq-space-2)' }}>
          <span className="tiq-cell-sub">{family.questions}</span>
          <div className="tiq-inline">
            {family.dimensions.slice(0, 6).map((dimension) => (
              <Chip key={dimension} tone="neutral" size="sm">
                {dimension}
              </Chip>
            ))}
          </div>
          <span className="tiq-cell-sub">
            {family.lastRunAt === null
              ? t('reports.catalog.neverRun')
              : t('reports.catalog.lastRun', {
                  date: formatInstantDate(family.lastRunAt, timeZone),
                })}
            {' · '}
            {t('reports.catalog.savedDefinitions', { count: family.savedDefinitions })}
          </span>
        </div>
      )}
    </Card>
  );
}
