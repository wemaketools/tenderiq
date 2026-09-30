/** The five most recent exports the caller may see, with a link to the full history (ADM-13). */
import { reportingEndpoints } from '@contracts/reporting';

import { useApiQuery } from '../../../api/hooks';
import { Card, CardLink } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { ExportsTable } from './ExportsTable';

export function RecentExports() {
  const query = useApiQuery(reportingEndpoints.listExports, {
    query: { exportType: ['report'], sort: 'requestedAt', dir: 'desc', pageSize: 5 },
  });
  return (
    <Card
      flush
      title={t('reports.exports.recentTitle')}
      subtitle={t('reports.exports.recentSubtitle')}
      actions={
        <CardLink to="/buyer/admin/reports/exports">{t('reports.exports.viewAll')}</CardLink>
      }
    >
      <ExportsTable
        caption={t('reports.exports.recentTitle')}
        rows={query.data?.items}
        loading={query.isFetching}
        error={query.error}
        onRetry={query.reload}
      />
    </Card>
  );
}
