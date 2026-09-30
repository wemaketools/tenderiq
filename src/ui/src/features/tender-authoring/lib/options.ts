/**
 * Select options fetched for the authoring dialogs: organization members who may own a lot or a requirement (they
 * need `tender.view`, the permission of the `observer` team role) and the criteria of the evaluation plans.
 */
import { getEvaluationPlans, getTeamCandidates } from '@contracts/tenders';

import { useApiQuery } from '../../../api/hooks';
import type { SelectOption } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { lotLabel } from './labels';

/** Members who may own a lot or a requirement; ineligible members are listed but disabled. */
export function useOwnerOptions(
  tenderId: number,
  enabled: boolean,
): readonly SelectOption[] | undefined {
  const query = useApiQuery(
    getTeamCandidates,
    enabled ? { params: { tenderId }, query: { teamRole: 'observer' } } : null,
  );
  return query.data?.candidates.map((row) => ({
    value: String(row.user.userId),
    label: row.eligible
      ? `${row.user.fullName}${row.capacity === null ? '' : ` · ${row.capacity}`}`
      : `${row.user.fullName} · ${row.ineligibleReason ?? t('tender-authoring.team.notEligible')}`,
    disabled: !row.eligible,
  }));
}

/** Every criterion of the tender's evaluation plans, labelled with its plan scope. */
export function useCriterionOptions(tenderId: number, enabled: boolean): readonly SelectOption[] {
  const query = useApiQuery(getEvaluationPlans, enabled ? { params: { tenderId } } : null);
  return (query.data?.plans ?? []).flatMap((plan) =>
    plan.criteria.map((criterion) => ({
      value: String(criterion.id),
      label: `${criterion.code} ${criterion.name}${plan.lot === null ? '' : ` · ${lotLabel(plan.lot)}`}`,
    })),
  );
}
