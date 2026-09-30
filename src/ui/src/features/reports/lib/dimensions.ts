/**
 * The dimension choices (legal entities, departments, categories, owners, stages) the caller may filter reports
 * by. They come from the dashboard's authorized filter options, so a caller only ever sees the dimensions of
 * records they may read.
 */
import { reportingEndpoints } from '@contracts/reporting';
import type { BuyerDashboard } from '@contracts/reporting';

import { useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';

export type DimensionOptions = BuyerDashboard['filterOptions'];

const NO_OPTIONS: DimensionOptions = {
  legalEntities: [],
  departments: [],
  categories: [],
  owners: [],
  stages: [],
};

export function useDimensionOptions(): DimensionOptions {
  const allowed = usePermission('dashboard.view');
  const query = useApiQuery(reportingEndpoints.getBuyerDashboard, allowed ? { query: {} } : null);
  return query.data?.filterOptions ?? NO_OPTIONS;
}
